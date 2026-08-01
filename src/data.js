// ═══════════════ CSV PARSER ═══════════════
function parseCSV(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(l => l);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    if (vals.length < headers.length) continue;
    const obj = {};
    headers.forEach((h, idx) => obj[h.trim()] = (vals[idx] || "").trim());
    records.push(obj);
  }
  return records;
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i+1] === '"') { current += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { result.push(current); current = ""; }
      else current += ch;
    }
  }
  result.push(current);
  return result;
}

function normalizeRecord(raw) {
  // Find columns flexibly
  const keys = Object.keys(raw);
  const find = (...terms) => keys.find(k => terms.some(t => k.toLowerCase().includes(t.toLowerCase())));

  const subeKey = find("Şube", "Sube", "şube", "sube");
  const cicekKey = find("Çiçek", "Cicek", "çiçek", "cicek");
  const adetKey = find("Adet", "adet");
  const demetKey = find("Demet", "demet");
  const birimKey = keys.find(k => k.toLowerCase().includes("birim")) || find("Birim Fiyat", "Birim fiyat");
  const tarihKey = find("Tarih", "tarih");

  const sube = raw[subeKey] || "";
  const cicek = raw[cicekKey] || "";
  const adet = parseInt((raw[adetKey] || "0").replace(/[^\d]/g, "")) || 0;
  const demet = parseInt((raw[demetKey] || "0").replace(/[^\d]/g, "")) || 0;

  let birimStr = (raw[birimKey] || "0").replace(/[^\d.,]/g, "").replace(",", ".");
  const birimFiyat = parseFloat(birimStr) || 0;

  // Parse date - handle both DD.MM.YYYY and YYYY-MM-DD
  let tarih = "";
  const rawDate = raw[tarihKey] || "";
  if (rawDate.includes(".")) {
    const parts = rawDate.split(".");
    if (parts.length >= 3) {
      const d = parts[0].padStart(2, "0");
      const m = parts[1].padStart(2, "0");
      const y = parts[2].length === 2 ? "20" + parts[2] : parts[2];
      tarih = y + "-" + m + "-" + d;
    }
  } else if (rawDate.includes("-")) {
    tarih = rawDate.substring(0, 10);
  } else if (rawDate.includes("/")) {
    const parts = rawDate.split("/");
    if (parts.length >= 3) {
      tarih = parts[2] + "-" + parts[0].padStart(2,"0") + "-" + parts[1].padStart(2,"0");
    }
  }

  if (!sube || !cicek || !tarih || birimFiyat <= 0 || demet <= 0) return null;

  return {
    s: sube, c: cicek.toUpperCase(), a: adet, d: demet,
    f: birimFiyat, t: tarih,
    ciro: birimFiyat,                          // Birim Fiyat = toplam satır fiyatı
    net: birimFiyat * (1 - GIDER),             // Net = toplam × 0.80
    dbn: demet > 0 ? (birimFiyat * (1 - GIDER)) / demet : 0  // Demet başı net
  };
}

// ═══════════════ DATA LOADING ═══════════════
async function loadAllData() {
  const allRecords = [];
  const sheetNames = Object.keys(window.SHEETS);
  let loaded = 0;

  // Progress göster
  function updateProgress(name) {
    loaded++;
    const el = document.getElementById("app");
    if (el && el.querySelector(".loading-screen")) {
      el.innerHTML = '<div class="loading-screen"><div class="spinner"></div><div style="font-size:14px;margin-bottom:6px">Veriler yükleniyor...</div><div style="font-size:11px;color:#475569;margin-bottom:10px">' + loaded + '/' + sheetNames.length + ' sheet yüklendi (' + name + ')</div><div style="width:200px;height:4px;background:rgba(255,255,255,0.06);border-radius:2px"><div style="height:100%;border-radius:2px;background:#22c55e;width:' + (loaded/sheetNames.length*100) + '%;transition:width 0.3s"></div></div></div>';
    }
  }

  // Paralel yükleme — tüm sheet'leri aynı anda çek
  const results = await Promise.allSettled(sheetNames.map(async (name) => {
    try {
      const resp = await fetch(window.SHEETS[name]);
      if (!resp.ok) { window.DEBUG_INFO += name + ": HATA\n"; updateProgress(name); return []; }
      const text = await resp.text();
      const rows = parseCSV(text);

      if (rows.length > 0 && (name === "GUNCEL" || name === "2025")) {
        const keys = Object.keys(rows[0]);
        window.DEBUG_INFO += name + " KOLONLAR: " + keys.join(" | ") + "\n";
      }

      let count = 0;
      let skipped = 0;
      const recs = [];
      rows.forEach(raw => {
        const rec = normalizeRecord(raw);
        if (rec) { recs.push(rec); count++; }
        else { skipped++; }
      });
      window.DEBUG_INFO += name + ": " + rows.length + " satır, " + count + " geçerli, " + skipped + " atlandı\n";
      updateProgress(name);
      return recs;
    } catch (e) {
      window.DEBUG_INFO += name + ": HATA - " + e.message + "\n";
      updateProgress(name);
      return [];
    }
  }));

  results.forEach(r => { if (r.status === "fulfilled") allRecords.push(...r.value); });

  window.ALL_DATA = allRecords;

  // Veri kalite bilgisi — global'e kaydet
  const totalDemet = window.ALL_DATA.reduce((s, r) => s + r.d, 0);
  const totalCiro = window.ALL_DATA.reduce((s, r) => s + r.ciro, 0);
  const totalNet = window.ALL_DATA.reduce((s, r) => s + r.net, 0);
  window._DATA_QUALITY = {
    toplamKayit: window.ALL_DATA.length,
    toplamDemet: totalDemet,
    toplamCiro: Math.round(totalCiro),
    toplamNet: Math.round(totalNet),
    sonGuncelleme: new Date().toLocaleString("tr-TR"),
    enSonTarih: window.ALL_DATA.length > 0 ? window.ALL_DATA.reduce((mx, r) => r.t > mx ? r.t : mx, "") : ""
  };
  window.DEBUG_INFO += "TOPLAM: " + window.ALL_DATA.length + " kayıt, " + totalDemet + " demet, " + Math.round(totalCiro) + " ciro, " + Math.round(totalNet) + " net\n";

  window.FLOWERS = [...new Set(window.ALL_DATA.map(r => r.c))].sort();
  window.BRANCHES = [...new Set(window.ALL_DATA.map(r => r.s))].sort();

  // Auto-group flowers by first word
  window.CICEK_GROUPS = {};
  window.FLOWERS.forEach(f => {
    const parts = f.split(" ");
    const group = parts.length > 1 ? parts[0] : f;
    if (!window.CICEK_GROUPS[group]) window.CICEK_GROUPS[group] = [];
    window.CICEK_GROUPS[group].push(f);
  });
  // Only keep groups with 2+ flowers
  Object.keys(window.CICEK_GROUPS).forEach(k => {
    if (window.CICEK_GROUPS[k].length < 2) delete window.CICEK_GROUPS[k];
  });
  window.GROUP_NAMES = Object.keys(window.CICEK_GROUPS).sort();

  return window.ALL_DATA.length;
}
