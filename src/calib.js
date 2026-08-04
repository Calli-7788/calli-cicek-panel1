// ═══════════════ KALİBRASYON (Planlayıcı Evrimi — Faz A) ═══════════════
// Plan tahmin/gerçek kırılımı + MAE/MAPE/Bias panosu hesapları.
// Şema v2 dual-write: yeni kayıtlar hem eski (date/flowers/strategy/estimatedNet)
// hem yeni (tarih/cicekler/strateji/tahminiToplamNet) alanları taşır;
// schemaVersion alanı olmayan kayıt = eski şema, motorNesli yoksa "klasik" sayılır.

// Plan tarihinden sonraki 1-3 gün içindeki ilk mezat gününü bulur (mevcut gerçekleşen kuralı),
// yoksa aynı güne bakar. Çiçek × şube kırılımını üretir.
function buildGerceklesenKirilim(plan) {
  var planTarih = plan.tarih || plan.date;
  if (!planTarih) return null;
  var cicekler = (plan.cicekler || plan.flowers || []).map(function(f){ return { ad: f.ad || f.name, demet: f.demet }; });
  if (cicekler.length === 0) return null;

  var actualData = [], eslesmeTarihi = null;
  for (var off = 1; off <= 3; off++) {
    var d = new Date(planTarih + "T00:00:00");
    d.setDate(d.getDate() + off);
    var ds = d.toISOString().split("T")[0];
    var dayData = ALL_DATA.filter(function(r){ return r.t === ds });
    if (dayData.length > 0) { actualData = dayData; eslesmeTarihi = ds; break; }
  }
  if (actualData.length === 0) {
    actualData = ALL_DATA.filter(function(r){ return r.t === planTarih });
    if (actualData.length > 0) eslesmeTarihi = planTarih;
  }
  if (actualData.length === 0) return null;

  var dagilim = plan.dagilim || [];
  var toplamNet = 0, toplamD = 0;
  var kirilim = [];

  cicekler.forEach(function(cf) {
    var fRows = actualData.filter(function(r){ return r.c === cf.ad });
    toplamNet += fRows.reduce(function(s,r){return s+r.net},0);
    toplamD += fRows.reduce(function(s,r){return s+r.d},0);

    var bySube = {};
    fRows.forEach(function(r){
      if (!bySube[r.s]) bySube[r.s] = {net:0,d:0};
      bySube[r.s].net += r.net; bySube[r.s].d += r.d;
    });

    Object.entries(bySube).forEach(function(e){
      var gd = e[1].d, gn = e[1].net;
      var gdbn = gd > 0 ? gn / gd : 0;
      var pl = dagilim.find(function(x){ return x.cicek === cf.ad && x.sube === e[0] });
      kirilim.push({
        cicek: cf.ad, sube: e[0],
        planDemet: pl ? pl.demet : null,
        tahminiDbn: pl ? pl.tahminiDbn : null,
        gercekDemet: gd, gercekNet: gn, gercekDbn: gdbn,
        fiyatHatasiPct: (pl && pl.tahminiDbn > 0 && gdbn > 0) ? ((pl.tahminiDbn - gdbn) / gdbn * 100) : null,
        miktarHatasiPct: (pl && gd > 0) ? ((pl.demet - gd) / gd * 100) : null
      });
    });

    // Planda olup o gün hiç satışı görünmeyen kombolar (önemli sinyal)
    dagilim.filter(function(x){ return x.cicek === cf.ad && !bySube[x.sube] }).forEach(function(pl){
      kirilim.push({
        cicek: cf.ad, sube: pl.sube,
        planDemet: pl.demet, tahminiDbn: pl.tahminiDbn,
        gercekDemet: 0, gercekNet: 0, gercekDbn: 0,
        fiyatHatasiPct: null, miktarHatasiPct: null
      });
    });
  });

  return {
    eslesmeTarihi: eslesmeTarihi,
    toplam: { net: toplamNet, demet: toplamD, dbn: toplamD > 0 ? toplamNet / toplamD : 0 },
    kirilim: kirilim,
    uyum: (plan.gerceklesen && plan.gerceklesen.uyum) || null
  };
}

// "Plana uyuldu mu?" cevabını kayda işler (gerçekleşen kırılımla birlikte kalıcılaşır)
function setPlanUyum(index, value) {
  var savedPlans = JSON.parse(localStorage.getItem("savedPlans") || "[]");
  if (index < 0 || index >= savedPlans.length) return;
  var plan = savedPlans[index];
  var g = buildGerceklesenKirilim(plan);
  if (!g) { alert("Gerçekleşen mezat verisi henüz yok."); return; }
  g.uyum = value;
  plan.gerceklesen = g;
  savedPlans[index] = plan;
  localStorage.setItem("savedPlans", JSON.stringify(savedPlans));
  render();
}

// Kalibrasyon panosu metrikleri: MAE (₺), MAPE (%), Bias (% işaretli, + = fazla tahmin),
// motor nesli kıyası (klasik vs marjinal), çiçek/şube bazlı bias (n≥5, en sapmalı 5'er)
function getKalibrasyon() {
  var plans = JSON.parse(localStorage.getItem("savedPlans") || "[]");
  var genel = [];
  var cicekH = {}, subeH = {};

  plans.forEach(function(p) {
    var tahmin = (p.tahminiToplamNet != null ? p.tahminiToplamNet : p.estimatedNet) || 0;
    if (tahmin <= 0) return;
    var g = (p.gerceklesen && p.gerceklesen.toplam) ? p.gerceklesen : buildGerceklesenKirilim(p);
    if (!g || !g.toplam || g.toplam.net <= 0) return;
    var pct = (tahmin - g.toplam.net) / g.toplam.net * 100;
    genel.push({ pct: pct, absErr: Math.abs(tahmin - g.toplam.net), motor: p.motorNesli || "klasik" });
    (g.kirilim || []).forEach(function(k) {
      if (k.fiyatHatasiPct == null) return;
      if (!cicekH[k.cicek]) cicekH[k.cicek] = [];
      cicekH[k.cicek].push(k.fiyatHatasiPct);
      if (!subeH[k.sube]) subeH[k.sube] = [];
      subeH[k.sube].push(k.fiyatHatasiPct);
    });
  });

  var n = genel.length;
  if (n === 0) return { yetersiz: true, n: 0 };

  var mean = function(a){ return a.reduce(function(s,x){return s+x},0) / a.length; };
  var biasList = function(h) {
    return Object.entries(h).filter(function(e){ return e[1].length >= 5 })
      .map(function(e){ return { ad: e[0], n: e[1].length, bias: mean(e[1]) }; })
      .sort(function(a,b){ return Math.abs(b.bias) - Math.abs(a.bias); }).slice(0, 5);
  };

  var out = {
    yetersiz: false, n: n,
    mae: mean(genel.map(function(g){ return g.absErr })),
    mape: mean(genel.map(function(g){ return Math.abs(g.pct) })),
    bias: mean(genel.map(function(g){ return g.pct })),
    motorlar: {},
    cicekBias: biasList(cicekH),
    subeBias: biasList(subeH)
  };
  ["klasik", "marjinal"].forEach(function(m) {
    var grp = genel.filter(function(g){ return g.motor === m });
    if (grp.length >= 3) {
      out.motorlar[m] = { n: grp.length, mape: mean(grp.map(function(g){ return Math.abs(g.pct) })), bias: mean(grp.map(function(g){ return g.pct })) };
    } else {
      out.motorlar[m] = { n: grp.length, yetersiz: true };
    }
  });
  return out;
}
