// ═══════════════ FILTERING & STATS ═══════════════

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
