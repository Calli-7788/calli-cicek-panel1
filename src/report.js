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
  const altB = "Son " + yp.gun1.length + " mezat" + (yp.kisitli ? " — mevcut 120 günlük veri" : "") + ": " + fD(yp.gun1[0]) + " – " + fD(yp.gun1[yp.gun1.length - 1]) +
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
  y += 2 * 54 + 4;

  // ── İş 7: Ortalama + medyan birlikte yorum (koşul sağlanırsa tek satır) ──
  const omy = getOrtMedyanYorum(q1 > 0 ? g1 / q1 : 0, q0 > 0 ? g0 / q0 : 0, med1, med0);
  if (omy) {
    doc.setFont("DejaVu", "normal"); doc.setFontSize(7.5);
    doc.setTextColor(PDF_TEMA.gri[0], PDF_TEMA.gri[1], PDF_TEMA.gri[2]);
    doc.text(doc.splitTextToSize(pdfMetin(omy), W - 80), 40, y + 6);
    doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
    y += 16;
  }

  // ── İş 2: 🧭 Yönetici Bulguları (KPI'ların hemen altında — 30 saniye hedefi) ──
  const bulgular = getYoneticiBulgulari(yp);
  const bulguMaddeler = bulgular.maddeler.filter(m => m.etiket !== "fiyat tabanı"); // ort-medyan yukarıda tek satır
  if (bulguMaddeler.length) {
    doc.setFont("DejaVu", "bold"); doc.setFontSize(11);
    doc.text(pdfMetin("🧭 Yönetici Bulguları"), 40, y + 8);
    y += 14;
    doc.setFontSize(7.5);
    bulguMaddeler.forEach(m => {
      const satir = "[" + m.etiket + "]  Bulgu: " + m.bulgu + "  →  İzleme önerisi: " + m.izleme;
      const lines = doc.splitTextToSize(pdfMetin(satir), W - 92);
      if (y + lines.length * 9 > H - 60) { doc.addPage(); y = 80; }
      doc.setFont("DejaVu", "bold");
      doc.setTextColor(m.renk[0], m.renk[1], m.renk[2]);
      doc.text("•", 42, y + 6);
      doc.setFont("DejaVu", "normal");
      doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
      lines.forEach((l, li) => {
        if (li === 0) {
          // etiket kısmını renkli bas
          const etiketStr = "[" + m.etiket + "]";
          doc.setFont("DejaVu", "bold");
          doc.setTextColor(m.renk[0], m.renk[1], m.renk[2]);
          doc.text(pdfMetin(etiketStr), 50, y + 6);
          doc.setFont("DejaVu", "normal");
          doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
          doc.text(pdfMetin(l.substring(etiketStr.length)), 50 + doc.getTextWidth(pdfMetin(etiketStr)), y + 6);
        } else {
          doc.text(pdfMetin(l), 50, y + 6);
        }
        y += 9;
      });
      y += 2;
    });
    doc.setFontSize(6.5);
    doc.setTextColor(PDF_TEMA.gri[0], PDF_TEMA.gri[1], PDF_TEMA.gri[2]);
    doc.text(pdfMetin(bulgular.not), 40, y + 5);
    doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
    y += 14;
  }

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
    // İş 6: Otomatik mutabakat — HER üretimde koşar; geçmezse kırmızı band (sessiz yanlış yok)
    window.__pdfMutabakatBandi = false;
    if (!dg.saglamaOK) {
      window.__pdfMutabakatBandi = true;
      doc.setFillColor(220, 38, 38);
      doc.rect(40, y - 2, W - 80, 16, "F");
      doc.setFont("DejaVu", "bold"); doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text(pdfMetin("⚠ AYRIŞTIRMA MUTABAKATSIZ — bileşen toplamı ΔGelir'e eşit değil, değerlere güvenme"), 46, y + 9);
      doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
      y += 20;
    }
    doc.setFont("DejaVu", "normal"); doc.setFontSize(8);
    doc.setTextColor(PDF_TEMA.gri[0], PDF_TEMA.gri[1], PDF_TEMA.gri[2]);
    const ozet = "Gelir " + isr(dg.delta) + ": " + isr(dg.hacim) + " hacim, " + isr(dg.fiyat) + " fiyat, " + isr(dg.mix) + " karma, " + isr(dg.yeniCikan) + " yeni/çıkan ürün.";
    doc.text(doc.splitTextToSize(pdfMetin(ozet), W - 80), 40, y + 4);
    // İş 6: Ana sürücü cümlesi — yüzde payı YALNIZ tüm bileşenler aynı işaretliyse
    const anaBil = [["hacim", dg.hacim], ["fiyat", dg.fiyat], ["ürün karması", dg.mix], ["yeni/çıkan ürün", dg.yeniCikan]];
    const anaSurucu = anaBil.reduce((mx, b) => Math.abs(b[1]) > Math.abs(mx[1]) ? b : mx);
    const ayniIsaretMi = anaBil.every(b => b[1] >= 0) || anaBil.every(b => b[1] <= 0);
    const anaPay = (ayniIsaretMi && dg.delta !== 0) ? " (pay %" + Math.abs(anaSurucu[1] / dg.delta * 100).toFixed(0) + ")" : "";
    doc.setFont("DejaVu", "bold");
    doc.text(pdfMetin("Değişimin ana sürücüsü: " + anaSurucu[0] + " (" + isr(anaSurucu[1]) + ")" + anaPay), 40, y + 15);
    doc.setFont("DejaVu", "normal");
    doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
    y += 30;
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
  Object.values(komboM).forEach(k => { k.comboDays = k.gunler.size; k.dbn = k.d > 0 ? k.net / k.d : 0; });
  const urunToplamD = {};
  Object.values(komboM).forEach(k => { urunToplamD[k.c] = (urunToplamD[k.c] || 0) + k.d; });
  const yRS = getRS(yp.d1);
  const vi = getValueIndex(yp.d1);

  // ── 3) Ürün × Şube dbn Heatmap ──
  if (y > H - 160) { doc.addPage(); y = 80; }
  doc.setFont("DejaVu", "bold"); doc.setFontSize(11);
  const urunler = [...new Set(yp.d1.map(r => r.c))].map(c => ({ c, d: yp.d1.filter(r => r.c === c).reduce((s, r) => s + r.d, 0) })).sort((a, b) => b.d - a.d).map(x => x.c);
  // İş 3 (Faz 1.2): hacme göre ilk 8 şube + ilk 8 dışından en fazla 2 sinyal istisnası (★)
  const hacimSirali = vi.slice().sort((a, b) => b.demet - a.demet);
  const ilk8 = hacimSirali.slice(0, 8).map(v => v.sube);
  const hmN = getNYeterli(yp.gun1.length);
  const istisnalar = hacimSirali.slice(8).filter(v => {
    const r = yRS.sube[v.sube];
    return r && r.rsComparableDays >= hmN && (r.rs >= 1.10 || r.rs <= 0.90);
  }).slice(0, 2).map(v => v.sube);
  const subeSirali = ilk8.concat(istisnalar);
  const istisnaSet = new Set(istisnalar);
  doc.text(pdfMetin("Ürün × Şube dbn Isı Tablosu"), 40, y + 4);
  doc.setFont("DejaVu", "normal"); doc.setFontSize(7);
  doc.setTextColor(PDF_TEMA.gri[0], PDF_TEMA.gri[1], PDF_TEMA.gri[2]);
  doc.text(pdfMetin("hacim ilk " + ilk8.length + (istisnalar.length ? " + " + istisnalar.length + " istisna (★ sinyal etiketli)" : "")), 40, y + 14);
  doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
  y += 10;
  const hmMeta = [];
  const hmRows = urunler.map(c => {
    const satirVals = [];
    const row = [c].concat(subeSirali.map(s => {
      const k = komboM[c + "|" + s];
      if (!k) { satirVals.push(null); return ""; }
      satirVals.push(k);
      return fmt(k.dbn) + "\n" + k.d + "dm" + (k.comboDays < 3 ? "\nn<3" : "");
    }));
    const dbnler = satirVals.filter(v => v && v.comboDays >= 3).map(v => v.dbn);
    const mn = dbnler.length ? Math.min.apply(null, dbnler) : 0;
    const mx = dbnler.length ? Math.max.apply(null, dbnler) : 1;
    hmMeta.push(satirVals.map(v => v === null ? null : { n: v.comboDays, norm: (mx > mn && v.comboDays >= 3) ? (v.dbn - mn) / (mx - mn) : (v.comboDays >= 3 ? 0.5 : 0) }));
    return row;
  });
  y = pdfTablo(doc, ["Ürün"].concat(subeSirali.map(s => (istisnaSet.has(s) ? "★ " : "") + s)), hmRows, {
    startY: y + 10, kucuk: true,
    fontSize: subeSirali.length > 10 ? 6 : undefined,   // >10 sütun → yazı bir kademe küçük
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
  doc.text(pdfMetin("Renk: satır bazında min–max normalize dbn (koyu yeşil = o ürünün en iyi şubesi) · alt satır: demet · n<3 gri" + (vi.length > subeSirali.length ? " · kalan şubeler Şube Tablosu'nda tam listeli" : "")), 40, y + 2);
  y += 10;
  // İş 5: Ürün×şube otomatik bulgular — heatmap "hangi ürün hangi şubeyle iyi?" cevabı
  const kb = getKomboBulgulari(Object.values(komboM), yRS.kombo, yp.gun1);
  const kbFmt = k => k.c + "→" + k.s + " (RS " + k.rs.toFixed(2).replace(".", ",") + ", n=" + k.rsN + ")";
  doc.setFontSize(7.5);
  if (kb.guclu.length) {
    doc.setTextColor(22, 120, 74);
    doc.text(doc.splitTextToSize(pdfMetin("İyi eşleşenler: " + kb.guclu.map(kbFmt).join(" · ")), W - 80), 40, y + 4);
    y += 10;
  }
  if (kb.zayif.length) {
    doc.setTextColor(220, 38, 38);
    doc.text(doc.splitTextToSize(pdfMetin("Zayıf eşleşenler: " + kb.zayif.map(kbFmt).join(" · ")), W - 80), 40, y + 4);
    y += 10;
  }
  if (kb.kesif.length) {
    doc.setTextColor(37, 99, 235);
    doc.text(doc.splitTextToSize(pdfMetin("Keşif adayları: " + kb.kesif.map(kbFmt).join(" · ")), W - 80), 40, y + 4);
    y += 10;
  }
  doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
  y += 8;

  // ── 4) Şube tablosu: Gelir payı · Hacim payı · VI · RS ──
  if (y > H - 140) { doc.addPage(); y = 80; }
  doc.setFont("DejaVu", "bold"); doc.setFontSize(11);
  doc.text(pdfMetin("Şube Tablosu"), 40, y + 4);
  const rsFmtT = v => v ? "RS " + v.rs.toFixed(2).replace(".", ",") + " (n=" + v.rsComparableDays + ")" : "—";
  const subeEtiketleri = [];
  const srows = vi.map(v => {
    const rsv = yRS.sube[v.sube];
    const et = getVeriGuveni(rsv ? rsv.rsComparableDays : null, rsv ? rsv.rs : null, null, yp.gun1.length, null);
    subeEtiketleri.push(et);
    return [v.sube, "%" + v.gelirPay.toFixed(1), "%" + v.hacimPay.toFixed(1), v.vi !== null ? v.vi.toFixed(2).replace(".", ",") : "—", rsFmtT(rsv), et.etiket];
  });
  y = pdfTablo(doc, ["Şube", "Gelir Payı", "Hacim Payı", "VI", "RS", "Veri Güveni"], srows, {
    startY: y + 10, columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    didParseCell: function(data) {
      if (data.section !== "body") return;
      if (data.column.index === 4) {
        const m = String(data.cell.raw).match(/RS ([\d,]+)/);
        if (!m) { data.cell.styles.textColor = [150, 150, 150]; return; }
        const val = parseFloat(m[1].replace(",", "."));
        data.cell.styles.textColor = val > 1.05 ? [22, 120, 74] : val < 0.95 ? [220, 38, 38] : [100, 116, 139];
      }
      if (data.column.index === 5 && subeEtiketleri[data.row.index]) {
        data.cell.styles.textColor = subeEtiketleri[data.row.index].renk;
      }
    }
  }) + 6;
  doc.setFont("DejaVu", "normal"); doc.setFontSize(7);
  doc.setTextColor(PDF_TEMA.gri[0], PDF_TEMA.gri[1], PDF_TEMA.gri[2]);
  doc.text(doc.splitTextToSize(pdfMetin("VI (Value Index) = Gelir Payı / Hacim Payı — sunum metriğidir, karar hesaplarına girmez. RS renk: >1,05 yeşil · 0,95–1,05 gri · <0,95 kırmızı. Rol ayrımı: RS ana performans göstergesidir (gün+ürün normalize); VI<1 iken RS≈1 ise fiyat piyasayla uyumludur, fark ürün karmasındandır — şube \"kötü\" ilan edilmez. Veri güveni etiketi yalnız rapor dilidir, Planlayıcı kararına girmez."), W - 80), 40, y + 2);
  doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
  y += 26;

  // ── 5) Brüt Fiyat Fırsatı (çift değer) ──
  if (y > H - 130) { doc.addPage(); y = 80; }
  doc.setFont("DejaVu", "bold"); doc.setFontSize(11);
  doc.text(pdfMetin("Brüt Fiyat Fırsatı"), 40, y + 4);
  const fir = getBrutFiyatFirsati(yp.d1);
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
  const uygunK = Object.values(komboM).filter(k => k.comboDays >= 3).sort((a, b) => b.dbn - a.dbn);
  const kSatir = k => {
    const rsv = yRS.kombo[k.c + "|" + k.s];
    const arz = getArzDuzenlilik(k.c, k.s, yp.gun1);
    const hacimPayi = urunToplamD[k.c] > 0 ? k.d / urunToplamD[k.c] * 100 : null;
    const et = getVeriGuveni(rsv ? rsv.rsComparableDays : null, rsv ? rsv.rs : null, arz ? arz.oran : null, yp.gun1.length, hacimPayi);
    return [k.c + " → " + k.s, String(k.comboDays), String(k.d), fmt(k.dbn), rsFmtT(rsv), arz ? arz.satis + "/" + arz.toplam + " · %" + arz.oran.toFixed(0) : "—", et.etiket];
  };
  const komboEtiketRenk = satirlar => function(data) {
    if (data.section !== "body") return;
    if (data.column.index === 4) {
      const m = String(data.cell.raw).match(/RS ([\d,]+)/);
      if (!m) { data.cell.styles.textColor = [150, 150, 150]; return; }
      const val = parseFloat(m[1].replace(",", "."));
      data.cell.styles.textColor = val > 1.05 ? [22, 120, 74] : val < 0.95 ? [220, 38, 38] : [100, 116, 139];
    }
    if (data.column.index === 6) {
      const et = satirlar[data.row.index] ? satirlar[data.row.index][6] : "";
      data.cell.styles.textColor = et === "kanıtlanmış sinyal" ? [22, 120, 74] : et === "risk sinyali" ? [220, 38, 38] : et === "hacimli zayıf sinyal" ? [217, 119, 6] : et === "keşif adayı" ? [37, 99, 235] : [130, 140, 155];
    }
  };
  const kKolonlar = ["Kombo", "n", "Demet", "dbn", "RS", "Arz Düzenliliği", "Veri Güveni"];
  const kStil = { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } };
  doc.setFont("DejaVu", "bold"); doc.setFontSize(11);
  doc.text(pdfMetin("Top-10 Kombinasyon (dbn)"), 40, y + 4);
  const topSatirlar = uygunK.slice(0, 10).map(kSatir);
  y = pdfTablo(doc, kKolonlar, topSatirlar,
    { startY: y + 10, kucuk: true, columnStyles: kStil, didParseCell: komboEtiketRenk(topSatirlar) }) + 14;
  if (y > H - 140) { doc.addPage(); y = 80; }
  doc.setFont("DejaVu", "bold"); doc.setFontSize(11);
  doc.text(pdfMetin("Bottom-10 Kombinasyon (dbn)"), 40, y + 4);
  const botSatirlar = uygunK.slice(-10).reverse().map(kSatir);
  y = pdfTablo(doc, kKolonlar, botSatirlar,
    { startY: y + 10, kucuk: true, columnStyles: kStil, didParseCell: komboEtiketRenk(botSatirlar) }) + 8;
  doc.setFont("DejaVu", "normal"); doc.setFontSize(7);
  doc.setTextColor(PDF_TEMA.gri[0], PDF_TEMA.gri[1], PDF_TEMA.gri[2]);
  doc.text(doc.splitTextToSize(pdfMetin("n<3 mezat günlü kombolar listelere dahil edilmez. Kombo n = satış günü sayısı (arz frekansı); RS yanındaki (n=…) = ≥2 şubeli karşılaştırılabilir gün — güven etiketleri bu sayıyla verilir. Hacimli zayıf sinyal: RS ≤0,90 + sınırlı örneklem + ürün demet payı ≥%15 (göreli eşik)."), W - 80), 40, y + 2);

  pdfOnizlemeAc(doc, pdfDosyaAdi("yonetici"));
}

// ═══════════════ 📈 TREND & PİYASA PDF (Rapor Faz 2 + 2.1 rejim revizyonu) ═══════════════
// YENİ HESAP YOK — metrikler getMezatSerisi'nden; rejim getRejim (YALNIZ rapor katmanı,
// Planlayıcı'ya BAĞLANMAZ). 120 GÜN ORTAK KURAL: getGuncellikSiniri() (Faz 1.3 yardımcısı)
// pencere kurulumunda aynen kullanılır — Çiçek Analiz ekran grafiğine DOKUNULMAZ.
// v1 NOTU: 31 Tem öncesi tahmini-net noktalar görselde soluk gösterilir VE slope/ROC/SMA/EWMA
// hesaplarına DAHİLDİR (seri bütünlüğü); zaman geçtikçe 120 gün penceresinden doğal çıkarlar.

// Maskeli seri üretimi: getMezatSerisi'ni DEĞİŞTİRMEDEN 120-gün sınırlı/birleşik seriler.
// UYARI: SENKRON KALMALI — bu blok içine await/async eklenemez, aksi halde tüm analizler bozulur
// (ALL_DATA swap sırasında başka bir kod çalışırsa maskelenmiş veriyi okur).
function trendMaskeliSeri(rows, cicekAdi, sube, sonN) {
  const yedek = window.ALL_DATA;
  window.ALL_DATA = rows;
  try {
    return getMezatSerisi(cicekAdi, sube || null, sonN || 30);
  } finally {
    window.ALL_DATA = yedek;
  }
}

// Birleşik "evren" serisi (filtre dahilinde, 120 gün içi)
// sadeceV2 (Faz 2.2 İş 2): true → yalnız V2 dönemi (t >= V2_CUTOFF) alt serisi — güven
// katmanı kıyası için; mevcut çağrılar parametresiz kalır, davranışları DEĞİŞMEZ.
function trendEvrenSeri(sube, sonN, sadeceV2) {
  const filtre = r =>
    (!state.sf || (state.sf.startsWith("GRUP:") ? r.c.startsWith(state.sf.replace("GRUP:", "")) : r.c === state.sf)) &&
    (!state.sb || r.s === state.sb);
  const minTarih = getGuncellikSiniri();
  const maskeli = ALL_DATA.filter(r => r.t >= minTarih && (!sadeceV2 || r.t >= V2_CUTOFF) && filtre(r)).map(r => ({ t: r.t, c: "__EVREN__", s: r.s, d: r.d, net: r.net, costModel: r.costModel }));
  return trendMaskeliSeri(maskeli, "__EVREN__", sube, sonN);
}

// Ürün serisi (120 gün sınırlı — ekran grafiği bundan ETKİLENMEZ, kendi yolunu kullanır)
function trendUrunSeri(cicek, sube, sonN, sadeceV2) {
  const minTarih = getGuncellikSiniri();
  const kirpik = ALL_DATA.filter(r => r.t >= minTarih && (!sadeceV2 || r.t >= V2_CUTOFF));
  return trendMaskeliSeri(kirpik, cicek, sube, sonN);
}

// ── Faz 2.2 İş 2: V1/V2 hassasiyet kontrolü — YALNIZ güven katmanı ──
// Ana rejim her zaman A (karma) seriden gelir; B (yalnız V2) yalnızca kıyas içindir.
// Kıyas ana rejim sınıfı üzerinden yapılır (oynaklık katmanı kıyasa girmez).
// B'de n<6 → "yetersiz" (hüküm yok). A=B → "aynı" (rapor dipnotu), A≠B → "farklı" (blok ⚠).
function trendV2Kiyas(aMs, bMs) {
  const aRj = getRejim(aMs);
  if (!aRj.rejim || !bMs || bMs.n < 6) return { durum: "yetersiz", bRejim: null, bN: bMs ? bMs.n : 0 };
  const bRj = getRejim(bMs);
  if (!bRj.rejim) return { durum: "yetersiz", bRejim: null, bN: bMs.n };
  return { durum: aRj.rejim === bRj.rejim ? "aynı" : "farklı", bRejim: bRj.rejim, bN: bMs.n };
}

// Trend rapor evreni: 120 gün içi filtreli son 30 mezat günü + ürün demet dağılımı
function getTrendEvren() {
  const filtre = r =>
    (!state.sf || (state.sf.startsWith("GRUP:") ? r.c.startsWith(state.sf.replace("GRUP:", "")) : r.c === state.sf)) &&
    (!state.sb || r.s === state.sb);
  const minTarih = getGuncellikSiniri();
  const rows = ALL_DATA.filter(r => r.t >= minTarih && filtre(r));
  const gunler = [...new Set(rows.map(r => r.t))].sort().slice(-30);
  const gunSet = new Set(gunler);
  const pencere = rows.filter(r => gunSet.has(r.t));
  const urunD = {};
  pencere.forEach(r => { urunD[r.c] = (urunD[r.c] || 0) + r.d; });
  const siralı = Object.entries(urunD).map(([c, d]) => ({ c, d })).sort((a, b) => b.d - a.d);
  const toplamD = siralı.reduce((s, u) => s + u.d, 0);
  const liderler = [];
  let kumul = 0;
  for (const u of siralı) {
    liderler.push(u.c);
    kumul += u.d;
    if (toplamD > 0 && kumul / toplamD >= 0.80) break;
  }
  return { gunler, toplamD, siralı, liderler, kapsamPct: toplamD > 0 ? kumul / toplamD * 100 : 0, kisitli: gunler.length < 30, pencereRows: pencere };
}

// Teknik metrik şeridi (küçük gri satır — üst katman rejim dilidir)
function trendMetrikSatiri(ms) {
  const son = ms.n > 0 ? ms.seri[ms.n - 1] : null;
  return [
    son ? fmt(son.dbn) + "/dm" : "—",
    ms.slope === null ? "—" : (ms.slope >= 0 ? "+" : "") + new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(ms.slope) + " ₺/mezat" + (ms.slopeKisa ? " (kısa)" : ""),
    ms.roc3 === null ? "—" : (ms.roc3 >= 0 ? "+" : "−") + "%" + Math.abs(ms.roc3).toFixed(0) + (ms.roc3Uyari ? " ⚠" : ""),
    ms.cv === null ? "—" : "%" + ms.cv.toFixed(0) + (ms.cvKisa ? " (kısa)" : ""),
    ms.fan || "—"
  ];
}

// Kırılma/dönüş rejimlerinde kısa neden eki
function trendNedenEki(rj, ms) {
  if (!rj || !rj.rejim) return "";
  if (rj.rejim === "Yukarı kırılma adayı") return " (yatay seyirde momentum +%" + Math.abs(ms.roc3).toFixed(0) + ")";
  if (rj.rejim === "Aşağı kırılma riski") return " (yatay seyirde momentum −%" + Math.abs(ms.roc3).toFixed(0) + ")";
  if (rj.rejim.indexOf("zayıflıyor / dönüş") >= 0) return " (eğim + iken momentum −)";
  if (rj.rejim.indexOf("Toparlanma") >= 0) return " (eğim − iken momentum +)";
  return "";
}

// Bulgu maddesi — İKİ SATIR HİYERARŞİSİ (Faz 2.2 İş 3):
// ana (normal boy): "Ad: rejim — oynaklık (neden eki)"
// teknik (küçük gri, ikinci satır): "−2,8 ₺/mezat · momentum −%56 · CV %27 · 1311 dm"
function trendBulguCumlesi(ad, ms, rj, hacimD) {
  const teknik = (ms.slope === null ? "eğim —" : (ms.slope >= 0 ? "+" : "−") + Math.abs(ms.slope).toFixed(1).replace(".", ",") + " ₺/mezat") +
    " · momentum " + (ms.roc3 === null ? "—" : (ms.roc3 >= 0 ? "+" : "−") + "%" + Math.abs(ms.roc3).toFixed(0)) +
    " · CV " + (ms.cv === null ? "—" : "%" + ms.cv.toFixed(0)) +
    (hacimD != null ? " · " + hacimD + " dm" : "");
  return { ad, ana: ad + ": " + rejimEtiket(rj) + trendNedenEki(rj, ms), teknik };
}

// 🧭 Trend Yönetici Bulguları — 4-6 deterministik cümle (ürün adı hard-code YASAK)
function getTrendBulgulari(ev) {
  const M = [];
  const evrenMs = trendEvrenSeri(null, 30);
  const evrenRj = getRejim(evrenMs);
  if (evrenRj.rejim) M.push(trendBulguCumlesi("Piyasa geneli", evrenMs, evrenRj, ev.toplamD));

  // Lider ürün rejimleri — dikkat sıralı: kırılma/dönüş > güçlenen düşüş > diğer (en fazla 3)
  const liderRjler = ev.liderler.map(c => {
    const ms = trendUrunSeri(c, state.sb || null, 30);
    return { c, ms, rj: getRejim(ms), d: (ev.siralı.find(u => u.c === c) || {}).d };
  }).filter(x => x.rj.rejim);
  const oncelik = x => x.rj.kirilmaAilesi ? 0 : (x.rj.rejim === "Güçlenen düşüş" ? 1 : 2);
  liderRjler.slice().sort((a, b) => oncelik(a) - oncelik(b)).slice(0, 3).forEach(x => {
    M.push(trendBulguCumlesi(x.c, x.ms, x.rj, x.d));
  });

  // En sert momentum (n≥6, |ROC3| max; yukarıda geçtiyse atla)
  const gecenler = new Set(M.map(m => m.ad));
  const sert = ev.siralı.map(u => {
    const ms = trendUrunSeri(u.c, state.sb || null, 30);
    return ms.n >= 6 && ms.roc3 !== null ? { c: u.c, ms, rj: getRejim(ms), d: u.d } : null;
  }).filter(Boolean).sort((a, b) => Math.abs(b.ms.roc3) - Math.abs(a.ms.roc3))[0];
  if (sert && !gecenler.has(sert.c)) M.push(trendBulguCumlesi(sert.c, sert.ms, sert.rj, sert.d));

  // İstisna şube (çelişki cümlesi): kırılma ailesi VEYA eğim-momentum zıt + |ROC3|≥20
  const subeler = [...new Set(ev.pencereRows.map(r => r.s))];
  const subeAday = subeler.map(s => {
    const ms = trendEvrenSeri(s, 30);
    const rj = getRejim(ms);
    if (!rj.rejim || ms.roc3 === null) return null;
    const zit = (rj.egimSinifi === "+" && rj.momentumSinifi === "-") || (rj.egimSinifi === "-" && rj.momentumSinifi === "+");
    if (rj.kirilmaAilesi || (zit && Math.abs(ms.roc3) >= 20)) return { s, ms, rj };
    return null;
  }).filter(Boolean).sort((a, b) => Math.abs(b.ms.roc3) - Math.abs(a.ms.roc3))[0];
  if (subeAday) M.push(trendBulguCumlesi(subeAday.s + " şubesi", subeAday.ms, subeAday.rj, null));

  return M.slice(0, 6);
}

// SVG string → raster (JPEG 0.85 — dosya boyutu; zemin svgToPng'de beyaz doldurulur).
// Ekran SVG'si innerHTML ile gömüldüğünden xmlns taşımaz; burada eklenir (buildMezatChart'a DOKUNULMADI).
function trendSvgStringToPng(svgString, scale) {
  if (svgString.indexOf("xmlns=") < 0) svgString = svgString.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
  const el = new DOMParser().parseFromString(svgString, "image/svg+xml").documentElement;
  return svgToPng(el, scale || 2, "image/jpeg", 0.85);
}

// Volatilite × Fiyat scatter — balon etiketinde rejim yön oku (↑↓→)
function buildScatterSVG(noktalar) {
  const W = 360, H = 230, L = 42, R = 10, T = 14, B = 30;
  const cw = W - L - R, ch = H - T - B;
  const xs = noktalar.map(p => p.cv), ys = noktalar.map(p => p.dbn), ds = noktalar.map(p => p.d);
  const xMax = Math.max(...xs) * 1.12 || 1;
  const yMax = Math.max(...ys) * 1.12 || 1;
  const dMax = Math.max(...ds) || 1;
  const X = v => L + (v / xMax) * cw;
  const Y = v => T + ch - (v / yMax) * ch;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">`;
  svg += `<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`;
  for (let i = 0; i <= 4; i++) {
    const gx = L + (cw * i) / 4, gy = T + (ch * i) / 4;
    svg += `<line x1="${gx}" y1="${T}" x2="${gx}" y2="${T + ch}" stroke="#e5e7eb" stroke-width="0.6"/>`;
    svg += `<line x1="${L}" y1="${gy}" x2="${L + cw}" y2="${gy}" stroke="#e5e7eb" stroke-width="0.6"/>`;
    svg += `<text x="${gx}" y="${H - 14}" text-anchor="middle" font-size="7" fill="#6b7280">${(xMax * i / 4).toFixed(0)}</text>`;
    svg += `<text x="${L - 4}" y="${T + ch - (ch * i) / 4 + 2.5}" text-anchor="end" font-size="7" fill="#6b7280">${(yMax * i / 4).toFixed(0)}</text>`;
  }
  svg += `<text x="${L + cw / 2}" y="${H - 3}" text-anchor="middle" font-size="7.5" fill="#374151">CV10 (%) — oynaklık</text>`;
  svg += `<text x="10" y="${T + ch / 2}" text-anchor="middle" font-size="7.5" fill="#374151" transform="rotate(-90 10 ${T + ch / 2})">Ort dbn (₺)</text>`;
  noktalar.forEach(p => {
    const r = 3 + Math.sqrt(p.d / dMax) * 9;
    svg += `<circle cx="${X(p.cv).toFixed(1)}" cy="${Y(p.dbn).toFixed(1)}" r="${r.toFixed(1)}" fill="rgba(34,120,74,0.35)" stroke="#22784a" stroke-width="1"/>`;
    svg += `<text x="${X(p.cv).toFixed(1)}" y="${(Y(p.dbn) - r - 2).toFixed(1)}" text-anchor="middle" font-size="6.5" fill="#111827">${p.ad} ${p.ok || ""}</text>`;
  });
  svg += `</svg>`;
  return svg;
}

const TREND_RAPOR_KATMANLAR = { fiyat: true, ewmaFast: true, ewmaMid: true, sma5: true, sma3: false, sma10: false, sma20: false };

async function generateTrendPDF() {
  if (!pdfHazirMi()) { alert("PDF kütüphanesi yüklenemedi."); return; }
  if (state.trendPdfKosuyor) return;
  state.trendPdfKosuyor = true;
  render();
  const t0 = Date.now();
  try {
    const ev = getTrendEvren();
    if (ev.gunler.length === 0) { alert("Bu filtreyle mezat verisi yok."); return; }
    const filtreEtiket = state.sf ? state.sf.replace("GRUP:", "") + (state.sf.startsWith("GRUP:") ? " (Grup)" : "") : (state.sb ? state.sb : null);
    const doc = pdfBaslat("Çallı Çiçek — Trend & Piyasa Raporu",
      "Son " + ev.gunler.length + " geçerli mezat" + (ev.kisitli ? " — mevcut 120 günlük veri" : "") + ": " + fD(ev.gunler[0]) + " – " + fD(ev.gunler[ev.gunler.length - 1]) + (filtreEtiket ? "   |   Filtre: " + filtreEtiket : ""));
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    let y = 82;
    const grafW = W - 80;
    const grafH = grafW * (158 / 360);

    const kucukTeknik = (ms) => {
      const v = trendMetrikSatiri(ms);
      doc.setFont("DejaVu", "normal"); doc.setFontSize(6.5);
      doc.setTextColor(PDF_TEMA.gri[0], PDF_TEMA.gri[1], PDF_TEMA.gri[2]);
      doc.text(pdfMetin("Son: " + v[0] + " · Eğim: " + v[1] + " · ROC3: " + v[2] + " · CV: " + v[3] + " · Yapı: " + v[4]), 40, y + 4);
      doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
      y += 12;
    };
    const grafikEkle = async (ms) => {
      const png = await trendSvgStringToPng(buildMezatChart(ms, TREND_RAPOR_KATMANLAR), 2);
      if (y + grafH > H - 50) { doc.addPage(); y = 80; }
      doc.addImage(png, "JPEG", 40, y, grafW, grafH);
      y += grafH + 6;
      if (ms.seri.some(p => !p.v2)) {
        doc.setFontSize(6.5); doc.setTextColor(PDF_TEMA.gri[0], PDF_TEMA.gri[1], PDF_TEMA.gri[2]);
        doc.text(pdfMetin("31 Tem öncesi noktalar tahmini %20 net modeliyle — görselde soluk, hesaplara dahildir; zaman geçtikçe pencereden doğal olarak çıkacaklardır."), 40, y);
        doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
        y += 10;
      }
    };
    const rejimRenk = rj => rj.ok === "↑" ? [22, 120, 74] : rj.ok === "↓" ? [220, 38, 38] : [100, 116, 139];

    // ── Faz 2.2 İş 2: V1/V2 hassasiyet sayacı + blok notu yardımcıları ──
    // (ana rejim DAİMA karma seriden; buradaki her şey güven katmanı)
    const v2Sayac = { ayni: 0, farkli: 0, yetersiz: 0, detay: [] };
    const v2Say = (ad, k) => {
      v2Sayac[k.durum === "aynı" ? "ayni" : k.durum === "farklı" ? "farkli" : "yetersiz"]++;
      v2Sayac.detay.push({ ad, durum: k.durum, bRejim: k.bRejim, bN: k.bN });
      return k;
    };
    const v2Notu = (k) => {
      doc.setFont("DejaVu", "normal"); doc.setFontSize(6.5);
      if (k.durum === "farklı") {
        doc.setTextColor(220, 38, 38);
        doc.text(pdfMetin("⚠ V1/V2 ayrımında rejim değişiyor — güven düşük (V2-yalnız: " + k.bRejim + ", n=" + k.bN + ")"), 40, y + 3);
        y += 10;
      } else if (k.durum === "yetersiz") {
        doc.setTextColor(PDF_TEMA.gri[0], PDF_TEMA.gri[1], PDF_TEMA.gri[2]);
        doc.text(pdfMetin("V2 karşılaştırması için yetersiz veri (n=" + k.bN + ")"), 40, y + 3);
        y += 9;
      }
      doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
    };

    // ── 1) 🧭 Trend Yönetici Bulguları (EN ÜSTTE — iki satır hiyerarşisi, Faz 2.2 İş 3) ──
    const bulgular = getTrendBulgulari(ev);
    if (bulgular.length) {
      doc.setFont("DejaVu", "bold"); doc.setFontSize(12);
      doc.text(pdfMetin("🧭 Trend Yönetici Bulguları"), 40, y); y += 10;
      bulgular.forEach(b => {
        doc.setFont("DejaVu", "normal"); doc.setFontSize(8);
        const anaLines = doc.splitTextToSize(pdfMetin("• " + b.ana), W - 88);
        const tekLines = doc.splitTextToSize(pdfMetin(b.teknik), W - 100);
        if (y + anaLines.length * 10 + tekLines.length * 8 > H - 50) { doc.addPage(); y = 80; }
        doc.text(anaLines, 44, y + 4);
        y += anaLines.length * 10;
        doc.setFontSize(6.5);
        doc.setTextColor(PDF_TEMA.gri[0], PDF_TEMA.gri[1], PDF_TEMA.gri[2]);
        doc.text(tekLines, 52, y + 2);
        doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
        y += tekLines.length * 8 + 4;
      });
      y += 6;
    }

    // ── 2) Piyasa Özeti — rejim dili büyük, teknik küçük, grafik aynen ──
    const evrenMs = trendEvrenSeri(null, 30);
    const evrenRj = getRejim(evrenMs);
    const evrenV2 = v2Say("Piyasa geneli", trendV2Kiyas(evrenMs, trendEvrenSeri(null, 30, true)));
    doc.setFont("DejaVu", "bold"); doc.setFontSize(12);
    doc.setTextColor.apply(doc, rejimRenk(evrenRj));
    doc.text(pdfMetin((evrenV2.durum === "farklı" ? "⚠ " : "") + evrenRj.ok + " Piyasa: " + rejimEtiket(evrenRj)), 40, y);
    doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
    y += 8;
    v2Notu(evrenV2);
    kucukTeknik(evrenMs);
    await grafikEkle(evrenMs);

    // ── 3) Lider Ürünler — blok başlığı rejim dili ──
    if (y > H - 120) { doc.addPage(); y = 80; }
    doc.setFont("DejaVu", "bold"); doc.setFontSize(12);
    doc.text(pdfMetin("Lider Ürünler — hacim %80 kapsamı (" + ev.liderler.length + " ürün, %" + ev.kapsamPct.toFixed(0) + ")"), 40, y); y += 10;
    for (const c of ev.liderler) {
      const ms = trendUrunSeri(c, state.sb || null, 30);
      const rj = getRejim(ms);
      const v2k = v2Say(c, trendV2Kiyas(ms, trendUrunSeri(c, state.sb || null, 30, true)));
      if (y + 30 > H - 50) { doc.addPage(); y = 80; }
      doc.setFont("DejaVu", "bold"); doc.setFontSize(10);
      doc.setTextColor.apply(doc, rejimRenk(rj));
      doc.text(pdfMetin((v2k.durum === "farklı" ? "⚠ " : "") + rj.ok + " " + c + " — " + rejimEtiket(rj)), 40, y + 4);
      doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
      doc.setFont("DejaVu", "normal"); doc.setFontSize(6.5);
      doc.setTextColor(PDF_TEMA.gri[0], PDF_TEMA.gri[1], PDF_TEMA.gri[2]);
      doc.text(pdfMetin((ev.siralı.find(u => u.c === c) || {}).d + " dm"), W - 40, y + 4, { align: "right" });
      doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
      y += 10;
      v2Notu(v2k);
      kucukTeknik(ms);
      if (ms.n < 5) {
        doc.setFontSize(7.5); doc.setTextColor(202, 138, 4);
        doc.text(pdfMetin("Yetersiz mezat verisi (n=" + ms.n + ") — grafik atlandı"), 40, y); y += 12;
        doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
      } else {
        await grafikEkle(ms);
      }
      y += 4;
    }

    // ── 4) ⚡ Önemli Fiyat Hareketleri — rejim kolonlu, en fazla 5 ──
    if (y > H - 140) { doc.addPage(); y = 80; }
    doc.setFont("DejaVu", "bold"); doc.setFontSize(12);
    doc.text(pdfMetin("⚡ Önemli Fiyat Hareketleri"), 40, y); y += 6;
    const liderSet = new Set(ev.liderler);
    const kapsamDisi = ev.siralı.filter(u => !liderSet.has(u.c)).map(u => {
      const ms = trendUrunSeri(u.c, state.sb || null, 30);
      if (ms.n < 6) return null;
      const ilk3 = ms.seri.slice(0, 3), son3 = ms.seri.slice(-3);
      const ilkOrt = ilk3.reduce((s, p) => s + p.dbn, 0) / 3;
      const sonOrt = son3.reduce((s, p) => s + p.dbn, 0) / 3;
      return { c: u.c, d: u.d, ms, rj: getRejim(ms), degisim: ilkOrt > 0 ? (sonOrt / ilkOrt - 1) * 100 : null };
    }).filter(Boolean);
    const hAdaylar = [...kapsamDisi].sort((a, b) => Math.abs(b.degisim || 0) - Math.abs(a.degisim || 0));
    const secilenH = [];
    hAdaylar.forEach(h => { if (secilenH.length < 3) secilenH.push(h); });
    kapsamDisi.filter(h => h.rj.kirilmaAilesi && !secilenH.includes(h)).forEach(h => { if (secilenH.length < 5) secilenH.push(h); });
    const hacimMedyan = (() => { const v = kapsamDisi.map(h => h.d).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : 0; })();
    const nedenYaz = h => {
      const hs = h.d >= hacimMedyan ? "Yüksek" : "Düşük";
      if (h.rj.rejim === "Güçlenen düşüş" || h.rj.rejim === "Aşağı kırılma riski") return hs + " hacimde sert bozulma";
      if (h.rj.rejim === "Güçlenen yükseliş" || h.rj.rejim === "Yukarı kırılma adayı") return hs + " hacimde sert sıçrama";
      if (h.rj.kirilmaAilesi) return "Dönüş sinyali — izle";
      return "Sert fiyat hareketi";
    };
    if (secilenH.length === 0) {
      doc.setFont("DejaVu", "normal"); doc.setFontSize(8);
      doc.setTextColor(PDF_TEMA.gri[0], PDF_TEMA.gri[1], PDF_TEMA.gri[2]);
      doc.text(pdfMetin("Kapsam dışında n≥6 ürün yok."), 40, y + 8); y += 18;
      doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
    } else {
      y = pdfTablo(doc, ["Ürün", "Rejim", "Eğim", "Momentum", "CV", "Hacim", "Neden dikkat?"],
        secilenH.map(h => [h.c, rejimEtiket(h.rj), h.ms.slope === null ? "—" : (h.ms.slope >= 0 ? "+" : "") + h.ms.slope.toFixed(1), h.ms.roc3 === null ? "—" : (h.ms.roc3 >= 0 ? "+" : "−") + "%" + Math.abs(h.ms.roc3).toFixed(0), h.ms.cv === null ? "—" : "%" + h.ms.cv.toFixed(0), h.d + " dm", nedenYaz(h)]),
        { startY: y + 6, kucuk: true, fontSize: 6.5, columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } } }) + 10;
    }

    // ── 5) Şubeler: Ana 3 (ekonomik önem) + Trend İstisnaları ──
    if (y > H - 130) { doc.addPage(); y = 80; }
    doc.setFont("DejaVu", "bold"); doc.setFontSize(12);
    doc.text(pdfMetin("Ana 3 Şube"), 40, y); y += 6;
    const subeAgg = {};
    ev.pencereRows.forEach(r => { if (!subeAgg[r.s]) subeAgg[r.s] = { net: 0, d: 0 }; subeAgg[r.s].net += r.net; subeAgg[r.s].d += r.d; });
    const toplamNet2 = Object.values(subeAgg).reduce((s, v) => s + v.net, 0);
    const anaSirali = Object.entries(subeAgg).sort((a, b) => b[1].net - a[1].net);
    const ana3 = anaSirali.slice(0, 3).map(([s]) => s);
    const subeMsCache = {};
    const subeMs = s => subeMsCache[s] || (subeMsCache[s] = trendEvrenSeri(s, 30));
    const subeV2k = {};
    ana3.forEach(s => { subeV2k[s] = v2Say(s + " şubesi", trendV2Kiyas(subeMs(s), trendEvrenSeri(s, 30, true))); });
    y = pdfTablo(doc, ["Şube", "Rejim", "Net", "Demet", "Pay", "Eğim", "ROC3", "CV"],
      ana3.map(s => {
        const ms = subeMs(s), rj = getRejim(ms);
        return [(subeV2k[s].durum === "farklı" ? "⚠ " : "") + rj.ok + " " + s, rejimEtiket(rj), fmt(subeAgg[s].net), String(subeAgg[s].d), toplamNet2 > 0 ? "%" + (subeAgg[s].net / toplamNet2 * 100).toFixed(0) : "—",
          ms.slope === null ? "—" : (ms.slope >= 0 ? "+" : "") + ms.slope.toFixed(1), ms.roc3 === null ? "—" : (ms.roc3 >= 0 ? "+" : "−") + "%" + Math.abs(ms.roc3).toFixed(0), ms.cv === null ? "—" : "%" + ms.cv.toFixed(0)];
      }),
      { startY: y + 6, kucuk: true, fontSize: 6.5, columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" } } }) + 8;
    // Şube V2 kıyas notları (farklı → ibare, yetersiz → tek toplu satır)
    ana3.filter(s => subeV2k[s].durum === "farklı").forEach(s => {
      doc.setFont("DejaVu", "normal"); doc.setFontSize(6.5); doc.setTextColor(220, 38, 38);
      doc.text(pdfMetin("⚠ " + s + ": V1/V2 ayrımında rejim değişiyor — güven düşük (V2-yalnız: " + subeV2k[s].bRejim + ", n=" + subeV2k[s].bN + ")"), 40, y); y += 9;
      doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
    });
    const subeYetersiz = ana3.filter(s => subeV2k[s].durum === "yetersiz");
    if (subeYetersiz.length) {
      doc.setFont("DejaVu", "normal"); doc.setFontSize(6.5);
      doc.setTextColor(PDF_TEMA.gri[0], PDF_TEMA.gri[1], PDF_TEMA.gri[2]);
      doc.text(pdfMetin("V2 karşılaştırması için yetersiz veri: " + subeYetersiz.join(", ")), 40, y); y += 9;
      doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
    }
    // Trend İstisnaları
    const ana3Set = new Set(ana3);
    const istisnalar = anaSirali.map(([s]) => s).filter(s => !ana3Set.has(s)).map(s => {
      const ms = subeMs(s), rj = getRejim(ms);
      if (!rj.rejim || ms.roc3 === null) return null;
      const zit = (rj.egimSinifi === "+" && rj.momentumSinifi === "-") || (rj.egimSinifi === "-" && rj.momentumSinifi === "+");
      if (rj.kirilmaAilesi || (zit && Math.abs(ms.roc3) >= 20)) return { s, ms, rj, zit };
      return null;
    }).filter(Boolean).sort((a, b) => Math.abs(b.ms.roc3) - Math.abs(a.ms.roc3)).slice(0, 3);
    if (istisnalar.length) {
      doc.setFont("DejaVu", "bold"); doc.setFontSize(10);
      doc.text(pdfMetin("Trend İstisnaları"), 40, y + 4); y += 8;
      y = pdfTablo(doc, ["Şube", "Rejim", "ROC3", "CV", "Neden"],
        istisnalar.map(x => [x.rj.ok + " " + x.s, rejimEtiket(x.rj), (x.ms.roc3 >= 0 ? "+" : "−") + "%" + Math.abs(x.ms.roc3).toFixed(0), x.ms.cv === null ? "—" : "%" + x.ms.cv.toFixed(0), x.zit ? "eğim ile momentum zıt yönde" : "kırılma/dönüş rejimi"]),
        { startY: y + 4, kucuk: true, fontSize: 6.5, columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } } }) + 10;
    }

    // ── 6) Volatilite × Fiyat Haritası — balonlarda rejim oku ──
    const scatterNoktalar = ev.siralı.map(u => {
      const ms = trendUrunSeri(u.c, state.sb || null, 30);
      if (ms.n < 6 || ms.cv === null) return null;
      const ortDbn = ms.seri.reduce((s, p) => s + p.dbn * p.d, 0) / ms.seri.reduce((s, p) => s + p.d, 0);
      const ad = u.c.length > 14 ? u.c.split(" ").map(w => w.substring(0, 4)).join(".") : u.c;
      return { ad, cv: ms.cv, dbn: ortDbn, d: u.d, ok: getRejim(ms).ok };
    }).filter(Boolean);
    if (scatterNoktalar.length >= 2) {
      const scH = grafW * (230 / 360);
      if (y + scH + 40 > H - 50) { doc.addPage(); y = 80; }
      doc.setFont("DejaVu", "bold"); doc.setFontSize(12);
      doc.text(pdfMetin("Volatilite × Fiyat Haritası"), 40, y); y += 8;
      const scPng = await trendSvgStringToPng(buildScatterSVG(scatterNoktalar), 2);
      doc.addImage(scPng, "JPEG", 40, y, grafW, scH);
      y += scH + 8;
      doc.setFont("DejaVu", "normal"); doc.setFontSize(7);
      doc.setTextColor(PDF_TEMA.gri[0], PDF_TEMA.gri[1], PDF_TEMA.gri[2]);
      const okumaSatir = doc.splitTextToSize(pdfMetin("Okuma: sağ üst = pahalı ve oynak (fırsat/risk), sol üst = pahalı ve istikrarlı (çekirdek gelir). Nokta büyüklüğü = demet hacmi; ↑↓→ = rejim yönü. n≥6 ürünler."), W - 80);
      doc.text(okumaSatir, 40, y);
      doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
      y += okumaSatir.length * 8 + 10;
    }

    // ── 7) Yöntem Doğrulama Özeti (Faz 2.1 testleri — patron paketi, Faz 2.2 İş 4) ──
    if (y > H - 120) { doc.addPage(); y = 80; }
    doc.setFont("DejaVu", "bold"); doc.setFontSize(10);
    doc.text(pdfMetin("Yöntem Doğrulama Özeti (Faz 2.1 testleri)"), 40, y); y += 4;
    doc.setFont("DejaVu", "normal"); doc.setFontSize(7);
    [
      "ROC3 pencere testi — nokta bazlı vs 3'lü ortalama (3v3): 3v3 belirgin daha kararlı; tekil aykırı mezata yaklaşık 3 kat daha dirençli.",
      "3v3'e geçilseydi incelenen 11 serinin 4'ünde rejim sınıfı yumuşardı (sert momentum sinyalleri nötrleşirdi) — yanlış alarm riski azalırdı.",
      "Eğim testi — OLS vs Theil-Sen: 11 serinin 9'unda işaret uyumu; ayrışan serilerde fark tekil aykırı değer kaynaklı (bir seride OLS +26,3 iken Theil-Sen −0,3).",
      "Bu turda yöntem DEĞİŞTİRİLMEDİ: motor nokta bazlı ROC3 ve OLS eğimle çalışmaya devam ediyor — geçiş kararı patrondadır.",
      "Değerlendirme: 3v3 sonuçları geçiş için güçlü gerekçe sunuyor (aykırı değer direnci + daha istikrarlı rejim sınıfı)."
    ].forEach(s => {
      const L = doc.splitTextToSize(pdfMetin("• " + s), W - 88);
      if (y + L.length * 9 > H - 50) { doc.addPage(); y = 80; }
      doc.text(L, 44, y + 6);
      y += L.length * 9 + 1;
    });
    y += 8;

    // ── Veri kalitesi hassasiyeti dipnotu (Faz 2.2 İş 2) ──
    if (y > H - 60) { doc.addPage(); y = 80; }
    doc.setFont("DejaVu", "normal"); doc.setFontSize(6.5);
    doc.setTextColor(PDF_TEMA.gri[0], PDF_TEMA.gri[1], PDF_TEMA.gri[2]);
    const v2DipEk = v2Sayac.yetersiz > 0 ? "; " + v2Sayac.yetersiz + " seride V2 karşılaştırması için yetersiz veri" : "";
    doc.text(pdfMetin(v2Sayac.farkli === 0
      ? "Veri kalitesi hassasiyeti: rejimler V2-yalnız seriyle aynı (" + v2Sayac.ayni + " seri" + v2DipEk + ")."
      : "Veri kalitesi hassasiyeti: " + v2Sayac.farkli + " seride V1/V2 ayrımında rejim değişiyor (⚠ işaretli bloklar); " + v2Sayac.ayni + " seri aynı" + v2DipEk + "."), 40, y);
    doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);

    window.__trendV2Kiyas = v2Sayac;
    window.__trendPdfSure = Date.now() - t0;
    pdfOnizlemeAc(doc, pdfDosyaAdi("trend"));
  } catch (e) {
    console.error("Trend PDF hatası:", e);
    alert("Trend PDF hatası: " + e.message);
  } finally {
    state.trendPdfKosuyor = false;
    render();
  }
}
