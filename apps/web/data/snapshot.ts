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

export const HACKATHON_MAP_ROUTES = [
  {
    id: 'R1-Hormuz',
    name: 'Strait of Hormuz Route',
    currentPath: [[50.0, 26.0], [55.0, 25.0], [60.0, 15.0], [72.8, 19.0]], // Persian Gulf to Mumbai
    alternativePath: [[50.0, 26.0], [45.0, 20.0], [38.0, 20.0], [45.0, 12.0], [60.0, 15.0], [72.8, 19.0]] // Overland to Red Sea bypass
  },
  {
    id: 'R2-China',
    name: 'China Export Route',
    currentPath: [[121.4, 31.2], [115.0, 20.0], [105.0, 10.0], [95.0, 5.0], [85.0, 15.0], [72.8, 19.0]], // Shanghai via Malacca
    alternativePath: [[121.4, 31.2], [130.0, 30.0], [140.0, 10.0], [130.0, -10.0], [100.0, -15.0], [80.0, -5.0], [72.8, 19.0]] // Detour East of Philippines
  },
  {
    id: 'R3-RedSea',
    name: 'Red Sea Shipping Route',
    currentPath: [[5.0, 50.0], [0.0, 40.0], [20.0, 35.0], [32.0, 30.0], [38.0, 20.0], [45.0, 12.0], [60.0, 15.0], [72.8, 19.0]], // Europe via Suez
    alternativePath: [[5.0, 50.0], [-10.0, 40.0], [-20.0, 10.0], [10.0, -40.0], [35.0, -35.0], [55.0, -20.0], [72.8, 19.0]] // Cape of Good Hope
  },
  {
    id: 'R4-Taiwan',
    name: 'Taiwan Strait Route',
    currentPath: [[121.0, 24.0], [115.0, 20.0], [105.0, 10.0], [95.0, 5.0], [85.0, 15.0], [72.8, 19.0]], // Taiwan via Malacca
    alternativePath: [[121.0, 24.0], [125.0, 20.0], [130.0, 5.0], [115.0, -5.0], [100.0, -10.0], [85.0, 5.0], [72.8, 19.0]] // East of Philippines via Sunda
  },
  {
    id: 'R5-Russia',
    name: 'Russia Black Sea Route',
    currentPath: [[37.7, 44.7], [29.0, 41.0], [25.0, 35.0], [32.0, 30.0], [38.0, 20.0], [45.0, 12.0], [72.8, 19.0]], // Novorossiysk via Suez
    alternativePath: [[131.9, 43.1], [140.0, 35.0], [130.0, 20.0], [120.0, 5.0], [100.0, -5.0], [72.8, 19.0]] // Vladivostok Far East Route
  }
];
