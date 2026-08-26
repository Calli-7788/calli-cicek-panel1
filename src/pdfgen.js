// ═══════════════ PDF ALTYAPI MODÜLÜ (Rapor Faz 0) ═══════════════
// jsPDF (UMD) + jspdf-autotable CDN'den yüklenir; yüklenemezse rapor butonları
// devre dışı kalır, program ÇÖKMEZ. Önizleme program içi katmanda açılır —
// window.open / window.print KULLANILMAZ (savedPlanPDF/planPDF eski akışı Faz 3'e dek ayrık).

function pdfHazirMi() {
  return !!(window.jspdf && window.jspdf.jsPDF && window.PDF_FONT_REGULAR);
}

// ₺ fallback: fontta U+20BA yoksa (PDF_TRY_GLIF=false) otomatik "TL"
function pdfMetin(s) {
  s = String(s == null ? "" : s);
  return window.PDF_TRY_GLIF ? s : s.replace(/₺/g, "TL");
}

var PDF_TEMA = {
  yesil: [34, 120, 74],
  yesilAcik: [232, 245, 237],
  koyu: [30, 41, 59],
  gri: [100, 116, 139],
  griAcik: [241, 245, 249],
  kirmizi: [220, 38, 38]
};

// Doc oluşturur, Türkçe fontları kaydeder, başlık şeridini çizer
function pdfBaslat(baslik, altBaslik) {
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.addFileToVFS("DejaVuSans.ttf", window.PDF_FONT_REGULAR);
  doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  doc.addFileToVFS("DejaVuSans-Bold.ttf", window.PDF_FONT_BOLD);
  doc.addFont("DejaVuSans-Bold.ttf", "DejaVu", "bold");
  doc.setFont("DejaVu", "normal");

  // Başlık şeridi (yeşil tema)
  var W = doc.internal.pageSize.getWidth();
  doc.setFillColor(PDF_TEMA.yesil[0], PDF_TEMA.yesil[1], PDF_TEMA.yesil[2]);
  doc.rect(0, 0, W, 64, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("DejaVu", "bold");
  doc.setFontSize(16);
  doc.text(pdfMetin(baslik), 40, 28);
  doc.setFont("DejaVu", "normal");
  doc.setFontSize(9);
  if (altBaslik) doc.text(pdfMetin(altBaslik), 40, 46);
  doc.setFontSize(8);
  doc.text(pdfMetin("Üretim: " + new Date().toLocaleString("tr-TR")), W - 40, 46, { align: "right" });
  doc.setTextColor(PDF_TEMA.koyu[0], PDF_TEMA.koyu[1], PDF_TEMA.koyu[2]);
  return doc;
}

// Tüm sayfalara footer (kayıt sonunda çağrılır)
function pdfFooterUygula(doc, dosyaAdi) {
  var n = doc.internal.getNumberOfPages();
  var W = doc.internal.pageSize.getWidth();
  var H = doc.internal.pageSize.getHeight();
  for (var i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont("DejaVu", "normal");
    doc.setFontSize(7);
    doc.setTextColor(PDF_TEMA.gri[0], PDF_TEMA.gri[1], PDF_TEMA.gri[2]);
    doc.text(pdfMetin("Çallı Çiçek — Üretici Paneli"), 40, H - 20);
    doc.text(pdfMetin(dosyaAdi + " · Sayfa " + i + "/" + n), W - 40, H - 20, { align: "right" });
  }
}

// autoTable sarmalayıcı — tema + Türkçe font + sayfa bölme kontrolü
// opts: { startY, bolunmez: true → pageBreak:'avoid', kucuk: true → 7pt, ...autoTable passthrough }
function pdfTablo(doc, kolonlar, satirlar, opts) {
  opts = opts || {};
  var ayar = {
    head: [kolonlar.map(pdfMetin)],
    body: satirlar.map(function(r) { return r.map(pdfMetin) }),
    startY: opts.startY || 80,
    margin: { left: 40, right: 40 },
    styles: { font: "DejaVu", fontSize: opts.kucuk ? 7 : 8.5, cellPadding: 3, textColor: PDF_TEMA.koyu },
    headStyles: { font: "DejaVu", fontStyle: "bold", fillColor: PDF_TEMA.yesil, textColor: [255, 255, 255], fontSize: opts.kucuk ? 7 : 8.5 },
    alternateRowStyles: { fillColor: PDF_TEMA.griAcik },
    rowPageBreak: "avoid"
  };
  if (opts.bolunmez) ayar.pageBreak = "avoid";
  if (opts.columnStyles) ayar.columnStyles = opts.columnStyles;
  if (opts.didParseCell) ayar.didParseCell = opts.didParseCell;
  doc.autoTable(ayar);
  return doc.lastAutoTable.finalY;
}

// SVG → PNG dataURL (A4 baskı netliği için ≥2× ölçek)
function svgToPng(svgElement, scale) {
  scale = scale || 2;
  return new Promise(function(resolve, reject) {
    try {
      var vb = svgElement.viewBox && svgElement.viewBox.baseVal;
      var w = (vb && vb.width) || svgElement.clientWidth || 360;
      var h = (vb && vb.height) || svgElement.clientHeight || 170;
      var xml = new XMLSerializer().serializeToString(svgElement);
      var blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = function(e) { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    } catch (e) { reject(e); }
  });
}

// ── Program içi önizleme katmanı: ✕ KAPAT · 📤 PAYLAŞ · 💾 İNDİR ──
var _pdfAktifBlobUrl = null;

function pdfOnizlemeKapat() {
  var ov = document.getElementById("pdfOnizleme");
  if (ov) ov.remove();
  if (_pdfAktifBlobUrl) { URL.revokeObjectURL(_pdfAktifBlobUrl); _pdfAktifBlobUrl = null; }
  window._pdfAktifBlob = null;
}

function pdfOnizlemeAc(doc, dosyaAdi) {
  pdfFooterUygula(doc, dosyaAdi);
  var blob = doc.output("blob");
  window._pdfAktifBlob = blob;
  window._pdfAktifAd = dosyaAdi;
  _pdfAktifBlobUrl = URL.createObjectURL(blob);

  pdfOnizlemeKapat._eski = null;
  var eski = document.getElementById("pdfOnizleme");
  if (eski) eski.remove();

  var ov = document.createElement("div");
  ov.id = "pdfOnizleme";
  ov.style.cssText = "position:fixed;inset:0;z-index:9999;background:#0b0e18;display:flex;flex-direction:column";
  ov.innerHTML =
    '<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:#111827;border-bottom:1px solid rgba(255,255,255,0.08)">' +
    '<button onclick="pdfOnizlemeKapat()" style="padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(239,68,68,0.15);color:#fca5a5;font-size:13px;cursor:pointer;font-weight:700">✕ Kapat</button>' +
    '<span style="flex:1;font-size:11px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + dosyaAdi + '</span>' +
    '<button onclick="pdfPaylas(window._pdfAktifBlob, window._pdfAktifAd)" style="padding:8px 14px;border-radius:8px;border:none;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-size:13px;cursor:pointer;font-weight:700">📤 Paylaş</button>' +
    '<button onclick="pdfIndir(window._pdfAktifBlob, window._pdfAktifAd)" style="padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#e2e8f0;font-size:13px;cursor:pointer">💾 İndir</button>' +
    '</div>' +
    '<iframe src="' + _pdfAktifBlobUrl + '" style="flex:1;border:none;background:#374151" title="PDF önizleme"></iframe>';
  document.body.appendChild(ov);
}

function pdfIndir(blob, dosyaAdi) {
  if (!blob) return;
  var a = document.createElement("a");
  var url = URL.createObjectURL(blob);
  a.href = url;
  a.download = dosyaAdi;
  document.body.appendChild(a);
  a.click();
  setTimeout(function() { a.remove(); URL.revokeObjectURL(url); }, 800);
}

function pdfPaylas(blob, dosyaAdi) {
  if (!blob) return;
  var file = null;
  try { file = new File([blob], dosyaAdi, { type: "application/pdf" }); } catch (e) {}
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: dosyaAdi }).catch(function(e) {
      if (e && e.name !== "AbortError") pdfIndir(blob, dosyaAdi);
    });
  } else {
    pdfIndir(blob, dosyaAdi);   // masaüstü fallback: otomatik indirme
  }
}

// Dosya adı şablonu: calli-rapor-gunluk-2026-08-26.pdf
function pdfDosyaAdi(tur) {
  return "calli-rapor-" + tur + "-" + new Date().toISOString().split("T")[0] + ".pdf";
}
