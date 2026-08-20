// ═══════════════ TEDİYE (Flora ödeme takibi) ═══════════════
// Satış dönemi: Perşembe 00:00 → Çarşamba 23:59 (7 gün).
// Ödeme: dönem bitişi Çarşamba + 26 gün = Pazartesi (hesaba genelde ertesi gün Salı yansır).
// KRİTİK: sadece V2 satırları; ZARAR_DATA DAHİL (tediye gerçek para hesabıdır —
// Flora zarar tutarını ödemeden düşer); hesap bazlı (4675/5994); üst tarih filtresinden BAĞIMSIZ.

// Bir satış tarihinin ait olduğu dönemin başlangıcı: o tarihten geriye en yakın Perşembe
function donemBaslangici(tarihISO) {
  var d = new Date(tarihISO + "T12:00:00");
  var fark = (d.getDay() - 4 + 7) % 7;   // Per=4
  d.setDate(d.getDate() - fark);
  return d;
}

function _tediyeISO(d) { return d.toISOString().split("T")[0]; }

// V2 satırlarını (ALL_DATA + ZARAR_DATA) tediye dönemlerine gruplar — yeniden eskiye sıralı
function getTediyeDonemleri() {
  var v2rows = ALL_DATA.filter(function(r){ return r.costModel === "v2" }).concat(window.ZARAR_DATA || []);
  var durumKayit = JSON.parse(localStorage.getItem("tediyeDurum") || "{}");
  var bugun = new Date().toISOString().split("T")[0];

  var donemler = {};
  v2rows.forEach(function(r) {
    var bas = donemBaslangici(r.t);
    var basISO = _tediyeISO(bas);
    var bitis = new Date(bas.getTime()); bitis.setDate(bitis.getDate() + 6);
    var bitisISO = _tediyeISO(bitis);
    if (!donemler[bitisISO]) {
      var odeme = new Date(bitis.getTime()); odeme.setDate(odeme.getDate() + 26);
      donemler[bitisISO] = {
        baslangic: basISO, bitis: bitisISO, odemeTarihi: _tediyeISO(odeme),
        devamEdiyor: bitisISO >= bugun,
        hesaplar: {}, toplamNet: 0, toplamSatir: 0, zararSayisi: 0, zararToplam: 0
      };
    }
    var dn = donemler[bitisISO];
    var h = r.hesapNo || "?";
    if (!dn.hesaplar[h]) dn.hesaplar[h] = { net: 0, satirSayisi: 0, zararSayisi: 0, zararToplam: 0 };
    dn.hesaplar[h].net += r.net;
    dn.hesaplar[h].satirSayisi++;
    if (r.net <= 0) {
      dn.hesaplar[h].zararSayisi++; dn.hesaplar[h].zararToplam += r.net;
      dn.zararSayisi++; dn.zararToplam += r.net;
    }
    dn.toplamNet += r.net;
    dn.toplamSatir++;
  });

  return Object.values(donemler).map(function(dn) {
    dn.durum = {};
    Object.keys(dn.hesaplar).forEach(function(h) {
      var k = dn.bitis + "|" + h;
      if (durumKayit[k]) dn.durum[h] = durumKayit[k];
    });
    return dn;
  }).sort(function(a, b) { return b.bitis.localeCompare(a.bitis) });
}

// Ödeme durumunu kaydeder; durum=null geri alır (yanlış işaretleme düzeltmesi)
function setTediyeDurum(donemBitis, hesapNo, durum, gercekTutar) {
  var kayit = JSON.parse(localStorage.getItem("tediyeDurum") || "{}");
  var k = donemBitis + "|" + hesapNo;
  if (durum === null) {
    delete kayit[k];
  } else {
    kayit[k] = {
      durum: durum,
      gercekTutar: (gercekTutar == null || gercekTutar === "") ? null : parseFloat(String(gercekTutar).replace(",", ".")),
      isaretTarihi: new Date().toISOString()
    };
  }
  localStorage.setItem("tediyeDurum", JSON.stringify(kayit));
  state.tediyeForm = null;
  render();
}

// UI yardımcıları
function tediyeFormAc(donemBitis, hesapNo) {
  state.tediyeForm = donemBitis + "|" + hesapNo;
  render();
}
function tediyeFarkliKaydet(donemBitis, hesapNo) {
  var el = document.getElementById("tediyeTutarInput");
  var v = el ? el.value : "";
  if (!v) { alert("Tutar gir veya 'Beklenenle aynı' seç."); return; }
  setTediyeDurum(donemBitis, hesapNo, "geldi", v);
}
