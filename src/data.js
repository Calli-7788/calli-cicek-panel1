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
    dbn: demet > 0 ? (birimFiyat * (1 - GIDER)) / demet : 0,  // Demet başı net
    costModel: "v1"
  };
}

// ═══════════════ V2 PARSE (GUNCEL_V2 — gerçek satır bazlı gider) ═══════════════
window.V2_EXPECTED_HEADERS = ["Hesap No","Şube","Çiçek Adı","Adet","Demet","Satış Fiyatı","Tarih","Sıra No","Kayıt ID","Satır No","Bağkur Payı","Borsa Payı","Hamaliye Payı","Koop Gider Payı","Nakliye Payı","Nakliye Zarar Payı","Stopaj Payı","Toplam Gider Payı","Net Satış","Net/Demet","Satır Türü","Kayıt Durumu"];

// Türkçe büyük harf — düz toUpperCase "i"→"I" yapar, "İ" yapmaz; tr-TR zorunlu.
// U+0307 (combining dot) stripping: V2 kaynağı "İ"yi ayrıştırılmış "i̇" olarak içeriyor,
// uppercase sonrası "İ̇" kalıntısı eski verideki "İ" ile eşleşmez.
function trUpperTR(s) {
  return (s || "").trim().toLocaleUpperCase("tr-TR").replace(/\u0307/g, "");
}

// V2 şube adları BÜYÜK HARF gelir; eski veri Title Case kullanır ("Adana", "BayramPaşa").
// Analiz sürekliliği için V2 adları eski yazıma eşlenir. Tabloda olmayan yeni şube olduğu gibi kalır.
window.SUBE_ESLEME_V2 = {
  "ADANA": "Adana", "ANKARA": "Ankara", "AYAZAĞA": "Ayazağa",
  "BAYRAMPAŞA": "BayramPaşa",  // 2026 sekmesi bu yazımı kullanıyor (eski yıllarda "Bayrampaşa" da var)
  "BURSA": "Bursa", "ÇORLU": "Çorlu", "ESKİŞEHİR": "Eskişehir",
  "GAZİANTEP": "Gaziantep", "KADIKÖY": "Kadıköy", "KAYSERİ": "Kayseri",
  "KOCAELİ": "Kocaeli", "KONYA": "Konya", "MERSİN": "Mersin",
  "SAMSUN": "Samsun", "TRABZON": "Trabzon"
};

// Bot bazı adlarda "ı" yerine "i" yazıyor ("Saksi", "Sari") → uppercase "İ" olur, eski "I" ile eşleşmez
window.CICEK_ESLEME_V2 = {
  "FESLEĞEN SAKSİ": "FESLEĞEN SAKSI",
  "LİLYUM ASYA SARİ": "LİLYUM ASYA SARI"
};

// Türkçe sayı: "1.234,56" → 1234.56, "1,07" → 1.07
function sayiTR(v) {
  if (v == null) return 0;
  let s = String(v).trim().replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// DD.MM.YYYY → YYYY-MM-DD (V2 tarih formatı)
function tarihISOv2(raw) {
  const rd = (raw || "").trim();
  if (rd.includes(".")) {
    const parts = rd.split(".");
    if (parts.length >= 3) {
      const y = parts[2].length === 2 ? "20" + parts[2] : parts[2];
      return y + "-" + parts[1].padStart(2, "0") + "-" + parts[0].padStart(2, "0");
    }
  } else if (rd.includes("-")) {
    return rd.substring(0, 10);
  }
  return "";
}

function parseRowV2(raw) {
  const oku = (k) => (raw[k] !== undefined ? String(raw[k]).trim() : "");

  const satirTuru = oku("Satır Türü");
  if (satirTuru !== "SATIS") return { skip: true, sebep: "satirTuru" };

  const ciro = sayiTR(oku("Satış Fiyatı"));
  const net = sayiTR(oku("Net Satış"));
  const toplamGider = sayiTR(oku("Toplam Gider Payı"));
  const d = sayiTR(oku("Demet"));
  let c = trUpperTR(oku("Çiçek Adı"));
  let s = trUpperTR(oku("Şube"));
  c = window.CICEK_ESLEME_V2[c] || c;
  s = window.SUBE_ESLEME_V2[s] || s;
  const t = tarihISOv2(oku("Tarih"));

  if (!c || !s || !t || d <= 0) return { skip: true, sebep: "eksikAlan" };

  // SAĞLAMA: net + gider = brüt (kuruş toleransı)
  const saglamaOK = Math.abs((net + toplamGider) - ciro) < 0.05;

  return {
    c: c, s: s, t: t, d: d,
    a: sayiTR(oku("Adet")),
    adet: sayiTR(oku("Adet")),
    f: ciro,
    ciro: ciro,
    net: net,                                  // GERÇEK net — ×0.80 YOK
    dbn: d > 0 ? net / d : 0,
    netDemet: sayiTR(oku("Net/Demet")),
    toplamGider: toplamGider,
    giderler: {
      bagkur: sayiTR(oku("Bağkur Payı")),
      borsa: sayiTR(oku("Borsa Payı")),
      hamaliye: sayiTR(oku("Hamaliye Payı")),
      koop: sayiTR(oku("Koop Gider Payı")),
      nakliye: sayiTR(oku("Nakliye Payı")),
      nakliyeZarar: sayiTR(oku("Nakliye Zarar Payı")),
      stopaj: sayiTR(oku("Stopaj Payı"))
    },
    hesapNo: oku("Hesap No"),
    kayitId: oku("Kayıt ID"),
    satirNo: oku("Satır No"),
    siraNo: oku("Sıra No"),
    kayitDurumu: oku("Kayıt Durumu"),
    costModel: "v2",
    saglamaOK: saglamaOK
  };
}

// ═══════════════ DATA LOADING ═══════════════
async function loadAllData() {
  const allRecords = [];
  const sheetNames = Object.keys(window.SHEETS);
  let loaded = 0;

  window.ZARAR_DATA = [];
  window.V2_LOAD_ERROR = false;
  const v2Q = {
    satirSayisi: 0,
    saglamaGecen: 0,
    saglamaGecmeyen: 0,
    zararKayitSayisi: 0,
    zararToplam: 0,
    nakliyeZararToplam: 0,
    atlananSatirTuru: 0,
    eksikHeader: [],
    cutoffAtlanan2026: 0
  };

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
      if (!resp.ok) {
        if (name === "GUNCEL_V2") window.V2_LOAD_ERROR = true;
        window.DEBUG_INFO += name + ": HATA\n"; updateProgress(name); return [];
      }
      const text = await resp.text();

      // ── GUNCEL_V2: header-based parse, gerçek gider modeli ──
      if (name === "GUNCEL_V2") {
        const lines = text.split("\n").map(l => l.trim()).filter(l => l);
        const headers = lines.length > 0 ? parseCSVLine(lines[0]).map(h => h.trim()) : [];
        window.V2_EXPECTED_HEADERS.forEach(h => {
          if (!headers.includes(h)) {
            v2Q.eksikHeader.push(h);
            console.warn("GUNCEL_V2: beklenen kolon eksik → " + h);
          }
        });

        const rows = parseCSV(text);
        window.DEBUG_INFO += "GUNCEL_V2 KOLONLAR: " + headers.join(" | ") + "\n";

        const recs = [];
        rows.forEach((raw, i) => {
          const rec = parseRowV2(raw);
          if (rec.skip) {
            if (rec.sebep === "satirTuru") v2Q.atlananSatirTuru++;
            return;
          }
          if (i < 5) console.log("V2 parse örnek [" + i + "]:", JSON.stringify({c: rec.c, s: rec.s, t: rec.t, d: rec.d, ciro: rec.ciro, net: rec.net, toplamGider: rec.toplamGider, saglamaOK: rec.saglamaOK}));
          v2Q.satirSayisi++;
          if (rec.saglamaOK) v2Q.saglamaGecen++; else { v2Q.saglamaGecmeyen++; console.warn("V2 sağlama HATASI (net+gider≠brüt):", rec.kayitId, rec.satirNo); }
          v2Q.nakliyeZararToplam += rec.giderler.nakliyeZarar;
          if (rec.net <= 0) {
            v2Q.zararKayitSayisi++;
            v2Q.zararToplam += rec.net;
            window.ZARAR_DATA.push(rec);
          } else {
            recs.push(rec);
          }
        });
        window.DEBUG_INFO += "GUNCEL_V2: " + rows.length + " satır, " + recs.length + " analiz, " + v2Q.zararKayitSayisi + " zarar, " + v2Q.atlananSatirTuru + " satırTürü-atlandı\n";
        updateProgress(name);
        return recs;
      }

      // ── Eski model sekmeler (2019–2026) ──
      const rows = parseCSV(text);

      if (rows.length > 0 && (name === "2026" || name === "2025")) {
        const keys = Object.keys(rows[0]);
        window.DEBUG_INFO += name + " KOLONLAR: " + keys.join(" | ") + "\n";
      }

      let count = 0;
      let skipped = 0;
      const recs = [];
      rows.forEach(raw => {
        const rec = normalizeRecord(raw);
        if (!rec) { skipped++; return; }
        // Çift sayım koruması: 2026 sekmesinde V2_CUTOFF ve sonrası SADECE GUNCEL_V2'den gelir
        if (name === "2026" && rec.t >= window.V2_CUTOFF) { v2Q.cutoffAtlanan2026++; skipped++; return; }
        recs.push(rec); count++;
      });
      window.DEBUG_INFO += name + ": " + rows.length + " satır, " + count + " geçerli, " + skipped + " atlandı\n";
      updateProgress(name);
      return recs;
    } catch (e) {
      if (name === "GUNCEL_V2") window.V2_LOAD_ERROR = true;
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
  // Çift sayım doğrulaması: cutoff sonrası tüm satırlar v2 olmalı
  const cutoffViolations = window.ALL_DATA.filter(r => r.t >= window.V2_CUTOFF && r.costModel !== "v2").length;
  v2Q.ciftSayimOK = cutoffViolations === 0;
  if (cutoffViolations > 0) console.warn("ÇİFT SAYIM RİSKİ: " + cutoffViolations + " satır cutoff sonrası ama costModel v2 değil!");

  window._DATA_QUALITY = {
    toplamKayit: window.ALL_DATA.length,
    toplamDemet: totalDemet,
    toplamCiro: Math.round(totalCiro),
    toplamNet: Math.round(totalNet),
    sonGuncelleme: new Date().toLocaleString("tr-TR"),
    enSonTarih: window.ALL_DATA.length > 0 ? window.ALL_DATA.reduce((mx, r) => r.t > mx ? r.t : mx, "") : "",
    v2: v2Q
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
