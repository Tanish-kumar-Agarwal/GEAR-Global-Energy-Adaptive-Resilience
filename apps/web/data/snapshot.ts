// HACKATHON SNAPSHOT DATASET

export const HACKATHON_TOP_RISKS = [
  { id: 'R1', rank: 1, event: 'Strait of Hormuz', index: 96, probability: 'Very High', disruption: 'Extreme', impact: 'Energy + chemicals + logistics' },
  { id: 'R2', rank: 2, event: 'China export controls', index: 91, probability: 'High', disruption: 'Very High', impact: 'Electronics + EV + defense + manufacturing' },
  { id: 'R3', rank: 3, event: 'Red Sea shipping disruption', index: 87, probability: 'Very High', disruption: 'High', impact: 'Freight + components + machinery' },
  { id: 'R4', rank: 4, event: 'Taiwan Strait escalation', index: 82, probability: 'Medium', disruption: 'Extreme', impact: 'Semiconductors + electronics + machinery' },
  { id: 'R5', rank: 5, event: 'Russia sanctions', index: 76, probability: 'High', disruption: 'High', impact: 'Oil + fertilizers + metals + chemicals' },
];

export const HACKATHON_EXPOSURES = [
  { name: 'Strait of Hormuz', value: 35, fill: '#ef4444' },
  { name: 'Red Sea', value: 20, fill: '#f97316' },
  { name: 'Iran Sanctions', value: 15, fill: '#06b6d4' },
  { name: 'Supplier Concentration', value: 12, fill: '#a855f7' },
  { name: 'Russia Route', value: 8, fill: '#84cc16' },
  { name: 'Others', value: 10, fill: '#475569' },
];

export const HACKATHON_WORLD_OVERVIEW = {
  status: "ok",
  systemic_risk: 86,
  supply_stress: 42,
  recent_events: [
    { id: "ev-1", type: "Geopolitical", severity: 0.96, location: "Strait of Hormuz", timestamp: new Date().toISOString() },
    { id: "ev-2", type: "Trade Control", severity: 0.91, location: "China", timestamp: new Date(Date.now() - 3600000).toISOString() },
  ]
};

export const HACKATHON_RISK_EVALUATION = {
  status: "ok",
  systemic_risk_score: 86,
  active_critical_risks: 3,
  active_high_risks: 5,
  event_count: 12,
  highest_severity_event: "Strait of Hormuz Escalation"
};

export const HACKATHON_RISK_TREND = {
  status: "ok",
  data: Array.from({ length: 20 }).map((_, i) => ({
    timestamp: new Date(Date.now() - (19 - i) * 86400000).toISOString(),
    score: 60 + Math.sin(i / 2) * 10 + (i > 15 ? 15 : 0),
    level: i > 15 ? "CRITICAL" : "HIGH"
  }))
};

export const HACKATHON_INTEL_EVENTS = {
  status: 'ok',
  data: [
    { id: 'ie-1', title: 'US increases pressure on Iran oil exports', type: 'Sanctions', severity: 0.92, confidence: 0.88, timestamp: new Date(Date.now() - 3 * 3600000).toISOString() },
    { id: 'ie-2', title: 'Tanker war-risk premiums in Red Sea reach 36%', type: 'Logistics', severity: 0.84, confidence: 0.9, timestamp: new Date(Date.now() - 4 * 3600000).toISOString() },
    { id: 'ie-3', title: 'West Africa ports face severe congestion', type: 'Logistics', severity: 0.61, confidence: 0.82, timestamp: new Date(Date.now() - 5 * 3600000).toISOString() },
    { id: 'ie-4', title: 'OPEC+ signals output adjustment in June', type: 'Market', severity: 0.55, confidence: 0.75, timestamp: new Date(Date.now() - 6 * 3600000).toISOString() },
    { id: 'ie-5', title: 'Asia LNG prices spike on solid supply concerns', type: 'Market', severity: 0.58, confidence: 0.8, timestamp: new Date(Date.now() - 7 * 3600000).toISOString() },
  ],
};

export const HACKATHON_GRAPH_DEPENDENCIES = {
  status: 'ok',
  upstream_exposure: { paths: [['IRAN_CRUDE_SUPPLIER', 'MEHAIR_ROUTE'], ['ARABIAN_ROUTE', 'MUMBAI_IMPORT_ROUTE']] },
  downstream_exposure: { paths: [['CHENNAI_PORT'], ['PARADIP_PORT']] },
};

export const HACKATHON_SYSTEM_HEALTH = {
  components: { postgresql: 'healthy', neo4j: 'healthy', redis: 'healthy', celery: 'healthy' },
};

// Deterministic snapshot result for the Scenario Lab simulation flow, shaped
// exactly like the backend's POST /scenarios -> run -> results payload so the
// real job pipeline can drop in. Numbers scale with the user's severity and
// duration inputs so the lab feels live without a backend. The coefficients are
// tuned so severity 0.7 reproduces the reference design's numbers exactly.
export function buildHackathonScenarioResults(targetId: string, severity: number, durationDays: number) {
  const p50 = +(6 * severity).toFixed(1);
  const p10 = +(p50 * 0.5).toFixed(1);
  const p90 = +(p50 * 1.85).toFixed(1);
  const total = +(p50 * durationDays * 0.146).toFixed(1);
  const part = (f: number) => +(total * f).toFixed(1);
  const s = severity;
  return {
    key_metrics: {
      supply_gap_pct: Math.round(30 * s),
      supply_gap_mbd: +(30.4 * s).toFixed(1),
      oil_price_usd: Math.round(84 * (1 + 0.34 * s)),
      oil_price_pct: Math.round(34 * s),
      lng_price_usd: +(12.7 * (1 + 0.46 * s)).toFixed(1),
      lng_price_pct: Math.round(46 * s),
      reserve_depletion_days: +(4.6 * s).toFixed(1),
      reserve_depletion_pct: Math.round(46 * s),
      shipping_cost_index: Math.round(171 * (1 + 0.585 * s)),
      shipping_cost_pct: Math.round(58.6 * s),
      refinery_utilization_pct: Math.round(88 - 14.3 * s),
      refinery_utilization_delta_pct: Math.round(15.7 * s),
      port_congestion_pct: Math.round(59 * s),
      rerouted_flows: Math.max(1, Math.round(6 * s)),
      avg_delay_days: +(9.7 * s).toFixed(1),
      volatility_pct: Math.round(27 * s),
    },
    india_impact: {
      fuel_price_pct: +(16 * s).toFixed(1),
      inflation_pct: +(0.97 * s).toFixed(2),
      current_account_b: +(13.4 * s * (durationDays / 30)).toFixed(1),
      gdp_pct: +(0.46 * s).toFixed(2),
    },
    affected_volumes: [
      { commodity: 'Crude Oil', baseline: 5.18, factor: 0.3 },
      { commodity: 'LNG', baseline: 2.85, factor: 0.34 },
      { commodity: 'Coal', baseline: 1.6, factor: 0.2 },
      { commodity: 'Products', baseline: 1.32, factor: 0.24 },
      { commodity: 'Electricity', baseline: 0.9, factor: 0.15 },
    ].map(row => ({
      commodity: row.commodity,
      baseline: row.baseline,
      after: +(row.baseline * (1 - row.factor * s)).toFixed(2),
      change_pct: Math.round(row.factor * s * 100),
    })),
    cascade: { initial_disruption: { target: targetId } },
    impact: { supply_gap: p50, storage_depletion: Math.round(severity * 32) },
    monte_carlo: { p10_gap: p10, p50_gap: p50, p90_gap: p90 },
    uncertainty: { sample_count: 10000 },
    economic_impact: {
      impact: {
        total,
        supply_shortage: part(0.39),
        price_impact: part(0.28),
        replacement_procurement: part(0.19),
        logistics: part(0.09),
        reserve: part(0.05),
      },
      uncertainty: { p10: part(0.5), p90: part(1.7) },
    },
    graph_overlay: {
      blast_radius: {
        affected_routes: ['RT-HORMUZ-MUMBAI', 'RT-SHANGHAI-MUMBAI', 'RT-CAPE-DIVERSION'],
        affected_assets: ['AST_MUMBAI', 'AST_JAMNAGAR', 'AST_PARADIP', 'AST_VIZAG_SPR', 'AST_FUJAIRAH', 'AST_JEBEL_ALI'],
        affected_countries: ['India', 'UAE', 'Saudi Arabia', 'Japan', 'South Korea'],
        affected_trade_flows: ['Gulf-India Crude', 'Gulf-Asia LNG', 'Gulf-Europe Products', 'India Products Export'],
      },
    },
  };
}

// -----------------------------------------------------------------------------
// MAP GEOMETRY (frontend-only constants)
//
// The backend has no route/chokepoint geometry, so these constants feed the
// War Room map in BOTH data modes. The shapes below intentionally mirror what a
// future backend endpoint (e.g. GET /api/v1/world/routes, /world/chokepoints)
// would return, so live data can drop in without changing the map code.
// -----------------------------------------------------------------------------

export type RouteStatus = 'stable' | 'at_risk' | 'disrupted';

export interface SupplyRoute {
  id: string;
  name: string;
  status: RouteStatus;
  commodity: string;
  path: [number, number][]; // [lng, lat] waypoints
}

export interface Chokepoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  risk: number; // 0-100
}

export interface MapAsset {
  id: string;
  name: string;
  type: 'PORT' | 'TERMINAL' | 'REFINERY' | 'PRODUCTION' | 'STORAGE';
  lat: number;
  lng: number;
  capacity: number;
}

export const HACKATHON_SUPPLY_ROUTES: SupplyRoute[] = [
  {
    id: 'RT-HORMUZ-MUMBAI', name: 'Persian Gulf - Mumbai', status: 'disrupted', commodity: 'Crude',
    path: [[50.2, 26.5], [54.5, 26.6], [56.5, 26.2], [58.5, 24.0], [63.0, 21.5], [68.0, 20.0], [72.5, 18.9]],
  },
  {
    id: 'RT-SUEZ-ROTTERDAM', name: 'Suez - Rotterdam', status: 'disrupted', commodity: 'Crude + LNG',
    path: [[43.5, 12.5], [38.5, 19.0], [33.5, 27.5], [32.3, 30.5], [31.0, 31.8], [23.0, 34.0], [12.0, 37.0], [-5.5, 35.9], [-9.5, 38.5], [-6.0, 45.0], [0.0, 49.5], [4.0, 52.0]],
  },
  {
    id: 'RT-SHANGHAI-MUMBAI', name: 'Shanghai - Malacca - Mumbai', status: 'at_risk', commodity: 'Products',
    path: [[121.8, 31.2], [119.0, 25.5], [114.0, 21.0], [108.5, 14.0], [104.0, 6.0], [100.5, 3.0], [97.0, 5.5], [90.0, 8.0], [80.0, 6.0], [76.0, 8.0], [72.5, 18.9]],
  },
  {
    id: 'RT-TAIWAN-TOKYO', name: 'Taiwan Strait - Tokyo', status: 'at_risk', commodity: 'LNG',
    path: [[121.5, 25.0], [125.0, 27.5], [130.0, 31.0], [135.0, 33.5], [139.8, 34.8]],
  },
  {
    id: 'RT-BLACKSEA-MED', name: 'Black Sea - Mediterranean', status: 'at_risk', commodity: 'Crude',
    path: [[37.8, 44.7], [34.0, 43.5], [29.1, 41.1], [26.5, 40.0], [24.0, 37.5], [19.0, 35.5], [12.0, 37.0]],
  },
  {
    id: 'RT-TRANSATLANTIC', name: 'US Gulf - Rotterdam', status: 'stable', commodity: 'LNG',
    path: [[-94.8, 29.3], [-89.0, 27.5], [-81.5, 24.0], [-75.0, 30.0], [-60.0, 38.0], [-40.0, 44.0], [-20.0, 48.0], [-8.0, 49.5], [0.0, 50.5], [4.0, 52.0]],
  },
  {
    id: 'RT-WAFRICA-EUROPE', name: 'West Africa - Europe', status: 'stable', commodity: 'Crude',
    path: [[7.0, 4.5], [3.0, 5.5], [-8.0, 4.5], [-15.0, 12.0], [-18.0, 21.0], [-15.0, 28.0], [-9.8, 35.8], [-6.0, 43.0], [0.0, 49.0]],
  },
  {
    id: 'RT-BRAZIL-USGULF', name: 'Santos - US Gulf', status: 'stable', commodity: 'Crude',
    path: [[-43.2, -23.0], [-38.0, -15.0], [-35.0, -5.0], [-45.0, 8.0], [-60.0, 15.0], [-75.0, 22.0], [-85.0, 25.0], [-94.8, 29.3]],
  },
  {
    id: 'RT-AUSTRALIA-JAPAN', name: 'North West Shelf - Japan', status: 'stable', commodity: 'LNG',
    path: [[115.7, -32.0], [114.0, -22.0], [118.0, -12.0], [125.0, -4.0], [128.0, 5.0], [130.0, 15.0], [133.0, 25.0], [137.0, 33.0], [139.8, 34.8]],
  },
  {
    id: 'RT-CAPE-DIVERSION', name: 'Cape of Good Hope Diversion', status: 'stable', commodity: 'Crude',
    path: [[57.0, 20.0], [52.0, 10.0], [45.0, -5.0], [38.0, -20.0], [27.0, -35.5], [18.0, -35.5], [8.0, -20.0], [-8.0, 0.0], [-17.0, 15.0], [-15.0, 28.0], [-9.8, 35.8], [-6.0, 43.0], [0.0, 49.0]],
  },
];

export const HACKATHON_CHOKEPOINTS: Chokepoint[] = [
  { id: 'CHK_HORMUZ', name: 'Strait of Hormuz', lat: 26.6, lng: 56.5, risk: 72 },
  { id: 'CHK_SUEZ', name: 'Suez Canal', lat: 30.5, lng: 32.35, risk: 44 },
  { id: 'CHK_BAB_EL_MANDEB', name: 'Bab el-Mandeb', lat: 12.6, lng: 43.4, risk: 44 },
  { id: 'CHK_MALACCA', name: 'Strait of Malacca', lat: 2.8, lng: 100.5, risk: 58 },
  { id: 'CHK_TAIWAN', name: 'Taiwan Strait', lat: 24.5, lng: 119.5, risk: 66 },
  { id: 'CHK_BOSPORUS', name: 'Bosporus', lat: 41.1, lng: 29.05, risk: 47 },
  { id: 'CHK_PANAMA', name: 'Panama Canal', lat: 9.1, lng: -79.7, risk: 28 },
  { id: 'CHK_GIBRALTAR', name: 'Strait of Gibraltar', lat: 35.95, lng: -5.6, risk: 18 },
  { id: 'CHK_GOOD_HOPE', name: 'Cape of Good Hope', lat: -34.8, lng: 18.5, risk: 26 },
];

// Coarse regional polygons for the mini heatmap map. Shapes are rough on
// purpose: the panel renders at ~280px wide. Region RISK is NOT stored here:
// the heatmap derives it from the real map data (chokepoints inside the
// region, route statuses passing through it, and the top-risk events listed in
// riskEventIds). Mirrors what a future GET /api/v1/risks/heatmap could return
// (ApiClient.getRiskHeatmap already exists for it).
export interface HeatmapRegion {
  id: string;
  name: string;
  polygon: [number, number][]; // [lng, lat] ring, unclosed
  riskEventIds: string[]; // ids from HACKATHON_TOP_RISKS affecting this region
}

export const HACKATHON_HEATMAP_REGIONS: HeatmapRegion[] = [
  {
    id: 'REG_NA', name: 'North America', riskEventIds: [],
    polygon: [[-168, 68], [-120, 70], [-60, 62], [-55, 48], [-75, 26], [-85, 14], [-105, 16], [-125, 32], [-168, 55]],
  },
  {
    id: 'REG_SA', name: 'South America', riskEventIds: [],
    polygon: [[-82, 10], [-60, 9], [-35, -6], [-40, -25], [-55, -40], [-72, -54], [-78, -30], [-82, -4]],
  },
  {
    id: 'REG_EU', name: 'Europe', riskEventIds: [],
    polygon: [[-10, 60], [10, 66], [30, 68], [40, 58], [42, 46], [28, 37], [10, 37], [-10, 44]],
  },
  {
    id: 'REG_AF', name: 'Africa', riskEventIds: ['R3'],
    polygon: [[-17, 34], [10, 37], [32, 31], [40, -14], [34, -35], [18, -35], [9, -4], [-17, 14]],
  },
  {
    id: 'REG_ME', name: 'Middle East', riskEventIds: ['R1', 'R3'],
    polygon: [[26, 40], [45, 42], [63, 38], [60, 24], [55, 14], [43, 12], [33, 28]],
  },
  {
    id: 'REG_RU', name: 'Russia / CIS', riskEventIds: ['R5'],
    polygon: [[30, 68], [90, 74], [178, 68], [178, 52], [130, 44], [85, 48], [60, 50], [40, 58]],
  },
  {
    id: 'REG_SAS', name: 'South Asia', riskEventIds: [],
    polygon: [[63, 38], [80, 36], [92, 28], [90, 20], [78, 6], [66, 22]],
  },
  {
    id: 'REG_EAS', name: 'East Asia', riskEventIds: ['R2', 'R4'],
    polygon: [[85, 48], [130, 44], [146, 44], [145, 30], [120, 16], [95, 20], [92, 28], [80, 36]],
  },
  {
    id: 'REG_OC', name: 'Oceania', riskEventIds: [],
    polygon: [[112, -12], [155, -12], [154, -40], [113, -37]],
  },
];

export const HACKATHON_MAP_ASSETS: MapAsset[] = [
  { id: 'AST_PARADIP', name: 'Paradip Port', type: 'PORT', lat: 20.27, lng: 86.6, capacity: 15 },
  { id: 'AST_MUMBAI', name: 'Mumbai Port', type: 'PORT', lat: 18.95, lng: 72.84, capacity: 62 },
  { id: 'AST_ROTTERDAM', name: 'Rotterdam Port', type: 'PORT', lat: 51.95, lng: 4.05, capacity: 470 },
  { id: 'AST_SINGAPORE', name: 'Singapore Port', type: 'PORT', lat: 1.26, lng: 103.75, capacity: 630 },
  { id: 'AST_HOUSTON', name: 'Houston Port', type: 'PORT', lat: 29.6, lng: -95.0, capacity: 285 },
  { id: 'AST_SHANGHAI', name: 'Shanghai Port', type: 'PORT', lat: 31.2, lng: 121.8, capacity: 514 },
  { id: 'AST_FUJAIRAH', name: 'Fujairah Port', type: 'PORT', lat: 25.15, lng: 56.35, capacity: 90 },
  { id: 'AST_JEBEL_ALI', name: 'Jebel Ali Terminal', type: 'TERMINAL', lat: 25.0, lng: 55.05, capacity: 22 },
  { id: 'AST_SABINE_PASS', name: 'Sabine Pass LNG', type: 'TERMINAL', lat: 29.7, lng: -93.87, capacity: 30 },
  { id: 'AST_ZEEBRUGGE', name: 'Zeebrugge LNG', type: 'TERMINAL', lat: 51.35, lng: 3.2, capacity: 11 },
  { id: 'AST_JAMNAGAR', name: 'Jamnagar Refinery', type: 'REFINERY', lat: 22.35, lng: 70.05, capacity: 1240 },
  { id: 'AST_RAS_TANURA', name: 'Ras Tanura Refinery', type: 'REFINERY', lat: 26.7, lng: 50.15, capacity: 550 },
  { id: 'AST_JURONG', name: 'Jurong Island Refinery', type: 'REFINERY', lat: 1.27, lng: 103.67, capacity: 592 },
  { id: 'AST_PORT_ARTHUR', name: 'Port Arthur Refinery', type: 'REFINERY', lat: 29.87, lng: -93.95, capacity: 607 },
  { id: 'AST_GHAWAR', name: 'Ghawar Field', type: 'PRODUCTION', lat: 25.4, lng: 49.6, capacity: 3800 },
  { id: 'AST_PERMIAN', name: 'Permian Basin', type: 'PRODUCTION', lat: 31.8, lng: -102.0, capacity: 5400 },
  { id: 'AST_W_SIBERIA', name: 'West Siberia Fields', type: 'PRODUCTION', lat: 61.0, lng: 76.0, capacity: 6200 },
  { id: 'AST_NORTH_SEA', name: 'North Sea Fields', type: 'PRODUCTION', lat: 58.0, lng: 2.5, capacity: 1900 },
  { id: 'AST_SANTOS', name: 'Santos Basin', type: 'PRODUCTION', lat: -25.0, lng: -42.0, capacity: 2400 },
  { id: 'AST_CUSHING', name: 'Cushing Storage Hub', type: 'STORAGE', lat: 35.98, lng: -96.75, capacity: 76 },
  { id: 'AST_VIZAG_SPR', name: 'Visakhapatnam SPR', type: 'STORAGE', lat: 17.7, lng: 83.3, capacity: 9 },
  { id: 'AST_ROTTERDAM_TANK', name: 'Rotterdam Storage', type: 'STORAGE', lat: 51.88, lng: 4.25, capacity: 30 },
  { id: 'AST_OKINAWA', name: 'Okinawa Storage', type: 'STORAGE', lat: 26.3, lng: 127.7, capacity: 5 },
];

export const HACKATHON_SUPPLY_BALANCE = [
  { date: 'May 18', Supply: 112, Demand: 76, AtRisk: 42 },
  { date: 'May 19', Supply: 110, Demand: 74, AtRisk: 44 },
  { date: 'May 20', Supply: 114, Demand: 78, AtRisk: 50 },
  { date: 'May 21', Supply: 111, Demand: 73, AtRisk: 41 },
  { date: 'May 22', Supply: 116, Demand: 80, AtRisk: 49 },
  { date: 'May 23', Supply: 112, Demand: 72, AtRisk: 39 },
  { date: 'May 24', Supply: 118, Demand: 76, AtRisk: 40 },
  { date: 'May 25', Supply: 115, Demand: 74, AtRisk: 48 },
  { date: 'May 26', Supply: 111, Demand: 78, AtRisk: 35 },
  { date: 'May 27', Supply: 113, Demand: 79, AtRisk: 42 },
];
