// ═══════════════ KAPALI EVREN TAHSİS BACKTESTİ (Paket 2 — Faz A) ═══════════════
// Walk-forward artımlı motor. planner.js fonksiyonları ÇAĞRILMAZ — onlar "bugüne kadar
// tüm veri" varsayımıyla yazılmıştır; burada her t günü t-öncesi kesitle değerlendirilir.
// Sabitler config'ten (BT_SABITLER + PLANNER_SATURATION) — iki motor aynı değerleri kullanır.
// Kapalı evren: adaylar = o gün o çiçekte GERÇEKTEN satış olan şubeler; keşif tüm modellerde kapalı.

// Doygunluk çarpanı — planner.js'teki saturationCarpan ile aynı mantık (bağımsız kopya, config sabitli)
function btSaturation(atanan, median, p75, mx) {
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
  return null; // kapandı
}

function btMedian(sortedArr) {
  var n = sortedArr.length;
  if (n === 0) return 0;
  return n % 2 ? sortedArr[(n - 1) / 2] : (sortedArr[n / 2 - 1] + sortedArr[n / 2]) / 2;
}

// ISO tarih kaydırma (gün)
function btIsoShift(iso, gun) {
  var d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + gun);
  return d.toISOString().split("T")[0];
}

// ── Artımlı kombo durumu ──
function btYeniKombo() {
  return {
    kumNet: 0, kumD: 0,
    gunler: [],          // [{t, dbn, d}] — mezat günü bazlı (kronolojik)
    sonTarih: ""         // T1 leakage damgası
  };
}

// t-öncesi kombo özellikleri (yalnız state'ten okur — t'nin verisi state'e henüz girmemiştir)
function btKomboFeature(st, t, gecenYilRows) {
  var g = st.gunler, n = g.length;
  var genel = st.kumD > 0 ? st.kumNet / st.kumD : null;

  var son2 = null;
  if (n >= 1) {
    var s2 = g.slice(-2);
    var s2d = s2.reduce(function(s, x) { return s + x.d }, 0);
    son2 = s2d > 0 ? s2.reduce(function(s, x) { return s + x.dbn * x.d }, 0) / s2d : null;
  }
  var son68 = null;
  if (n >= 1) {
    var s8 = g.slice(-8);
    var s8d = s8.reduce(function(s, x) { return s + x.d }, 0);
    son68 = s8d > 0 ? s8.reduce(function(s, x) { return s + x.dbn * x.d }, 0) / s8d : null;
  }

  // Geçen yıl: t−1yıl ±14 gün penceresi (her zaman t'den eski — leakage yok)
  var gy = null;
  if (gecenYilRows && gecenYilRows.length) {
    var lo = btIsoShift(t, -365 - 14), hi = btIsoShift(t, -365 + 14);
    var gn = 0, gd = 0;
    gecenYilRows.forEach(function(r) { if (r.t >= lo && r.t <= hi) { gn += r.net; gd += r.d; } });
    gy = gd > 0 ? gn / gd : null;
  }

  // Katmanlı skor — planner ile aynı ağırlık/normalizasyon
  var W = window.BT_SABITLER.katmanAgirlik;
  var top = 0, ag = 0;
  if (son2 !== null && son2 > 0) { top += son2 * W.son2; ag += W.son2; }
  if (son68 !== null && son68 > 0) { top += son68 * W.son68; ag += W.son68; }
  if (genel !== null && genel > 0) { top += genel * W.genel; ag += W.genel; }
  if (gy !== null && gy > 0) { top += gy * W.gecenYil; ag += W.gecenYil; }
  var katmanli = ag > 0 ? top / ag : (genel || 0);

  // CV — son 10 mezat günü dbn'leri
  var cv = 1;
  var cvW = g.slice(-10).map(function(x) { return x.dbn });
  if (cvW.length >= 3) {
    var mu = cvW.reduce(function(s, x) { return s + x }, 0) / cvW.length;
    var sd = Math.sqrt(cvW.reduce(function(s, x) { return s + Math.pow(x - mu, 2) }, 0) / cvW.length);
    cv = mu > 0 ? sd / mu : 1;
  }

  // Doygunluk istatistikleri — günlük demet listesi
  var dArr = g.map(function(x) { return x.d }).sort(function(a, b) { return a - b });
  var median = btMedian(dArr);
  var p75 = dArr.length >= 4 ? dArr[Math.floor(dArr.length * 0.75)] : median;
  var mx = dArr.length ? dArr[dArr.length - 1] : 0;

  // Güven — planner formülünün artımlı karşılığı (örnek=mezat gün sayısı; oynaklık dbn CV'sinden)
  var ornek = Math.min(100, n * 3);
  var guncellik = 0;
  if (st.sonTarih) {
    var fark = Math.round((new Date(t + "T00:00:00") - new Date(st.sonTarih + "T00:00:00")) / 864e5);
    guncellik = Math.max(0, 100 - fark * 2);
  }
  var oynaklik = n >= 3 ? Math.max(0, 100 - cv * 100 * 2) : 0;
  var guvenSkor = Math.round(ornek * 0.30 + guncellik * 0.35 + oynaklik * 0.35);

  return { genel: genel, katmanli: katmanli, cv: cv, median: median, p75: p75, max: mx, guvenSkor: guvenSkor, nGun: n, sonTarih: st.sonTarih };
}

// ── Tek model dağıtımı: kutu-kutu greedy ──
// modelTip: "A1" (skor=genel, kapasitesiz) | "A0" (genel + tarihsel max sınır, çarpansız)
//           "B" (katmanlı, kapasitesiz) | "C" (katmanlı × doygunluk) | "D" (C + ceza + güven filtresi)
// KAPALI EVREN T4 kuralı: mal kaybolmaz — kapasiteli modellerde tüm kombolar kapanırsa
// kalan kutular en yüksek skorlu komboya taşar (overflow), güven filtresi yok sayılır.
function btDagit(modelTip, adaylar, kutular) {
  var K = window.BT_SABITLER;
  var atanan = {};
  adaylar.forEach(function(a) { atanan[a.sube] = 0 });

  for (var bi = 0; bi < kutular.length; bi++) {
    var kutuD = kutular[bi];
    var enIyi = null, enIyiFallback = null;

    adaylar.forEach(function(a) {
      var f = a.f;
      var skor, uygun = true;
      if (modelTip === "A1") {
        skor = f.genel || 0;
      } else if (modelTip === "A0") {
        skor = f.genel || 0;
        if (atanan[a.sube] + kutuD > f.max) uygun = false;   // tarihsel max — çarpan yok
      } else if (modelTip === "B") {
        skor = f.katmanli || 0;
      } else if (modelTip === "C") {
        var c1 = btSaturation(atanan[a.sube], f.median, f.p75, f.max);
        if (c1 === null) { uygun = false; skor = 0; }
        else skor = (f.katmanli || 0) * c1;
      } else { // D
        var c2 = btSaturation(atanan[a.sube], f.median, f.p75, f.max);
        if (c2 === null) { uygun = false; skor = 0; }
        else {
          skor = (f.katmanli || 0) * c2 * (1 - K.kCeza * Math.min(1, f.cv));
          if (f.guvenSkor < K.guvenEsik) uygun = false;      // düşük güven atama almaz
        }
      }
      // Fallback skoru (overflow): kapasite/güven kısıtı yok sayılır
      var fbSkor = modelTip === "A1" || modelTip === "A0" ? (f.genel || 0) : (f.katmanli || 0);
      if (!enIyiFallback || fbSkor > enIyiFallback.skor) enIyiFallback = { sube: a.sube, skor: fbSkor };
      if (uygun && (!enIyi || skor > enIyi.skor)) enIyi = { sube: a.sube, skor: skor };
    });

    var hedef = enIyi || enIyiFallback;   // T4: mal kaybolmaz
    atanan[hedef.sube] += kutuD;
  }
  return atanan;
}

// ── Ana koşum ──
// pencere: "v2" | "60" · opts.rows: test için veri override (üretimde ALL_DATA)
function runBacktest(pencere, opts) {
  opts = opts || {};
  var t0 = Date.now();
  var K = window.BT_SABITLER;
  var veriKaynak = opts.rows || ALL_DATA;

  // Gün → çiçek → şube gruplama (tek geçiş hazırlığı)
  var gunSet = {};
  veriKaynak.forEach(function(r) { gunSet[r.t] = true });
  var tumGunler = Object.keys(gunSet).sort();

  // Pencere günleri
  var pencereGunler;
  if (pencere === "v2") pencereGunler = tumGunler.filter(function(t) { return t >= window.V2_CUTOFF });
  else pencereGunler = tumGunler.slice(-60);
  var pencereSet = {};
  pencereGunler.forEach(function(t) { pencereSet[t] = true });
  var pencereBas = pencereGunler.length ? pencereGunler[0] : null;

  // Çiçek evreni: pencere içinde ≥ minMezatGun mezat günü
  var cicekGunSayisi = {};
  veriKaynak.forEach(function(r) {
    if (!pencereSet[r.t]) return;
    if (!cicekGunSayisi[r.c]) cicekGunSayisi[r.c] = {};
    cicekGunSayisi[r.c][r.t] = true;
  });
  var evren = Object.keys(cicekGunSayisi).filter(function(c) { return Object.keys(cicekGunSayisi[c]).length >= K.minMezatGun }).sort();
  var evrenSet = {};
  evren.forEach(function(c) { evrenSet[c] = true });

  // Evren çiçeklerinin satırlarını gün bazında grupla + geçen yıl satırları (kombo bazlı, ham)
  var gunCicekSube = {};   // t → c → s → {net, d}
  var komboGecmisYil = {}; // "c|s" → [{t, net, d}] (tüm yıllar — feature içinde tarih penceresiyle süzülür)
  veriKaynak.forEach(function(r) {
    if (!evrenSet[r.c]) return;
    if (!gunCicekSube[r.t]) gunCicekSube[r.t] = {};
    if (!gunCicekSube[r.t][r.c]) gunCicekSube[r.t][r.c] = {};
    if (!gunCicekSube[r.t][r.c][r.s]) gunCicekSube[r.t][r.c][r.s] = { net: 0, d: 0 };
    gunCicekSube[r.t][r.c][r.s].net += r.net;
    gunCicekSube[r.t][r.c][r.s].d += r.d;
    var kk = r.c + "|" + r.s;
    if (!komboGecmisYil[kk]) komboGecmisYil[kk] = [];
    komboGecmisYil[kk].push({ t: r.t, net: r.net, d: r.d });
  });

  // Artımlı durumlar
  var kombolar = {};        // "c|s" → btYeniKombo()
  var cicekSatirDemet = {}; // c → [satır demetleri] (kutu medyanı için, t-öncesi)

  // Test sayaçları
  var t1AssertSayisi = 0, t1Ihlal = 0;
  var t2AssertSayisi = 0, t2Ihlal = 0;
  var t4AssertSayisi = 0, t4Ihlal = 0;

  var modelAdlari = ["A1", "A0", "B", "C", "D"];
  var toplamSim = { A1: 0, A0: 0, B: 0, C: 0, D: 0 };
  var gercekNet = 0, toplamD = 0;
  var gunluk = [];          // [{t, gercek, sim:{...}, upliftD, detay:[...]}]
  var cicekAgg = {};        // c → {n, gercekNet, gercekD, simDNet}

  tumGunler.forEach(function(t) {
    var gunCicekler = gunCicekSube[t] || {};

    // ── 1) DEĞERLENDİRME (t-öncesi state ile) ──
    if (pencereSet[t]) {
      var gunGercek = 0, gunSim = { A1: 0, A0: 0, B: 0, C: 0, D: 0 };
      var gunDetay = [];
      var gunVar = false;

      Object.keys(gunCicekler).forEach(function(c) {
        var subeler = gunCicekler[c];
        var subeAdlari = Object.keys(subeler);
        var D_tc = 0, cicekGercekNet = 0;
        subeAdlari.forEach(function(s) { D_tc += subeler[s].d; cicekGercekNet += subeler[s].net; });
        if (D_tc <= 0) return;
        gunVar = true;

        // Adaylar + t-öncesi feature'lar (5 modele AYNI nesne — fairness)
        var adaylar = subeAdlari.map(function(s) {
          var kk = c + "|" + s;
          if (!kombolar[kk]) kombolar[kk] = btYeniKombo();
          var st = kombolar[kk];
          // T1: state'e t veya sonrası tarihli kayıt girmemiş olmalı
          t1AssertSayisi++;
          if (st.sonTarih >= t && st.sonTarih !== "") t1Ihlal++;
          return { sube: s, gercekDbn: subeler[s].d > 0 ? subeler[s].net / subeler[s].d : 0, f: btKomboFeature(st, t, komboGecmisYil[kk]) };
        });

        // Kutu: t-öncesi medyan satır demeti, clamp [8,40] (override: BT_KUTU_SABIT)
        var kutu;
        if (window.BT_KUTU_SABIT) kutu = window.BT_KUTU_SABIT;
        else {
          var sd = (cicekSatirDemet[c] || []).slice().sort(function(a, b) { return a - b });
          kutu = Math.max(K.kutuMin, Math.min(K.kutuMax, Math.round(btMedian(sd)) || K.kutuMin));
        }
        var kutular = [];
        var kutuSayisi = Math.ceil(D_tc / kutu);
        for (var ki = 0; ki < kutuSayisi; ki++) kutular.push(ki === kutuSayisi - 1 ? D_tc - kutu * (kutuSayisi - 1) : kutu);

        // T2 fairness: kesit imzası (aday+kutu+feature sayaçları) model koşumları öncesi/sonrası aynı
        var imza = JSON.stringify(adaylar.map(function(a) { return [a.sube, a.f.nGun, a.f.sonTarih, +(a.f.katmanli || 0).toFixed(6)] })) + "|" + JSON.stringify(kutular);

        var modelSonuc = {};
        modelAdlari.forEach(function(m) {
          var atama = btDagit(m, adaylar, kutular);
          var sim = 0, atananToplam = 0;
          adaylar.forEach(function(a) { sim += (atama[a.sube] || 0) * a.gercekDbn; atananToplam += atama[a.sube] || 0; });
          // T4: mal kaybolmaz/çoğalmaz
          t4AssertSayisi++;
          if (atananToplam !== D_tc) t4Ihlal++;
          modelSonuc[m] = { sim: sim, atama: atama };
        });

        var imza2 = JSON.stringify(adaylar.map(function(a) { return [a.sube, a.f.nGun, a.f.sonTarih, +(a.f.katmanli || 0).toFixed(6)] })) + "|" + JSON.stringify(kutular);
        t2AssertSayisi++;
        if (imza !== imza2) t2Ihlal++;

        gunGercek += cicekGercekNet;
        modelAdlari.forEach(function(m) { gunSim[m] += modelSonuc[m].sim });
        toplamD += D_tc;

        if (!cicekAgg[c]) cicekAgg[c] = { n: 0, gercekNet: 0, gercekD: 0, simDNet: 0 };
        cicekAgg[c].n++;
        cicekAgg[c].gercekNet += cicekGercekNet;
        cicekAgg[c].gercekD += D_tc;
        cicekAgg[c].simDNet += modelSonuc.D.sim;

        subeAdlari.forEach(function(s) {
          gunDetay.push({ c: c, sube: s, gercekD: subeler[s].d, simD: modelSonuc.D.atama[s] || 0, dbn: subeler[s].d > 0 ? subeler[s].net / subeler[s].d : 0 });
        });
      });

      if (gunVar) {
        gercekNet += gunGercek;
        modelAdlari.forEach(function(m) { toplamSim[m] += gunSim[m] });
        gunluk.push({ t: t, gercek: gunGercek, sim: gunSim, upliftD: gunSim.D - gunGercek, detay: gunDetay });
      }
    }

    // ── 2) STATE GÜNCELLE (değerlendirme bittikten SONRA) ──
    Object.keys(gunCicekler).forEach(function(c) {
      var subeler = gunCicekler[c];
      Object.keys(subeler).forEach(function(s) {
        var kk = c + "|" + s;
        if (!kombolar[kk]) kombolar[kk] = btYeniKombo();
        var st = kombolar[kk];
        var v = subeler[s];
        st.kumNet += v.net; st.kumD += v.d;
        st.gunler.push({ t: t, dbn: v.d > 0 ? v.net / v.d : 0, d: v.d });
        st.sonTarih = t;
      });
    });
    // Satır demetleri (kutu medyanı) — ham satır bazlı
    veriKaynak.forEach(function(r) {
      if (r.t !== t || !evrenSet[r.c]) return;
      if (!cicekSatirDemet[r.c]) cicekSatirDemet[r.c] = [];
      cicekSatirDemet[r.c].push(r.d);
    });
  });

  // ── Metrikler ──
  var mo = {};
  modelAdlari.forEach(function(m) {
    mo[m] = {
      simNet: toplamSim[m],
      dbn: toplamD > 0 ? toplamSim[m] / toplamD : 0,
      upliftTL: toplamSim[m] - gercekNet,
      upliftPct: gercekNet > 0 ? (toplamSim[m] - gercekNet) / gercekNet * 100 : 0
    };
  });
  var fark = function(m1, m2) {
    return { tl: mo[m1].simNet - mo[m2].simNet, pct: mo[m2].simNet > 0 ? (mo[m1].simNet - mo[m2].simNet) / mo[m2].simNet * 100 : 0 };
  };

  var upliftler = gunluk.map(function(g) { return g.upliftD }).slice().sort(function(a, b) { return a - b });
  var winRate = gunluk.length ? gunluk.filter(function(g) { return g.upliftD > 0 }).length / gunluk.length * 100 : 0;
  var ortU = gunluk.length ? gunluk.reduce(function(s, g) { return s + g.upliftD }, 0) / gunluk.length : 0;
  var medU = btMedian(upliftler);
  var enKotuGun = gunluk.length ? gunluk.reduce(function(mn, g) { return g.upliftD < mn.upliftD ? g : mn }, gunluk[0]) : null;

  var rolling10 = [];
  gunluk.forEach(function(g, i) {
    if (i < 9) return;
    var w = gunluk.slice(i - 9, i + 1);
    rolling10.push({ t: g.t, deger: w.reduce(function(s, x) { return s + x.upliftD }, 0) / 10 });
  });

  var kirilim = Object.keys(cicekAgg).map(function(c) {
    var v = cicekAgg[c];
    var gDbn = v.gercekD > 0 ? v.gercekNet / v.gercekD : 0;
    var sDbn = v.gercekD > 0 ? v.simDNet / v.gercekD : 0;
    return { cicek: c, n: v.n, gercekDbn: gDbn, simDbn: sDbn, upliftPct: v.gercekNet > 0 ? (v.simDNet - v.gercekNet) / v.gercekNet * 100 : 0 };
  }).sort(function(a, b) { return b.upliftPct - a.upliftPct });

  var sirali = gunluk.slice().sort(function(a, b) { return b.upliftD - a.upliftD });
  var drill = {
    enIyi: sirali.slice(0, 3).map(function(g) { return { t: g.t, uplift: g.upliftD, detay: g.detay } }),
    enKotu: sirali.slice(-3).reverse().map(function(g) { return { t: g.t, uplift: g.upliftD, detay: g.detay } })
  };

  return {
    pencere: pencere, gunSayisi: gunluk.length, cicekSayisi: evren.length, evren: evren,
    sure_ms: Date.now() - t0,
    gercekNet: gercekNet, gercekDbn: toplamD > 0 ? gercekNet / toplamD : 0, toplamD: toplamD,
    modeller: mo,
    ablation: { BvsA1: fark("B", "A1"), CvsB: fark("C", "B"), DvsC: fark("D", "C") },
    pratik: { DvsA0: fark("D", "A0"), CvsA0: fark("C", "A0") },
    gunluk: gunluk.map(function(g) { return { t: g.t, gercek: g.gercek, sim: g.sim, upliftD: g.upliftD } }),
    winRate: winRate, ortUplift: ortU, medyanUplift: medU,
    enKotu: enKotuGun ? { t: enKotuGun.t, uplift: enKotuGun.upliftD } : null,
    rolling10: rolling10, rolling10Guncel: rolling10.length ? rolling10[rolling10.length - 1].deger : null,
    cicekKirilim: kirilim,
    drill: drill,
    testler: {
      t1: { assert: t1AssertSayisi, ihlal: t1Ihlal },
      t2: { assert: t2AssertSayisi, ihlal: t2Ihlal },
      t4: { assert: t4AssertSayisi, ihlal: t4Ihlal }
    }
  };
}

// ── Cache (Faz B ekranı kullanır) ──
function btVeriImza() {
  var son = ALL_DATA.length ? ALL_DATA.reduce(function(mx, r) { return r.t > mx ? r.t : mx }, "") : "";
  return ALL_DATA.length + "|" + son;
}
function btCacheKaydet(pencere, sonuc) {
  try {
    var c = JSON.parse(localStorage.getItem("btCache") || "{}");
    c[pencere] = { imza: btVeriImza(), zaman: new Date().toISOString(), sonuc: sonuc };
    localStorage.setItem("btCache", JSON.stringify(c));
  } catch (e) { console.warn("btCache yazılamadı:", e.message); }
}
function btCacheOku(pencere) {
  try {
    var c = JSON.parse(localStorage.getItem("btCache") || "{}");
    if (!c[pencere]) return null;
    c[pencere].guncel = c[pencere].imza === btVeriImza();
    return c[pencere];
  } catch (e) { return null; }
}

// ═══════════════ ZORUNLU TESTLER ═══════════════

// T1 sentetik: son güne devasa fiyat enjekte → önceki günlerin skorları DEĞİŞMEMELİ
function btTestT1Sentetik() {
  var gunler = ["2026-08-01", "2026-08-03", "2026-08-05", "2026-08-07", "2026-08-09", "2026-08-11", "2026-08-13", "2026-08-15", "2026-08-17", "2026-08-19", "2026-08-21", "2026-08-23"];
  var yap = function(sonFiyat) {
    var rows = [];
    gunler.forEach(function(t, i) {
      var son = i === gunler.length - 1;
      rows.push({ t: t, c: "BT_ÇİÇEK", s: "Ş1", d: 10, net: (son ? sonFiyat : 100) * 10, ciro: 0, costModel: "v2" });
      rows.push({ t: t, c: "BT_ÇİÇEK", s: "Ş2", d: 10, net: (son ? sonFiyat : 80) * 10, ciro: 0, costModel: "v2" });
    });
    return rows;
  };
  // BT_KUTU_SABIT ile deterministik kutu (veri türevi medyan farkı eleniyor)
  var eskiKutu = window.BT_KUTU_SABIT;
  window.BT_KUTU_SABIT = 10;
  var r1 = runBacktest("v2", { rows: yap(100) });
  var r2 = runBacktest("v2", { rows: yap(99999) });   // son güne devasa fiyat
  window.BT_KUTU_SABIT = eskiKutu;

  // Son gün HARİÇ tüm günlerin model sim değerleri birebir aynı olmalı
  var oncekiAyni = true;
  for (var i = 0; i < r1.gunluk.length - 1; i++) {
    ["A1", "A0", "B", "C", "D"].forEach(function(m) {
      if (Math.abs(r1.gunluk[i].sim[m] - r2.gunluk[i].sim[m]) > 0.0001) oncekiAyni = false;
    });
    if (r1.gunluk[i].t !== r2.gunluk[i].t) oncekiAyni = false;
  }
  return { gunSayisi: r1.gunluk.length, oncekiGunlerAyni: oncekiAyni, kosum1Ihlal: r1.testler.t1.ihlal, kosum2Ihlal: r2.testler.t1.ihlal };
}

// T3 birim test: 2 şube × 5 gün elle kurgulanmış seri — A1 ve C el hesabıyla eşleşmeli
function btTestT3() {
  // Kurgu: Ş1 hep 100 ₺/dm × 20 dm; Ş2 hep 50 ₺/dm × 10 dm. Kutu sabit 10.
  // 5. gün (t5): D=30 dm → 3 kutu.
  // t-öncesi (4 gün) durum: Ş1 genel=100, günlük demetler [20,20,20,20] → median=20, P75=20, max=20
  //                         Ş2 genel=50,  demetler [10,10,10,10] → median=10, P75=10, max=10
  // A1 (kapasitesiz): 3 kutu × 10 = 30 dm hepsi Ş1'e → sim = 30×100 = 3000
  // C  (doygunluk):  kutu1 Ş1 (atanan 0≤20 çarpan 1: skor 100) → Ş1=10
  //                  kutu2 Ş1 (atanan 10≤20 çarpan 1) → Ş1=20
  //                  kutu3: Ş1 atanan 20 → median=p75=20 ≤20 çarpan 1?? atanan(20) ≤ median(20) → 1.00 → skor 100 > Ş2'nin 50 → Ş1=30
  //                  (atanan 20 ≤ max 20 → kapanmadı) → sim = 30×100 = 3000
  //                  NOT: k3'te Ş1 30'a çıkar; sınır AŞILMADAN kontrol edildiği için (atanan≤max) izinli — dökümandaki çarpan tanımı atanan üzerinden.
  // Gerçek: Ş1 20×100 + Ş2 10×50 = 2500
  var rows = [];
  ["2026-08-01", "2026-08-03", "2026-08-05", "2026-08-07", "2026-08-09"].forEach(function(t) {
    rows.push({ t: t, c: "BT_T3", s: "Ş1", d: 20, net: 2000, ciro: 0, costModel: "v2" });
    rows.push({ t: t, c: "BT_T3", s: "Ş2", d: 10, net: 500, ciro: 0, costModel: "v2" });
  });
  var eskiKutu = window.BT_KUTU_SABIT;
  var eskiMin = window.BT_SABITLER.minMezatGun;
  window.BT_KUTU_SABIT = 10;
  window.BT_SABITLER.minMezatGun = 5;
  var r = runBacktest("v2", { rows: rows });
  window.BT_KUTU_SABIT = eskiKutu;
  window.BT_SABITLER.minMezatGun = eskiMin;

  var sonGun = r.gunluk[r.gunluk.length - 1];
  return {
    gunSayisi: r.gunluk.length,
    sonGun: sonGun.t,
    gercek_elHesabi_2500: sonGun.gercek,
    A1_elHesabi_3000: sonGun.sim.A1,
    C_elHesabi_3000: sonGun.sim.C,
    eslesme: Math.abs(sonGun.gercek - 2500) < 0.01 && Math.abs(sonGun.sim.A1 - 3000) < 0.01 && Math.abs(sonGun.sim.C - 3000) < 0.01
  };
}
