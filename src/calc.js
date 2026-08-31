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
  // KURAL: banner'lar da ekran filtresine uyar (çiçek/grup + şube)
  const todayRecs = ALL_DATA.filter(r =>
    r.t === today &&
    (!state.sf || (state.sf.startsWith("GRUP:") ? r.c.startsWith(state.sf.replace("GRUP:", "")) : r.c === state.sf)) &&
    (!state.sb || r.s === state.sb)
  );
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

// ═══════════════ BUGÜNÜN ÖZETİ (Rapor Faz 0 — deterministik, AI yok) ═══════════════
// Kombo (çiçek×şube) Δnet katkıları: seçili dönem vs mezat-eşitlemeli önceki dönem.
// |katkı| < toplam |Δnet|'in %5'i → gürültü, cümleye girmez. 2-4 cümle; kıyas verisi yoksa null.
function getOzetCumleleri(filtered) {
  if (!filtered || filtered.length === 0) return null;
  const gunler = [...new Set(filtered.map(r => r.t))].sort();
  const N = gunler.length;
  // KURAL: tarih havuzu da ekran filtresiyle seçilir — filtreli evrenin mezat günleri kıyaslanır
  const ozFiltre = r =>
    (!state.sf || (state.sf.startsWith("GRUP:") ? r.c.startsWith(state.sf.replace("GRUP:", "")) : r.c === state.sf)) &&
    (!state.sb || r.s === state.sb);
  const prevDates = [...new Set(ALL_DATA.filter(r => r.t < gunler[0] && ozFiltre(r)).map(r => r.t))].sort().reverse().slice(0, Math.max(N, 1));
  const prevRows = ALL_DATA.filter(r => prevDates.includes(r.t) && ozFiltre(r));
  if (prevRows.length === 0) return null;

  const ekle = (map, r) => {
    const k = r.c + " → " + r.s;
    if (!map[k]) map[k] = { net: 0, d: 0 };
    map[k].net += r.net; map[k].d += r.d;
  };
  const simdi = {}, once = {};
  filtered.forEach(r => ekle(simdi, r));
  prevRows.forEach(r => ekle(once, r));

  let nowNet = 0, nowD = 0, prevNet = 0, prevD = 0;
  filtered.forEach(r => { nowNet += r.net; nowD += r.d });
  prevRows.forEach(r => { prevNet += r.net; prevD += r.d });
  const nowDbn = nowD > 0 ? nowNet / nowD : 0;
  const prevDbn = prevD > 0 ? prevNet / prevD : 0;

  const tumK = [...new Set(Object.keys(simdi).concat(Object.keys(once)))];
  const deltalar = tumK.map(k => ({ k, delta: (simdi[k] ? simdi[k].net : 0) - (once[k] ? once[k].net : 0) }));
  const toplamAbs = deltalar.reduce((s, x) => s + Math.abs(x.delta), 0);
  const esik = toplamAbs * 0.05;
  const anlamli = deltalar.filter(x => Math.abs(x.delta) >= esik && Math.abs(x.delta) > 0);
  const neg = anlamli.filter(x => x.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 2);
  const poz = anlamli.filter(x => x.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 2);

  const c = [];
  if (prevDbn > 0) {
    const ch = (nowDbn - prevDbn) / prevDbn * 100;
    c.push("Dm başı net önceki " + prevDates.length + " mezata göre %" + Math.abs(ch).toFixed(1) + (ch >= 0 ? " arttı" : " azaldı") + " (" + fmt2(prevDbn) + " → " + fmt2(nowDbn) + ").");
  }
  if (neg.length) c.push("En büyük düşüş katkısı: " + neg.map(x => x.k + " (" + fmt(x.delta) + ")").join(" ve ") + ".");
  if (poz.length) c.push("Pozitif ayrışan: " + poz.map(x => x.k + " (+" + fmt(x.delta) + ")").join(" ve ") + ".");
  const zarar = getZararFiltered();
  const v2o = getV2Ozet(filtered);
  if (zarar.length > 0) {
    c.push("⚠ Dönemde " + zarar.length + " zarar kaydı (−" + fmt(Math.abs(zarar.reduce((s, r) => s + r.net, 0))) + ") — tediye hesabına dahil, analize değil.");
  } else if (v2o.kesintiPct !== null && v2o.kesintiPct > 30) {
    c.push("⚠ Gerçek kesinti oranı %" + v2o.kesintiPct.toFixed(1) + " — küçük sevkiyat payını kontrol et.");
  }
  if (c.length < 2) return null;
  return c.slice(0, 4);
}

// ═══════════════ YÖNETİCİ ANALİZ RAPORU HESAPLARI (Rapor Faz 1) ═══════════════

// Rapor penceresi: üst tarih filtresinden BAĞIMSIZ, seçili çiçek/şube filtresi UYGULANIR.
// Son N mezat günü (d1) + önceki eşdeğer N mezat günü (d0), filtreli evrenin günlerinden.
function getYoneticiPencere(N) {
  const filtre = r =>
    (!state.sf || (state.sf.startsWith("GRUP:") ? r.c.startsWith(state.sf.replace("GRUP:", "")) : r.c === state.sf)) &&
    (!state.sb || r.s === state.sb);
  const rows = ALL_DATA.filter(filtre);
  const gunler = [...new Set(rows.map(r => r.t))].sort();
  const gun1 = gunler.slice(-N);
  const gun0 = gunler.slice(-2 * N, -N);
  const s1 = new Set(gun1), s0 = new Set(gun0);
  return {
    d1: rows.filter(r => s1.has(r.t)), d0: rows.filter(r => s0.has(r.t)),
    gun1, gun0,
    // Dönem-öncesi sınırı = DEĞERLENDİRME penceresinin (d1) ilk günü.
    // (Faz 1.1 düzeltmesi: d0[0] kullanmak, seyrek tarihçeli ürünlerde sınırı yıllarca
    // geriye itip P75 kümesini boşaltıyordu → kapasite ayarlı fırsat 0'a çöküyordu.
    // t < gun1[0] verisi d1'deki her gün için geçmiştir — walk-forward korunur.)
    oncesi: gun1.length ? gun1[0] : null
  };
}

// Gelir ayrıştırması: ΔGelir = Hacim + Fiyat + Mix + YeniÇıkan
// Yönetimsel attribution metriğidir; nedensel analiz değildir. Sonuç baz dönem seçimine duyarlıdır.
function decomposeGelir(d1Rows, d0Rows) {
  const grup = rows => {
    const m = {};
    rows.forEach(r => { if (!m[r.c]) m[r.c] = { q: 0, g: 0 }; m[r.c].q += r.d; m[r.c].g += r.net; });
    return m;
  };
  const u1 = grup(d1Rows), u0 = grup(d0Rows);
  const G1 = d1Rows.reduce((s, r) => s + r.net, 0), G0 = d0Rows.reduce((s, r) => s + r.net, 0);
  const Q1 = d1Rows.reduce((s, r) => s + r.d, 0), Q0 = d0Rows.reduce((s, r) => s + r.d, 0);
  const P0ort = Q0 > 0 ? G0 / Q0 : 0;
  const delta = G1 - G0;
  const hacim = (Q1 - Q0) * P0ort;

  let fiyat = 0, yeniCikan = 0;
  Object.keys(u1).forEach(c => {
    if (u0[c]) {
      const p1 = u1[c].q > 0 ? u1[c].g / u1[c].q : 0;
      const p0 = u0[c].q > 0 ? u0[c].g / u0[c].q : 0;
      fiyat += u1[c].q * (p1 - p0);
    } else {
      yeniCikan += u1[c].g;          // yeni ürün geliri (+)
    }
  });
  Object.keys(u0).forEach(c => { if (!u1[c]) yeniCikan -= u0[c].g; });  // çıkan ürün (−)
  const mix = delta - hacim - fiyat - yeniCikan;
  return {
    delta, hacim, fiyat, mix, yeniCikan, gelir1: G1, gelir0: G0,
    saglamaOK: Math.abs((hacim + fiyat + mix + yeniCikan) - delta) < 0.05
  };
}

// Relative Strength — kombo bazlı; gün şartı: o gün o üründe >=2 şube. Min 3 geçerli gün → yoksa null.
// Şube düzeyi RS de aynı gün-ürün gözlemlerinden demet ağırlıklı türetilir.
function getRS(rows) {
  const gunUrun = {};
  rows.forEach(r => {
    const k = r.t + "|" + r.c;
    if (!gunUrun[k]) gunUrun[k] = {};
    if (!gunUrun[k][r.s]) gunUrun[k][r.s] = { net: 0, d: 0 };
    gunUrun[k][r.s].net += r.net; gunUrun[k][r.s].d += r.d;
  });
  const komboAcc = {}, subeAcc = {};
  Object.keys(gunUrun).forEach(k => {
    const subeler = gunUrun[k];
    const adlar = Object.keys(subeler);
    if (adlar.length < 2) return;                       // tek şubeli gün atlanır
    let gNet = 0, gD = 0;
    adlar.forEach(s => { gNet += subeler[s].net; gD += subeler[s].d; });
    const genelDbn = gD > 0 ? gNet / gD : 0;
    if (genelDbn <= 0) return;
    const c = k.split("|")[1];
    adlar.forEach(s => {
      const v = subeler[s];
      const rsG = (v.d > 0 ? v.net / v.d : 0) / genelDbn;
      const kk = c + "|" + s;
      if (!komboAcc[kk]) komboAcc[kk] = { top: 0, d: 0, n: 0 };
      komboAcc[kk].top += rsG * v.d; komboAcc[kk].d += v.d; komboAcc[kk].n++;
      if (!subeAcc[s]) subeAcc[s] = { top: 0, d: 0, n: 0 };
      subeAcc[s].top += rsG * v.d; subeAcc[s].d += v.d; subeAcc[s].n++;
    });
  });
  const donustur = acc => {
    const out = {};
    Object.keys(acc).forEach(k => {
      const v = acc[k];
      out[k] = v.n >= 3 && v.d > 0 ? { rs: v.top / v.d, n: v.n } : null;
    });
    return out;
  };
  return { kombo: donustur(komboAcc), sube: donustur(subeAcc) };
}

// Value Index — şube bazlı GelirPayı% / HacimPayı%.
// SUNUM METRİĞİ — karar hesaplarına girmez; hiçbir skor fonksiyonuna bağlanmaz.
function getValueIndex(rows) {
  const G = rows.reduce((s, r) => s + r.net, 0), Q = rows.reduce((s, r) => s + r.d, 0);
  const m = {};
  rows.forEach(r => { if (!m[r.s]) m[r.s] = { g: 0, q: 0 }; m[r.s].g += r.net; m[r.s].q += r.d; });
  return Object.keys(m).map(s => {
    const gp = G > 0 ? m[s].g / G * 100 : 0;
    const hp = Q > 0 ? m[s].q / Q * 100 : 0;
    return { sube: s, gelirPay: gp, hacimPay: hp, vi: hp > 0 ? gp / hp : null, gelir: m[s].g, demet: m[s].q };
  }).sort((a, b) => b.gelir - a.gelir);
}

// Arz düzenliliği: pencere günleri içinde kombonun satış yaptığı gün oranı → "8/10 · %80"
function getArzDuzenlilik(cicek, sube, gunler) {
  if (!gunler || gunler.length === 0) return null;
  const set = new Set(gunler);
  const satisGun = new Set(ALL_DATA.filter(r => r.c === cicek && r.s === sube && set.has(r.t)).map(r => r.t)).size;
  return { satis: satisGun, toplam: gunler.length, oran: satisGun / gunler.length * 100 };
}

// Brüt Fiyat Fırsatı — ÇİFT DEĞER (kilitli karar #1).
// TEORİK: üst sınır. KAPASİTE AYARLI: en iyi şubenin dönem-öncesi P75 absorpsiyon tavanıyla.
// İlave hacmin aynı fiyattan emileceği garanti değildir — "kayıp" değil, fiyat farkı göstergesidir.
function getBrutFiyatFirsati(rows, oncesiTarih) {
  const gunUrun = {};
  rows.forEach(r => {
    const k = r.t + "|" + r.c;
    if (!gunUrun[k]) gunUrun[k] = {};
    if (!gunUrun[k][r.s]) gunUrun[k][r.s] = { net: 0, d: 0 };
    gunUrun[k][r.s].net += r.net; gunUrun[k][r.s].d += r.d;
  });
  // Dönem-öncesi P75 absorpsiyon (kombo günlük demetleri, t < oncesiTarih)
  const p75Cache = {};
  const p75Al = (c, s) => {
    const kk = c + "|" + s;
    if (p75Cache[kk] !== undefined) return p75Cache[kk];
    const gunluk = {};
    ALL_DATA.forEach(r => { if (r.c === c && r.s === s && r.t < oncesiTarih) gunluk[r.t] = (gunluk[r.t] || 0) + r.d; });
    const v = Object.values(gunluk).sort((a, b) => a - b);
    const p75 = v.length === 0 ? 0 : (v.length >= 4 ? v[Math.floor(v.length * 0.75)] : v[Math.floor((v.length - 1) / 2)]);
    p75Cache[kk] = p75;
    return p75;
  };

  let teorik = 0, ayarli = 0, tavanDevredeSayisi = 0;
  const komboAgg = {};
  Object.keys(gunUrun).forEach(k => {
    const subeler = gunUrun[k];
    const adlar = Object.keys(subeler);
    if (adlar.length < 2) return;                        // yalnız >=2 şubeli gün×ürünler
    const t = k.split("|")[0], c = k.split("|")[1];
    let enIyi = null;
    adlar.forEach(s => {
      const dbn = subeler[s].d > 0 ? subeler[s].net / subeler[s].d : 0;
      subeler[s].dbn = dbn;
      if (!enIyi || dbn > subeler[enIyi].dbn) enIyi = s;
    });
    const enIyiDbn = subeler[enIyi].dbn;
    let gunTeorik = 0, gunAyarli = 0;
    const digerler = adlar.filter(s => s !== enIyi && enIyiDbn > subeler[s].dbn);
    digerler.forEach(s => { gunTeorik += subeler[s].d * (enIyiDbn - subeler[s].dbn); });
    // Kapasite ayarlı: taşınabilir = max(0, P75 − en iyi şubede o gün zaten satılan)
    let tasinabilir = Math.max(0, p75Al(c, enIyi) - subeler[enIyi].d);
    const ucuzdanSirali = digerler.slice().sort((a, b) => subeler[a].dbn - subeler[b].dbn);
    let tasinacakToplam = 0;
    ucuzdanSirali.forEach(s => { tasinacakToplam += subeler[s].d; });
    if (tasinabilir < tasinacakToplam && digerler.length > 0) tavanDevredeSayisi++;
    ucuzdanSirali.forEach(s => {
      if (tasinabilir <= 0) return;
      const tasi = Math.min(subeler[s].d, tasinabilir);
      gunAyarli += tasi * (enIyiDbn - subeler[s].dbn);
      tasinabilir -= tasi;
    });
    teorik += gunTeorik;
    ayarli += gunAyarli;
    if (gunTeorik > 0) {
      const ka = c + "|" + enIyi;
      if (!komboAgg[ka]) komboAgg[ka] = { cicek: c, hedefSube: enIyi, teorik: 0, ayarli: 0, ornekGun: t, ornekTutar: 0 };
      komboAgg[ka].teorik += gunTeorik;
      komboAgg[ka].ayarli += gunAyarli;
      if (gunTeorik > komboAgg[ka].ornekTutar) { komboAgg[ka].ornekGun = t; komboAgg[ka].ornekTutar = gunTeorik; }
    }
  });
  const topKombolar = Object.values(komboAgg).sort((a, b) => b.teorik - a.teorik).slice(0, 3);
  return { teorik, ayarli, topKombolar, tavanDevredeSayisi };
}

// Medyan dbn: dönemdeki MEZAT GÜNÜ dbn'lerinin medyanı (satır bazlı değil)
function getMedyanGunlukDbn(rows) {
  const g = {};
  rows.forEach(r => { if (!g[r.t]) g[r.t] = { net: 0, d: 0 }; g[r.t].net += r.net; g[r.t].d += r.d; });
  const dbns = Object.values(g).filter(v => v.d > 0).map(v => v.net / v.d).sort((a, b) => a - b);
  if (dbns.length === 0) return null;
  return dbns.length % 2 ? dbns[(dbns.length - 1) / 2] : (dbns[dbns.length / 2 - 1] + dbns[dbns.length / 2]) / 2;
}

// ═══════════════ FAZ 1.1 — YÖNETİCİ SON KONTROL YARDIMCILARI ═══════════════

// İş 3: N_yeterli — pencere gününün yarısı (min 3). Gerekçe: raporlanabilir (n≥3)
// komboların medyan n'i 4 (10 mezatlık pencerede); "günlerin en az yarısında satış"
// kuralı 5 verir — medyanın hemen üstü ve 5/10/20 pencereyle ölçeklenir.
// Bu eşik YALNIZ rapor dilinde kullanılır — Planlayıcı karar motoruna GİRMEZ.
function getNYeterli(pencereGun) {
  return Math.max(3, Math.ceil((pencereGun || 10) / 2));
}

// İş 3: Veri güveni — 5 etiket, yeni skor DEĞİL, açıklanabilir kural.
// n<3 → kesin hüküm cümlesi ÜRETİLMEZ ("veri yetersiz").
function getVeriGuveni(n, rs, arzOran, pencereGun) {
  const N = getNYeterli(pencereGun);
  if (n == null || n < 3) return { etiket: "veri yetersiz", renk: [148, 163, 184], css: "#94a3b8" };
  if (n >= N) {
    if (rs != null && rs >= 1.10) {
      if (arzOran != null && arzOran < 30) return { etiket: "izlenmeli", renk: [100, 116, 139], css: "#94a3b8" }; // düzensiz arz → kanıtlanmış denmez
      return { etiket: "kanıtlanmış sinyal", renk: [22, 120, 74], css: "#34d399" };
    }
    if (rs != null && rs <= 0.90) return { etiket: "risk sinyali", renk: [220, 38, 38], css: "#f87171" };
    return { etiket: "izlenmeli", renk: [100, 116, 139], css: "#94a3b8" };
  }
  if (rs != null && rs >= 1.10) return { etiket: "keşif adayı", renk: [37, 99, 235], css: "#60a5fa" };
  return { etiket: "izlenmeli", renk: [100, 116, 139], css: "#94a3b8" };
}

// İş 7: Ortalama + medyan birlikte yorum. Eşikler sabit ve açık:
// geniş taban %5 · uç etki %10 · yatay %3. Koşul yoksa null (satır üretilmez).
function getOrtMedyanYorum(ort1, ort0, med1, med0) {
  if (!(ort1 > 0 && ort0 > 0 && med1 != null && med0 != null && med0 > 0)) return null;
  const oD = (ort1 - ort0) / ort0 * 100;
  const mD = (med1 - med0) / med0 * 100;
  if (Math.abs(oD) >= 5 && Math.abs(mD) >= 5 && oD * mD > 0)
    return "Fiyat değişimi geniş tabanlı (" + (oD > 0 ? "artış" : "düşüş") + ", ort %" + Math.abs(oD).toFixed(0) + " / medyan %" + Math.abs(mD).toFixed(0) + ") — tek tük uç satıştan değil.";
  if (oD >= 10 && Math.abs(mD) < 3)
    return "⚠ Ortalama sınırlı sayıda yüksek fiyatlı satışla yükselmiş olabilir — medyan yatay (ort +%" + oD.toFixed(0) + ", medyan %" + mD.toFixed(1) + ").";
  if (oD <= -10 && Math.abs(mD) < 3)
    return "⚠ Ortalama az sayıda düşük fiyatlı satışla düşmüş olabilir — medyan yatay (ort −%" + Math.abs(oD).toFixed(0) + ", medyan %" + mD.toFixed(1) + ").";
  return null;
}

// İş 5: Ürün×şube otomatik bulgular. Kriterler sabit ve açık — YALNIZ dbn ile seçim YASAK:
// güçlü = RS>1,05 + n≥N_yeterli + demet ≥ toplamın %3'ü + arz ≥ %60 + dbn ≥ genel ort
// zayıf = RS≤0,90 + n≥N_yeterli + demet ≥ %3 · keşif = RS≥1,10 + 3≤n<N_yeterli
function getKomboBulgulari(kombolar, rsKombo, gunler) {
  const N = getNYeterli(gunler.length);
  const topD = kombolar.reduce((s, k) => s + k.d, 0);
  const genelDbn = topD > 0 ? kombolar.reduce((s, k) => s + k.net, 0) / topD : 0;
  const zengin = kombolar.map(k => {
    const rsv = rsKombo[k.c + "|" + k.s];
    const arz = getArzDuzenlilik(k.c, k.s, gunler);
    return Object.assign({}, k, { rs: rsv ? rsv.rs : null, rsN: rsv ? rsv.n : null, arz: arz ? arz.oran : null });
  });
  const guclu = zengin.filter(k => k.rs != null && k.rs > 1.05 && k.n >= N && k.d >= topD * 0.03 && k.arz != null && k.arz >= 60 && k.dbn >= genelDbn)
    .sort((a, b) => b.rs - a.rs).slice(0, 3);
  const zayif = zengin.filter(k => k.rs != null && k.rs <= 0.90 && k.n >= N && k.d >= topD * 0.03)
    .sort((a, b) => a.rs - b.rs).slice(0, 3);
  const kesif = zengin.filter(k => k.rs != null && k.rs >= 1.10 && k.n >= 3 && k.n < N)
    .sort((a, b) => b.rs - a.rs).slice(0, 3);
  return { guclu, zayif, kesif };
}

// İş 2: 🧭 Yönetici Bulguları — deterministik, 4-6 madde, "Bulgu → İzleme önerisi" kalıbı.
// Bulgu ≠ Aksiyon: yalnız "yakından izle / kontrollü hacim testi değerlendir / Planlayıcı tahsisinde dikkat".
function getYoneticiBulgulari(yp) {
  const M = [];
  const d1 = yp.d1, d0 = yp.d0;
  if (!d1.length) return { maddeler: [], not: "" };
  const N = getNYeterli(yp.gun1.length);
  const isr = v => (v >= 0 ? "+" : "−") + fmt(Math.abs(v));

  const g1 = d1.reduce((s, r) => s + r.net, 0), q1 = d1.reduce((s, r) => s + r.d, 0);
  const g0 = d0.reduce((s, r) => s + r.net, 0), q0 = d0.reduce((s, r) => s + r.d, 0);
  const rs = getRS(d1);
  const vi = getValueIndex(d1);

  const komboM = {};
  d1.forEach(r => {
    const k = r.c + "|" + r.s;
    if (!komboM[k]) komboM[k] = { c: r.c, s: r.s, net: 0, d: 0, gunler: new Set() };
    komboM[k].net += r.net; komboM[k].d += r.d; komboM[k].gunler.add(r.t);
  });
  const kombolar = Object.values(komboM).map(k => Object.assign(k, { n: k.gunler.size, dbn: k.d > 0 ? k.net / k.d : 0 }));
  const kb = getKomboBulgulari(kombolar, rs.kombo, yp.gun1);

  // 1) Ana sürücü (İş 6) — yüzde payı YALNIZ tüm bileşenler aynı işaretliyse
  if (yp.gun1.length >= 3 && yp.gun0.length >= 3) {
    const dg = decomposeGelir(d1, d0);
    const bil = [["hacim", dg.hacim], ["fiyat", dg.fiyat], ["ürün karması", dg.mix], ["yeni/çıkan ürün", dg.yeniCikan]];
    const ana = bil.reduce((mx, b) => Math.abs(b[1]) > Math.abs(mx[1]) ? b : mx);
    const ayniIsaret = bil.every(b => b[1] >= 0) || bil.every(b => b[1] <= 0);
    const pay = (ayniIsaret && dg.delta !== 0) ? " · pay %" + Math.abs(ana[1] / dg.delta * 100).toFixed(0) : "";
    M.push({ etiket: "ayrıştırma", css: "#c4b5fd", renk: [168, 85, 247],
      bulgu: "Değişimin ana sürücüsü: " + ana[0] + " (" + isr(ana[1]) + pay + ")",
      izleme: "bileşen dengesini sonraki raporda yakından izle" });
  }

  // 2) Güçlü şube: kanıtlanmış + en yüksek RS + anlamlı hacim payı
  const subeAdaylar = vi.map(v => {
    const r = rs.sube[v.sube];
    return { v, r, g: getVeriGuveni(r ? r.n : null, r ? r.rs : null, null, yp.gun1.length) };
  });
  const guclüSube = subeAdaylar.filter(x => x.g.etiket === "kanıtlanmış sinyal" && x.v.hacimPay >= 10)
    .sort((a, b) => b.r.rs - a.r.rs)[0];
  if (guclüSube) M.push({ etiket: "kanıtlanmış sinyal", css: "#34d399", renk: [22, 120, 74],
    bulgu: guclüSube.v.sube + " şubesi piyasa üstü: RS " + guclüSube.r.rs.toFixed(2).replace(".", ",") + " (n=" + guclüSube.r.n + "), hacim payı %" + guclüSube.v.hacimPay.toFixed(0),
    izleme: "yakından izle" });

  // 3) Zayıf şube: risk sinyali
  const zayifSube = subeAdaylar.filter(x => x.g.etiket === "risk sinyali").sort((a, b) => a.r.rs - b.r.rs)[0];
  if (zayifSube) M.push({ etiket: "risk sinyali", css: "#f87171", renk: [220, 38, 38],
    bulgu: zayifSube.v.sube + " şubesi piyasa altı: RS " + zayifSube.r.rs.toFixed(2).replace(".", ",") + " (n=" + zayifSube.r.n + ")",
    izleme: "Planlayıcı tahsisinde dikkat" });

  // 4) Güçlü kombo (İş 5 — dbn+RS+n+demet+arz BİRLİKTE)
  if (kb.guclu.length) {
    const k = kb.guclu[0];
    M.push({ etiket: "kanıtlanmış sinyal", css: "#34d399", renk: [22, 120, 74],
      bulgu: k.c + " → " + k.s + " güçlü eşleşme: " + fmt(k.dbn) + "/dm, RS " + k.rs.toFixed(2).replace(".", ",") + " (n=" + k.n + "), arz %" + k.arz.toFixed(0),
      izleme: "yakından izle" });
  }
  // 5) Zayıf kombo
  if (kb.zayif.length) {
    const k = kb.zayif[0];
    M.push({ etiket: "risk sinyali", css: "#f87171", renk: [220, 38, 38],
      bulgu: k.c + " → " + k.s + " zayıf eşleşme: RS " + k.rs.toFixed(2).replace(".", ",") + " (n=" + k.n + ", " + k.d + " dm)",
      izleme: "Planlayıcı tahsisinde dikkat" });
  }
  // 6) Keşif adayı
  if (kb.kesif.length) {
    const k = kb.kesif[0];
    M.push({ etiket: "keşif adayı", css: "#60a5fa", renk: [37, 99, 235],
      bulgu: k.c + " → " + k.s + " olumlu erken sinyal: RS " + k.rs.toFixed(2).replace(".", ",") + " ama n=" + k.n + " düşük",
      izleme: "kontrollü hacim testi değerlendir" });
  }
  // 7) VI/RS rol ayrımı (İş 4): VI<0,95 ama RS 0,95–1,05 → şube "kötü" İLAN EDİLMEZ
  const viRsAyrim = subeAdaylar.find(x => x.v.vi !== null && x.v.vi < 0.95 && x.r && x.r.rs >= 0.95 && x.r.rs <= 1.05 && x.r.n >= N);
  if (viRsAyrim) M.push({ etiket: "izlenmeli", css: "#94a3b8", renk: [100, 116, 139],
    bulgu: viRsAyrim.v.sube + ": gelir payı hacim payının altında (VI " + viRsAyrim.v.vi.toFixed(2).replace(".", ",") + ") — ürün karması etkisi; fiyat performansı piyasayla uyumlu (RS " + viRsAyrim.r.rs.toFixed(2).replace(".", ",") + ", n=" + viRsAyrim.r.n + ")",
    izleme: "ürün karmasını yakından izle" });

  // 8) Ortalama-medyan uyumu (İş 7)
  const omy = getOrtMedyanYorum(q1 > 0 ? g1 / q1 : 0, q0 > 0 ? g0 / q0 : 0, getMedyanGunlukDbn(d1), getMedyanGunlukDbn(d0));
  if (omy) M.push({ etiket: "fiyat tabanı", css: "#fbbf24", renk: [202, 138, 4],
    bulgu: omy, izleme: "uç satış etkisini yakından izle" });

  return {
    maddeler: M.slice(0, 6),
    not: "Bu bulgular stratejik sinyaldir; günlük tahsis kararını Planlayıcı güncel veriyle verir."
  };
}
