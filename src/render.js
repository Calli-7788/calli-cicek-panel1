// ═══════════════ RENDER HELPERS ═══════════════
// ═══════ Mezat Fiyat Grafiği yardımcıları (Paket 1) ═══════
function mezatLegendToggle(key) {
  state.mezatLegend[key] = !state.mezatLegend[key];
  render();
}

function buildMezatChart(ms) {
  const vis = state.mezatLegend;
  const n = ms.n;
  const W = 360, PXL = 34, PXR = 8, PY = 8;
  const HP = 118;                 // fiyat alanı
  const HV = 26;                  // hacim mini-bandı (~%20, bağımsız ölçek)
  const XL = 14;                  // x etiket şeridi
  const H = HP + HV + XL;
  const xs = i => PXL + (n === 1 ? 0 : (i / (n - 1)) * (W - PXL - PXR));

  // Y ölçeği görünür katmanlardan
  let vals = ms.seri.map(p => p.dbn);
  if (vis.ewmaFast) vals = vals.concat(ms.ewma.fast);
  if (vis.ewmaMid) vals = vals.concat(ms.ewma.mid);
  [3, 5, 10, 20].forEach(k => { if (vis["sma" + k]) vals = vals.concat(ms.sma[k].filter(v => v !== null)); });
  const minV = Math.min.apply(null, vals) * 0.95;
  const maxV = Math.max.apply(null, vals) * 1.05;
  const range = maxV - minV || 1;
  const ys = v => PY + (HP - 2 * PY) - ((v - minV) / range) * (HP - 2 * PY);

  let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">`;

  // Yatay ızgara + y etiketleri
  [minV, (minV + maxV) / 2, maxV].forEach(v => {
    svg += `<line x1="${PXL}" y1="${ys(v)}" x2="${W - PXR}" y2="${ys(v)}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`;
    svg += `<text x="${PXL - 4}" y="${ys(v) + 3}" text-anchor="end" font-size="7" fill="#475569">${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(v)}</text>`;
  });

  // Hacim bandı (bağımsız ölçek)
  const maxD = Math.max.apply(null, ms.seri.map(p => p.d)) || 1;
  const barW = Math.max(2, Math.min(8, (W - PXL - PXR) / n * 0.55));
  ms.seri.forEach((p, i) => {
    const bh = Math.max(1, (p.d / maxD) * (HV - 4));
    svg += `<rect x="${xs(i) - barW / 2}" y="${HP + (HV - bh)}" width="${barW}" height="${bh}" fill="rgba(96,165,250,0.28)"><title>${fD(p.t)} · ${p.d} dm</title></rect>`;
  });
  svg += `<text x="${PXL - 4}" y="${HP + HV - 2}" text-anchor="end" font-size="6" fill="#475569">dm</text>`;

  // Null atlayan çizgi çizici (SMA'ların ilk k-1 noktası boş)
  const lineFrom = (arr, color, width, dash) => {
    let d = "", pen = false;
    arr.forEach((v, i) => {
      if (v === null || v === undefined) { pen = false; return; }
      d += (pen ? " L " : " M ") + xs(i).toFixed(1) + " " + ys(v).toFixed(1);
      pen = true;
    });
    return d ? `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}"${dash ? ' stroke-dasharray="' + dash + '"' : ''}/>` : "";
  };

  // Arkadan öne: SMA20, SMA10, SMA3, SMA5, EWMA orta, EWMA hızlı
  if (vis.sma20) svg += lineFrom(ms.sma[20], "#94a3b8", 1, "3,2");
  if (vis.sma10) svg += lineFrom(ms.sma[10], "#2dd4bf", 1, "3,2");
  if (vis.sma3) svg += lineFrom(ms.sma[3], "#f472b6", 1, "3,2");
  if (vis.sma5) svg += lineFrom(ms.sma[5], "#60a5fa", 1.2, "4,2");
  if (vis.ewmaMid) svg += lineFrom(ms.ewma.mid, "#a78bfa", 1.3);
  if (vis.ewmaFast) svg += lineFrom(ms.ewma.fast, "#fbbf24", 1.3);

  // Fiyat çizgisi + noktalar (v1: soluk içi boş · v2: dolu · outlier: kırmızı halka)
  if (vis.fiyat) {
    svg += lineFrom(ms.seri.map(p => p.dbn), "#34d399", 1.6);
    ms.seri.forEach((p, i) => {
      const tip = `${fD(p.t)} · ${fmt(p.dbn)}/dm · ${p.d} dm${p.outlier ? " · aykırı" : ""}${!p.v2 ? " · tahmini net (v1)" : ""}`;
      let dot;
      if (p.outlier) dot = `<circle cx="${xs(i)}" cy="${ys(p.dbn)}" r="4" fill="none" stroke="#f87171" stroke-width="1.5">`;
      else if (p.v2) dot = `<circle cx="${xs(i)}" cy="${ys(p.dbn)}" r="2.6" fill="#34d399">`;
      else dot = `<circle cx="${xs(i)}" cy="${ys(p.dbn)}" r="2.6" fill="none" stroke="rgba(52,211,153,0.45)" stroke-width="1.2">`;
      svg += dot + `<title>${tip}</title></circle>`;
    });
  }

  // X etiketleri: ilk / orta / son
  [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i).forEach(i => {
    svg += `<text x="${xs(i)}" y="${HP + HV + 10}" text-anchor="middle" font-size="7" fill="#475569">${fD(ms.seri[i].t)}</text>`;
  });

  svg += `</svg>`;
  return svg;
}

function buildLineChart(key, type) {
  // key = flower name or branch name, type = "c" for flower, "s" for branch
  const data = getFiltered().filter(r => r[type] === key);
  if (!data.length) return "";

  // Group by date
  const byDate = {};
  data.forEach(r => {
    if (!byDate[r.t]) byDate[r.t] = { net: 0, d: 0 };
    byDate[r.t].net += r.net;
    byDate[r.t].d += r.d;
  });
  const points = Object.entries(byDate)
    .map(([date, v]) => ({ date, dbn: v.d > 0 ? v.net / v.d : 0, d: v.d }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (points.length < 2) {
    return `<div style="padding:12px 0;font-size:11px;color:#64748b;text-align:center">Grafik için en az 2 günlük veri gerekli</div>`;
  }

  const W = 320, H = 100, PX = 30, PY = 10;
  const chartW = W - PX * 2, chartH = H - PY * 2;
  const vals = points.map(p => p.dbn);
  const minV = Math.min(...vals) * 0.95;
  const maxV = Math.max(...vals) * 1.05;
  const range = maxV - minV || 1;

  const getX = i => PX + (i / (points.length - 1)) * chartW;
  const getY = v => PY + chartH - ((v - minV) / range) * chartH;

  // Build SVG path
  let pathD = "";
  let areaD = "";
  const dots = [];
  points.forEach((p, i) => {
    const x = getX(i);
    const y = getY(p.dbn);
    if (i === 0) { pathD += `M ${x} ${y}`; areaD += `M ${x} ${H - PY}`; }
    else pathD += ` L ${x} ${y}`;
    areaD += ` L ${x} ${y}`;
    dots.push({ x, y, dbn: p.dbn, date: p.date, d: p.d });
  });
  areaD += ` L ${getX(points.length - 1)} ${H - PY} Z`;

  let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;margin-top:8px">`;
  // Area fill
  svg += `<path d="${areaD}" fill="url(#chartGrad)" opacity="0.3"/>`;
  svg += `<defs><linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#22c55e"/><stop offset="100%" stop-color="#22c55e" stop-opacity="0"/></linearGradient></defs>`;
  // Grid lines
  for (let i = 0; i <= 3; i++) {
    const y = PY + (i / 3) * chartH;
    const val = maxV - (i / 3) * range;
    svg += `<line x1="${PX}" y1="${y}" x2="${W - PX}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-width="0.5"/>`;
    svg += `<text x="${PX - 4}" y="${y + 3}" fill="#475569" font-size="7" text-anchor="end">${Math.round(val)}</text>`;
  }
  // Line
  svg += `<path d="${pathD}" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  // Dots + labels
  dots.forEach((d, i) => {
    svg += `<circle cx="${d.x}" cy="${d.y}" r="3" fill="#22c55e" stroke="#0b0e18" stroke-width="1.5"/>`;
    // Date labels (show first, last, and middle)
    if (i === 0 || i === dots.length - 1 || (dots.length > 4 && i === Math.floor(dots.length / 2))) {
      svg += `<text x="${d.x}" y="${H - 2}" fill="#475569" font-size="7" text-anchor="middle">${fD(d.date)}</text>`;
    }
    // Value on first and last
    if (i === 0 || i === dots.length - 1) {
      svg += `<text x="${d.x}" y="${d.y - 6}" fill="#34d399" font-size="8" font-weight="600" text-anchor="middle">${Math.round(d.dbn)}₺</text>`;
    }
  });
  svg += `</svg>`;

  // Summary below chart
  const first = points[0], last = points[points.length - 1];
  const change = first.dbn > 0 ? ((last.dbn - first.dbn) / first.dbn * 100) : 0;
  const totalD = points.reduce((s, p) => s + p.d, 0);

  let summary = `<div style="display:flex;justify-content:space-between;padding:6px 0 0;font-size:11px">`;
  summary += `<span style="color:#64748b">${points.length} gün · ${totalD} demet</span>`;
  summary += `<span style="color:${change > 0 ? '#34d399' : change < 0 ? '#f87171' : '#64748b'};font-weight:600">${change > 0 ? '▲ +' : '▼ '}${Math.abs(change).toFixed(1)}% dm başı net</span>`;
  summary += `</div>`;

  return svg + summary;
}

function toggleChart(type, name) {
  const key = type + ":" + name;
  setState({ chartOpen: state.chartOpen === key ? null : key });
}

// ═══════════════ MAIN RENDER ═══════════════
function render() {
  const filtered = getFiltered();
  const stats = calcStats(filtered);
  const dateLabel = state.sd !== state.ed ? fD(state.sd) + " – " + fD(state.ed) : fDF(state.sd);
  const today = new Date().toISOString().split("T")[0];
  const alerts = getAlerts(filtered);

  let html = "";

  // Header
  html += `<div class="header"><div class="header-row"><div><div style="font-size:10px;letter-spacing:2px;color:#475569;text-transform:uppercase">Çallı Çiçek</div><div style="font-size:19px;font-weight:700;color:#f8fafc">Üretici Paneli</div></div><div style="display:flex;align-items:center;gap:8px"><button onclick="refreshData()" style="width:32px;height:32px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#94a3b8;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center" title="Verileri yenile">↻</button><div class="logo">🌸</div></div></div></div>`;

  // V2 fallback uyarı bandı
  if (window.V2_LOAD_ERROR) {
    html += `<div style="padding:8px 20px;background:rgba(239,68,68,0.15);border-bottom:1px solid rgba(239,68,68,0.3);color:#fca5a5;font-size:12px;font-weight:600">⚠ Güncel V2 verisi yüklenemedi — 31 Temmuz sonrası veriler eksik</div>`;
  }

  // Alerts
  if (alerts.length > 0 && state.tab === "panel") {
    html += `<div style="padding:8px 20px;border-bottom:1px solid rgba(255,255,255,0.05)"><div class="alert-scroll">`;
    alerts.forEach(a => {
      const bg = a.type === "up" ? "rgba(34,197,94,0.1)" : a.type === "down" ? "rgba(239,68,68,0.1)" : "rgba(250,204,21,0.1)";
      const br = a.type === "up" ? "rgba(34,197,94,0.2)" : a.type === "down" ? "rgba(239,68,68,0.2)" : "rgba(250,204,21,0.2)";
      const cl = a.type === "up" ? "#6ee7b7" : a.type === "down" ? "#fca5a5" : "#fde68a";
      html += `<div class="alert-chip" style="background:${bg};border:1px solid ${br};color:${cl}">${a.type==="star"?"★ ":"▲ "}${a.text}</div>`;
    });
    html += `</div></div>`;
  }

  // Filters
  html += `<div class="filters">`;
  html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">`;
  html += `<div style="font-size:14px;font-weight:600;color:#e2e8f0">${dateLabel}</div>`;
  html += `<button class="filter-toggle ${state.fo?'open':''}" onclick="setState({fo:!state.fo,ddOpen:null})">${state.fo?'Kapat ✕':'Filtre ⚙'}</button>`;
  html += `</div>`;
  html += `<div class="presets" style="margin-bottom:${state.fo?'12px':'0'}">`;
  const presets = [["today","Bugün",state.sd===today&&state.ed===today],["week","7 Gün",false],["month","Bu Ay",false],["all","Tümü",false]];
  presets.forEach(([id,l,_]) => {
    html += `<button class="preset-btn ${_?'active':''}" onclick="setPreset('${id}')">${l}</button>`;
  });
  html += `<span style="flex:1"></span><span style="font-size:11px;color:#475569;align-self:center">${stats.cnt} kayıt</span></div>`;

  if (state.fo) {
    html += `<div style="display:flex;flex-direction:column;gap:10px">`;
    html += `<div style="display:flex;gap:10px"><div style="flex:1"><div class="lbl">Başlangıç</div><input type="date" class="date-input" value="${state.sd}" onchange="setState({sd:this.value})"></div><div style="flex:1"><div class="lbl">Bitiş</div><input type="date" class="date-input" value="${state.ed}" onchange="setState({ed:this.value})"></div></div>`;
    // Dropdowns
    html += `<div style="display:flex;gap:10px">`;
    html += renderDropdown("Çiçek", state.sf, "sf", true);
    html += renderDropdown("Şube", state.sb, "sb", false);
    html += `</div>`;
    if (state.sf || state.sb) {
      html += `<div style="display:flex;gap:6px;flex-wrap:wrap">`;
      if (state.sf) html += `<span class="filter-tag" style="background:rgba(34,197,94,0.12);color:#4ade80">${esc(state.sf.replace("GRUP:",""))}${state.sf.startsWith("GRUP:")?" (Grup)":""} <span class="x" onclick="setState({sf:null})">✕</span></span>`;
      if (state.sb) html += `<span class="filter-tag" style="background:rgba(96,165,250,0.12);color:#93c5fd">${esc(state.sb)} <span class="x" onclick="setState({sb:null})">✕</span></span>`;
      html += `</div>`;
    }
    html += `</div>`;
  }
  html += `</div>`;

  // Tabs
  const tabList = [{id:"panel",l:"Panel",i:"◉"},{id:"plan",l:"Planlayıcı",i:"🎯"},{id:"sube",l:"Şube Tablosu",i:"📋"},{id:"compare",l:"Karşılaştır",i:"⚡"},{id:"heat",l:"Kâr Haritası",i:"🔥"},{id:"tablo",l:"Tablo",i:"☰"},{id:"rapor",l:"Rapor",i:"📄"},{id:"ai",l:"AI",i:"✦"},{id:"yoy",l:"Geçen Yıl",i:"📊"},{id:"mevsim",l:"Mevsimsellik",i:"🗓"},{id:"cicekanaliz",l:"Çiçek Analiz",i:"🌷"},{id:"tahtrend",l:"Tahmin & Risk",i:"🔮"},{id:"gider",l:"Giderler",i:"💸"},{id:"tediye",l:"Tediye",i:"💰"}];
  html += `<div class="tabs">`;
  tabList.forEach(t => {
    html += `<button class="tab-btn ${state.tab===t.id?'active':''}" onclick="setState({tab:'${t.id}',ddOpen:null})">${t.i} ${t.l}</button>`;
  });
  html += `</div>`;

  html += `<div class="content">`;

  // ══ PANEL ══
  if (state.tab === "panel") {
    // Günün Özeti - sadece bugün seçiliyse veya bugünün verisi varsa göster
    const todayStr = new Date().toISOString().split("T")[0];
    const todayData = ALL_DATA.filter(r => r.t === todayStr);
    if (todayData.length > 0 && state.sd === todayStr) {
      const tNet = todayData.reduce((s,r) => s + r.net, 0);
      const tDem = todayData.reduce((s,r) => s + r.d, 0);
      const tAvg = tDem > 0 ? tNet / tDem : 0;
      // En iyi çiçek bugün
      const todayByF = {};
      todayData.forEach(r => {
        if (!todayByF[r.c]) todayByF[r.c] = { net: 0, d: 0 };
        todayByF[r.c].net += r.net; todayByF[r.c].d += r.d;
      });
      const bestF = Object.entries(todayByF).map(([n,v]) => ({ name:n, dbn: v.d>0?v.net/v.d:0, net:v.net, d:v.d })).sort((a,b) => b.dbn - a.dbn)[0];
      // En iyi şube bugün
      const todayByB = {};
      todayData.forEach(r => {
        if (!todayByB[r.s]) todayByB[r.s] = { net: 0, d: 0 };
        todayByB[r.s].net += r.net; todayByB[r.s].d += r.d;
      });
      const bestB = Object.entries(todayByB).map(([n,v]) => ({ name:n, net:v.net, d:v.d })).sort((a,b) => b.net - a.net)[0];
      // Dün ile karşılaştır
      const yestStr = new Date(Date.now() - 864e5).toISOString().split("T")[0];
      const yestData = ALL_DATA.filter(r => r.t === yestStr);
      const yNet = yestData.reduce((s,r) => s + r.net, 0);

      html += `<div class="card" style="background:linear-gradient(135deg,rgba(251,191,36,0.08),rgba(245,158,11,0.03));border-color:rgba(251,191,36,0.12);margin-bottom:14px;padding:16px">`;
      html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div style="font-size:15px;font-weight:700;color:#fbbf24">☀ Günün Özeti</div><div style="font-size:10px;color:#64748b">${fDF(todayStr)}</div></div>`;
      html += `<div style="font-size:13px;color:#e2e8f0;line-height:1.7">`;
      html += `Bugün <strong style="color:#4ade80">${fmt(tNet)}</strong> net gelir, <strong style="color:#f8fafc">${tDem}</strong> demet.`;
      if (yNet > 0) {
        const ch = ((tNet - yNet) / yNet * 100);
        html += ` Düne göre <span style="color:${ch>0?'#34d399':'#f87171'};font-weight:600">${ch>0?'+':''}${ch.toFixed(0)}%</span>.`;
      }
      html += `<br>`;
      if (bestF) html += `En kârlı çiçek: <strong style="color:#fbbf24">${esc(bestF.name)}</strong> (${fmt(bestF.dbn)}/dm). `;
      if (bestB) html += `En iyi şube: <strong style="color:#fbbf24">${esc(bestB.name)}</strong> (${fmt(bestB.net)} net).`;
      html += `</div></div>`;
    }

    // Önceki mezat dönemi hesapla (değişim yüzdeleri için)
    // KURAL: ekrandaki filtre (çiçek/grup + şube) kıyasa da AYNEN uygulanır — tarih havuzu dahil
    const prevMezatData = (function(){
      const filtre = r =>
        (!state.sf || (state.sf.startsWith("GRUP:") ? r.c.startsWith(state.sf.replace("GRUP:", "")) : r.c === state.sf)) &&
        (!state.sb || r.s === state.sb);
      const dates = [...new Set(ALL_DATA.filter(r => r.t < state.sd && filtre(r)).map(r => r.t))].sort().reverse();
      const gunSayisi = [...new Set(filtered.map(r => r.t))].length;
      const prevDates = dates.slice(0, Math.max(gunSayisi, 1));
      if (prevDates.length === 0) return null;
      const pd = ALL_DATA.filter(r => prevDates.includes(r.t) && filtre(r));
      const pNet = pd.reduce((s,r) => s+r.net, 0);
      const pD = pd.reduce((s,r) => s+r.d, 0);
      return { net: pNet, d: pD, dbn: pD > 0 ? pNet / pD : 0, ciro: pd.reduce((s,r) => s+r.ciro, 0) };
    })();
    const pChNet = prevMezatData && prevMezatData.net > 0 ? ((stats.tn - prevMezatData.net) / prevMezatData.net * 100) : null;
    const pChDbn = prevMezatData && prevMezatData.dbn > 0 ? ((stats.av - prevMezatData.dbn) / prevMezatData.dbn * 100) : null;
    const pChD = prevMezatData && prevMezatData.d > 0 ? ((stats.td - prevMezatData.d) / prevMezatData.d * 100) : null;

    html += `<div class="grid-2" style="margin-bottom:6px">`;
    html += `<div class="card card-green"><div class="lbl">Net Gelir</div><div class="val-big" style="color:#4ade80">${fmt(stats.tn)}</div>${pChNet!=null?'<div style="font-size:10px;color:'+(pChNet>=0?'#34d399':'#f87171')+'">önceki: '+(pChNet>=0?'+':'')+pChNet.toFixed(0)+'%</div>':''}</div>`;
    html += `<div class="card"><div class="lbl">Dm Başı Net</div><div class="val-big" style="color:#f8fafc">${fmt2(stats.av)}</div>${pChDbn!=null?'<div style="font-size:10px;color:'+(pChDbn>=0?'#34d399':'#f87171')+'">önceki: '+(pChDbn>=0?'+':'')+pChDbn.toFixed(0)+'%</div>':''}</div>`;
    html += `<div class="card"><div class="lbl">Demet</div><div class="val-big" style="color:#f8fafc">${stats.td}</div>${pChD!=null?'<div style="font-size:10px;color:'+(pChD>=0?'#34d399':'#f87171')+'">önceki: '+(pChD>=0?'+':'')+pChD.toFixed(0)+'%</div>':''}</div>`;
    html += `<div class="card"><div class="lbl">Brüt Ciro</div><div class="val-big" style="color:#94a3b8">${fmt(stats.tc)}</div></div>`;
    html += `</div>`;

    // V2 göstergeleri: gerçek kesinti oranı + zarar sayacı (sadece dönemde V2 verisi varsa)
    const v2Ozet = getV2Ozet(filtered);
    const zararF = getZararFiltered();
    if (v2Ozet.n > 0 || zararF.length > 0) {
      html += `<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">`;
      if (v2Ozet.kesintiPct !== null) {
        html += `<div style="flex:1;min-width:150px;padding:6px 10px;border-radius:8px;background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.15);display:flex;justify-content:space-between;align-items:center"><span style="font-size:10px;color:#c4b5fd">💸 Gerçek kesinti</span><span style="font-size:12px;font-weight:700;color:#c4b5fd">%${v2Ozet.kesintiPct.toFixed(1)}</span></div>`;
      }
      if (zararF.length > 0) {
        const zToplam = zararF.reduce((s, r) => s + r.net, 0);
        html += `<div style="flex:1;min-width:150px;padding:6px 10px;border-radius:8px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);display:flex;justify-content:space-between;align-items:center"><span style="font-size:10px;color:#fca5a5">⚠ ${zararF.length} zarar kaydı</span><span style="font-size:12px;font-weight:700;color:#f87171">−${fmt(Math.abs(zToplam))}</span></div>`;
      }
      html += `</div>`;
    }

    // Veri kalite göstergesi
    if (window._DATA_QUALITY) {
      const dq = window._DATA_QUALITY;
      const v2Bilgi = dq.v2 && dq.v2.satirSayisi > 0 ? ` · V2: ${dq.v2.satirSayisi} satır${dq.v2.saglamaGecmeyen === 0 ? " ✓" : " · ⚠ " + dq.v2.saglamaGecmeyen + " sağlama hatası"}` : "";
      html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px;margin-bottom:8px;border-radius:6px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04)">`;
      html += `<div style="font-size:8px;color:#475569">${new Intl.NumberFormat("tr-TR").format(dq.toplamKayit)} kayıt · ${new Intl.NumberFormat("tr-TR").format(dq.toplamDemet)} dm · Son veri: ${dq.enSonTarih}${v2Bilgi}</div>`;
      html += `<div style="font-size:8px;color:#475569">↻ ${dq.sonGuncelleme}</div>`;
      html += `</div>`;
    }

    if (stats.dl.length > 1) {
      const mx = Math.max(...stats.dl.map(x => x.net));
      html += `<div class="card" style="margin-top:16px;margin-bottom:6px"><div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:10px">Günlük Net</div><div style="display:flex;align-items:flex-end;gap:3px;height:65px">`;
      stats.dl.forEach(d => {
        const h = mx > 0 ? (d.net / mx) * 65 : 3;
        html += `<div style="flex:1;text-align:center"><div style="height:${Math.max(3,h)}px;border-radius:3px 3px 1px 1px;background:linear-gradient(to top,rgba(34,197,94,0.2),rgba(34,197,94,0.4));margin-bottom:3px"></div><div style="font-size:7px;color:#475569">${fD(d.date)}</div></div>`;
      });
      html += `</div></div>`;
    }

    if (stats.grpList.length > 1) {
      html += `<div class="sec-title">Çiçek Grubu</div>`;
      html += `<div class="grp-grid" style="grid-template-columns:repeat(${Math.min(stats.grpList.length,4)},1fr)">`;
      stats.grpList.forEach(g => {
        const payPct = stats.tn > 0 ? (g.net / stats.tn * 100) : 0;
        html += `<div class="card grp-card" onclick="setState({sf:'GRUP:${esc(g.name)}',fo:true})"><div style="font-size:11px;font-weight:600;color:#f8fafc;margin-bottom:4px">${esc(g.name)}</div><div style="font-size:14px;font-weight:800;color:#34d399">${fmt(g.net)}</div><div style="font-size:10px;color:#64748b;margin-top:2px">${g.d} dm · <span style="color:#fbbf24">%${payPct.toFixed(0)}</span></div></div>`;
      });
      html += `</div>`;
    }

    html += `<div class="sec-title">Demet Başı Net Sıralaması</div>`;
    const flowerShow = state.expanded.flowers ? 999 : 6;
    stats.byF.slice(0, flowerShow).forEach((f, i) => {
      const colors = ["#fbbf24","#cbd5e1","#c49a6c"];
      const bgs = ["rgba(250,204,21,0.15)","rgba(192,192,192,0.12)","rgba(205,127,50,0.12)"];
      const isChartOpen = state.chartOpen === "flower:" + f.name;
      const borderStyle = isChartOpen ? "border-color:rgba(34,197,94,0.2)" : "";
      html += `<div class="card" style="margin-bottom:6px;padding:12px 14px;cursor:pointer;${borderStyle}" onclick="toggleChart('flower','${esc(f.name)}')">`;
      html += `<div class="rank-item"><div style="display:flex;align-items:center;gap:8px"><div class="rank-num" style="background:${i<3?bgs[i]:'rgba(255,255,255,0.04)'};color:${i<3?colors[i]:'#64748b'}">${i+1}</div><div><div style="font-size:12px;font-weight:600;color:#f8fafc">${esc(f.name)}</div><div style="font-size:10px;color:#64748b">${f.d}dm · ${fmt(f.net)} net</div></div></div><div style="text-align:right;display:flex;align-items:center;gap:6px"><div><div style="font-size:14px;font-weight:700;color:#34d399">${fmt(f.dbn)}</div><div style="font-size:9px;color:#64748b">dm başı net</div></div><div style="font-size:10px;color:#475569">${isChartOpen?'▲':'▼'}</div></div></div>`;
      if (isChartOpen) {
        html += `<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06)">`;
        html += buildLineChart(f.name, "c");
        html += `</div>`;
      }
      html += `</div>`;
    });
    if (stats.byF.length > 6) html += `<button class="show-more" onclick="toggleExp('flowers')">${state.expanded.flowers?'Daha az ▲':'Tümü ('+stats.byF.length+') ▼'}</button>`;

    html += `<div class="sec-title">Şube Sıralaması</div>`;
    const brShow = state.expanded.branches ? 999 : 5;
    stats.byB.slice(0, brShow).forEach((b, i) => {
      const w = stats.byB[0]?.net > 0 ? (b.net / stats.byB[0].net) * 100 : 0;
      const isChartOpen = state.chartOpen === "branch:" + b.name;
      const borderStyle = isChartOpen ? "border-color:rgba(34,197,94,0.2)" : "";
      html += `<div class="card" style="margin-bottom:6px;padding:12px 14px;cursor:pointer;${borderStyle}" onclick="toggleChart('branch','${esc(b.name)}')">`;
      html += `<div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:13px;font-weight:600;color:#f8fafc">${esc(b.name)}</div><div style="font-size:10px;color:#64748b">${b.d}dm · ${fmt2(b.dbn)}/dm</div></div><div style="text-align:right;display:flex;align-items:center;gap:6px"><div style="font-size:13px;font-weight:700;color:#34d399">${fmt(b.net)}</div><div style="font-size:10px;color:#475569">${isChartOpen?'▲':'▼'}</div></div></div>`;
      html += `<div class="bar-bg"><div class="bar-fill" style="width:${w}%"></div></div>`;
      if (isChartOpen) {
        html += `<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06)">`;
        html += buildLineChart(b.name, "s");
        html += `</div>`;
      }
      html += `</div>`;
    });
    if (stats.byB.length > 5) html += `<button class="show-more" onclick="toggleExp('branches')">${state.expanded.branches?'Daha az ▲':'Tüm şubeler ('+stats.byB.length+') ▼'}</button>`;
  }

  // ══ PLANLAYICI ══
  if (state.tab === "plan") {
    html += `<div class="sec-title">🎯 Gönderim Planlayıcı</div>`;
    html += `<div style="font-size:12px;color:#94a3b8;margin-bottom:16px;margin-top:-6px">Kestiğin çiçekleri gir, AI en kârlı gönderim planını oluştursun</div>`;

    // Step 1: Add flowers
    html += `<div class="card" style="margin-bottom:12px">`;
    html += `<div style="font-size:13px;font-weight:600;color:#f8fafc;margin-bottom:10px">1. Çiçekleri Ekle</div>`;

    // Added flowers list
    state.planFlowers.forEach((pf, i) => {
      html += `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04)">`;
      html += `<div style="flex:1;font-size:13px;color:#e2e8f0">${esc(pf.name)}</div>`;
      html += `<div style="font-size:13px;color:#4ade80;font-weight:600">${pf.demet} dm</div>`;
      html += `<button onclick="removePlanFlower(${i})" style="width:24px;height:24px;border-radius:6px;border:none;background:rgba(239,68,68,0.15);color:#f87171;font-size:12px;cursor:pointer">✕</button>`;
      html += `</div>`;
    });

    // Add new flower form
    html += `<div style="display:flex;gap:8px;margin-top:10px">`;
    html += `<select id="planFlowerSelect" style="flex:1;padding:10px;border-radius:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#e5e7eb;font-size:12px"><option value="">Çiçek seç...</option>`;
    FLOWERS.forEach(f => {
      html += `<option value="${esc(f)}">${esc(f)}</option>`;
    });
    html += `</select>`;
    html += `<input id="planDemetInput" type="number" placeholder="Demet" style="width:70px;padding:10px;border-radius:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#e5e7eb;font-size:12px;text-align:center">`;
    html += `<button onclick="addPlanFlower()" style="padding:10px 14px;border-radius:10px;border:none;background:rgba(34,197,94,0.2);color:#4ade80;font-size:12px;font-weight:600;cursor:pointer">Ekle</button>`;
    html += `</div></div>`;

    // Step 2: Box size
    html += `<div class="card" style="margin-bottom:12px">`;
    html += `<div style="font-size:13px;font-weight:600;color:#f8fafc;margin-bottom:10px">2. Kutu Başına Demet</div>`;
    html += `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">`;
    [8, 10, 12, 20, 36, 40].forEach(n => {
      html += `<button onclick="setState({planBoxSize:${n}})" style="padding:8px 12px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:${state.planBoxSize===n?'700':'400'};background:${state.planBoxSize===n?'rgba(34,197,94,0.2)':'rgba(255,255,255,0.06)'};color:${state.planBoxSize===n?'#4ade80':'#94a3b8'}">${n}</button>`;
    });
    html += `<input id="customBoxSize" type="number" placeholder="Diğer" value="${[8,10,12,20,36,40].includes(state.planBoxSize)?'':state.planBoxSize}" onchange="setState({planBoxSize:parseInt(this.value)||8})" style="width:65px;padding:8px;border-radius:8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#e5e7eb;font-size:12px;text-align:center">`;
    html += `</div></div>`;

    // Step 3: Strategy
    html += `<div class="card" style="margin-bottom:12px">`;
    html += `<div style="font-size:13px;font-weight:600;color:#f8fafc;margin-bottom:10px">3. Gönderim Stratejisi</div>`;
    var strategies = [
      {id:"safe",l:"🛡 Güvenli",d:"Sert filtre: -%15 azalt, -%30 gönderme. Kanıtlanmış şubelere."},
      {id:"balanced",l:"⚖ Dengeli",d:"Orta filtre: -%25 azalt, -%40 gönderme. Dengeli dağılım."},
      {id:"aggressive",l:"🚀 Agresif",d:"Esnek filtre: -%35 azalt, -%50 gönderme. Risk alarak kazanç."},
    ];
    strategies.forEach(s => {
      html += `<div onclick="setState({planStrategy:'${s.id}'})" style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;cursor:pointer;margin-bottom:4px;background:${state.planStrategy===s.id?'rgba(34,197,94,0.1)':'transparent'};border:1px solid ${state.planStrategy===s.id?'rgba(34,197,94,0.2)':'rgba(255,255,255,0.04)'}">`;
      html += `<div style="width:18px;height:18px;border-radius:50%;border:2px solid ${state.planStrategy===s.id?'#4ade80':'#475569'};display:flex;align-items:center;justify-content:center">${state.planStrategy===s.id?'<div style="width:8px;height:8px;border-radius:50%;background:#4ade80"></div>':''}</div>`;
      html += `<div><div style="font-size:13px;color:${state.planStrategy===s.id?'#f8fafc':'#94a3b8'};font-weight:${state.planStrategy===s.id?'600':'400'}">${s.l}</div><div style="font-size:10px;color:#475569">${s.d}</div></div>`;
      html += `</div>`;
    });
    html += `</div>`;

    // Step 4: Branch Selection Mode
    html += `<div class="card" style="margin-bottom:14px">`;
    html += `<div style="font-size:13px;font-weight:600;color:#f8fafc;margin-bottom:10px">4. Şube Seçimi</div>`;
    var branchModes = [
      {id:"auto",l:"🤖 Otomatik",d:"AI en kârlı şubeleri kendisi seçsin (hepsine değil)"},
      {id:"manual",l:"📝 Manuel",d:"Ben istediğim şubeleri seçeyim"},
      {id:"explore",l:"🔍 Deneme",d:"Bilinen şubeler + geçmiş verilere göre yeni şube öner"}
    ];
    branchModes.forEach(m => {
      html += `<div onclick="setState({planBranchMode:'${m.id}'})" style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;cursor:pointer;margin-bottom:4px;background:${state.planBranchMode===m.id?'rgba(96,165,250,0.1)':'transparent'};border:1px solid ${state.planBranchMode===m.id?'rgba(96,165,250,0.2)':'rgba(255,255,255,0.04)'}">`;
      html += `<div style="width:18px;height:18px;border-radius:50%;border:2px solid ${state.planBranchMode===m.id?'#60a5fa':'#475569'};display:flex;align-items:center;justify-content:center">${state.planBranchMode===m.id?'<div style="width:8px;height:8px;border-radius:50%;background:#60a5fa"></div>':''}</div>`;
      html += `<div><div style="font-size:13px;color:${state.planBranchMode===m.id?'#f8fafc':'#94a3b8'};font-weight:${state.planBranchMode===m.id?'600':'400'}">${m.l}</div><div style="font-size:10px;color:#475569">${m.d}</div></div>`;
      html += `</div>`;
    });

    // Manual branch selector
    if (state.planBranchMode === "manual") {
      html += `<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06)">`;
      html += `<div style="font-size:11px;color:#64748b;margin-bottom:8px">Göndermek istediğin şubeleri seç:</div>`;
      html += `<div style="display:flex;flex-wrap:wrap;gap:6px">`;
      BRANCHES.forEach(b => {
        var isSelected = state.planManualBranches.includes(b);
        html += `<button onclick="togglePlanBranch('${esc(b)}')" style="padding:6px 12px;border-radius:8px;border:1px solid ${isSelected?'rgba(96,165,250,0.3)':'rgba(255,255,255,0.08)'};background:${isSelected?'rgba(96,165,250,0.15)':'transparent'};color:${isSelected?'#93c5fd':'#64748b'};font-size:11px;cursor:pointer;font-weight:${isSelected?'600':'400'}">${isSelected?'✓ ':''}${esc(b)}</button>`;
      });
      html += `</div>`;
      if (state.planManualBranches.length > 0) {
        html += `<div style="margin-top:8px;font-size:11px;color:#60a5fa">${state.planManualBranches.length} şube seçildi</div>`;
      }
      html += `</div>`;
    }

    // Explore info
    if (state.planBranchMode === "explore") {
      html += `<div style="margin-top:10px;padding:10px;border-radius:8px;background:rgba(250,204,21,0.06);border:1px solid rgba(250,204,21,0.12)">`;
      html += `<div style="font-size:11px;color:#fbbf24;line-height:1.5">💡 Deneme modu: AI kârlı şubelere ana dağılımı yapar + geçmiş yıl verilerine bakarak potansiyelli ama az denenen şubelere 1-2 kutu deneme gönderimi önerir.</div>`;
      html += `</div>`;
    }
    html += `</div>`;

    // Generate button
    var canGenerate = state.planFlowers.length > 0;
    html += `<button onclick="handlePlan()" ${canGenerate?'':'disabled'} style="width:100%;padding:14px;border-radius:12px;border:none;cursor:${canGenerate?'pointer':'not-allowed'};font-size:14px;font-weight:600;background:${canGenerate?'linear-gradient(135deg,#7c3aed,#6d28d9)':'rgba(255,255,255,0.06)'};color:${canGenerate?'#fff':'#475569'};margin-bottom:14px">${state.planLoading?'Analiz ediliyor...':'🎯 Gönderim Planı Oluştur'}</button>`;

    // Result
    if (state.planResult) {
      // Tahmini net gelir kartı — DAĞILIM BAZLI (marjinal tahsis)
      if (state.planTahminiNet > 0) {
        var atananDm = (state.planDagilim || []).reduce(function(s,x){return s+x.demet},0);
        var atananKutu = (state.planDagilim || []).reduce(function(s,x){return s+x.kutu},0);
        var avgPerDm = atananDm > 0 ? state.planTahminiNet / atananDm : 0;
        html += `<div class="card" style="background:rgba(168,85,247,0.08);border-color:rgba(168,85,247,0.15);margin-bottom:10px;padding:14px">`;
        html += `<div style="display:flex;justify-content:space-between;align-items:center">`;
        html += `<div><div style="font-size:10px;color:#a78bfa;text-transform:uppercase;letter-spacing:0.5px">🔮 Tahmini Net Gelir (dağılım bazlı)</div><div style="font-size:22px;font-weight:800;color:#c4b5fd;margin-top:2px">${fmt(state.planTahminiNet)}</div></div>`;
        html += `<div style="text-align:right"><div style="font-size:10px;color:#64748b">${atananKutu} kutu · ${atananDm} dm atandı</div><div style="font-size:10px;color:#64748b">Ort: ${fmt(avgPerDm)}/dm</div></div>`;
        html += `</div>`;
        html += `<div style="margin-top:8px;font-size:10px;color:#475569">Σ (kombo demeti × katmanlı skor × doygunluk). Strateji cezası atama önceliğini belirler, tahmine karışmaz — kalibrasyon motor isabetini ölçer.</div>`;
        html += `</div>`;
      }

      // Dağılım tablosu (motor çıktısı — kesin)
      if (state.planDagilim && state.planDagilim.length > 0) {
        html += `<div class="card" style="margin-bottom:10px;padding:0;overflow:hidden;overflow-x:auto">`;
        html += `<div style="font-size:13px;font-weight:700;color:#f8fafc;padding:12px 14px 8px">📋 Dağılım Tablosu</div>`;
        html += `<table style="width:100%;border-collapse:collapse;font-size:10px;min-width:420px">`;
        html += `<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08)">`;
        ["Çiçek","Şube","Kutu","Demet","₺/dm","Tah. Net","Güven"].forEach(function(h,hi){
          html += `<th style="padding:6px ${hi===0?'14px':'6px'};text-align:${hi<2?'left':'right'};color:#64748b;font-size:8px;text-transform:uppercase;font-weight:600">${h}</th>`;
        });
        html += `</tr></thead><tbody>`;
        state.planDagilim.forEach(function(x){
          var gRenk = x.guven === "yüksek" ? "#34d399" : x.guven === "orta" ? "#fbbf24" : "#f87171";
          html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.03);${x.kesifKutusu?'background:rgba(250,204,21,0.04)':''}">`;
          html += `<td style="padding:6px 14px;color:#cbd5e1">${esc(x.cicek)}${x.kesifKutusu?' <span style="font-size:8px;color:#fbbf24">🔍</span>':''}</td>`;
          html += `<td style="padding:6px;color:#f8fafc;font-weight:500">${esc(x.sube)}</td>`;
          html += `<td style="padding:6px;text-align:right;color:#94a3b8">${x.kutu}</td>`;
          html += `<td style="padding:6px;text-align:right;color:#e2e8f0">${x.demet}</td>`;
          html += `<td style="padding:6px;text-align:right;color:#a78bfa;font-weight:600">${fmt(x.tahminiDbn)}</td>`;
          html += `<td style="padding:6px;text-align:right;color:#34d399;font-weight:600">${fmt(x.tahminiNet)}</td>`;
          html += `<td style="padding:6px;text-align:right;color:${gRenk};font-size:9px">${x.guven}</td>`;
          html += `</tr>`;
        });
        html += `</tbody></table></div>`;
      }

      // Beklet bölümü (açıkça)
      if (state.planBeklet && state.planBeklet.length > 0) {
        html += `<div class="card" style="margin-bottom:10px;background:rgba(250,204,21,0.06);border-color:rgba(250,204,21,0.15)">`;
        html += `<div style="font-size:12px;font-weight:700;color:#fbbf24;margin-bottom:6px">⏸ Beklet</div>`;
        state.planBeklet.forEach(function(bk){
          html += `<div style="font-size:11px;color:#e2e8f0;padding:3px 0">${esc(bk.cicek)}: <strong>${bk.demet} dm</strong> — ${esc(bk.sebep)}</div>`;
        });
        html += `<div style="font-size:10px;color:#94a3b8;margin-top:6px">Bu demetler için kârlı kapasite bulunamadı — ertesi mezata bekletmeyi veya düşük fiyatı bilinçli kabul etmeyi değerlendir.</div>`;
        html += `</div>`;
      }

      html += `<div class="card" style="background:rgba(34,197,94,0.06);border-color:rgba(34,197,94,0.12)">`;
      html += `<div style="font-size:14px;font-weight:700;color:#4ade80;margin-bottom:10px">📦 Gönderim Planı</div>`;
      var resultHTML = esc(state.planResult).replace(/\*\*(.*?)\*\*/g, '<strong style="color:#f8fafc">$1</strong>').replace(/\n/g, '<br>');
      html += `<div style="font-size:13px;color:#e2e8f0;line-height:1.7">${resultHTML}</div>`;
      html += `</div>`;

      // Action buttons
      html += `<div style="display:flex;gap:8px;margin-top:8px">`;
      html += `<button onclick="savePlan()" style="flex:1;padding:10px;border-radius:10px;border:none;background:rgba(168,85,247,0.2);color:#c4b5fd;font-size:12px;cursor:pointer;font-weight:600">💾 Kaydet</button>`;
      html += `<button onclick="planPDF()" style="flex:1;padding:10px;border-radius:10px;border:none;background:rgba(34,197,94,0.15);color:#6ee7b7;font-size:12px;cursor:pointer;font-weight:600">📄 PDF Çıktı</button>`;
      html += `<button onclick="copyPlan()" style="flex:1;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:#94a3b8;font-size:12px;cursor:pointer">📋 Kopyala</button>`;
      html += `</div>`;
    }

    // ── 📏 Kalibrasyon panosu (kapalı accordion) ──
    html += `<div class="card" style="margin-top:24px;margin-bottom:8px;padding:0;overflow:hidden">`;
    html += `<div onclick="toggleExp('kalibrasyon')" style="padding:12px 14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center"><span style="font-size:13px;font-weight:700;color:#f8fafc">📏 Kalibrasyon</span><span style="font-size:10px;color:#475569">${state.expanded.kalibrasyon ? '▲' : '▼'}</span></div>`;
    if (state.expanded.kalibrasyon) {
      var kal = getKalibrasyon();
      html += `<div style="padding:0 14px 12px">`;
      if (kal.yetersiz) {
        html += `<div style="font-size:11px;color:#94a3b8;text-align:center;padding:10px 0">Henüz yeterli plan yok (n=${kal.n}). Plan kaydet, mezat sonrası tahmin/gerçek isabeti burada birikecek.</div>`;
      } else {
        html += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">`;
        html += `<div style="padding:8px;border-radius:8px;background:rgba(255,255,255,0.03);text-align:center"><div style="font-size:8px;color:#64748b">MAE (₺)</div><div style="font-size:14px;font-weight:800;color:#f8fafc">${fmt(kal.mae)}</div></div>`;
        html += `<div style="padding:8px;border-radius:8px;background:rgba(255,255,255,0.03);text-align:center"><div style="font-size:8px;color:#64748b">MAPE</div><div style="font-size:14px;font-weight:800;color:#f8fafc">%${kal.mape.toFixed(1)}</div></div>`;
        html += `<div style="padding:8px;border-radius:8px;background:rgba(168,85,247,0.08);text-align:center"><div style="font-size:8px;color:#64748b">Bias</div><div style="font-size:14px;font-weight:800;color:${Math.abs(kal.bias) <= 10 ? '#34d399' : '#fbbf24'}">${kal.bias > 0 ? '+' : ''}%${kal.bias.toFixed(1)}</div><div style="font-size:7px;color:#475569">${kal.bias > 0 ? 'fazla tahmin' : 'az tahmin'}</div></div>`;
        html += `</div>`;
        html += `<div style="font-size:9px;color:#64748b;margin-bottom:8px">n=${kal.n} plan · Bias + = tahmin gerçeğin üstünde</div>`;
        // Motor nesli kıyası — klasik vs marjinal (vurgulu)
        var mk = kal.motorlar.klasik, mm = kal.motorlar.marjinal;
        var kiyasVar = !mk.yetersiz && !mm.yetersiz;
        var kazanan = kiyasVar ? (mm.mape < mk.mape ? "marjinal" : mm.mape > mk.mape ? "klasik" : null) : null;
        html += `<div style="font-size:10px;font-weight:700;color:#c4b5fd;margin-bottom:4px">⚙ Motor Nesli Kıyası</div>`;
        html += `<div style="display:flex;gap:6px;margin-bottom:${kiyasVar ? '6px' : '8px'}">`;
        [["klasik","Klasik"],["marjinal","Marjinal"]].forEach(function(m){
          var mv = kal.motorlar[m[0]];
          var kazandiMi = kazanan === m[0];
          html += `<div style="flex:1;padding:6px 8px;border-radius:8px;background:${kazandiMi ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.02)'};border:1px solid ${kazandiMi ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.05)'}"><div style="font-size:9px;color:${kazandiMi ? '#6ee7b7' : '#94a3b8'};font-weight:600">${kazandiMi ? '🏆 ' : ''}${m[1]} <span style="color:#475569">(n=${mv.n})</span></div>`;
          if (mv.yetersiz) html += `<div style="font-size:9px;color:#475569">n≥3 gerekli</div>`;
          else html += `<div style="font-size:10px;color:#e2e8f0">MAPE %${mv.mape.toFixed(1)} · Bias ${mv.bias > 0 ? '+' : ''}%${mv.bias.toFixed(1)}</div>`;
          html += `</div>`;
        });
        html += `</div>`;
        if (kiyasVar) {
          var mapeFark = Math.abs(mk.mape - mm.mape);
          html += `<div style="font-size:9px;color:${kazanan ? '#6ee7b7' : '#94a3b8'};margin-bottom:8px">${kazanan ? (kazanan === 'marjinal' ? 'Marjinal motor' : 'Klasik motor') + ' ' + mapeFark.toFixed(1) + ' puan daha isabetli (MAPE)' : 'İki motor eşit isabette'}</div>`;
        }
        // Çiçek / şube bias listeleri
        [["Çiçek bazlı bias", kal.cicekBias], ["Şube bazlı bias", kal.subeBias]].forEach(function(bl){
          if (bl[1].length === 0) {
            html += `<div style="font-size:9px;color:#475569;margin-bottom:6px">${bl[0]}: yeterli kombo gözlemi yok (n≥5 gerekli)</div>`;
          } else {
            html += `<div style="font-size:10px;font-weight:600;color:#94a3b8;margin-bottom:4px">${bl[0]} (en sapmalı)</div>`;
            bl[1].forEach(function(b){
              html += `<div style="display:flex;justify-content:space-between;font-size:10px;padding:2px 0"><span style="color:#cbd5e1">${esc(b.ad)} <span style="color:#475569">(n=${b.n})</span></span><span style="color:${Math.abs(b.bias) <= 10 ? '#34d399' : Math.abs(b.bias) <= 25 ? '#fbbf24' : '#f87171'};font-weight:600">${b.bias > 0 ? '+' : ''}%${b.bias.toFixed(1)}</span></div>`;
            });
            html += `<div style="margin-bottom:6px"></div>`;
          }
        });
      }
      html += `</div>`;
    }
    html += `</div>`;

    // ── 🔬 Kapalı Evren Backtesti (Paket 2 — kapalı accordion) ──
    html += `<div class="card" style="margin-bottom:8px;padding:0;overflow:hidden">`;
    html += `<div onclick="toggleExp('backtest')" style="padding:12px 14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center"><span style="font-size:13px;font-weight:700;color:#f8fafc">🔬 Kapalı Evren Backtesti</span><span style="font-size:10px;color:#475569">${state.expanded.backtest ? '▲' : '▼'}</span></div>`;
    if (state.expanded.backtest) {
      html += `<div style="padding:0 14px 12px">`;

      // Pencere sekmeleri + mod anahtarı + Çalıştır
      html += `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px;align-items:center">`;
      [["v2", "V2 dönemi"], ["60", "Son 60 mezat"]].forEach(function(p) {
        var akt = state.btPencere === p[0];
        html += `<button onclick="setState({btPencere:'${p[0]}'})" style="padding:4px 10px;border-radius:6px;border:1px solid ${akt ? '#7c3aed' : 'rgba(255,255,255,0.08)'};background:${akt ? 'rgba(124,58,237,0.2)' : 'transparent'};color:${akt ? '#c4b5fd' : '#94a3b8'};font-size:10px;cursor:pointer;font-weight:${akt ? '700' : '400'}">${p[1]}</button>`;
      });
      html += `<span style="width:1px;height:16px;background:rgba(255,255,255,0.1)"></span>`;
      [["tavanli", "Tavanlı"], ["tavansiz", "Tavansız"]].forEach(function(md) {
        var akt = state.btMod === md[0];
        html += `<button onclick="setState({btMod:'${md[0]}'})" style="padding:4px 10px;border-radius:6px;border:1px solid ${akt ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.08)'};background:${akt ? 'rgba(34,197,94,0.12)' : 'transparent'};color:${akt ? '#6ee7b7' : '#94a3b8'};font-size:10px;cursor:pointer;font-weight:${akt ? '700' : '400'}">${md[1]}</button>`;
      });
      html += `<span style="flex:1"></span>`;
      html += `<button onclick="btCalistir()" ${state.btKosuyor ? 'disabled' : ''} style="padding:5px 14px;border-radius:8px;border:none;background:${state.btKosuyor ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg,#7c3aed,#6d28d9)'};color:${state.btKosuyor ? '#475569' : '#fff'};font-size:10px;cursor:${state.btKosuyor ? 'wait' : 'pointer'};font-weight:600">${state.btKosuyor ? 'Hesaplanıyor…' : '▶ Çalıştır'}</button>`;
      html += `</div>`;

      var btC = btCacheOku(state.btPencere + "|" + state.btMod);
      if (!btC) {
        html += `<div style="font-size:11px;color:#64748b;text-align:center;padding:14px 0">Henüz koşum yok — ▶ Çalıştır ile ${state.btPencere === "v2" ? "V2 dönemi" : "son 60 mezat"} backtesti hesaplanır (iki mod birden cache'lenir).</div>`;
      } else {
        var bt = btC.sonuc;
        // Cache rozeti
        html += `<div style="display:flex;justify-content:space-between;font-size:8px;color:#475569;margin-bottom:8px"><span>${bt.gunSayisi} gün · ${bt.cicekSayisi} çiçek · ${bt.sure_ms} ms</span><span>${btC.guncel ? '✓ güncel' : '⚠ güncel değil — veriler değişti, yeniden çalıştır'} · ${new Date(btC.zaman).toLocaleString("tr-TR")}</span></div>`;

        // Özet kart — 5 model
        var mAd = { A1: "A1 — Saf fiyat", A0: "A0 — Gerçekçi taban", B: "B — Recency", C: "C — Kapasite", D: "D — Mevcut motor" };
        html += `<div style="border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:8px 10px;margin-bottom:8px">`;
        html += `<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0"><span style="color:#94a3b8">Gerçek</span><span style="color:#e2e8f0;font-weight:700">${fmt(bt.gercekNet)} · ${fmt2(bt.gercekDbn)}/dm</span></div>`;
        ["A1", "A0", "B", "C", "D"].forEach(function(m) {
          var mv = bt.modeller[m];
          html += `<div style="display:flex;justify-content:space-between;font-size:10px;padding:3px 0;border-top:1px solid rgba(255,255,255,0.03)">`;
          html += `<span style="color:${m === 'D' ? '#c4b5fd' : '#94a3b8'};font-weight:${m === 'D' ? '700' : '400'}">${mAd[m]}${m === 'A1' ? ' <span style="font-size:8px;color:#475569">(operasyonel değil)</span>' : ''}</span>`;
          html += `<span style="color:${mv.upliftTL >= 0 ? '#34d399' : '#f87171'};font-weight:600">${fmt(mv.simNet)} <span style="font-size:9px">(${mv.upliftPct >= 0 ? '+' : ''}%${mv.upliftPct.toFixed(1)})</span></span>`;
          html += `</div>`;
        });
        // Pratik değer satırı
        html += `<div style="margin-top:6px;padding:6px 8px;border-radius:8px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);font-size:10px;color:#6ee7b7">💼 Pratik değer — Model D vs A0: <strong>${bt.pratik.DvsA0.tl >= 0 ? '+' : ''}${fmt(bt.pratik.DvsA0.tl)} (${bt.pratik.DvsA0.pct >= 0 ? '+' : ''}%${bt.pratik.DvsA0.pct.toFixed(1)})</strong> · C vs A0: ${bt.pratik.CvsA0.tl >= 0 ? '+' : ''}${fmt(bt.pratik.CvsA0.tl)} (${bt.pratik.CvsA0.pct >= 0 ? '+' : ''}%${bt.pratik.CvsA0.pct.toFixed(1)})</div>`;
        html += `</div>`;

        // Ablation merdiveni A1→B→C→D
        html += `<div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:4px">Ablation Merdiveni (A1→B→C→D)</div>`;
        var abMax = Math.max.apply(null, ["A1", "B", "C", "D"].map(function(m) { return Math.abs(bt.modeller[m].upliftPct) })) || 1;
        [["A1", "Saf fiyat"], ["B", "+Recency"], ["C", "+Kapasite"], ["D", "+Risk ayarı"]].forEach(function(mm) {
          var pct = bt.modeller[mm[0]].upliftPct;
          html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px"><span style="width:70px;font-size:9px;color:#cbd5e1">${mm[1]}</span><div style="flex:1;height:10px;background:rgba(255,255,255,0.03);border-radius:5px;overflow:hidden"><div style="height:100%;width:${Math.min(100, Math.abs(pct) / abMax * 100)}%;background:${pct >= 0 ? 'linear-gradient(90deg,#7c3aed,#a855f7)' : '#f87171'};border-radius:5px"></div></div><span style="width:55px;text-align:right;font-size:9px;color:${pct >= 0 ? '#34d399' : '#f87171'};font-weight:600">${pct >= 0 ? '+' : ''}%${pct.toFixed(1)}</span></div>`;
        });
        html += `<div style="font-size:8px;color:#475569;margin-bottom:8px">Katman katkıları: B−A1 ${bt.ablation.BvsA1.tl >= 0 ? '+' : ''}${fmt(bt.ablation.BvsA1.tl)} · C−B ${bt.ablation.CvsB.tl >= 0 ? '+' : ''}${fmt(bt.ablation.CvsB.tl)} · D−C ${bt.ablation.DvsC.tl >= 0 ? '+' : ''}${fmt(bt.ablation.DvsC.tl)}</div>`;

        // Win/ort/medyan/en kötü + rolling-10
        html += `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">`;
        [["Win rate", "%" + bt.winRate.toFixed(0)], ["Ort. gün", fmt(bt.ortUplift)], ["Medyan gün", fmt(bt.medyanUplift)], ["En kötü", bt.enKotu ? fD(bt.enKotu.t) + " " + fmt(bt.enKotu.uplift) : "—"], ["Rolling-10", bt.rolling10Guncel !== null ? fmt(bt.rolling10Guncel) : "n<10"]].forEach(function(k) {
          html += `<div style="flex:1;min-width:86px;padding:5px 7px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05)"><div style="font-size:7px;color:#64748b;text-transform:uppercase">${k[0]}</div><div style="font-size:10px;font-weight:700;color:#e2e8f0">${k[1]}</div></div>`;
        });
        html += `</div>`;

        // Rolling-10 mini çizgi
        if (bt.rolling10.length >= 2) {
          var rW = 330, rH = 36;
          var rVals = bt.rolling10.map(function(x) { return x.deger });
          var rMin = Math.min.apply(null, rVals), rMax = Math.max.apply(null, rVals);
          var rRange = (rMax - rMin) || 1;
          var rPts = bt.rolling10.map(function(x, i) { return (i / (bt.rolling10.length - 1) * (rW - 10) + 5).toFixed(1) + "," + (rH - 5 - (x.deger - rMin) / rRange * (rH - 10)).toFixed(1) }).join(" ");
          html += `<div style="font-size:8px;color:#64748b;margin-bottom:2px">Rolling-10 uplift (D)</div><svg viewBox="0 0 ${rW} ${rH}" style="width:100%;height:auto;display:block;margin-bottom:8px"><polyline points="${rPts}" fill="none" stroke="#a855f7" stroke-width="1.4"/></svg>`;
        }

        // Günlük seri (D vs gerçek) — son 15 + genişlet
        html += `<div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:4px">Günlük Seri (D vs Gerçek)</div>`;
        var gSeri = state.expanded.btGunluk ? bt.gunluk : bt.gunluk.slice(-15);
        html += `<div style="overflow-x:auto;margin-bottom:4px"><table style="width:100%;border-collapse:collapse;font-size:9px;min-width:300px">`;
        html += `<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08)"><th style="padding:3px;text-align:left;color:#64748b;font-size:8px">Gün</th><th style="padding:3px;text-align:right;color:#64748b;font-size:8px">Gerçek</th><th style="padding:3px;text-align:right;color:#64748b;font-size:8px">D Sim</th><th style="padding:3px;text-align:right;color:#64748b;font-size:8px">Uplift</th></tr></thead><tbody>`;
        gSeri.forEach(function(g) {
          html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.03)"><td style="padding:3px;color:#94a3b8">${fD(g.t)}</td><td style="padding:3px;text-align:right;color:#cbd5e1">${fmt(g.gercek)}</td><td style="padding:3px;text-align:right;color:#c4b5fd">${fmt(g.sim.D)}</td><td style="padding:3px;text-align:right;color:${g.upliftD >= 0 ? '#34d399' : '#f87171'};font-weight:600">${g.upliftD >= 0 ? '+' : ''}${fmt(g.upliftD)}</td></tr>`;
        });
        html += `</tbody></table></div>`;
        if (bt.gunluk.length > 15) html += `<button class="show-more" onclick="toggleExp('btGunluk')" style="margin-bottom:8px">${state.expanded.btGunluk ? 'Daha az ▲' : 'Tüm günler (' + bt.gunluk.length + ') ▼'}</button>`;

        // Çiçek kırılımı (n zorunlu)
        html += `<div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:4px">Çiçek Kırılımı</div>`;
        html += `<div style="overflow-x:auto;margin-bottom:8px"><table style="width:100%;border-collapse:collapse;font-size:9px;min-width:300px">`;
        html += `<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08)"><th style="padding:3px;text-align:left;color:#64748b;font-size:8px">Çiçek</th><th style="padding:3px;text-align:right;color:#64748b;font-size:8px">n</th><th style="padding:3px;text-align:right;color:#64748b;font-size:8px">Gerçek ₺/dm</th><th style="padding:3px;text-align:right;color:#64748b;font-size:8px">D ₺/dm</th><th style="padding:3px;text-align:right;color:#64748b;font-size:8px">Uplift</th></tr></thead><tbody>`;
        bt.cicekKirilim.forEach(function(k) {
          html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.03)"><td style="padding:3px;color:#cbd5e1">${esc(k.cicek)}</td><td style="padding:3px;text-align:right;color:#94a3b8">${k.n}</td><td style="padding:3px;text-align:right;color:#e2e8f0">${fmt2(k.gercekDbn)}</td><td style="padding:3px;text-align:right;color:#c4b5fd">${fmt2(k.simDbn)}</td><td style="padding:3px;text-align:right;color:${k.upliftPct >= 0 ? '#34d399' : '#f87171'};font-weight:600">${k.upliftPct >= 0 ? '+' : ''}%${k.upliftPct.toFixed(0)}</td></tr>`;
        });
        html += `</tbody></table></div>`;

        // Drill-down: en iyi / en kötü 3 gün
        html += `<div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:4px">Drill-down</div>`;
        [["enIyi", "🏆 En iyi"], ["enKotu", "⚠ En kötü"]].forEach(function(dd) {
          bt.drill[dd[0]].forEach(function(g, gi) {
            var key = "btDrill_" + dd[0] + gi;
            html += `<div onclick="toggleExp('${key}')" style="display:flex;justify-content:space-between;padding:4px 6px;border-radius:6px;background:rgba(255,255,255,0.02);margin-bottom:2px;cursor:pointer;font-size:9px"><span style="color:#cbd5e1">${dd[1]} · ${fD(g.t)}</span><span style="color:${g.uplift >= 0 ? '#34d399' : '#f87171'};font-weight:600">${g.uplift >= 0 ? '+' : ''}${fmt(g.uplift)} ${state.expanded[key] ? '▲' : '▼'}</span></div>`;
            if (state.expanded[key]) {
              html += `<div style="overflow-x:auto;margin-bottom:4px"><table style="width:100%;border-collapse:collapse;font-size:8px;min-width:300px">`;
              html += `<thead><tr><th style="padding:2px;text-align:left;color:#64748b;font-size:7px">Çiçek</th><th style="padding:2px;text-align:left;color:#64748b;font-size:7px">Şube</th><th style="padding:2px;text-align:right;color:#64748b;font-size:7px">Gerçek dm</th><th style="padding:2px;text-align:right;color:#64748b;font-size:7px">D dm</th><th style="padding:2px;text-align:right;color:#64748b;font-size:7px">₺/dm</th></tr></thead><tbody>`;
              g.detay.forEach(function(dt) {
                html += `<tr style="border-top:1px solid rgba(255,255,255,0.03)"><td style="padding:2px;color:#94a3b8">${esc(dt.c)}</td><td style="padding:2px;color:#cbd5e1">${esc(dt.sube)}</td><td style="padding:2px;text-align:right;color:#e2e8f0">${dt.gercekD}</td><td style="padding:2px;text-align:right;color:#c4b5fd">${Math.round(dt.simD * 10) / 10}</td><td style="padding:2px;text-align:right;color:#34d399">${fmt(dt.dbn)}</td></tr>`;
              });
              html += `</tbody></table></div>`;
            }
          });
        });

        // Alt sınır notu
        html += `<div style="font-size:8px;color:#475569;margin-top:8px;line-height:1.5">ℹ Kapalı evren + naive varsayım: rakamlar potansiyel üst sınırdır; model kıyası (göreli) daha güvenilirdir. Yeni şube keşfinin değerini ölçmez. Tavanlı mod: gözlenen talebin en fazla ${window.BT_TAVAN_K} katının aynı fiyattan emilebildiği varsayımı. Tavansız mod teorik üst sınırdır.${state.btPencere === "60" ? " Son 60 mezat penceresinin v1 kısmı %20 tahmini net içerir." : ""}</div>`;
      }

      // 🎛 Tavan Duyarlılık Analizi (bağımsız bölüm — yalnız V2 penceresinde koşar)
      html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;margin-bottom:4px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.05)">`;
      html += `<span style="font-size:10px;font-weight:700;color:#94a3b8">🎛 Tavan Duyarlılık Analizi <span style="font-size:8px;color:#475569;font-weight:400">(yalnız V2 penceresi)</span></span>`;
      html += `<button onclick="btDuyarlilikCalistir()" ${state.btDuyarKosuyor ? 'disabled' : ''} style="padding:4px 10px;border-radius:6px;border:1px solid rgba(168,85,247,0.3);background:${state.btDuyarKosuyor ? 'rgba(255,255,255,0.04)' : 'rgba(168,85,247,0.12)'};color:${state.btDuyarKosuyor ? '#475569' : '#c4b5fd'};font-size:9px;cursor:${state.btDuyarKosuyor ? 'wait' : 'pointer'};font-weight:600">${state.btDuyarKosuyor ? 'Hesaplanıyor…' : 'Duyarlılığı Çalıştır'}</button>`;
      html += `</div>`;
      var duyC = btCacheOku("v2|duyarlilik");
      if (!duyC) {
        html += `<div style="font-size:9px;color:#64748b;margin-bottom:4px">Henüz koşulmadı — k ∈ {1.0, 1.5, 2.0, 2.5, 3.0} + tavansız (6 koşum, ~4 sn).</div>`;
      } else {
        html += `<div style="font-size:7px;color:#475569;margin-bottom:3px">${duyC.guncel ? '✓ güncel' : '⚠ güncel değil — veriler değişti'} · ${new Date(duyC.zaman).toLocaleString("tr-TR")}</div>`;
        html += `<div style="overflow-x:auto;margin-bottom:4px"><table style="width:100%;border-collapse:collapse;font-size:9px;min-width:320px">`;
        html += `<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08)"><th style="padding:3px;text-align:left;color:#64748b;font-size:8px">k</th><th style="padding:3px;text-align:right;color:#64748b;font-size:8px">D uplift %</th><th style="padding:3px;text-align:right;color:#64748b;font-size:8px">D vs A0</th><th style="padding:3px;text-align:right;color:#64748b;font-size:8px">B uplift %</th></tr></thead><tbody>`;
        duyC.sonuc.satirlar.forEach(function(s) {
          var kAd = s.k === null ? "Tavansız" : s.k.toFixed(1) + (s.k === 1.0 ? " (referans)" : "");
          html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.03)">`;
          html += `<td style="padding:3px;color:#cbd5e1;font-weight:${s.k === null ? '400' : '600'}">${kAd}</td>`;
          html += `<td style="padding:3px;text-align:right;color:${s.Dpct >= 0 ? '#34d399' : '#f87171'};font-weight:600">${s.Dpct >= 0 ? '+' : ''}%${s.Dpct.toFixed(1)}</td>`;
          html += `<td style="padding:3px;text-align:right;color:${s.DvsA0tl >= 0 ? '#34d399' : '#f87171'}">${s.DvsA0tl >= 0 ? '+' : ''}${fmt(s.DvsA0tl)} (${s.DvsA0pct >= 0 ? '+' : ''}%${s.DvsA0pct.toFixed(1)})</td>`;
          html += `<td style="padding:3px;text-align:right;color:#94a3b8">${s.Bpct >= 0 ? '+' : ''}%${s.Bpct.toFixed(1)}</td>`;
          html += `</tr>`;
        });
        html += `</tbody></table></div>`;
        var dArr = duyC.sonuc.satirlar.map(function(s) { return s.Dpct });
        html += `<div style="font-size:8px;color:#64748b">D uplift aralığı: ${Math.min.apply(null, dArr) >= 0 ? '+' : ''}%${Math.min.apply(null, dArr).toFixed(1)} – +%${Math.max.apply(null, dArr).toFixed(1)}</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;

    // Saved Plans & Comparison
    var savedPlans = JSON.parse(localStorage.getItem("savedPlans") || "[]");
    if (savedPlans.length > 0) {
      html += `<div class="sec-title" style="margin-top:24px">📊 Kayıtlı Planlar ve Sonuçlar</div>`;
      savedPlans.slice().reverse().slice(0, state.expanded.allPlans ? 999 : 3).forEach(function(plan, idx) {
        var realIdx = savedPlans.length - 1 - idx;
        // Plan tarihinden sonraki 1-3 gün içindeki en yakın mezat gününü ara
        // (Bugün plan yapılır → yarın/öbür gün mezatta satılır)
        var actualData = [];
        var actualDate = null;
        for (var dayOffset = 1; dayOffset <= 3; dayOffset++) {
          var checkDate = new Date(plan.date + "T00:00:00");
          checkDate.setDate(checkDate.getDate() + dayOffset);
          var checkStr = checkDate.toISOString().split("T")[0];
          var dayData = ALL_DATA.filter(function(r){ return r.t === checkStr });
          if (dayData.length > 0) { actualData = dayData; actualDate = checkStr; break; }
        }
        // Aynı gün verisi de kontrol et (belki aynı gün satıldı)
        if (actualData.length === 0) {
          actualData = ALL_DATA.filter(function(r){ return r.t === plan.date });
          if (actualData.length > 0) actualDate = plan.date;
        }
        var hasActual = actualData.length > 0;

        html += `<div class="card" style="margin-bottom:8px;padding:12px 14px">`;
        html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">`;
        html += `<div><div style="font-size:13px;font-weight:600;color:#f8fafc">${fDF(plan.date)}</div>`;
        html += `<div style="font-size:10px;color:#64748b">${plan.flowers.map(function(f){return f.name+":"+f.demet+"dm"}).join(", ")} · ${plan.strategy}</div></div>`;
        html += `<button onclick="deletePlan(${realIdx})" style="background:none;border:none;color:#475569;font-size:12px;cursor:pointer">✕</button>`;
        html += `</div>`;

        if (plan.estimatedNet) {
          html += `<div style="display:flex;gap:12px;padding:6px 0">`;
          html += `<div><div style="font-size:9px;color:#64748b">Tahmini Net</div><div style="font-size:14px;font-weight:700;color:#a78bfa">${fmt(plan.estimatedNet)}</div></div>`;

          if (hasActual) {
            // Sadece planlanan çiçeklerin gerçekleşen net geliri
            var actualNet = 0;
            var actualDemet = 0;
            plan.flowers.forEach(function(pf) {
              var flowerActual = actualData.filter(function(r){ return r.c === pf.name });
              actualNet += flowerActual.reduce(function(s,r){return s+r.net},0);
              actualDemet += flowerActual.reduce(function(s,r){return s+r.d},0);
            });
            // Günün toplam net geliri (tüm çiçekler)
            var dayTotalNet = actualData.reduce(function(s,r){return s+r.net},0);

            var diff = actualNet - plan.estimatedNet;
            var diffPct = plan.estimatedNet > 0 ? (diff / plan.estimatedNet * 100) : 0;

            html += `<div><div style="font-size:9px;color:#64748b">Gerçekleşen${actualDate && actualDate !== plan.date ? ' ('+fD(actualDate)+')' : ''}</div><div style="font-size:14px;font-weight:700;color:#4ade80">${fmt(actualNet)}</div><div style="font-size:9px;color:#475569">planlanan çiçekler</div></div>`;
            html += `<div><div style="font-size:9px;color:#64748b">Fark</div><div style="font-size:14px;font-weight:700;color:${diff>=0?'#34d399':'#f87171'}">${diff>=0?'+':''}${fmt(diff)} (${diffPct>=0?'+':''}${diffPct.toFixed(0)}%)</div></div>`;
            html += `</div>`;
            if (dayTotalNet > actualNet) {
              html += `<div style="font-size:11px;color:#64748b;padding:4px 0;border-top:1px solid rgba(255,255,255,0.04);margin-top:4px">Günün toplam net: <span style="color:#4ade80;font-weight:600">${fmt(dayTotalNet)}</span> <span style="color:#475569">(tüm çiçekler)</span></div>`;
            }
            // Plana uyum sorusu (kalibrasyon için kayda işlenir)
            var uyumSecim = plan.gerceklesen && plan.gerceklesen.uyum;
            html += `<div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-top:1px solid rgba(255,255,255,0.04);margin-top:4px">`;
            html += `<span style="font-size:10px;color:#64748b">Plana uyuldu mu?</span>`;
            [["evet","Evet","#34d399"],["kismen","Kısmen","#fbbf24"],["hayir","Hayır","#f87171"]].forEach(function(u){
              var aktif = uyumSecim === u[0];
              html += `<button onclick="setPlanUyum(${realIdx},'${u[0]}')" style="padding:3px 10px;border-radius:6px;font-size:10px;cursor:pointer;border:1px solid ${aktif?u[2]:'rgba(255,255,255,0.1)'};background:${aktif?u[2]+'22':'transparent'};color:${aktif?u[2]:'#94a3b8'};font-weight:${aktif?'700':'400'}">${u[1]}</button>`;
            });
            html += `</div>`;
          } else {
            html += `<div><div style="font-size:9px;color:#64748b">Gerçekleşen</div><div style="font-size:12px;color:#475569">Henüz veri yok</div></div>`;
          }
          html += `</div>`;
        }

        // Toggle details
        if (state.expanded["plan_"+realIdx]) {
          // Çiçek × şube kırılım tablosu (plan vs gerçek)
          var kir = hasActual ? buildGerceklesenKirilim(plan) : null;
          if (kir && kir.kirilim.length > 0) {
            html += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.04)">`;
            html += `<div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px">Kırılım — plan vs gerçek (${fD(kir.eslesmeTarihi)})</div>`;
            html += `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:9px;min-width:380px">`;
            html += `<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08)">`;
            ["Çiçek","Şube","Plan dm","Tah. ₺/dm","Gerçek dm","Ger. ₺/dm","Fiyat Δ%"].forEach(function(h,hi){
              html += `<th style="padding:4px 4px;text-align:${hi<2?'left':'right'};color:#64748b;font-size:8px;font-weight:600">${h}</th>`;
            });
            html += `</tr></thead><tbody>`;
            kir.kirilim.forEach(function(k){
              var fh = k.fiyatHatasiPct;
              html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.03)">`;
              html += `<td style="padding:4px;color:#cbd5e1">${esc(k.cicek)}</td>`;
              html += `<td style="padding:4px;color:#cbd5e1">${esc(k.sube)}</td>`;
              html += `<td style="padding:4px;text-align:right;color:#94a3b8">${k.planDemet != null ? k.planDemet : '—'}</td>`;
              html += `<td style="padding:4px;text-align:right;color:#a78bfa">${k.tahminiDbn != null ? fmt(k.tahminiDbn) : '—'}</td>`;
              html += `<td style="padding:4px;text-align:right;color:#e2e8f0">${k.gercekDemet}</td>`;
              html += `<td style="padding:4px;text-align:right;color:#34d399">${k.gercekDbn > 0 ? fmt(k.gercekDbn) : '—'}</td>`;
              html += `<td style="padding:4px;text-align:right;color:${fh == null ? '#475569' : Math.abs(fh) <= 10 ? '#34d399' : Math.abs(fh) <= 25 ? '#fbbf24' : '#f87171'}">${fh != null ? (fh > 0 ? '+' : '') + fh.toFixed(0) + '%' : '—'}</td>`;
              html += `</tr>`;
            });
            html += `</tbody></table></div></div>`;
          }
          var detailHTML = esc(plan.result).replace(/\*\*(.*?)\*\*/g, '<strong style="color:#f8fafc">$1</strong>').replace(/\n/g, '<br>');
          html += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.04);font-size:11px;color:#94a3b8;max-height:60vh;overflow-y:auto;-webkit-overflow-scrolling:touch">${detailHTML}</div>`;
          html += `<button onclick="savedPlanPDF(${realIdx})" style="margin-top:6px;padding:6px 12px;border-radius:6px;border:none;background:rgba(34,197,94,0.12);color:#6ee7b7;font-size:10px;cursor:pointer;font-weight:600">📄 PDF Çıktı Al</button>`;
        }
        html += `<button onclick="toggleExp('plan_${realIdx}')" style="background:none;border:none;color:#475569;font-size:10px;cursor:pointer;padding-top:4px">${state.expanded["plan_"+realIdx]?'Detayı gizle ▲':'Detayı göster ▼'}</button>`;
        html += `</div>`;
      });
      if (savedPlans.length > 3) html += `<button class="show-more" onclick="toggleExp('allPlans')">${state.expanded.allPlans?'Daha az ▲':'Tüm planlar ('+savedPlans.length+') ▼'}</button>`;
    }
  }

  // ══ ŞUBE TABLOSU ══
  if (state.tab === "sube") {
    html += `<div class="sec-title">Şube Performans Karşılaştırması</div>`;
    html += `<div style="font-size:12px;color:#94a3b8;margin-bottom:14px;margin-top:-6px">Tüm şubeleri yan yana karşılaştır · Önceki döneme göre değişim dahil</div>`;

    // Build branch performance data
    const brPerf = {};
    filtered.forEach(r => {
      if (!brPerf[r.s]) brPerf[r.s] = { net: 0, d: 0, ciro: 0, records: 0 };
      brPerf[r.s].net += r.net;
      brPerf[r.s].d += r.d;
      brPerf[r.s].ciro += r.ciro;
      brPerf[r.s].records += 1;
    });
    const brList = Object.entries(brPerf).map(([name, v]) => ({
      name, ...v,
      dbn: v.d > 0 ? v.net / v.d : 0,
      avgP: v.d > 0 ? v.ciro / v.d : 0,
    })).sort((a, b) => b.net - a.net);

    // Önceki dönem hesapla (delta için)
    // KURAL: ekran filtresi (çiçek/grup + şube) kıyasa da uygulanır — tarih havuzu dahil
    const subeFiltre = r =>
      (!state.sf || (state.sf.startsWith("GRUP:") ? r.c.startsWith(state.sf.replace("GRUP:", "")) : r.c === state.sf)) &&
      (!state.sb || r.s === state.sb);
    const prevBrPerf = {};
    const filteredDates = [...new Set(filtered.map(r => r.t))].sort();
    const gunSayisiSube = filteredDates.length;
    const prevDatesAll = [...new Set(ALL_DATA.filter(r => r.t < (filteredDates[0]||state.sd) && subeFiltre(r)).map(r => r.t))].sort().reverse().slice(0, Math.max(gunSayisiSube, 1));
    ALL_DATA.filter(r => prevDatesAll.includes(r.t) && subeFiltre(r)).forEach(r => {
      if (!prevBrPerf[r.s]) prevBrPerf[r.s] = { net: 0, d: 0 };
      prevBrPerf[r.s].net += r.net; prevBrPerf[r.s].d += r.d;
    });

    const topNet = brList[0]?.net || 1;
    const totalNet = brList.reduce((s, b) => s + b.net, 0);
    const totalDm = brList.reduce((s, b) => s + b.d, 0);

    // Table header
    html += `<div class="card" style="padding:0;overflow:hidden;overflow-x:auto">`;
    html += `<table style="width:100%;border-collapse:collapse;font-size:11px;min-width:420px">`;
    html += `<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08)">`;
    html += `<th style="padding:10px 6px;text-align:left;color:#64748b;font-size:9px;text-transform:uppercase;font-weight:600">Şube</th>`;
    html += `<th style="padding:10px 6px;text-align:right;color:#64748b;font-size:9px;text-transform:uppercase;font-weight:600">Net Gelir</th>`;
    html += `<th style="padding:10px 6px;text-align:right;color:#64748b;font-size:9px;text-transform:uppercase;font-weight:600">Dm Başı</th>`;
    html += `<th style="padding:10px 6px;text-align:right;color:#64748b;font-size:9px;text-transform:uppercase;font-weight:600">Demet</th>`;
    html += `<th style="padding:10px 4px;text-align:right;color:#64748b;font-size:9px;text-transform:uppercase;font-weight:600">Pay</th>`;
    html += `<th style="padding:10px 4px;text-align:right;color:#64748b;font-size:9px;text-transform:uppercase;font-weight:600">Δ</th>`;
    html += `</tr></thead><tbody>`;

    brList.forEach((b, i) => {
      const pct = totalNet > 0 ? (b.net / totalNet * 100) : 0;
      const barW = topNet > 0 ? (b.net / topNet * 100) : 0;
      const rowBg = i === 0 ? "rgba(34,197,94,0.06)" : i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent";
      // Önceki dönem delta
      const prev = prevBrPerf[b.name];
      const prevNet = prev ? prev.net : 0;
      const prevDbn = prev && prev.d > 0 ? prev.net / prev.d : 0;
      const chNet = prevNet > 0 ? ((b.net - prevNet) / prevNet * 100) : null;
      html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.03);background:${rowBg}">`;
      html += `<td style="padding:8px 6px;color:#f8fafc;font-weight:${i===0?'600':'500'}">${i===0?'🏆 ':''}${esc(b.name)}</td>`;
      html += `<td style="padding:8px 6px;text-align:right"><div style="color:#34d399;font-weight:600">${fmt(b.net)}</div><div style="height:3px;background:rgba(255,255,255,0.04);border-radius:2px;margin-top:2px"><div style="height:100%;border-radius:2px;width:${barW}%;background:#22c55e"></div></div></td>`;
      html += `<td style="padding:8px 6px;text-align:right;color:#e2e8f0;font-weight:600">${fmt(b.dbn)}</td>`;
      html += `<td style="padding:8px 6px;text-align:right;color:#cbd5e1">${b.d}</td>`;
      html += `<td style="padding:8px 4px;text-align:right;color:#94a3b8;font-size:10px">${pct.toFixed(0)}%</td>`;
      html += `<td style="padding:8px 4px;text-align:right;font-size:10px;color:${chNet!==null?(chNet>=0?'#34d399':'#f87171'):'#475569'}">${chNet!==null?(chNet>=0?'+':'')+chNet.toFixed(0)+'%':'—'}</td>`;
      html += `</tr>`;
    });

    // Totals row
    html += `<tr style="border-top:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03)">`;
    html += `<td style="padding:10px 6px;color:#f8fafc;font-weight:700">TOPLAM</td>`;
    html += `<td style="padding:10px 6px;text-align:right;color:#4ade80;font-weight:700">${fmt(totalNet)}</td>`;
    html += `<td style="padding:10px 6px;text-align:right;color:#f8fafc;font-weight:700">${totalDm > 0 ? fmt(totalNet / totalDm) : '—'}</td>`;
    html += `<td style="padding:10px 6px;text-align:right;color:#f8fafc;font-weight:700">${totalDm}</td>`;
    html += `<td style="padding:10px 4px;text-align:right;color:#f8fafc;font-weight:700">100%</td>`;
    html += `<td></td>`;
    html += `</tr>`;

    html += `</tbody></table></div>`;

    // Per-branch flower breakdown — pay % + güven uyarısı eklendi
    html += `<div class="sec-title" style="margin-top:20px">Şube × Çiçek Detayı</div>`;
    const brFlower = {};
    filtered.forEach(r => {
      const key = r.s;
      if (!brFlower[key]) brFlower[key] = {};
      if (!brFlower[key][r.c]) brFlower[key][r.c] = { net: 0, d: 0 };
      brFlower[key][r.c].net += r.net;
      brFlower[key][r.c].d += r.d;
    });

    // Şube bazlı V2 gider/demet (Cost Model v2 — gerçek maliyet farkı)
    const brV2 = {};
    filtered.forEach(r => {
      if (r.costModel !== "v2") return;
      if (!brV2[r.s]) brV2[r.s] = { gider: 0, d: 0 };
      brV2[r.s].gider += r.toplamGider; brV2[r.s].d += r.d;
    });

    brList.slice(0, state.expanded.subeDetail ? 999 : 5).forEach((b, i) => {
      const flowers = brFlower[b.name] || {};
      const fList = Object.entries(flowers).map(([n, v]) => ({ name: n, ...v, dbn: v.d > 0 ? v.net / v.d : 0 })).sort((a, bb) => bb.dbn - a.dbn);
      const subeToplamNet = fList.reduce((s, fl) => s + fl.net, 0);
      const v2b = brV2[b.name];

      html += `<div class="card" style="margin-bottom:8px;padding:12px 14px">`;
      html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">`;
      html += `<div style="font-size:13px;font-weight:600;color:#f8fafc">${esc(b.name)}</div>`;
      html += `<div style="font-size:9px;color:#64748b">${fList.length} çiçek · ${b.records} kayıt${v2b && v2b.d > 0 ? ' · <span style="color:#c4b5fd">Gider/Dm: ' + fmt2(v2b.gider / v2b.d) + '</span>' : ''}</div>`;
      html += `</div>`;
      fList.slice(0, 5).forEach((fl, j) => {
        const flPay = subeToplamNet > 0 ? (fl.net / subeToplamNet * 100) : 0;
        const guvenUyari = fl.d < 5 ? ' <span style="color:#f87171;font-size:8px">⚠ az örnek</span>' : fl.d < 15 ? ' <span style="color:#fbbf24;font-size:8px">◐ orta</span>' : '';
        html += `<div style="display:flex;justify-content:space-between;padding:4px 0;border-top:${j>0?'1px solid rgba(255,255,255,0.03)':'none'}">`;
        html += `<span style="font-size:11px;color:#cbd5e1">${esc(fl.name)}${guvenUyari}</span>`;
        html += `<span style="font-size:11px"><span style="color:#fbbf24;font-size:9px">%${flPay.toFixed(0)}</span> · <span style="color:#64748b">${fl.d}dm</span> · <span style="color:#34d399;font-weight:600">${fmt(fl.dbn)}/dm</span></span>`;
        html += `</div>`;
      });
      if (fList.length > 5) html += `<div style="font-size:10px;color:#475569;padding-top:4px">+${fList.length - 5} çiçek daha</div>`;
      html += `</div>`;
    });
    if (brList.length > 5) html += `<button class="show-more" onclick="toggleExp('subeDetail')">${state.expanded.subeDetail?'Daha az ▲':'Tüm şubeler ('+brList.length+') ▼'}</button>`;
  }

  // ══ KARŞILAŞTIR ══
  if (state.tab === "compare") {
    const bc = getBranchComp(filtered);
    // 2+ şubeli ve tek şubeli ayır
    const bcMulti = bc.filter(item => item.branchCount >= 2);
    const bcSingle = bc.filter(item => item.branchCount < 2);

    html += `<div class="sec-title">Aynı Çiçek — Farklı Şubeler</div>`;
    html += `<div style="font-size:12px;color:#94a3b8;margin-bottom:14px;margin-top:-6px">Dm başı net karşılaştırma · Fiyat farkı + karar etkisi · Güven seviyesi</div>`;
    const compShow = state.expanded.comp ? 999 : 5;
    bcMulti.slice(0, compShow).forEach((item, i) => {
      const best = item.branches[0];
      const worst = item.branches[item.branches.length - 1];
      const mx = best?.dbn || 1;
      const fark = best && worst ? (best.dbn - worst.dbn) : 0;
      const kararEtkisi = fark * item.totalD;
      const show = state.expanded["comp_"+i] ? 999 : 5;

      html += `<div class="card" style="margin-bottom:12px">`;
      // Başlık + fiyat farkı + karar etkisi
      html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><div style="font-size:13px;font-weight:700;color:#f8fafc">${esc(item.flower)}</div><div style="font-size:10px;color:#34d399">${item.branchCount} şube · ${item.totalD}dm</div></div>`;
      if (fark > 0 && item.branches.length >= 2) {
        html += `<div style="display:flex;gap:10px;margin-bottom:8px;font-size:10px">`;
        html += `<span style="color:#fbbf24">Fark: ${fmt(fark)}/dm</span>`;
        html += `<span style="color:#c4b5fd">Karar etkisi: ~${fmt(kararEtkisi)}</span>`;
        html += `</div>`;
      }
      // Şube satırları
      item.branches.slice(0, show).forEach((b, j) => {
        const w = mx > 0 ? (b.dbn / mx * 100) : 0;
        const isBest = j === 0;
        // Güven etiketi
        const guvenTxt = b.d < 5 ? '<span style="color:#f87171;font-size:7px"> ⚠az</span>' : b.d < 15 ? '<span style="color:#fbbf24;font-size:7px"> ◐</span>' : '';
        // Trend ok
        const trendOk = b.trend > 5 ? '<span style="color:#34d399;font-size:8px">↑</span>' : b.trend < -5 ? '<span style="color:#f87171;font-size:8px">↓</span>' : '<span style="color:#475569;font-size:8px">→</span>';
        html += `<div style="display:flex;align-items:center;gap:4px;padding:4px 0;border-top:${j>0?'1px solid rgba(255,255,255,0.03)':'none'}">`;
        html += `<div style="width:55px;font-size:10px;color:${isBest?'#34d399':'#94a3b8'};font-weight:${isBest?600:400};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(b.name)}</div>`;
        html += `<div style="flex:1;height:5px;background:rgba(255,255,255,0.04);border-radius:3px"><div style="height:100%;border-radius:3px;width:${w}%;background:${isBest?'linear-gradient(90deg,#22c55e,#34d399)':'rgba(148,163,184,0.25)'}"></div></div>`;
        html += `<div style="width:50px;text-align:right;font-size:12px;font-weight:700;color:${isBest?'#34d399':'#cbd5e1'}">${fmt(b.dbn)}</div>`;
        html += `<div style="width:35px;text-align:right;font-size:9px;color:#64748b">${b.d}dm${guvenTxt}</div>`;
        html += `<div style="width:12px;text-align:center">${trendOk}</div>`;
        html += `</div>`;
      });
      if (item.branches.length > 5) html += `<button style="margin-top:4px;background:none;border:none;color:#64748b;font-size:10px;cursor:pointer" onclick="toggleExp('comp_${i}')">${state.expanded["comp_"+i]?"Daha az":"+"+(item.branches.length-5)+" şube daha"}</button>`;
      html += `</div>`;
    });
    if (bcMulti.length > 5) html += `<button class="show-more" onclick="toggleExp('comp')">${state.expanded.comp?'Daha az ▲':'Tüm çiçekler ('+bcMulti.length+') ▼'}</button>`;

    // Tek şubeli ürünler — ayrı bölüm
    if (bcSingle.length > 0) {
      html += `<div class="sec-title" style="margin-top:16px;color:#475569">Tek Şubeli Ürünler</div>`;
      html += `<div style="font-size:10px;color:#475569;margin-bottom:8px;margin-top:-6px">Karşılaştırma için yeterli şube verisi yok</div>`;
      html += `<div class="card" style="padding:10px">`;
      bcSingle.slice(0, state.expanded.compSingle ? 999 : 5).forEach((item, j) => {
        const b = item.branches[0];
        if (!b) return;
        html += `<div style="display:flex;justify-content:space-between;padding:3px 0;border-top:${j>0?'1px solid rgba(255,255,255,0.03)':'none'};font-size:10px">`;
        html += `<span style="color:#64748b">${esc(item.flower)}</span>`;
        html += `<span style="color:#475569">${esc(b.name)} · ${b.d}dm · ${fmt(b.dbn)}/dm</span>`;
        html += `</div>`;
      });
      if (bcSingle.length > 5) html += `<button style="margin-top:4px;background:none;border:none;color:#475569;font-size:9px;cursor:pointer" onclick="toggleExp('compSingle')">${state.expanded.compSingle?'Daha az':'+'+(bcSingle.length-5)+' ürün daha'}</button>`;
      html += `</div>`;
    }
  }

  // ══ KAR HARİTASI ══
  if (state.tab === "heat") {
    const hd = getHeatData(filtered);
    html += `<div class="sec-title">En Kârlı Kombinasyonlar</div>`;
    html += `<div style="font-size:10px;color:#64748b;margin-bottom:8px;margin-top:-6px">Çiçek × Şube kombinasyonları · Güven + karar etkisi dahil</div>`;
    html += `<div style="display:flex;gap:6px;margin-bottom:14px">`;
    [["net","Dm Başı Net"],["totalnet","Toplam Net"]].forEach(([k,l]) => {
      html += `<button class="preset-btn ${state.hmSort===k?'active':''}" onclick="setState({hmSort:'${k}'})">${l}</button>`;
    });
    html += `</div>`;
    const hShow = state.expanded.heat ? 999 : 15;
    const lider = hd[0];
    const liderVal = lider ? (state.hmSort === "totalnet" ? lider.net : lider.dbn) : 1;

    hd.slice(0, hShow).forEach((h, i) => {
      const isDbnMode = state.hmSort !== "totalnet";
      const v = isDbnMode ? h.dbn : h.net;
      const pct = liderVal > 0 ? (v / liderVal) * 100 : 0;
      const intensity = pct / 100;
      const colors = ["#fbbf24","#cbd5e1","#c49a6c"];

      // Güven etiketi
      const guvenTxt = h.d < 5 ? '<span style="color:#f87171;font-size:7px"> ⚠az</span>' : h.d < 15 ? '<span style="color:#fbbf24;font-size:7px"> ◐</span>' : '';

      // Liderden fark
      const liderFark = lider && isDbnMode ? (h.dbn - lider.dbn) : 0;
      const farkTxt = i > 0 && liderFark !== 0 && isDbnMode ? '<span style="color:#f87171;font-size:8px"> ' + liderFark.toFixed(0) + '</span>' : '';

      html += `<div class="heat-row">`;
      html += `<div style="width:18px;text-align:center;font-size:10px;font-weight:700;color:${i<3?colors[i]:'#475569'}">${i+1}</div>`;
      html += `<div style="flex:1;min-width:0">`;
      html += `<div style="font-size:12px;font-weight:600;color:${h.d<5?'#64748b':'#e2e8f0'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(h.cicek)}</div>`;
      html += `<div style="font-size:10px;color:#64748b">${esc(h.sube)} · ${h.d}dm${guvenTxt} · <span style="color:#94a3b8">${fmt(h.net)} net</span>${farkTxt}</div>`;
      html += `</div>`;
      html += `<div style="width:65px"><div style="height:5px;background:rgba(255,255,255,0.04);border-radius:3px"><div style="height:100%;border-radius:3px;width:${pct}%;background:rgba(34,197,94,${(0.3+intensity*0.5).toFixed(2)})"></div></div></div>`;
      html += `<div style="width:55px;text-align:right;font-size:13px;font-weight:700;color:rgba(52,211,153,${(0.5+intensity*0.5).toFixed(2)})">${isDbnMode ? fmt(h.dbn) : fmt(h.net)}</div>`;
      html += `</div>`;
    });
    if (hd.length > 15) html += `<button class="show-more" style="margin-top:8px" onclick="toggleExp('heat')">${state.expanded.heat?'Daha az ▲':'Tümü ('+hd.length+' kombo) ▼'}</button>`;
  }

  // ══ TABLO ══
  if (state.tab === "tablo") {
    html += `<div class="sec-title">Kayıtlar (${filtered.length})</div>`;
    html += `<div class="card" style="padding:0;overflow:hidden">`;
    html += `<div class="tbl-head tbl-cols"><span>Tarih</span><span>Çiçek</span><span>Şube</span><span style="text-align:center">Dm</span><span style="text-align:right">Fiyat</span><span style="text-align:right">Net</span></div>`;
    html += `<div style="max-height:450px;overflow-y:auto">`;
    const sorted = [...filtered].sort((a, b) => b.t.localeCompare(a.t) || b.f - a.f);
    sorted.slice(0, 200).forEach(r => {
      html += `<div class="tbl-row tbl-cols"><span style="color:#64748b;font-size:10px">${fD(r.t)}</span><span style="color:#e2e8f0;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.c)}</span><span style="color:#94a3b8;font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.s)}</span><span style="color:#cbd5e1;text-align:center">${r.d}</span><span style="color:#f8fafc;font-weight:600;text-align:right">${r.f.toFixed(0)}</span><span style="color:#34d399;font-weight:600;text-align:right">${r.dbn.toFixed(0)}</span></div>`;
    });
    if (sorted.length > 200) html += `<div style="text-align:center;padding:12px;color:#64748b;font-size:11px">İlk 200 kayıt gösteriliyor (toplam ${sorted.length})</div>`;
    html += `</div></div>`;
    if (!filtered.length) html += `<div style="text-align:center;padding:40px;color:#475569">Kayıt bulunamadı.</div>`;
  }

  // ══ GEÇEN YIL ══
  if (state.tab === "yoy") {
    const y = getYoY(filtered);
    html += `<div class="sec-title">Geçen Yıl Karşılaştırması</div>`;
    if (!y.has) {
      html += `<div class="card" style="background:rgba(250,204,21,0.06);border-color:rgba(250,204,21,0.12);text-align:center;padding:30px"><div style="font-size:14px;color:#fbbf24;margin-bottom:6px">Geçen yıl verisi yok</div><div style="font-size:12px;color:#94a3b8">Tarih aralığını "7 Gün" veya "Bu Ay" olarak değiştirip tekrar dene.</div></div>`;
    } else {
      // Top KPIs - NET based
      html += `<div class="grid-2" style="margin-bottom:14px">`;
      html += `<div class="card"><div style="font-size:10px;color:#64748b;margin-bottom:4px">2025 Net Gelir</div><div style="font-size:18px;font-weight:800;color:#94a3b8">${fmt(y.lN)}</div><div style="font-size:10px;color:#475569;margin-top:3px">${y.lD} demet · ${fmt(y.lA)} dm başı</div></div>`;
      html += `<div class="card card-green"><div style="font-size:10px;color:#64748b;margin-bottom:4px">2026 Net Gelir</div><div style="font-size:18px;font-weight:800;color:#4ade80">${fmt(y.tN)}</div><div style="font-size:10px;color:#475569;margin-top:3px">${y.tD} demet · ${fmt(y.tA)} dm başı</div></div>`;
      html += `</div>`;

      // Change summary
      html += `<div class="card" style="text-align:center;margin-bottom:14px"><div style="display:flex;justify-content:center;gap:30px"><div><div style="font-size:10px;color:#94a3b8">Net Gelir</div><div style="font-size:20px;font-weight:800;margin-top:4px">${trendHTML(y.nCh)}</div></div><div><div style="font-size:10px;color:#94a3b8">Dm Başı Net</div><div style="font-size:20px;font-weight:800;margin-top:4px">${trendHTML(y.pCh)}</div></div><div><div style="font-size:10px;color:#94a3b8">Demet</div><div style="font-size:20px;font-weight:800;margin-top:4px">${trendHTML(y.lD > 0 ? ((y.tD - y.lD) / y.lD * 100) : null)}</div></div></div></div>`;
      html += `<div style="font-size:9px;color:#64748b;text-align:center;margin-top:-8px;margin-bottom:14px">ℹ 2026 Ağu+ gerçek gider modeli, önceki dönemler %20 tahmini — net karşılaştırması yaklaşık %3-8 sapabilir</div>`;

      // Flower comparison
      html += `<div class="sec-title">Çiçek Bazlı Karşılaştırma</div>`;
      const flShow = state.expanded.yoyFlowers ? 999 : 6;
      y.flowers.slice(0, flShow).forEach(f => {
        const hasBoth = f.thisD > 0 && f.lastD > 0;
        const isNew = f.thisD > 0 && f.lastD === 0;
        const isGone = f.thisD === 0 && f.lastD > 0;
        const diffColor = f.dbnDiff > 0 ? "#34d399" : f.dbnDiff < 0 ? "#f87171" : "#64748b";
        const diffSign = f.dbnDiff > 0 ? "+" : "";

        html += `<div class="card" style="margin-bottom:8px;padding:12px 14px">`;
        html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">`;
        html += `<div style="font-size:13px;font-weight:600;color:#f8fafc">${esc(f.name)}</div>`;
        if (isNew) html += `<span style="font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(34,197,94,0.15);color:#4ade80;font-weight:600">🆕 Yeni</span>`;
        else if (isGone) html += `<span style="font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(239,68,68,0.15);color:#f87171;font-weight:600">Çıktı</span>`;
        html += `</div>`;

        // Demet row
        html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0">`;
        html += `<div style="font-size:10px;color:#64748b;width:70px">Demet</div>`;
        html += `<div style="font-size:12px;color:#94a3b8;width:60px;text-align:center">${f.lastD || "—"}</div>`;
        html += `<div style="font-size:10px;color:#475569">→</div>`;
        html += `<div style="font-size:12px;color:#e2e8f0;font-weight:600;width:60px;text-align:center">${f.thisD || "—"}</div>`;
        html += `<div style="font-size:11px;color:${f.demetDiff > 0 ? '#34d399' : f.demetDiff < 0 ? '#f87171' : '#64748b'};width:60px;text-align:right;font-weight:600">${f.demetDiff > 0 ? '+' : ''}${f.demetDiff}</div>`;
        html += `</div>`;

        // Dm başı net row
        html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0">`;
        html += `<div style="font-size:10px;color:#64748b;width:70px">Dm Başı Net</div>`;
        html += `<div style="font-size:12px;color:#94a3b8;width:60px;text-align:center">${f.lastD > 0 ? fmt(f.lastDbn) : "—"}</div>`;
        html += `<div style="font-size:10px;color:#475569">→</div>`;
        html += `<div style="font-size:12px;color:#e2e8f0;font-weight:600;width:60px;text-align:center">${f.thisD > 0 ? fmt(f.thisDbn) : "—"}</div>`;
        html += `<div style="font-size:11px;color:${diffColor};width:60px;text-align:right;font-weight:600">${hasBoth ? diffSign + fmt(f.dbnDiff) : "—"}</div>`;
        html += `</div>`;

        // Net gelir row
        html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0">`;
        html += `<div style="font-size:10px;color:#64748b;width:70px">Net Gelir</div>`;
        html += `<div style="font-size:12px;color:#94a3b8;width:60px;text-align:center">${f.lastNet > 0 ? fmt(f.lastNet) : "—"}</div>`;
        html += `<div style="font-size:10px;color:#475569">→</div>`;
        html += `<div style="font-size:12px;color:#e2e8f0;font-weight:600;width:60px;text-align:center">${f.thisNet > 0 ? fmt(f.thisNet) : "—"}</div>`;
        const netDiff = f.thisNet - f.lastNet;
        html += `<div style="font-size:11px;color:${netDiff > 0 ? '#34d399' : netDiff < 0 ? '#f87171' : '#64748b'};width:60px;text-align:right;font-weight:600">${hasBoth ? (netDiff > 0 ? '+' : '') + fmt(netDiff) : "—"}</div>`;
        html += `</div>`;

        // Percentage badge
        if (f.dbnPct != null) {
          html += `<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.04)">`;
          html += `<span style="font-size:11px;padding:3px 8px;border-radius:6px;background:${f.dbnPct > 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'};color:${f.dbnPct > 0 ? '#34d399' : '#f87171'}">${f.dbnPct > 0 ? '▲' : '▼'} Dm başı net %${Math.abs(f.dbnPct).toFixed(1)} ${f.dbnPct > 0 ? 'artmış' : 'düşmüş'}</span>`;
          html += `</div>`;
        }
        html += `</div>`;
      });
      if (y.flowers.length > 6) html += `<button class="show-more" onclick="toggleExp('yoyFlowers')">${state.expanded.yoyFlowers ? 'Daha az ▲' : 'Tüm çiçekler (' + y.flowers.length + ') ▼'}</button>`;

      // Branch comparison
      html += `<div class="sec-title">Şube Bazlı Karşılaştırma</div>`;
      const brShow = state.expanded.yoyBranches ? 999 : 5;
      const yoyTotalThisNet = y.branches.reduce((s,b) => s + b.thisNet, 0);
      const yoyTotalLastNet = y.branches.reduce((s,b) => s + b.lastNet, 0);
      y.branches.slice(0, brShow).forEach(b => {
        const hasBoth = b.thisNet > 0 && b.lastNet > 0;
        const thisPay = yoyTotalThisNet > 0 ? (b.thisNet / yoyTotalThisNet * 100) : 0;
        const lastPay = yoyTotalLastNet > 0 ? (b.lastNet / yoyTotalLastNet * 100) : 0;
        html += `<div class="card" style="margin-bottom:8px;padding:12px 14px">`;
        html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">`;
        html += `<div style="font-size:13px;font-weight:600;color:#f8fafc">${esc(b.name)}</div>`;
        if (b.netPct != null) html += `<span style="font-size:11px;color:${b.netPct > 0 ? '#34d399' : '#f87171'};font-weight:600">${b.netPct > 0 ? '▲ +' : '▼ '}${Math.abs(b.netPct).toFixed(0)}%</span>`;
        html += `</div>`;
        html += `<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0">`;
        html += `<span style="color:#64748b">Net Gelir</span>`;
        html += `<span style="color:#94a3b8">${b.lastNet > 0 ? fmt(b.lastNet) : '—'}</span>`;
        html += `<span style="color:#475569">→</span>`;
        html += `<span style="color:#e2e8f0;font-weight:600">${b.thisNet > 0 ? fmt(b.thisNet) : '—'}</span>`;
        html += `</div>`;
        html += `<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0">`;
        html += `<span style="color:#64748b">Dm Başı Net</span>`;
        html += `<span style="color:#94a3b8">${b.lastDbn > 0 ? fmt(b.lastDbn) : '—'}</span>`;
        html += `<span style="color:#475569">→</span>`;
        html += `<span style="color:#e2e8f0;font-weight:600">${b.thisDbn > 0 ? fmt(b.thisDbn) : '—'}</span>`;
        if (b.dbnPct != null) html += `<span style="font-size:10px;color:${b.dbnPct>0?'#34d399':'#f87171'}">${b.dbnPct>0?'+':''}${b.dbnPct.toFixed(0)}%</span>`;
        html += `</div>`;
        html += `<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0">`;
        html += `<span style="color:#64748b">Demet</span>`;
        html += `<span style="color:#94a3b8">${b.lastD || '—'}</span>`;
        html += `<span style="color:#475569">→</span>`;
        html += `<span style="color:#e2e8f0;font-weight:600">${b.thisD || '—'}</span>`;
        html += `</div>`;
        html += `<div style="font-size:9px;color:#64748b;margin-top:4px">Pay: <span style="color:#94a3b8">%${lastPay.toFixed(0)}</span> → <span style="color:#fbbf24">%${thisPay.toFixed(0)}</span></div>`;
        html += `</div>`;
      });
      if (y.branches.length > 5) html += `<button class="show-more" onclick="toggleExp('yoyBranches')">${state.expanded.yoyBranches ? 'Daha az ▲' : 'Tüm şubeler (' + y.branches.length + ') ▼'}</button>`;

      // Summary insight — 3 satırlık güçlendirilmiş yorum
      const topGainer = y.flowers.filter(f => f.dbnPct != null && f.dbnPct > 0).sort((a, b) => b.dbnPct - a.dbnPct)[0];
      const topLoser = y.flowers.filter(f => f.dbnPct != null && f.dbnPct < 0).sort((a, b) => a.dbnPct - b.dbnPct)[0];
      const topBranch = y.branches.filter(b => b.netPct != null && b.netPct > 0).sort((a, b) => b.netDiff - a.netDiff)[0];
      const newFlowers = y.flowers.filter(f => f.thisD > 0 && f.lastD === 0);
      const goneFlowers = y.flowers.filter(f => f.thisD === 0 && f.lastD > 0);
      const demetCh = y.lD > 0 ? ((y.tD - y.lD) / y.lD * 100) : null;

      html += `<div class="card" style="background:rgba(96,165,250,0.06);border-color:rgba(96,165,250,0.12);margin-top:14px"><div style="font-size:12px;font-weight:600;color:#60a5fa;margin-bottom:6px">📊 Özet Yorum</div><div style="font-size:12px;color:#cbd5e1;line-height:1.8">`;
      // Satır 1: Ana artış/düşüş nedeni
      if (y.nCh != null && y.nCh > 0 && demetCh != null) {
        if (demetCh < -3) html += `Net gelir <strong style="color:#4ade80">%${y.nCh.toFixed(0)} arttı</strong>. Ana neden dm başı net yükselişi — hacim %${Math.abs(demetCh).toFixed(0)} gerilese de fiyat kalitesi bunu telafi etti.<br>`;
        else if (demetCh > 3) html += `Net gelir <strong style="color:#4ade80">%${y.nCh.toFixed(0)} arttı</strong>. Hem fiyat hem hacim artışı birlikte etkili oldu.<br>`;
        else html += `Net gelir <strong style="color:#4ade80">%${y.nCh.toFixed(0)} arttı</strong>. Hacim benzer seviyede, artış fiyat kalitesinden geldi.<br>`;
      } else if (y.nCh != null && y.nCh < 0) {
        html += `Net gelir <strong style="color:#f87171">%${Math.abs(y.nCh).toFixed(0)} geriledi</strong>. `;
        if (demetCh != null && demetCh < -5) html += `Ana neden hacim düşüşü.<br>`;
        else html += `Fiyat kalitesi zayıfladı.<br>`;
      }
      // Satır 2: Taşıyıcılar
      if (topGainer) html += `En çok yükselen: <strong style="color:#4ade80">${esc(topGainer.name)}</strong> (+%${topGainer.dbnPct.toFixed(0)} dm başı). `;
      if (topLoser) html += `En çok gerileyen: <strong style="color:#f87171">${esc(topLoser.name)}</strong> (-%${Math.abs(topLoser.dbnPct).toFixed(0)}).<br>`;
      // Satır 3: Şube + yeni ürünler
      if (topBranch) html += `En güçlü şube: <strong>${esc(topBranch.name)}</strong> (+${fmt(topBranch.netDiff)}). `;
      if (newFlowers.length > 0) html += `${newFlowers.length} yeni ürün devreye girdi. `;
      if (goneFlowers.length > 0) html += `${goneFlowers.length} ürün bu dönem satılmadı.`;
      html += `</div></div>`;
    }
  }

  // ══ MEVSİMSELLİK ══
  if (state.tab === "mevsim") {
    const sd = getSeasonalData();
    const buAy = new Date().getMonth() + 1;
    const ayAdlari = ["","Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

    html += `<div class="sec-title">🗓 Mevsimsellik Analizi</div>`;
    html += `<div style="font-size:12px;color:#94a3b8;margin-bottom:16px;margin-top:-6px">6 yıllık veri ile enflasyondan bağımsız mevsimsel örüntüler</div>`;

    // ── Aylık Mevsimsel Endeks ──
    html += `<div class="card" style="margin-bottom:14px"><div style="font-size:13px;font-weight:700;color:#f8fafc;margin-bottom:10px">📊 Aylık Mevsimsel Endeks</div>`;
    html += `<div style="font-size:10px;color:#64748b;margin-bottom:10px">100 = yıl ortalaması. 110 = o ay ortalamanın %10 üstünde</div>`;
    html += `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">`;
    sd.aylarData.forEach(a => {
      if (a.ortYuzde === null) {
        html += `<div style="padding:10px 6px;text-align:center;border-radius:8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04)"><div style="font-size:10px;color:#475569">${a.ad}</div><div style="font-size:12px;color:#475569;margin-top:2px">—</div></div>`;
      } else {
        const idx = Math.round(a.ortYuzde * 100);
        const isBuAy = a.ay === buAy;
        let bg, cl;
        if (idx >= 115) { bg = "rgba(34,197,94,0.2)"; cl = "#4ade80"; }
        else if (idx >= 105) { bg = "rgba(34,197,94,0.1)"; cl = "#6ee7b7"; }
        else if (idx >= 95) { bg = "rgba(255,255,255,0.04)"; cl = "#e2e8f0"; }
        else if (idx >= 85) { bg = "rgba(239,68,68,0.08)"; cl = "#fca5a5"; }
        else { bg = "rgba(239,68,68,0.15)"; cl = "#f87171"; }
        const border = isBuAy ? "border:2px solid #fbbf24" : "border:1px solid rgba(255,255,255,0.06)";
        // Oynaklık göstergesi — güven aralığından CV hesapla
        const ga = sd.ayGuvenAraligi[a.ay];
        let oynaklıkDot = "";
        if (ga && ga.ort > 0) {
          const cv = (ga.stdSapma / ga.ort * 100);
          oynaklıkDot = cv <= 10 ? ' <span style="color:#4ade80;font-size:6px">●</span>' : cv <= 20 ? ' <span style="color:#fbbf24;font-size:6px">●</span>' : ' <span style="color:#f87171;font-size:6px">●</span>';
        }
        html += `<div style="padding:10px 6px;text-align:center;border-radius:8px;background:${bg};${border}">`;
        html += `<div style="font-size:10px;color:#94a3b8">${a.ad}${isBuAy?' 📍':''}</div>`;
        html += `<div style="font-size:16px;font-weight:800;color:${cl};margin-top:2px">${idx}${oynaklıkDot}</div>`;
        html += `<div style="font-size:8px;color:#475569">${a.yilSayisi} yıl · ${a.demet}dm</div>`;
        html += `</div>`;
      }
    });
    html += `</div></div>`;

    // ── 2026 Projeksiyon ──
    if (sd.ort2026 > 0) {
      html += `<div class="card" style="margin-bottom:14px;background:rgba(168,85,247,0.06);border-color:rgba(168,85,247,0.12)">`;
      html += `<div style="font-size:13px;font-weight:700;color:#c4b5fd;margin-bottom:10px">🔮 2026 Aylık Fiyat Projeksiyonu</div>`;
      html += `<div style="font-size:10px;color:#64748b;margin-bottom:10px">Baz: ${fmt(sd.ort2026)}/dm (EMA — son günlere ağırlıklı) × mevsimsel endeks</div>`;
      html += `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">`;
      sd.aylarData.forEach(a => {
        if (a.ortYuzde === null) {
          html += `<div style="padding:8px 6px;text-align:center;border-radius:8px;background:rgba(255,255,255,0.02)"><div style="font-size:10px;color:#475569">${a.ad}</div><div style="font-size:11px;color:#475569">—</div></div>`;
        } else {
          const proj = sd.ort2026 * a.ortYuzde;
          const isBuAy = a.ay === buAy;
          const isPast = a.ay < buAy;
          const ga = sd.ayGuvenAraligi[a.ay];
          const altProj = ga ? sd.ort2026 * Math.max(0.5, ga.alt) : null;
          const ustProj = ga ? sd.ort2026 * ga.ust : null;
          html += `<div style="padding:8px 6px;text-align:center;border-radius:8px;background:${isBuAy?'rgba(250,204,21,0.1)':'rgba(255,255,255,0.03)'};border:1px solid ${isBuAy?'rgba(250,204,21,0.2)':'rgba(255,255,255,0.04)'}">`;
          html += `<div style="font-size:10px;color:${isPast?'#475569':'#94a3b8'}">${a.ad}</div>`;
          html += `<div style="font-size:13px;font-weight:700;color:${isBuAy?'#fbbf24':isPast?'#64748b':'#c4b5fd'}">${fmt(proj)}</div>`;
          if (altProj && ustProj && !isPast) {
            html += `<div style="font-size:7px;color:#475569">${fmt(altProj)}–${fmt(ustProj)}</div>`;
          }
          html += `</div>`;
        }
      });
      html += `</div>`;
      html += `<div style="font-size:8px;color:#475569;margin-top:8px">ℹ 31 Tem 2026 sonrası gerçek gider modeline geçilmiştir</div>`;
      html += `</div>`;

      // Backtesting — geçmiş ayların tahmin doğruluğu
      if (sd.backtesting && sd.backtesting.length > 0) {
        const absHatalar = sd.backtesting.map(b => Math.abs(b.hata)).sort((a,b) => a-b);
        const ortHata = absHatalar.reduce((s,x) => s+x, 0) / absHatalar.length;
        const medyanHata = absHatalar[Math.floor(absHatalar.length / 2)];
        const enKotuAy = sd.backtesting.reduce((max, b) => Math.abs(b.hata) > Math.abs(max.hata) ? b : max, sd.backtesting[0]);
        const enIyiAy = sd.backtesting.reduce((min, b) => Math.abs(b.hata) < Math.abs(min.hata) ? b : min, sd.backtesting[0]);
        html += `<div class="card" style="margin-bottom:14px"><div style="font-size:13px;font-weight:700;color:#f8fafc;margin-bottom:6px">🎯 Tahmin Doğruluğu (Backtesting)</div>`;
        html += `<div style="display:flex;gap:10px;margin-bottom:8px;font-size:10px">`;
        html += `<div><span style="color:#64748b">Ort. hata:</span> <span style="color:${ortHata<=10?'#4ade80':ortHata<=20?'#fbbf24':'#f87171'};font-weight:600">±${ortHata.toFixed(1)}%</span></div>`;
        html += `<div><span style="color:#64748b">Medyan:</span> <span style="color:#94a3b8">±${medyanHata.toFixed(1)}%</span></div>`;
        html += `<div><span style="color:#64748b">En iyi:</span> <span style="color:#4ade80">${enIyiAy.ad}</span></div>`;
        html += `<div><span style="color:#64748b">En kötü:</span> <span style="color:#f87171">${enKotuAy.ad}</span></div>`;
        html += `</div>`;
        html += `<div style="display:flex;gap:6px;flex-wrap:wrap">`;
        sd.backtesting.forEach(b => {
          const hataCl = Math.abs(b.hata) <= 10 ? "#4ade80" : Math.abs(b.hata) <= 20 ? "#fbbf24" : "#f87171";
          const hataBg = Math.abs(b.hata) <= 10 ? "rgba(34,197,94,0.1)" : Math.abs(b.hata) <= 20 ? "rgba(250,204,21,0.1)" : "rgba(239,68,68,0.1)";
          html += `<div style="flex:1;min-width:70px;padding:6px;text-align:center;border-radius:6px;background:${hataBg}">`;
          html += `<div style="font-size:9px;color:#94a3b8">${b.ad}</div>`;
          html += `<div style="font-size:8px;color:#475569">Tahmin: ${fmt(b.tahmin)}</div>`;
          html += `<div style="font-size:8px;color:#475569">Gerçek: ${fmt(b.gerceklesen)}</div>`;
          html += `<div style="font-size:11px;font-weight:700;color:${hataCl}">${b.hata>=0?'+':''}${b.hata.toFixed(1)}%</div>`;
          html += `</div>`;
        });
        html += `</div></div>`;
      }
    }

    // ── Haftanın Günleri ──
    if (sd.gunList.length > 0) {
      const maxEndeks = Math.max(...sd.gunList.map(g => g.endeks));
      html += `<div class="card" style="margin-bottom:14px"><div style="font-size:13px;font-weight:700;color:#f8fafc;margin-bottom:6px">📅 Haftanın Günleri Performansı</div>`;
      html += `<div style="font-size:10px;color:#64748b;margin-bottom:10px">Enflasyondan bağımsız — her hafta kendi içinde normalize edilir. 100 = hafta ortalaması</div>`;
      sd.gunList.forEach((g, i) => {
        const w = maxEndeks > 0 ? (g.endeks / maxEndeks * 100) : 0;
        const isBest = i === 0;
        html += `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-top:${i>0?'1px solid rgba(255,255,255,0.03)':'none'}">`;
        html += `<div style="width:75px;font-size:12px;font-weight:${isBest?'700':'500'};color:${isBest?'#4ade80':'#e2e8f0'}">${isBest?'🏆 ':''}${g.gun}</div>`;
        html += `<div style="flex:1;height:6px;background:rgba(255,255,255,0.04);border-radius:3px"><div style="height:100%;border-radius:3px;width:${w}%;background:${isBest?'linear-gradient(90deg,#22c55e,#34d399)':'rgba(148,163,184,0.3)'}"></div></div>`;
        html += `<div style="width:35px;text-align:center;font-size:14px;font-weight:700;color:${isBest?'#4ade80':'#cbd5e1'}">${g.endeks}</div>`;
        html += `<div style="width:65px;text-align:right;font-size:9px;color:#64748b">${fmt(g.toplamNet)}</div>`;
        html += `<div style="width:35px;text-align:right;font-size:8px;color:#475569">${g.mezatSayisi}h</div>`;
        html += `</div>`;
      });
      const best = sd.gunList[0], worst = sd.gunList[sd.gunList.length - 1];
      if (best && worst && best.endeks > worst.endeks) {
        const diff = best.endeks - worst.endeks;
        html += `<div style="margin-top:8px;padding:8px;border-radius:8px;background:rgba(34,197,94,0.06);font-size:11px;color:#6ee7b7">💡 ${best.gun} günü hafta ortalamasının %${best.endeks - 100} üstünde, ${worst.gun} %${100 - worst.endeks} altında</div>`;
      }
      html += `</div>`;

      // Çiçek bazlı gün performansı
      if (sd.cicekGunEndeks && Object.keys(sd.cicekGunEndeks).length > 0) {
        html += `<div class="card" style="margin-bottom:14px"><div style="font-size:13px;font-weight:700;color:#f8fafc;margin-bottom:6px">🌷 Çiçek Bazlı Gün Performansı</div>`;
        html += `<div style="font-size:10px;color:#64748b;margin-bottom:10px">Her çiçek hangi gün daha iyi fiyat alıyor?</div>`;
        // Başlık satırı
        html += `<div style="display:grid;grid-template-columns:1fr repeat(3,55px);gap:4px;margin-bottom:4px">`;
        html += `<div style="font-size:8px;color:#475569"></div>`;
        ["Pzt","Çar","Cum"].forEach(g => { html += `<div style="text-align:center;font-size:8px;color:#64748b;font-weight:600">${g}</div>`; });
        html += `</div>`;
        // Çiçek satırları (en çok satılandan)
        const cicekGunSirali = Object.entries(sd.cicekGunEndeks).sort((a,b) => b[1]._toplamD - a[1]._toplamD).slice(0, 10);
        cicekGunSirali.forEach(([cicek, gunler]) => {
          const vals = ["Pazartesi","Çarşamba","Cuma"].map(g => gunler[g] || null);
          const maxV = Math.max(...vals.filter(v => v !== null));
          const minV = Math.min(...vals.filter(v => v !== null));
          html += `<div style="display:grid;grid-template-columns:1fr repeat(3,55px);gap:4px;margin-bottom:2px">`;
          html += `<div style="font-size:9px;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:4px 0">${esc(cicek)}</div>`;
          vals.forEach(v => {
            if (v === null) { html += `<div style="height:24px;border-radius:4px;background:rgba(255,255,255,0.01);display:flex;align-items:center;justify-content:center;font-size:8px;color:#333">—</div>`; }
            else {
              const isBest = v === maxV && vals.filter(x=>x!==null).length > 1;
              const isWorst = v === minV && vals.filter(x=>x!==null).length > 1 && maxV !== minV;
              let bg;
              if (v >= 105) bg = "rgba(34,197,94,0.3)";
              else if (v >= 100) bg = "rgba(34,197,94,0.1)";
              else if (v >= 95) bg = "rgba(250,204,21,0.1)";
              else bg = "rgba(239,68,68,0.1)";
              html += `<div style="height:24px;border-radius:4px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:${isBest?'700':'500'};color:${isBest?'#4ade80':isWorst?'#f87171':'#e2e8f0'}">${v}</div>`;
            }
          });
          html += `</div>`;
        });
        html += `</div>`;
      }
    }

    // ── Özel Günler ──
    if (sd.ozelGunAnaliz.length > 0) {
      html += `<div class="card" style="margin-bottom:14px"><div style="font-size:13px;font-weight:700;color:#f8fafc;margin-bottom:6px">🎉 Özel Günler Fiyat Etkisi</div>`;
      html += `<div style="font-size:10px;color:#64748b;margin-bottom:10px">Özel gün öncesindeki fiyatlar, o yılın ortalamasıyla karşılaştırılır. Enflasyondan bağımsız. Dini bayramlar dahil.</div>`;
      sd.ozelGunAnaliz.forEach((og, idx) => {
        const etki = Math.round(og.ortEtki * 100);
        const fark = etki - 100;
        const isPositive = fark > 0;
        const guvenCl = og.guvenSkoru >= 70 ? "#4ade80" : og.guvenSkoru >= 40 ? "#fbbf24" : "#f87171";
        const guvenLabel = og.guvenSkoru >= 70 ? "Güvenilir" : og.guvenSkoru >= 40 ? "Orta" : "Düşük";
        const hacimTxt = og.ortHacim > 1.3 ? "Hacim ▲" + Math.round((og.ortHacim-1)*100) + "%" : og.ortHacim < 0.8 ? "Hacim ▼" + Math.round((1-og.ortHacim)*100) + "%" : "";
        const isOpen = state.expanded["ozel_"+idx];
        html += `<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.03);cursor:pointer" onclick="toggleExp('ozel_${idx}')">`;
        html += `<div style="display:flex;justify-content:space-between;align-items:center">`;
        html += `<div style="flex:1"><div style="font-size:12px;font-weight:600;color:#f8fafc">${og.ad}</div>`;
        html += `<div style="font-size:9px;color:#64748b">${og.oncesi} gün önce · <span style="color:${guvenCl}">${og.yilSayisi} yıl · G:${og.guvenSkoru}</span>${og.ortPeak !== null ? ' · Zirve: '+og.ortPeak+' gün önce' : ''}${hacimTxt ? ' · '+hacimTxt : ''}</div></div>`;
        html += `<div style="display:flex;align-items:center;gap:6px"><span style="font-size:15px;font-weight:700;color:${isPositive?'#4ade80':'#f87171'}">${isPositive?'+':''}${fark}%</span><span style="font-size:9px;color:#475569">${isOpen?'▲':'▼'}</span></div>`;
        html += `</div>`;
        // Detay açılırsa — çiçek bazlı etki
        if (isOpen && og.topCicekler && og.topCicekler.length > 0) {
          html += `<div style="margin-top:6px;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,0.03)">`;
          html += `<div style="font-size:9px;color:#64748b;margin-bottom:4px">En çok etkilenen çiçekler:</div>`;
          og.topCicekler.forEach(c => {
            const cCl = c.etki > 0 ? "#4ade80" : "#f87171";
            html += `<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:10px"><span style="color:#e2e8f0">${esc(c.cicek)}</span><span style="color:${cCl};font-weight:600">${c.etki>0?'+':''}${c.etki}%</span></div>`;
          });
          html += `</div>`;
        }
        html += `</div>`;
      });
      // Yaklaşan özel gün uyarısı
      const bugun = new Date();
      const yaklasan = [];
      OZEL_GUNLER.forEach(og => {
        const mm = parseInt(og.tarih.substring(0, 2));
        const dd = parseInt(og.tarih.substring(3, 5));
        const ozelDate = new Date(bugun.getFullYear(), mm - 1, dd);
        if (ozelDate < bugun) ozelDate.setFullYear(ozelDate.getFullYear() + 1);
        const gunFarki = Math.round((ozelDate - bugun) / 864e5);
        if (gunFarki <= 30 && gunFarki >= 0) yaklasan.push({ ad: og.ad, gun: gunFarki });
      });
      // Dini bayramlar yaklaşan
      Object.values(DINI_BAYRAMLAR).forEach(db => {
        const yil = String(bugun.getFullYear());
        if (db.tarihler[yil]) {
          const dbDate = new Date(db.tarihler[yil] + "T00:00:00");
          const fark = Math.round((dbDate - bugun) / 864e5);
          if (fark <= 30 && fark >= 0) yaklasan.push({ ad: db.ad, gun: fark });
        }
      });
      // Anneler günü
      const agDate = new Date(getAnnelerGunu(bugun.getFullYear()) + "T00:00:00");
      if (agDate >= bugun) {
        const agFark = Math.round((agDate - bugun) / 864e5);
        if (agFark <= 30) yaklasan.push({ ad: "Anneler Günü", gun: agFark });
      }
      yaklasan.sort((a,b) => a.gun - b.gun);
      if (yaklasan.length > 0) {
        html += `<div style="margin-top:10px;padding:10px;border-radius:8px;background:rgba(250,204,21,0.08);border:1px solid rgba(250,204,21,0.15)">`;
        html += `<div style="font-size:11px;color:#fbbf24;font-weight:600;margin-bottom:4px">⏰ Yaklaşan Özel Günler</div>`;
        yaklasan.forEach(y => { html += `<div style="font-size:12px;color:#fde68a">${y.ad} — ${y.gun} gün sonra</div>`; });
        html += `</div>`;
      }
      html += `</div>`;
    }

    // ── Çiçek Mevsim Takvimi ──
    html += `<div class="card" style="margin-bottom:14px"><div style="font-size:13px;font-weight:700;color:#f8fafc;margin-bottom:6px">🌷 Çiçek Mevsim Takvimi</div>`;
    html += `<div style="font-size:10px;color:#64748b;margin-bottom:8px">Her çiçeğin hangi aylarda aktif olduğu ve mevsimsel endeksi</div>`;
    // Arama kutusu
    html += `<input id="mevsimSearch" type="text" placeholder="Çiçek ara... (ör: frezya, lisyantus)" value="${state.mevsimSearch||''}" oninput="state.mevsimSearch=this.value;clearTimeout(window._msTmr);window._msTmr=setTimeout(function(){window._msScroll=window.scrollY;var el=document.getElementById('mevsimSearch');var pos=el?el.selectionStart:0;render();setTimeout(function(){var el2=document.getElementById('mevsimSearch');if(el2){el2.focus();el2.setSelectionRange(pos,pos)}},0)},200)" style="width:100%;padding:8px 12px;border-radius:8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#e5e7eb;font-size:11px;margin-bottom:8px;outline:none">`;
    // Filtre butonları
    html += `<div style="display:flex;gap:5px;margin-bottom:10px;flex-wrap:wrap">`;
    html += `<button class="preset-btn ${!state.mevsimFilter||state.mevsimFilter==='aktif'?'active':''}" onclick="setState({mevsimFilter:'aktif'})" style="font-size:10px;padding:4px 8px">Son 3 ay aktif</button>`;
    html += `<button class="preset-btn ${state.mevsimFilter==='top20'?'active':''}" onclick="setState({mevsimFilter:'top20'})" style="font-size:10px;padding:4px 8px">En çok satılan 20</button>`;
    html += `<button class="preset-btn ${state.mevsimFilter==='all'?'active':''}" onclick="setState({mevsimFilter:'all'})" style="font-size:10px;padding:4px 8px">Tümü (${Object.keys(sd.cicekMevsim).length})</button>`;
    html += `</div>`;
    html += `<div style="overflow-x:auto"><div style="min-width:450px">`;
    html += `<div style="display:grid;grid-template-columns:100px repeat(12,1fr);gap:2px;margin-bottom:2px"><div style="font-size:8px;color:#475569"></div>`;
    ["O","Ş","M","N","M","H","T","A","E","E","K","A"].forEach((a, i) => {
      html += `<div style="text-align:center;font-size:8px;color:${i+1===buAy?'#fbbf24':'#475569'};font-weight:${i+1===buAy?'700':'400'}">${a}</div>`;
    });
    html += `</div>`;
    // Filtre uygula
    const son3Ay = [buAy, buAy > 1 ? buAy - 1 : 12, buAy > 2 ? buAy - 2 : buAy === 2 ? 12 : 11];
    let cicekSirali = Object.entries(sd.cicekMevsim).map(([c, aylar]) => ({ cicek: c, aylar, totalD: Object.values(aylar).reduce((s, a) => s + a.totalD, 0) })).filter(item => !item.cicek.toLowerCase().includes("saksı") && !item.cicek.toLowerCase().includes("saksi")).sort((a, b) => b.totalD - a.totalD);
    // Arama filtresi
    if (state.mevsimSearch && state.mevsimSearch.trim()) {
      const q = state.mevsimSearch.trim().toUpperCase();
      cicekSirali = cicekSirali.filter(item => item.cicek.toUpperCase().includes(q));
    } else {
      // Kategori filtresi
      const filt = state.mevsimFilter || 'aktif';
      if (filt === 'aktif') {
        cicekSirali = cicekSirali.filter(item => son3Ay.some(m => item.aylar[m]));
      } else if (filt === 'top20') {
        cicekSirali = cicekSirali.slice(0, 20);
      }
      // 'all' ise hepsini göster
    }
    cicekSirali.forEach(item => {
      html += `<div style="display:grid;grid-template-columns:100px repeat(12,1fr);gap:2px;margin-bottom:2px"><div style="font-size:9px;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:4px 0">${esc(item.cicek)}</div>`;
      for (let m = 1; m <= 12; m++) {
        const data = item.aylar[m];
        const detailKey = item.cicek + "|" + m;
        const isOpen = state.mevsimDetail === detailKey;
        if (!data) { html += `<div style="height:22px;border-radius:3px;background:rgba(255,255,255,0.01)"></div>`; }
        else {
          const idx = Math.round(data.ortYuzde * 100);
          let bg;
          if (idx >= 120) bg = "rgba(34,197,94,0.5)";
          else if (idx >= 110) bg = "rgba(34,197,94,0.3)";
          else if (idx >= 100) bg = "rgba(34,197,94,0.15)";
          else if (idx >= 90) bg = "rgba(250,204,21,0.15)";
          else bg = "rgba(239,68,68,0.15)";
          html += `<div onclick="setState({mevsimDetail:state.mevsimDetail==='${esc(detailKey)}'?null:'${esc(detailKey)}'})" style="height:22px;border-radius:3px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:7px;color:#e2e8f0;font-weight:600;cursor:pointer;${isOpen?'outline:2px solid #fbbf24;outline-offset:-1px;':''}">${idx}</div>`;
        }
      }
      html += `</div>`;
      // Haftalık detay satırı — tıklanan ay açılır
      if (state.mevsimDetail && state.mevsimDetail.startsWith(item.cicek + "|")) {
        const detAy = parseInt(state.mevsimDetail.split("|")[1]);
        const haftalik = sd.getHaftalikEndeks(item.cicek, detAy);
        const ayAdi = ayAdlari[detAy] || "";
        if (haftalik.length > 0) {
          const maxIdx = Math.max(...haftalik.map(h => h.endeks));
          const minIdx = Math.min(...haftalik.map(h => h.endeks));
          html += `<div style="grid-column:1/-1;padding:6px 8px;margin:0 0 3px;border-radius:6px;background:rgba(250,204,21,0.05);border:1px solid rgba(250,204,21,0.1)">`;
          html += `<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">`;
          html += `<span style="font-size:9px;color:#fbbf24;font-weight:600;margin-right:2px">${ayAdi}:</span>`;
          haftalik.forEach(h => {
            const isBest = h.endeks === maxIdx && haftalik.length > 1;
            const isWorst = h.endeks === minIdx && haftalik.length > 1 && maxIdx !== minIdx;
            const cl = isBest ? "#4ade80" : isWorst ? "#f87171" : "#cbd5e1";
            const bg = isBest ? "rgba(34,197,94,0.15)" : isWorst ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.04)";
            html += `<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:${bg};color:${cl};font-weight:${isBest||isWorst?'700':'500'}">H${h.hafta}:${h.endeks}</span>`;
          });
          if (maxIdx > minIdx) {
            const diff = maxIdx - minIdx;
            html += `<span style="font-size:8px;color:#64748b;margin-left:4px">fark:${diff}</span>`;
          }
          html += `</div></div>`;
        }
      }
    });
    html += `</div></div>`;
    html += `<div style="font-size:9px;color:#475569;margin-top:4px">${cicekSirali.length} çiçek gösteriliyor</div>`;
    html += `</div>`;

    // ── Sezon Başlangıç/Bitiş Bilgisi ──
    if (sd.cicekSezonBilgi && Object.keys(sd.cicekSezonBilgi).length > 0) {
      const sezonList = cicekSirali.filter(item => sd.cicekSezonBilgi[item.cicek]).slice(0, state.expanded.sezonBilgi ? 999 : 8);
      if (sezonList.length > 0) {
        html += `<div class="card" style="margin-bottom:14px"><div style="font-size:13px;font-weight:700;color:#f8fafc;margin-bottom:6px">📅 Sezon Başlangıç & Bitiş Takvimi</div>`;
        html += `<div style="font-size:10px;color:#64748b;margin-bottom:10px">Her çiçeğin sezonu genelde hangi haftada başlayıp bitiyor ve ±kaç gün oynayabiliyor</div>`;
        sezonList.forEach((item, i) => {
          const sb = sd.cicekSezonBilgi[item.cicek];
          if (!sb) return;
          // Hafta numarasını yaklaşık tarihe çevir
          const haftaToTarih = function(h) {
            const aylar = ["","Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
            const gun = (h - 1) * 7 + 1;
            const d = new Date(2026, 0, gun);
            return d.getDate() + " " + aylar[d.getMonth() + 1];
          };
          const basStr = haftaToTarih(sb.basOrt);
          const sonStr = haftaToTarih(sb.sonOrt);
          const sezonUzunluk = sb.sonOrt - sb.basOrt;
          // Sezon bar görseli (52 hafta üzerinde)
          const barStart = Math.max(0, (sb.basOrt / 52) * 100);
          const barWidth = Math.max(5, (sezonUzunluk / 52) * 100);
          html += `<div style="padding:6px 0;border-top:${i>0?'1px solid rgba(255,255,255,0.03)':'none'}">`;
          html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">`;
          html += `<div style="font-size:11px;font-weight:600;color:#e2e8f0">${esc(item.cicek)}</div>`;
          html += `<div style="font-size:9px;color:#64748b">${sb.yilSayisi} yıl verisi</div>`;
          html += `</div>`;
          // Sezon bar
          html += `<div style="position:relative;height:8px;background:rgba(255,255,255,0.03);border-radius:4px;margin-bottom:3px">`;
          html += `<div style="position:absolute;left:${barStart}%;width:${barWidth}%;height:100%;border-radius:4px;background:linear-gradient(90deg,#22c55e,#4ade80,#22c55e)"></div>`;
          html += `</div>`;
          html += `<div style="display:flex;justify-content:space-between;font-size:9px">`;
          const yuksekSapma = sb.basStd > 60 || sb.sonStd > 60;
          if (yuksekSapma) {
            html += `<span style="color:#f87171">⚠ Düşük tutarlılık — sezon penceresi çok geniş</span>`;
          } else {
            html += `<span style="color:#6ee7b7">Başlangıç: ~${basStr} <span style="color:#475569">±${sb.basStd} gün</span></span>`;
            html += `<span style="color:#fca5a5">Bitiş: ~${sonStr} <span style="color:#475569">±${sb.sonStd} gün</span></span>`;
          }
          html += `</div></div>`;
        });
        const totalSezon = cicekSirali.filter(item => sd.cicekSezonBilgi[item.cicek]).length;
        if (totalSezon > 8) html += `<button class="show-more" onclick="toggleExp('sezonBilgi')">${state.expanded.sezonBilgi?'Daha az ▲':'Tümü ('+totalSezon+') ▼'}</button>`;
        html += `</div>`;
      }
    }

    // ── Bu Ay Durumun ──
    const buAyData = sd.aylarData[buAy - 1];
    if (buAyData && buAyData.ortYuzde !== null && sd.ort2026 > 0) {
      const buAyFiltre = ALL_DATA.filter(r => r.t.startsWith("2026-" + String(buAy).padStart(2, "0")));
      const buAyD = buAyFiltre.reduce((s, r) => s + r.d, 0);
      const buAyDbn = buAyD > 0 ? buAyFiltre.reduce((s, r) => s + r.net, 0) / buAyD : 0;
      const beklenen = sd.ort2026 * buAyData.ortYuzde;
      const fark = beklenen > 0 ? ((buAyDbn - beklenen) / beklenen * 100) : 0;
      const farkLabel = Math.abs(fark) < 2 ? 'Beklentiyle Uyumlu' : fark >= 2 ? 'Beklentinin Üstünde' : 'Beklentinin Altında';
      const farkColor = Math.abs(fark) < 2 ? '#60a5fa' : fark >= 2 ? '#4ade80' : '#f87171';
      const farkBg = Math.abs(fark) < 2 ? 'rgba(96,165,250,0.06)' : fark >= 2 ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)';
      const farkBorder = Math.abs(fark) < 2 ? 'rgba(96,165,250,0.12)' : fark >= 2 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';
      html += `<div class="card" style="margin-bottom:14px;background:${farkBg};border-color:${farkBorder}">`;
      html += `<div style="font-size:13px;font-weight:700;color:${farkColor};margin-bottom:8px">📍 ${ayAdlari[buAy]} 2026 — ${farkLabel}</div>`;
      html += `<div style="display:flex;gap:16px;font-size:12px"><div><div style="font-size:9px;color:#64748b">Beklenen</div><div style="font-size:16px;font-weight:800;color:#94a3b8">${fmt(beklenen)}</div></div><div><div style="font-size:9px;color:#64748b">Gerçekleşen</div><div style="font-size:16px;font-weight:800;color:#f8fafc">${buAyDbn > 0 ? fmt(buAyDbn) : '—'}</div></div><div><div style="font-size:9px;color:#64748b">Fark</div><div style="font-size:16px;font-weight:800;color:${fark>=0?'#4ade80':'#f87171'}">${fark>=0?'+':''}${fark.toFixed(1)}%</div></div></div></div>`;
    }

    html += `<div style="padding:10px;border-radius:8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);font-size:10px;color:#475569;line-height:1.5"><strong style="color:#64748b">Nasıl çalışır?</strong><br>Her ayın fiyatı o yılın kendi ortalamasına bölünür (enflasyondan bağımsız). Uç değerler atılır (Trimmed Mean) ve son yıllara daha fazla ağırlık verilir (Recency Weighting: 2026 → en yüksek, 2019 → en düşük). 100 = yıl ortalaması, 120 = ortalamanın %20 üstü.</div>`;
  }

  // ══ ÇİÇEK ANALİZ ══
  if (state.tab === "cicekanaliz") {
    const sd = getSeasonalData();
    const buAy = new Date().getMonth() + 1;
    const ayAdlari = ["","Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
    const ayKisa = ["","O","Ş","M","N","M","H","T","A","E","E","K","A"];

    html += `<div class="sec-title">🌷 Çiçek Bazlı Mevsimsel Analiz</div>`;
    html += `<div style="font-size:12px;color:#94a3b8;margin-bottom:14px;margin-top:-6px">Çiçek seç → aylık endeks + fiyat projeksiyonu + haftalık detay</div>`;

    // Arama + çiçek seçimi
    html += `<input id="caSearch" type="text" placeholder="Çiçek ara..." value="${state.caSearch||''}" oninput="state.caSearch=this.value;clearTimeout(window._caTmr);window._caTmr=setTimeout(function(){window._msScroll=window.scrollY;var el=document.getElementById('caSearch');var pos=el?el.selectionStart:0;render();setTimeout(function(){var el2=document.getElementById('caSearch');if(el2){el2.focus();el2.setSelectionRange(pos,pos)}},200)},200)" style="width:100%;padding:8px 12px;border-radius:8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#e5e7eb;font-size:11px;margin-bottom:8px;outline:none">`;

    // Çiçek listesi — filtrelenmiş
    const son3Ay = [buAy, buAy > 1 ? buAy - 1 : 12, buAy > 2 ? buAy - 2 : buAy === 2 ? 12 : 11];
    let caList = Object.entries(sd.cicekMevsim).map(([c, aylar]) => ({ cicek: c, aylar, totalD: Object.values(aylar).reduce((s, a) => s + a.totalD, 0) })).sort((a, b) => b.totalD - a.totalD);
    if (state.caSearch && state.caSearch.trim()) {
      const q = state.caSearch.trim().toUpperCase();
      caList = caList.filter(item => item.cicek.toUpperCase().includes(q));
    }

    // Çiçek butonları (top 20 veya arama sonuçları)
    html += `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:14px">`;
    caList.slice(0, 20).forEach(item => {
      const isActive = state.caSecim === item.cicek;
      html += `<button onclick="setState({caSecim:'${esc(item.cicek)}'})" style="padding:5px 10px;border-radius:6px;border:1px solid ${isActive?'#7c3aed':'rgba(255,255,255,0.08)'};background:${isActive?'rgba(124,58,237,0.2)':'rgba(255,255,255,0.04)'};color:${isActive?'#c4b5fd':'#94a3b8'};font-size:10px;cursor:pointer;font-weight:${isActive?'700':'400'}">${esc(item.cicek)}</button>`;
    });
    html += `</div>`;

    // Seçili çiçek detayı
    const secili = state.caSecim ? caList.find(c => c.cicek === state.caSecim) : caList[0];
    if (secili) {
      if (!state.caSecim) state.caSecim = secili.cicek;
      const cicekMevsim = secili.aylar;

      // ── 📈 Mezat Fiyat Grafiği (Paket 1) ──
      if (!state.mezatLegend) state.mezatLegend = { fiyat: true, ewmaFast: true, ewmaMid: true, sma5: true, sma3: false, sma10: false, sma20: false };
      const mzSubeMap = {};
      ALL_DATA.forEach(r => { if (r.c === secili.cicek) mzSubeMap[r.s] = (mzSubeMap[r.s] || 0) + r.d; });
      const mzSubeler = Object.entries(mzSubeMap).sort((a, b) => b[1] - a[1]).map(e => e[0]);
      const mzSube = state.mezatSube && mzSubeler.includes(state.mezatSube) ? state.mezatSube : null;
      const ms = getMezatSerisi(secili.cicek, mzSube, 30);

      html += `<div class="card" style="margin-bottom:14px">`;
      html += `<div style="font-size:13px;font-weight:700;color:#f8fafc;margin-bottom:8px">📈 Mezat Fiyat Grafiği <span style="font-size:9px;color:#64748b;font-weight:400">son ${ms.n} mezat günü</span></div>`;

      // Şube chip'leri
      html += `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px">`;
      const mzChip = (label, val) => {
        const aktif = mzSube === val;
        return `<button onclick="setState({mezatSube:${val === null ? 'null' : "'" + esc(val) + "'"}})" style="padding:4px 9px;border-radius:6px;border:1px solid ${aktif ? '#7c3aed' : 'rgba(255,255,255,0.08)'};background:${aktif ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)'};color:${aktif ? '#c4b5fd' : '#94a3b8'};font-size:9px;cursor:pointer;font-weight:${aktif ? '700' : '400'}">${esc(label)}</button>`;
      };
      html += mzChip("Tümü", null);
      mzSubeler.slice(0, 12).forEach(s => { html += mzChip(s, s); });
      html += `</div>`;

      if (ms.n < 5) {
        html += `<div style="padding:20px;text-align:center;font-size:12px;color:#fbbf24">Bu çiçek/şube için yetersiz mezat verisi (n=${ms.n})</div>`;
      } else {
        // Metrik şeridi — 5 kompakt kutu (null → gri "yetersiz veri")
        const son = ms.seri[ms.n - 1];
        const mBox = (label, val, sub, renk) => `<div style="flex:1;min-width:98px;padding:6px 8px;border-radius:8px;background:${val === null ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.03)'};border:1px solid rgba(255,255,255,0.05)"><div style="font-size:7px;color:#64748b;text-transform:uppercase">${label}</div><div style="font-size:11px;font-weight:700;color:${val === null ? '#475569' : (renk || '#e2e8f0')}">${val === null ? 'yetersiz veri' : val}</div>${sub && val !== null ? `<div style="font-size:7px;color:#64748b">${sub}</div>` : ''}</div>`;
        const egimOk = ms.slopeYon === "yükseliş" ? "▲" : ms.slopeYon === "düşüş" ? "▼" : "→";
        const egimRenk = ms.slopeYon === "yükseliş" ? "#34d399" : ms.slopeYon === "düşüş" ? "#f87171" : "#94a3b8";
        html += `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px">`;
        html += mBox("Son", `${fmt(son.dbn)}/dm`, fD(son.t) + (son.v2 ? "" : " · tahmini"), "#34d399");
        html += mBox("Eğim", ms.slope === null ? null : `${ms.slope >= 0 ? "+" : ""}${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(ms.slope)} ₺/mezat ${egimOk}`, ms.slopeKisa ? "kısa seri" : null, egimRenk);
        html += mBox("Momentum", ms.roc3 === null ? null : `${ms.roc3 >= 0 ? "+" : ""}%${Math.abs(ms.roc3).toFixed(0)}`, ms.roc3Uyari ? "⚠ aykırı son fiyat etkisi" : "son 3 mezat", ms.roc3 >= 0 ? "#34d399" : "#f87171");
        html += mBox("Volatilite", ms.cv === null ? null : `%${ms.cv.toFixed(0)}`, ms.cvKisa ? "kısa seri" : "son 10 mezat", ms.cv !== null && ms.cv > 30 ? "#fbbf24" : "#e2e8f0");
        html += mBox("Yapı", ms.fan, null, ms.fan && ms.fan.includes("yükseliş") ? "#34d399" : ms.fan && ms.fan.includes("düşüş") ? "#f87171" : "#94a3b8");
        html += `</div>`;

        // Grafik
        html += buildMezatChart(ms);

        // Legend — aç/kapa toggle (yetersiz SMA'lar soluk/pasif)
        const legendTanim = [
          ["fiyat", "Fiyat", "#34d399", true],
          ["ewmaFast", "EWMA hızlı", "#fbbf24", true],
          ["ewmaMid", "EWMA orta", "#a78bfa", true],
          ["sma5", "SMA5", "#60a5fa", ms.n >= 5],
          ["sma3", "SMA3", "#f472b6", ms.n >= 3],
          ["sma10", "SMA10", "#2dd4bf", ms.n >= 10],
          ["sma20", "SMA20", "#94a3b8", ms.n >= 20]
        ];
        html += `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">`;
        legendTanim.forEach(([key, ad, renk, uygun]) => {
          const acik = state.mezatLegend[key];
          if (!uygun) {
            html += `<span style="display:flex;align-items:center;gap:3px;font-size:8px;color:#334155"><span style="width:8px;height:2px;background:#334155;display:inline-block"></span>${ad}</span>`;
          } else {
            html += `<span onclick="mezatLegendToggle('${key}')" style="display:flex;align-items:center;gap:3px;font-size:8px;color:${acik ? '#cbd5e1' : '#475569'};cursor:pointer;${acik ? '' : 'text-decoration:line-through'}"><span style="width:8px;height:2px;background:${acik ? renk : '#475569'};display:inline-block"></span>${ad}</span>`;
          }
        });
        html += `</div>`;

        // v1 dipnotu
        if (ms.seri.some(p => !p.v2)) {
          html += `<div style="font-size:8px;color:#475569;margin-top:6px">ℹ 31 Tem öncesi noktalar tahmini %20 net modeliyle (içi boş)</div>`;
        }
      }
      html += `</div>`;

      // ── Aylık Mevsimsel Endeks (çiçek bazlı) ──
      html += `<div class="card" style="margin-bottom:14px"><div style="font-size:13px;font-weight:700;color:#c4b5fd;margin-bottom:8px">📊 ${esc(secili.cicek)} — Aylık Mevsimsel Endeks</div>`;
      html += `<div style="font-size:10px;color:#64748b;margin-bottom:10px">100 = bu çiçeğin yıl ortalaması</div>`;
      html += `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">`;
      for (let m = 1; m <= 12; m++) {
        const data = cicekMevsim[m];
        const isBuAy = m === buAy;
        if (!data) {
          html += `<div style="padding:8px 4px;text-align:center;border-radius:8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04)"><div style="font-size:10px;color:#333">${ayKisa[m]}</div><div style="font-size:12px;color:#333">—</div></div>`;
        } else {
          const idx = Math.round(data.ortYuzde * 100);
          let bg, cl;
          if (idx >= 115) { bg = "rgba(34,197,94,0.2)"; cl = "#4ade80"; }
          else if (idx >= 105) { bg = "rgba(34,197,94,0.1)"; cl = "#6ee7b7"; }
          else if (idx >= 95) { bg = "rgba(255,255,255,0.04)"; cl = "#e2e8f0"; }
          else if (idx >= 85) { bg = "rgba(239,68,68,0.08)"; cl = "#fca5a5"; }
          else { bg = "rgba(239,68,68,0.15)"; cl = "#f87171"; }
          const border = isBuAy ? "border:2px solid #fbbf24" : "border:1px solid rgba(255,255,255,0.06)";
          html += `<div style="padding:8px 4px;text-align:center;border-radius:8px;background:${bg};${border};cursor:pointer" onclick="setState({mevsimDetail:state.mevsimDetail==='ca_${esc(secili.cicek)}|${m}'?null:'ca_${esc(secili.cicek)}|${m}'})">`;
          html += `<div style="font-size:10px;color:#94a3b8">${ayAdlari[m]}${isBuAy?' 📍':''}</div>`;
          html += `<div style="font-size:18px;font-weight:800;color:${cl}">${idx}</div>`;
          html += `<div style="font-size:8px;color:#475569">${data.yilSayisi} yıl</div>`;
          // Haftalık detay açılmış mı?
          if (state.mevsimDetail === 'ca_' + secili.cicek + '|' + m) {
            const haftalik = sd.getHaftalikEndeks(secili.cicek, m);
            if (haftalik.length > 0) {
              html += `<div style="margin-top:4px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.08);display:flex;gap:2px;justify-content:center">`;
              const maxH = Math.max(...haftalik.map(h => h.endeks));
              const minH = Math.min(...haftalik.map(h => h.endeks));
              haftalik.forEach(h => {
                const hCl = h.endeks === maxH && haftalik.length > 1 ? "#4ade80" : h.endeks === minH && haftalik.length > 1 && maxH !== minH ? "#f87171" : "#94a3b8";
                html += `<div style="font-size:7px;color:${hCl};font-weight:600;line-height:1.3">H${h.hafta}<br>${h.endeks}</div>`;
              });
              html += `</div>`;
            }
          }
          html += `</div>`;
        }
      }
      html += `</div></div>`;

      // ── 2026 Fiyat Projeksiyonu (çiçek bazlı) — EMA ──
      const cicek2026 = ALL_DATA.filter(r => r.t.startsWith("2026") && r.c === secili.cicek);
      // EMA hesapla — çiçek bazlı
      const cGunMap = {};
      cicek2026.forEach(r => { if (!cGunMap[r.t]) cGunMap[r.t] = {net:0,d:0}; cGunMap[r.t].net += r.net; cGunMap[r.t].d += r.d; });
      const cGunSirali = Object.entries(cGunMap).sort((a,b) => a[0].localeCompare(b[0])).map(e => e[1].d > 0 ? e[1].net / e[1].d : 0).filter(v => v > 0);
      let cicekEma = 0;
      if (cGunSirali.length > 0) {
        const alpha = 2 / (Math.min(20, cGunSirali.length) + 1);
        cicekEma = cGunSirali[0];
        for (let ei = 1; ei < cGunSirali.length; ei++) { cicekEma = alpha * cGunSirali[ei] + (1 - alpha) * cicekEma; }
      }
      const cicekOrt2026 = cicekEma > 0 ? cicekEma : (cicek2026.reduce((s,r) => s+r.d, 0) > 0 ? cicek2026.reduce((s,r) => s+r.net, 0) / cicek2026.reduce((s,r) => s+r.d, 0) : 0);

      if (cicekOrt2026 > 0) {
        html += `<div class="card" style="margin-bottom:14px;background:rgba(168,85,247,0.06);border-color:rgba(168,85,247,0.12)">`;
        html += `<div style="font-size:13px;font-weight:700;color:#c4b5fd;margin-bottom:8px">🔮 ${esc(secili.cicek)} — 2026 Fiyat Projeksiyonu</div>`;
        html += `<div style="font-size:10px;color:#64748b;margin-bottom:10px">Baz: ${fmt(cicekOrt2026)}/dm (EMA) × mevsimsel endeks</div>`;
        html += `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">`;
        for (let m = 1; m <= 12; m++) {
          const data = cicekMevsim[m];
          const isBuAy = m === buAy;
          const isPast = m < buAy;
          if (!data) {
            html += `<div style="padding:6px 4px;text-align:center;border-radius:8px;background:rgba(255,255,255,0.02)"><div style="font-size:9px;color:#333">${ayKisa[m]}</div><div style="font-size:10px;color:#333">—</div></div>`;
          } else {
            const proj = cicekOrt2026 * data.ortYuzde;
            const dusukVeri = data.yilSayisi <= 2;
            // Çiçek bazlı güven aralığı hesapla — bu çiçeğin bu ayındaki yıllık oranların std sapması
            const cYilOranlar = [];
            const cYilOrtTmp = {};
            ALL_DATA.filter(r => r.c === secili.cicek).forEach(r => { const y=r.t.substring(0,4); if(!cYilOrtTmp[y]) cYilOrtTmp[y]={net:0,d:0}; cYilOrtTmp[y].net+=r.net; cYilOrtTmp[y].d+=r.d; });
            ALL_DATA.filter(r => r.c === secili.cicek && parseInt(r.t.substring(5,7)) === m).forEach(r => {
              const y=r.t.substring(0,4); if(!cYilOranlar._t) cYilOranlar._t={}; if(!cYilOranlar._t[y]) cYilOranlar._t[y]={net:0,d:0}; cYilOranlar._t[y].net+=r.net; cYilOranlar._t[y].d+=r.d;
            });
            let altProj = null, ustProj = null;
            if (cYilOranlar._t) {
              const oranlar = [];
              Object.entries(cYilOranlar._t).forEach(([y,v]) => { const yd = cYilOrtTmp[y]&&cYilOrtTmp[y].d>0?cYilOrtTmp[y].net/cYilOrtTmp[y].d:0; if(yd>0&&v.d>0) oranlar.push((v.net/v.d)/yd); });
              if (oranlar.length >= 2) {
                const oOrt = oranlar.reduce((s,x)=>s+x,0)/oranlar.length;
                const oStd = Math.sqrt(oranlar.reduce((s,x)=>s+Math.pow(x-oOrt,2),0)/oranlar.length);
                altProj = cicekOrt2026 * Math.max(0.3, oOrt - 1.96 * oStd);
                ustProj = cicekOrt2026 * (oOrt + 1.96 * oStd);
              }
            }
            html += `<div style="padding:6px 4px;text-align:center;border-radius:8px;background:${isBuAy?'rgba(250,204,21,0.1)':'rgba(255,255,255,0.03)'};border:1px solid ${isBuAy?'rgba(250,204,21,0.2)':'rgba(255,255,255,0.04)'};${dusukVeri?'opacity:0.5':''}">`;
            html += `<div style="font-size:9px;color:${isPast?'#475569':'#94a3b8'}">${ayAdlari[m]}${dusukVeri?' <span style="font-size:6px;color:#f87171">!</span>':''}</div>`;
            html += `<div style="font-size:14px;font-weight:700;color:${isBuAy?'#fbbf24':isPast?'#64748b':'#c4b5fd'}">${fmt(proj)}</div>`;
            if (altProj && ustProj && !isPast) {
              html += `<div style="font-size:7px;color:#475569">${fmt(altProj)}–${fmt(ustProj)}</div>`;
            }
            html += `</div>`;
          }
        }
        html += `</div></div>`;
      }

      // ── Bu Ay Karşılaştırma (çiçek bazlı) ──
      const buAyMevsim = cicekMevsim[buAy];
      if (buAyMevsim && cicekOrt2026 > 0) {
        const buAyData = cicek2026.filter(r => parseInt(r.t.substring(5,7)) === buAy);
        const buAyDbn = buAyData.reduce((s,r) => s+r.d, 0) > 0 ? buAyData.reduce((s,r) => s+r.net, 0) / buAyData.reduce((s,r) => s+r.d, 0) : 0;
        const beklenen = cicekOrt2026 * buAyMevsim.ortYuzde;
        const fark = beklenen > 0 ? ((buAyDbn - beklenen) / beklenen * 100) : 0;
        if (buAyDbn > 0) {
          const fL = Math.abs(fark) < 2 ? 'Beklentiyle Uyumlu' : fark >= 2 ? 'Beklentinin Üstünde' : 'Beklentinin Altında';
          const fC = Math.abs(fark) < 2 ? '#60a5fa' : fark >= 2 ? '#4ade80' : '#f87171';
          const fBg = Math.abs(fark) < 2 ? 'rgba(96,165,250,0.06)' : fark >= 2 ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)';
          const fBr = Math.abs(fark) < 2 ? 'rgba(96,165,250,0.12)' : fark >= 2 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';
          html += `<div class="card" style="margin-bottom:14px;background:${fBg};border-color:${fBr}">`;
          html += `<div style="font-size:12px;font-weight:700;color:${fC};margin-bottom:6px">📍 ${ayAdlari[buAy]} — ${fL}</div>`;
          html += `<div style="display:flex;gap:14px;font-size:12px"><div><div style="font-size:9px;color:#64748b">Beklenen</div><div style="font-size:15px;font-weight:800;color:#94a3b8">${fmt(beklenen)}</div></div><div><div style="font-size:9px;color:#64748b">Gerçekleşen</div><div style="font-size:15px;font-weight:800;color:#f8fafc">${fmt(buAyDbn)}</div></div><div><div style="font-size:9px;color:#64748b">Fark</div><div style="font-size:15px;font-weight:800;color:${fark>=0?'#4ade80':'#f87171'}">${fark>=0?'+':''}${fark.toFixed(1)}%</div></div></div></div>`;
        }
      }

      // ── Aktif aylar özeti ──
      const aktifAylar = Object.keys(cicekMevsim).map(Number).sort((a,b) => a - b);
      const enIyiAy = aktifAylar.reduce((best, m) => cicekMevsim[m].ortYuzde > (cicekMevsim[best]?.ortYuzde || 0) ? m : best, aktifAylar[0]);
      const enKotuAy = aktifAylar.reduce((worst, m) => cicekMevsim[m].ortYuzde < (cicekMevsim[worst]?.ortYuzde || 999) ? m : worst, aktifAylar[0]);
      html += `<div style="padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.04);font-size:11px;color:#94a3b8;margin-bottom:14px">`;
      html += `Aktif aylar: <strong style="color:#e2e8f0">${aktifAylar.map(m => ayKisa[m]).join(", ")}</strong> (${aktifAylar.length} ay)`;
      html += ` · En iyi: <strong style="color:#4ade80">${ayAdlari[enIyiAy]} (${Math.round(cicekMevsim[enIyiAy].ortYuzde * 100)})</strong>`;
      html += ` · En düşük: <strong style="color:#f87171">${ayAdlari[enKotuAy]} (${Math.round(cicekMevsim[enKotuAy].ortYuzde * 100)})</strong>`;
      html += `</div>`;

      // ── Z-Score: Bu ay fırsat mı risk mi? ──
      const buAyMevsimZ = cicekMevsim[buAy];
      if (buAyMevsimZ && cicekOrt2026 > 0) {
        const buAyCicekData = cicek2026.filter(r => parseInt(r.t.substring(5,7)) === buAy);
        const buAyCicekDbn = buAyCicekData.reduce((s,r) => s+r.d, 0) > 0 ? buAyCicekData.reduce((s,r) => s+r.net, 0) / buAyCicekData.reduce((s,r) => s+r.d, 0) : 0;
        if (buAyCicekDbn > 0) {
          // Geçmiş yılların bu ayındaki oranları al
          const gecmisOranlar = [];
          ALL_DATA.filter(r => r.c === secili.cicek && parseInt(r.t.substring(5,7)) === buAy).forEach(r => {
            const yil = r.t.substring(0,4);
            if (yil === String(new Date().getFullYear())) return;
            if (!gecmisOranlar._tmp) gecmisOranlar._tmp = {};
            if (!gecmisOranlar._tmp[yil]) gecmisOranlar._tmp[yil] = {net:0,d:0};
            gecmisOranlar._tmp[yil].net += r.net; gecmisOranlar._tmp[yil].d += r.d;
          });
          if (gecmisOranlar._tmp) {
            const oranlar = [];
            const cicekYilOrtTmp = {};
            ALL_DATA.filter(r => r.c === secili.cicek).forEach(r => {
              const y = r.t.substring(0,4);
              if (!cicekYilOrtTmp[y]) cicekYilOrtTmp[y] = {net:0,d:0};
              cicekYilOrtTmp[y].net += r.net; cicekYilOrtTmp[y].d += r.d;
            });
            Object.entries(gecmisOranlar._tmp).forEach(([yil, v]) => {
              const yilDbnC = cicekYilOrtTmp[yil] && cicekYilOrtTmp[yil].d > 0 ? cicekYilOrtTmp[yil].net / cicekYilOrtTmp[yil].d : 0;
              if (yilDbnC > 0 && v.d > 0) oranlar.push((v.net / v.d) / yilDbnC);
            });
            if (oranlar.length >= 2) {
              const mevsOrt = oranlar.reduce((s,x) => s+x, 0) / oranlar.length;
              const mevsStd = Math.sqrt(oranlar.reduce((s,x) => s + Math.pow(x - mevsOrt, 2), 0) / oranlar.length);
              const buAyOran = buAyCicekDbn / cicekOrt2026;
              const zScore = mevsStd > 0 ? ((buAyOran - mevsOrt) / mevsStd) : 0;
              const zLabel = zScore > 1.5 ? "🔥 Olağanüstü Fırsat" : zScore > 0.5 ? "📈 Ortalamanın Üstünde" : zScore > -0.5 ? "➡️ Normal" : zScore > -1.5 ? "📉 Ortalamanın Altında" : "⚠️ Dikkat — Çok Düşük";
              const zColor = zScore > 1.5 ? "#4ade80" : zScore > 0.5 ? "#6ee7b7" : zScore > -0.5 ? "#94a3b8" : zScore > -1.5 ? "#fbbf24" : "#f87171";
              html += `<div class="card" style="margin-bottom:14px;background:${zScore>0.5?'rgba(34,197,94,0.06)':zScore<-0.5?'rgba(239,68,68,0.06)':'rgba(255,255,255,0.03)'};border-color:${zScore>0.5?'rgba(34,197,94,0.12)':zScore<-0.5?'rgba(239,68,68,0.12)':'rgba(255,255,255,0.06)'}">`;
              html += `<div style="font-size:12px;font-weight:700;color:${zColor};margin-bottom:6px">${zLabel}</div>`;
              html += `<div style="display:flex;gap:14px;font-size:11px">`;
              html += `<div><span style="color:#64748b">Z-Score:</span> <strong style="color:${zColor}">${zScore>=0?'+':''}${zScore.toFixed(2)}</strong></div>`;
              html += `<div><span style="color:#64748b">Şu an:</span> <strong style="color:#f8fafc">${fmt(buAyCicekDbn)}</strong></div>`;
              html += `<div><span style="color:#64748b">Beklenen:</span> <strong style="color:#94a3b8">${fmt(cicekOrt2026 * mevsOrt)}</strong></div>`;
              html += `</div>`;
              html += `<div style="font-size:9px;color:#475569;margin-top:4px">${oranlar.length} yıl verisine göre. Z>1.5 = nadir fırsat, Z<-1.5 = nadir düşüklük</div>`;
              html += `</div>`;
            }
          }
        }
      }

      // ── Aylık Güven Seviyesi (varyans bazlı) ──
      html += `<div class="card" style="margin-bottom:14px"><div style="font-size:13px;font-weight:700;color:#f8fafc;margin-bottom:8px">📊 Aylık Endeks Güvenilirliği</div>`;
      html += `<div style="font-size:10px;color:#64748b;margin-bottom:8px">Yıllar arası tutarlılık — dar bant = güvenilir, geniş bant = oynak</div>`;
      html += `<div style="display:flex;gap:4px;flex-wrap:wrap">`;
      aktifAylar.forEach(m => {
        // Bu çiçeğin bu ayındaki yıllık oranları
        const yilOranlar = [];
        const cicekYilOrtTmp2 = {};
        ALL_DATA.filter(r => r.c === secili.cicek).forEach(r => {
          const y = r.t.substring(0,4); if (!cicekYilOrtTmp2[y]) cicekYilOrtTmp2[y] = {net:0,d:0}; cicekYilOrtTmp2[y].net += r.net; cicekYilOrtTmp2[y].d += r.d;
        });
        ALL_DATA.filter(r => r.c === secili.cicek && parseInt(r.t.substring(5,7)) === m).forEach(r => {
          const y = r.t.substring(0,4);
          if (!yilOranlar._tmp) yilOranlar._tmp = {};
          if (!yilOranlar._tmp[y]) yilOranlar._tmp[y] = {net:0,d:0};
          yilOranlar._tmp[y].net += r.net; yilOranlar._tmp[y].d += r.d;
        });
        const oranlar2 = [];
        if (yilOranlar._tmp) {
          Object.entries(yilOranlar._tmp).forEach(([y, v]) => {
            const yDbn = cicekYilOrtTmp2[y] && cicekYilOrtTmp2[y].d > 0 ? cicekYilOrtTmp2[y].net / cicekYilOrtTmp2[y].d : 0;
            if (yDbn > 0 && v.d > 0) oranlar2.push((v.net / v.d) / yDbn);
          });
        }
        let gLabel = "—", gColor = "#475569";
        if (oranlar2.length >= 2) {
          const oOrt = oranlar2.reduce((s,x) => s+x, 0) / oranlar2.length;
          const oStd = Math.sqrt(oranlar2.reduce((s,x) => s + Math.pow(x - oOrt, 2), 0) / oranlar2.length);
          const cv = oOrt > 0 ? (oStd / oOrt * 100) : 0;
          if (cv <= 10) { gLabel = "●"; gColor = "#4ade80"; }
          else if (cv <= 20) { gLabel = "●"; gColor = "#fbbf24"; }
          else { gLabel = "●"; gColor = "#f87171"; }
        }
        html += `<div style="text-align:center;padding:4px 6px;border-radius:4px;background:rgba(255,255,255,0.03);min-width:30px"><div style="font-size:8px;color:#64748b">${ayKisa[m]}</div><div style="font-size:12px;color:${gColor}">${gLabel}</div></div>`;
      });
      html += `</div>`;
      html += `<div style="font-size:8px;color:#475569;margin-top:4px">🟢 CV≤10% güvenilir · 🟡 CV≤20% orta · 🔴 CV>20% oynak</div>`;
      html += `</div>`;

      // ── Şube Bazlı Diferansiyel ──
      const cicekSubeAy = {};
      ALL_DATA.filter(r => r.c === secili.cicek && !r.s.toLowerCase().includes("saksı")).forEach(r => {
        const ay = parseInt(r.t.substring(5,7));
        if (!cicekSubeAy[r.s]) cicekSubeAy[r.s] = {};
        if (!cicekSubeAy[r.s][ay]) cicekSubeAy[r.s][ay] = {net:0,d:0};
        cicekSubeAy[r.s][ay].net += r.net; cicekSubeAy[r.s][ay].d += r.d;
      });
      // Bu ayda aktif şubeler — minimum 3dm eşiği ile filtrele
      const subePerf = Object.entries(cicekSubeAy).map(([sube, aylar]) => {
        const buAyV = aylar[buAy];
        const buAyDbn = buAyV && buAyV.d > 0 ? buAyV.net / buAyV.d : 0;
        const buAyD = buAyV ? buAyV.d : 0;
        const toplamD = Object.values(aylar).reduce((s,v) => s + v.d, 0);
        return { sube, buAyDbn, buAyD, toplamD, aktifAySayisi: Object.keys(aylar).length };
      }).filter(s => s.buAyDbn > 0 && s.buAyD >= 3).sort((a,b) => b.buAyDbn - a.buAyDbn);

      if (subePerf.length > 0) {
        html += `<div class="card" style="margin-bottom:14px"><div style="font-size:13px;font-weight:700;color:#f8fafc;margin-bottom:8px">📍 ${esc(secili.cicek)} — Şube Performansı (${ayAdlari[buAy]})</div>`;
        html += `<div style="font-size:10px;color:#64748b;margin-bottom:8px">Bu çiçeği bu ay hangi şubeye göndermek daha kârlı? (min 3dm)</div>`;
        const maxSubeDbn = subePerf[0].buAyDbn;
        subePerf.slice(0, 8).forEach((s, i) => {
          const w = maxSubeDbn > 0 ? (s.buAyDbn / maxSubeDbn * 100) : 0;
          const isBest = i === 0 && s.buAyD >= 5; // Kazanan en az 5dm olmalı
          const guvenTxt = s.buAyD < 5 ? ' <span style="color:#f87171;font-size:7px">⚠az</span>' : s.buAyD < 15 ? ' <span style="color:#fbbf24;font-size:7px">◐</span>' : '';
          html += `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:${i>0?'1px solid rgba(255,255,255,0.03)':'none'}">`;
          html += `<div style="width:70px;font-size:10px;font-weight:${isBest?'700':'500'};color:${isBest?'#4ade80':'#e2e8f0'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${isBest?'🏆 ':''}${esc(s.sube)}</div>`;
          html += `<div style="flex:1;height:5px;background:rgba(255,255,255,0.04);border-radius:3px"><div style="height:100%;border-radius:3px;width:${w}%;background:${isBest?'#4ade80':'rgba(148,163,184,0.3)'}"></div></div>`;
          html += `<div style="width:50px;text-align:right;font-size:12px;font-weight:700;color:${isBest?'#4ade80':'#cbd5e1'}">${fmt(s.buAyDbn)}</div>`;
          html += `<div style="width:35px;text-align:right;font-size:9px;color:#64748b">${s.buAyD}dm${guvenTxt}</div>`;
          html += `</div>`;
        });
        html += `</div>`;
      } else {
        html += `<div class="card" style="margin-bottom:14px;text-align:center;padding:16px;color:#475569;font-size:11px">📍 ${esc(secili.cicek)} — ${ayAdlari[buAy]} için yeterli şube verisi yok</div>`;
      }

    } else {
      html += `<div class="card" style="text-align:center;padding:30px;color:#475569;font-size:13px">Çiçek bulunamadı. Arama terimini değiştirin.</div>`;
    }
  }

  // ══ TAHMİN & RİSK ══
  if (state.tab === "tahtrend") {
    const sd = getSeasonalData();
    const fc = getForecast();

    // ── FİYAT TAHMİNİ ──
    if (fc.genelTahmin.merkez > 0) {
      html += `<div class="sec-title">🔮 Önümüzdeki Hafta Fiyat Tahmini</div>`;
      html += `<div style="font-size:12px;color:#94a3b8;margin-bottom:14px;margin-top:-6px">Geçmiş ${fc.genelTahmin.yilSayisi} yılın aynı haftası + son 2 hafta trendi</div>`;

      const guvenRenk = fc.genelTahmin.guven === "yüksek" ? "#4ade80" : fc.genelTahmin.guven === "orta" ? "#fbbf24" : "#f87171";
      const guvenBg = fc.genelTahmin.guven === "yüksek" ? "rgba(34,197,94,0.08)" : fc.genelTahmin.guven === "orta" ? "rgba(250,204,21,0.08)" : "rgba(239,68,68,0.08)";
      const guvenBorder = fc.genelTahmin.guven === "yüksek" ? "rgba(34,197,94,0.15)" : fc.genelTahmin.guven === "orta" ? "rgba(250,204,21,0.15)" : "rgba(239,68,68,0.15)";
      const trendIcon = fc.trendPct > 3 ? "📈" : fc.trendPct < -3 ? "📉" : "➡️";

      html += `<div class="card" style="margin-bottom:14px;background:rgba(168,85,247,0.06);border-color:rgba(168,85,247,0.12);padding:18px">`;
      html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div style="font-size:14px;font-weight:700;color:#c4b5fd">Genel Fiyat Tahmini</div><div style="font-size:10px;padding:3px 8px;border-radius:6px;background:${guvenBg};border:1px solid ${guvenBorder};color:${guvenRenk}">Güven: ${fc.genelTahmin.guven}</div></div>`;
      html += `<div style="text-align:center;margin-bottom:14px"><div style="font-size:10px;color:#64748b">Tahmini Dm Başı Net</div><div style="font-size:32px;font-weight:800;color:#c4b5fd;margin:4px 0">${fmt(fc.genelTahmin.merkez)}</div><div style="font-size:12px;color:#64748b">Bant: ${fmt(fc.genelTahmin.alt)} — ${fmt(fc.genelTahmin.ust)}</div></div>`;
      // Bant görseli
      const bandMin = fc.genelTahmin.alt; const bandMax = fc.genelTahmin.ust; const bandRange = bandMax - bandMin || 1;
      const merkezPos = ((fc.genelTahmin.merkez - bandMin) / bandRange * 100);
      const sonPos = fc.h2Dbn > 0 ? Math.max(0, Math.min(100, ((fc.h2Dbn - bandMin) / bandRange * 100))) : -1;
      html += `<div style="margin-bottom:14px"><div style="position:relative;height:24px;background:linear-gradient(90deg,rgba(239,68,68,0.2),rgba(250,204,21,0.2),rgba(34,197,94,0.2));border-radius:12px;overflow:visible">`;
      html += `<div style="position:absolute;left:${merkezPos}%;top:-2px;transform:translateX(-50%);width:4px;height:28px;background:#c4b5fd;border-radius:2px"></div>`;
      if (sonPos >= 0) html += `<div style="position:absolute;left:${sonPos}%;top:4px;transform:translateX(-50%);width:16px;height:16px;background:#f8fafc;border-radius:50%;border:2px solid #475569;display:flex;align-items:center;justify-content:center;font-size:7px;color:#0b0e18;font-weight:800">⬤</div>`;
      html += `</div><div style="display:flex;justify-content:space-between;margin-top:4px;font-size:9px"><span style="color:#f87171">${fmt(bandMin)}</span><span style="color:#64748b">⬤ Şu an: ${fmt(fc.h2Dbn)}</span><span style="color:#4ade80">${fmt(bandMax)}</span></div></div>`;
      html += `<div style="display:flex;gap:12px;padding:10px;border-radius:8px;background:rgba(255,255,255,0.03)"><div style="flex:1;text-align:center"><div style="font-size:9px;color:#64748b">Son Hafta</div><div style="font-size:14px;font-weight:700;color:#f8fafc">${fmt(fc.h2Dbn)}</div></div><div style="flex:1;text-align:center"><div style="font-size:9px;color:#64748b">Trend</div><div style="font-size:14px;font-weight:700;color:${fc.trendPct>0?'#4ade80':'#f87171'}">${trendIcon} ${fc.trendPct>0?'+':''}${fc.trendPct.toFixed(1)}%</div></div><div style="flex:1;text-align:center"><div style="font-size:9px;color:#64748b">Mevsimsel</div><div style="font-size:14px;font-weight:700;color:#c4b5fd">${fc.genelTahmin.yilSayisi} yıl</div></div></div></div>`;

      // Çiçek bazlı tahmin
      if (fc.cicekTahminleri.length > 0) {
        html += `<div class="card" style="margin-bottom:14px"><div style="font-size:13px;font-weight:700;color:#f8fafc;margin-bottom:10px">🌷 Çiçek Bazlı Tahmin</div>`;
        const tahminShow = state.expanded.tahminCicek ? 999 : 8;
        fc.cicekTahminleri.slice(0, tahminShow).forEach((ct, i) => {
          const trendCl = ct.trend > 3 ? "#4ade80" : ct.trend < -3 ? "#f87171" : "#94a3b8";
          const trendIcn = ct.trend > 3 ? "▲" : ct.trend < -3 ? "▼" : "→";
          const guvenCl = ct.guven === "yüksek" ? "#4ade80" : ct.guven === "orta" ? "#fbbf24" : "#f87171";
          html += `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-top:${i>0?'1px solid rgba(255,255,255,0.03)':'none'}"><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(ct.cicek)}</div><div style="font-size:9px;color:#64748b">Şu an: ${ct.sonFiyat > 0 ? fmt(ct.sonFiyat) : '—'} <span style="color:${trendCl}">${trendIcn} ${ct.trend > 0 ? '+' : ''}${ct.trend.toFixed(0)}%</span></div></div><div style="text-align:right"><div style="font-size:14px;font-weight:700;color:#c4b5fd">${fmt(ct.merkez)}</div><div style="font-size:8px;color:#475569">${fmt(ct.alt)}–${fmt(ct.ust)}</div></div><div style="width:6px;height:6px;border-radius:50%;background:${guvenCl}"></div></div>`;
        });
        if (fc.cicekTahminleri.length > 8) html += `<button class="show-more" onclick="toggleExp('tahminCicek')">${state.expanded.tahminCicek?'Daha az ▲':'Tümü ('+fc.cicekTahminleri.length+') ▼'}</button>`;
        html += `</div>`;
      }
      // Şube bazlı tahmin
      if (fc.subeTahminleri.length > 0) {
        html += `<div class="card" style="margin-bottom:14px"><div style="font-size:13px;font-weight:700;color:#f8fafc;margin-bottom:6px">📍 Şube Bazlı Tahmin</div>`;
        html += `<div style="font-size:9px;color:#64748b;margin-bottom:8px">● yüksek güven · ● orta · ● düşük güven</div>`;
        fc.subeTahminleri.forEach((st, i) => {
          const guvenCl = st.guven === "yüksek" ? "#4ade80" : st.guven === "orta" ? "#fbbf24" : "#f87171";
          const veriYok = !st.sonFiyat || st.sonFiyat <= 0;
          html += `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-top:${i>0?'1px solid rgba(255,255,255,0.03)':'none'}"><div style="flex:1"><div style="font-size:12px;font-weight:600;color:#e2e8f0">${esc(st.sube)}</div><div style="font-size:9px;color:#64748b">Şu an: ${veriYok ? '<span style="color:#f87171">veri yok</span>' : fmt(st.sonFiyat)}${veriYok ? ' · <span style="color:#f87171;font-size:8px">mevsimsel tahmin</span>' : ''}</div></div><div style="text-align:right"><div style="font-size:14px;font-weight:700;color:${veriYok?'#64748b':'#c4b5fd'}">${fmt(st.merkez)}</div><div style="font-size:8px;color:#475569">${fmt(st.alt)}–${fmt(st.ust)}</div></div><div style="width:6px;height:6px;border-radius:50%;background:${guvenCl}" title="${st.guven} güven"></div></div>`;
        });
        html += `</div>`;
      }
    }

    // ── YILLIK TREND ──
    html += `<div class="sec-title" style="margin-top:20px">📈 Yıllık Trend</div>`;
    // TÜFE çarpan tablosu (2019=100 bazında yaklaşık kümülatif TÜFE)
    const TUFE = {"2019":1,"2020":1.15,"2021":1.55,"2022":3.15,"2023":4.90,"2024":7.35,"2025":9.20,"2026":10.50};
    const yilIstatistik = {};
    ALL_DATA.forEach(r => { const y = r.t.substring(0, 4); if (!yilIstatistik[y]) yilIstatistik[y] = { net: 0, d: 0 }; yilIstatistik[y].net += r.net; yilIstatistik[y].d += r.d; });
    const yilListesi = Object.entries(yilIstatistik).map(([y, v]) => {
      const dbn = v.d > 0 ? v.net / v.d : 0;
      const reelDbn = TUFE[y] ? dbn / TUFE[y] * TUFE["2019"] : dbn; // 2019 bazlı reel
      return { yil: y, net: v.net, d: v.d, dbn, reelDbn };
    }).sort((a, b) => a.yil.localeCompare(b.yil));

    if (yilListesi.length > 1) {
      const maxDbn = Math.max(...yilListesi.map(y => y.dbn));
      const maxD = Math.max(...yilListesi.map(y => y.d));

      // Nominal + Reel Dm Başı Net bar chart yan yana
      const buYilStr = String(new Date().getFullYear());
      const buYilTamMi = new Date().getMonth() === 11 && new Date().getDate() >= 28;
      html += `<div class="card" style="margin-bottom:14px"><div style="font-size:13px;font-weight:700;color:#f8fafc;margin-bottom:4px">Dm Başı Net Trendi</div>`;
      html += `<div style="font-size:10px;color:#64748b;margin-bottom:10px">Nominal (yeşil) + Reel 2019 bazlı (mavi)${!buYilTamMi?' · <span style="color:#fbbf24">'+buYilStr+' YTD (yıl tamamlanmadı)</span>':''}</div>`;
      html += `<div style="display:flex;align-items:flex-end;gap:6px;height:110px;padding-bottom:20px">`;
      yilListesi.forEach((y, i) => {
        const h = maxDbn > 0 ? (y.dbn / maxDbn * 90) : 5;
        const hR = maxDbn > 0 ? (y.reelDbn / (yilListesi[0].dbn || 1) * 30) : 5; // reel bar göreceli
        const isThisYear = y.yil === String(new Date().getFullYear());
        const prevDbn = i > 0 ? yilListesi[i-1].dbn : 0;
        const ch = prevDbn > 0 ? ((y.dbn - prevDbn) / prevDbn * 100) : 0;
        html += `<div style="flex:1;text-align:center">`;
        html += `<div style="font-size:8px;font-weight:700;color:${isThisYear?'#4ade80':'#94a3b8'}">${fmt(y.dbn)}</div>`;
        if (i > 0 && ch !== 0) html += `<div style="font-size:7px;color:${ch>0?'#34d399':'#f87171'}">${ch>0?'+':''}${ch.toFixed(0)}%</div>`;
        html += `<div style="display:flex;gap:1px;justify-content:center;align-items:flex-end;margin-bottom:3px">`;
        html += `<div style="width:45%;height:${Math.max(4,h)}px;border-radius:3px 0 0 3px;background:${isThisYear?'#4ade80':'rgba(148,163,184,0.3)'}"></div>`;
        html += `<div style="width:45%;height:${Math.max(4,hR)}px;border-radius:0 3px 3px 0;background:rgba(96,165,250,0.4)"></div>`;
        html += `</div>`;
        html += `<div style="font-size:8px;color:${isThisYear?'#4ade80':'#475569'}">${y.yil.substring(2)}</div>`;
        html += `</div>`;
      });
      html += `</div></div>`;

      // Demet hacim trendi
      html += `<div class="card" style="margin-bottom:14px"><div style="font-size:13px;font-weight:700;color:#f8fafc;margin-bottom:4px">Demet Hacim Trendi</div>`;
      html += `<div style="font-size:10px;color:#64748b;margin-bottom:10px">Yıllık toplam satılan demet${!buYilTamMi?' · <span style="color:#fbbf24">'+buYilStr+' YTD</span>':''}</div>`;
      html += `<div style="display:flex;align-items:flex-end;gap:6px;height:80px;padding-bottom:20px">`;
      yilListesi.forEach((y, i) => {
        const h = maxD > 0 ? (y.d / maxD * 70) : 5;
        const isThisYear = y.yil === String(new Date().getFullYear());
        const prevD = i > 0 ? yilListesi[i-1].d : 0;
        const ch = prevD > 0 ? ((y.d - prevD) / prevD * 100) : 0;
        html += `<div style="flex:1;text-align:center">`;
        html += `<div style="font-size:8px;font-weight:600;color:${isThisYear?'#60a5fa':'#94a3b8'}">${new Intl.NumberFormat("tr-TR").format(y.d)}</div>`;
        if (i > 0 && ch !== 0) html += `<div style="font-size:7px;color:${ch>0?'#34d399':'#f87171'}">${ch>0?'+':''}${ch.toFixed(0)}%</div>`;
        html += `<div style="height:${Math.max(4,h)}px;border-radius:4px 4px 2px 2px;background:${isThisYear?'linear-gradient(to top,#3b82f6,#60a5fa)':'rgba(96,165,250,0.2)'};margin-bottom:3px"></div>`;
        html += `<div style="font-size:8px;color:#475569">${y.yil.substring(2)}</div>`;
        html += `</div>`;
      });
      html += `</div></div>`;

      // CAGR hesapla
      const ilk = yilListesi[0], son = yilListesi[yilListesi.length - 1];
      const yilFark = parseInt(son.yil) - parseInt(ilk.yil);
      const nominalCagr = yilFark > 0 && ilk.dbn > 0 ? (Math.pow(son.dbn / ilk.dbn, 1 / yilFark) - 1) * 100 : 0;
      const reelCagr = yilFark > 0 && ilk.reelDbn > 0 ? (Math.pow(son.reelDbn / ilk.reelDbn, 1 / yilFark) - 1) * 100 : 0;
      const demetCagr = yilFark > 0 && ilk.d > 0 ? (Math.pow(son.d / ilk.d, 1 / yilFark) - 1) * 100 : 0;

      html += `<div class="card" style="margin-bottom:14px;background:rgba(96,165,250,0.06);border-color:rgba(96,165,250,0.12)"><div style="font-size:13px;font-weight:700;color:#60a5fa;margin-bottom:4px">📊 CAGR (${ilk.yil}→${son.yil})</div>`;
      if (!buYilTamMi) html += `<div style="font-size:9px;color:#fbbf24;margin-bottom:6px">⚠ ${buYilStr} yılı tamamlanmamış — CAGR yaklaşık değerdir</div>`;
      html += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center">`;
      html += `<div><div style="font-size:8px;color:#64748b">Nominal Fiyat</div><div style="font-size:16px;font-weight:800;color:#4ade80">+${nominalCagr.toFixed(0)}%</div><div style="font-size:7px;color:#475569">yıllık ort</div></div>`;
      html += `<div><div style="font-size:8px;color:#64748b">Reel Fiyat</div><div style="font-size:16px;font-weight:800;color:${reelCagr>=0?'#60a5fa':'#f87171'}">${reelCagr>=0?'+':''}${reelCagr.toFixed(0)}%</div><div style="font-size:7px;color:#475569">enflasyon düzeltmeli</div></div>`;
      html += `<div><div style="font-size:8px;color:#64748b">Demet Hacim</div><div style="font-size:16px;font-weight:800;color:${demetCagr>=0?'#4ade80':'#f87171'}">${demetCagr>=0?'+':''}${demetCagr.toFixed(0)}%</div><div style="font-size:7px;color:#475569">yıllık ort</div></div>`;
      html += `</div></div>`;

      // Çiçek bazlı trend — accordion + yaşam döngüsü badge + Pareto
      html += `<div class="card" style="margin-bottom:14px"><div style="font-size:13px;font-weight:700;color:#f8fafc;margin-bottom:6px">🌷 Çiçek Yıllık Değişim</div>`;
      html += `<div style="font-size:10px;color:#64748b;margin-bottom:10px">🟢 Yükselen Yıldız · 🟡 Nakit İneği · 🔴 Düşen · ⬜ Diğer</div>`;
      const cicekYilData = {};
      ALL_DATA.forEach(r => { const y = r.t.substring(0, 4); if (!cicekYilData[r.c]) cicekYilData[r.c] = {}; if (!cicekYilData[r.c][y]) cicekYilData[r.c][y] = { net: 0, d: 0 }; cicekYilData[r.c][y].net += r.net; cicekYilData[r.c][y].d += r.d; });
      const yilKeys = yilListesi.map(y => y.yil);
      const buYilKey = String(new Date().getFullYear());
      const cicekTrendList = Object.entries(cicekYilData).map(([cicek, yillar]) => {
        const toplamD = Object.values(yillar).reduce((s, v) => s + v.d, 0);
        const toplamNet = Object.values(yillar).reduce((s, v) => s + v.net, 0);
        const buYilD = yillar[buYilKey] ? yillar[buYilKey].d : 0;
        const buYilNet = yillar[buYilKey] ? yillar[buYilKey].net : 0;
        // Son 3 yıl trend hesapla
        const son3 = yilKeys.slice(-3);
        const s3vals = son3.map(y => yillar[y] && yillar[y].d > 0 ? { dbn: yillar[y].net / yillar[y].d, d: yillar[y].d } : null).filter(v => v);
        let badge = "other", badgeLabel = "", badgeColor = "#475569";
        if (s3vals.length >= 2) {
          const fiyatUp = s3vals[s3vals.length-1].dbn > s3vals[0].dbn;
          const hacimUp = s3vals[s3vals.length-1].d > s3vals[0].d;
          const hacimYuksek = buYilD > 200;
          if (fiyatUp && hacimUp) { badge = "star"; badgeLabel = "🟢"; badgeColor = "#4ade80"; }
          else if (hacimYuksek && !fiyatUp) { badge = "cash"; badgeLabel = "🟡"; badgeColor = "#fbbf24"; }
          else if (!fiyatUp && !hacimUp) { badge = "down"; badgeLabel = "🔴"; badgeColor = "#f87171"; }
        }
        return { cicek, yillar, toplamD, toplamNet, buYilD, buYilNet, badge, badgeLabel, badgeColor };
      }).filter(c => c.toplamD >= 50 && !c.cicek.toLowerCase().includes("saksı") && !c.cicek.toLowerCase().includes("saksi") && c.buYilD > 0).sort((a, b) => b.toplamNet - a.toplamNet);

      // Pareto hesapla — toplam gelirin %80'ini getiren çiçekleri bul
      const toplamGelir = cicekTrendList.reduce((s, c) => s + c.buYilNet, 0);
      let paretoToplam = 0;
      const paretoSinir = toplamGelir * 0.80;
      cicekTrendList.forEach((c, i) => { paretoToplam += c.buYilNet; c.isPareto = paretoToplam <= paretoSinir || i < 3; c.gelirPay = toplamGelir > 0 ? (c.buYilNet / toplamGelir * 100) : 0; });

      cicekTrendList.slice(0, state.expanded.trendAll ? 999 : 12).forEach((item, idx) => {
        const isOpen = state.expanded["trend_"+idx];
        const lastYearData = item.yillar[yilKeys[yilKeys.length-1]];
        const prevYearData = item.yillar[yilKeys[yilKeys.length-2]];
        const lastDbn = lastYearData && lastYearData.d > 0 ? lastYearData.net / lastYearData.d : 0;
        const prevDbn = prevYearData && prevYearData.d > 0 ? prevYearData.net / prevYearData.d : 0;
        const ch = prevDbn > 0 ? ((lastDbn - prevDbn) / prevDbn * 100) : null;
        html += `<div style="border-top:${idx>0?'1px solid rgba(255,255,255,0.03)':'none'};cursor:pointer;${item.isPareto?'':'opacity:0.6'}" onclick="toggleExp('trend_${idx}')">`;
        html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0">`;
        html += `<div style="display:flex;align-items:center;gap:4px"><span style="font-size:10px">${item.badgeLabel||'⬜'}</span><span style="font-size:12px;font-weight:600;color:#e2e8f0">${esc(item.cicek)}</span>${item.isPareto?'<span style="font-size:7px;color:#fbbf24;background:rgba(250,204,21,0.1);padding:1px 4px;border-radius:3px">'+item.gelirPay.toFixed(0)+'%</span>':''}</div>`;
        html += `<div style="display:flex;align-items:center;gap:6px"><span style="font-size:12px;font-weight:700;color:#34d399">${fmt(lastDbn)}</span>`;
        if (ch != null) html += `<span style="font-size:10px;color:${ch>0?'#34d399':'#f87171'}">${ch>0?'+':''}${ch.toFixed(0)}%</span>`;
        html += `<span style="font-size:9px;color:#475569">${isOpen?'▲':'▼'}</span></div></div>`;
        if (isOpen) {
          html += `<div style="padding:0 0 8px;display:flex;gap:4px;align-items:flex-end;height:50px">`;
          const vals = yilKeys.map(y => item.yillar[y] && item.yillar[y].d > 0 ? item.yillar[y].net / item.yillar[y].d : 0);
          const mx = Math.max(...vals.filter(v => v > 0));
          yilKeys.forEach((y, i) => {
            const v = vals[i]; const h = mx > 0 && v > 0 ? (v / mx * 40) : 2;
            const isLast = y === yilKeys[yilKeys.length-1];
            html += `<div style="flex:1;text-align:center"><div style="height:${Math.max(2,h)}px;border-radius:2px;background:${isLast?'#4ade80':v>0?'rgba(148,163,184,0.3)':'rgba(255,255,255,0.02)'};margin-bottom:2px"></div><div style="font-size:7px;color:#475569">${y.substring(2)}</div>${v>0?'<div style="font-size:7px;color:#94a3b8">'+Math.round(v)+'</div>':''}</div>`;
          });
          html += `</div>`;
        }
        html += `</div>`;
      });
      if (cicekTrendList.length > 12) html += `<button class="show-more" onclick="toggleExp('trendAll')">${state.expanded.trendAll?'Daha az ▲':'Tümü ('+cicekTrendList.length+') ▼'}</button>`;
      html += `</div>`;
    }

    // ── RİSK ANALİZİ ──
    html += `<div class="sec-title" style="margin-top:20px">⚡ Risk Analizi</div>`;
    html += `<div style="font-size:12px;color:#94a3b8;margin-bottom:10px;margin-top:-6px">Mevsimsel arındırılmış risk + dip fiyat riski + Sharpe oranı</div>`;

    // Basit grup filtresi
    const RISK_GRUPLARI = [
      {id:"sus",ad:"Süs Lahanası",keys:["SÜS LAHANASI",".SÜS LAHANASI","SUS LAHANASI"]},
      {id:"bicme",ad:"Biçme",keys:["BIÇME","BİÇME"]},
      {id:"frezya",ad:"Frezya",keys:["FREZYA"]},
      {id:"sebboy",ad:"Şebboy",keys:["ŞEBOY","ŞEBBOY","SEBBOY"]},
      {id:"lisyantus",ad:"Lisyantus",keys:["LİSYANTUS","LISYANTUS"]},
      {id:"husnuyusuf",ad:"Hüsnüyusuf",keys:["HÜSNÜYUSUF","HUSNUYUSUF"]},
      {id:"amarantus",ad:"Amarantus",keys:["AMARANTUS"]},
      {id:"hipericum",ad:"Hipericum",keys:["HİPERİCUM","HIPERICUM"]}
    ];
    if (!state.riskGruplar) state.riskGruplar = RISK_GRUPLARI.map(g => g.id); // hepsi seçili
    html += `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:12px">`;
    RISK_GRUPLARI.forEach(g => {
      const isActive = state.riskGruplar.includes(g.id);
      html += `<button onclick="if(state.riskGruplar.includes('${g.id}')){state.riskGruplar=state.riskGruplar.filter(x=>x!=='${g.id}')}else{state.riskGruplar.push('${g.id}')};render()" style="padding:4px 8px;border-radius:6px;border:1px solid ${isActive?'rgba(124,58,237,0.3)':'rgba(255,255,255,0.06)'};background:${isActive?'rgba(124,58,237,0.15)':'transparent'};color:${isActive?'#c4b5fd':'#475569'};font-size:10px;cursor:pointer;font-weight:${isActive?'600':'400'}">${g.ad}</button>`;
    });
    html += `</div>`;

    // Seçili grup çiçeklerini bul
    const seciliKeys = [];
    state.riskGruplar.forEach(gid => { const g = RISK_GRUPLARI.find(x => x.id === gid); if (g) seciliKeys.push(...g.keys); });
    const riskFiltrelenmis = [...new Set(ALL_DATA.map(r => r.c))].filter(c => {
      if (c.toLowerCase().includes("saksı") || c.toLowerCase().includes("saksi")) return false;
      return seciliKeys.some(k => c.toUpperCase().includes(k.toUpperCase()));
    });

    const MIN_DEMET = 50;
    const cicekVolatilite = [];
    const sdRisk = sd; // mevsimsellik sekmesindeki sd'yi kullan (zaten hesaplanmış olabilir)
    riskFiltrelenmis.forEach(cicek => {
      const cicekData = ALL_DATA.filter(r => r.c === cicek);
      const toplamD = cicekData.reduce((s,r) => s + r.d, 0);
      if (toplamD < MIN_DEMET) return;
      const cicekMevsimR = sdRisk.cicekMevsim[cicek] || {};
      const cicekYilOrtR = {};
      cicekData.forEach(r => { const y = r.t.substring(0,4); if (!cicekYilOrtR[y]) cicekYilOrtR[y] = {net:0,d:0}; cicekYilOrtR[y].net += r.net; cicekYilOrtR[y].d += r.d; });
      const residuals = [];
      const yilGrupR = {};
      cicekData.forEach(r => { const y = r.t.substring(0,4); if (!yilGrupR[y]) yilGrupR[y] = {}; if (!yilGrupR[y][r.t]) yilGrupR[y][r.t] = {net:0,d:0}; yilGrupR[y][r.t].net += r.net; yilGrupR[y][r.t].d += r.d; });
      Object.entries(yilGrupR).forEach(([yil, gunler]) => {
        const yilDbnC = cicekYilOrtR[yil] && cicekYilOrtR[yil].d > 0 ? cicekYilOrtR[yil].net / cicekYilOrtR[yil].d : 0;
        if (yilDbnC <= 0) return;
        Object.entries(gunler).forEach(([t, v]) => {
          if (v.d <= 0) return;
          const ay = parseInt(t.substring(5,7));
          const mev = cicekMevsimR[ay] ? cicekMevsimR[ay].ortYuzde : 1;
          const beklenen = yilDbnC * mev;
          if (beklenen > 0) residuals.push(((v.net / v.d) - beklenen) / beklenen);
        });
      });
      const ort = toplamD > 0 ? cicekData.reduce((s,r) => s+r.net, 0) / toplamD : 0;
      let residualCV = 0;
      if (residuals.length >= 3) {
        const rO = residuals.reduce((s,x) => s+x, 0) / residuals.length;
        const rS = Math.sqrt(residuals.reduce((s,x) => s + Math.pow(x - rO, 2), 0) / residuals.length);
        residualCV = Math.abs(rO + 1) > 0 ? (rS / Math.abs(rO + 1) * 100) : rS * 100;
      }
      let dipSayisi = 0, toplamGun = 0;
      Object.entries(yilGrupR).forEach(([yil, gunler]) => {
        const yilDbnC = cicekYilOrtR[yil] && cicekYilOrtR[yil].d > 0 ? cicekYilOrtR[yil].net / cicekYilOrtR[yil].d : 0;
        if (yilDbnC <= 0) return;
        Object.entries(gunler).forEach(([t, v]) => { if (v.d <= 0) return; toplamGun++; if ((v.net / v.d) < yilDbnC * 0.5) dipSayisi++; });
      });
      const dipOrani = toplamGun > 0 ? (dipSayisi / toplamGun * 100) : 0;
      const residualStd = residuals.length >= 3 ? Math.sqrt(residuals.reduce((s,x) => s + Math.pow(x, 2), 0) / residuals.length) : 1;
      const toplamNet = cicekData.reduce((s,r) => s + r.net, 0);
      const sharpe = residualStd > 0 && toplamNet > 0 ? (Math.log(toplamNet) / residualStd) : 0;
      let riskSkoru = Math.min(100, Math.round(residualCV * 1.2 + dipOrani * 0.5));
      let riskLabel, riskColor, riskBg;
      if (riskSkoru <= 25) { riskLabel = "Düşük"; riskColor = "#4ade80"; riskBg = "rgba(34,197,94,0.1)"; }
      else if (riskSkoru <= 50) { riskLabel = "Orta"; riskColor = "#fbbf24"; riskBg = "rgba(250,204,21,0.1)"; }
      else if (riskSkoru <= 75) { riskLabel = "Yüksek"; riskColor = "#fb923c"; riskBg = "rgba(251,146,60,0.1)"; }
      else { riskLabel = "Çok Yüksek"; riskColor = "#f87171"; riskBg = "rgba(239,68,68,0.1)"; }
      cicekVolatilite.push({ cicek, ort, residualCV, dipOrani, sharpe, riskSkoru, riskLabel, riskColor, riskBg, toplamD });
    });
    cicekVolatilite.sort((a, b) => a.riskSkoru - b.riskSkoru);

    const guvenliCicekler = cicekVolatilite.filter(c => c.riskSkoru <= 30);
    if (guvenliCicekler.length > 0) {
      html += `<div class="card" style="margin-bottom:14px;background:rgba(34,197,94,0.06);border-color:rgba(34,197,94,0.12)"><div style="font-size:13px;font-weight:700;color:#4ade80;margin-bottom:8px">🛡 Güvenli Liman Çiçekleri</div>`;
      guvenliCicekler.slice(0, 5).forEach(c => {
        html += `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-top:1px solid rgba(255,255,255,0.03)"><div style="flex:1"><div style="font-size:12px;font-weight:600;color:#e2e8f0">${esc(c.cicek)}</div><div style="font-size:9px;color:#64748b">Dip:%${c.dipOrani.toFixed(0)} · Sharpe:${c.sharpe.toFixed(1)}</div></div><div style="text-align:right"><div style="font-size:13px;font-weight:700;color:#4ade80">R:${c.riskSkoru}</div></div></div>`;
      });
      html += `</div>`;
    }
    if (cicekVolatilite.length > 0) {
      html += `<div class="card" style="margin-bottom:14px"><div style="font-size:13px;font-weight:700;color:#f8fafc;margin-bottom:6px">📊 Risk & Getiri Tablosu</div>`;
      html += `<div style="font-size:9px;color:#64748b;margin-bottom:8px">R=risk skoru · D=dip riski% · S=Sharpe (yüksek=iyi)</div>`;
      const riskShow = state.expanded.riskCicek ? 999 : 10;
      cicekVolatilite.slice(0, riskShow).forEach((c, i) => {
        html += `<div style="display:flex;align-items:center;gap:5px;padding:5px 0;border-top:${i>0?'1px solid rgba(255,255,255,0.03)':'none'}"><div style="flex:1;font-size:10px;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.cicek)}</div><div style="width:45px;height:4px;background:rgba(255,255,255,0.04);border-radius:2px"><div style="height:100%;border-radius:2px;width:${c.riskSkoru}%;background:linear-gradient(90deg,#22c55e,#fbbf24,#f87171)"></div></div><span style="font-size:9px;padding:1px 4px;border-radius:3px;background:${c.riskBg};color:${c.riskColor};font-weight:600">${c.riskSkoru}</span><span style="font-size:8px;color:#64748b">D${c.dipOrani.toFixed(0)}</span><span style="font-size:8px;color:${c.sharpe>5?'#4ade80':c.sharpe>3?'#fbbf24':'#f87171'};font-weight:600">S${c.sharpe.toFixed(1)}</span></div>`;
      });
      if (cicekVolatilite.length > 10) html += `<button class="show-more" onclick="toggleExp('riskCicek')">${state.expanded.riskCicek?'Daha az ▲':'Tümü ('+cicekVolatilite.length+') ▼'}</button>`;
      html += `</div>`;
    }
    // Çiçek × Şube Risk Matrisi
    if (cicekVolatilite.length > 0) {
      const topSubeler = [...new Set(ALL_DATA.map(r => r.s))].filter(s => ALL_DATA.filter(r => r.s === s).reduce((sm,r) => sm+r.d, 0) >= MIN_DEMET).slice(0, 6);
      const topCicekler = cicekVolatilite.slice(0, 8).map(c => c.cicek);
      if (topSubeler.length > 0) {
        html += `<div class="card" style="margin-bottom:14px"><div style="font-size:13px;font-weight:700;color:#f8fafc;margin-bottom:6px">🗺 Çiçek × Şube Risk Matrisi</div>`;
        html += `<div style="font-size:9px;color:#64748b;margin-bottom:6px">Düşük = güvenli (yeşil), yüksek = riskli (kırmızı)</div>`;
        html += `<div style="overflow-x:auto"><div style="min-width:320px"><div style="display:grid;grid-template-columns:75px repeat(${topSubeler.length},1fr);gap:2px;margin-bottom:2px"><div></div>`;
        topSubeler.forEach(s => { html += `<div style="text-align:center;font-size:7px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s)}</div>`; });
        html += `</div>`;
        topCicekler.forEach(cicek => {
          html += `<div style="display:grid;grid-template-columns:75px repeat(${topSubeler.length},1fr);gap:2px;margin-bottom:2px"><div style="font-size:8px;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:3px 0">${esc(cicek)}</div>`;
          topSubeler.forEach(sube => {
            const kd = ALL_DATA.filter(r => r.c === cicek && r.s === sube);
            if (kd.length === 0) { html += `<div style="height:20px;border-radius:3px;background:rgba(255,255,255,0.02);display:flex;align-items:center;justify-content:center;font-size:6px;color:#333">—</div>`; return; }
            if (kd.length < 3) { html += `<div style="height:20px;border-radius:3px;background:rgba(255,255,255,0.04);display:flex;align-items:center;justify-content:center;font-size:6px;color:#475569">az</div>`; return; }
            const cM = sdRisk.cicekMevsim[cicek] || {};
            const cYO = {};
            kd.forEach(r => { const y=r.t.substring(0,4); if(!cYO[y]) cYO[y]={net:0,d:0}; cYO[y].net+=r.net; cYO[y].d+=r.d; });
            const res = [];
            kd.forEach(r => { const y=r.t.substring(0,4); const yd=cYO[y]&&cYO[y].d>0?cYO[y].net/cYO[y].d:0; if(yd<=0||r.d<=0) return; const m=parseInt(r.t.substring(5,7)); const mv=cM[m]?cM[m].ortYuzde:1; res.push(((r.net/r.d)-yd*mv)/(yd*mv)); });
            let cv = 50;
            if (res.length >= 3) { const o=res.reduce((s,x)=>s+x,0)/res.length; cv=Math.min(100,Math.round(Math.sqrt(res.reduce((s,x)=>s+Math.pow(x-o,2),0)/res.length)*100)); }
            let bg;
            if (cv <= 20) bg = "rgba(34,197,94,0.4)"; else if (cv <= 35) bg = "rgba(34,197,94,0.2)"; else if (cv <= 50) bg = "rgba(250,204,21,0.15)"; else bg = "rgba(239,68,68,0.2)";
            html += `<div style="height:20px;border-radius:3px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:7px;color:#e2e8f0;font-weight:600">${cv}</div>`;
          });
          html += `</div>`;
        });
        html += `</div></div></div>`;
      }
    }
    // Şube güvenilirlik
    const subeGuvenilirlik = [];
    BRANCHES.forEach(sube => {
      const sd2 = ALL_DATA.filter(r => r.s === sube && !r.c.toLowerCase().includes("saksı") && !r.c.toLowerCase().includes("saksi"));
      const tD = sd2.reduce((s,r) => s+r.d, 0); if (tD < MIN_DEMET) return;
      const yG = {}; sd2.forEach(r => { const y=r.t.substring(0,4); if(!yG[y]) yG[y]={}; if(!yG[y][r.t]) yG[y][r.t]={net:0,d:0}; yG[y][r.t].net+=r.net; yG[y][r.t].d+=r.d; });
      const yCV = []; Object.values(yG).forEach(g => { const f=Object.values(g).filter(v=>v.d>0).map(v=>v.net/v.d); if(f.length<3) return; const o=f.reduce((s,x)=>s+x,0)/f.length; yCV.push(o>0?(Math.sqrt(f.reduce((s,x)=>s+Math.pow(x-o,2),0)/f.length)/o*100):0); });
      if (!yCV.length) return;
      const oCV = yCV.reduce((s,x)=>s+x,0)/yCV.length;
      const aA = new Set(sd2.map(r=>r.t.substring(0,7))).size;
      const gS = Math.round(Math.max(0,100-oCV*1.5)*0.5 + Math.min(100,aA*2)*0.25 + Math.min(100,Math.log10(tD+1)*25)*0.25);
      let gL, gC;
      if(gS>=75){gL="Çok Güvenilir";gC="#4ade80";}else if(gS>=55){gL="Güvenilir";gC="#6ee7b7";}else if(gS>=40){gL="Orta";gC="#fbbf24";}else{gL="Dikkatli Ol";gC="#f87171";}
      subeGuvenilirlik.push({sube,guvenScore:gS,guvenLabel:gL,guvenColor:gC,toplamD:tD,aktifAylar:aA});
    });
    subeGuvenilirlik.sort((a,b)=>b.guvenScore-a.guvenScore);
    if (subeGuvenilirlik.length > 0) {
      html += `<div class="card" style="margin-bottom:14px"><div style="font-size:13px;font-weight:700;color:#f8fafc;margin-bottom:10px">📍 Şube Güvenilirlik</div>`;
      subeGuvenilirlik.forEach((s,i) => {
        html += `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-top:${i>0?'1px solid rgba(255,255,255,0.03)':'none'}"><div style="width:18px;font-size:10px;font-weight:700;color:${i<3?'#fbbf24':'#475569'}">${i+1}</div><div style="flex:1"><div style="font-size:12px;font-weight:600;color:#e2e8f0">${esc(s.sube)}</div><div style="font-size:9px;color:#475569">${s.aktifAylar} ay · ${new Intl.NumberFormat("tr-TR").format(s.toplamD)}dm</div></div><div style="text-align:right"><div style="font-size:14px;font-weight:800;color:${s.guvenColor}">${s.guvenScore}</div><div style="font-size:8px;color:${s.guvenColor}">${s.guvenLabel}</div></div></div>`;
      });
      html += `</div>`;
    }
  }

  // ══ GİDERLER (Cost Model v2) ══
  if (state.tab === "gider") {
    const v2rows = filtered.filter(r => r.costModel === "v2");
    html += `<div class="sec-title">Gider Analizi</div>`;

    if (v2rows.length === 0) {
      html += `<div class="card" style="background:rgba(250,204,21,0.06);border-color:rgba(250,204,21,0.12);text-align:center;padding:30px"><div style="font-size:14px;color:#fbbf24;margin-bottom:6px">Bu sekme 31 Temmuz 2026 sonrası veriyle çalışır</div><div style="font-size:12px;color:#94a3b8">Tarih aralığını 31 Tem 2026 veya sonrasını kapsayacak şekilde seç.</div></div>`;
    } else {
      const gs = getGiderStats(v2rows);
      html += `<div style="font-size:12px;color:#94a3b8;margin-bottom:14px;margin-top:-6px">${v2rows.length} satır · Toplam gider: ${fmt(gs.toplamGider)} · Ort. kesinti: <span style="color:#c4b5fd;font-weight:600">%${gs.ortKesinti.toFixed(1)}</span></div>`;

      // ── Bölüm 1: Gider Kalemi Dağılımı ──
      html += `<div class="card" style="margin-bottom:14px"><div style="font-size:13px;font-weight:700;color:#f8fafc;margin-bottom:10px">📊 Gider Kalemi Dağılımı</div>`;
      const maxKalem = gs.kalemler[0] ? gs.kalemler[0].toplam : 1;
      gs.kalemler.forEach((k, i) => {
        const w = maxKalem > 0 ? (k.toplam / maxKalem * 100) : 0;
        html += `<div style="padding:5px 0;border-top:${i > 0 ? '1px solid rgba(255,255,255,0.03)' : 'none'}">`;
        html += `<div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="font-size:11px;color:#cbd5e1">${k.ad}</span><span style="font-size:11px"><span style="color:#fbbf24;font-size:9px">%${k.pay.toFixed(1)}</span> · <span style="color:#e2e8f0;font-weight:600">${fmt(k.toplam)}</span></span></div>`;
        html += `<div style="height:4px;background:rgba(255,255,255,0.04);border-radius:2px"><div style="height:100%;border-radius:2px;width:${w}%;background:linear-gradient(90deg,#a855f7,#7c3aed)"></div></div>`;
        html += `</div>`;
      });
      html += `</div>`;

      // ── Bölüm 2: Şube Nakliye Tablosu ──
      html += `<div class="card" style="margin-bottom:14px;padding:0;overflow:hidden;overflow-x:auto"><div style="font-size:13px;font-weight:700;color:#f8fafc;padding:12px 14px 8px">🚚 Şube Nakliye Maliyeti</div>`;
      html += `<table style="width:100%;border-collapse:collapse;font-size:10px;min-width:420px">`;
      html += `<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08)">`;
      ["Şube", "Nakliye", "Satır", "₺/Satır", "₺/Dm", "Brüte %"].forEach((h, i) => {
        html += `<th style="padding:6px ${i === 0 ? '14px' : '6px'};text-align:${i === 0 ? 'left' : 'right'};color:#64748b;font-size:8px;text-transform:uppercase;font-weight:600">${h}</th>`;
      });
      html += `</tr></thead><tbody>`;
      const ortPerDemet = gs.subeNakliye.length > 0 ? gs.subeNakliye.reduce((s, b) => s + b.perDemet, 0) / gs.subeNakliye.length : 0;
      gs.subeNakliye.forEach((b, i) => {
        const pahali = b.perDemet > ortPerDemet * 1.15;
        const ucuz = b.perDemet < ortPerDemet * 0.85;
        const renk = pahali ? "#f87171" : ucuz ? "#34d399" : "#e2e8f0";
        html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.03);background:${pahali ? 'rgba(239,68,68,0.05)' : 'transparent'}">`;
        html += `<td style="padding:7px 14px;color:#f8fafc;font-weight:500">${esc(b.sube)}</td>`;
        html += `<td style="padding:7px 6px;text-align:right;color:#cbd5e1">${fmt(b.nakliye)}</td>`;
        html += `<td style="padding:7px 6px;text-align:right;color:#94a3b8">${b.satir}</td>`;
        html += `<td style="padding:7px 6px;text-align:right;color:#cbd5e1">${fmt2(b.perSatir)}</td>`;
        html += `<td style="padding:7px 6px;text-align:right;color:${renk};font-weight:700">${fmt2(b.perDemet)}</td>`;
        html += `<td style="padding:7px 6px;text-align:right;color:${renk}">${b.brutPct.toFixed(1)}%</td>`;
        html += `</tr>`;
      });
      html += `</tbody></table></div>`;

      // ── Bölüm 3: Kesinti Oranı Trendi ──
      html += `<div class="card" style="margin-bottom:14px"><div style="font-size:13px;font-weight:700;color:#f8fafc;margin-bottom:4px">📈 Kesinti Oranı Trendi</div>`;
      html += `<div style="font-size:9px;color:#64748b;margin-bottom:10px">Mezat günü bazlı gerçek kesinti · Ortalama: %${gs.ortKesinti.toFixed(1)}</div>`;
      const maxPct = Math.max(...gs.gunler.map(g => g.pct), gs.ortKesinti) * 1.15;
      html += `<div style="position:relative;height:80px;display:flex;align-items:flex-end;gap:4px">`;
      html += `<div style="position:absolute;left:0;right:0;bottom:${maxPct > 0 ? (gs.ortKesinti / maxPct * 80) : 0}px;border-top:1px dashed rgba(196,181,253,0.5);z-index:1"><span style="position:absolute;right:0;top:-12px;font-size:7px;color:#c4b5fd">ort %${gs.ortKesinti.toFixed(1)}</span></div>`;
      gs.gunler.forEach(g => {
        const h = maxPct > 0 ? Math.max(3, g.pct / maxPct * 80) : 3;
        html += `<div style="flex:1;text-align:center;position:relative;z-index:2"><div style="font-size:8px;color:#c4b5fd;font-weight:600;margin-bottom:2px">%${g.pct.toFixed(1)}</div><div style="height:${h}px;border-radius:3px 3px 1px 1px;background:linear-gradient(to top,rgba(168,85,247,0.25),rgba(168,85,247,0.5));margin-bottom:3px"></div><div style="font-size:7px;color:#475569">${fD(g.t)}</div></div>`;
      });
      html += `</div></div>`;

      // ── Bölüm 4: Minimum Kârlı Sevkiyat ──
      html += `<div class="card" style="margin-bottom:14px;background:rgba(250,204,21,0.04);border-color:rgba(250,204,21,0.1)"><div style="font-size:13px;font-weight:700;color:#fbbf24;margin-bottom:4px">⭐ Minimum Kârlı Sevkiyat</div>`;
      html += `<div style="font-size:9px;color:#64748b;margin-bottom:10px">Satır büyüklüğü küçüldükçe nakliye payı artar — kesinti oranı yükselir</div>`;
      const gSubeler = [...new Set(v2rows.map(r => r.s))].sort();
      html += `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px">`;
      html += `<button class="preset-btn ${state.giderSube === null ? 'active' : ''}" onclick="setState({giderSube:null})">Tümü</button>`;
      gSubeler.forEach(s => {
        html += `<button class="preset-btn ${state.giderSube === s ? 'active' : ''}" onclick="setState({giderSube:'${esc(s)}'})">${esc(s)}</button>`;
      });
      html += `</div>`;
      const arRows = state.giderSube ? v2rows.filter(r => r.s === state.giderSube) : v2rows;
      const araliklar = getGiderAralik(arRows);
      html += `<table style="width:100%;border-collapse:collapse;font-size:11px">`;
      html += `<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08)">`;
      ["Aralık", "Satır", "Ort. Kesinti", "Ort. Net/Dm"].forEach((h, i) => {
        html += `<th style="padding:6px 4px;text-align:${i === 0 ? 'left' : 'right'};color:#64748b;font-size:8px;text-transform:uppercase;font-weight:600">${h}</th>`;
      });
      html += `</tr></thead><tbody>`;
      araliklar.forEach(a => {
        const kesintiRenk = a.ortKesinti === null ? "#475569" : a.ortKesinti > 40 ? "#f87171" : a.ortKesinti > 30 ? "#fbbf24" : "#34d399";
        html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.03)">`;
        html += `<td style="padding:7px 4px;color:#f8fafc;font-weight:600">${a.ad}</td>`;
        html += `<td style="padding:7px 4px;text-align:right;color:#94a3b8">${a.n}</td>`;
        html += `<td style="padding:7px 4px;text-align:right;color:${kesintiRenk};font-weight:700">${a.ortKesinti !== null ? '%' + a.ortKesinti.toFixed(1) : '—'}</td>`;
        html += `<td style="padding:7px 4px;text-align:right;color:#e2e8f0">${a.ortNetDm !== null ? fmt2(a.ortNetDm) : '—'}</td>`;
        html += `</tr>`;
      });
      html += `</tbody></table>`;
      const dolu = araliklar.filter(a => a.n > 0 && a.ortKesinti !== null);
      if (dolu.length > 0) {
        const enKotu = dolu.reduce((mx, a) => a.ortKesinti > mx.ortKesinti ? a : mx, dolu[0]);
        html += `<div style="font-size:10px;color:#94a3b8;margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.04)">En yüksek kesinti <strong style="color:#fbbf24">${enKotu.ad}</strong> aralığında (%${enKotu.ortKesinti.toFixed(1)}).${enKotu.ortKesinti > 40 ? ' <span style="color:#f87171">⚠ %40 üstü kesinti oranına dikkat — bu boyuttaki sevkiyatlarda nakliye kârı eritiyor.</span>' : ''}</div>`;
      }
      html += `</div>`;

      // ── Bölüm 5: Zarar Kayıtları ──
      const zarar = getZararFiltered();
      html += `<div class="sec-title">Zarar Kayıtları</div>`;
      if (zarar.length === 0) {
        html += `<div class="card" style="margin-bottom:14px;text-align:center;padding:16px"><div style="font-size:12px;color:#34d399">✓ Dönemde zarar kaydı yok</div></div>`;
      } else {
        const zToplam = zarar.reduce((s, r) => s + r.net, 0);
        html += `<div class="card" style="margin-bottom:8px;background:rgba(239,68,68,0.08);border-color:rgba(239,68,68,0.2);text-align:center;padding:14px"><div style="font-size:10px;color:#fca5a5;margin-bottom:2px">⚠ ${zarar.length} zarar kaydı (net ≤ 0 — analize girmez)</div><div style="font-size:20px;font-weight:800;color:#f87171">−${fmt(Math.abs(zToplam))}</div></div>`;
        const zShow = state.expanded.giderZarar ? 999 : 10;
        html += `<div class="card" style="margin-bottom:14px;padding:0;overflow:hidden;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:10px;min-width:420px">`;
        html += `<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08)">`;
        ["Tarih", "Şube", "Çiçek", "Brüt", "Nak. Zarar", "Net"].forEach((h, i) => {
          html += `<th style="padding:6px ${i === 0 ? '14px' : '6px'};text-align:${i < 3 ? 'left' : 'right'};color:#64748b;font-size:8px;text-transform:uppercase;font-weight:600">${h}</th>`;
        });
        html += `</tr></thead><tbody>`;
        zarar.slice(0, zShow).forEach(r => {
          html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.03)">`;
          html += `<td style="padding:6px 14px;color:#94a3b8">${fD(r.t)}</td>`;
          html += `<td style="padding:6px;color:#cbd5e1">${esc(r.s)}</td>`;
          html += `<td style="padding:6px;color:#cbd5e1">${esc(r.c)}</td>`;
          html += `<td style="padding:6px;text-align:right;color:#94a3b8">${fmt2(r.ciro)}</td>`;
          html += `<td style="padding:6px;text-align:right;color:#fbbf24">${fmt2(r.giderler.nakliyeZarar)}</td>`;
          html += `<td style="padding:6px;text-align:right;color:#f87171;font-weight:700">${fmt2(r.net)}</td>`;
          html += `</tr>`;
        });
        html += `</tbody></table></div>`;
        if (zarar.length > 10) html += `<button class="show-more" onclick="toggleExp('giderZarar')">${state.expanded.giderZarar ? 'Daha az ▲' : 'Tüm zarar kayıtları (' + zarar.length + ') ▼'}</button>`;
      }

      // ── Bölüm 6: Vergi/Muhasebe Özeti ──
      html += `<div class="sec-title">Vergi & Muhasebe Özeti</div>`;
      html += `<div class="card" style="margin-bottom:14px">`;
      [["Bağkur Payı", gs.vergi.bagkur], ["Stopaj Payı", gs.vergi.stopaj], ["Borsa Payı", gs.vergi.borsa]].forEach(([ad, v], i) => {
        html += `<div style="display:flex;justify-content:space-between;padding:6px 0;border-top:${i > 0 ? '1px solid rgba(255,255,255,0.03)' : 'none'}"><span style="font-size:11px;color:#cbd5e1">${ad}</span><span style="font-size:11px;color:#e2e8f0;font-weight:600">${fmt2(v)}</span></div>`;
      });
      html += `<div style="display:flex;justify-content:space-between;padding:8px 0 2px;border-top:1px solid rgba(255,255,255,0.08)"><span style="font-size:12px;color:#f8fafc;font-weight:700">Toplam</span><span style="font-size:12px;color:#4ade80;font-weight:800">${fmt2(gs.vergi.bagkur + gs.vergi.stopaj + gs.vergi.borsa)}</span></div>`;
      html += `<div style="font-size:9px;color:#64748b;margin-top:8px">📋 Muhasebe için — dönem: ${dateLabel}</div>`;
      html += `</div>`;
    }
  }

  // ══ TEDİYE (Flora ödeme takibi — tarih filtresinden bağımsız) ══
  if (state.tab === "tediye") {
    html += `<div class="sec-title">Tediye Takibi</div>`;
    html += `<div style="font-size:12px;color:#94a3b8;margin-bottom:14px;margin-top:-6px">Perşembe–Çarşamba satış dönemi → 26 gün sonra Pazartesi ödemesi · Zarar kayıtları dahil (gerçek para hesabı)</div>`;

    var tDonemler = getTediyeDonemleri();
    var tGunAd = ["Paz","Pzt","Sal","Çar","Per","Cum","Cmt"];
    var tBugun = new Date().toISOString().split("T")[0];
    var tBuAy = tBugun.substring(0, 7);
    var tHesapAdlari = ["4675", "5994"];

    if (tDonemler.length === 0) {
      html += `<div class="card" style="background:rgba(250,204,21,0.06);border-color:rgba(250,204,21,0.12);text-align:center;padding:30px"><div style="font-size:14px;color:#fbbf24;margin-bottom:6px">Henüz V2 satış verisi yok</div><div style="font-size:12px;color:#94a3b8">Bu sekme 31 Temmuz 2026 sonrası satışların tediyesini takip eder.</div></div>`;
      html += `<div style="font-size:10px;color:#64748b;margin-top:10px;text-align:center">31 Temmuz 2026 öncesi ödemeler için Flora Ödemelerim sayfası</div>`;
    } else {
      var hesapGeldiMi = function(dn, h) { return dn.durum[h] && dn.durum[h].durum === "geldi"; };
      var donemTamamenGeldi = function(dn) {
        return Object.keys(dn.hesaplar).every(function(h){ return hesapGeldiMi(dn, h); });
      };

      // ── Bölüm 1: Yaklaşan Ödemeler (ödenmemiş, en yakın ödeme üstte) ──
      var bekleyenler = tDonemler.filter(function(dn){ return !donemTamamenGeldi(dn); }).slice().sort(function(a,b){ return a.odemeTarihi.localeCompare(b.odemeTarihi) });
      html += `<div class="sec-title" style="font-size:13px">📅 Yaklaşan Ödemeler</div>`;
      if (bekleyenler.length === 0) {
        html += `<div class="card" style="margin-bottom:14px;text-align:center;padding:14px"><div style="font-size:12px;color:#34d399">✓ Bekleyen ödeme yok — tüm dönemler işaretli</div></div>`;
      }
      bekleyenler.forEach(function(dn) {
        var od = new Date(dn.odemeTarihi + "T12:00:00");
        var ert = new Date(od.getTime()); ert.setDate(ert.getDate() + 1);
        html += `<div class="card" style="margin-bottom:10px">`;
        html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">`;
        html += `<div style="font-size:13px;font-weight:700;color:#f8fafc">📅 ${tGunAd[od.getDay()]} ${fD(dn.odemeTarihi)} <span style="font-size:10px;color:#64748b;font-weight:400">(hesapta ~${tGunAd[ert.getDay()]} ${fD(ert.toISOString().split("T")[0])})</span></div>`;
        if (dn.devamEdiyor) html += `<span style="font-size:9px;padding:2px 8px;border-radius:10px;background:rgba(250,204,21,0.15);color:#fbbf24;font-weight:700">DEVAM EDİYOR</span>`;
        html += `</div>`;
        html += `<div style="font-size:10px;color:#64748b;margin-bottom:8px">Dönem: ${fD(dn.baslangic)} – ${fD(dn.bitis)} · ${dn.toplamSatir} satır</div>`;

        html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">`;
        tHesapAdlari.forEach(function(h) {
          var hv = dn.hesaplar[h];
          if (!hv) {
            html += `<div style="padding:10px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);text-align:center"><div style="font-size:10px;color:#475569;font-weight:600">${h}</div><div style="font-size:11px;color:#475569;margin-top:4px">satış yok</div></div>`;
            return;
          }
          var geldi = hesapGeldiMi(dn, h);
          var formKey = dn.bitis + "|" + h;
          html += `<div style="padding:10px;border-radius:10px;background:${geldi ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)'};border:1px solid ${geldi ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}">`;
          html += `<div style="font-size:10px;color:#94a3b8;font-weight:600">${h}</div>`;
          html += `<div style="font-size:16px;font-weight:800;color:#f8fafc;margin:2px 0">${fmt(hv.net)}${dn.devamEdiyor ? ' <span style="font-size:8px;color:#fbbf24;font-weight:400">şu ana kadar</span>' : ''}</div>`;
          if (geldi) {
            html += `<div style="font-size:10px;color:#34d399;font-weight:600">✓ Geldi</div>`;
          } else if (state.tediyeForm === formKey) {
            html += `<div style="display:flex;flex-direction:column;gap:4px;margin-top:4px">`;
            html += `<button onclick="setTediyeDurum('${dn.bitis}','${h}','geldi',null)" style="padding:5px;border-radius:6px;border:none;background:rgba(34,197,94,0.2);color:#6ee7b7;font-size:10px;cursor:pointer;font-weight:600">Beklenenle aynı ✓</button>`;
            html += `<div style="display:flex;gap:4px"><input id="tediyeTutarInput" type="number" step="0.01" placeholder="Farklı tutar" style="flex:1;min-width:0;padding:5px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.3);color:#f8fafc;font-size:10px"><button onclick="tediyeFarkliKaydet('${dn.bitis}','${h}')" style="padding:5px 8px;border-radius:6px;border:none;background:rgba(168,85,247,0.2);color:#c4b5fd;font-size:10px;cursor:pointer">Kaydet</button></div>`;
            html += `<button onclick="setState({tediyeForm:null})" style="padding:3px;border-radius:6px;border:none;background:transparent;color:#475569;font-size:9px;cursor:pointer">vazgeç</button>`;
            html += `</div>`;
          } else {
            html += `<button onclick="tediyeFormAc('${dn.bitis}','${h}')" style="width:100%;padding:5px;border-radius:6px;border:1px solid rgba(34,197,94,0.3);background:transparent;color:#6ee7b7;font-size:10px;cursor:pointer;font-weight:600">✓ Geldi</button>`;
          }
          html += `</div>`;
        });
        html += `</div>`;

        html += `<div style="display:flex;justify-content:space-between;align-items:center;padding-top:6px;border-top:1px solid rgba(255,255,255,0.04)">`;
        html += `<span style="font-size:11px;color:#94a3b8">Toplam: <strong style="color:#4ade80">${fmt(dn.toplamNet)}</strong></span>`;
        if (dn.zararSayisi > 0) html += `<span style="font-size:9px;color:#f87171">⚠ ${dn.zararSayisi} zarar kaydı dahil (−${fmt(Math.abs(dn.zararToplam))})</span>`;
        html += `</div>`;
        html += `</div>`;
      });

      // ── Bölüm 2: Gelen Ödemeler ──
      html += `<div class="sec-title" style="font-size:13px;margin-top:20px">✅ Gelen Ödemeler</div>`;
      var gelenler = [];
      tDonemler.forEach(function(dn) {
        Object.keys(dn.hesaplar).forEach(function(h) {
          if (hesapGeldiMi(dn, h)) gelenler.push({ dn: dn, h: h, beklenen: dn.hesaplar[h].net, kayit: dn.durum[h] });
        });
      });
      gelenler.sort(function(a,b){ return b.dn.odemeTarihi.localeCompare(a.dn.odemeTarihi) });
      if (gelenler.length === 0) {
        html += `<div class="card" style="margin-bottom:14px;text-align:center;padding:14px"><div style="font-size:11px;color:#64748b">Henüz gelen ödeme yok</div></div>`;
      } else {
        html += `<div class="card" style="margin-bottom:14px;padding:6px 14px">`;
        gelenler.forEach(function(g, gi) {
          var gercek = g.kayit.gercekTutar;
          var fark = gercek != null ? gercek - g.beklenen : 0;
          var farkRenk = Math.abs(fark) < 1 ? "#34d399" : "#f87171";
          html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-top:${gi > 0 ? '1px solid rgba(255,255,255,0.03)' : 'none'}">`;
          html += `<div><span style="font-size:11px;color:#e2e8f0">${fD(g.dn.odemeTarihi)}</span> <span style="font-size:9px;color:#64748b">· ${g.h} · dönem ${fD(g.dn.baslangic)}–${fD(g.dn.bitis)}</span></div>`;
          html += `<div style="display:flex;align-items:center;gap:8px">`;
          html += `<span style="font-size:11px;color:#94a3b8">${fmt(g.beklenen)}</span>`;
          if (gercek != null) html += `<span style="font-size:11px;font-weight:700;color:${farkRenk}">${fmt(gercek)} (${fark >= 0 ? '+' : ''}${fmt(fark)})</span>`;
          else html += `<span style="font-size:10px;color:#34d399">✓ birebir</span>`;
          html += `<span onclick="setTediyeDurum('${g.dn.bitis}','${g.h}',null,null)" title="Geri al" style="font-size:10px;color:#475569;cursor:pointer">✕</span>`;
          html += `</div></div>`;
        });
        html += `</div>`;
      }

      // ── Bölüm 3: Özet ──
      html += `<div class="sec-title" style="font-size:13px;margin-top:20px">📊 Özet</div>`;
      var bekleyenHesap = { "4675": 0, "5994": 0 }, bekleyenGenel = 0;
      var buAyGelen = 0, buAyBeklenen = 0;
      tDonemler.forEach(function(dn) {
        Object.keys(dn.hesaplar).forEach(function(h) {
          var net = dn.hesaplar[h].net;
          var geldi = hesapGeldiMi(dn, h);
          if (!geldi) { if (bekleyenHesap[h] == null) bekleyenHesap[h] = 0; bekleyenHesap[h] += net; bekleyenGenel += net; }
          if (dn.odemeTarihi.substring(0, 7) === tBuAy) {
            buAyBeklenen += net;
            if (geldi) buAyGelen += (dn.durum[h].gercekTutar != null ? dn.durum[h].gercekTutar : net);
          }
        });
      });
      html += `<div class="card" style="margin-bottom:8px">`;
      html += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px">`;
      html += `<div style="padding:8px;border-radius:8px;background:rgba(168,85,247,0.08);text-align:center"><div style="font-size:8px;color:#64748b">Bekleyen (genel)</div><div style="font-size:14px;font-weight:800;color:#c4b5fd">${fmt(bekleyenGenel)}</div></div>`;
      html += `<div style="padding:8px;border-radius:8px;background:rgba(255,255,255,0.03);text-align:center"><div style="font-size:8px;color:#64748b">4675 bekleyen</div><div style="font-size:14px;font-weight:800;color:#f8fafc">${fmt(bekleyenHesap["4675"] || 0)}</div></div>`;
      html += `<div style="padding:8px;border-radius:8px;background:rgba(255,255,255,0.03);text-align:center"><div style="font-size:8px;color:#64748b">5994 bekleyen</div><div style="font-size:14px;font-weight:800;color:#f8fafc">${fmt(bekleyenHesap["5994"] || 0)}</div></div>`;
      html += `</div>`;
      html += `<div style="display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;padding-top:6px;border-top:1px solid rgba(255,255,255,0.04)"><span>Bu ay gelen: <strong style="color:#34d399">${fmt(buAyGelen)}</strong></span><span>Bu ay beklenen: <strong style="color:#e2e8f0">${fmt(buAyBeklenen)}</strong></span></div>`;
      html += `</div>`;
      html += `<div style="font-size:10px;color:#64748b;text-align:center;margin-bottom:14px">Ödeme günü ±1-2 gün kayabilir · 31 Tem öncesi için Flora Ödemelerim</div>`;
    }
  }

  // ══ RAPOR ══
  if (state.tab === "rapor") {
    const rData = getPDFReportData(filtered);
    const rStats = rData.stats;
    html += `<div class="sec-title">Detaylı Rapor Oluştur</div>`;
    html += `<div style="font-size:12px;color:#94a3b8;margin-bottom:12px;margin-top:-6px">Şube içi çiçek performansı + önceki dönem karşılaştırması dahil</div>`;

    // ── Rapor tür seçici (Faz 0: yalnız Günlük aktif) ──
    const raporTurleri = [
      { id: "gunluk", ad: "📄 Günlük Operasyon", aktif: true },
      { id: "yonetici", ad: "📊 Yönetici Analiz", aktif: true },
      { id: "trend", ad: "📈 Trend & Piyasa", aktif: false, faz: "Faz 2" },
      { id: "sevkiyat", ad: "🎯 Sevkiyat & Karar", aktif: false, faz: "Faz 3" },
      { id: "aylik", ad: "🏛 Aylık Patron", aktif: false, faz: "Faz 4" }
    ];
    html += `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">`;
    raporTurleri.forEach(rt => {
      if (rt.aktif) {
        const sec = state.raporTur === rt.id;
        html += `<button onclick="setState({raporTur:'${rt.id}',raporTurNot:null})" style="padding:8px 12px;border-radius:10px;border:1px solid ${sec ? '#22c55e' : 'rgba(255,255,255,0.1)'};background:${sec ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)'};color:${sec ? '#4ade80' : '#94a3b8'};font-size:11px;cursor:pointer;font-weight:${sec ? '700' : '400'}">${rt.ad}</button>`;
      } else {
        html += `<button onclick="setState({raporTurNot:'${rt.ad.replace(/'/g, "")} — ${rt.faz}\\'te gelecek'})" style="padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.05);background:rgba(255,255,255,0.02);color:#475569;font-size:11px;cursor:pointer;position:relative">${rt.ad} <span style="font-size:7px;background:rgba(250,204,21,0.15);color:#fbbf24;padding:1px 5px;border-radius:6px;margin-left:2px">yakında</span></button>`;
      }
    });
    html += `</div>`;
    if (state.raporTurNot) html += `<div style="font-size:10px;color:#fbbf24;margin-bottom:10px">ℹ ${esc(state.raporTurNot)}</div>`;
    if (!pdfHazirMi()) html += `<div style="padding:8px 12px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);color:#fca5a5;font-size:11px;margin-bottom:10px">⚠ PDF kütüphanesi yüklenemedi — rapor üretimi devre dışı. İnternet bağlantısını kontrol edip sayfayı yenile.</div>`;

    if (state.raporTur === "yonetici") {
      // ══ 📊 YÖNETİCİ ANALİZ önizlemesi (kompakt) ══
      const yp = getYoneticiPencere(state.yonMezatN);
      const filtreEtiket = state.sf ? state.sf.replace("GRUP:", "") + (state.sf.startsWith("GRUP:") ? " (Grup)" : "") : (state.sb ? state.sb : null);
      html += `<div class="card" style="margin-bottom:14px;background:rgba(255,255,255,0.04)">`;
      html += `<div style="font-size:14px;font-weight:700;color:#f8fafc;margin-bottom:4px">📊 Yönetici Analiz Önizleme</div>`;
      html += `<div style="font-size:10px;color:#64748b;margin-bottom:8px">Son ${yp.gun1.length} mezat: ${yp.gun1.length ? fD(yp.gun1[0]) + " – " + fD(yp.gun1[yp.gun1.length - 1]) : "—"}${filtreEtiket ? ' · <span style="color:#fbbf24">Filtre: ' + esc(filtreEtiket) + '</span>' : ''} · üst tarih filtresinden bağımsız</div>`;
      html += `<div style="display:flex;gap:5px;margin-bottom:10px">`;
      [5, 10, 20].forEach(n => {
        const akt = state.yonMezatN === n;
        html += `<button onclick="setState({yonMezatN:${n}})" style="padding:4px 12px;border-radius:6px;border:1px solid ${akt ? '#7c3aed' : 'rgba(255,255,255,0.08)'};background:${akt ? 'rgba(124,58,237,0.2)' : 'transparent'};color:${akt ? '#c4b5fd' : '#94a3b8'};font-size:10px;cursor:pointer;font-weight:${akt ? '700' : '400'}">${n} mezat</button>`;
      });
      html += `</div>`;

      if (yp.gun1.length === 0) {
        html += `<div style="font-size:12px;color:#fbbf24;text-align:center;padding:16px">Bu filtreyle mezat verisi yok.</div>`;
      } else {
        const g1 = yp.d1.reduce((s, r) => s + r.net, 0), q1 = yp.d1.reduce((s, r) => s + r.d, 0);
        const g0 = yp.d0.reduce((s, r) => s + r.net, 0), q0 = yp.d0.reduce((s, r) => s + r.d, 0);
        const roz = (n1, n0) => n0 > 0 ? `<span style="font-size:8px;color:${n1 >= n0 ? '#34d399' : '#f87171'}">${n1 >= n0 ? '▲' : '▼'} ${Math.abs((n1 - n0) / n0 * 100).toFixed(0)}%</span>` : '';
        const med1 = getMedyanGunlukDbn(yp.d1), med0 = getMedyanGunlukDbn(yp.d0);
        const as1 = new Set(yp.d1.map(r => r.s)).size, as0 = new Set(yp.d0.map(r => r.s)).size;
        const au1 = new Set(yp.d1.map(r => r.c)).size, au0 = new Set(yp.d0.map(r => r.c)).size;
        const kpiler = [
          ["Net Gelir", fmt(g1), roz(g1, g0)],
          ["Demet", String(q1), roz(q1, q0)],
          ["Ort dbn", q1 > 0 ? fmt2(g1 / q1) : "—", q0 > 0 && q1 > 0 ? roz(g1 / q1, g0 / q0) : ""],
          ["Medyan dbn", med1 !== null ? fmt2(med1) : "—", med0 !== null && med1 !== null ? roz(med1, med0) : ""],
          ["Aktif Şube", String(as1), roz(as1, as0)],
          ["Aktif Ürün", String(au1), roz(au1, au0)]
        ];
        html += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px">`;
        kpiler.forEach(k => {
          html += `<div style="padding:7px;border-radius:8px;background:rgba(255,255,255,0.03);text-align:center"><div style="font-size:7px;color:#64748b;text-transform:uppercase">${k[0]}</div><div style="font-size:12px;font-weight:800;color:#e2e8f0">${k[1]}</div>${k[2] ? '<div>' + k[2] + '</div>' : ''}</div>`;
        });
        html += `</div>`;

        // Ayrıştırma özet cümlesi
        if (yp.gun1.length >= 3 && yp.gun0.length >= 3) {
          const dg = decomposeGelir(yp.d1, yp.d0);
          const isr = v => (v >= 0 ? "+" : "−") + fmt(Math.abs(v));
          html += `<div style="padding:8px 10px;border-radius:8px;background:rgba(168,85,247,0.07);border:1px solid rgba(168,85,247,0.15);font-size:10.5px;color:#e2e8f0;margin-bottom:8px">Gelir ${isr(dg.delta)}: ${isr(dg.hacim)} hacim, ${isr(dg.fiyat)} fiyat, ${isr(dg.mix)} karma, ${isr(dg.yeniCikan)} yeni/çıkan ürün</div>`;
        } else {
          html += `<div style="font-size:10px;color:#64748b;margin-bottom:8px">Gelir ayrıştırması: yetersiz dönem verisi (iki pencerede ≥3 mezat günü gerekli)</div>`;
        }

        // Fırsat çift değeri
        if (yp.oncesi) {
          const fir = getBrutFiyatFirsati(yp.d1, yp.oncesi);
          html += `<div style="display:flex;gap:6px;margin-bottom:8px">`;
          html += `<div style="flex:1;padding:7px 9px;border-radius:8px;background:rgba(255,255,255,0.03)"><div style="font-size:7px;color:#64748b">FIRSAT — TEORİK (üst sınır)</div><div style="font-size:12px;font-weight:800;color:#94a3b8">${fmt(fir.teorik)}</div></div>`;
          html += `<div style="flex:1;padding:7px 9px;border-radius:8px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15)"><div style="font-size:7px;color:#64748b">FIRSAT — KAPASİTE AYARLI</div><div style="font-size:12px;font-weight:800;color:#4ade80">${fmt(fir.ayarli)}</div></div>`;
          html += `</div>`;
        }

        // İlk 5 Top kombo (n≥3)
        const yRS = getRS(yp.d1);
        const komboM = {};
        yp.d1.forEach(r => {
          const k = r.c + "|" + r.s;
          if (!komboM[k]) komboM[k] = { c: r.c, s: r.s, net: 0, d: 0, gunler: new Set() };
          komboM[k].net += r.net; komboM[k].d += r.d; komboM[k].gunler.add(r.t);
        });
        const topK = Object.values(komboM).map(k => ({ ...k, n: k.gunler.size, dbn: k.d > 0 ? k.net / k.d : 0 }))
          .filter(k => k.n >= 3).sort((a, b) => b.dbn - a.dbn).slice(0, 5);
        if (topK.length) {
          html += `<div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:4px">Top 5 Kombo (dbn)</div>`;
          topK.forEach(k => {
            const rsV = yRS.kombo[k.c + "|" + k.s];
            const rsRenk = !rsV ? "#475569" : rsV.rs > 1.05 ? "#34d399" : rsV.rs < 0.95 ? "#f87171" : "#94a3b8";
            html += `<div style="display:flex;justify-content:space-between;font-size:10px;padding:3px 0;border-top:1px solid rgba(255,255,255,0.03)"><span style="color:#cbd5e1">${esc(k.c)} → ${esc(k.s)} <span style="color:#475569">(n=${k.n})</span></span><span><span style="color:#34d399;font-weight:600">${fmt(k.dbn)}/dm</span> <span style="color:${rsRenk};font-size:9px">${rsV ? "RS " + rsV.rs.toFixed(2).replace(".", ",") + " (n=" + rsV.n + ")" : "RS —"}</span></span></div>`;
          });
        }
        html += `<div style="font-size:9px;color:#475569;margin-top:8px">PDF'te tüm bölümler tam detaylı: ayrıştırma tablosu, ürün×şube heatmap, şube VI/RS tablosu, fırsat detayı, Top/Bottom-10.</div>`;
      }
      html += `</div>`;
      const yPdfOk = pdfHazirMi() && yp.gun1.length > 0;
      html += `<button onclick="generateYoneticiPDF()" ${yPdfOk ? '' : 'disabled'} style="width:100%;padding:14px;border-radius:12px;border:none;cursor:${yPdfOk ? 'pointer' : 'not-allowed'};font-size:14px;font-weight:600;background:${yPdfOk ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : 'rgba(255,255,255,0.06)'};color:${yPdfOk ? '#fff' : '#475569'};margin-bottom:10px">📊 Yönetici Analiz PDF Oluştur</button>`;
    } else {

    // Report preview
    html += `<div class="card" style="margin-bottom:14px;background:rgba(255,255,255,0.04)">`;
    html += `<div style="font-size:14px;font-weight:700;color:#f8fafc;margin-bottom:12px">📄 Rapor Önizleme</div>`;
    html += `<div style="font-size:11px;color:#64748b;margin-bottom:10px">${dateLabel}</div>`;

    // ☀ Bugünün Özeti (deterministik — önizlemenin EN ÜSTÜNDE)
    const ozetC = getOzetCumleleri(filtered);
    if (ozetC) {
      html += `<div style="padding:10px 12px;border-radius:10px;background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.18);margin-bottom:12px">`;
      html += `<div style="font-size:11px;font-weight:700;color:#4ade80;margin-bottom:6px">☀ Bugünün Özeti${(state.sf || state.sb) ? ' <span style="font-size:9px;color:#fbbf24;font-weight:400">· filtreli</span>' : ''}</div>`;
      ozetC.forEach(c => { html += `<div style="font-size:10.5px;color:#e2e8f0;padding:2px 0;line-height:1.5">• ${esc(c)}</div>`; });
      html += `</div>`;
    }

    // Summary — Net Gelir + Demet + Dm Başı Net
    html += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px">`;
    html += `<div style="padding:8px;border-radius:8px;background:rgba(34,197,94,0.08)"><div style="font-size:9px;color:#64748b">Net Gelir</div><div style="font-size:15px;font-weight:800;color:#4ade80">${fmt(rStats.tn)}</div></div>`;
    html += `<div style="padding:8px;border-radius:8px;background:rgba(255,255,255,0.03)"><div style="font-size:9px;color:#64748b">Demet</div><div style="font-size:15px;font-weight:800;color:#f8fafc">${rStats.td}</div></div>`;
    html += `<div style="padding:8px;border-radius:8px;background:rgba(255,255,255,0.03)"><div style="font-size:9px;color:#64748b">Dm Başı Net</div><div style="font-size:15px;font-weight:800;color:#f8fafc">${fmt2(rStats.av)}</div></div>`;
    html += `</div>`;

    // V2 gerçek kesinti satırı (dönemde V2 verisi varsa)
    const rV2 = getV2Ozet(filtered);
    if (rV2.kesintiPct !== null) {
      html += `<div style="padding:6px 10px;border-radius:8px;background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.15);margin-bottom:12px;font-size:11px;color:#c4b5fd">💸 Gerçek kesinti oranı: <strong>%${rV2.kesintiPct.toFixed(1)}</strong></div>`;
    }

    // Önceki dönem — ÜÇ DELTA birlikte
    if (rData.hasPrev) {
      const chNet = rData.prevTotalNet > 0 ? ((rStats.tn - rData.prevTotalNet) / rData.prevTotalNet * 100) : null;
      const chD = rData.prevTotalD > 0 ? ((rStats.td - rData.prevTotalD) / rData.prevTotalD * 100) : null;
      const chDbn = rData.prevTotalDbn > 0 ? ((rStats.av - rData.prevTotalDbn) / rData.prevTotalDbn * 100) : null;
      html += `<div style="padding:8px 10px;border-radius:8px;background:rgba(96,165,250,0.06);border:1px solid rgba(96,165,250,0.1);margin-bottom:12px">`;
      html += `<div style="font-size:10px;color:#93c5fd;margin-bottom:6px">📊 Önceki ${rData.prevMezatCount} mezata göre (${fD(rData.prevSD)}–${fD(rData.prevED)})</div>`;
      html += `<div style="display:flex;gap:12px;font-size:11px">`;
      if (chNet != null) html += `<div><span style="color:#64748b">Net:</span> <span style="color:${chNet>=0?'#34d399':'#f87171'};font-weight:600">${chNet>=0?'+':''}${chNet.toFixed(0)}%</span></div>`;
      if (chD != null) html += `<div><span style="color:#64748b">Demet:</span> <span style="color:${chD>=0?'#34d399':'#f87171'};font-weight:600">${chD>=0?'+':''}${chD.toFixed(0)}%</span></div>`;
      if (chDbn != null) html += `<div><span style="color:#64748b">Dm Net:</span> <span style="color:${chDbn>=0?'#34d399':'#f87171'};font-weight:600">${chDbn>=0?'+':''}${chDbn.toFixed(0)}%</span></div>`;
      html += `</div></div>`;
    }

    // Top 5 flowers
    html += `<div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Dm Başı Net Liderleri (İlk 5)</div>`;
    rStats.byF.slice(0, 5).forEach((f, i) => {
      html += `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.03);font-size:12px">`;
      html += `<span style="color:#e2e8f0">${i+1}. ${esc(f.name)}</span>`;
      html += `<span style="color:#34d399;font-weight:600">${fmt(f.dbn)}/dm · ${f.d}dm</span>`;
      html += `</div>`;
    });

    // Şube detay preview — bağlam ekli (dm başı + pay % + demet)
    const rTotalNet = rData.branchList.reduce((s,b) => s + b.net, 0);
    html += `<div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin:12px 0 6px">Şube Detayları (ilk 3)</div>`;
    rData.branchList.slice(0, 3).forEach((b, i) => {
      const bDbn = b.d > 0 ? b.net / b.d : 0;
      const bPay = rTotalNet > 0 ? (b.net / rTotalNet * 100) : 0;
      html += `<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04)">`;
      html += `<div style="display:flex;justify-content:space-between;margin-bottom:2px">`;
      html += `<span style="font-size:12px;font-weight:600;color:#f8fafc">${i===0?'🏆 ':''}${esc(b.name)}</span>`;
      html += `<span style="font-size:12px;color:#34d399;font-weight:600">${fmt(b.net)}</span>`;
      html += `</div>`;
      html += `<div style="font-size:9px;color:#64748b;margin-bottom:3px">${b.d}dm · ${fmt(bDbn)}/dm · <span style="color:#fbbf24">%${bPay.toFixed(0)} pay</span></div>`;
      if (b.dbnChange != null) {
        html += `<div style="font-size:9px;color:${b.dbnChange>0?'#34d399':'#f87171'};margin-bottom:3px">Önceki döneme göre dm başı: ${b.dbnChange>0?'+':''}${b.dbnChange.toFixed(1)}%</div>`;
      }
      b.flowers.slice(0, 3).forEach(fl => {
        html += `<div style="display:flex;justify-content:space-between;padding:2px 0 2px 10px;font-size:10px">`;
        html += `<span style="color:#94a3b8">${esc(fl.name)}</span>`;
        html += `<span><span style="color:#cbd5e1">${fl.d}dm · ${fmt(fl.dbn)}/dm</span>`;
        if (fl.dbnChange != null) html += ` <span style="color:${fl.dbnChange>0?'#34d399':'#f87171'};font-size:9px">${fl.dbnChange>0?'+':''}${fl.dbnChange.toFixed(0)}%</span>`;
        html += `</span></div>`;
      });
      html += `</div>`;
    });

    // Veri zamanı + kayıt sayısı
    html += `<div style="display:flex;justify-content:space-between;font-size:8px;color:#475569;margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.04)">`;
    html += `<span>${filtered.length} kayıt · ${rStats.td} demet</span>`;
    html += `<span>${window._DATA_QUALITY ? '↻ ' + window._DATA_QUALITY.sonGuncelleme : ''}</span>`;
    html += `</div>`;

    html += `<div style="font-size:10px;color:#475569;margin-top:4px;font-style:italic">PDF'te tüm şubeler ve çiçekler tam detaylı yer alır</div>`;
    html += `</div>`;

    // Generate PDF button (kütüphane yüklenemediyse devre dışı)
    const pdfOk = pdfHazirMi();
    html += `<button onclick="generatePDF()" ${pdfOk ? '' : 'disabled'} style="width:100%;padding:14px;border-radius:12px;border:none;cursor:${pdfOk ? 'pointer' : 'not-allowed'};font-size:14px;font-weight:600;background:${pdfOk ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'rgba(255,255,255,0.06)'};color:${pdfOk ? '#fff' : '#475569'};margin-bottom:10px">📄 PDF Rapor Oluştur ve Paylaş</button>`;

    // Copy text version
    html += `<button onclick="copyReportText()" style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);cursor:pointer;font-size:13px;font-weight:500;background:rgba(255,255,255,0.04);color:#94a3b8">📋 Metin Olarak Kopyala (WhatsApp için)</button>`;
    }
  }

  // ══ AI ══
  if (state.tab === "ai") {
    html += `<div class="sec-title">AI Çiçek Danışmanı</div>`;
    html += `<div style="font-size:11px;color:#94a3b8;margin-bottom:10px;margin-top:-6px">Kesme çiçek mezat uzmanı — gönderim, fiyat ve strateji danışmanın</div>`;

    // Hızlı aksiyon butonları
    html += `<div style="margin-bottom:6px"><div style="font-size:9px;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">📋 Brifing</div><div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">`;
    ["☀ Bugün ne yapmalıyım?","📊 Haftalık özet","🔮 Gelecek hafta tahmini"].forEach(q => {
      html += `<button class="ai-chip" style="background:rgba(34,197,94,0.08);border-color:rgba(34,197,94,0.15);color:#6ee7b7" onclick="setAIQ('${q.replace(/'/g,"\\'")}');handleAI()">${q}</button>`;
    });
    html += `</div></div>`;

    html += `<div style="margin-bottom:6px"><div style="font-size:9px;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">🎯 Strateji</div><div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">`;
    ["Hangi şubeye göndermeli?","Hangi gün göndermeli?","En kârlı 5 kombo?","Fiyat trendi nasıl?"].forEach(q => {
      html += `<button class="ai-chip" onclick="setAIQ('${q.replace(/'/g,"\\'")}');handleAI()">${q}</button>`;
    });
    html += `</div></div>`;

    html += `<div style="margin-bottom:10px"><div style="font-size:9px;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">🔍 Analiz</div><div style="display:flex;gap:5px;flex-wrap:wrap">`;
    ["Geçen yıla göre durum?","En kötü performans?","Şubeleri karşılaştır","Bu dönemi özetle"].forEach(q => {
      html += `<button class="ai-chip" onclick="setAIQ('${q.replace(/'/g,"\\'")}');handleAI()">${q}</button>`;
    });
    html += `</div></div>`;

    html += `<div id="aiChat" style="margin-bottom:14px;max-height:450px;overflow-y:auto">`;
    state.aiH.forEach(m => {
      // Simple markdown: **bold** → <strong>, \n → <br>
      let msgHTML = esc(m.t).replace(/\*\*(.*?)\*\*/g, '<strong style="color:#f8fafc">$1</strong>').replace(/\n/g, '<br>');
      html += `<div class="ai-msg ${m.r==='u'?'ai-msg-user':'ai-msg-ai'}"><div style="font-size:9px;color:${m.r==='u'?'#a78bfa':'#34d399'};margin-bottom:3px;font-weight:600">${m.r==='u'?'Sen':'✦ AI Uzman'}</div><div style="font-size:12px;color:#e2e8f0;line-height:1.6">${msgHTML}</div>`;
      // AI cevaplarının altına veri zemini ekle
      if (m.r === 'a') {
        html += `<div style="margin-top:6px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.04);font-size:8px;color:#475569">📋 ${dateLabel} · ${filtered.length} kayıt · ${stats.td} dm${window._DATA_QUALITY ? ' · ↻ ' + window._DATA_QUALITY.sonGuncelleme : ''}</div>`;
      }
      html += `</div>`;
    });
    if (state.aiL) html += `<div class="ai-msg ai-msg-ai"><div style="color:#64748b;font-size:12px">Analiz ediliyor...</div></div>`;
    html += `</div>`;
    html += `<div style="display:flex;gap:8px;position:sticky;bottom:0;padding:8px 0;background:#0b0e18"><input class="ai-input" id="aiInput" value="${esc(state.aiQ)}" placeholder="Sor: Frezya Mor'u nereye göndermeli?" onkeydown="if(event.key==='Enter')handleAI()"><button class="ai-send" style="background:${state.aiQ.trim()?'linear-gradient(135deg,#7c3aed,#6d28d9)':'rgba(255,255,255,0.06)'};color:${state.aiQ.trim()?'#fff':'#475569'}" onclick="handleAI()">Sor</button></div>`;
    // Clear chat button
    if (state.aiH.length > 0) html += `<button onclick="state.aiH=[];render()" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);background:transparent;color:#475569;font-size:10px;cursor:pointer;margin-top:4px">Sohbeti temizle</button>`;
  }

  html += `</div>`;
  document.getElementById("app").innerHTML = html;

  // Restore AI input focus and scroll to bottom
  if (state.tab === "ai") {
    const inp = document.getElementById("aiInput");
    if (inp) inp.addEventListener("input", e => state.aiQ = e.target.value);
    // Scroll chat to bottom
    const chat = document.getElementById("aiChat");
    if (chat) chat.scrollTop = chat.scrollHeight;
  }
  // Restore mevsim search scroll position
  if (state.tab === "mevsim" && window._msScroll) {
    window.scrollTo(0, window._msScroll);
    window._msScroll = null;
  }
}

// ═══════════════ DROPDOWN RENDERER ═══════════════

// ═══════════════ DROPDOWN + MISC UI ═══════════════
function renderDropdown(label, value, stateKey, grouped) {
  const isOpen = state.ddOpen === stateKey;
  const options = stateKey === "sf" ? FLOWERS : BRANCHES;
  let display = value ? value.replace("GRUP:", "") + (value.startsWith("GRUP:") ? " (Grup)" : "") : "Tümü";

  let html = `<div class="dropdown"><div class="lbl">${label}</div>`;
  html += `<button class="dropdown-btn ${value?'has-val':''}" onclick="event.stopPropagation();setState({ddOpen:state.ddOpen==='${stateKey}'?null:'${stateKey}'})"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(display)}</span><span style="font-size:8px;color:#64748b">${isOpen?'▲':'▼'}</span></button>`;

  if (isOpen) {
    html += `<div class="dropdown-list">`;
    html += `<div class="dropdown-item ${!value?'active':''}" onclick="event.stopPropagation();setState({${stateKey}:null,ddOpen:null})">Tümü</div>`;
    if (grouped && GROUP_NAMES.length > 0) {
      GROUP_NAMES.forEach(grp => {
        const grpVal = "GRUP:" + grp;
        html += `<div class="dropdown-item group-header ${value===grpVal?'active':''}" onclick="event.stopPropagation();setState({${stateKey}:'${grpVal}',ddOpen:null})">${esc(grp)} (Tümü)</div>`;
        (CICEK_GROUPS[grp] || []).forEach(item => {
          html += `<div class="dropdown-item sub-item ${value===item?'active':''}" onclick="event.stopPropagation();setState({${stateKey}:'${item}',ddOpen:null})">${esc(item.replace(grp+" ",""))}</div>`;
        });
      });
      // Ungrouped flowers
      const grouped_flowers = Object.values(CICEK_GROUPS).flat();
      const ungrouped = options.filter(f => !grouped_flowers.includes(f));
      ungrouped.forEach(f => {
        html += `<div class="dropdown-item ${value===f?'active':''}" onclick="event.stopPropagation();setState({${stateKey}:'${f}',ddOpen:null})">${esc(f)}</div>`;
      });
    } else {
      options.forEach(o => {
        html += `<div class="dropdown-item ${value===o?'active':''}" onclick="event.stopPropagation();setState({${stateKey}:'${o}',ddOpen:null})">${esc(o)}</div>`;
      });
    }
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

// ═══════════════ ACTIONS ═══════════════
async function refreshData() {
  document.getElementById("app").innerHTML = '<div class="loading-screen"><div class="spinner"></div><div style="font-size:14px;margin-bottom:6px">Veriler yenileniyor...</div></div>';
  await loadAllData();
  render();
}

// ═══════════════ PLANNER FUNCTIONS ═══════════════
function addPlanFlower() {
  var sel = document.getElementById("planFlowerSelect");
  var inp = document.getElementById("planDemetInput");
  if (!sel || !inp || !sel.value || !inp.value) return;
  var name = sel.value;
  var demet = parseInt(inp.value) || 0;
  if (demet <= 0) return;
  // Check if already exists, update
  var existing = state.planFlowers.find(f => f.name === name);
  if (existing) existing.demet = demet;
  else state.planFlowers.push({ name: name, demet: demet });
  state.planResult = null;
  render();
}

function removePlanFlower(index) {
  state.planFlowers.splice(index, 1);
  state.planResult = null;
  render();
}

function togglePlanBranch(name) {
  var idx = state.planManualBranches.indexOf(name);
  if (idx >= 0) state.planManualBranches.splice(idx, 1);
  else state.planManualBranches.push(name);
  state.planResult = null;
  render();
}

function copyPlan() {
  if (state.planResult) {
    navigator.clipboard.writeText(state.planResult.replace(/\*\*/g, "")).then(function(){
      alert("Plan kopyalandı!");
    });
  }
}

function generatePlanPDFHTML(planText, flowers, strategy, estimatedNet, dateStr) {
  var cleanText = planText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Bölümleri ayır
  var sections = cleanText.split('\n');
  var formattedLines = [];
  sections.forEach(function(line) {
    var trimmed = line.trim();
    if (!trimmed) { formattedLines.push('<div style="height:6px"></div>'); return; }
    // Emoji ile başlayan başlıklar
    if (/^[📦📊🚨⚠✅❌🏆💡🔍📍📈]/.test(trimmed) || trimmed.startsWith('##')) {
      formattedLines.push('<div style="font-size:13px;font-weight:700;color:#16a34a;margin:12px 0 4px;border-bottom:1px solid #e5e7eb;padding-bottom:3px">' + trimmed.replace(/^##\s*/, '') + '</div>');
    } else if (trimmed.startsWith('- Kutu') || trimmed.startsWith('  Kutu') || trimmed.startsWith('Kutu')) {
      formattedLines.push('<div style="font-size:11px;color:#333;padding:3px 0 3px 16px;border-left:3px solid #22c55e;margin:2px 0">' + trimmed + '</div>');
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      formattedLines.push('<div style="font-size:11px;color:#444;padding:2px 0 2px 10px">' + trimmed + '</div>');
    } else {
      formattedLines.push('<div style="font-size:11px;color:#333;padding:1px 0">' + trimmed + '</div>');
    }
  });

  var flowerList = flowers.map(function(f){ return f.name + ': ' + f.demet + ' dm' }).join(' · ');
  var strategyLabel = strategy === 'safe' ? 'Güvenli' : strategy === 'balanced' ? 'Dengeli' : 'Agresif';

  var pdfHTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>';
  pdfHTML += 'body{font-family:Arial,sans-serif;padding:20px;max-width:700px;margin:0 auto;color:#1a1a1a;font-size:11px}';
  pdfHTML += 'h1{font-size:20px;color:#16a34a;margin-bottom:2px}';
  pdfHTML += '.subtitle{font-size:12px;color:#666;margin-bottom:16px}';
  pdfHTML += '.info-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:14px 0;padding:12px;background:#f0fdf4;border-radius:8px}';
  pdfHTML += '.info-item{text-align:center}.info-label{font-size:9px;color:#666;text-transform:uppercase}.info-val{font-size:16px;font-weight:800;color:#16a34a}';
  pdfHTML += '.plan-body{margin:16px 0}';
  pdfHTML += '.footer{margin-top:20px;padding-top:8px;border-top:1px solid #ddd;font-size:9px;color:#999;text-align:center}';
  pdfHTML += '@media print{body{padding:10px} .no-print{display:none}}';
  pdfHTML += '</style></head><body>';

  pdfHTML += '<h1>🌸 Çallı Çiçek — Gönderim Planı</h1>';
  pdfHTML += '<div class="subtitle">📅 ' + fDF(dateStr) + ' · ' + strategyLabel + ' Strateji</div>';

  pdfHTML += '<div class="info-grid">';
  pdfHTML += '<div class="info-item"><div class="info-label">Çiçekler</div><div style="font-size:11px;font-weight:600;color:#333">' + flowerList + '</div></div>';
  pdfHTML += '<div class="info-item"><div class="info-label">Toplam Demet</div><div class="info-val">' + flowers.reduce(function(s,f){return s+f.demet},0) + '</div></div>';
  if (estimatedNet > 0) {
    pdfHTML += '<div class="info-item"><div class="info-label">Tahmini Net</div><div class="info-val">' + fmt(estimatedNet) + '</div></div>';
  }
  pdfHTML += '</div>';

  pdfHTML += '<div class="plan-body">' + formattedLines.join('') + '</div>';

  pdfHTML += '<div class="footer">Çallı Çiçek Üretici Paneli · ' + new Date().toLocaleDateString("tr-TR") + '</div>';
  pdfHTML += '<script>window.onload=function(){window.print()}<\/script>';
  pdfHTML += '</body></html>';
  return pdfHTML;
}

function planPDF() {
  if (!state.planResult) return;
  var pdfHTML = generatePlanPDFHTML(
    state.planResult,
    state.planFlowers.map(function(f){return {name:f.name,demet:f.demet}}),
    state.planStrategy,
    state.planTahminiNet || 0,
    new Date().toISOString().split("T")[0]
  );
  var w = window.open('', '_blank');
  if (w) { w.document.write(pdfHTML); w.document.close(); }
}

function savedPlanPDF(index) {
  var savedPlans = JSON.parse(localStorage.getItem("savedPlans") || "[]");
  if (index < 0 || index >= savedPlans.length) return;
  var plan = savedPlans[index];
  var pdfHTML = generatePlanPDFHTML(
    plan.result,
    plan.flowers,
    plan.strategy,
    plan.estimatedNet || 0,
    plan.date
  );
  var w = window.open('', '_blank');
  if (w) { w.document.write(pdfHTML); w.document.close(); }
}

function savePlan() {
  if (!state.planResult) return;
  var savedPlans = JSON.parse(localStorage.getItem("savedPlans") || "[]");

  // Dağılım bazlı tahmin (marjinal tahsis motoru çıktısı)
  var estimatedNet = state.planTahminiNet || 0;
  var bugun = new Date().toISOString().split("T")[0];

  // Şema v2 — dual-write: eski alan adları (date/flowers/strategy/estimatedNet)
  // görüntüleme geriye-uyumu için korunur, yeni alanlar kalibrasyon için eklenir
  savedPlans.push({
    schemaVersion: 2,
    date: bugun,
    tarih: bugun,
    timestamp: Date.now(),
    olusturmaZamani: new Date().toISOString(),
    motorNesli: "marjinal",
    flowers: state.planFlowers.map(function(f){return {name:f.name,demet:f.demet}}),
    cicekler: state.planFlowers.map(function(f){return {ad:f.name,demet:f.demet}}),
    boxSize: state.planBoxSize,
    kutuBoyu: state.planBoxSize,
    strategy: state.planStrategy,
    strateji: state.planStrategy,
    result: state.planResult,
    estimatedNet: estimatedNet,
    tahminiToplamNet: estimatedNet,
    dagilim: state.planDagilim || [],
    beklet: state.planBeklet || [],
    gerceklesen: null
  });
  localStorage.setItem("savedPlans", JSON.stringify(savedPlans));
  alert(estimatedNet > 0
    ? "Plan kaydedildi! Tahmini net: " + fmt(estimatedNet)
    : "Plan kaydedildi!");
  render();
}

function deletePlan(index) {
  var savedPlans = JSON.parse(localStorage.getItem("savedPlans") || "[]");
  if (confirm("Bu planı silmek istediğine emin misin?")) {
    savedPlans.splice(index, 1);
    localStorage.setItem("savedPlans", JSON.stringify(savedPlans));
    render();
  }
}

// ═══════════════ REFRESH + PLANNER UI FUNCTIONS ═══════════════

// ═══════════════ PRESETS + UI HELPERS ═══════════════
function setPreset(p) {
  const today = new Date().toISOString().split("T")[0];
  const year = today.substring(0, 4);
  const month = today.substring(0, 7);
  if (p === "today") setState({ sd: today, ed: today });
  else if (p === "week") {
    const d = new Date(); d.setDate(d.getDate() - 6);
    setState({ sd: d.toISOString().split("T")[0], ed: today });
  }
  else if (p === "month") setState({ sd: month + "-01", ed: today });
  else if (p === "all") setState({ sd: "2019-01-01", ed: today });
}

function toggleExp(key) {
  state.expanded[key] = !state.expanded[key];
  render();
}

function toggleRiskCicek(cicek) {
  const VARS = window._RISK_VARS || [];
  if (!state.riskCicekler) {
    // İlk tıklamada varsayılan listeden başla
    state.riskCicekler = VARS.slice();
  }
  const has = state.riskCicekler.some(function(v){ return cicek.toUpperCase().includes(v.toUpperCase()) || v.toUpperCase().includes(cicek.toUpperCase()); });
  if (has) {
    state.riskCicekler = state.riskCicekler.filter(function(v){ return !cicek.toUpperCase().includes(v.toUpperCase()) && !v.toUpperCase().includes(cicek.toUpperCase()); });
  } else {
    state.riskCicekler.push(cicek);
  }
  render();
}
