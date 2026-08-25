// ═══════════════ FILTERING & STATS ═══════════════

// V2 alt küme özeti — Cost Model v2 görünürlük yardımcıları (mevcut fonksiyonlara dokunmaz)
function getV2Ozet(rows) {
  let n = 0, ciro = 0, gider = 0, d = 0;
  rows.forEach(r => {
    if (r.costModel !== "v2") return;
    n++; ciro += r.ciro; gider += r.toplamGider; d += r.d;
  });
  return { n, ciro, gider, d, kesintiPct: ciro > 0 ? (gider / ciro * 100) : null };
}

// Seçili dönem + filtrelerle eşleşen zarar kayıtları (ZARAR_DATA analiz dışıdır)
function getZararFiltered() {
  return window.ZARAR_DATA.filter(r => {
    if (r.t < state.sd || r.t > state.ed) return false;
    if (state.sf) {
      if (state.sf.startsWith("GRUP:")) {
        if (!r.c.startsWith(state.sf.replace("GRUP:", ""))) return false;
      } else {
        if (r.c !== state.sf) return false;
      }
    }
    if (state.sb && r.s !== state.sb) return false;
    return true;
  });
}

// Satır büyüklüğü aralıkları × kesinti analizi (Giderler sekmesi böl. 4)
function getGiderAralik(rows) {
  const araliklar = [
    { ad: "1-5 dm", min: 1, max: 5, n: 0, gider: 0, ciro: 0, net: 0, d: 0 },
    { ad: "6-10 dm", min: 6, max: 10, n: 0, gider: 0, ciro: 0, net: 0, d: 0 },
    { ad: "11-20 dm", min: 11, max: 20, n: 0, gider: 0, ciro: 0, net: 0, d: 0 },
    { ad: "21+ dm", min: 21, max: Infinity, n: 0, gider: 0, ciro: 0, net: 0, d: 0 }
  ];
  rows.forEach(r => {
    const a = araliklar.find(x => r.d >= x.min && r.d <= x.max);
    if (!a) return;
    a.n++; a.gider += r.toplamGider; a.ciro += r.ciro; a.net += r.net; a.d += r.d;
  });
  return araliklar.map(a => ({
    ad: a.ad, n: a.n,
    ortKesinti: a.ciro > 0 ? (a.gider / a.ciro * 100) : null,
    ortNetDm: a.d > 0 ? (a.net / a.d) : null
  }));
}

// Giderler sekmesi ana istatistikleri — SADECE v2 satırlarla çağrılır
function getGiderStats(v2rows) {
  const kalemTanim = [
    { key: "koop", ad: "Koop Gider" },
    { key: "nakliye", ad: "Nakliye" },
    { key: "bagkur", ad: "Bağkur" },
    { key: "stopaj", ad: "Stopaj" },
    { key: "hamaliye", ad: "Hamaliye" },
    { key: "borsa", ad: "Borsa" },
    { key: "nakliyeZarar", ad: "Nakliye Zarar" }
  ];
  const toplamlar = {};
  kalemTanim.forEach(k => toplamlar[k.key] = 0);
  let toplamGider = 0, toplamCiro = 0;
  const subeM = {}, gunM = {};

  v2rows.forEach(r => {
    kalemTanim.forEach(k => toplamlar[k.key] += r.giderler[k.key]);
    toplamGider += r.toplamGider; toplamCiro += r.ciro;
    if (!subeM[r.s]) subeM[r.s] = { nakliye: 0, n: 0, d: 0, ciro: 0 };
    subeM[r.s].nakliye += r.giderler.nakliye; subeM[r.s].n++; subeM[r.s].d += r.d; subeM[r.s].ciro += r.ciro;
    if (!gunM[r.t]) gunM[r.t] = { gider: 0, ciro: 0 };
    gunM[r.t].gider += r.toplamGider; gunM[r.t].ciro += r.ciro;
  });

  const kalemler = kalemTanim.map(k => ({
    ad: k.ad, toplam: toplamlar[k.key],
    pay: toplamGider > 0 ? (toplamlar[k.key] / toplamGider * 100) : 0
  })).sort((a, b) => b.toplam - a.toplam);

  const subeNakliye = Object.entries(subeM).map(([s, v]) => ({
    sube: s, nakliye: v.nakliye, satir: v.n,
    perSatir: v.n > 0 ? v.nakliye / v.n : 0,
    perDemet: v.d > 0 ? v.nakliye / v.d : 0,
    brutPct: v.ciro > 0 ? (v.nakliye / v.ciro * 100) : 0
  })).sort((a, b) => b.perDemet - a.perDemet);

  const gunler = Object.entries(gunM).sort((a, b) => a[0].localeCompare(b[0]))
    .map(([t, v]) => ({ t, pct: v.ciro > 0 ? (v.gider / v.ciro * 100) : 0 }));

  return {
    kalemler, toplamGider, toplamCiro,
    ortKesinti: toplamCiro > 0 ? (toplamGider / toplamCiro * 100) : 0,
    subeNakliye, gunler,
    araliklar: getGiderAralik(v2rows),
    vergi: { bagkur: toplamlar.bagkur, stopaj: toplamlar.stopaj, borsa: toplamlar.borsa }
  };
}

function getFiltered() {
  return ALL_DATA.filter(r => {
    if (r.t < state.sd || r.t > state.ed) return false;
    if (state.sf) {
      if (state.sf.startsWith("GRUP:")) {
        if (!r.c.startsWith(state.sf.replace("GRUP:", ""))) return false;
      } else {
        if (r.c !== state.sf) return false;
      }
    }
    if (state.sb && r.s !== state.sb) return false;
    return true;
  });
}

function calcStats(filtered) {
  const tc = filtered.reduce((s, r) => s + r.ciro, 0);
  const tn = filtered.reduce((s, r) => s + r.net, 0);
  const td = filtered.reduce((s, r) => s + r.d, 0);
  const av = td > 0 ? tn / td : 0; // Ort fiyat = net bazlı (gider düşülmüş)

  const groupBy = key => {
    const m = {};
    filtered.forEach(r => {
      const k = r[key];
      if (!m[k]) m[k] = { ciro: 0, net: 0, d: 0, prices: [] };
      m[k].ciro += r.ciro; m[k].net += r.net; m[k].d += r.d; m[k].prices.push(r.f);
    });
    return Object.entries(m).map(([name, v]) => ({
      name, ...v, avgP: v.d > 0 ? v.ciro / v.d : 0, dbn: v.d > 0 ? v.net / v.d : 0
    })).sort((a, b) => b.dbn - a.dbn);
  };

  const byF = groupBy("c");
  const byB = groupBy("s").sort((a,b) => b.net - a.net);

  const grpMap = {};
  filtered.forEach(r => {
    const g = GROUP_NAMES.find(x => r.c.startsWith(x)) || r.c;
    if (!grpMap[g]) grpMap[g] = { ciro: 0, net: 0, d: 0 };
    grpMap[g].ciro += r.ciro; grpMap[g].net += r.net; grpMap[g].d += r.d;
  });
  const grpList = Object.entries(grpMap).map(([n, v]) => ({ name: n, ...v, dbn: v.d > 0 ? v.net / v.d : 0 })).sort((a, b) => b.net - a.net);

  const dayMap = {};
  filtered.forEach(r => {
    if (!dayMap[r.t]) dayMap[r.t] = { ciro: 0, net: 0, d: 0 };
    dayMap[r.t].ciro += r.ciro; dayMap[r.t].net += r.net; dayMap[r.t].d += r.d;
  });
  const dl = Object.entries(dayMap).map(([d, v]) => ({ date: d, ...v, avgP: v.d > 0 ? v.ciro / v.d : 0 })).sort((a, b) => a.date.localeCompare(b.date));

  // Period comparison
  const dc = Math.max(1, Math.round((new Date(state.ed) - new Date(state.sd)) / 864e5) + 1);
  const pe = new Date(new Date(state.sd).getTime() - 864e5);
  const ps = new Date(pe.getTime() - (dc - 1) * 864e5);
  const prev = ALL_DATA.filter(r =>
    r.t >= ps.toISOString().split("T")[0] && r.t <= pe.toISOString().split("T")[0] &&
    (!state.sf || (state.sf.startsWith("GRUP:") ? r.c.startsWith(state.sf.replace("GRUP:", "")) : r.c === state.sf)) &&
    (!state.sb || r.s === state.sb)
  );
  const pc = prev.reduce((s, r) => s + r.ciro, 0);
  const cc = pc > 0 ? ((tc - pc) / pc * 100) : null;

  return { tc, tn, td, av, byF, byB, grpList, dl, cc, cnt: filtered.length };
}

// ═══════════════ ALERTS ═══════════════
// getPDFReportData → report.js'de tanımlı

function getAlerts(filtered) {
  const today = state.ed;
  const result = [];
  const todayRecs = ALL_DATA.filter(r => r.t === today);
  if (todayRecs.length) {
    // Çiçek×şube bazında grupla
    const kombo = {};
    todayRecs.forEach(r => {
      const key = r.c + "\u2192" + r.s;
      if (!kombo[key]) kombo[key] = { c: r.c, s: r.s, net: 0, d: 0 };
      kombo[key].net += r.net; kombo[key].d += r.d;
    });
    const list = Object.values(kombo).filter(k => k.d >= 5); // min 5 demet eşiği
    if (list.length > 0) {
      // En yüksek dm başı net
      const bestDbn = [...list].sort((a,b) => (b.net/b.d) - (a.net/a.d))[0];
      result.push({ type: "star", text: "Dm ba\u015F\u0131 en iyi: " + esc(bestDbn.c) + " \u2192 " + esc(bestDbn.s) + " (" + fmt(bestDbn.net/bestDbn.d) + "/dm)" });
      // En yüksek toplam net
      const bestNet = [...list].sort((a,b) => b.net - a.net)[0];
      if (bestNet.c !== bestDbn.c || bestNet.s !== bestDbn.s) {
        result.push({ type: "up", text: "Toplam en iyi: " + esc(bestNet.c) + " \u2192 " + esc(bestNet.s) + " (" + fmt(bestNet.net) + ")" });
      }
    }
  }
  return result.slice(0, 4);
}

// ═══════════════ BRANCH COMPARISON ═══════════════

function getBranchComp(filtered) {
  const m = {};
  filtered.forEach(r => {
    if (!m[r.c]) m[r.c] = {};
    if (!m[r.c][r.s]) m[r.c][r.s] = { ciro: 0, net: 0, d: 0 };
    m[r.c][r.s].ciro += r.ciro; m[r.c][r.s].net += r.net; m[r.c][r.s].d += r.d;
  });
  // Son 14 gün trend için
  const son14 = new Date(); son14.setDate(son14.getDate() - 14);
  const son14str = son14.toISOString().split("T")[0];
  const son7 = new Date(); son7.setDate(son7.getDate() - 7);
  const son7str = son7.toISOString().split("T")[0];

  return Object.entries(m).map(([flower, branches]) => {
    const brList = Object.entries(branches).map(([n, v]) => {
      const dbn = v.d > 0 ? v.net / v.d : 0;
      // Trend: son 7 gün vs önceki 7 gün
      const r1 = ALL_DATA.filter(r => r.c === flower && r.s === n && r.t >= son14str && r.t < son7str);
      const r2 = ALL_DATA.filter(r => r.c === flower && r.s === n && r.t >= son7str);
      const d1 = r1.reduce((s,r)=>s+r.d,0) > 0 ? r1.reduce((s,r)=>s+r.net,0)/r1.reduce((s,r)=>s+r.d,0) : 0;
      const d2 = r2.reduce((s,r)=>s+r.d,0) > 0 ? r2.reduce((s,r)=>s+r.net,0)/r2.reduce((s,r)=>s+r.d,0) : 0;
      const trend = d1 > 0 ? ((d2 - d1) / d1 * 100) : 0;
      return { name: n, ...v, dbn, avgP: v.d > 0 ? v.ciro / v.d : 0, trend };
    }).sort((a, b) => b.dbn - a.dbn);
    const toplamD = brList.reduce((s,b) => s+b.d, 0);
    return { flower, branches: brList, totalD: toplamD, branchCount: brList.length };
  }).sort((a, b) => b.totalD - a.totalD);
}

// ═══════════════ HEAT MAP DATA ═══════════════

function getHeatData(filtered) {
  const m = {};
  filtered.forEach(r => {
    const k = r.c + "|" + r.s;
    if (!m[k]) m[k] = { net: 0, d: 0, ciro: 0 };
    m[k].net += r.net; m[k].d += r.d; m[k].ciro += r.ciro;
  });
  const list = Object.entries(m).map(([k, v]) => {
    const p = k.split("|");
    return { cicek: p[0], sube: p[1], ...v, dbn: v.d > 0 ? v.net / v.d : 0, avgP: v.d > 0 ? v.ciro / v.d : 0 };
  });
  if (state.hmSort === "totalnet") list.sort((a, b) => b.net - a.net);
  else list.sort((a, b) => b.dbn - a.dbn);
  return list;
}

// ═══════════════ YEAR-OVER-YEAR ═══════════════

function getYoY(filtered) {
  const lyS = new Date(state.sd); lyS.setFullYear(lyS.getFullYear() - 1);
  const lyE = new Date(state.ed); lyE.setFullYear(lyE.getFullYear() - 1);
  const ls = lyS.toISOString().split("T")[0];
  const le = lyE.toISOString().split("T")[0];
  const lastD = ALL_DATA.filter(r => r.t >= ls && r.t <= le &&
    (!state.sf || (state.sf.startsWith("GRUP:") ? r.c.startsWith(state.sf.replace("GRUP:", "")) : r.c === state.sf)) &&
    (!state.sb || r.s === state.sb));

  // Totals - NET based
  const tN = filtered.reduce((s, r) => s + r.net, 0);
  const tD = filtered.reduce((s, r) => s + r.d, 0);
  const tA = tD > 0 ? tN / tD : 0; // net per demet
  const lN = lastD.reduce((s, r) => s + r.net, 0);
  const lDm = lastD.reduce((s, r) => s + r.d, 0);
  const lA = lDm > 0 ? lN / lDm : 0;

  // Per flower comparison
  const flowerMap = {};
  filtered.forEach(r => {
    if (!flowerMap[r.c]) flowerMap[r.c] = { thisNet: 0, thisD: 0, lastNet: 0, lastD: 0 };
    flowerMap[r.c].thisNet += r.net;
    flowerMap[r.c].thisD += r.d;
  });
  lastD.forEach(r => {
    if (!flowerMap[r.c]) flowerMap[r.c] = { thisNet: 0, thisD: 0, lastNet: 0, lastD: 0 };
    flowerMap[r.c].lastNet += r.net;
    flowerMap[r.c].lastD += r.d;
  });
  const flowers = Object.entries(flowerMap).map(([name, v]) => ({
    name,
    thisNet: v.thisNet, thisD: v.thisD,
    thisDbn: v.thisD > 0 ? v.thisNet / v.thisD : 0,
    lastNet: v.lastNet, lastD: v.lastD,
    lastDbn: v.lastD > 0 ? v.lastNet / v.lastD : 0,
    dbnDiff: (v.thisD > 0 ? v.thisNet / v.thisD : 0) - (v.lastD > 0 ? v.lastNet / v.lastD : 0),
    dbnPct: (v.lastD > 0 && v.thisD > 0) ? (((v.thisNet / v.thisD) - (v.lastNet / v.lastD)) / (v.lastNet / v.lastD) * 100) : null,
    demetDiff: v.thisD - v.lastD,
  })).sort((a, b) => Math.abs(b.dbnDiff) - Math.abs(a.dbnDiff));

  // Per branch comparison
  const branchMap = {};
  filtered.forEach(r => {
    if (!branchMap[r.s]) branchMap[r.s] = { thisNet: 0, thisD: 0, lastNet: 0, lastD: 0 };
    branchMap[r.s].thisNet += r.net;
    branchMap[r.s].thisD += r.d;
  });
  lastD.forEach(r => {
    if (!branchMap[r.s]) branchMap[r.s] = { thisNet: 0, thisD: 0, lastNet: 0, lastD: 0 };
    branchMap[r.s].lastNet += r.net;
    branchMap[r.s].lastD += r.d;
  });
  const branches = Object.entries(branchMap).map(([name, v]) => ({
    name,
    thisNet: v.thisNet, thisD: v.thisD,
    thisDbn: v.thisD > 0 ? v.thisNet / v.thisD : 0,
    lastNet: v.lastNet, lastD: v.lastD,
    lastDbn: v.lastD > 0 ? v.lastNet / v.lastD : 0,
    netDiff: v.thisNet - v.lastNet,
    netPct: v.lastNet > 0 ? ((v.thisNet - v.lastNet) / v.lastNet * 100) : null,
    dbnPct: (v.lastD > 0 && v.thisD > 0) ? (((v.thisNet/v.thisD)-(v.lastNet/v.lastD))/(v.lastNet/v.lastD)*100) : null,
  })).sort((a, b) => b.thisNet - a.thisNet);

  return {
    tN, tD, tA, lN, lD: lDm, lA,
    nCh: lN > 0 ? ((tN - lN) / lN * 100) : null,
    pCh: lA > 0 ? ((tA - lA) / lA * 100) : null,
    has: lastD.length > 0,
    flowers, branches
  };
}

// ═══════════════ MEZAT FİYAT SERİSİ (Paket 1 — saf görselleştirme/metrik katmanı) ═══════════════
// Mevcut EMA'lara (seasonal/forecast) ve hesap fonksiyonlarına DOKUNMAZ.
// Outlier'lar YALNIZCA işaretlenir — hiçbir hesaptan çıkarılmaz.
function getMezatSerisi(cicek, sube, sonN) {
  sonN = sonN || 30;
  const rows = ALL_DATA.filter(r => r.c === cicek && (!sube || r.s === sube));
  const gunMap = {};
  rows.forEach(r => {
    if (!gunMap[r.t]) gunMap[r.t] = { net: 0, d: 0, v2: false };
    gunMap[r.t].net += r.net; gunMap[r.t].d += r.d;
    if (r.costModel === "v2") gunMap[r.t].v2 = true;
  });
  const seri = Object.entries(gunMap)
    .map(([t, v]) => ({ t, dbn: v.d > 0 ? v.net / v.d : 0, d: v.d, v2: v.v2, outlier: false }))
    .filter(p => p.dbn > 0)
    .sort((a, b) => a.t.localeCompare(b.t))
    .slice(-sonN);
  const n = seri.length;
  const dbns = seri.map(p => p.dbn);

  // MAD outlier (Iglewicz-Hoaglin, |z|>3.5) — n≥7, MAD=0 ise test atlanır
  if (n >= 7) {
    const sorted = dbns.slice().sort((a, b) => a - b);
    const med = arr => arr.length % 2 ? arr[(arr.length - 1) / 2] : (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2;
    const M = med(sorted);
    const madSorted = dbns.map(x => Math.abs(x - M)).sort((a, b) => a - b);
    const MAD = med(madSorted);
    if (MAD > 0) {
      seri.forEach(p => { if (Math.abs(0.6745 * (p.dbn - M) / MAD) > 3.5) p.outlier = true; });
    }
  }

  // SMA_k — i < k-1 indekslerinde null (kısmi pencere hesaplanmaz)
  const smaArr = k => dbns.map((_, i) => {
    if (i < k - 1) return null;
    let s = 0; for (let j = i - k + 1; j <= i; j++) s += dbns[j];
    return s / k;
  });
  const sma = { 3: smaArr(3), 5: smaArr(5), 10: smaArr(10), 20: smaArr(20) };

  // EWMA — E[0] = ilk değer (sabit kural), alpha sabit (adaptif YOK)
  const ewmaArr = alpha => {
    if (n === 0) return [];
    const out = [dbns[0]];
    for (let i = 1; i < n; i++) out.push(alpha * dbns[i] + (1 - alpha) * out[i - 1]);
    return out;
  };
  const ewma = { fast: ewmaArr(0.35), mid: ewmaArr(0.18) };

  // Trend eğimi — son min(10,n) mezata OLS; n<6 → null; 6-9 → kısa seri etiketi
  let slope = null, slopeYon = null, slopeKisa = false;
  if (n >= 6) {
    const win = dbns.slice(-Math.min(10, n));
    const m = win.length; slopeKisa = m < 10;
    const xbar = (m - 1) / 2;
    const ybar = win.reduce((s, x) => s + x, 0) / m;
    let num = 0, den = 0;
    win.forEach((y, i) => { num += (i - xbar) * (y - ybar); den += (i - xbar) * (i - xbar); });
    slope = den > 0 ? num / den : 0;
    slopeYon = Math.abs(slope) < 0.005 * ybar ? "yatay" : slope > 0 ? "yükseliş" : "düşüş";
  }

  // Momentum ROC3 — n≥4; son nokta outlier ise uyarı
  let roc3 = null, roc3Uyari = false;
  if (n >= 4 && dbns[n - 4] > 0) {
    roc3 = (dbns[n - 1] - dbns[n - 4]) / dbns[n - 4] * 100;
    roc3Uyari = seri[n - 1].outlier;
  }

  // Volatilite CV — son min(10,n); n<6 → null
  let cv = null, cvKisa = false;
  if (n >= 6) {
    const w = dbns.slice(-Math.min(10, n)); cvKisa = w.length < 10;
    const mu = w.reduce((s, x) => s + x, 0) / w.length;
    const sd = Math.sqrt(w.reduce((s, x) => s + Math.pow(x - mu, 2), 0) / w.length);
    cv = mu > 0 ? sd / mu * 100 : null;
  }

  // Fan/yapı etiketi
  let fan = null;
  if (slopeYon !== null) {
    if (n >= 20) {
      const s3 = sma[3][n - 1], s5 = sma[5][n - 1], s10 = sma[10][n - 1], s20 = sma[20][n - 1];
      if (s3 > s5 && s5 > s10 && s10 > s20 && slopeYon === "yükseliş") fan = "güçlü yükseliş";
      else if (s3 < s5 && s5 < s10 && s10 < s20 && slopeYon === "düşüş") fan = "güçlü düşüş";
      else if (slopeYon === "yükseliş") fan = "zayıf yükseliş";
      else if (slopeYon === "düşüş") fan = "zayıf düşüş";
      else fan = "yatay/karışık";
    } else {
      fan = (slopeYon === "yatay" ? "yatay/karışık" : slopeYon) + " (kısa seri)";
    }
  }

  return { seri, sma, ewma, slope, slopeYon, slopeKisa, roc3, roc3Uyari, cv, cvKisa, fan, n };
}
