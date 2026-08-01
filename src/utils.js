// ═══════════════ HELPERS ═══════════════
window.fmt = n => n != null ? new Intl.NumberFormat("tr-TR",{maximumFractionDigits:0}).format(n)+" ₺" : "—";
window.fmt2 = n => n != null ? new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)+" ₺" : "—";
window.fD = s => { try { return new Date(s+"T00:00:00").toLocaleDateString("tr-TR",{day:"numeric",month:"short"}) } catch(e) { return s }};
window.fDF = s => { try { return new Date(s+"T00:00:00").toLocaleDateString("tr-TR",{day:"numeric",month:"long",year:"numeric"}) } catch(e) { return s }};
window.trendHTML = v => { if(v==null)return ""; const n=parseFloat(v); return `<span class="${n>0?'trend-up':'trend-down'}">${n>0?'▲ +':'▼ '}${Math.abs(n).toFixed(1)}%</span>` };
window.esc = s => s ? s.replace(/</g,"&lt;").replace(/>/g,"&gt;") : "";

// ═══════════════ WEEK NUMBER ═══════════════
window.getWeekNumber = function(d) {
  const date = new Date(d.getTime());
  date.setHours(0,0,0,0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 864e5 - 3 + (week1.getDay() + 6) % 7) / 7);
};
