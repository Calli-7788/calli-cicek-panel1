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

// Günlük Operasyon Raporu — jsPDF + autoTable (Rapor Faz 0).
// Eski window.open + document.write + print akışı SÖKÜLDÜ; önizleme program içi katmanda.
// Not: Emoji glifleri (🌸📅📍🏆) gömülü fontta yoktur; DejaVu'da DOĞRULANMIŞ semboller (☀▲▼★) kullanılır.
function generatePDF() {
  if (!pdfHazirMi()) {
    alert("PDF kütüphanesi yüklenemedi — internet bağlantısını kontrol edip sayfayı yenile.");
    return;
  }
  const filtered = getFiltered();
  const rData = getPDFReportData(filtered);
  const stats = rData.stats;
  const dateLabel = state.sd !== state.ed ? fD(state.sd) + " – " + fD(state.ed) : fDF(state.sd);
  const prevLabel = rData.hasPrev ? rData.prevMezatCount + " mezat: " + fD(rData.prevSD) + " – " + fD(rData.prevED) : "";

  const doc = pdfBaslat("Çallı Çiçek — Günlük Operasyon Raporu", dateLabel + (rData.hasPrev ? "   |   Önceki " + prevLabel : ""));
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let y = 82;
  window.__pdfSubeBloklari = [];

  const rozet = (ch) => ch == null ? "" : (ch > 0 ? "▲ +" : "▼ ") + Math.abs(ch).toFixed(1) + "%";

  // ── ☀ Bugünün Özeti (EN ÜSTTE) ──
  const ozet = getOzetCumleleri(filtered);
  if (ozet) {
    doc.setFont("DejaVu", "bold"); doc.setFontSize(10);
    const satirlar = [];
    doc.setFont("DejaVu", "normal"); doc.setFontSize(8.5);
    ozet.forEach(c => { doc.splitTextToSize("• " + pdfMetin(c), W - 100).forEach(l => satirlar.push(l)); });
    const kutuH = 20 + satirlar.length * 11 + 8;
    doc.setFillColor(PDF_TEMA.yesilAcik[0], PDF_TEMA.yesilAcik[1], PDF_TEMA.yesilAcik[2]);
    doc.roundedRect(40, y, W - 80, kutuH, 5, 5, "F");
    doc.setFont("DejaVu", "bold"); doc.setFontSize(10);
    doc.setTextColor(PDF_TEMA.yesil[0], PDF_TEMA.yesil[1], PDF_TEMA.yesil[2]);
    doc.text(pdfMetin("☀ Bugünün Özeti" + ((state.sf || state.sb) ? " · filtreli" : "")), 50, y + 15);
    doc.setFont("DejaVu", "normal"); doc.setFontSize(8.5);
    doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
    satirlar.forEach((l, i) => doc.text(l, 50, y + 28 + i * 11));
    y += kutuH + 12;
  }

  // ── 3 KPI + ▲▼ rozetleri ──
  const kpiler = [
    ["NET GELİR", fmt(stats.tn), rData.hasPrev && rData.prevTotalNet > 0 ? rozet((stats.tn - rData.prevTotalNet) / rData.prevTotalNet * 100) : ""],
    ["DEMET", String(stats.td), rData.hasPrev && rData.prevTotalD > 0 ? rozet((stats.td - rData.prevTotalD) / rData.prevTotalD * 100) : ""],
    ["ORT. DM BAŞI NET", fmt2(stats.av), rData.hasPrev && rData.prevTotalDbn > 0 ? rozet((stats.av - rData.prevTotalDbn) / rData.prevTotalDbn * 100) : ""]
  ];
  const kpiW = (W - 80 - 16) / 3;
  kpiler.forEach((k, i) => {
    const x = 40 + i * (kpiW + 8);
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(x, y, kpiW, 52, 5, 5, "F");
    doc.setFont("DejaVu", "normal"); doc.setFontSize(6.5); doc.setTextColor(PDF_TEMA.gri[0], PDF_TEMA.gri[1], PDF_TEMA.gri[2]);
    doc.text(pdfMetin(k[0]), x + kpiW / 2, y + 12, { align: "center" });
    doc.setFont("DejaVu", "bold"); doc.setFontSize(13); doc.setTextColor(PDF_TEMA.yesil[0], PDF_TEMA.yesil[1], PDF_TEMA.yesil[2]);
    doc.text(pdfMetin(k[1]), x + kpiW / 2, y + 30, { align: "center" });
    if (k[2]) {
      const poz = k[2].indexOf("▲") === 0;
      doc.setFont("DejaVu", "normal"); doc.setFontSize(7.5);
      doc.setTextColor(poz ? 22 : 220, poz ? 163 : 38, poz ? 74 : 38);
      doc.text(pdfMetin(k[2]), x + kpiW / 2, y + 44, { align: "center" });
    }
  });
  y += 62;

  // ── Gerçek kesinti satırı (dönemde V2 verisi varsa) ──
  const pV2 = getV2Ozet(filtered);
  if (pV2.kesintiPct !== null) {
    doc.setFont("DejaVu", "normal"); doc.setFontSize(8);
    doc.setTextColor(109, 40, 217);
    doc.text(pdfMetin("Gerçek kesinti oranı: %" + pV2.kesintiPct.toFixed(1) + " (V2 — satır bazlı gider verisi)"), 40, y);
    doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
    y += 14;
  }

  // ── Çiçek Performansı tablosu ──
  doc.setFont("DejaVu", "bold"); doc.setFontSize(11);
  doc.text(pdfMetin("Çiçek Performansı"), 40, y + 6);
  y = pdfTablo(doc,
    ["#", "Çiçek", "Demet", "Dm Başı Net", "Net Gelir"],
    stats.byF.map((f, i) => [String(i + 1), f.name, String(f.d), fmt(f.dbn), fmt(f.net)]),
    { startY: y + 12, columnStyles: { 0: { cellWidth: 24 }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } } }
  ) + 18;

  // ── Şube Detaylı Performans (her blok sayfa ortasından BÖLÜNMEZ) ──
  doc.setFont("DejaVu", "bold"); doc.setFontSize(11);
  if (y > H - 100) { doc.addPage(); y = 80; }
  doc.text(pdfMetin("Şube Detaylı Performans"), 40, y + 6);
  y += 14;
  const totalNet = rData.branchList.reduce((s, b) => s + b.net, 0);

  rData.branchList.forEach((b, i) => {
    const pct = totalNet > 0 ? (b.net / totalNet * 100) : 0;
    const kiyasVar = rData.hasPrev && (b.prevNet > 0 || b.prevD > 0);
    const satirSayisi = b.flowers.length + 1;
    const tahminiH = 30 + (kiyasVar ? 22 : 0) + 16 + satirSayisi * 15 + 12;
    if (y + tahminiH > H - 50) { doc.addPage(); y = 80; }
    const basSayfa = doc.internal.getCurrentPageInfo().pageNumber;

    doc.setFont("DejaVu", "bold"); doc.setFontSize(10);
    doc.text(pdfMetin((i === 0 ? "★ " : (i + 1) + ". ") + b.name), 40, y + 4);
    doc.setTextColor(PDF_TEMA.yesil[0], PDF_TEMA.yesil[1], PDF_TEMA.yesil[2]);
    doc.text(pdfMetin(fmt(b.net)), W - 40, y + 4, { align: "right" });
    doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
    doc.setFont("DejaVu", "normal"); doc.setFontSize(8);
    doc.setTextColor(PDF_TEMA.gri[0], PDF_TEMA.gri[1], PDF_TEMA.gri[2]);
    doc.text(pdfMetin(b.d + " demet   ·   " + fmt(b.dbn) + "/dm net   ·   Pay: " + pct.toFixed(1) + "%"), 40, y + 16);
    doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
    y += 24;

    if (kiyasVar) {
      doc.setFillColor(239, 246, 255);
      doc.roundedRect(40, y - 6, W - 80, 18, 3, 3, "F");
      doc.setFontSize(7.5);
      doc.setTextColor(30, 64, 175);
      let kiyasStr = "Önceki " + rData.prevMezatCount + " mezat:  Net " + fmt(b.prevNet) + " → " + fmt(b.net);
      if (b.netChange != null) kiyasStr += "  (" + (b.netChange > 0 ? "+" : "") + b.netChange.toFixed(1) + "%)";
      kiyasStr += "   |   Dm Başı " + fmt(b.prevDbn) + " → " + fmt(b.dbn);
      if (b.dbnChange != null) kiyasStr += "  (" + (b.dbnChange > 0 ? "+" : "") + b.dbnChange.toFixed(1) + "%)";
      doc.text(pdfMetin(kiyasStr), 48, y + 5);
      doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
      y += 20;
    }

    if (b.flowers.length > 0) {
      const kolonlar = rData.hasPrev
        ? ["Çiçek", "Demet", "Dm Başı Net", "Önceki", "Değişim", "Net Gelir"]
        : ["Çiçek", "Demet", "Dm Başı Net", "Net Gelir"];
      const satirlar = b.flowers.map(fl => rData.hasPrev
        ? [fl.name, String(fl.d), fmt(fl.dbn), fl.prevDbn > 0 ? fmt(fl.prevDbn) : "—", fl.dbnChange != null ? (fl.dbnChange > 0 ? "+" : "") + fl.dbnChange.toFixed(1) + "%" : "—", fmt(fl.net)]
        : [fl.name, String(fl.d), fmt(fl.dbn), fmt(fl.net)]);
      satirlar.push(rData.hasPrev
        ? ["TOPLAM", String(b.d), fmt(b.dbn), b.prevDbn > 0 ? fmt(b.prevDbn) : "—", b.dbnChange != null ? (b.dbnChange > 0 ? "+" : "") + b.dbnChange.toFixed(1) + "%" : "—", fmt(b.net)]
        : ["TOPLAM", String(b.d), fmt(b.dbn), fmt(b.net)]);
      const sagKolonlar = {};
      for (let ci = 1; ci < kolonlar.length; ci++) sagKolonlar[ci] = { halign: "right" };
      y = pdfTablo(doc, kolonlar, satirlar, {
        startY: y, kucuk: true, bolunmez: true, columnStyles: sagKolonlar,
        didParseCell: function(data) {
          if (data.section === "body" && data.row.index === satirlar.length - 1) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [240, 253, 244];
          }
        }
      }) + 16;
    }
    const sonSayfa = doc.internal.getCurrentPageInfo().pageNumber;
    window.__pdfSubeBloklari.push({ sube: b.name, basSayfa: basSayfa, sonSayfa: sonSayfa });
  });

  pdfOnizlemeAc(doc, pdfDosyaAdi("gunluk"));
}

// ═══════════════ 📊 YÖNETİCİ ANALİZ PDF (Rapor Faz 1) ═══════════════
// 6 bölüm: KPI · Gelir Ayrıştırması · Ürün×Şube Heatmap · Şube VI/RS · Fırsat · Top/Bottom-10
function generateYoneticiPDF() {
  if (!pdfHazirMi()) { alert("PDF kütüphanesi yüklenemedi."); return; }
  const yp = getYoneticiPencere(state.yonMezatN);
  if (yp.gun1.length === 0) { alert("Bu filtreyle mezat verisi yok."); return; }

  const filtreEtiket = state.sf ? state.sf.replace("GRUP:", "") + (state.sf.startsWith("GRUP:") ? " (Grup)" : "") : (state.sb ? state.sb : null);
  const altB = "Son " + yp.gun1.length + " mezat: " + fD(yp.gun1[0]) + " – " + fD(yp.gun1[yp.gun1.length - 1]) +
    (yp.gun0.length ? "   |   Kıyas: önceki " + yp.gun0.length + " mezat" : "") +
    (filtreEtiket ? "   |   Filtre: " + filtreEtiket : "");
  const doc = pdfBaslat("Çallı Çiçek — Yönetici Analiz Raporu", altB);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let y = 82;

  const g1 = yp.d1.reduce((s, r) => s + r.net, 0), q1 = yp.d1.reduce((s, r) => s + r.d, 0);
  const g0 = yp.d0.reduce((s, r) => s + r.net, 0), q0 = yp.d0.reduce((s, r) => s + r.d, 0);
  const rozet = (n1, n0) => n0 > 0 ? ((n1 >= n0 ? "▲ +" : "▼ ") + Math.abs((n1 - n0) / n0 * 100).toFixed(1) + "%") : "";

  // ── 1) 6 KPI kutusu ──
  const med1 = getMedyanGunlukDbn(yp.d1), med0 = getMedyanGunlukDbn(yp.d0);
  const as1 = new Set(yp.d1.map(r => r.s)).size, as0 = new Set(yp.d0.map(r => r.s)).size;
  const au1 = new Set(yp.d1.map(r => r.c)).size, au0 = new Set(yp.d0.map(r => r.c)).size;
  const kpiler = [
    ["NET GELİR", fmt(g1), rozet(g1, g0)],
    ["DEMET", String(q1), rozet(q1, q0)],
    ["ORT DBN", q1 > 0 ? fmt2(g1 / q1) : "—", (q0 > 0 && q1 > 0) ? rozet(g1 / q1, g0 / q0) : ""],
    ["MEDYAN DBN", med1 !== null ? fmt2(med1) : "—", (med1 !== null && med0 !== null) ? rozet(med1, med0) : ""],
    ["AKTİF ŞUBE", String(as1), rozet(as1, as0)],
    ["AKTİF ÜRÜN", String(au1), rozet(au1, au0)]
  ];
  const kpiW = (W - 80 - 20) / 3;
  kpiler.forEach((k, i) => {
    const x = 40 + (i % 3) * (kpiW + 10);
    const yy = y + Math.floor(i / 3) * 54;
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(x, yy, kpiW, 46, 5, 5, "F");
    doc.setFont("DejaVu", "normal"); doc.setFontSize(6.5); doc.setTextColor(PDF_TEMA.gri[0], PDF_TEMA.gri[1], PDF_TEMA.gri[2]);
    doc.text(pdfMetin(k[0]), x + kpiW / 2, yy + 11, { align: "center" });
    doc.setFont("DejaVu", "bold"); doc.setFontSize(12); doc.setTextColor(PDF_TEMA.yesil[0], PDF_TEMA.yesil[1], PDF_TEMA.yesil[2]);
    doc.text(pdfMetin(k[1]), x + kpiW / 2, yy + 27, { align: "center" });
    if (k[2]) {
      const poz = k[2].indexOf("▲") === 0;
      doc.setFont("DejaVu", "normal"); doc.setFontSize(7);
      doc.setTextColor(poz ? 22 : 220, poz ? 163 : 38, poz ? 74 : 38);
      doc.text(pdfMetin(k[2]), x + kpiW / 2, yy + 39, { align: "center" });
    }
  });
  doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
  y += 2 * 54 + 8;

  // ── 2) Gelir Ayrıştırması ──
  doc.setFont("DejaVu", "bold"); doc.setFontSize(11);
  doc.text(pdfMetin("Gelir Ayrıştırması"), 40, y + 4);
  if (yp.gun1.length >= 3 && yp.gun0.length >= 3) {
    const dg = decomposeGelir(yp.d1, yp.d0);
    const isr = v => (v >= 0 ? "+" : "−") + fmt(Math.abs(v));
    const drows = [
      ["Hacim etkisi", isr(dg.hacim)],
      ["Fiyat etkisi", isr(dg.fiyat)],
      ["Ürün karması (Mix)", isr(dg.mix)],
      ["Yeni / çıkan ürün", isr(dg.yeniCikan)],
      ["TOPLAM ΔGelir", isr(dg.delta)]
    ];
    y = pdfTablo(doc, ["Bileşen", "Tutar"], drows, {
      startY: y + 10, columnStyles: { 1: { halign: "right" } },
      didParseCell: function(data) {
        if (data.section !== "body") return;
        if (data.row.index === drows.length - 1) { data.cell.styles.fontStyle = "bold"; data.cell.styles.fillColor = [240, 253, 244]; }
        if (data.column.index === 1) {
          const neg = String(data.cell.raw).indexOf("−") === 0;
          data.cell.styles.textColor = neg ? [220, 38, 38] : [22, 120, 74];
        }
      }
    }) + 6;
    doc.setFont("DejaVu", "normal"); doc.setFontSize(8);
    doc.setTextColor(PDF_TEMA.gri[0], PDF_TEMA.gri[1], PDF_TEMA.gri[2]);
    const ozet = "Gelir " + isr(dg.delta) + ": " + isr(dg.hacim) + " hacim, " + isr(dg.fiyat) + " fiyat, " + isr(dg.mix) + " karma, " + isr(dg.yeniCikan) + " yeni/çıkan ürün.";
    doc.text(doc.splitTextToSize(pdfMetin(ozet), W - 80), 40, y + 4);
    doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
    y += 20;
  } else {
    doc.setFont("DejaVu", "normal"); doc.setFontSize(8.5);
    doc.setTextColor(PDF_TEMA.gri[0], PDF_TEMA.gri[1], PDF_TEMA.gri[2]);
    doc.text(pdfMetin("Yetersiz dönem verisi — her iki pencerede ≥3 mezat günü gerekli."), 40, y + 16);
    doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
    y += 28;
  }

  // Kombo istatistikleri (heatmap + top/bottom için ortak)
  const komboM = {};
  yp.d1.forEach(r => {
    const k = r.c + "|" + r.s;
    if (!komboM[k]) komboM[k] = { c: r.c, s: r.s, net: 0, d: 0, gunler: new Set() };
    komboM[k].net += r.net; komboM[k].d += r.d; komboM[k].gunler.add(r.t);
  });
  Object.values(komboM).forEach(k => { k.n = k.gunler.size; k.dbn = k.d > 0 ? k.net / k.d : 0; });
  const yRS = getRS(yp.d1);
  const vi = getValueIndex(yp.d1);

  // ── 3) Ürün × Şube dbn Heatmap ──
  if (y > H - 160) { doc.addPage(); y = 80; }
  doc.setFont("DejaVu", "bold"); doc.setFontSize(11);
  doc.text(pdfMetin("Ürün × Şube dbn Isı Tablosu"), 40, y + 4);
  const urunler = [...new Set(yp.d1.map(r => r.c))].map(c => ({ c, d: yp.d1.filter(r => r.c === c).reduce((s, r) => s + r.d, 0) })).sort((a, b) => b.d - a.d).map(x => x.c);
  const subeSirali = vi.map(v => v.sube).slice(0, 8);
  const hmMeta = [];
  const hmRows = urunler.map(c => {
    const satirVals = [];
    const row = [c].concat(subeSirali.map(s => {
      const k = komboM[c + "|" + s];
      if (!k) { satirVals.push(null); return ""; }
      satirVals.push(k);
      return fmt(k.dbn) + "\n" + k.d + "dm" + (k.n < 3 ? "\nn<3" : "");
    }));
    const dbnler = satirVals.filter(v => v && v.n >= 3).map(v => v.dbn);
    const mn = dbnler.length ? Math.min.apply(null, dbnler) : 0;
    const mx = dbnler.length ? Math.max.apply(null, dbnler) : 1;
    hmMeta.push(satirVals.map(v => v === null ? null : { n: v.n, norm: (mx > mn && v.n >= 3) ? (v.dbn - mn) / (mx - mn) : (v.n >= 3 ? 0.5 : 0) }));
    return row;
  });
  y = pdfTablo(doc, ["Ürün"].concat(subeSirali), hmRows, {
    startY: y + 10, kucuk: true,
    columnStyles: (function(){ const cs = { 0: { cellWidth: 86 } }; for (let i = 1; i <= subeSirali.length; i++) cs[i] = { halign: "center" }; return cs; })(),
    didParseCell: function(data) {
      if (data.section !== "body" || data.column.index === 0) return;
      const meta = hmMeta[data.row.index][data.column.index - 1];
      if (meta === null) { data.cell.styles.fillColor = [250, 250, 250]; return; }
      if (meta.n < 3) { data.cell.styles.fillColor = [235, 235, 235]; data.cell.styles.textColor = [150, 150, 150]; return; }
      const t = meta.norm;
      data.cell.styles.fillColor = [Math.round(245 - t * 135), Math.round(250 - t * 60), Math.round(247 - t * 107)];
    }
  }) + 6;
  doc.setFont("DejaVu", "normal"); doc.setFontSize(7);
  doc.setTextColor(PDF_TEMA.gri[0], PDF_TEMA.gri[1], PDF_TEMA.gri[2]);
  doc.text(pdfMetin("Renk: satır bazında min–max normalize dbn (koyu yeşil = o ürünün en iyi şubesi) · alt satır: demet · n<3 gri" + (vi.length > 8 ? " · ilk 8 şube gösterildi" : "")), 40, y + 2);
  doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
  y += 16;

  // ── 4) Şube tablosu: Gelir payı · Hacim payı · VI · RS ──
  if (y > H - 140) { doc.addPage(); y = 80; }
  doc.setFont("DejaVu", "bold"); doc.setFontSize(11);
  doc.text(pdfMetin("Şube Tablosu"), 40, y + 4);
  const rsFmtT = v => v ? "RS " + v.rs.toFixed(2).replace(".", ",") + " (n=" + v.n + ")" : "—";
  const srows = vi.map(v => {
    const rsv = yRS.sube[v.sube];
    return [v.sube, "%" + v.gelirPay.toFixed(1), "%" + v.hacimPay.toFixed(1), v.vi !== null ? v.vi.toFixed(2).replace(".", ",") : "—", rsFmtT(rsv)];
  });
  y = pdfTablo(doc, ["Şube", "Gelir Payı", "Hacim Payı", "VI", "RS"], srows, {
    startY: y + 10, columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
    didParseCell: function(data) {
      if (data.section !== "body" || data.column.index !== 4) return;
      const raw = String(data.cell.raw);
      const m = raw.match(/RS ([\d,]+)/);
      if (!m) { data.cell.styles.textColor = [150, 150, 150]; return; }
      const val = parseFloat(m[1].replace(",", "."));
      data.cell.styles.textColor = val > 1.05 ? [22, 120, 74] : val < 0.95 ? [220, 38, 38] : [100, 116, 139];
    }
  }) + 6;
  doc.setFont("DejaVu", "normal"); doc.setFontSize(7);
  doc.setTextColor(PDF_TEMA.gri[0], PDF_TEMA.gri[1], PDF_TEMA.gri[2]);
  doc.text(pdfMetin("VI (Value Index) = Gelir Payı / Hacim Payı — sunum metriğidir, karar hesaplarına girmez. RS renk: >1,05 yeşil · 0,95–1,05 gri · <0,95 kırmızı."), 40, y + 2);
  doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
  y += 16;

  // ── 5) Brüt Fiyat Fırsatı (çift değer) ──
  if (y > H - 130) { doc.addPage(); y = 80; }
  doc.setFont("DejaVu", "bold"); doc.setFontSize(11);
  doc.text(pdfMetin("Brüt Fiyat Fırsatı"), 40, y + 4);
  const fir = getBrutFiyatFirsati(yp.d1, yp.oncesi);
  doc.setFont("DejaVu", "bold"); doc.setFontSize(9.5);
  doc.setTextColor(PDF_TEMA.gri[0], PDF_TEMA.gri[1], PDF_TEMA.gri[2]);
  doc.text(pdfMetin("Teorik: " + fmt(fir.teorik) + " (üst sınır)"), 40, y + 18);
  doc.setTextColor(PDF_TEMA.yesil[0], PDF_TEMA.yesil[1], PDF_TEMA.yesil[2]);
  doc.text(pdfMetin("Kapasite ayarlı: " + fmt(fir.ayarli)), 40, y + 32);
  doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
  y += 40;
  if (fir.topKombolar.length) {
    y = pdfTablo(doc, ["Ürün → En İyi Şube", "Teorik", "Kapasite Ayarlı", "Örnek Gün"],
      fir.topKombolar.map(k => [k.cicek + " → " + k.hedefSube, fmt(k.teorik), fmt(k.ayarli), fD(k.ornekGun)]),
      { startY: y, kucuk: true, columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } } }) + 6;
  }
  doc.setFont("DejaVu", "normal"); doc.setFontSize(7);
  doc.setTextColor(PDF_TEMA.gri[0], PDF_TEMA.gri[1], PDF_TEMA.gri[2]);
  doc.text(doc.splitTextToSize(pdfMetin("İlave hacmin aynı fiyattan emileceği garanti değildir — 'kayıp' değil, fiyat farkı göstergesidir. Kapasite ayarı: en iyi şubenin dönem-öncesi P75 günlük absorpsiyonu tavandır."), W - 80), 40, y + 2);
  doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
  y += 22;

  // ── 6) Top-10 / Bottom-10 kombinasyon (n≥3) ──
  if (y > H - 140) { doc.addPage(); y = 80; }
  const uygunK = Object.values(komboM).filter(k => k.n >= 3).sort((a, b) => b.dbn - a.dbn);
  const kSatir = k => {
    const rsv = yRS.kombo[k.c + "|" + k.s];
    const arz = getArzDuzenlilik(k.c, k.s, yp.gun1);
    return [k.c + " → " + k.s, String(k.n), String(k.d), fmt(k.dbn), rsFmtT(rsv), arz ? arz.satis + "/" + arz.toplam + " · %" + arz.oran.toFixed(0) : "—"];
  };
  const rsRenkHucre = function(data) {
    if (data.section !== "body" || data.column.index !== 4) return;
    const m = String(data.cell.raw).match(/RS ([\d,]+)/);
    if (!m) { data.cell.styles.textColor = [150, 150, 150]; return; }
    const val = parseFloat(m[1].replace(",", "."));
    data.cell.styles.textColor = val > 1.05 ? [22, 120, 74] : val < 0.95 ? [220, 38, 38] : [100, 116, 139];
  };
  doc.setFont("DejaVu", "bold"); doc.setFontSize(11);
  doc.text(pdfMetin("Top-10 Kombinasyon (dbn)"), 40, y + 4);
  y = pdfTablo(doc, ["Kombo", "n", "Demet", "dbn", "RS", "Arz Düzenliliği"], uygunK.slice(0, 10).map(kSatir),
    { startY: y + 10, kucuk: true, columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } }, didParseCell: rsRenkHucre }) + 14;
  if (y > H - 140) { doc.addPage(); y = 80; }
  doc.setFont("DejaVu", "bold"); doc.setFontSize(11);
  doc.text(pdfMetin("Bottom-10 Kombinasyon (dbn)"), 40, y + 4);
  y = pdfTablo(doc, ["Kombo", "n", "Demet", "dbn", "RS", "Arz Düzenliliği"], uygunK.slice(-10).reverse().map(kSatir),
    { startY: y + 10, kucuk: true, columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } }, didParseCell: rsRenkHucre }) + 8;
  doc.setFont("DejaVu", "normal"); doc.setFontSize(7);
  doc.setTextColor(PDF_TEMA.gri[0], PDF_TEMA.gri[1], PDF_TEMA.gri[2]);
  doc.text(pdfMetin("n<3 mezat günlü kombolar listelere dahil edilmez."), 40, y + 2);

  pdfOnizlemeAc(doc, pdfDosyaAdi("yonetici"));
}
