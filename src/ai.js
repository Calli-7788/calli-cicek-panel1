// ═══════════════ AI CHAT ═══════════════

function setAIQ(q) {
  state.aiQ = q;
  render();
}

async function handleAI() {
  const q = state.aiQ.trim();
  if (!q) return;
  state.aiH.push({ r: "u", t: q });
  state.aiQ = "";
  state.aiL = true;
  render();

  const filtered = getFiltered();
  const stats = calcStats(filtered);
  const hd = getHeatData(filtered);
  const bc = getBranchComp(filtered);
  const yoy = getYoY(filtered);

  // ── Gün bazlı analiz (tüm veriden) ──
  const gunAnaliz = {};
  ALL_DATA.forEach(r => {
    const d = new Date(r.t + "T00:00:00");
    const gun = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"][d.getDay()];
    if (!gunAnaliz[gun]) gunAnaliz[gun] = { net: 0, d: 0, count: 0 };
    gunAnaliz[gun].net += r.net; gunAnaliz[gun].d += r.d; gunAnaliz[gun].count++;
  });
  const gunList = Object.entries(gunAnaliz).map(([g, v]) => ({
    gun: g, dbn: v.d > 0 ? v.net / v.d : 0, d: v.d, mezatSayisi: v.count
  })).sort((a, b) => b.dbn - a.dbn);
  const gunStr = gunList.map(g => g.gun + ": " + fmt(g.dbn) + "/dm (" + g.d + "dm, " + g.mezatSayisi + " satış)").join("; ");

  // ── Önceki mezat karşılaştırması ──
  const rData = getPDFReportData(filtered);
  const prevCompStr = rData.hasPrev ? "Önceki " + rData.prevMezatCount + " mezata göre: Net " + fmt(rData.prevTotalNet) + " → " + fmt(stats.tn) + (rData.prevTotalNet > 0 ? " (" + ((stats.tn - rData.prevTotalNet) / rData.prevTotalNet * 100).toFixed(1) + "%)" : "") : "Önceki mezat verisi yok";

  const ctx = "VERİ (" + fD(state.sd) + "-" + fD(state.ed) + "): Ciro:" + fmt(stats.tc) + ", Net:" + fmt(stats.tn) + ", " + stats.td + "dm, Ort:" + fmt2(stats.av) +
    "\n" + prevCompStr +
    "\nÇiçek(dbn sıralı): " + stats.byF.slice(0, 12).map(f => f.name + ":" + fmt(f.dbn) + "/dm," + f.d + "dm," + fmt(f.net) + "net").join("; ") +
    "\nŞube(net sıralı): " + stats.byB.slice(0, 12).map(b => b.name + ":" + fmt(b.net) + "net," + b.d + "dm," + fmt(b.dbn) + "/dm").join("; ") +
    "\nTopKombo(dbn sıralı): " + hd.slice(0, 12).map(h => h.cicek + "→" + h.sube + ":" + fmt(h.dbn) + "/dm," + h.d + "dm").join("; ") +
    "\nGünlük: " + stats.dl.map(d => fD(d.date) + "(" + ["Paz","Pzt","Sal","Çar","Per","Cum","Cmt"][new Date(d.date+"T00:00:00").getDay()] + "):" + fmt(d.d > 0 ? d.net / d.d : 0) + "/dm," + d.d + "dm," + fmt(d.net) + "net").join("; ") +
    "\nHAFTANIN GÜNLERİ PERFORMANS (tüm veri): " + gunStr +
    (function(){
      var detail = "";
      stats.byF.slice(0,5).forEach(function(f){
        var dayMap = {};
        filtered.filter(function(r){return r.c===f.name}).forEach(function(r){
          if(!dayMap[r.t]) dayMap[r.t]={net:0,d:0};
          dayMap[r.t].net+=r.net; dayMap[r.t].d+=r.d;
        });
        var days = Object.entries(dayMap).sort(function(a,b){return a[0].localeCompare(b[0])}).map(function(e){
          return fD(e[0])+":"+fmt(e[1].d>0?e[1].net/e[1].d:0)+"/dm,"+e[1].d+"dm";
        });
        if(days.length>1) detail += "\n" + f.name + " günlük: " + days.join("; ");
      });
      return detail;
    })() +
    "\nGeçenYıl: " + (yoy.has ? "2025net:" + fmt(yoy.lN) + "," + yoy.lD + "dm,ort" + fmt(yoy.lA) + " → 2026net:" + fmt(yoy.tN) + "," + yoy.tD + "dm,ort" + fmt(yoy.tA) + " değişim:" + (yoy.nCh>0?"+":"") + (yoy.nCh?.toFixed(1)||"—") + "%" : "geçen yıl verisi yok") +
    (function(){
      var data2025 = ALL_DATA.filter(function(r){ return r.t.startsWith("2025") });
      if (data2025.length === 0) return "";
      var detail = "\n\n=== 2025 DETAYLI VERİ ===";
      var fm = {};
      data2025.forEach(function(r){
        if(!fm[r.c]) fm[r.c]={net:0,d:0};
        fm[r.c].net+=r.net; fm[r.c].d+=r.d;
      });
      var fList = Object.entries(fm).map(function(e){return {name:e[0],net:e[1].net,d:e[1].d,dbn:e[1].d>0?e[1].net/e[1].d:0}}).sort(function(a,b){return b.dbn-a.dbn});
      detail += "\n2025 Çiçek(dbn sıralı): " + fList.slice(0,12).map(function(f){return f.name+":"+fmt(f.dbn)+"/dm,"+f.d+"dm,"+fmt(f.net)+"net"}).join("; ");
      var bm = {};
      data2025.forEach(function(r){
        if(!bm[r.s]) bm[r.s]={net:0,d:0};
        bm[r.s].net+=r.net; bm[r.s].d+=r.d;
      });
      var bList = Object.entries(bm).map(function(e){return {name:e[0],net:e[1].net,d:e[1].d,dbn:e[1].d>0?e[1].net/e[1].d:0}}).sort(function(a,b){return b.net-a.net});
      detail += "\n2025 Şube(net sıralı): " + bList.slice(0,12).map(function(b){return b.name+":"+fmt(b.net)+"net,"+b.d+"dm,"+fmt(b.dbn)+"/dm"}).join("; ");
      var mm = {};
      data2025.forEach(function(r){
        var m = r.t.substring(0,7);
        if(!mm[m]) mm[m]={net:0,d:0};
        mm[m].net+=r.net; mm[m].d+=r.d;
      });
      var mList = Object.entries(mm).sort(function(a,b){return a[0].localeCompare(b[0])}).map(function(e){return e[0]+":"+fmt(e[1].net)+"net,"+e[1].d+"dm,ort"+fmt(e[1].d>0?e[1].net/e[1].d:0)+"/dm"});
      detail += "\n2025 Aylık: " + mList.join("; ");
      detail += "\nÇiçek YoY Karşılaştırma: ";
      var now2026 = {};
      filtered.forEach(function(r){if(!now2026[r.c])now2026[r.c]={net:0,d:0};now2026[r.c].net+=r.net;now2026[r.c].d+=r.d});
      var compItems = [];
      fList.forEach(function(f25){
        var f26 = now2026[f25.name];
        if(f26 && f26.d>0){
          var dbn25 = f25.dbn;
          var dbn26 = f26.net/f26.d;
          var ch = dbn25>0?((dbn26-dbn25)/dbn25*100):0;
          compItems.push(f25.name+": 2025="+fmt(dbn25)+"/dm → 2026="+fmt(dbn26)+"/dm ("+(ch>0?"+":"")+ch.toFixed(0)+"%)");
        }
      });
      if(compItems.length>0) detail += compItems.slice(0,10).join("; ");
      return detail;
    })();

  // ── Conversation history (karşılıklı sohbet) ──
  const maxHistory = 6;
  const recentHistory = state.aiH.slice(-maxHistory);
  const apiMessages = [];
  recentHistory.forEach(m => {
    if (m.r === "u") apiMessages.push({ role: "user", content: m.t });
    else apiMessages.push({ role: "assistant", content: m.t });
  });
  apiMessages.push({ role: "user", content: q });

  try {
    const systemPrompt = "Sen Çallı Çiçek için çalışan kıdemli bir kesme çiçek mezat analisti ve gönderim danışmanısın.\n\n" +
      "== KULLANICI PROFİLİ ==\n" +
      "Yalova'da kesme çiçek üreticisi. Flora mezatına (Hollanda tipi açık artırma) çiçek gönderiyor.\n" +
      "31.07.2026'dan itibaren gerçek satır bazlı gider verisi kullanılır (Bağkur, Borsa, Hamaliye, Koop, Nakliye, Stopaj). Öncesi %20 tahmini modeldir. Gerçek kesinti oranı satır büyüklüğüne göre %22-46 arasında değişir; küçük sevkiyatlarda nakliye payı yüksektir.\n\n" +
      "== KRİTİK SEKTÖR BİLGİSİ ==\n" +
      "1. KESme çiçek üretiminde STOK ARTIRILMAZ/AZALTILMAZ anlık olarak. Dikim sezonluk (aylar öncesinden planlanır), hasat günlük. Üretici bugün elinde ne varsa onu gönderir.\n" +
      "2. Asla 'stok artır', 'üretimi artır', 'daha fazla ek' gibi kısa vadeli üretim önerileri VERME. Bunun yerine GÖNDERİM STRATEJİSİ öner: hangi şubeye, hangi gün, hangi kombinasyonda.\n" +
      "3. Orta/uzun vade için (gelecek sezon dikimi) üretim önerisi verebilirsin ama bunu açıkça 'gelecek sezon için' diye belirt.\n" +
      "4. Mezat günleri genelde Pazartesi, Çarşamba, Cuma ama değişebilir. Haftanın günlerine göre fiyat farkları önemli.\n" +
      "5. Kutu başına 8-40 demet. Karışık çiçek bir kutuya konabilir.\n" +
      "6. Şubelerde açık artırma ile satılıyor — sıra numarası kura ile belirlenir, üreticinin kontrolünde değil.\n\n" +
      "== CEVAP FORMATI ==\n" +
      "Her operasyonel cevabını şu 4 blokla yapılandır:\n" +
      "📌 **Sonuç:** 1-2 cümle net cevap\n" +
      "📊 **Gerekçe:** Hangi veriye dayanıyor, neden böyle öneriyorsun\n" +
      "⚠ **Risk:** Dikkat edilmesi gereken nokta veya belirsizlik\n" +
      "🎯 **Aksiyon:** Somut yapılacak iş (şube, kutu sayısı, gün)\n\n" +
      "== GÜNLÜK BRİFİNG FORMATI ==\n" +
      "'Bugün ne yapmalıyım' veya günlük brifing sorulunca HER ZAMAN şu 5 alanı ver:\n" +
      "1. 🏆 Bugün öne çıkan şube ve neden\n" +
      "2. 🌷 Bugün öne çıkan çiçek ve dm başı net\n" +
      "3. ⚠ Dikkat edilmesi gereken risk veya düşüş\n" +
      "4. 🚫 Kaçınılacak kombinasyon varsa belirt\n" +
      "5. 🎯 1 cümlelik net aksiyon önerisi\n\n" +
      "== TAHMİN KURALLARI ==\n" +
      "Gelecek tahminlerinde kesin dil KULLANMA. Şu ifadeleri tercih et:\n" +
      "- 'muhtemel', 'zayıf/orta/güçlü sinyal', 'geçmiş örüntüye göre'\n" +
      "- Güven seviyesini her zaman belirt: düşük/orta/yüksek\n" +
      "- 'Yüksek belirsizlik' durumlarında açıkça söyle\n\n" +
      "== HESAPLAMA KURALI ==\n" +
      "Kendi kafana göre rakam üretme. Verilen verideki rakamları kullan.\n" +
      "Fiyat verirken dm başı net kullan, brüt ile karıştırma.\n" +
      "Türkçe cevap ver. Markdown **kalın** kullanabilirsin.\n\n" +
      "== VERİLER ==\n" + ctx;

    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: systemPrompt,
        messages: apiMessages
      })
    });
    const data = await resp.json();
    if (data.error) {
      state.aiH.push({ r: "a", t: "⚠ API Hatası: " + (data.error.message || data.error) + "\n\nYerel analiz:\n" + localAnswer(q, stats, bc, hd, yoy) });
    } else if (data.content && data.content.length > 0) {
      const ans = data.content.map(b => b.text || "").join("\n");
      state.aiH.push({ r: "a", t: ans || localAnswer(q, stats, bc, hd, yoy) });
    } else {
      state.aiH.push({ r: "a", t: localAnswer(q, stats, bc, hd, yoy) });
    }
  } catch (e) {
    state.aiH.push({ r: "a", t: "⚠ Bağlantı hatası. Yerel analiz:\n\n" + localAnswer(q, stats, bc, hd, yoy) });
  }
  state.aiL = false;
  render();
}

function localAnswer(q, stats, bc, hd, yoy) {
  const ql = q.toLowerCase();

  // ── Bugün ne yapmalıyım / Günlük brifing ──
  if (ql.includes("bugün") || ql.includes("ne yapmalı") || ql.includes("brifing")) {
    let ans = "☀ **Günlük Brifing**\n\n";
    ans += "**Dönem:** " + fD(state.sd) + (state.sd !== state.ed ? " – " + fD(state.ed) : "") + "\n";
    ans += "**Net Gelir:** " + fmt(stats.tn) + " | **Demet:** " + stats.td + " | **Ort:** " + fmt2(stats.av) + "/dm\n\n";
    if (stats.byF.length > 0) {
      ans += "**En kârlı gönderim önerisi:**\n";
      hd.slice(0, 5).forEach((h, i) => { ans += (i+1) + ". " + h.cicek + " → **" + h.sube + "**: " + fmt(h.dbn) + "/dm (" + h.d + "dm)\n"; });
      ans += "\n**Kaçınılacak kombinasyonlar:**\n";
      hd.slice(-2).forEach(h => { ans += "⚠ " + h.cicek + " → " + h.sube + ": " + fmt(h.dbn) + "/dm — düşük getiri\n"; });
    }
    return ans;
  }

  // ── Haftalık özet ──
  if (ql.includes("haftalık") || ql.includes("hafta özet") || ql.includes("bu haftayı")) {
    let ans = "📊 **Haftalık Özet**\n\n";
    ans += "**Net Gelir:** " + fmt(stats.tn) + "\n**Demet:** " + stats.td + "\n**Ort. Dm Başı Net:** " + fmt2(stats.av) + "\n\n";
    ans += "**En iyi 3 çiçek:**\n";
    stats.byF.slice(0, 3).forEach((f, i) => { ans += (i+1) + ". **" + f.name + "** — " + fmt(f.dbn) + "/dm (" + f.d + "dm, " + fmt(f.net) + " net)\n"; });
    ans += "\n**En iyi 3 şube:**\n";
    stats.byB.slice(0, 3).forEach((b, i) => { ans += (i+1) + ". **" + b.name + "** — " + fmt(b.net) + " net (" + b.d + "dm)\n"; });
    if (stats.byF.length > 3) {
      ans += "\n**Dikkat:** " + stats.byF.slice(-1)[0].name + " en düşük performans (" + fmt(stats.byF.slice(-1)[0].dbn) + "/dm) — bu çiçeği düşük fiyatlı şubelerden çek.\n";
    }
    return ans;
  }

  // ── Gelecek hafta tahmini ──
  if (ql.includes("gelecek") || ql.includes("tahmin") || ql.includes("önümüzdeki")) {
    let ans = "🔮 **Gelecek Hafta Tahmini**\n\n";
    if (stats.dl.length >= 2) {
      const f = stats.dl[0], l = stats.dl[stats.dl.length - 1];
      const fDbn = f.d > 0 ? f.net / f.d : 0, lDbn = l.d > 0 ? l.net / l.d : 0;
      const ch = fDbn > 0 ? ((lDbn - fDbn) / fDbn * 100) : 0;
      ans += "**Mevcut trend:** " + (ch > 0 ? "▲ Yükseliş" : ch < 0 ? "▼ Düşüş" : "→ Stabil") + " (" + (ch > 0 ? "+" : "") + ch.toFixed(1) + "%)\n\n";
      if (ch > 5) ans += "Fiyatlar yükselişte. Gönderim miktarını koruyabilirsin, en kârlı şubelere ağırlık ver.\n";
      else if (ch < -5) ans += "Fiyatlar düşüşte. Dikkatli ol, düşük performanslı şubelerden çek, az ama kârlı gönder.\n";
      else ans += "Fiyatlar stabil. Normal gönderim planına devam et.\n";
    }
    if (yoy.has) {
      ans += "\n**Geçen yıl bu dönem:** Net " + fmt(yoy.lN) + " (" + yoy.lD + "dm, " + fmt(yoy.lA) + "/dm)\n";
      ans += "**Bu yıl:** Net " + fmt(yoy.tN) + " (" + yoy.tD + "dm, " + fmt(yoy.tA) + "/dm)\n";
      ans += yoy.nCh > 0 ? "Geçen yıla göre **+" + yoy.nCh.toFixed(0) + "%** ileride.\n" : "Geçen yıla göre **" + yoy.nCh?.toFixed(0) + "%** geride.\n";
    }
    ans += "\n_Not: Bu trend bazlı tahmindir. Kesme çiçek piyasası hava durumu, tatiller ve talep değişimlerine göre dalgalanabilir._";
    return ans;
  }

  // ── Hangi gün göndermeli ──
  if (ql.includes("gün") || ql.includes("pazartesi") || ql.includes("salı") || ql.includes("hangi gün") || ql.includes("çarşamba") || ql.includes("cuma")) {
    const gunler = {};
    ALL_DATA.forEach(r => {
      const d = new Date(r.t + "T00:00:00");
      const gun = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"][d.getDay()];
      if (!gunler[gun]) gunler[gun] = { net: 0, d: 0, days: new Set() };
      gunler[gun].net += r.net; gunler[gun].d += r.d; gunler[gun].days.add(r.t);
    });
    const gunList = Object.entries(gunler).map(([g, v]) => ({
      gun: g, dbn: v.d > 0 ? v.net / v.d : 0, d: v.d, mezatGunu: v.days.size
    })).sort((a, b) => b.dbn - a.dbn);

    let ans = "📅 **Haftanın Günleri Analizi** (tüm veriler)\n\n";
    gunList.forEach((g, i) => {
      const icon = i === 0 ? "🏆" : i === gunList.length - 1 ? "⚠" : "  ";
      ans += icon + " **" + g.gun + "**: " + fmt(g.dbn) + "/dm (" + g.d + " demet, " + g.mezatGunu + " mezat günü)\n";
    });
    const best = gunList[0], worst = gunList[gunList.length - 1];
    if (best && worst && best.dbn > worst.dbn) {
      const diff = ((best.dbn - worst.dbn) / worst.dbn * 100);
      ans += "\n**Sonuç:** " + best.gun + " günü " + worst.gun + "'e göre **%" + diff.toFixed(0) + " daha kârlı**.\n";
      ans += "Elinden geldiğince **" + best.gun + "** günü daha fazla mal yetiştirmeye çalış.";
    }
    return ans;
  }

  // ── Şube karşılaştır ──
  if (ql.includes("şube") || ql.includes("nereye") || ql.includes("göndermeli") || ql.includes("gonder") || ql.includes("karşılaştır"))
    return "📍 **Şube Önerisi:**\n\n" + bc.slice(0, 5).map(c => "**" + c.flower + ":**\n" + c.branches.slice(0, 3).map((b, i) => "  " + (i === 0 ? "🏆" : "  ") + " " + b.name + ": " + fmt(b.dbn) + "/dm net (" + b.d + "dm)").join("\n")).join("\n\n");

  // ── Kombo ──
  if (ql.includes("kombo") || ql.includes("kârlı") || ql.includes("karli"))
    return "💰 **En Kârlı 5 Kombinasyon:**\n\n" + hd.slice(0, 5).map((h, i) => (i + 1) + ". **" + h.cicek + "** → **" + h.sube + "**: " + fmt(h.dbn) + "/dm (" + h.d + "dm)").join("\n");

  // ── Özet ──
  if (ql.includes("özetle") || ql.includes("özet") || ql.includes("durum"))
    return "📊 **Dönem Özeti:**\n\n• Net Gelir: **" + fmt(stats.tn) + "**\n• " + stats.td + " demet | Ort: " + fmt2(stats.av) + "/dm\n\nEn kârlı 3 çiçek:\n" + stats.byF.slice(0,3).map((f,i)=>(i+1)+". **"+f.name+"** — "+fmt(f.dbn)+"/dm ("+f.d+"dm)").join("\n") + "\n\nEn iyi 3 şube:\n" + stats.byB.slice(0,3).map((b,i)=>(i+1)+". **"+b.name+"** — "+fmt(b.net)+" net").join("\n");

  // ── Trend ──
  if (ql.includes("trend") || ql.includes("fiyat") || ql.includes("yüksel") || ql.includes("düş")) {
    if (stats.dl.length < 2) return "En az 2 gün seç.";
    const f = stats.dl[0], l = stats.dl[stats.dl.length - 1];
    const fDbn = f.d > 0 ? f.net / f.d : 0, lDbn = l.d > 0 ? l.net / l.d : 0;
    const ch = fDbn > 0 ? ((lDbn - fDbn) / fDbn * 100) : 0;
    return "📈 **Fiyat Trendi (net/dm):**\n\n" + fD(f.date) + ": " + fmt(fDbn) + "/dm → " + fD(l.date) + ": " + fmt(lDbn) + "/dm\nDeğişim: **" + (ch > 0 ? "+" : "") + ch.toFixed(1) + "%**\n\n" + (ch > 0 ? "Fiyatlar yükselişte, gönderim stratejini koru." : "Fiyatlar düşüşte, düşük şubelerden çek.");
  }

  // ── Geçen yıl ──
  if (ql.includes("geçen yıl") || ql.includes("2025"))
    return yoy.has ? "📊 **Geçen Yıl Karşılaştırması:**\n\n2025: " + fmt(yoy.lN) + " net (" + yoy.lD + "dm, " + fmt(yoy.lA) + "/dm)\n2026: " + fmt(yoy.tN) + " net (" + yoy.tD + "dm, " + fmt(yoy.tA) + "/dm)\n\nNet Gelir: **" + (yoy.nCh>0?"+":"") + (yoy.nCh?.toFixed(1)||"—") + "%**\nDm Başı: **" + (yoy.pCh>0?"+":"") + (yoy.pCh?.toFixed(1)||"—") + "%**" : "Geçen yıl verisi yok.";

  // ── Kötü performans ──
  if (ql.includes("kötü") || ql.includes("düşük") || ql.includes("kazandırmıyor"))
    return "⚠ **Düşük Performans:**\n\n" + stats.byF.slice(-3).reverse().map((f,i)=>(i+1)+". **"+f.name+"** — "+fmt(f.dbn)+"/dm ("+f.d+"dm, "+fmt(f.net)+" net)").join("\n") + "\n\n**Öneri:** Bu çiçekleri düşük fiyatlı şubelerden çek, sadece en iyi fiyat veren 1-2 şubeye gönder.";

  // Default
  return "🌸 **Genel Durum:**\n\n• Net Gelir: **" + fmt(stats.tn) + "** | " + stats.td + " demet\n• Ort: " + fmt2(stats.av) + "/dm\n• En kârlı: **" + (stats.byF[0]?.name || "—") + "** (" + fmt(stats.byF[0]?.dbn || 0) + "/dm)\n• En iyi şube: **" + (stats.byB[0]?.name || "—") + "**\n\nSorabileceğin sorular:\n• ☀ Bugün ne yapmalıyım?\n• 📅 Hangi gün göndermeli?\n• 📊 Haftalık özet\n• 🔮 Gelecek hafta tahmini\n• 💰 En kârlı kombo?";
}
