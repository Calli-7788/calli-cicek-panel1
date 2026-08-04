// ═══════════════ CONFIG ═══════════════
// Cost Model V2: 31.07.2026 ve sonrası GUNCEL_V2'den gelir (gerçek satır bazlı gider).
// Eski GUNCEL (gid=1698698520) artık "2026" adıyla yüklenir; V2_CUTOFF ve sonrası satırları atlanır (çift sayım koruması).
// GIDERLER_V2 (gid=97268542) ve KONTROL_V2 (gid=1085263022) ÇEKİLMİYOR — GUNCEL_V2 satır bazında her şeyi içeriyor (ileride gerekebilir).
window.SHEETS = {
  "GUNCEL_V2": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTgQxEITteEVPQ0eoOaHXgOPe1DSB08I1LE0BTkbUmwHjrDDQJrM9eEXCXP2ubSgSe-Lm0_5OBmzrdI/pub?gid=832972296&single=true&output=csv",
  "2026": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTgQxEITteEVPQ0eoOaHXgOPe1DSB08I1LE0BTkbUmwHjrDDQJrM9eEXCXP2ubSgSe-Lm0_5OBmzrdI/pub?gid=1698698520&single=true&output=csv",
  "2025": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTgQxEITteEVPQ0eoOaHXgOPe1DSB08I1LE0BTkbUmwHjrDDQJrM9eEXCXP2ubSgSe-Lm0_5OBmzrdI/pub?gid=1807975712&single=true&output=csv",
  "2024": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTgQxEITteEVPQ0eoOaHXgOPe1DSB08I1LE0BTkbUmwHjrDDQJrM9eEXCXP2ubSgSe-Lm0_5OBmzrdI/pub?gid=2134869114&single=true&output=csv",
  "2023": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTgQxEITteEVPQ0eoOaHXgOPe1DSB08I1LE0BTkbUmwHjrDDQJrM9eEXCXP2ubSgSe-Lm0_5OBmzrdI/pub?gid=1233420715&single=true&output=csv",
  "2022": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTgQxEITteEVPQ0eoOaHXgOPe1DSB08I1LE0BTkbUmwHjrDDQJrM9eEXCXP2ubSgSe-Lm0_5OBmzrdI/pub?gid=2101024407&single=true&output=csv",
  "2021": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTgQxEITteEVPQ0eoOaHXgOPe1DSB08I1LE0BTkbUmwHjrDDQJrM9eEXCXP2ubSgSe-Lm0_5OBmzrdI/pub?gid=1029922677&single=true&output=csv",
  "2020": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTgQxEITteEVPQ0eoOaHXgOPe1DSB08I1LE0BTkbUmwHjrDDQJrM9eEXCXP2ubSgSe-Lm0_5OBmzrdI/pub?gid=1123710546&single=true&output=csv",
  "2019": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTgQxEITteEVPQ0eoOaHXgOPe1DSB08I1LE0BTkbUmwHjrDDQJrM9eEXCXP2ubSgSe-Lm0_5OBmzrdI/pub?gid=1514448223&single=true&output=csv"
};

window.GIDER = 0.20;

// V2 kesim tarihi: bu tarih (dahil) ve sonrası SADECE GUNCEL_V2'den okunur
window.V2_CUTOFF = "2026-07-31";

// Marjinal tahsis doygunluk çarpanları (Planlayıcı Evrimi — Faz B)
// atanan ≤ median → 1.00 | median–P75 lineer → 0.85 | P75–max lineer → 0.70 | > max → kombo kapanır
window.PLANNER_SATURATION = { medianCarpan: 1.0, p75Carpan: 0.85, maxCarpan: 0.70 };

// ═══════════════ MEVSİMSELLİK ═══════════════
window.OZEL_GUNLER = [
  { tarih: "01-01", ad: "Yılbaşı", oncesi: 7 },
  { tarih: "02-14", ad: "Sevgililer Günü", oncesi: 7 },
  { tarih: "03-08", ad: "Dünya Kadınlar Günü", oncesi: 5 },
  { tarih: "04-23", ad: "23 Nisan", oncesi: 3 },
  { tarih: "05-01", ad: "1 Mayıs", oncesi: 2 },
  { tarih: "05-19", ad: "19 Mayıs", oncesi: 2 },
  { tarih: "08-30", ad: "30 Ağustos", oncesi: 2 },
  { tarih: "10-29", ad: "Cumhuriyet Bayramı", oncesi: 3 },
  { tarih: "11-10", ad: "10 Kasım", oncesi: 2 },
  { tarih: "11-24", ad: "Öğretmenler Günü", oncesi: 5 },
  { tarih: "12-31", ad: "Yılbaşı Gecesi", oncesi: 7 }
];

// Dini bayramlar — her yıl ~10-11 gün geriye kayar (Hicri takvim)
window.DINI_BAYRAMLAR = {
  "ramazan": { ad: "Ramazan Bayramı", oncesi: 7, tarihler: {
    "2019":"2019-06-04","2020":"2020-05-24","2021":"2021-05-13","2022":"2022-05-02",
    "2023":"2023-04-21","2024":"2024-04-10","2025":"2025-03-30","2026":"2026-03-20"
  }},
  "kurban": { ad: "Kurban Bayramı", oncesi: 5, tarihler: {
    "2019":"2019-08-11","2020":"2020-07-31","2021":"2021-07-20","2022":"2022-07-09",
    "2023":"2023-06-28","2024":"2024-06-17","2025":"2025-06-06","2026":"2026-05-27"
  }}
};

// Anneler Günü: Mayıs'ın 2. Pazarı — her yıl değişir, dinamik hesaplanır
window.getAnnelerGunu = function(yil) {
  const mayis1 = new Date(yil, 4, 1);
  const gun = mayis1.getDay();
  const ilkPazar = gun === 0 ? 1 : 8 - gun;
  const ikinciPazar = ilkPazar + 7;
  return yil + "-05-" + String(ikinciPazar).padStart(2, "0");
};

// TÜFE çarpan tablosu (2019=100 bazında yaklaşık kümülatif TÜFE)
window.TUFE = {"2019":1,"2020":1.15,"2021":1.55,"2022":3.15,"2023":4.90,"2024":7.35,"2025":9.20,"2026":10.50};
