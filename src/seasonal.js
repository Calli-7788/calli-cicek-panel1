// ═══════════════ MEVSİMSELLİK ANALİZİ ═══════════════
// OZEL_GUNLER, DINI_BAYRAMLAR, getAnnelerGunu → config.js'de tanımlı (window. global)

// Özel gün analiz fonksiyonu — peak day, hacim endeksi, std sapma güven, çiçek bazlı
function analyzeOzelGun(ad, oncesi, getTarih, yilDbn) {
  const yilEtkileri = [];
  const yilHacimleri = [];
  const peakGunler = []; // özel günden kaç gün önce zirve
  const cicekEtkileri = {}; // çiçek bazlı

  Object.keys(yilDbn).forEach(yil => {
    const ozelTarih = typeof getTarih === "function" ? getTarih(yil) : yil + "-" + getTarih;
    if (!ozelTarih) return;
    const baslangic = new Date(ozelTarih + "T00:00:00");
    baslangic.setDate(baslangic.getDate() - oncesi);
    const basStr = baslangic.toISOString().split("T")[0];
    const oncesiData = ALL_DATA.filter(r => r.t >= basStr && r.t <= ozelTarih && r.t.startsWith(yil));
    if (oncesiData.length === 0 || yilDbn[yil] <= 0) return;

    const oncesiDbn = oncesiData.reduce((s,r) => s+r.d, 0) > 0 ? oncesiData.reduce((s,r) => s+r.net, 0) / oncesiData.reduce((s,r) => s+r.d, 0) : 0;
    if (oncesiDbn <= 0) return;

    // Fiyat etkisi
    yilEtkileri.push(oncesiDbn / yilDbn[yil]);

    // Hacim endeksi — bu haftanın demeti vs yılın haftalık ortalama demeti
    const yilData = ALL_DATA.filter(r => r.t.startsWith(yil));
    const yilToplamD = yilData.reduce((s,r) => s+r.d, 0);
    const yilGunSayisi = new Set(yilData.map(r => r.t)).size;
    const yilGunlukOrtD = yilGunSayisi > 0 ? yilToplamD / yilGunSayisi : 0;
    const pencereD = oncesiData.reduce((s,r) => s+r.d, 0);
    const pencereGunSayisi = new Set(oncesiData.map(r => r.t)).size;
    const pencereGunlukOrtD = pencereGunSayisi > 0 ? pencereD / pencereGunSayisi : 0;
    if (yilGunlukOrtD > 0) yilHacimleri.push(pencereGunlukOrtD / yilGunlukOrtD);

    // Peak day — pencere içindeki en yüksek fiyatlı gün
    const gunFiyat = {};
    oncesiData.forEach(r => {
      if (!gunFiyat[r.t]) gunFiyat[r.t] = { net: 0, d: 0 };
      gunFiyat[r.t].net += r.net; gunFiyat[r.t].d += r.d;
    });
    let maxDbn = 0, peakTarih = null;
    Object.entries(gunFiyat).forEach(([t, v]) => {
      const dbn = v.d > 0 ? v.net / v.d : 0;
      if (dbn > maxDbn) { maxDbn = dbn; peakTarih = t; }
    });
    if (peakTarih) {
      const ozelDate = new Date(ozelTarih + "T00:00:00");
      const peakDate = new Date(peakTarih + "T00:00:00");
      const fark = Math.round((ozelDate - peakDate) / 864e5);
      if (fark >= 0) peakGunler.push(fark);
    }

    // Çiçek bazlı etki
    const cicekMap = {};
    oncesiData.forEach(r => {
      if (r.c.toLowerCase().includes("saksı") || r.c.toLowerCase().includes("saksi")) return;
      if (!cicekMap[r.c]) cicekMap[r.c] = { net: 0, d: 0 };
      cicekMap[r.c].net += r.net; cicekMap[r.c].d += r.d;
    });
    // Her çiçeğin kendi yıl ortalamasına böl
    Object.entries(cicekMap).forEach(([c, v]) => {
      if (v.d <= 0) return;
      const cicekYilData = yilData.filter(r => r.c === c);
      const cicekYilDbn = cicekYilData.reduce((s,r) => s+r.d, 0) > 0 ? cicekYilData.reduce((s,r) => s+r.net, 0) / cicekYilData.reduce((s,r) => s+r.d, 0) : 0;
      if (cicekYilDbn > 0) {
        if (!cicekEtkileri[c]) cicekEtkileri[c] = [];
        cicekEtkileri[c].push((v.net / v.d) / cicekYilDbn);
      }
    });
  });

  if (yilEtkileri.length === 0) return null;

  const ortEtki = yilEtkileri.reduce((s,x) => s+x, 0) / yilEtkileri.length;
  const stdSapma = yilEtkileri.length >= 2 ? Math.sqrt(yilEtkileri.reduce((s,x) => s + Math.pow(x - ortEtki, 2), 0) / yilEtkileri.length) : 0;
  const guvenSkoru = stdSapma > 0 ? Math.min(100, Math.round((yilEtkileri.length / stdSapma) * 10)) : (yilEtkileri.length >= 3 ? 80 : 30);
  const ortHacim = yilHacimleri.length > 0 ? yilHacimleri.reduce((s,x) => s+x, 0) / yilHacimleri.length : 1;
  const ortPeak = peakGunler.length > 0 ? Math.round(peakGunler.reduce((s,x) => s+x, 0) / peakGunler.length) : null;

  // En çok etkilenen 5 çiçek
  const topCicekler = Object.entries(cicekEtkileri).map(([c, vals]) => ({
    cicek: c, etki: Math.round((vals.reduce((s,x) => s+x, 0) / vals.length) * 100) - 100, yilSayisi: vals.length
  })).filter(c => c.yilSayisi >= 2).sort((a,b) => b.etki - a.etki).slice(0, 5);

  return { ad, oncesi, ortEtki, yilSayisi: yilEtkileri.length, stdSapma, guvenSkoru, ortHacim, ortPeak, topCicekler };
}

let _seasonalCache = null;
let _seasonalCacheTime = 0;
function getSeasonalData() {
  // 30 saniye cache — aynı veriyi tekrar tekrar hesaplama
  if (_seasonalCache && (Date.now() - _seasonalCacheTime) < 30000) return _seasonalCache;
  _seasonalCacheTime = Date.now();
  // Her yılın kendi ortalaması
  const yilOrt = {};
  ALL_DATA.forEach(r => {
    const yil = r.t.substring(0, 4);
    if (!yilOrt[yil]) yilOrt[yil] = { net: 0, d: 0 };
    yilOrt[yil].net += r.net; yilOrt[yil].d += r.d;
  });
  const yilDbn = {};
  Object.entries(yilOrt).forEach(([y, v]) => { yilDbn[y] = v.d > 0 ? v.net / v.d : 0; });

  // Aylık mevsimsel yüzde (her ayı o yılın ortalamasına böl)
  const aylik = {};
  ALL_DATA.forEach(r => {
    const yil = r.t.substring(0, 4);
    const ay = r.t.substring(5, 7);
    if (!aylik[ay]) aylik[ay] = {};
    if (!aylik[ay][yil]) aylik[ay][yil] = { net: 0, d: 0 };
    aylik[ay][yil].net += r.net; aylik[ay][yil].d += r.d;
  });

  // Ağırlıklı Trimmed Mean hesaplama fonksiyonu
  // 1. En uç yüksek ve düşük yılı at (trimmed)
  // 2. Kalan yıllara recency ağırlığı ver (son yıllar daha ağırlıklı)
  const buYil = new Date().getFullYear();
  function agirlikliTrimmedMean(yuzdeMap) {
    // yuzdeMap: { "2019": 1.05, "2020": 0.98, "2023": 1.12, ... }
    var entries = Object.entries(yuzdeMap).sort(function(a,b){ return a[1] - b[1] });
    // Trimmed mean: 4+ veri varsa en uç 2'yi at (en yüksek + en düşük)
    if (entries.length >= 4) {
      entries = entries.slice(1, entries.length - 1); // En düşük ve en yüksek yılı çıkar
    }
    // Recency ağırlık: Son yıla en yüksek, eski yıla en düşük
    var toplamAgirlik = 0;
    var toplamDeger = 0;
    entries.forEach(function(e) {
      var yil = parseInt(e[0]);
      var yuzde = e[1];
      // Ağırlık: 2^(-(buYil - yil)) → 2026=1, 2025=0.5, 2024=0.25, 2023=0.125...
      // Daha yumuşak: 1 / (1 + (buYil - yil) * 0.5) → 2026=1, 2025=0.67, 2024=0.5, 2023=0.4...
      var agirlik = 1 / (1 + (buYil - yil) * 0.5);
      toplamAgirlik += agirlik;
      toplamDeger += yuzde * agirlik;
    });
    return toplamAgirlik > 0 ? toplamDeger / toplamAgirlik : null;
  }

  const aylarData = [];
  const ayAdlari = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  for (let m = 1; m <= 12; m++) {
    const key = String(m).padStart(2, "0");
    const yilVerileri = aylik[key] || {};
    const yuzdeMap = {};
    const yuzdeler = [];
    const yillar = [];
    Object.entries(yilVerileri).forEach(([yil, v]) => {
      if (yilDbn[yil] > 0 && v.d > 0) {
        const ayDbn = v.net / v.d;
        const yuzde = ayDbn / yilDbn[yil];
        yuzdeMap[yil] = yuzde;
        yuzdeler.push(yuzde);
        yillar.push(yil);
      }
    });
    const ortYuzde = agirlikliTrimmedMean(yuzdeMap);
    const totalD = Object.values(yilVerileri).reduce((s, v) => s + v.d, 0);
    aylarData.push({
      ay: m, ad: ayAdlari[m - 1], key,
      ortYuzde, yuzdeler, yillar,
      yilSayisi: yuzdeler.length, demet: totalD
    });
  }

  // Çiçek bazlı mevsimsellik
  const cicekAylik = {};
  ALL_DATA.forEach(r => {
    const yil = r.t.substring(0, 4);
    const ay = parseInt(r.t.substring(5, 7));
    if (!cicekAylik[r.c]) cicekAylik[r.c] = {};
    if (!cicekAylik[r.c][ay]) cicekAylik[r.c][ay] = {};
    if (!cicekAylik[r.c][ay][yil]) cicekAylik[r.c][ay][yil] = { net: 0, d: 0 };
    cicekAylik[r.c][ay][yil].net += r.net; cicekAylik[r.c][ay][yil].d += r.d;
  });

  // Her çiçeğin aktif olduğu aylar ve mevsimsel yüzdesi
  const cicekMevsim = {};
  Object.entries(cicekAylik).forEach(([cicek, aylar]) => {
    cicekMevsim[cicek] = {};
    // Bu çiçeğin yıllık ortalamaları
    const cicekYilOrt = {};
    ALL_DATA.filter(r => r.c === cicek).forEach(r => {
      const yil = r.t.substring(0, 4);
      if (!cicekYilOrt[yil]) cicekYilOrt[yil] = { net: 0, d: 0 };
      cicekYilOrt[yil].net += r.net; cicekYilOrt[yil].d += r.d;
    });
    const cicekYilDbn = {};
    Object.entries(cicekYilOrt).forEach(([y, v]) => { cicekYilDbn[y] = v.d > 0 ? v.net / v.d : 0; });

    for (let m = 1; m <= 12; m++) {
      const yilVerileri = aylar[m] || {};
      const yuzdeMap = {};
      Object.entries(yilVerileri).forEach(([yil, v]) => {
        if (cicekYilDbn[yil] > 0 && v.d > 0) {
          yuzdeMap[yil] = (v.net / v.d) / cicekYilDbn[yil];
        }
      });
      const ortYuzde = agirlikliTrimmedMean(yuzdeMap);
      if (ortYuzde !== null) {
        cicekMevsim[cicek][m] = {
          ortYuzde: ortYuzde,
          yilSayisi: Object.keys(yuzdeMap).length,
          totalD: Object.values(yilVerileri).reduce((s, v) => s + v.d, 0)
        };
      }
    }
  });

  // Hafta günü mevsimselliği — ENFLASYONSuZ (her haftayı kendi içinde normalize et)
  const mezatGunleri = ["Pazartesi", "Çarşamba", "Cuma"];
  // Her ISO hafta için günlük endeks hesapla
  const haftaGunVeri = {}; // { "2024-W12": { "Pazartesi": {net,d}, "Çarşamba": {net,d}, haftaOrt: X } }
  ALL_DATA.forEach(r => {
    const d = new Date(r.t + "T00:00:00");
    const gunAdi = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"][d.getDay()];
    if (!mezatGunleri.includes(gunAdi)) return;
    const yil = r.t.substring(0, 4);
    const hafta = yil + "-W" + String(getWeekNumber(d)).padStart(2, "0");
    if (!haftaGunVeri[hafta]) haftaGunVeri[hafta] = {};
    if (!haftaGunVeri[hafta][gunAdi]) haftaGunVeri[hafta][gunAdi] = { net: 0, d: 0 };
    haftaGunVeri[hafta][gunAdi].net += r.net; haftaGunVeri[hafta][gunAdi].d += r.d;
  });
  // Her haftanın ortalamasını hesapla, sonra her günü o ortalamaya böl
  const gunEndeksler = {}; // { "Pazartesi": [1.05, 0.98, 1.02, ...], "Çarşamba": [...] }
  const gunToplamNet = {}; // { "Pazartesi": totalNet }
  mezatGunleri.forEach(g => { gunEndeksler[g] = []; gunToplamNet[g] = 0; });
  Object.values(haftaGunVeri).forEach(hafta => {
    // Haftadaki tüm günlerin birleşik ortalaması
    let hNet = 0, hD = 0;
    Object.values(hafta).forEach(v => { hNet += v.net; hD += v.d; });
    const haftaOrt = hD > 0 ? hNet / hD : 0;
    if (haftaOrt <= 0) return;
    // Her günü hafta ortalamasına böl
    mezatGunleri.forEach(g => {
      if (hafta[g] && hafta[g].d > 0) {
        const gunDbn = hafta[g].net / hafta[g].d;
        gunEndeksler[g].push(gunDbn / haftaOrt);
        gunToplamNet[g] += hafta[g].net;
      }
    });
  });
  const gunList = mezatGunleri.map(g => {
    const vals = gunEndeksler[g];
    if (vals.length === 0) return null;
    const ort = vals.reduce((s, x) => s + x, 0) / vals.length;
    return { gun: g, endeks: Math.round(ort * 100), mezatSayisi: vals.length, toplamNet: gunToplamNet[g] };
  }).filter(g => g !== null).sort((a, b) => b.endeks - a.endeks);

  // Çiçek bazlı gün performansı (en çok satılan 8 çiçek)
  const cicekGunVeri = {};
  ALL_DATA.forEach(r => {
    if (r.c.toLowerCase().includes("saksı") || r.c.toLowerCase().includes("saksi")) return;
    const d = new Date(r.t + "T00:00:00");
    const gunAdi = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"][d.getDay()];
    if (!mezatGunleri.includes(gunAdi)) return;
    const yil = r.t.substring(0, 4);
    const hafta = yil + "-W" + String(getWeekNumber(d)).padStart(2, "0");
    if (!cicekGunVeri[r.c]) cicekGunVeri[r.c] = {};
    if (!cicekGunVeri[r.c][hafta]) cicekGunVeri[r.c][hafta] = {};
    if (!cicekGunVeri[r.c][hafta][gunAdi]) cicekGunVeri[r.c][hafta][gunAdi] = { net: 0, d: 0 };
    cicekGunVeri[r.c][hafta][gunAdi].net += r.net; cicekGunVeri[r.c][hafta][gunAdi].d += r.d;
  });
  const cicekGunEndeks = {};
  Object.entries(cicekGunVeri).forEach(([cicek, haftalar]) => {
    const gunE = {};
    mezatGunleri.forEach(g => { gunE[g] = []; });
    Object.values(haftalar).forEach(hafta => {
      let hNet = 0, hD = 0;
      Object.values(hafta).forEach(v => { hNet += v.net; hD += v.d; });
      const haftaOrt = hD > 0 ? hNet / hD : 0;
      if (haftaOrt <= 0) return;
      mezatGunleri.forEach(g => {
        if (hafta[g] && hafta[g].d > 0) {
          gunE[g].push((hafta[g].net / hafta[g].d) / haftaOrt);
        }
      });
    });
    const toplamVeri = mezatGunleri.reduce((s, g) => s + gunE[g].length, 0);
    if (toplamVeri < 10) return;
    cicekGunEndeks[cicek] = {};
    mezatGunleri.forEach(g => {
      if (gunE[g].length > 0) {
        cicekGunEndeks[cicek][g] = Math.round((gunE[g].reduce((s,x) => s+x, 0) / gunE[g].length) * 100);
      }
    });
    cicekGunEndeks[cicek]._toplamD = ALL_DATA.filter(r => r.c === cicek).reduce((s,r) => s+r.d, 0);
  });

  // 2026 projeksiyon — EMA baz fiyat (son haftalara daha fazla ağırlık)
  const yil2026 = ALL_DATA.filter(r => r.t.startsWith("2026"));
  // Günlük dm başı net hesapla ve EMA uygula
  const gunMap2026 = {};
  yil2026.forEach(r => {
    if (!gunMap2026[r.t]) gunMap2026[r.t] = { net: 0, d: 0 };
    gunMap2026[r.t].net += r.net; gunMap2026[r.t].d += r.d;
  });
  const gunSirali2026 = Object.entries(gunMap2026).sort((a,b) => a[0].localeCompare(b[0])).map(e => e[1].d > 0 ? e[1].net / e[1].d : 0).filter(v => v > 0);
  // EMA hesapla — alpha=2/(N+1), N=son 20 gün bazlı
  let ema2026 = 0;
  if (gunSirali2026.length > 0) {
    const alpha = 2 / (Math.min(20, gunSirali2026.length) + 1);
    ema2026 = gunSirali2026[0];
    for (let i = 1; i < gunSirali2026.length; i++) {
      ema2026 = alpha * gunSirali2026[i] + (1 - alpha) * ema2026;
    }
  }
  const ort2026 = ema2026 > 0 ? ema2026 : (yil2026.reduce((s,r) => s+r.d, 0) > 0 ? yil2026.reduce((s,r) => s+r.net, 0) / yil2026.reduce((s,r) => s+r.d, 0) : 0);

  // Güven aralığı verisi — her ay için geçmiş yılların std sapması
  const ayGuvenAraligi = {};
  for (let m = 1; m <= 12; m++) {
    const key = String(m).padStart(2, "0");
    const yilVerileri = aylik[key] || {};
    const oranlar = [];
    Object.entries(yilVerileri).forEach(([yil, v]) => {
      if (yilDbn[yil] > 0 && v.d > 0) {
        oranlar.push((v.net / v.d) / yilDbn[yil]);
      }
    });
    if (oranlar.length >= 2) {
      const ort = oranlar.reduce((s,x) => s+x, 0) / oranlar.length;
      const stdSapma = Math.sqrt(oranlar.reduce((s,x) => s + Math.pow(x - ort, 2), 0) / oranlar.length);
      ayGuvenAraligi[m] = { ort, stdSapma, alt: ort - 1.96 * stdSapma, ust: ort + 1.96 * stdSapma };
    }
  }

  // Backtesting — geçmiş ayların tahmin vs gerçekleşen hata payı
  const backtesting = [];
  const buAyNum = new Date().getMonth() + 1;
  yil2026.length > 0 && (function() {
    for (let m = 1; m < buAyNum; m++) {
      const ayData = yil2026.filter(r => parseInt(r.t.substring(5,7)) === m);
      if (ayData.length === 0) continue;
      const gerceklesen = ayData.reduce((s,r) => s+r.d, 0) > 0 ? ayData.reduce((s,r) => s+r.net, 0) / ayData.reduce((s,r) => s+r.d, 0) : 0;
      // Tahmin: ort2026 × mevsimsel endeks
      const ayEndeks = aylarData[m-1];
      if (!ayEndeks || ayEndeks.ortYuzde === null) continue;
      const tahmin = ort2026 * ayEndeks.ortYuzde;
      const hata = tahmin > 0 ? ((gerceklesen - tahmin) / tahmin * 100) : 0;
      backtesting.push({ ay: m, tahmin, gerceklesen, hata, ad: ayEndeks.ad });
    }
  })();

  // Özel gün analizi
  const ozelGunAnaliz = [];
  // Sabit tarihli özel günler
  OZEL_GUNLER.forEach(og => {
    const result = analyzeOzelGun(og.ad, og.oncesi, og.tarih, yilDbn);
    if (result) ozelGunAnaliz.push(result);
  });
  // Anneler Günü (dinamik)
  const agResult = analyzeOzelGun("Anneler Günü", 7, function(yil){ return getAnnelerGunu(parseInt(yil)); }, yilDbn);
  if (agResult) ozelGunAnaliz.push(agResult);
  // Dini bayramlar (hareketli tarihler)
  Object.values(DINI_BAYRAMLAR).forEach(db => {
    const result = analyzeOzelGun(db.ad, db.oncesi, function(yil){ return db.tarihler[yil] || null; }, yilDbn);
    if (result) ozelGunAnaliz.push(result);
  });
  ozelGunAnaliz.sort((a, b) => b.ortEtki - a.ortEtki);

  // Çiçek × Ay × Hafta bazlı mevsimsel veri
  const cicekAyHafta = {};
  ALL_DATA.forEach(r => {
    const yil = r.t.substring(0, 4);
    const ay = parseInt(r.t.substring(5, 7));
    const d = new Date(r.t + "T00:00:00");
    const haftaGunu = d.getDate();
    const haftaNo = Math.ceil(haftaGunu / 7); // 1-5 arası hafta
    const key = r.c + "|" + ay + "|" + haftaNo;
    if (!cicekAyHafta[key]) cicekAyHafta[key] = {};
    if (!cicekAyHafta[key][yil]) cicekAyHafta[key][yil] = { net: 0, d: 0 };
    cicekAyHafta[key][yil].net += r.net; cicekAyHafta[key][yil].d += r.d;
  });

  // Her çiçeğin yıllık ortalamaları (çiçek bazlı)
  const cicekYilOrtMap = {};
  ALL_DATA.forEach(r => {
    const yil = r.t.substring(0, 4);
    if (!cicekYilOrtMap[r.c]) cicekYilOrtMap[r.c] = {};
    if (!cicekYilOrtMap[r.c][yil]) cicekYilOrtMap[r.c][yil] = { net: 0, d: 0 };
    cicekYilOrtMap[r.c][yil].net += r.net; cicekYilOrtMap[r.c][yil].d += r.d;
  });

  // Haftalık mevsimsel endeks hesapla
  function getHaftalikEndeks(cicek, ay) {
    const result = [];
    for (let h = 1; h <= 5; h++) {
      const key = cicek + "|" + ay + "|" + h;
      const yilVerileri = cicekAyHafta[key] || {};
      const yuzdeMap = {};
      let toplamD = 0;
      Object.entries(yilVerileri).forEach(([yil, v]) => {
        const cYilOrt = cicekYilOrtMap[cicek] && cicekYilOrtMap[cicek][yil];
        const yilDbnC = cYilOrt && cYilOrt.d > 0 ? cYilOrt.net / cYilOrt.d : 0;
        if (yilDbnC > 0 && v.d > 0) {
          yuzdeMap[yil] = (v.net / v.d) / yilDbnC;
          toplamD += v.d;
        }
      });
      const ortYuzde = agirlikliTrimmedMean(yuzdeMap);
      if (ortYuzde !== null) {
        result.push({
          hafta: h,
          endeks: Math.round(ortYuzde * 100),
          yilSayisi: Object.keys(yuzdeMap).length,
          demet: toplamD
        });
      }
    }
    return result;
  }

  // Sezon başlangıç/bitiş standart sapması — her çiçeğin sezonu ±kaç gün oynuyor
  const cicekSezonBilgi = {};
  Object.entries(cicekAylik).forEach(([cicek, aylar]) => {
    if (cicek.toLowerCase().includes("saksı") || cicek.toLowerCase().includes("saksi")) return;
    // Her yılda ilk ve son satış haftasını bul
    const yilBas = {}; // { "2023": 5 (hafta no), "2024": 7, ... }
    const yilSon = {};
    ALL_DATA.filter(r => r.c === cicek).forEach(r => {
      const yil = r.t.substring(0, 4);
      const d = new Date(r.t + "T00:00:00");
      const hafta = getWeekNumber(d);
      if (!yilBas[yil] || hafta < yilBas[yil]) yilBas[yil] = hafta;
      if (!yilSon[yil] || hafta > yilSon[yil]) yilSon[yil] = hafta;
    });
    const basHaftalar = Object.values(yilBas);
    const sonHaftalar = Object.values(yilSon);
    if (basHaftalar.length < 2) return;

    const basOrt = Math.round(basHaftalar.reduce((s,x) => s+x, 0) / basHaftalar.length);
    const sonOrt = Math.round(sonHaftalar.reduce((s,x) => s+x, 0) / sonHaftalar.length);
    const basStd = Math.round(Math.sqrt(basHaftalar.reduce((s,x) => s + Math.pow(x - basOrt, 2), 0) / basHaftalar.length) * 7); // gün cinsine çevir
    const sonStd = Math.round(Math.sqrt(sonHaftalar.reduce((s,x) => s + Math.pow(x - sonOrt, 2), 0) / sonHaftalar.length) * 7);

    cicekSezonBilgi[cicek] = { basOrt, sonOrt, basStd, sonStd, yilSayisi: basHaftalar.length };
  });

  _seasonalCache = { aylarData, cicekMevsim, gunList, ort2026, yilDbn, ozelGunAnaliz, cicekAylik, getHaftalikEndeks, ayGuvenAraligi, backtesting, cicekGunEndeks, cicekSezonBilgi };
  return _seasonalCache;
}
