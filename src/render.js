// ═══════════════ RENDER HELPERS ═══════════════
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
  const tabList = [{id:"panel",l:"Panel",i:"◉"},{id:"plan",l:"Planlayıcı",i:"🎯"},{id:"sube",l:"Şube Tablosu",i:"📋"},{id:"compare",l:"Karşılaştır",i:"⚡"},{id:"heat",l:"Kâr Haritası",i:"🔥"},{id:"tablo",l:"Tablo",i:"☰"},{id:"rapor",l:"Rapor",i:"📄"},{id:"ai",l:"AI",i:"✦"},{id:"yoy",l:"Geçen Yıl",i:"📊"},{id:"mevsim",l:"Mevsimsellik",i:"🗓"},{id:"cicekanaliz",l:"Çiçek Analiz",i:"🌷"},{id:"tahtrend",l:"Tahmin & Risk",i:"🔮"}];
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
    const prevMezatData = (function(){
      const dates = [...new Set(ALL_DATA.filter(r => r.t < state.sd).map(r => r.t))].sort().reverse();
      const gunSayisi = [...new Set(filtered.map(r => r.t))].length;
      const prevDates = dates.slice(0, Math.max(gunSayisi, 1));
      if (prevDates.length === 0) return null;
      const pd = ALL_DATA.filter(r => prevDates.includes(r.t));
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

    // Veri kalite göstergesi
    if (window._DATA_QUALITY) {
      const dq = window._DATA_QUALITY;
      html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px;margin-bottom:8px;border-radius:6px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04)">`;
      html += `<div style="font-size:8px;color:#475569">${new Intl.NumberFormat("tr-TR").format(dq.toplamKayit)} kayıt · ${new Intl.NumberFormat("tr-TR").format(dq.toplamDemet)} dm · Son veri: ${dq.enSonTarih}</div>`;
      html += `<div style="font-size:8px;color:#475569">↻ ${dq.sonGuncelleme}</div>`;
      html += `</div>`;
    }

    if (stats.dl.length > 1) {
      const mx = Math.max(...stats.dl.map(x => x.ciro));
      html += `<div class="card" style="margin-top:16px;margin-bottom:6px"><div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:10px">Günlük Ciro</div><div style="display:flex;align-items:flex-end;gap:3px;height:65px">`;
      stats.dl.forEach(d => {
        const h = mx > 0 ? (d.ciro / mx) * 65 : 3;
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
      html += `<div class="rank-item"><div style="display:flex;align-items:center;gap:8px"><div class="rank-num" style="background:${i<3?bgs[i]:'rgba(255,255,255,0.04)'};color:${i<3?colors[i]:'#64748b'}">${i+1}</div><div><div style="font-size:12px;font-weight:600;color:#f8fafc">${esc(f.name)}</div><div style="font-size:10px;color:#64748b">${f.d}dm · ${fmt(f.avgP)}</div></div></div><div style="text-align:right;display:flex;align-items:center;gap:6px"><div><div style="font-size:14px;font-weight:700;color:#34d399">${fmt(f.dbn)}</div><div style="font-size:9px;color:#64748b">dm başı net</div></div><div style="font-size:10px;color:#475569">${isChartOpen?'▲':'▼'}</div></div></div>`;
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
      html += `<div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:13px;font-weight:600;color:#f8fafc">${esc(b.name)}</div><div style="font-size:10px;color:#64748b">${b.d}dm · ${fmt2(b.avgP)}</div></div><div style="text-align:right;display:flex;align-items:center;gap:6px"><div style="font-size:13px;font-weight:700;color:#34d399">${fmt(b.net)}</div><div style="font-size:10px;color:#475569">${isChartOpen?'▲':'▼'}</div></div></div>`;
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
      // Tahmini net gelir kartı (kod hesaplaması)
      if (state.planCodeEstimate > 0) {
        var totalDm = state.planFlowers.reduce(function(s,f){return s+f.demet},0);
        var totalKt = Math.ceil(totalDm / state.planBoxSize);
        var avgPerDm = totalDm > 0 ? state.planCodeEstimate / totalDm : 0;
        html += `<div class="card" style="background:rgba(168,85,247,0.08);border-color:rgba(168,85,247,0.15);margin-bottom:10px;padding:14px">`;
        html += `<div style="display:flex;justify-content:space-between;align-items:center">`;
        html += `<div><div style="font-size:10px;color:#a78bfa;text-transform:uppercase;letter-spacing:0.5px">🔮 Tahmini Net Gelir (trend bazlı)</div><div style="font-size:22px;font-weight:800;color:#c4b5fd;margin-top:2px">${fmt(state.planCodeEstimate)}</div></div>`;
        html += `<div style="text-align:right"><div style="font-size:10px;color:#64748b">${totalKt} kutu · ${totalDm} dm</div><div style="font-size:10px;color:#64748b">Ort: ${fmt(avgPerDm)}/dm</div></div>`;
        html += `</div>`;
        html += `<div style="margin-top:8px;font-size:10px;color:#475569">Son 2 mezat %70 + genel ort %30 ile hesaplandı. Paneldeki net gelirden farklı olabilir — bu gelecek tahminidir, geçmiş gerçekleşme değil.</div>`;
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
          } else {
            html += `<div><div style="font-size:9px;color:#64748b">Gerçekleşen</div><div style="font-size:12px;color:#475569">Henüz veri yok</div></div>`;
          }
          html += `</div>`;
        }

        // Toggle details
        if (state.expanded["plan_"+realIdx]) {
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
    const prevBrPerf = {};
    const filteredDates = [...new Set(filtered.map(r => r.t))].sort();
    const gunSayisiSube = filteredDates.length;
    const prevDatesAll = [...new Set(ALL_DATA.filter(r => r.t < (filteredDates[0]||state.sd)).map(r => r.t))].sort().reverse().slice(0, Math.max(gunSayisiSube, 1));
    ALL_DATA.filter(r => prevDatesAll.includes(r.t)).forEach(r => {
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

    brList.slice(0, state.expanded.subeDetail ? 999 : 5).forEach((b, i) => {
      const flowers = brFlower[b.name] || {};
      const fList = Object.entries(flowers).map(([n, v]) => ({ name: n, ...v, dbn: v.d > 0 ? v.net / v.d : 0 })).sort((a, bb) => bb.dbn - a.dbn);
      const subeToplamNet = fList.reduce((s, fl) => s + fl.net, 0);

      html += `<div class="card" style="margin-bottom:8px;padding:12px 14px">`;
      html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">`;
      html += `<div style="font-size:13px;font-weight:600;color:#f8fafc">${esc(b.name)}</div>`;
      html += `<div style="font-size:9px;color:#64748b">${fList.length} çiçek · ${b.records} kayıt</div>`;
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
      html += `</div></div>`;

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
    let caList = Object.entries(sd.cicekMevsim).map(([c, aylar]) => ({ cicek: c, aylar, totalD: Object.values(aylar).reduce((s, a) => s + a.totalD, 0) })).filter(item => !item.cicek.toLowerCase().includes("saksı") && !item.cicek.toLowerCase().includes("saksi")).sort((a, b) => b.totalD - a.totalD);
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

  // ══ RAPOR ══
  if (state.tab === "rapor") {
    const rData = getPDFReportData(filtered);
    const rStats = rData.stats;
    html += `<div class="sec-title">Detaylı Rapor Oluştur</div>`;
    html += `<div style="font-size:12px;color:#94a3b8;margin-bottom:16px;margin-top:-6px">Şube içi çiçek performansı + önceki dönem karşılaştırması dahil</div>`;

    // Report preview
    html += `<div class="card" style="margin-bottom:14px;background:rgba(255,255,255,0.04)">`;
    html += `<div style="font-size:14px;font-weight:700;color:#f8fafc;margin-bottom:12px">📄 Rapor Önizleme</div>`;
    html += `<div style="font-size:11px;color:#64748b;margin-bottom:10px">${dateLabel}</div>`;

    // Summary — Net Gelir + Demet + Dm Başı Net
    html += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px">`;
    html += `<div style="padding:8px;border-radius:8px;background:rgba(34,197,94,0.08)"><div style="font-size:9px;color:#64748b">Net Gelir</div><div style="font-size:15px;font-weight:800;color:#4ade80">${fmt(rStats.tn)}</div></div>`;
    html += `<div style="padding:8px;border-radius:8px;background:rgba(255,255,255,0.03)"><div style="font-size:9px;color:#64748b">Demet</div><div style="font-size:15px;font-weight:800;color:#f8fafc">${rStats.td}</div></div>`;
    html += `<div style="padding:8px;border-radius:8px;background:rgba(255,255,255,0.03)"><div style="font-size:9px;color:#64748b">Dm Başı Net</div><div style="font-size:15px;font-weight:800;color:#f8fafc">${fmt2(rStats.av)}</div></div>`;
    html += `</div>`;

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

    // Generate PDF button
    html += `<button onclick="generatePDF()" style="width:100%;padding:14px;border-radius:12px;border:none;cursor:pointer;font-size:14px;font-weight:600;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;margin-bottom:10px">📄 PDF Rapor Oluştur ve Paylaş</button>`;

    // Copy text version
    html += `<button onclick="copyReportText()" style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);cursor:pointer;font-size:13px;font-weight:500;background:rgba(255,255,255,0.04);color:#94a3b8">📋 Metin Olarak Kopyala (WhatsApp için)</button>`;
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
    state.planCodeEstimate || 0,
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

  // Öncelik: Kodun kendi hesapladığı tahmini kullan (daha güvenilir)
  // AI'nın yazdığı rakam brüt/net karışıklığına yol açıyor
  var estimatedNet = state.planCodeEstimate || 0;

  savedPlans.push({
    date: new Date().toISOString().split("T")[0],
    timestamp: Date.now(),
    flowers: state.planFlowers.map(function(f){return {name:f.name,demet:f.demet}}),
    boxSize: state.planBoxSize,
    strategy: state.planStrategy,
    result: state.planResult,
    estimatedNet: estimatedNet
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
