// ═══════════════ GLOBAL DATA VARIABLES ═══════════════
window.ALL_DATA = [];
window.ZARAR_DATA = [];  // V2: net <= 0 satırlar (analize girmez, ayrı zarar sayacı)
window.V2_LOAD_ERROR = false;  // GUNCEL_V2 fetch başarısızsa true → header'da uyarı bandı
window.FLOWERS = [];
window.BRANCHES = [];
window.CICEK_GROUPS = {};
window.GROUP_NAMES = [];

// ═══════════════ STATE ═══════════════
window.state = {
  tab: "panel",
  sd: new Date().toISOString().split("T")[0],
  ed: new Date().toISOString().split("T")[0],
  sf: null, sb: null,
  fo: false,
  hmSort: "net",
  expanded: {},
  aiQ: "", aiH: [], aiL: false,
  ddOpen: null,
  chartOpen: null,
  // Planner
  planFlowers: [],
  planBoxSize: 8,
  planStrategy: "safe",
  planBranchMode: "auto", // "auto", "manual", "explore"
  planManualBranches: [], // selected branch names for manual mode
  planResult: null,
  planLoading: false,
  mevsimSearch: "",
  mevsimFilter: "aktif",
  mevsimDetail: null,
  caSecim: null,
  caSearch: "",
  riskGruplar: null,
  giderSube: null  // Giderler sekmesi böl.4 şube filtresi
};

function setState(updates) {
  Object.assign(state, updates);
  render();
}

// toggleExp → render.js'de tanımlı (render() gerekli)

// ═══════════════ DEBUG ═══════════════
window.DEBUG_INFO = "";
