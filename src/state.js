// ═══════════════ GLOBAL DATA VARIABLES ═══════════════
window.ALL_DATA = [];
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
  riskGruplar: null
};

function setState(updates) {
  Object.assign(state, updates);
  render();
}

// toggleExp → render.js'de tanımlı (render() gerekli)

// ═══════════════ DEBUG ═══════════════
window.DEBUG_INFO = "";
