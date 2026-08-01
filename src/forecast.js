// ═══════════════ FİYAT TAHMİNİ ═══════════════
function getForecast() {
  const bugun = new Date();
  const buYil = bugun.getFullYear();
  const buAy = bugun.getMonth() + 1;
  const buHafta = getWeekNumber(bugun);

  // 2026 verisi — EMA baz fiyat
  const data2026 = ALL_DATA.filter(r => r.t.startsWith(String(buYil)));
  const gunMap2026F = {};
  data2026.forEach(r => { if (!gunMap2026F[r.t]) gunMap2026F[r.t] = {net:0,d:0}; gunMap2026F[r.t].net += r.net; gunMap2026F[r.t].d += r.d; });
  const gunSirali2026F = Object.entries(gunMap2026F).sort((a,b) => a[0].localeCompare(b[0])).map(e => e[1].d > 0 ? e[1].net / e[1].d : 0).filter(v => v > 0);
  let ema2026F = 0;
  if (gunSirali2026F.length > 0) {
    const alpha = 2 / (Math.min(20, gunSirali2026F.length) + 1);
    ema2026F = gunSirali2026F[0];
    for (let i = 1; i < gunSirali2026F.length; i++) ema2026F = alpha * gunSirali2026F[i] + (1 - alpha) * ema2026F;
  }
  const ort2026 = ema2026F > 0 ? ema2026F : (data2026.reduce((s,r) => s+r.d, 0) > 0 ? data2026.reduce((s,r) => s+r.net, 0) / data2026.reduce((s,r) => s+r.d, 0) : 0);

  // Son 2 hafta trendi
  const son14 = new Date(bugun); son14.setDate(son14.getDate() - 14);
  const son14str = son14.toISOString().split("T")[0];
  const recentData = ALL_DATA.filter(r => r.t >= son14str && r.t.startsWith(String(buYil)));
  const son7str = new Date(bugun); son7str.setDate(son7str.getDate() - 7);
  const hafta1 = recentData.filter(r => r.t < son7str.toISOString().split("T")[0]);
  const hafta2 = recentData.filter(r => r.t >= son7str.toISOString().split("T")[0]);
  const h1Dbn = hafta1.reduce((s,r) => s+r.d, 0) > 0 ? hafta1.reduce((s,r) => s+r.net, 0) / hafta1.reduce((s,r) => s+r.d, 0) : 0;
  const h2Dbn = hafta2.reduce((s,r) => s+r.d, 0) > 0 ? hafta2.reduce((s,r) => s+r.net, 0) / hafta2.reduce((s,r) => s+r.d, 0) : 0;
  const trendPct = h1Dbn > 0 ? ((h2Dbn - h1Dbn) / h1Dbn * 100) : 0;

  const gelecekHafta = new Date(bugun); gelecekHafta.setDate(gelecekHafta.getDate() + 7);
  const ghAy = gelecekHafta.getMonth() + 1;
  const ghHafta = getWeekNumber(gelecekHafta);
  const yillar = [...new Set(ALL_DATA.map(r => r.t.substring(0,4)))].filter(y => y !== String(buYil));

  const genelTahmin = calcWeekForecast(null, ghAy, ghHafta, yillar, ort2026, h2Dbn, trendPct);

  // Çiçek bazlı tahmin — EMA baz
  const cicekTahminleri = [];
  const aktifCicekler = [...new Set(recentData.map(r => r.c))];
  aktifCicekler.forEach(cicek => {
    // EMA hesapla çiçek bazlı
    const cGunMap = {};
    data2026.filter(r => r.c === cicek).forEach(r => { if (!cGunMap[r.t]) cGunMap[r.t] = {net:0,d:0}; cGunMap[r.t].net += r.net; cGunMap[r.t].d += r.d; });
    const cGunS = Object.entries(cGunMap).sort((a,b) => a[0].localeCompare(b[0])).map(e => e[1].d > 0 ? e[1].net / e[1].d : 0).filter(v => v > 0);
    let cEma = 0;
    if (cGunS.length > 0) { const a = 2 / (Math.min(15, cGunS.length) + 1); cEma = cGunS[0]; for (let i = 1; i < cGunS.length; i++) cEma = a * cGunS[i] + (1-a) * cEma; }
    const cicekOrt = cEma > 0 ? cEma : (data2026.filter(r => r.c === cicek).reduce((s,r) => s+r.d, 0) > 0 ? data2026.filter(r => r.c === cicek).reduce((s,r) => s+r.net, 0) / data2026.filter(r => r.c === cicek).reduce((s,r) => s+r.d, 0) : 0);

    const cRecent1 = hafta1.filter(r => r.c === cicek);
    const cRecent2 = hafta2.filter(r => r.c === cicek);
    const cH1 = cRecent1.reduce((s,r) => s+r.d, 0) > 0 ? cRecent1.reduce((s,r) => s+r.net, 0) / cRecent1.reduce((s,r) => s+r.d, 0) : 0;
    const cH2 = cRecent2.reduce((s,r) => s+r.d, 0) > 0 ? cRecent2.reduce((s,r) => s+r.net, 0) / cRecent2.reduce((s,r) => s+r.d, 0) : 0;
    const cTrend = cH1 > 0 ? ((cH2 - cH1) / cH1 * 100) : 0;

    const tahmin = calcWeekForecast(cicek, ghAy, ghHafta, yillar, cicekOrt, cH2, cTrend);
    if (tahmin.merkez > 0) cicekTahminleri.push({ cicek, ...tahmin, sonFiyat: cH2, trend: cTrend });
  });
  cicekTahminleri.sort((a, b) => b.merkez - a.merkez);

  // Şube bazlı tahmin — EMA baz
  const subeTahminleri = [];
  const aktifSubeler = [...new Set(recentData.map(r => r.s))];
  aktifSubeler.forEach(sube => {
    const sGunMap = {};
    data2026.filter(r => r.s === sube).forEach(r => { if (!sGunMap[r.t]) sGunMap[r.t] = {net:0,d:0}; sGunMap[r.t].net += r.net; sGunMap[r.t].d += r.d; });
    const sGunS = Object.entries(sGunMap).sort((a,b) => a[0].localeCompare(b[0])).map(e => e[1].d > 0 ? e[1].net / e[1].d : 0).filter(v => v > 0);
    let sEma = 0;
    if (sGunS.length > 0) { const a = 2 / (Math.min(15, sGunS.length) + 1); sEma = sGunS[0]; for (let i = 1; i < sGunS.length; i++) sEma = a * sGunS[i] + (1-a) * sEma; }
    const subeOrt = sEma > 0 ? sEma : (data2026.filter(r => r.s === sube).reduce((s,r) => s+r.d, 0) > 0 ? data2026.filter(r => r.s === sube).reduce((s,r) => s+r.net, 0) / data2026.filter(r => r.s === sube).reduce((s,r) => s+r.d, 0) : 0);
    const sRecent2 = hafta2.filter(r => r.s === sube);
    const sH2 = sRecent2.reduce((s,r) => s+r.d, 0) > 0 ? sRecent2.reduce((s,r) => s+r.net, 0) / sRecent2.reduce((s,r) => s+r.d, 0) : 0;
    const sTrend = subeOrt > 0 ? ((sH2 - subeOrt) / subeOrt * 100) : 0;
    const tahmin = calcWeekForecast(null, ghAy, ghHafta, yillar, subeOrt, sH2, sTrend);
    if (tahmin.merkez > 0) subeTahminleri.push({ sube, ...tahmin, sonFiyat: sH2 });
  });
  subeTahminleri.sort((a, b) => b.merkez - a.merkez);

  return { genelTahmin, cicekTahminleri, subeTahminleri, h2Dbn, trendPct, ghAy, ghHafta, ort2026 };
}

function calcWeekForecast(cicek, targetAy, targetHafta, yillar, currentYearAvg, lastWeekDbn, trendPct) {
  // Geçmiş yılların aynı haftasındaki mevsimsel yüzdeleri bul — ±1 hafta smoothing
  const mevsimselYuzdeler = [];

  yillar.forEach(yil => {
    let yilData = ALL_DATA.filter(r => r.t.startsWith(yil));
    if (cicek) yilData = yilData.filter(r => r.c === cicek);
    const yilDbn = yilData.reduce((s,r) => s+r.d, 0) > 0 ? yilData.reduce((s,r) => s+r.net, 0) / yilData.reduce((s,r) => s+r.d, 0) : 0;
    if (yilDbn <= 0) return;

    // ±1 hafta smoothing — targetHafta-1, targetHafta, targetHafta+1 ortalaması
    let haftaData = yilData.filter(r => {
      const d = new Date(r.t + "T00:00:00");
      const hw = getWeekNumber(d);
      return hw >= targetHafta - 1 && hw <= targetHafta + 1;
    });
    if (haftaData.length === 0) {
      haftaData = yilData.filter(r => parseInt(r.t.substring(5,7)) === targetAy);
    }
    if (haftaData.length === 0) return;

    const haftaDbn = haftaData.reduce((s,r) => s+r.d, 0) > 0 ? haftaData.reduce((s,r) => s+r.net, 0) / haftaData.reduce((s,r) => s+r.d, 0) : 0;
    if (haftaDbn > 0) mevsimselYuzdeler.push(haftaDbn / yilDbn);
  });

  if (mevsimselYuzdeler.length === 0 || currentYearAvg <= 0) {
    if (lastWeekDbn > 0) {
      const trendFactor = 1 + (trendPct / 100) * 0.5;
      const merkez = lastWeekDbn * trendFactor;
      return { merkez, alt: merkez * 0.9, ust: merkez * 1.1, guven: "düşük", yilSayisi: 0 };
    }
    return { merkez: 0, alt: 0, ust: 0, guven: "yok", yilSayisi: 0 };
  }

  const ortMevsimsel = mevsimselYuzdeler.reduce((s,x) => s+x, 0) / mevsimselYuzdeler.length;

  // Mevsimsel tahmin: EMA baz × mevsimsel yüzde
  const mevsimselTahmin = currentYearAvg * ortMevsimsel;

  // Trend yönü kontrolü — mevsimsellikle aynı yönde mi?
  const mevsimselYon = ortMevsimsel > 1 ? 1 : ortMevsimsel < 1 ? -1 : 0; // mevsim yükseliş/düşüş
  const trendYon = trendPct > 0 ? 1 : trendPct < 0 ? -1 : 0;
  const ayniYon = mevsimselYon === trendYon || mevsimselYon === 0 || trendYon === 0;
  const trendCarpani = ayniYon ? 0.4 : 0.2; // Aynı yönde güçlendir, zıt yönde zayıflat

  const trendFactor = 1 + (trendPct / 100) * trendCarpani;
  const trendTahmin = lastWeekDbn > 0 ? lastWeekDbn * trendFactor : mevsimselTahmin;

  // Dinamik ağırlıklandırma — piyasa çalkantılıysa güncel veriye daha çok ağırlık
  let wMevsim = 0.50, wGuncel = 0.30, wTrend = 0.20;
  if (Math.abs(trendPct) > 15) {
    // Piyasa çok hareketli — mevsimselliğe daha az güven, güncel fiyata daha çok
    wMevsim = 0.30; wGuncel = 0.50; wTrend = 0.20;
  } else if (Math.abs(trendPct) > 8) {
    wMevsim = 0.40; wGuncel = 0.40; wTrend = 0.20;
  }

  const merkez = mevsimselTahmin * wMevsim + (lastWeekDbn > 0 ? lastWeekDbn : mevsimselTahmin) * wGuncel + trendTahmin * wTrend;

  // Güven aralığı — MERKEZ bazlı (bant ile nokta tahmin tutarlı olsun)
  const mevsStd = mevsimselYuzdeler.length >= 2 ? Math.sqrt(mevsimselYuzdeler.reduce((s,x) => s + Math.pow(x - ortMevsimsel, 2), 0) / mevsimselYuzdeler.length) : ortMevsimsel * 0.15;
  const bandGenisligi = currentYearAvg * 1.96 * mevsStd;
  const alt = Math.max(0, merkez - bandGenisligi);
  const ust = merkez + bandGenisligi;

  // Güven seviyesi — yıl sayısı + standart sapma bazlı
  let guven = "orta";
  const cv = ortMevsimsel > 0 ? (mevsStd / ortMevsimsel * 100) : 100;
  if (mevsimselYuzdeler.length >= 4 && cv < 15) guven = "yüksek";
  else if (mevsimselYuzdeler.length <= 1 || cv > 30) guven = "düşük";

  return { merkez, alt, ust, guven, yilSayisi: mevsimselYuzdeler.length };
}
