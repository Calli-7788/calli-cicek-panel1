// ═══════════════ REPORT ═══════════════

function getPDFReportData(filtered) {
  const stats = calcStats(filtered);

  const currentMezatDays = [...new Set(filtered.map(r => r.t))].sort();
  const mezatCount = currentMezatDays.length;

  const beforeStart = state.sd;
  const allPrevDays = [...new Set(
    ALL_DATA.filter(r =>
      r.t < beforeStart &&
      (!state.sf || (state.sf.startsWith("GRUP:") ? r.c.startsWith(state.sf.replace("GRUP:", "")) : r.c === state.sf)) &&
      (!state.sb || r.s === state.sb)
    ).map(r => r.t)
  )].sort().reverse();

  const prevMezatDays = allPrevDays.slice(0, mezatCount);
  const prevSD = prevMezatDays.length > 0 ? prevMezatDays[prevMezatDays.length - 1] : "";
  const prevED = prevMezatDays.length > 0 ? prevMezatDays[0] : "";

  const prevData = ALL_DATA.filter(r =>
    prevMezatDays.includes(r.t) &&
    (!state.sf || (state.sf.startsWith("GRUP:") ? r.c.startsWith(state.sf.replace("GRUP:", "")) : r.c === state.sf)) &&
    (!state.sb || r.s === state.sb)
  );
  const prevByBranch = {};
  prevData.forEach(r => {
    if (!prevByBranch[r.s]) prevByBranch[r.s] = { net: 0, d: 0, ciro: 0 };
    prevByBranch[r.s].net += r.net; prevByBranch[r.s].d += r.d; prevByBranch[r.s].ciro += r.ciro;
  });
  const branchFlowerData = {};
  filtered.forEach(r => {
    if (!branchFlowerData[r.s]) branchFlowerData[r.s] = {};
    if (!branchFlowerData[r.s][r.c]) branchFlowerData[r.s][r.c] = { net: 0, d: 0, ciro: 0 };
    branchFlowerData[r.s][r.c].net += r.net; branchFlowerData[r.s][r.c].d += r.d; branchFlowerData[r.s][r.c].ciro += r.ciro;
  });
  const prevBranchFlower = {};
  prevData.forEach(r => {
    if (!prevBranchFlower[r.s]) prevBranchFlower[r.s] = {};
    if (!prevBranchFlower[r.s][r.c]) prevBranchFlower[r.s][r.c] = { net: 0, d: 0, ciro: 0 };
    prevBranchFlower[r.s][r.c].net += r.net; prevBranchFlower[r.s][r.c].d += r.d; prevBranchFlower[r.s][r.c].ciro += r.ciro;
  });
  const branchList = stats.byB.map(b => {
    const prev = prevByBranch[b.name];
    const prevNet = prev ? prev.net : 0;
    const prevD = prev ? prev.d : 0;
    const prevDbn = prevD > 0 ? prevNet / prevD : 0;
    const currDbn = b.d > 0 ? b.net / b.d : 0;
    const netChange = prevNet > 0 ? ((b.net - prevNet) / prevNet * 100) : null;
    const dbnChange = prevDbn > 0 ? ((currDbn - prevDbn) / prevDbn * 100) : null;
    const flowers = branchFlowerData[b.name] || {};
    const flowerList = Object.entries(flowers).map(([fname, fv]) => {
      const pf = (prevBranchFlower[b.name] || {})[fname];
      const pfDbn = (pf && pf.d > 0) ? pf.net / pf.d : 0;
      const cfDbn = fv.d > 0 ? fv.net / fv.d : 0;
      const fDbnChange = pfDbn > 0 ? ((cfDbn - pfDbn) / pfDbn * 100) : null;
      return { name: fname, net: fv.net, d: fv.d, dbn: cfDbn, prevDbn: pfDbn, dbnChange: fDbnChange };
    }).sort((a, b) => b.dbn - a.dbn);
    return { name: b.name, net: b.net, d: b.d, dbn: currDbn, prevNet, prevD, prevDbn, netChange, dbnChange, flowers: flowerList };
  });
  const prevTotalNet = prevData.reduce((s, r) => s + r.net, 0);
  const prevTotalD = prevData.reduce((s, r) => s + r.d, 0);
  const prevTotalDbn = prevTotalD > 0 ? prevTotalNet / prevTotalD : 0;
  return { stats, branchList, prevSD, prevED, prevTotalNet, prevTotalD, prevTotalDbn, hasPrev: prevData.length > 0, currentMezatCount: mezatCount, prevMezatCount: prevMezatDays.length };
}

function generateReportText() {
  const filtered = getFiltered();
  const rData = getPDFReportData(filtered);
  const stats = rData.stats;
  const dateLabel = state.sd !== state.ed ? fD(state.sd) + " – " + fD(state.ed) : fDF(state.sd);

  let text = "🌸 Çallı Çiçek — Günlük Rapor\n";
  text += "📅 " + dateLabel + "\n\n";
  text += "💰 Net Gelir: " + fmt(stats.tn) + "\n";
  text += "🌿 Demet: " + stats.td + "\n";
  text += "📊 Dm Başı Net: " + fmt2(stats.av) + "\n";

  const wV2 = getV2Ozet(filtered);
  if (wV2.kesintiPct !== null) text += "💸 Gerçek kesinti oranı: %" + wV2.kesintiPct.toFixed(1) + "\n";

  if (rData.hasPrev) {
    const chNet = rData.prevTotalNet > 0 ? ((stats.tn - rData.prevTotalNet) / rData.prevTotalNet * 100) : null;
    const chD = rData.prevTotalD > 0 ? ((stats.td - rData.prevTotalD) / rData.prevTotalD * 100) : null;
    const chDbn = rData.prevTotalDbn > 0 ? ((stats.av - rData.prevTotalDbn) / rData.prevTotalDbn * 100) : null;
    text += "\n📈 Önceki " + rData.prevMezatCount + " mezata göre:\n";
    if (chNet != null) text += "  Net: " + (chNet >= 0 ? "+" : "") + chNet.toFixed(0) + "%\n";
    if (chD != null) text += "  Demet: " + (chD >= 0 ? "+" : "") + chD.toFixed(0) + "%\n";
    if (chDbn != null) text += "  Dm Başı: " + (chDbn >= 0 ? "+" : "") + chDbn.toFixed(0) + "%\n";
  }

  text += "\n🏆 Dm Başı Net Liderleri:\n";
  stats.byF.slice(0, 5).forEach((f, i) => {
    text += (i + 1) + ") " + f.name + " — " + fmt(f.dbn) + "/dm · " + f.d + " dm\n";
  });

  const rTotalNet = rData.branchList.reduce((s,b) => s + b.net, 0);
  text += "\n📍 Şubeler:\n";
  rData.branchList.forEach((b, i) => {
    const bDbn = b.d > 0 ? b.net / b.d : 0;
    const bPay = rTotalNet > 0 ? (b.net / rTotalNet * 100) : 0;
    text += (i + 1) + ") " + b.name + " — " + fmt(b.net) + " · " + b.d + "dm · " + fmt(bDbn) + "/dm · %" + bPay.toFixed(0) + " pay";
    if (b.netChange != null) text += " [" + (b.netChange > 0 ? "+" : "") + b.netChange.toFixed(0) + "%]";
    text += "\n";
    b.flowers.slice(0, 3).forEach(fl => {
      text += "   " + fl.name + ": " + fl.d + "dm · " + fmt(fl.dbn) + "/dm";
      if (fl.dbnChange != null) text += " (" + (fl.dbnChange > 0 ? "+" : "") + fl.dbnChange.toFixed(0) + "%)";
      text += "\n";
    });
  });

  text += "\n📝 " + filtered.length + " kayıt";
  if (window._DATA_QUALITY) text += " · ↻ " + window._DATA_QUALITY.sonGuncelleme;

  return text;
}

function copyReportText() {
  const text = generateReportText();
  navigator.clipboard.writeText(text).then(() => {
    alert("Rapor kopyalandı! WhatsApp'a yapıştırabilirsin.");
  }).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    alert("Rapor kopyalandı!");
  });
}

function generatePDF() {
  const filtered = getFiltered();
  const rData = getPDFReportData(filtered);
  const stats = rData.stats;
  const dateLabel = state.sd !== state.ed ? fD(state.sd) + " – " + fD(state.ed) : fDF(state.sd);
  const prevLabel = rData.hasPrev ? rData.prevMezatCount + " mezat: " + fD(rData.prevSD) + " – " + fD(rData.prevED) : "";

  let pdfHTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
    'body{font-family:Arial,sans-serif;padding:30px;max-width:700px;margin:0 auto;color:#1a1a1a;font-size:12px}' +
    'h1{font-size:22px;color:#16a34a;margin-bottom:4px}' +
    'h2{font-size:16px;color:#333;margin:24px 0 8px;border-bottom:2px solid #22c55e;padding-bottom:4px}' +
    '.subtitle{font-size:13px;color:#666;margin-bottom:20px}' +
    '.kpi-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:16px 0}' +
    '.kpi{background:#f0fdf4;border-radius:8px;padding:12px;text-align:center}' +
    '.kpi-val{font-size:20px;font-weight:800;color:#16a34a}' +
    '.kpi-lbl{font-size:10px;color:#666;text-transform:uppercase;margin-bottom:4px}' +
    'table{width:100%;border-collapse:collapse;margin:8px 0}' +
    'th{background:#f8f8f8;padding:8px 6px;text-align:left;font-size:10px;color:#666;text-transform:uppercase;border-bottom:2px solid #ddd}' +
    'td{padding:7px 6px;border-bottom:1px solid #eee;font-size:11px}' +
    '.right{text-align:right}.bold{font-weight:700}.green{color:#16a34a}.grey{color:#999}' +
    '.cb{display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600}' +
    '.cu{background:#dcfce7;color:#16a34a}.cd{background:#fef2f2;color:#dc2626}' +
    '.bs{margin:16px 0;padding:16px;background:#fafafa;border-radius:8px;border:1px solid #e5e7eb;page-break-inside:avoid}' +
    '.bt{font-size:14px;font-weight:700;margin-bottom:4px;display:flex;justify-content:space-between}' +
    '.bm{font-size:11px;color:#666;margin-bottom:10px;display:flex;gap:16px}' +
    '.pc{background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:8px 12px;margin:10px 0;font-size:11px;color:#1e40af}' +
    '.footer{margin-top:30px;padding-top:10px;border-top:1px solid #ddd;font-size:10px;color:#999;text-align:center}' +
    '@media print{.bs{break-inside:avoid}}' +
    '</style></head><body>';

  pdfHTML += '<h1>🌸 Çallı Çiçek — Detaylı Rapor</h1>';
  pdfHTML += '<div class="subtitle">📅 ' + dateLabel + (rData.hasPrev ? ' &nbsp;|&nbsp; Önceki ' + prevLabel : '') + '</div>';

  // KPIs
  pdfHTML += '<div class="kpi-grid">';
  pdfHTML += '<div class="kpi"><div class="kpi-lbl">Net Gelir</div><div class="kpi-val">' + fmt(stats.tn) + '</div>';
  if (rData.hasPrev && rData.prevTotalNet > 0) { const ch = ((stats.tn - rData.prevTotalNet) / rData.prevTotalNet * 100); pdfHTML += '<div style="margin-top:4px"><span class="cb ' + (ch>0?'cu':'cd') + '">' + (ch>0?'▲ +':'▼ ') + Math.abs(ch).toFixed(1) + '%</span></div>'; }
  pdfHTML += '</div>';
  pdfHTML += '<div class="kpi"><div class="kpi-lbl">Demet</div><div class="kpi-val" style="color:#333">' + stats.td + '</div>';
  if (rData.hasPrev && rData.prevTotalD > 0) { const ch = ((stats.td - rData.prevTotalD) / rData.prevTotalD * 100); pdfHTML += '<div style="margin-top:4px"><span class="cb ' + (ch>0?'cu':'cd') + '">' + (ch>0?'▲ +':'▼ ') + Math.abs(ch).toFixed(1) + '%</span></div>'; }
  pdfHTML += '</div>';
  pdfHTML += '<div class="kpi"><div class="kpi-lbl">Ort. Dm Başı Net</div><div class="kpi-val">' + fmt2(stats.av) + '</div>';
  if (rData.hasPrev && rData.prevTotalDbn > 0) { const ch = ((stats.av - rData.prevTotalDbn) / rData.prevTotalDbn * 100); pdfHTML += '<div style="margin-top:4px"><span class="cb ' + (ch>0?'cu':'cd') + '">' + (ch>0?'▲ +':'▼ ') + Math.abs(ch).toFixed(1) + '%</span></div>'; }
  pdfHTML += '</div></div>';

  // Flower table
  pdfHTML += '<h2>🌷 Çiçek Performansı</h2><table><thead><tr><th>#</th><th>Çiçek</th><th class="right">Demet</th><th class="right">Dm Başı Net</th><th class="right">Net Gelir</th></tr></thead><tbody>';
  stats.byF.forEach((f, i) => {
    pdfHTML += '<tr><td>' + (i+1) + '</td><td class="bold">' + f.name + '</td><td class="right">' + f.d + '</td><td class="right green bold">' + fmt(f.dbn) + '</td><td class="right">' + fmt(f.net) + '</td></tr>';
  });
  pdfHTML += '</tbody></table>';

  // Branch detail
  pdfHTML += '<h2>📍 Şube Detaylı Performans</h2>';
  const totalNet = rData.branchList.reduce((s, b) => s + b.net, 0);

  rData.branchList.forEach((b, i) => {
    const pct = totalNet > 0 ? (b.net / totalNet * 100) : 0;
    pdfHTML += '<div class="bs">';
    pdfHTML += '<div class="bt"><span>' + (i === 0 ? '🏆 ' : (i+1) + '. ') + b.name + '</span><span style="font-size:16px;color:#16a34a">' + fmt(b.net) + '</span></div>';
    pdfHTML += '<div class="bm"><span>' + b.d + ' demet</span><span>' + fmt(b.dbn) + '/dm net</span><span>Pay: ' + pct.toFixed(1) + '%</span></div>';

    if (rData.hasPrev && (b.prevNet > 0 || b.prevD > 0)) {
      pdfHTML += '<div class="pc"><strong>Önceki ' + rData.prevMezatCount + ' mezat:</strong> Net: ' + fmt(b.prevNet) + ' → ' + fmt(b.net);
      if (b.netChange != null) pdfHTML += ' <span class="cb ' + (b.netChange>0?'cu':'cd') + '">' + (b.netChange>0?'+':'') + b.netChange.toFixed(1) + '%</span>';
      pdfHTML += ' &nbsp;|&nbsp; Dm Başı: ' + fmt(b.prevDbn) + ' → ' + fmt(b.dbn);
      if (b.dbnChange != null) pdfHTML += ' <span class="cb ' + (b.dbnChange>0?'cu':'cd') + '">' + (b.dbnChange>0?'+':'') + b.dbnChange.toFixed(1) + '%</span>';
      pdfHTML += '</div>';
    }

    if (b.flowers.length > 0) {
      pdfHTML += '<table><thead><tr><th>Çiçek</th><th class="right">Demet</th><th class="right">Dm Başı Net</th>';
      if (rData.hasPrev) pdfHTML += '<th class="right">Önceki</th><th class="right">Değişim</th>';
      pdfHTML += '<th class="right">Net Gelir</th></tr></thead><tbody>';
      b.flowers.forEach(fl => {
        pdfHTML += '<tr><td class="bold">' + fl.name + '</td><td class="right">' + fl.d + '</td><td class="right green bold">' + fmt(fl.dbn) + '</td>';
        if (rData.hasPrev) {
          pdfHTML += '<td class="right grey">' + (fl.prevDbn > 0 ? fmt(fl.prevDbn) : '—') + '</td>';
          pdfHTML += '<td class="right">';
          if (fl.dbnChange != null) pdfHTML += '<span class="cb ' + (fl.dbnChange>0?'cu':'cd') + '">' + (fl.dbnChange>0?'+':'') + fl.dbnChange.toFixed(1) + '%</span>';
          else pdfHTML += '<span class="grey">—</span>';
          pdfHTML += '</td>';
        }
        pdfHTML += '<td class="right">' + fmt(fl.net) + '</td></tr>';
      });
      pdfHTML += '<tr style="border-top:2px solid #ddd;background:#f0fdf4"><td class="bold">TOPLAM</td><td class="right bold">' + b.d + '</td><td class="right green bold">' + fmt(b.dbn) + '</td>';
      if (rData.hasPrev) { pdfHTML += '<td class="right grey">' + (b.prevDbn > 0 ? fmt(b.prevDbn) : '—') + '</td><td class="right">'; if (b.dbnChange != null) pdfHTML += '<span class="cb ' + (b.dbnChange>0?'cu':'cd') + '">' + (b.dbnChange>0?'+':'') + b.dbnChange.toFixed(1) + '%</span>'; pdfHTML += '</td>'; }
      pdfHTML += '<td class="right bold green">' + fmt(b.net) + '</td></tr></tbody></table>';
    }
    pdfHTML += '</div>';
  });

  pdfHTML += '<div class="footer">Çallı Çiçek Üretici Paneli · ' + new Date().toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}) + '</div>';
  pdfHTML += '</body></html>';

  const w = window.open("", "_blank");
  w.document.write(pdfHTML);
  w.document.close();
  setTimeout(() => w.print(), 500);
}
