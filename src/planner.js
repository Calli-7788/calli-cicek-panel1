// ═══════════════ PLANLAYICI (DOKUNULMAZ) ═══════════════

async function handlePlan() {
  if (state.planFlowers.length === 0 || state.planLoading) return;
  if (state.planBranchMode === "manual" && state.planManualBranches.length === 0) {
    alert("Manuel modda en az 1 şube seçmelisin!");
    return;
  }
  state.planLoading = true;
  state.planResult = null;
  render();

  var filtered = getFiltered();
  var stats = calcStats(filtered);
  var hd = getHeatData(filtered);

  // ── 2026 Recent data (last 14 days) for trends ──
  var last14 = new Date(); last14.setDate(last14.getDate() - 14);
  var last14str = last14.toISOString().split("T")[0];
  var recentData = ALL_DATA.filter(function(r){ return r.t >= last14str });

  // ── 2025 data for historical context ──
  var data2025 = ALL_DATA.filter(function(r){ return r.t.startsWith("2025") });

  var trendInfo = "\nSEÇİLİ DÖNEM: " + fD(state.sd) + " – " + fD(state.ed);

  // ── Per flower: price ranking + last 2 auction filter + 2025 data ──
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

    var branchRanked = Object.entries(byBranch).map(function(e){
      var avgDbn = e[1].d > 0 ? e[1].net / e[1].d : 0;

      var days = Object.entries(dailyByBranch[e[0]] || {}).sort(function(a,b){return a[0].localeCompare(b[0])});
      var trendPct = 0;
      if (days.length >= 2) {
        var fH = days.slice(0, Math.floor(days.length/2));
        var sH = days.slice(Math.floor(days.length/2));
        var fA = fH.reduce(function(s,d){return s+(d[1].d>0?d[1].net/d[1].d:0)},0) / fH.length;
        var sA = sH.reduce(function(s,d){return s+(d[1].d>0?d[1].net/d[1].d:0)},0) / sH.length;
        trendPct = fA > 0 ? ((sA - fA) / fA * 100) : 0;
      }

      var last2Data = last2ByBranch[e[0]];
      var last2Dbn = last2Data && last2Data.d > 0 ? last2Data.net / last2Data.d : null;

      var midDates = uniqueDates.slice(0, Math.min(8, uniqueDates.length));
      var midData = flowerRecent.filter(function(r){ return midDates.includes(r.t) && r.s === e[0] });
      var midDbn = midData.reduce(function(s,r){return s+r.d},0) > 0 ? midData.reduce(function(s,r){return s+r.net},0) / midData.reduce(function(s,r){return s+r.d},0) : null;

      var hist = branch2025[e[0]];
      var histDbn = hist && hist.d > 0 ? hist.net / hist.d : 0;

      var skorDbn = 0;
      var skorAgirliktoplam = 0;
      if (last2Dbn !== null && last2Dbn > 0) { skorDbn += last2Dbn * 0.45; skorAgirliktoplam += 0.45; }
      if (midDbn !== null && midDbn > 0) { skorDbn += midDbn * 0.25; skorAgirliktoplam += 0.25; }
      if (avgDbn > 0) { skorDbn += avgDbn * 0.20; skorAgirliktoplam += 0.20; }
      if (histDbn > 0) { skorDbn += histDbn * 0.10; skorAgirliktoplam += 0.10; }
      var filtreSkoru = skorAgirliktoplam > 0 ? skorDbn / skorAgirliktoplam : avgDbn;

      var komboData = ALL_DATA.filter(function(r){ return r.c === pf.name && r.s === e[0] });
      var komboGunluk = {};
      komboData.forEach(function(r){ if(!komboGunluk[r.t]) komboGunluk[r.t] = 0; komboGunluk[r.t] += r.d; });
      var komboVals = Object.values(komboGunluk).sort(function(a,b){return a-b});
      var absMedian = komboVals.length > 0 ? komboVals[Math.floor(komboVals.length/2)] : 0;
      var absP75 = komboVals.length >= 4 ? komboVals[Math.floor(komboVals.length * 0.75)] : absMedian;
      var absMax = komboVals.length > 0 ? komboVals[komboVals.length-1] : 0;
      var absSon60 = komboData.filter(function(r){ var d60=new Date(); d60.setDate(d60.getDate()-60); return r.t >= d60.toISOString().split("T")[0]; });
      var absAlimSayisi = new Set(absSon60.map(function(r){return r.t})).size;

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

      var azaltEsik, gondermeEsik;
      if (state.planStrategy === "safe") {
        azaltEsik = -15;
        gondermeEsik = -30;
      } else if (state.planStrategy === "balanced") {
        azaltEsik = -25;
        gondermeEsik = -40;
      } else {
        azaltEsik = -35;
        gondermeEsik = -50;
      }

      var status = "GÖNDER";
      var statusReason = "";

      if (filtreSkoru > 0 && genelOrtalama > 0) {
        var fark = ((filtreSkoru - genelOrtalama) / genelOrtalama * 100);
        if (fark < gondermeEsik) {
          status = "GÖNDERME";
          statusReason = "Filtre skoru ortalamanın %" + Math.abs(fark).toFixed(0) + " altında (eşik: %" + Math.abs(gondermeEsik) + ")";
        } else if (fark < azaltEsik) {
          status = "AZALT";
          statusReason = "Filtre skoru ortalamanın %" + Math.abs(fark).toFixed(0) + " altında (eşik: %" + Math.abs(azaltEsik) + "), demet yarıya düşür";
        }
      } else if (last2Dbn === null && midDbn === null) {
        if (avgDbn > 0 && genelOrtalama > 0) {
          var genelFark = ((avgDbn - genelOrtalama) / genelOrtalama * 100);
          if (genelFark < gondermeEsik) {
            status = "GÖNDERME";
            statusReason = "Genel ortalama çok düşük";
          } else if (genelFark < azaltEsik) {
            status = "AZALT";
            statusReason = "Genel ortalama düşük";
          }
        }
        statusReason += (statusReason ? " | " : "") + "Yakın dönem verisi yok, genel ortalamaya bakıldı";
      }

      return {name:e[0], dbn:avgDbn, d:e[1].d, trend:trendPct, histDbn:histDbn, last2Dbn:last2Dbn, midDbn:midDbn, filtreSkoru:filtreSkoru, status:status, statusReason:statusReason, absMedian:absMedian, absP75:absP75, absMax:absMax, absAlimSayisi:absAlimSayisi, guvenSkor:guvenSkor, guvenLabel:guvenLabel};
    }).sort(function(a,b){ return b.dbn - a.dbn });

    var totalPrice = branchRanked.filter(function(b){return b.status!=="GÖNDERME"}).reduce(function(s,b){return s+b.dbn},0);

    trendInfo += "\n\n" + pf.name + " (" + pf.demet + " demet) — Genel ort: " + fmt(genelOrtalama) + "/dm";
    if (last2Dates.length > 0) trendInfo += " | Son 2 mezat: " + last2Dates.map(function(d){return fD(d)}).join(", ");

    trendInfo += "\n  ŞUBE ANALİZİ (yüksekten düşüğe):";
    branchRanked.forEach(function(b, idx) {
      var trendDir = b.trend > 3 ? "↑" : b.trend < -3 ? "↓" : "→";
      var histNote = b.histDbn > 0 ? " | 2025:" + fmt(b.histDbn) : "";
      var last2Note = b.last2Dbn !== null ? " | Son2mezat:" + fmt(b.last2Dbn) : " | Son2mezat:YOK";

      var statusIcon = b.status === "GÖNDER" ? "✅" : b.status === "AZALT" ? "⚠️" : "❌";

      var sugPct = 0;
      if (b.status !== "GÖNDERME" && totalPrice > 0) {
        sugPct = Math.round((b.dbn / totalPrice) * 100);
        if (b.status === "AZALT") sugPct = Math.round(sugPct * 0.5);
      }

      trendInfo += "\n    " + statusIcon + " " + b.name + ": " + fmt(b.dbn) + "/dm (trend:" + trendDir + (b.trend>0?"+":"") + b.trend.toFixed(0) + "%" + last2Note + histNote + ") | Güven:" + b.guvenLabel + " | Absorpsiyon: median=" + b.absMedian + "dm, P75=" + b.absP75 + "dm, max=" + b.absMax + "dm, son60gün=" + b.absAlimSayisi + "alım";
      if (b.status === "GÖNDERME") trendInfo += " → ❌ GÖNDERME: " + b.statusReason;
      else if (b.status === "AZALT") trendInfo += " → ⚠️ AZALT (%" + sugPct + "): " + b.statusReason;
      else trendInfo += " → ÖNERİ: %" + sugPct;
    });

    if (state.planBranchMode === "explore") {
      var currentBranches = branchRanked.map(function(b){return b.name});
      var potentialBranches = Object.entries(branch2025).filter(function(e){
        return !currentBranches.includes(e[0]) && e[1].d > 0;
      }).map(function(e){
        return {name:e[0], dbn:e[1].d > 0 ? e[1].net / e[1].d : 0, d:e[1].d};
      }).sort(function(a,b){return b.dbn - a.dbn});

      if (potentialBranches.length > 0) {
        trendInfo += "\n  🔍 DENEME POTANSİYELİ (2025'te var, 2026'da yok):";
        potentialBranches.slice(0,5).forEach(function(b){
          trendInfo += "\n    ⭐ " + b.name + ": 2025'te " + fmt(b.dbn) + "/dm (" + b.d + "dm)";
        });
      }

      var lowVolume = branchRanked.filter(function(b){ return b.d <= 5 && b.dbn > 0 && b.status !== "GÖNDERME" });
      if (lowVolume.length > 0) {
        trendInfo += "\n  🔍 AZ DENENMİŞ AMA İYİ FİYAT:";
        lowVolume.forEach(function(b){
          trendInfo += "\n    ⭐ " + b.name + ": " + fmt(b.dbn) + "/dm (sadece " + b.d + "dm)";
        });
      }
    }
  });

  var branchModeText = "";
  if (state.planBranchMode === "auto") {
    branchModeText = "\n\nŞUBE SEÇİM MODU: OTOMATİK\n" +
      "Tüm şubelere kutu yapmak ZORUNDA DEĞİLSİN. Sadece kârlı olan şubeleri seç.\n" +
      "Kural: En fazla 5-7 şubeye gönder. Fiyatı çok düşük olan şubeleri ATLA.\n" +
      "Bir şubeye kutu yapmak için o şubenin dm başı net fiyatının, ortalama fiyatın en az %60'ı kadar olması gerekir.";
  } else if (state.planBranchMode === "manual") {
    branchModeText = "\n\nŞUBE SEÇİM MODU: MANUEL\n" +
      "SADECE şu şubelere kutu yap, başka şubeye YAPMA: " + state.planManualBranches.join(", ") + "\n" +
      "Bu şubeler arasında fiyat sıralamasına göre dağıt. En pahalıya en çok.";
  } else if (state.planBranchMode === "explore") {
    branchModeText = "\n\nŞUBE SEÇİM MODU: DENEME\n" +
      "Ana dağılımı kârlı şubelere yap (toplam demetin %85-90'ı).\n" +
      "Kalan %10-15'i DENEME şubelerine ayır (2025'te iyi fiyat vermiş ama 2026'da az/hiç gönderilmemiş şubeler).\n" +
      "Deneme şubelerine MAX 1-2 kutu. 2025 verilerinde iyi fiyat veren şubeleri tercih et.\n" +
      "Deneme kutularını açıkça '🔍 DENEME' olarak işaretle ve nedenini 2025 verisiyle açıkla.";
  }

  var hist2025Text = "";
  if (data2025.length > 0) {
    var hist25ByF = {};
    data2025.forEach(function(r){
      if(!hist25ByF[r.c]) hist25ByF[r.c]={net:0,d:0};
      hist25ByF[r.c].net+=r.net; hist25ByF[r.c].d+=r.d;
    });
    hist2025Text = "\n\n2025 GEÇMİŞ VERİ (referans — %20 ağırlık ver, %80 güncel veriye bak):\n";
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
        if (ortYuzde > 110) mevsimselText += " → 🔥 Bu hafta tarihsel olarak YÜKSEK fiyat dönemi. Agresif olabilirsin.";
        else if (ortYuzde > 100) mevsimselText += " → ✅ Bu hafta ortalamanın üstünde. Normal/dengeli strateji uygun.";
        else if (ortYuzde > 90) mevsimselText += " → ⚡ Bu hafta ortalamaya yakın. Dikkatli ol.";
        else mevsimselText += " → ⚠️ Bu hafta tarihsel olarak DÜŞÜK fiyat dönemi. Güvenli strateji önerilir, fazla risk alma.";
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

  var strategyDesc = {
    safe: "GÜVENLİ STRATEJİ:\n" +
      "• Filtre: Son 2 mezat ortalamanın %15+ altı → AZALT, %30+ altı → GÖNDERME\n" +
      "• Şube sayısı: MAX 4-5 şube. Az ama emin olduğun yerlere.\n" +
      "• Dağılım: 1.şube %40-45, 2.şube %25-30, 3.şube %15-20, geri kalan %5-10\n" +
      "• Karar mantığı: MUTLAK FİYAT ağırlıklı. Trend'e çok bakma. Geçmişte kanıtlanmış, yeterli veri olan şubelere gönder.\n" +
      "• Felsefe: Az kazanayım ama kayıp riskim düşük olsun.",
    balanced: "DENGELİ STRATEJİ:\n" +
      "• Filtre: Son 2 mezat ortalamanın %25+ altı → AZALT, %40+ altı → GÖNDERME\n" +
      "• Şube sayısı: 5-8 şube. Daha geniş yay ama hâlâ kontrollü.\n" +
      "• Dağılım: 1.şube %30-35, 2.şube %20-25, 3.şube %15-20, 4-5.şube %10-15, kalan %5-10\n" +
      "• Karar mantığı: Fiyat %60 ağırlık + Trend %40 ağırlık. İkisini dengele.\n" +
      "• Felsefe: Makul risk, makul kazanç. Normal dağılım.",
    aggressive: "AGRESİF STRATEJİ:\n" +
      "• Filtre: Son 2 mezat ortalamanın %35+ altı → AZALT, %50+ altı → GÖNDERME\n" +
      "• Şube sayısı: 6-10 şube. Geniş dağılım.\n" +
      "• Dağılım: 1.şube %25-30, 2.şube %20-25, 3.şube %15-20, kalan şubeler %5-15 paylaşır (daha eşit dağılım)\n" +
      "• Karar mantığı: Trend %60 ağırlık + Fiyat %40 ağırlık. Trendi YÜKSELEN şubelere ekstra şans ver. Fiyatı düşük ama hızla yükselen bir şube varsa güvenli modda görmezden gelinecek o şubeye de kutu yap.\n" +
      "• Felsefe: Maksimum kazanç hedefle. Momentum yakala. Kayıp olabilir ama yukarı potansiyel büyük."
  };

  var totalDemet = state.planFlowers.reduce(function(s,f){return s+f.demet},0);
  var totalKutu = Math.ceil(totalDemet / state.planBoxSize);

  var planPrompt = "GÖREV: Çiçek gönderim planı oluştur.\n\n" +
    "KESİLEN ÇİÇEKLER:\n" + state.planFlowers.map(function(f){ return "- " + f.name + ": " + f.demet + " demet" }).join("\n") +
    "\nTOPLAM: " + totalDemet + " demet, " + totalKutu + " kutu (" + state.planBoxSize + " dm/kutu)" +
    "\n\nSTRATEJİ: " + strategyDesc[state.planStrategy] +
    branchModeText +
    "\n\nGÜNCEL VERİLER:" + trendInfo +
    "\n\nKombo sıralaması: " + hd.slice(0,25).map(function(h){return h.cicek+"→"+h.sube+":"+fmt(h.dbn)+"/dm"}).join("; ") +
    hist2025Text +
    mevsimselText +
    "\n\n🚨 ZORUNLU KURALLAR:\n" +
    "1. ❌ GÖNDERME etiketli çiçek-şube kombinasyonlarına KESİNLİKLE kutu yapma!\n" +
    "2. ⚠️ AZALT etiketli kombinasyonlara önerilen yüzdenin YARISINI ver.\n" +
    "3. ✅ GÖNDER etiketli kombinasyonlara önerilen yüzdeye göre dağıt.\n" +
    "4. EN PAHALI şubeye EN ÇOK kutu!\n" +
    "5. 🚨🚨🚨 HER ÇİÇEĞİN TOPLAM DEMETİ GİRİLEN MİKTARA BİREBİR EŞİT OLMALI! KALAN DEMET BIRAKMAK YASAK! Eğer kutulara tam sığmıyorsa son kutuyu eksik doldur veya en iyi şubeye ekstra kutu yap. Hiçbir demet boşta kalamaz!\n" +
    "6. Kutu başına " + state.planBoxSize + " demet. Karışık çiçek konulabilir. Son kutu tam dolmak zorunda DEĞİL.\n" +
    "7. UCUZ şubeye PAHALI şubeden fazla kutu YASAK!\n" +
    "8. Geçmiş yıl verisi referans (%15 ağırlık), mevsimsel endeks bilgilendirme, güncel veri ana karar (%85). Mevsimsel uyarı varsa risk notunda belirt.\n" +
    "9. Tüm şubelere kutu yapmak ZORUNLU DEĞİL.\n" +
    "10. DAĞILIM DETAYI bölümünde her çiçeğin şubelere dağılımını yaz ve TOPLAMI KONTROL ET. Toplam girilen demete eşit değilse DÜZELT!\n" +
    "\nÇIKTI FORMATI:\n" +
    "📦 [ŞUBE] - [KUTU] kutu\n" +
    "  Kutu X: [DM] dm [ÇİÇEK] (fiyat: X₺/dm, son2mezat: X₺, trend: +Y%)\n" +
    (state.planBranchMode==="explore" ? "  🔍 DENEME kutularını ayrı belirt\n" : "") +
    "\n📊 ÖZET (ZORUNLU — bu bölümü MUTLAKA yaz):\n" +
    "- Toplam: X kutu (Y demet)\n" +
    "- Dağılım: şube1 %X, şube2 %Y...\n" +
    "- TAHMİNİ NET GELİR: XXXXX ₺\n" +
    "  (Hesaplama: Her şubeye giden demet × o çiçeğin o şubedeki dm başı net fiyat, toplamı al)\n" +
    "- Risk notu\n" +
    "- Elenen şubeler ve nedenleri";

  try {
    var resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: "Sen çiçek mezat lojistik uzmanısın. Yalova'da üretici, Flora mezatına gönderiyor. Gider %20. Türkçe.\n\n" +
          "EN ÖNEMLİ KURAL: ❌ GÖNDERME etiketli kombinasyonlara KESİNLİKLE kutu yapma!\n" +
          "⚠️ AZALT etiketlilere yarı pay ver. ✅ GÖNDER etiketlilere normal dağıt.\n" +
          "Tüm şubelere kutu yapmak ZORUNLU DEĞİL. Geçmiş yıl verisi %15 ağırlık.\n" +
          "Her kutuya " + state.planBoxSize + " demet, karışık çiçek olabilir. Kesin sayılar ver.\n" +
          "MEVSİMSEL ZEKA: Verilen mevsimsel endeks ve fiyat tahmini bilgilerini dikkate al. Eğer mevsimsel olarak düşük dönemdeysen risk notunda belirt. Özel gün yaklaşıyorsa fiyat artışı beklentisini plana yansıt.\n" +
          "KESme çiçek üreticisi üretimi anlık artıramaz — sadece gönderim stratejisini optimize et.\n\n" +
          (state.planStrategy === "safe" ?
            "STRATEJİ DAVRANIŞI — GÜVENLİ:\n" +
            "• Max 4-5 şubeye gönder. Sadece kanıtlanmış yerlere.\n" +
            "• MUTLAK FİYAT ağırlıklı karar ver. Trend'e fazla bakma.\n" +
            "• 1.şubeye %40-45, 2.şubeye %25-30, geri kalana az.\n" +
            "• Az kazanayım ama kayıp olmasın mantığı.\n" +
            "• Ucuz şubeye pahalıdan fazla kutu YASAK." :
          state.planStrategy === "balanced" ?
            "STRATEJİ DAVRANIŞI — DENGELİ:\n" +
            "• 5-8 şubeye gönder. Geniş ama kontrollü.\n" +
            "• Fiyat %60 + Trend %40 ağırlıkla karar ver.\n" +
            "• 1.şubeye %30-35, 2.şubeye %20-25, daha eşit yay.\n" +
            "• Makul risk, makul kazanç.\n" +
            "• Ucuz şubeye pahalıdan fazla kutu YASAK." :
            "STRATEJİ DAVRANIŞI — AGRESİF:\n" +
            "• 6-10 şubeye gönder. Geniş dağılım.\n" +
            "• Trend %60 + Fiyat %40 ağırlıkla karar ver.\n" +
            "• Daha eşit dağılım: 1.şubeye %25-30, diğerleri %10-20.\n" +
            "• Trendi YÜKSELEN şubelere ekstra şans ver — fiyatı düşük ama hızla yükselen şubeye de kutu yap.\n" +
            "• Maksimum kazanç hedefle, risk tolere et."),
        messages: [{ role: "user", content: planPrompt }]
      })
    });
    var data = await resp.json();
    if (data.content && data.content.length > 0) {
      state.planResult = data.content.map(function(b){ return b.text || "" }).join("\n");
    } else if (data.error) {
      state.planResult = "⚠ Hata: " + (data.error.message || JSON.stringify(data.error));
    } else {
      state.planResult = generateLocalPlan();
    }
  } catch(e) {
    state.planResult = generateLocalPlan();
  }

  if (state.planResult && !state.planResult.startsWith("⚠")) {
    var codeEstimate = 0;
    var last14 = new Date(); last14.setDate(last14.getDate() - 14);
    var last14str = last14.toISOString().split("T")[0];

    state.planFlowers.forEach(function(pf){
      var flowerData = filtered.filter(function(r){ return r.c === pf.name });
      var flowerRecent = ALL_DATA.filter(function(r){ return r.c === pf.name && r.t >= last14str });

      var byBr = {};
      flowerData.forEach(function(r){
        if(!byBr[r.s]) byBr[r.s] = {net:0,d:0};
        byBr[r.s].net += r.net; byBr[r.s].d += r.d;
      });

      var brList = Object.entries(byBr).map(function(e){
        var avgDbn = e[1].d > 0 ? e[1].net / e[1].d : 0;

        var brRecent = flowerRecent.filter(function(r){ return r.s === e[0] });
        var uniqueDays = [...new Set(brRecent.map(function(r){return r.t}))].sort().reverse();
        var last2Days = uniqueDays.slice(0, 2);
        var last2Records = brRecent.filter(function(r){ return last2Days.includes(r.t) });
        var last2Net = last2Records.reduce(function(s,r){return s+r.net},0);
        var last2D = last2Records.reduce(function(s,r){return s+r.d},0);
        var last2Dbn = last2D > 0 ? last2Net / last2D : null;

        var midBrData = flowerRecent.filter(function(r){ return r.s === e[0] });
        var midBrDbn = midBrData.reduce(function(s,r){return s+r.d},0) > 0 ? midBrData.reduce(function(s,r){return s+r.net},0) / midBrData.reduce(function(s,r){return s+r.d},0) : null;
        var histBrData = ALL_DATA.filter(function(r){ return r.c === pf.name && r.s === e[0] && r.t.startsWith("2025") });
        var histBrDbn = histBrData.reduce(function(s,r){return s+r.d},0) > 0 ? histBrData.reduce(function(s,r){return s+r.net},0) / histBrData.reduce(function(s,r){return s+r.d},0) : 0;

        var trendAdjustedPrice;
        var tAg = 0, tTop = 0;
        if (last2Dbn !== null && last2Dbn > 0) { tTop += last2Dbn * 0.45; tAg += 0.45; }
        if (midBrDbn !== null && midBrDbn > 0) { tTop += midBrDbn * 0.25; tAg += 0.25; }
        if (avgDbn > 0) { tTop += avgDbn * 0.20; tAg += 0.20; }
        if (histBrDbn > 0) { tTop += histBrDbn * 0.10; tAg += 0.10; }
        trendAdjustedPrice = tAg > 0 ? tTop / tAg : avgDbn;

        return {name:e[0], dbn:avgDbn, adjustedDbn:trendAdjustedPrice, last2Dbn:last2Dbn};
      }).sort(function(a,b){return b.adjustedDbn - a.adjustedDbn});

      if (brList.length > 0) {
        var totalAdj = brList.reduce(function(s,b){return s+b.adjustedDbn},0);
        var remaining = pf.demet;
        brList.forEach(function(b, idx){
          var share = totalAdj > 0 ? (b.adjustedDbn / totalAdj) : (1 / brList.length);
          var demetForBranch = idx < brList.length - 1 ? Math.round(pf.demet * share) : remaining;
          demetForBranch = Math.min(demetForBranch, remaining);
          codeEstimate += b.adjustedDbn * demetForBranch;
          remaining -= demetForBranch;
        });
      }
    });
    if (codeEstimate > 0) {
      state.planCodeEstimate = codeEstimate;
    }
  }

  state.planLoading = false;
  render();
}

function generateLocalPlan() {
  var plan = "📦 GÖNDERİM PLANI (Yerel Analiz)\n\n";
  var hd = getHeatData(getFiltered());

  state.planFlowers.forEach(function(pf) {
    var combos = hd.filter(function(h){ return h.cicek === pf.name }).slice(0, 5);
    var remaining = pf.demet;
    plan += "**" + pf.name + "** (" + pf.demet + " demet):\n";
    combos.forEach(function(c) {
      if (remaining <= 0) return;
      var boxes = Math.min(Math.ceil(remaining / state.planBoxSize), 2);
      var dm = Math.min(boxes * state.planBoxSize, remaining);
      plan += "  📦 " + c.sube + ": " + boxes + " kutu (" + dm + " dm) — " + fmt(c.dbn) + "/dm\n";
      remaining -= dm;
    });
    if (remaining > 0) plan += "  📦 Diğer: " + Math.ceil(remaining / state.planBoxSize) + " kutu (" + remaining + " dm)\n";
    plan += "\n";
  });

  plan += "Not: Bu yerel analiz. API bağlantısı olduğunda daha detaylı plan alabilirsin.";
  return plan;
}
