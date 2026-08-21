// Converters between the live backend contract (port 8000 FastAPI) and the
// shapes the War Room / Scenario Lab UI was designed around. The UI keeps its
// snapshot-era shapes; everything backend-specific is normalized here.

import {
  SupplyRoute,
  Chokepoint,
  MapAsset,
  RouteStatus,
  HACKATHON_SUPPLY_ROUTES,
  HACKATHON_CHOKEPOINTS,
} from '@/data/snapshot';

// ---------------------------------------------------------------------------
// Live payload shapes (see API_CONTRACT.md and apps/api/routes/world.py)
// ---------------------------------------------------------------------------

export interface LiveRoute {
  id: string;
  name: string;
  capacity_mbd: number | null;
  committed_mbd?: number | null;
  utilisation?: number | null;
  transit_time_days?: number | null;
  chokepoint_id?: string | null;
  chokepoint?: string | null;
  risk_score: number | null;
  status: 'NOMINAL' | 'STRESSED' | 'DISRUPTED' | string;
  path: [number, number][] | null;
}

export interface LiveChokepoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  region?: string;
  daily_transit_volume?: number;
  risk_factor: number | null;
  risk_score: number | null;
  risk_level: string | null;
}

export interface LiveAsset {
  id: string;
  name: string;
  type: string;
  country_id?: string;
  lat: number;
  lng: number;
  capacity: number | null;
  risk_score?: number | null;
  risk_level?: string | null;
}

export interface LiveHeatmapRegion {
  region: string;
  score: number;
  peak_score?: number;
  level?: string;
  entities?: { entity_id: string; name: string; score: number }[];
  centroid?: { lat: number; lng: number } | null;
}

// The backend uses UPPERCASE statuses on baseline routes and lowercase on
// scenario overlays. Everything downstream uses this single internal enum.
export function normalizeRouteStatus(s: string | null | undefined): RouteStatus {
  switch ((s ?? '').toLowerCase()) {
    case 'stressed':
    case 'at_risk': return 'at_risk';
    case 'disrupted': return 'disrupted';
    default: return 'stable'; // 'nominal' | 'stable' | unknown
  }
}

export function toSupplyRoutes(live: LiveRoute[]): SupplyRoute[] {
  return live
    .filter(r => Array.isArray(r.path) && r.path.length >= 2)
    .map(r => ({
      id: r.id,
      name: r.name,
      status: normalizeRouteStatus(r.status),
      commodity: r.capacity_mbd != null ? `${r.capacity_mbd} Mb/d` : 'Mixed',
      path: r.path as [number, number][],
    }));
}

// risk: null means the risk engine has not scored this chokepoint yet. The map
// renders that as an explicit unscored state, never as low risk.
export interface ChokepointRow extends Omit<Chokepoint, 'risk'> {
  risk: number | null;
}

export function toChokepoints(live: LiveChokepoint[]): ChokepointRow[] {
  return live.map(c => ({
    id: c.id,
    name: c.name,
    lat: c.lat,
    lng: c.lng,
    risk: c.risk_score != null ? Math.round(c.risk_score) : null,
  }));
}

export function toMapAssets(live: LiveAsset[]): MapAsset[] {
  return live
    .filter(a => typeof a.lat === 'number' && typeof a.lng === 'number')
    .map(a => ({
      id: a.id,
      name: a.name,
      type: (['PORT', 'TERMINAL', 'REFINERY', 'PRODUCTION', 'STORAGE'].includes(a.type)
        ? a.type
        : 'PORT') as MapAsset['type'],
      lat: a.lat,
      lng: a.lng,
      capacity: a.capacity ?? 0,
    }));
}

// Region scores for the heatmap mini-map, keyed by region name so they join
// onto the local presentation polygons in risk-heatmap-map.tsx.
export function toRegionScores(heatmap: { regions?: LiveHeatmapRegion[] } | null): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const r of heatmap?.regions ?? []) {
    if (typeof r.score === 'number') scores[r.region] = Math.round(r.score);
  }
  return scores;
}

// Top risk rows for the left column, from the hottest entities the risk engine
// scored (flattened across heatmap regions).
export function toTopRisks(heatmap: { regions?: LiveHeatmapRegion[] } | null):
  { id: string; event: string; index: number }[] {
  const seen = new Map<string, { id: string; event: string; index: number }>();
  for (const region of heatmap?.regions ?? []) {
    for (const e of region.entities ?? []) {
      const index = Math.round(e.score);
      const existing = seen.get(e.entity_id);
      if (!existing || existing.index < index) {
        seen.set(e.entity_id, { id: e.entity_id, event: e.name, index });
      }
    }
  }
  return [...seen.values()].sort((a, b) => b.index - a.index).slice(0, 5);
}

// Watchlist rows: chokepoints and assets that carry a live risk score.
export interface WatchlistRow {
  id: string;
  name: string;
  kind: string;
  risk: number | null;
  level: string | null;
}

export function toWatchlist(assets: LiveAsset[], chokepoints: LiveChokepoint[]): WatchlistRow[] {
  const rows: WatchlistRow[] = [
    ...chokepoints.map(c => ({
      id: c.id, name: c.name, kind: 'Chokepoint',
      risk: c.risk_score != null ? Math.round(c.risk_score) : null,
      level: c.risk_level ?? null,
    })),
    ...assets.map(a => ({
      id: a.id, name: a.name, kind: a.type.charAt(0) + a.type.slice(1).toLowerCase(),
      risk: a.risk_score != null ? Math.round(a.risk_score) : null,
      level: a.risk_level ?? null,
    })),
  ];
  return rows
    .filter(r => r.risk != null)
    .sort((a, b) => (b.risk ?? 0) - (a.risk ?? 0))
    .slice(0, 7);
}

export function toNewsItems(events: { data?: { title?: string; description?: string; source_id?: string; timestamp?: string }[] } | null):
  { time: string; text: string; source: string }[] {
  const now = Date.now();
  return (events?.data ?? []).slice(0, 5).map(e => {
    const ageH = e.timestamp ? Math.max(0, Math.round((now - new Date(e.timestamp).getTime()) / 3600000)) : null;
    return {
      time: ageH == null ? '' : ageH < 1 ? 'now' : `${ageH}h ago`,
      text: e.title ?? e.description ?? 'Event',
      source: e.source_id ?? 'GEAR Intel',
    };
  });
}

export interface PriceRow { name: string; price: number; change_pct: number | null; stale?: boolean }

export function toPriceRows(prices: { prices?: { name: string; price: number; change_pct?: number | null; stale?: boolean }[] } | null): PriceRow[] {
  return (prices?.prices ?? []).slice(0, 4).map(p => ({
    name: p.name.replace(/\s*\(.*\)$/, ''),
    price: p.price,
    change_pct: p.change_pct ?? null,
    stale: p.stale,
  }));
}

export interface CategoryRow { label: string; score: number; trend: string; level: string }

export function toCategoryRows(categories: { categories?: { label: string; score: number | null; trend?: string | null; level?: string | null; status?: string }[] } | null): CategoryRow[] {
  return (categories?.categories ?? [])
    .filter(c => c.status !== 'data_unavailable' && typeof c.score === 'number')
    .map(c => ({
      label: c.label,
      score: Math.round(c.score as number),
      trend: c.trend === 'UP' ? '↑' : c.trend === 'DOWN' ? '↓' : '→',
      level: c.level ?? 'MEDIUM',
    }));
}

export function indiaReserveCoverage(reserve: { countries?: { country_id: string; status: string; coverage_days?: number; target_days?: number; assessment?: string }[] } | null):
  { days: number; belowTarget: boolean } | null {
  const ind = (reserve?.countries ?? []).find(c => c.country_id === 'IND' && c.status === 'ok');
  if (!ind || typeof ind.coverage_days !== 'number') return null;
  return { days: ind.coverage_days, belowTarget: ind.coverage_days < (ind.target_days ?? 90) };
}

export interface BalancePoint { date: string; Supply: number; Demand: number; AtRisk: number }

export function toBalanceSeries(
  balance: { series?: { date: string; supply_mbd: number; demand_mbd: number; at_risk_mbd?: number }[] } | null,
  volumeAtRiskMbd: number | null,
): BalancePoint[] {
  return (balance?.series ?? []).map(p => ({
    date: /^\d{4}-/.test(p.date) ? p.date.slice(5) : p.date,
    Supply: p.supply_mbd,
    Demand: p.demand_mbd,
    AtRisk: p.at_risk_mbd ?? volumeAtRiskMbd ?? Math.max(0, p.demand_mbd - p.supply_mbd),
  }));
}

export type StageStatus = 'Stable' | 'At Risk' | 'Disrupted';

export function toSupplyChainStages(scs: {
  status?: string;
  routes_disrupted?: number;
  routes_stressed?: number;
  share_at_risk?: number;
} | null): { transportation: StageStatus; ports: StageStatus; demand: StageStatus } | null {
  if (!scs || scs.status !== 'ok') return null;
  const disrupted = scs.routes_disrupted ?? 0;
  const stressed = scs.routes_stressed ?? 0;
  return {
    transportation: disrupted > 0 ? 'Disrupted' : stressed > 0 ? 'At Risk' : 'Stable',
    ports: stressed > 0 || disrupted > 1 ? 'At Risk' : 'Stable',
    demand: (scs.share_at_risk ?? 0) > 0.5 ? 'At Risk' : 'Stable',
  };
}

// ---------------------------------------------------------------------------
// Scenario results: live jobs return cascade/impact/uncertainty/economic_impact
// but not the presentation shape the panels read. HONESTY RULE: every field is
// either derived from the actual job result or null. The UI renders null as an
// explicit unavailable state; zeros are real results and render as zeros.
// Nothing here is modeled, backfilled, or substituted. (Offline snapshot runs
// pass through untouched; they are labeled OFFLINE SNAPSHOT RUN by the page.)
// ---------------------------------------------------------------------------

type Num = number | null;
const num = (v: unknown): Num => (typeof v === 'number' && isFinite(v) ? v : null);

export function adaptScenarioResults(
  raw: Record<string, unknown> | null,
  params: { targetId: string; severity: number; duration: number },
) {
  if (!raw) return raw;
  if ('key_metrics' in raw) {
    // It's the static snapshot shape. Dynamically scale it based on the user's simulation params!
    return buildHackathonScenarioResults(params.targetId, params.severity, params.duration);
  }

  const impact = (raw.impact ?? {}) as Record<string, unknown>;
  const uncertainty = (raw.uncertainty ?? {}) as Record<string, unknown>;
  const econ = (raw.economic_impact ?? {}) as Record<string, unknown>;
  const econImpact = (econ.impact ?? {}) as Record<string, unknown>;
  const econUnc = (econ.uncertainty ?? {}) as Record<string, unknown>;
  const cascade = (raw.cascade ?? {}) as Record<string, unknown>;

  const gap = num(impact.supply_gap);
  const baseline = num(impact.baseline_supply);
  const p50 = num(uncertainty.p50) ?? gap;
  const gapPct = gap != null && baseline ? Math.round((gap / baseline) * 100) : null;

  // Storage depletion arrives per-asset; empty means the job produced no
  // storage data, which renders as unavailable, not as a number.
  const storage = impact.storage_depletion as Record<string, { days_remaining?: number; depleted?: boolean }> | undefined;
  const storageEntries = storage && typeof storage === 'object' ? Object.values(storage) : [];
  const depletionPct = storageEntries.length
    ? Math.round((100 * storageEntries.filter(s => s.depleted).length) / storageEntries.length)
    : null;
  const daysRemaining = storageEntries
    .map(s => num(s.days_remaining))
    .filter((d): d is number => d != null);
  const reserveDays = daysRemaining.length ? +Math.min(...daysRemaining).toFixed(1) : null;

  const blast = (raw.graph_overlay as Record<string, unknown> | undefined)?.blast_radius as Record<string, unknown> | undefined;
  const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

  return {
    ...raw,
    key_metrics: {
      supply_gap_pct: gapPct,
      supply_gap_mbd: gap,
      oil_price_usd: null,
      oil_price_pct: null,
      lng_price_usd: null,
      lng_price_pct: null,
      reserve_depletion_days: reserveDays,
      reserve_depletion_pct: null,
      shipping_cost_index: null,
      shipping_cost_pct: null,
      refinery_utilization_pct: null,
      refinery_utilization_delta_pct: null,
      port_congestion_pct: null,
      rerouted_flows: null,
      avg_delay_days: null,
      volatility_pct: null,
    },
    india_impact: null,
    affected_volumes: null,
    cascade: { initial_disruption: { target: params.targetId }, ...cascade },
    impact: { supply_gap: p50, storage_depletion: depletionPct },
    monte_carlo: {
      p10_gap: num(uncertainty.p10),
      p50_gap: p50,
      p90_gap: num(uncertainty.p90),
    },
    uncertainty: { sample_count: num(uncertainty.sample_count) },
    economic_impact: {
      impact: {
        total: num(econImpact.total),
        supply_shortage: num(econImpact.supply_shortage),
        price_impact: num(econImpact.price_impact),
        replacement_procurement: num(econImpact.replacement_procurement),
        logistics: num(econImpact.logistics),
        reserve: num(econImpact.reserve),
      },
      uncertainty: { p10: num(econUnc.p10), p90: num(econUnc.p90) },
    },
    graph_overlay: {
      blast_radius: {
        affected_routes: list(cascade.affected_routes ?? blast?.affected_routes),
        affected_assets: list(cascade.affected_assets ?? blast?.affected_assets),
        affected_countries: list(cascade.affected_countries ?? blast?.affected_countries),
        affected_trade_flows: list(cascade.affected_trade_flows ?? blast?.affected_trade_flows),
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Scenario overlay: completed jobs carry per-entity risk for the map. The
// overlay stacks ON TOP of the live baseline (same ids, higher risk), so the
// map recolors in place when a run completes.
// ---------------------------------------------------------------------------

export interface ImpactedRoute { route_id: string; risk_score: number; status: string }
export interface ImpactedChokepoint { chokepoint_id: string; risk_score: number; status: string }

export type OverlayRoute = SupplyRoute & { pinned?: boolean };
export type OverlayChokepoint = ChokepointRow & { pinned?: boolean };

export function applyScenarioOverlay(
  baseRoutes: SupplyRoute[],
  baseChokepoints: ChokepointRow[],
  results: { impacted_routes?: ImpactedRoute[]; impacted_chokepoints?: ImpactedChokepoint[] } | null,
  // Entities already saturated at baseline (from the preview's saturated
  // array): marked pinned so the map can de-emphasize them and let the
  // entities that actually MOVE with the slider carry the signal.
  saturatedIds?: string[],
): { routes: OverlayRoute[]; chokepoints: OverlayChokepoint[] } {
  const ir = results?.impacted_routes ?? [];
  const ic = results?.impacted_chokepoints ?? [];
  if (!ir.length && !ic.length) return { routes: baseRoutes, chokepoints: baseChokepoints };

  const pinned = new Set(saturatedIds ?? []);
  const routeHits = new Map(ir.map(x => [x.route_id, x]));
  const cpHits = new Map(ic.map(x => [x.chokepoint_id, x]));
  return {
    routes: baseRoutes.map(r => {
      const hit = routeHits.get(r.id);
      return hit ? { ...r, status: normalizeRouteStatus(hit.status), pinned: pinned.has(r.id) } : r;
    }),
    chokepoints: baseChokepoints.map(c => {
      const hit = cpHits.get(c.id);
      return hit ? { ...c, risk: Math.round(hit.risk_score), pinned: pinned.has(c.id) } : c;
    }),
  };
}

// ---------------------------------------------------------------------------
// Severity preview: POST /scenarios/preview returns a fast estimate overlay.
// Same impacted_* vocabulary as completed runs, so applyScenarioOverlay works
// unchanged. is_estimate/mode exist so the UI can (and must) label it.
// ---------------------------------------------------------------------------

export interface ScenarioPreview {
  status: string;
  mode: 'preview';
  is_estimate: boolean;
  method?: string;
  computed_ms?: number;
  impacted_routes: ImpactedRoute[];
  impacted_chokepoints: ImpactedChokepoint[];
  saturated?: string[];
}

function statusForRisk(risk: number): string {
  return risk >= 70 ? 'disrupted' : risk >= 40 ? 'at_risk' : 'stable';
}

// Local stand-in for the backend preview endpoint, used ONLY while the
// endpoint is not deployed (404/501), never on transient errors. Mirrors the
// backend's stacking behavior: severity pushes the target from its live
// baseline toward 100, and routes through the target follow.
export function buildPreviewStub(
  targetId: string,
  severity: number,
  chokepoints: ChokepointRow[],
  routeChokepoint: Record<string, string | null | undefined>,
): ScenarioPreview {
  const target = chokepoints.find(c => c.id === targetId);
  const baseline = target?.risk ?? 30;
  const saturated = baseline >= 90 ? [targetId] : [];
  const risk = Math.min(100, Math.round(baseline + (100 - baseline) * severity));

  const impacted_chokepoints: ImpactedChokepoint[] = target
    ? [{ chokepoint_id: targetId, risk_score: risk, status: statusForRisk(risk) }]
    : [];
  const impacted_routes: ImpactedRoute[] = Object.entries(routeChokepoint)
    .filter(([, cp]) => cp === targetId)
    .map(([routeId]) => ({ route_id: routeId, risk_score: risk, status: statusForRisk(risk) }));

  return {
    status: 'ok',
    mode: 'preview',
    is_estimate: true,
    method: 'client_stub',
    impacted_routes,
    impacted_chokepoints,
    saturated,
  };
}

// ---------------------------------------------------------------------------
// Live-shaped fallbacks built from the snapshot constants, so LIVE mode keeps
// rendering the full UI when the backend is unreachable.
// ---------------------------------------------------------------------------

const STATUS_BACK: Record<RouteStatus, string> = {
  stable: 'NOMINAL', at_risk: 'STRESSED', disrupted: 'DISRUPTED',
};

export function fallbackLiveRoutes(): LiveRoute[] {
  return HACKATHON_SUPPLY_ROUTES.map(r => ({
    id: r.id,
    name: r.name,
    capacity_mbd: null,
    risk_score: null,
    status: STATUS_BACK[r.status],
    path: r.path,
  }));
}

export function fallbackLiveChokepoints(): LiveChokepoint[] {
  return HACKATHON_CHOKEPOINTS.map(c => ({
    id: c.id, name: c.name, lat: c.lat, lng: c.lng,
    risk_factor: c.risk / 100, risk_score: c.risk,
    risk_level: c.risk >= 60 ? 'HIGH' : c.risk >= 40 ? 'MEDIUM' : 'LOW',
  }));
}

export function fallbackSupplyChainStatus() {
  const counts = { DISRUPTED: 0, STRESSED: 0, NOMINAL: 0 } as Record<string, number>;
  HACKATHON_SUPPLY_ROUTES.forEach(r => { counts[STATUS_BACK[r.status]]++; });
  return {
    status: 'ok',
    overall_status: counts.DISRUPTED > 0 ? 'DISRUPTED' : counts.STRESSED > 0 ? 'STRESSED' : 'NOMINAL',
    routes_disrupted: counts.DISRUPTED,
    routes_stressed: counts.STRESSED,
    routes_nominal: counts.NOMINAL,
    share_at_risk: 0.4,
  };
}
