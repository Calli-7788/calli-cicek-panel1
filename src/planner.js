// ═══════════════ PLANLAYICI — MARJİNAL TAHSİS MOTORU ═══════════════
// Faz B (Planlayıcı Evrimi): kutu-kutu marjinal atama.
// Korunan: katmanlı fiyat skoru (%45 son2 + %25 son6-8 + %20 genel + %10 geçen yıl),
// güven skoru (örnek %30 + güncellik %35 + oynaklık %35), absorpsiyon (median/P75/max/son60),
// şube seçim modları, AI anlatım katmanı.
// Kalkan: GÖNDER/AZALT/GÖNDERME yüzde eşikleri ve genel-ortalama-bazlı tahmini net —
// yerine doygunluk + belirsizlik cezası + durma mantığı (ekonomik ikame).

// Doygunluk çarpanı: o komboya şu ana dek atanan demete göre marjinal değer düşer.
// atanan > max → null (kombo kapanır).
function saturationCarpan(atanan, median, p75, mx) {
  var S = window.PLANNER_SATURATION;
  if (atanan <= median) return S.medianCarpan;
  if (atanan <= p75) {
    if (p75 <= median) return S.p75Carpan;
    return S.medianCarpan + (S.p75Carpan - S.medianCarpan) * (atanan - median) / (p75 - median);
  }
  if (atanan <= mx) {
    if (mx <= p75) return S.maxCarpan;
    return S.p75Carpan + (S.maxCarpan - S.p75Carpan) * (atanan - p75) / (mx - p75);
  }
  return null;
}

async function handlePlan() {
  if (state.planFlowers.length === 0 || state.planLoading) return;
  if (state.planBranchMode === "manual" && state.planManualBranches.length === 0) {
    alert("Manuel modda en az 1 şube seçmelisin!");
    return;
  }
  state.planLoading = true;
  state.planResult = null;
  state.planDagilim = null;
  state.planBeklet = null;
  state.planTahminiNet = 0;
  render();

  var filtered = getFiltered();
  var hd = getHeatData(filtered);

  // ── 2026 Recent data (last 14 days) for trends ──
  var last14 = new Date(); last14.setDate(last14.getDate() - 14);
  var last14str = last14.toISOString().split("T")[0];
  var recentData = ALL_DATA.filter(function(r){ return r.t >= last14str });

  // ── 2025 data for historical context ──
  var data2025 = ALL_DATA.filter(function(r){ return r.t.startsWith("2025") });

  var trendInfo = "\nSEÇİLİ DÖNEM: " + fD(state.sd) + " – " + fD(state.ed);

  // Strateji → belirsizlik ceza katsayısı (yeni rol)
  var stratejiK = state.planStrategy === "safe" ? 1.0 : state.planStrategy === "balanced" ? 0.5 : 0.2;

  var dagilim = [];
  var beklet = [];
  var kesifPlanSayisi = 0;  // plan başına en çok 2 keşif kutusu (tüm çiçekler toplamı)

  // ── Per flower: metrikler + marjinal tahsis ──
  state.planFlowers.forEach(function(pf) {
    var flowerFiltered = filtered.filter(function(r){ return r.c === pf.name });
    var flowerRecent = recentData.filter(function(r){ return r.c === pf.name });
    var flower2025 = data2025.filter(function(r){ return r.c === pf.name });

    var byBranch = {};
    flowerFiltered.forEach(function(r){
      if(!byBranch[r.s]) byBranch[r.s] = {net:0,d:0};
      byBranch[r.s].net += r.net; byBranch[r.s].d += r.d;
    });

    var totalNet = flowerFiltered.reduce(function(s,r){return s+r.net},0);
    var totalD = flowerFiltered.reduce(function(s,r){return s+r.d},0);
    var genelOrtalama = totalD > 0 ? totalNet / totalD : 0;

    var uniqueDates = [...new Set(flowerRecent.map(function(r){return r.t}))].sort().reverse();
    var last2Dates = uniqueDates.slice(0, 2);

    var last2ByBranch = {};
    flowerRecent.filter(function(r){ return last2Dates.includes(r.t) }).forEach(function(r){
      if(!last2ByBranch[r.s]) last2ByBranch[r.s] = {net:0,d:0};
      last2ByBranch[r.s].net += r.net; last2ByBranch[r.s].d += r.d;
    });

    var dailyByBranch = {};
    flowerRecent.forEach(function(r){
      if(!dailyByBranch[r.s]) dailyByBranch[r.s] = {};
      if(!dailyByBranch[r.s][r.t]) dailyByBranch[r.s][r.t] = {net:0,d:0};
      dailyByBranch[r.s][r.t].net += r.net; dailyByBranch[r.s][r.t].d += r.d;
    });

    var branch2025 = {};
    flower2025.forEach(function(r){
      if(!branch2025[r.s]) branch2025[r.s] = {net:0,d:0};
      branch2025[r.s].net += r.net; branch2025[r.s].d += r.d;
    });

    // Aday şube listesi — şube moduna göre
    var adayIsimler;
    if (state.planBranchMode === "manual") {
      adayIsimler = state.planManualBranches.slice();
    } else {
      adayIsimler = Object.keys(byBranch);
      if (state.planBranchMode === "explore") {
        Object.keys(branch2025).forEach(function(b){ if (adayIsimler.indexOf(b) === -1) adayIsimler.push(b); });
      }
    }

    var branchRanked = adayIsimler.map(function(bName){
      var bd = byBranch[bName] || {net:0,d:0};
      var avgDbn = bd.d > 0 ? bd.net / bd.d : 0;

      var days = Object.entries(dailyByBranch[bName] || {}).sort(function(a,b){return a[0].localeCompare(b[0])});
      var trendPct = 0;
      if (days.length >= 2) {
        var fH = days.slice(0, Math.floor(days.length/2));
        var sH = days.slice(Math.floor(days.length/2));
        var fA = fH.reduce(function(s,d){return s+(d[1].d>0?d[1].net/d[1].d:0)},0) / fH.length;
        var sA = sH.reduce(function(s,d){return s+(d[1].d>0?d[1].net/d[1].d:0)},0) / sH.length;
        trendPct = fA > 0 ? ((sA - fA) / fA * 100) : 0;
      }

      var last2Data = last2ByBranch[bName];
      var last2Dbn = last2Data && last2Data.d > 0 ? last2Data.net / last2Data.d : null;

      var midDates = uniqueDates.slice(0, Math.min(8, uniqueDates.length));
      var midData = flowerRecent.filter(function(r){ return midDates.includes(r.t) && r.s === bName });
      var midDbn = midData.reduce(function(s,r){return s+r.d},0) > 0 ? midData.reduce(function(s,r){return s+r.net},0) / midData.reduce(function(s,r){return s+r.d},0) : null;

      var hist = branch2025[bName];
      var histDbn = hist && hist.d > 0 ? hist.net / hist.d : 0;

      // Katmanlı fiyat skoru (45/25/20/10) — KORUNDU
      var skorDbn = 0;
      var skorAgirliktoplam = 0;
      if (last2Dbn !== null && last2Dbn > 0) { skorDbn += last2Dbn * 0.45; skorAgirliktoplam += 0.45; }
      if (midDbn !== null && midDbn > 0) { skorDbn += midDbn * 0.25; skorAgirliktoplam += 0.25; }
      if (avgDbn > 0) { skorDbn += avgDbn * 0.20; skorAgirliktoplam += 0.20; }
      if (histDbn > 0) { skorDbn += histDbn * 0.10; skorAgirliktoplam += 0.10; }
      var filtreSkoru = skorAgirliktoplam > 0 ? skorDbn / skorAgirliktoplam : avgDbn;

      // Absorpsiyon istatistikleri (tüm veri, mezat günü bazlı) — KORUNDU
      var komboData = ALL_DATA.filter(function(r){ return r.c === pf.name && r.s === bName });
      var komboGunluk = {};
      komboData.forEach(function(r){ if(!komboGunluk[r.t]) komboGunluk[r.t] = 0; komboGunluk[r.t] += r.d; });
      var komboVals = Object.values(komboGunluk).sort(function(a,b){return a-b});
      var absMedian = komboVals.length > 0 ? komboVals[Math.floor(komboVals.length/2)] : 0;
      var absP75 = komboVals.length >= 4 ? komboVals[Math.floor(komboVals.length * 0.75)] : absMedian;
      var absMax = komboVals.length > 0 ? komboVals[komboVals.length-1] : 0;
      var d60 = new Date(); d60.setDate(d60.getDate()-60);
      var d60str = d60.toISOString().split("T")[0];
      var absSon60 = komboData.filter(function(r){ return r.t >= d60str });
      var absAlimSayisi = new Set(absSon60.map(function(r){return r.t})).size;

      // Güven skoru (örnek %30 + güncellik %35 + oynaklık %35) — KORUNDU
      var ornekSayisi = komboVals.length;
      var sonSatis = komboData.length > 0 ? komboData.reduce(function(mx,r){return r.t>mx?r.t:mx},"") : "";
      var guncellik = 0;
      if (sonSatis) { var gunFark = Math.round((new Date() - new Date(sonSatis+"T00:00:00")) / 864e5); guncellik = Math.max(0, 100 - gunFark * 2); }
      var oynaklık = 0;
      if (komboVals.length >= 3) {
        var kFiyatlar = komboData.filter(function(r){return r.d>0}).map(function(r){return r.net/r.d});
        var kOrt = kFiyatlar.reduce(function(s,x){return s+x},0) / kFiyatlar.length;
        var kStd = Math.sqrt(kFiyatlar.reduce(function(s,x){return s+Math.pow(x-kOrt,2)},0) / kFiyatlar.length);
        oynaklık = kOrt > 0 ? Math.max(0, 100 - (kStd/kOrt*100)*2) : 0;
      }
      var guvenSkor = Math.round(
        Math.min(100, ornekSayisi * 3) * 0.30 +
        guncellik * 0.35 +
        oynaklık * 0.35
      );
      var guvenLabel = guvenSkor >= 70 ? "Yüksek" : guvenSkor >= 40 ? "Orta" : "Düşük";

      // Belirsizlik: son dönem CV (son 60 gün; yetersizse tüm kombo verisi; ≤2 örnek → 1)
      var cvRows = absSon60.filter(function(r){ return r.d > 0 });
      if (cvRows.length < 3) cvRows = komboData.filter(function(r){ return r.d > 0 });
      var cv = 1;
      if (cvRows.length >= 3) {
        var cvFiyat = cvRows.map(function(r){ return r.net / r.d });
        var cvOrt = cvFiyat.reduce(function(s,x){return s+x},0) / cvFiyat.length;
        var cvStd = Math.sqrt(cvFiyat.reduce(function(s,x){return s+Math.pow(x-cvOrt,2)},0) / cvFiyat.length);
        cv = cvOrt > 0 ? cvStd / cvOrt : 1;
      }

      // Ayarlı skor: belirsizlik cezası strateji katsayısıyla
      var ayarliSkor = filtreSkoru * (1 - stratejiK * Math.min(1, cv));

      return {name:bName, dbn:avgDbn, d:bd.d, trend:trendPct, histDbn:histDbn, last2Dbn:last2Dbn, midDbn:midDbn, filtreSkoru:filtreSkoru, cv:cv, ayarliSkor:ayarliSkor, absMedian:absMedian, absP75:absP75, absMax:absMax, absAlimSayisi:absAlimSayisi, guvenSkor:guvenSkor, guvenLabel:guvenLabel};
    }).sort(function(a,b){ return b.ayarliSkor - a.ayarliSkor });

    trendInfo += "\n\n" + pf.name + " (" + pf.demet + " demet) — Genel ort: " + fmt(genelOrtalama) + "/dm";
    if (last2Dates.length > 0) trendInfo += " | Son 2 mezat: " + last2Dates.map(function(d){return fD(d)}).join(", ");

    trendInfo += "\n  ŞUBE ANALİZİ (ayarlı skora göre):";
    branchRanked.forEach(function(b) {
      var trendDir = b.trend > 3 ? "↑" : b.trend < -3 ? "↓" : "→";
      var histNote = b.histDbn > 0 ? " | 2025:" + fmt(b.histDbn) : "";
      var last2Note = b.last2Dbn !== null ? " | Son2mezat:" + fmt(b.last2Dbn) : " | Son2mezat:YOK";
      trendInfo += "\n    " + b.name + ": skor " + fmt(b.filtreSkoru) + "/dm → ayarlı " + fmt(b.ayarliSkor) + "/dm (CV:" + (b.cv*100).toFixed(0) + "%, trend:" + trendDir + (b.trend>0?"+":"") + b.trend.toFixed(0) + "%" + last2Note + histNote + ") | Güven:" + b.guvenLabel + " | Absorpsiyon: median=" + b.absMedian + "dm, P75=" + b.absP75 + "dm, max=" + b.absMax + "dm, son60gün=" + b.absAlimSayisi + "alım";
    });

    if (state.planBranchMode === "explore") {
      var lowVolume = branchRanked.filter(function(b){ return b.d <= 5 && b.dbn > 0 });
      if (lowVolume.length > 0) {
        trendInfo += "\n  🔍 AZ DENENMİŞ AMA VERİSİ OLAN:";
        lowVolume.forEach(function(b){
          trendInfo += "\n    ⭐ " + b.name + ": " + fmt(b.dbn) + "/dm (sadece " + b.d + "dm)";
        });
      }
    }

    // ── MARJİNAL TAHSİS: kutu kutu en yüksek marjinal değere ata ──
    var kutuSayisi = Math.ceil(pf.demet / state.planBoxSize);
    var kutular = [];
    for (var ki = 0; ki < kutuSayisi; ki++) {
      kutular.push(ki === kutuSayisi - 1 ? pf.demet - state.planBoxSize * (kutuSayisi - 1) : state.planBoxSize);
    }

    var atananMap = {};
    var atamalar = [];
    for (var bi = 0; bi < kutular.length; bi++) {
      var kutuDemet = kutular[bi];
      var enIyi = null;

      branchRanked.forEach(function(b) {
        var atanan = atananMap[b.name] || 0;
        // Düşük güven VEYA absorpsiyon verisi yok → ana tahsise girmez, yalnız keşif yolu.
        // (Verisiz kombonun skoru 0 olduğundan keşif eşiğini de geçemez — fiilen dışarıda kalır.)
        var yalnizKesif = b.guvenLabel === "Düşük" || b.absMax === 0;
        if (!yalnizKesif) {
          // Ana tahsis adayı — doygunluk çarpanı uygulanır
          var carpan = saturationCarpan(atanan, b.absMedian, b.absP75, b.absMax);
          if (carpan === null) return; // kombo kapandı (atanan > max)
          var marjinal = b.ayarliSkor * carpan;
          if (!enIyi || marjinal > enIyi.marjinal) enIyi = { b: b, marjinal: marjinal, carpan: carpan, kesif: false };
        } else if (state.planStrategy === "aggressive" && kesifPlanSayisi < 2 && atanan === 0 &&
                   genelOrtalama > 0 && b.filtreSkoru > genelOrtalama) {
          // KEŞİF: güven düşük ama skor genel ortalamanın üstünde — en fazla 1 kutu
          var marjinalK = b.ayarliSkor;
          if (!enIyi || marjinalK > enIyi.marjinal) enIyi = { b: b, marjinal: marjinalK, carpan: 1.0, kesif: true };
        }
      });

      var kalanDemet = 0;
      if (!enIyi || enIyi.marjinal <= 0) {
        for (var kj = bi; kj < kutular.length; kj++) kalanDemet += kutular[kj];
        beklet.push({
          cicek: pf.name, demet: kalanDemet,
          sebep: !enIyi ? (branchRanked.length === 0 ? "veri yok" : "kapasite doldu") : "marjinal katkı ≤ 0"
        });
        break;
      }

      atamalar.push({ sube: enIyi.b.name, demet: kutuDemet, dbn: enIyi.marjinal, carpan: enIyi.carpan, kesif: enIyi.kesif, guven: enIyi.kesif ? "düşük" : enIyi.b.guvenLabel.toLocaleLowerCase("tr-TR") });
      atananMap[enIyi.b.name] = (atananMap[enIyi.b.name] || 0) + kutuDemet;
      if (enIyi.kesif) kesifPlanSayisi++;
    }

    // Atamaları kombo bazında birleştir → dagilim satırları
    var subeAg = {};
    atamalar.forEach(function(a) {
      if (!subeAg[a.sube]) subeAg[a.sube] = { kutu: 0, demet: 0, net: 0, carpanAgirlikli: 0, kesif: false, guven: a.guven };
      subeAg[a.sube].kutu++;
      subeAg[a.sube].demet += a.demet;
      subeAg[a.sube].net += a.demet * a.dbn;
      subeAg[a.sube].carpanAgirlikli += a.carpan * a.demet;
      if (a.kesif) subeAg[a.sube].kesif = true;
    });
    Object.entries(subeAg).sort(function(a,b){ return b[1].net - a[1].net }).forEach(function(e) {
      var v = e[1];
      dagilim.push({
        cicek: pf.name, sube: e[0], kutu: v.kutu, demet: v.demet,
        tahminiDbn: v.demet > 0 ? v.net / v.demet : 0,
        tahminiNet: v.net,
        guven: v.guven,
        doygunlukCarpani: v.demet > 0 ? +(v.carpanAgirlikli / v.demet).toFixed(3) : 1,
        kesifKutusu: v.kesif
      });
    });
  });

  var tahminiToplamNet = dagilim.reduce(function(s,x){ return s + x.tahminiNet }, 0);
  state.planDagilim = dagilim;
  state.planBeklet = beklet;
  state.planTahminiNet = tahminiToplamNet;

  // ── Dağılım metni (AI context + yerel plan aynı kaynaktan) ──
  var dagilimText = "\n\n=== HESAPLANAN DAĞILIM (kod tarafından, KESİN) ===";
  state.planFlowers.forEach(function(pf) {
    var rows = dagilim.filter(function(x){ return x.cicek === pf.name });
    dagilimText += "\n" + pf.name + " (" + pf.demet + " dm):";
    if (rows.length === 0) dagilimText += " atama yok";
    rows.forEach(function(x) {
      dagilimText += "\n  📦 " + x.sube + ": " + x.kutu + " kutu, " + x.demet + " dm × " + fmt(x.tahminiDbn) + "/dm = " + fmt(x.tahminiNet) + " (güven: " + x.guven + ", doygunluk: " + x.doygunlukCarpani.toFixed(2) + (x.kesifKutusu ? ", 🔍 KEŞİF" : "") + ")";
    });
  });
  if (beklet.length > 0) {
    dagilimText += "\nBEKLET:";
    beklet.forEach(function(bk){ dagilimText += "\n  ⏸ " + bk.cicek + ": " + bk.demet + " dm — " + bk.sebep; });
  }
  dagilimText += "\nTAHMİNİ TOPLAM NET (dağılım bazlı): " + fmt(tahminiToplamNet);

  var branchModeText = "";
  if (state.planBranchMode === "auto") {
    branchModeText = "\n\nŞUBE SEÇİM MODU: OTOMATİK — dağılım, seçili dönemde verisi olan şubeler arasından marjinal değere göre hesaplandı.";
  } else if (state.planBranchMode === "manual") {
    branchModeText = "\n\nŞUBE SEÇİM MODU: MANUEL — dağılım SADECE şu şubelerle sınırlı hesaplandı: " + state.planManualBranches.join(", ");
  } else if (state.planBranchMode === "explore") {
    branchModeText = "\n\nŞUBE SEÇİM MODU: DENEME — 2025'te satış olan ama bu dönem verisi olmayan şubeler de aday havuzuna katıldı.";
  }

  var hist2025Text = "";
  if (data2025.length > 0) {
    var hist25ByF = {};
    data2025.forEach(function(r){
      if(!hist25ByF[r.c]) hist25ByF[r.c]={net:0,d:0};
      hist25ByF[r.c].net+=r.net; hist25ByF[r.c].d+=r.d;
    });
    hist2025Text = "\n\n2025 GEÇMİŞ VERİ (referans):\n";
    hist2025Text += Object.entries(hist25ByF).map(function(e){
      return e[0] + ": " + fmt(e[1].d>0?e[1].net/e[1].d:0) + "/dm, " + e[1].d + "dm";
    }).join("; ");
  }

  var mevsimselText = "";
  try {
    var bugun = new Date();
    var buHaftaNo = getWeekNumber(bugun);
    var buAy = bugun.getMonth() + 1;
    var ayAdlari = ["","Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
    var gecmisYillar = [...new Set(ALL_DATA.map(function(r){return r.t.substring(0,4)}))].filter(function(y){return y !== String(bugun.getFullYear())}).sort();

    mevsimselText = "\n\n=== 🗓 MEVSİMSEL ZEKA (ENFLASYONSUz) ===";

    var haftaVerileri = {};
    gecmisYillar.forEach(function(yil) {
      var yilData = ALL_DATA.filter(function(r){return r.t.startsWith(yil)});
      var yilDbn = yilData.reduce(function(s,r){return s+r.d},0) > 0 ? yilData.reduce(function(s,r){return s+r.net},0) / yilData.reduce(function(s,r){return s+r.d},0) : 0;
      if (yilDbn <= 0) return;

      var haftaData = yilData.filter(function(r){
        var d = new Date(r.t + "T00:00:00");
        return getWeekNumber(d) === buHaftaNo;
      });
      if (haftaData.length === 0) {
        haftaData = yilData.filter(function(r){return parseInt(r.t.substring(5,7)) === buAy});
      }
      if (haftaData.length === 0) return;

      var haftaDbn = haftaData.reduce(function(s,r){return s+r.d},0) > 0 ? haftaData.reduce(function(s,r){return s+r.net},0) / haftaData.reduce(function(s,r){return s+r.d},0) : 0;
      var mevsimselYuzde = yilDbn > 0 ? ((haftaDbn / yilDbn) * 100).toFixed(0) : "—";

      haftaVerileri[yil] = { dbn: haftaDbn, yuzde: mevsimselYuzde, demet: haftaData.reduce(function(s,r){return s+r.d},0) };

      var cicekMap = {};
      haftaData.forEach(function(r){
        if(!cicekMap[r.c]) cicekMap[r.c] = {net:0,d:0};
        cicekMap[r.c].net += r.net; cicekMap[r.c].d += r.d;
      });
      haftaVerileri[yil].cicekler = Object.entries(cicekMap).map(function(e){
        return e[0] + ":" + fmt(e[1].d>0?e[1].net/e[1].d:0) + "/dm";
      }).join(", ");
    });

    if (Object.keys(haftaVerileri).length > 0) {
      mevsimselText += "\nBu hafta (Hafta " + buHaftaNo + ", " + ayAdlari[buAy] + ") geçmiş yıllarda:";
      Object.entries(haftaVerileri).forEach(function(e) {
        mevsimselText += "\n  " + e[0] + ": ort " + fmt(e[1].dbn) + "/dm (yıl ort'un %" + e[1].yuzde + "'i, " + e[1].demet + "dm)";
        if (e[1].cicekler) mevsimselText += " → " + e[1].cicekler;
      });

      var yuzdeler = Object.values(haftaVerileri).map(function(v){return parseInt(v.yuzde)}).filter(function(n){return !isNaN(n)});
      if (yuzdeler.length > 0) {
        var ortYuzde = yuzdeler.reduce(function(s,x){return s+x},0) / yuzdeler.length;
        mevsimselText += "\n  📊 Ortalama mevsimsel endeks: %" + ortYuzde.toFixed(0) + " (100=yıl ortalaması)";
        if (ortYuzde > 110) mevsimselText += " → 🔥 Bu hafta tarihsel olarak YÜKSEK fiyat dönemi.";
        else if (ortYuzde > 100) mevsimselText += " → ✅ Bu hafta ortalamanın üstünde.";
        else if (ortYuzde > 90) mevsimselText += " → ⚡ Bu hafta ortalamaya yakın.";
        else mevsimselText += " → ⚠️ Bu hafta tarihsel olarak DÜŞÜK fiyat dönemi.";
      }
    }

    var fc = getForecast();
    if (fc.genelTahmin.merkez > 0) {
      mevsimselText += "\n\n🔮 FİYAT TAHMİNİ (önümüzdeki hafta):";
      mevsimselText += "\n  Genel: " + fmt(fc.genelTahmin.merkez) + "/dm (bant: " + fmt(fc.genelTahmin.alt) + "–" + fmt(fc.genelTahmin.ust) + ", güven: " + fc.genelTahmin.guven + ")";
      mevsimselText += "\n  Son hafta trendi: " + (fc.trendPct > 0 ? "+" : "") + fc.trendPct.toFixed(1) + "%";
      state.planFlowers.forEach(function(pf) {
        var ct = fc.cicekTahminleri.find(function(c){return c.cicek === pf.name});
        if (ct) {
          mevsimselText += "\n  " + pf.name + ": tahmin " + fmt(ct.merkez) + "/dm (bant: " + fmt(ct.alt) + "–" + fmt(ct.ust) + ", güven: " + ct.guven + ", trend: " + (ct.trend > 0 ? "+" : "") + ct.trend.toFixed(0) + "%)";
        }
      });
    }

    var ozelGunUyari = "";
    OZEL_GUNLER.forEach(function(og) {
      var mm = parseInt(og.tarih.substring(0, 2));
      var dd = parseInt(og.tarih.substring(3, 5));
      var ozelDate = new Date(bugun.getFullYear(), mm - 1, dd);
      if (ozelDate < bugun) ozelDate.setFullYear(ozelDate.getFullYear() + 1);
      var gunFarki = Math.round((ozelDate - bugun) / 864e5);
      if (gunFarki <= 14 && gunFarki >= 0) {
        ozelGunUyari += "\n  🎉 " + og.ad + " " + gunFarki + " gün sonra! Fiyat artışı beklenir.";
      }
    });
    if (ozelGunUyari) mevsimselText += "\n\n⏰ ÖZEL GÜN UYARISI:" + ozelGunUyari;

  } catch(e) { mevsimselText = ""; }

  // Strateji açıklamaları — yeni rol: belirsizlik ceza katsayısı + keşif davranışı
  var strategyDesc = {
    safe: "GÜVENLİ (k=1.0):\n" +
      "• Belirsizlik cezası TAM — oynak (yüksek CV) kombolar sert cezalandırılır, dağılım kanıtlanmış kombolara yoğunlaşır.\n" +
      "• Keşif kutusu YOK.\n" +
      "• Felsefe: Az kazanayım ama kayıp riskim düşük olsun.",
    balanced: "DENGELİ (k=0.5):\n" +
      "• Belirsizlik cezası ORTA — fiyat ile risk dengelenir.\n" +
      "• Keşif kutusu YOK.\n" +
      "• Felsefe: Makul risk, makul kazanç.",
    aggressive: "AGRESİF (k=0.2):\n" +
      "• Belirsizlik cezası DÜŞÜK — yüksek potansiyelli oynak kombolar şans bulur.\n" +
      "• KEŞİF: absorpsiyon verisi olmayan ama skoru genel ortalamanın üstündeki kombolara en fazla 2 keşif kutusu (birer kutu).\n" +
      "• Felsefe: Maksimum kazanç potansiyeli, kontrollü test."
  };

  var totalDemet = state.planFlowers.reduce(function(s,f){return s+f.demet},0);
  var totalKutu = Math.ceil(totalDemet / state.planBoxSize);

  var planPrompt = "GÖREV: Aşağıda kod tarafından hesaplanmış gönderim dağılımı var. Bu dağılımı GEREKÇELENDİR ve anlat.\n\n" +
    "KESİLEN ÇİÇEKLER:\n" + state.planFlowers.map(function(f){ return "- " + f.name + ": " + f.demet + " demet" }).join("\n") +
    "\nTOPLAM: " + totalDemet + " demet, " + totalKutu + " kutu (" + state.planBoxSize + " dm/kutu)" +
    "\n\nSTRATEJİ: " + strategyDesc[state.planStrategy] +
    branchModeText +
    dagilimText +
    "\n\nGÜNCEL VERİLER:" + trendInfo +
    "\n\nKombo sıralaması: " + hd.slice(0,25).map(function(h){return h.cicek+"→"+h.sube+":"+fmt(h.dbn)+"/dm"}).join("; ") +
    hist2025Text +
    mevsimselText +
    "\n\n🚨 ZORUNLU KURALLAR:\n" +
    "1. HESAPLANAN DAĞILIM tablosu KESİNDİR — kutu/demet/şube sayılarını DEĞİŞTİRME, yeni kombo EKLEME, kombo ÇIKARMA.\n" +
    "2. Görevin ANLATIM: her şube ataması için gerekçe (fiyat skoru, trend, güven, absorpsiyon), riskleri belirt.\n" +
    "3. Rakam üretme — tahmini net rakamlarını dağılım tablosundan AYNEN kullan.\n" +
    "4. 🔍 KEŞİF işaretli kutuları 'test gönderimi' olarak anlat, nedenini belirt.\n" +
    "5. BEKLET listesi varsa: ertesi mezata bekletme veya bilinçli düşük fiyat kabulü seçeneklerini kısaca değerlendir.\n" +
    "\nÇIKTI FORMATI:\n" +
    "📦 [ŞUBE] - [KUTU] kutu ([DEMET] dm [ÇİÇEK])\n" +
    "  Gerekçe: fiyat/trend/güven kısa açıklama\n" +
    "\n⏸ BEKLET (varsa): açıklama + öneri\n" +
    "\n📊 ÖZET:\n" +
    "- Toplam: X kutu (Y demet)\n" +
    "- TAHMİNİ NET GELİR: " + fmt(tahminiToplamNet) + " (dağılım bazlı — bu rakamı aynen kullan)\n" +
    "- Risk notu\n" +
    "- Mevsimsel not (varsa)";

  try {
    var resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: "Sen çiçek mezat lojistik uzmanısın. Yalova'da üretici, Flora mezatına gönderiyor. Türkçe.\n\n" +
          "EN ÖNEMLİ KURAL: Dağılım KOD tarafından marjinal tahsis algoritmasıyla hesaplandı — sen ANLATIM katmanısın.\n" +
          "Kutu/demet/şube sayılarını değiştirme, rakam uydurma. Verilen tahmini net rakamlarını aynen kullan.\n" +
          "Görevin: dağılımı gerekçelendir, riskleri belirt, beklet listesi için öneri ver.\n" +
          "🔍 KEŞİF kutularını 'test gönderimi' olarak işaretle.\n" +
          "KESme çiçek üreticisi üretimi anlık artıramaz — sadece gönderim stratejisi anlatılır.\n\n" +
          "STRATEJİ BAĞLAMI:\n" + strategyDesc[state.planStrategy],
        messages: [{ role: "user", content: planPrompt }]
      })
    });
    var data = await resp.json();
    if (data.content && data.content.length > 0) {
      state.planResult = data.content.map(function(b){ return b.text || "" }).join("\n");
    } else if (data.error) {
      state.planResult = generateLocalPlan();
    } else {
      state.planResult = generateLocalPlan();
    }
  } catch(e) {
    state.planResult = generateLocalPlan();
  }

  state.planLoading = false;
  render();
}

// Yerel (deterministik) plan — AI erişilemezse dagilim tablosundan üretilir
function generateLocalPlan() {
  var dagilim = state.planDagilim || [];
  var beklet = state.planBeklet || [];
  if (dagilim.length === 0 && beklet.length === 0) {
    return "📦 GÖNDERİM PLANI\n\nDağılım üretilemedi — seçili dönemde plan çiçekleri için şube verisi yok. Tarih aralığını genişletmeyi dene.";
  }

  var plan = "📦 GÖNDERİM PLANI (Marjinal Tahsis — Yerel Özet)\n\n";
  state.planFlowers.forEach(function(pf) {
    var rows = dagilim.filter(function(x){ return x.cicek === pf.name });
    plan += "**" + pf.name + "** (" + pf.demet + " demet):\n";
    if (rows.length === 0) plan += "  atama yok\n";
    rows.forEach(function(x) {
      plan += "  📦 " + x.sube + ": " + x.kutu + " kutu (" + x.demet + " dm) — " + fmt(x.tahminiDbn) + "/dm → " + fmt(x.tahminiNet) + (x.kesifKutusu ? " 🔍 KEŞİF" : "") + " [güven: " + x.guven + "]\n";
    });
    plan += "\n";
  });

  if (beklet.length > 0) {
    plan += "⏸ **BEKLET:**\n";
    beklet.forEach(function(bk) {
      plan += "  " + bk.cicek + ": " + bk.demet + " dm — " + bk.sebep + ". Ertesi mezata bekletmeyi veya düşük fiyatı bilinçli kabul etmeyi değerlendir.\n";
    });
    plan += "\n";
  }

  plan += "💰 **TAHMİNİ TOPLAM NET (dağılım bazlı): " + fmt(state.planTahminiNet || 0) + "**\n";
  plan += "\nNot: AI anlatımı şu an erişilemez — bu deterministik özet aynı motor çıktısından üretildi.";
  return plan;
}
