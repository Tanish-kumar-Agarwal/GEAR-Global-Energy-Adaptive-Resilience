'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { Activity, Loader2, Download, Share2, Search, AlertTriangle, Anchor, Globe, Clock, Zap, MapPin, BarChart2, Gauge, ArrowDownCircle, DollarSign, Flame, Building, Ship, Factory, Copy } from 'lucide-react';
import { MapViewer, SelectedMapFeature, MapAssetInput } from '@/components/map-viewer';
import { SnapshotFallbackBadge } from '@/components/snapshot-badge';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ApiClient } from '@/lib/api';
import { useJobPolling } from '@/lib/useJobPolling';
import { useSearchParams, useRouter } from 'next/navigation';
import { HACKATHON_MAP_ASSETS, HACKATHON_CHOKEPOINTS, HACKATHON_SUPPLY_ROUTES, SupplyRoute } from '@/data/snapshot';
import {
  toMapAssets, toChokepoints, toSupplyRoutes, adaptScenarioResults, applyScenarioOverlay,
  buildPreviewStub, ChokepointRow, ScenarioPreview,
} from '@/lib/live-adapters';

// Event presets: choosing an event retargets the scenario.
const EVENT_TARGETS: Record<string, { targetId: string; region: string }> = {
  'Strait of Malacca blockade': { targetId: 'CHK_MALACCA', region: 'Strait of Malacca' },
  'Strait of Hormuz': { targetId: 'CHK_HORMUZ', region: 'Strait of Hormuz' },
  'China export controls': { targetId: 'AST_SHANGHAI', region: 'East Asia' },
  'Red Sea shipping disruption': { targetId: 'CHK_BAB_EL_MANDEB', region: 'Red Sea' },
  'Taiwan Strait escalation': { targetId: 'CHK_TAIWAN', region: 'Taiwan Strait' },
  'Russia sanctions': { targetId: 'CHK_BOSPORUS', region: 'Black Sea' },
};

const SEARCHABLE_TARGETS = [
  ...HACKATHON_CHOKEPOINTS.map(c => ({ id: c.id, name: c.name, kind: 'Chokepoint' })),
  ...HACKATHON_MAP_ASSETS.map(a => ({ id: a.id, name: a.name, kind: a.type })),
];

type ImpactTab = 'Physical Impact' | 'Logistics Impact' | 'Market Impact' | 'Economic Impact';
const IMPACT_TABS: ImpactTab[] = ['Physical Impact', 'Logistics Impact', 'Market Impact', 'Economic Impact'];

interface SavedScenario {
  id: string;
  name: string;
  targetId: string;
  severity: number;
  duration: number;
  commodities: string[];
  regions: string[];
  p50Gap: number | null;
  econTotal: number | null;
  savedAt: string;
}

function severityLabel(s: number): { text: string; cls: string } {
  if (s < 0.4) return { text: '(LOW)', cls: 'text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]' };
  if (s < 0.75) return { text: '(MODERATE)', cls: 'text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]' };
  return { text: '(HIGH)', cls: 'text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]' };
}

function ScenarioLabContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Default to a target with baseline headroom: Hormuz already sits near 100,
  // so severity changes barely move the map there (see saturation note below).
  const initialTarget = searchParams.get('target_id') || 'CHK_MALACCA';
  const initialSeverity = Math.min(1, Math.max(0, parseFloat(searchParams.get('severity') || '0.7') || 0.7));
  const initialDuration = Math.min(120, Math.max(1, parseInt(searchParams.get('duration') || '30', 10) || 30));

  const [submitting, setSubmitting] = useState(false);
  const [scenarioName, setScenarioName] = useState(`Disruption: ${initialTarget}`);
  const [targetId, setTargetId] = useState(initialTarget);
  const [severity, setSeverity] = useState(initialSeverity);
  const [duration, setDuration] = useState(initialDuration);
  const [assets, setAssets] = useState<MapAssetInput[]>(HACKATHON_MAP_ASSETS);
  const [routes, setRoutes] = useState<SupplyRoute[]>(HACKATHON_SUPPLY_ROUTES);
  const [chokepoints, setChokepoints] = useState<ChokepointRow[]>(HACKATHON_CHOKEPOINTS);
  const [liveTargets, setLiveTargets] = useState<{ id: string; name: string; kind: string }[] | null>(null);
  const [eventType, setEventType] = useState('Strait of Malacca blockade');

  const [commodities, setCommodities] = useState<string[]>(['Crude Oil', 'LNG']);
  const [regions, setRegions] = useState<string[]>(['India', 'Global', 'Strait of Hormuz']);
  const [regionSearch, setRegionSearch] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [activeTab, setActiveTab] = useState<ImpactTab>('Physical Impact');
  const [timelineMode, setTimelineMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem('gear_saved_scenarios') || '[]');
    } catch {
      return [];
    }
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const toggleCommodity = (c: string) => {
    setCommodities(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const removeRegion = (r: string) => {
    setRegions(prev => prev.filter(x => x !== r));
  };

  const handleRegionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && regionSearch.trim()) {
      if (!regions.includes(regionSearch.trim())) {
        setRegions(prev => [...prev, regionSearch.trim()]);
      }
      setRegionSearch('');
    }
  };

  const selectEvent = (event: string) => {
    setEventType(event);
    const preset = EVENT_TARGETS[event];
    if (preset) {
      setTargetId(preset.targetId);
      setScenarioName(`Disruption: ${event}`);
      setRegions(prev => prev.includes(preset.region) ? prev : [...prev, preset.region]);
    }
  };

  const selectTarget = (t: { id: string; name: string }) => {
    setTargetId(t.id);
    setScenarioName(`Disruption: ${t.name}`);
    setTargetSearch('');
  };

  const searchableTargets = liveTargets && liveTargets.length ? liveTargets : SEARCHABLE_TARGETS;
  const targetMatches = targetSearch.trim().length > 1
    ? searchableTargets.filter(t => t.name.toLowerCase().includes(targetSearch.trim().toLowerCase())).slice(0, 6)
    : [];

  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [runMode, setRunMode] = useState<'live' | 'sync_fallback' | 'snapshot'>('live');
  // Params captured at run time, so slider tweaks after a run do not reshape
  // the adapted results of the run being displayed.
  const [lastRun, setLastRun] = useState({ targetId: initialTarget, severity: initialSeverity, duration: initialDuration });

  // ---- Live severity preview: drag the slider, the map reacts. ----
  // Debounced; in-flight requests are aborted and a sequence counter makes
  // sure an older response can never overwrite a newer one.
  const [preview, setPreview] = useState<{
    params: { targetId: string; severity: number; duration: number };
    data: ScenarioPreview;
  } | null>(null);
  const previewSeq = useRef(0);
  const previewAbort = useRef<AbortController | null>(null);
  const previewArmed = useRef(false);

  useEffect(() => {
    // No preview on initial mount; only once the user changes something.
    if (!previewArmed.current) {
      previewArmed.current = true;
      return;
    }
    const seq = ++previewSeq.current;
    const params = { targetId, severity, duration };
    const timer = setTimeout(async () => {
      previewAbort.current?.abort();
      const ctrl = new AbortController();
      previewAbort.current = ctrl;
      const res = await ApiClient.previewScenario(
        { target_id: params.targetId, severity: params.severity, duration_days: params.duration },
        ctrl.signal,
      );
      if (previewSeq.current !== seq) return; // stale, a newer request fired
      if (res?.data) {
        setPreview({ params, data: res.data });
      } else if (res?.notImplemented) {
        // Endpoint not deployed yet: clearly-labeled client-side stand-in.
        setPreview({ params, data: buildPreviewStub(params.targetId, params.severity, chokepointsRef.current, routeChokepointRef.current) });
      }
      // Transient failure: keep the last good preview, show nothing misleading.
    }, 300);
    return () => clearTimeout(timer);
  }, [targetId, severity, duration]);

  const { status, results: rawResults, error } = useJobPolling(jobId, scenarioId);

  // Live jobs return the raw simulation shape; the adapter fills in the
  // presentation fields the panels read. Snapshot results pass through as-is.
  const results = useMemo(
    () => (rawResults ? adaptScenarioResults(rawResults, lastRun) : rawResults),
    [rawResults, lastRun],
  );

  // The preview shows unless the real run on the SAME params has landed; the
  // completed run is always the source of truth for its own parameters.
  const previewShown = !!preview && (
    !results ||
    preview.params.targetId !== lastRun.targetId ||
    preview.params.severity !== lastRun.severity ||
    preview.params.duration !== lastRun.duration
  );

  // Completed runs (or a labeled preview estimate) recolor the map: scenario
  // risk stacks on the live baseline.
  const activeOverlay = previewShown ? preview.data : results;
  const saturatedIds = previewShown ? preview.data.saturated : undefined;
  const { routes: displayRoutes, chokepoints: displayChokepoints } = useMemo(
    () => applyScenarioOverlay(routes, chokepoints, activeOverlay, saturatedIds),
    [routes, chokepoints, activeOverlay, saturatedIds],
  );

  // A target already at or near maximum baseline risk cannot visibly react to
  // the severity slider; say so instead of looking broken. The preview
  // endpoint reports the same condition via its saturated array.
  const targetBaseline = chokepoints.find(c => c.id === targetId)?.risk ?? null;
  const targetSaturated = (targetBaseline != null && targetBaseline >= 90)
    || (previewShown && (preview.data.saturated ?? []).includes(targetId));

  // Derived instead of synced: spinning while the scenario is being created or
  // while a job exists that has not finished yet.
  const running = submitting || (jobId !== null && status !== 'COMPLETED' && status !== 'FAILED' && !error);

  // Refs mirrored for async preview callbacks (never written during render).
  const chokepointsRef = useRef<ChokepointRow[]>(HACKATHON_CHOKEPOINTS);
  const routeChokepointRef = useRef<Record<string, string | null | undefined>>({});

  useEffect(() => {
    // ApiClient serves live data and falls back to snapshot payloads, so this
    // populates the map and target search in either mode.
    Promise.all([ApiClient.getWatchlistAssets(), ApiClient.getWorldChokepoints(), ApiClient.getWorldRoutes()])
      .then(([liveAssets, liveChokepoints, liveRoutes]) => {
        setAssets(toMapAssets(liveAssets));
        const cps = toChokepoints(liveChokepoints);
        setChokepoints(cps);
        chokepointsRef.current = cps;
        setRoutes(toSupplyRoutes(liveRoutes));
        routeChokepointRef.current = Object.fromEntries(liveRoutes.map(r => [r.id, r.chokepoint_id]));
        setLiveTargets([
          ...liveChokepoints.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name, kind: 'Chokepoint' })),
          ...liveAssets.map((a: { id: string; name: string; type: string }) => ({ id: a.id, name: a.name, kind: a.type })),
        ]);
      })
      .catch(e => console.error(e));
  }, []);

  const runSimulation = async () => {
    setSubmitting(true);
    setJobId(null);
    setScenarioId(null);
    setRunMode('live');
    setLastRun({ targetId, severity, duration });
    try {
      const scenario = await ApiClient.createScenario({
        name: scenarioName,
        target_id: targetId,
        severity: severity,
        duration_days: duration
      });

      const job = await ApiClient.runScenario(scenario.id);

      // Honest labeling: a run that did not go through the real queue is
      // flagged next to the results, never presented as a live job.
      if (String(job.job_id) === 'JOB-SNAPSHOT-001' || String(scenario.id) === 'SCN-SNAPSHOT-001') {
        setRunMode('snapshot');
      } else if ((job as { execution_mode?: string }).execution_mode === 'sync_fallback') {
        setRunMode('sync_fallback');
      }

      setScenarioId(scenario.id);
      setJobId(job.job_id);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const saveScenario = () => {
    const entry: SavedScenario = {
      id: `SCN-${new Date().toISOString().slice(0, 10)}-${String(Date.now() % 10000).padStart(4, '0')}`,
      name: scenarioName,
      targetId,
      severity,
      duration,
      commodities,
      regions,
      p50Gap: results?.monte_carlo?.p50_gap ?? null,
      econTotal: results?.economic_impact?.impact?.total ?? null,
      savedAt: new Date().toISOString(),
    };
    const next = [entry, ...savedScenarios].slice(0, 12);
    setSavedScenarios(next);
    localStorage.setItem('gear_saved_scenarios', JSON.stringify(next));
    showToast(`Saved ${entry.id}`);
  };

  const shareLink = async () => {
    const url = `${window.location.origin}/scenario-lab?target_id=${encodeURIComponent(targetId)}&severity=${severity}&duration=${duration}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Scenario link copied');
    } catch {
      showToast(url);
    }
  };

  const copyScenarioId = async () => {
    const id = scenarioId || 'No scenario run yet';
    try {
      await navigator.clipboard.writeText(id);
      showToast('Scenario ID copied');
    } catch { /* clipboard unavailable */ }
  };

  const downloadCSV = () => {
    if (!results) { showToast('Run a simulation first'); return; }
    const km = results.key_metrics || {};
    const rows: string[][] = [
      ['GEAR Scenario Export'],
      ['Name', scenarioName],
      ['Target', targetId],
      ['Severity', `${Math.round(severity * 100)}%`],
      ['Duration (days)', String(duration)],
      [],
      ['Metric', 'Value'],
      ['Supply Gap P10 (M bbl)', results.monte_carlo?.p10_gap],
      ['Supply Gap P50 (M bbl)', results.monte_carlo?.p50_gap],
      ['Supply Gap P90 (M bbl)', results.monte_carlo?.p90_gap],
      ['Economic Impact Total ($B)', results.economic_impact?.impact?.total],
      ['Oil Price ($/bbl)', km.oil_price_usd],
      ['LNG Price ($/MMBtu)', km.lng_price_usd],
      ['Shipping Cost Index', km.shipping_cost_index],
      ['Refinery Utilization (%)', km.refinery_utilization_pct],
      [],
      ['Commodity', 'Baseline (Mb/d)', 'After Scenario', 'Change (%)'],
      ...(results.affected_volumes || []).map((v: { commodity: string; baseline: number; after: number; change_pct: number }) =>
        [v.commodity, v.baseline, v.after, `-${v.change_pct}%`]),
    ];
    const csv = rows.map(r => (r as (string | number)[]).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${(scenarioId || 'scenario')}-data.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('CSV downloaded');
  };

  const downloadReport = () => {
    if (!results) { showToast('Run a simulation first'); return; }
    const km = results.key_metrics || {};
    const ind = results.india_impact || {};
    const html = `<!doctype html><html><head><title>GEAR Scenario Report</title>
      <style>body{font-family:Georgia,serif;margin:40px;color:#111}h1{font-size:20px}h2{font-size:14px;margin-top:24px;border-bottom:1px solid #999;padding-bottom:4px}
      table{border-collapse:collapse;margin-top:8px}td,th{border:1px solid #bbb;padding:4px 10px;font-size:12px;text-align:left}</style></head><body>
      <h1>GEAR Scenario Report: ${scenarioName}</h1>
      <p>Target: <b>${targetId}</b> - Severity: <b>${Math.round(severity * 100)}%</b> - Duration: <b>${duration} days</b> - Scenario ID: <b>${scenarioId ?? 'n/a'}</b></p>
      <h2>Monte Carlo Supply Gap (M bbl)</h2>
      <table><tr><th>P10</th><th>P50</th><th>P90</th><th>Simulations</th></tr>
      <tr><td>${results.monte_carlo?.p10_gap}</td><td>${results.monte_carlo?.p50_gap}</td><td>${results.monte_carlo?.p90_gap}</td><td>${results.uncertainty?.sample_count}</td></tr></table>
      <h2>Key Metrics</h2>
      <table><tr><th>Oil Price</th><th>LNG Price</th><th>Shipping Index</th><th>Refinery Utilization</th><th>Reserve Depletion</th></tr>
      <tr><td>$${km.oil_price_usd}/bbl</td><td>$${km.lng_price_usd}/MMBtu</td><td>${km.shipping_cost_index}</td><td>${km.refinery_utilization_pct}%</td><td>${km.reserve_depletion_days} days</td></tr></table>
      <h2>Economic Impact (India)</h2>
      <table><tr><th>Fuel Price</th><th>Inflation</th><th>Current Account</th><th>GDP</th><th>Total Est. Impact</th></tr>
      <tr><td>+${ind.fuel_price_pct}%</td><td>+${ind.inflation_pct}%</td><td>-$${ind.current_account_b}B</td><td>-${ind.gdp_pct}%</td><td>$${results.economic_impact?.impact?.total}B</td></tr></table>
      <h2>Affected Volumes (Mb/d)</h2>
      <table><tr><th>Commodity</th><th>Baseline</th><th>After Scenario</th><th>Change</th></tr>
      ${(results.affected_volumes || []).map((v: { commodity: string; baseline: number; after: number; change_pct: number }) =>
        `<tr><td>${v.commodity}</td><td>${v.baseline}</td><td>${v.after}</td><td>-${v.change_pct}%</td></tr>`).join('')}</table>
      <script>window.print()</script></body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      showToast('Report opened, use Save as PDF');
    } else {
      showToast('Popup blocked, allow popups for report');
    }
  };

  // Generate bell curve data based on backend P10, P50, P90
  const mcData = results?.monte_carlo ? generateBellCurve(results.monte_carlo.p10_gap, results.monte_carlo.p50_gap, results.monte_carlo.p90_gap) : [];

  const km = results?.key_metrics;
  const ind = results?.india_impact;
  const sevLabel = severityLabel(severity);

  const volumeRows = (results?.affected_volumes || []).filter((v: { commodity: string }) =>
    commodities.length === 0 || commodities.includes(v.commodity) || v.commodity === 'Products');
  const volumeTotal = volumeRows.reduce((acc: { baseline: number; after: number }, v: { baseline: number; after: number }) =>
    ({ baseline: acc.baseline + v.baseline, after: acc.after + v.after }), { baseline: 0, after: 0 });

  const impactCards: Record<ImpactTab, { title: string; value: string; sub: string; icon: React.ReactNode; color: string; graphPath: string }[]> = {
    'Physical Impact': [
      { title: 'Supply Gap', value: results ? `${results.monte_carlo?.p50_gap}M` : '--', sub: '↓ vs Baseline', icon: <Building className="w-3.5 h-3.5" />, color: 'blue', graphPath: 'M0,25 L10,23 L20,25 L30,20 L40,22 L50,18 L60,20 L70,12 L80,15 L90,8 L100,10' },
      { title: 'Storage Depletion', value: results?.impact?.storage_depletion != null ? `${results.impact.storage_depletion}%` : '--', sub: '↓ vs Baseline', icon: <DatabaseIcon />, color: 'emerald', graphPath: 'M0,26 L15,24 L30,25 L45,20 L60,22 L75,17 L90,19 L100,15' },
      { title: 'Route Disruption', value: results?.graph_overlay ? `${results.graph_overlay.blast_radius?.affected_routes?.length || 0}` : '--', sub: 'Routes Affected', icon: <RouteIcon />, color: 'amber', graphPath: 'M0,24 L10,23 L20,25 L30,22 L40,24 L50,18 L60,14 L70,11 L80,16 L90,18 L100,20' },
      { title: 'Exposed Assets', value: results?.graph_overlay ? `${results.graph_overlay.blast_radius?.affected_assets?.length || 0}` : '--', sub: 'Downstream Assets', icon: <Anchor className="w-3.5 h-3.5" />, color: 'red', graphPath: 'M0,25 L10,22 L20,24 L30,19 L40,21 L50,16 L60,18 L70,14 L80,17 L90,12 L100,15' },
      { title: 'Exposed Nations', value: results?.graph_overlay ? `${results.graph_overlay.blast_radius?.affected_countries?.length || 0}` : '--', sub: 'Downstream Nations', icon: <Globe className="w-3.5 h-3.5" />, color: 'emerald', graphPath: 'M0,15 L15,14 L30,17 L45,15 L60,21 L75,19 L90,25 L100,24' },
      { title: 'Trade Flows', value: results?.graph_overlay ? `${results.graph_overlay.blast_radius?.affected_trade_flows?.length || 0}` : '--', sub: 'Flows Affected', icon: <Clock className="w-3.5 h-3.5" />, color: 'purple', graphPath: 'M0,26 L15,25 L30,27 L45,21 L60,23 L75,17 L90,19 L100,15' },
    ],
    'Logistics Impact': [
      { title: 'Port Congestion', value: km ? `${km.port_congestion_pct}%` : '--', sub: '↑ vs Baseline', icon: <Anchor className="w-3.5 h-3.5" />, color: 'red', graphPath: 'M0,25 L10,22 L20,24 L30,19 L40,21 L50,16 L60,18 L70,14 L80,17 L90,12 L100,15' },
      { title: 'Rerouted Flows', value: km ? `${km.rerouted_flows}` : '--', sub: 'Diversions Active', icon: <RouteIcon />, color: 'amber', graphPath: 'M0,24 L10,23 L20,25 L30,22 L40,24 L50,18 L60,14 L70,11 L80,16 L90,18 L100,20' },
      { title: 'Avg Delivery Delay', value: km ? `${km.avg_delay_days}d` : '--', sub: '↑ vs Baseline', icon: <Clock className="w-3.5 h-3.5" />, color: 'purple', graphPath: 'M0,26 L15,25 L30,27 L45,21 L60,23 L75,17 L90,19 L100,15' },
      { title: 'Shipping Cost Index', value: km ? `${km.shipping_cost_index}` : '--', sub: '↑ vs Baseline', icon: <Ship className="w-3.5 h-3.5" />, color: 'blue', graphPath: 'M0,25 L10,23 L20,25 L30,20 L40,22 L50,18 L60,20 L70,12 L80,15 L90,8 L100,10' },
      { title: 'Chokepoint Transit', value: km ? `-${Math.round(km.port_congestion_pct * 0.6)}%` : '--', sub: '↓ Throughput', icon: <Globe className="w-3.5 h-3.5" />, color: 'emerald', graphPath: 'M0,15 L15,14 L30,17 L45,15 L60,21 L75,19 L90,25 L100,24' },
      { title: 'Storage Drawdown', value: results?.impact?.storage_depletion != null ? `${results.impact.storage_depletion}%` : '--', sub: '↓ vs Baseline', icon: <DatabaseIcon />, color: 'emerald', graphPath: 'M0,26 L15,24 L30,25 L45,20 L60,22 L75,17 L90,19 L100,15' },
    ],
    'Market Impact': [
      { title: 'Oil Price', value: km ? `$${km.oil_price_usd}` : '--', sub: `↑ ${km ? km.oil_price_pct : '--'}% /bbl`, icon: <DollarSign className="w-3.5 h-3.5" />, color: 'amber', graphPath: 'M0,25 L10,23 L20,25 L30,20 L40,22 L50,18 L60,20 L70,12 L80,15 L90,8 L100,10' },
      { title: 'LNG Price', value: km ? `$${km.lng_price_usd}` : '--', sub: `↑ ${km ? km.lng_price_pct : '--'}% /MMBtu`, icon: <Flame className="w-3.5 h-3.5" />, color: 'red', graphPath: 'M0,25 L10,22 L20,24 L30,19 L40,21 L50,16 L60,18 L70,14 L80,17 L90,12 L100,15' },
      { title: 'Volatility', value: km ? `${km.volatility_pct}%` : '--', sub: '↑ 30d Implied', icon: <BarChart2 className="w-3.5 h-3.5" />, color: 'purple', graphPath: 'M0,26 L15,25 L30,27 L45,21 L60,23 L75,17 L90,19 L100,15' },
      { title: 'Price Impact', value: results ? `$${results.economic_impact?.impact?.price_impact}B` : '--', sub: '↑ vs Baseline', icon: <Zap className="w-3.5 h-3.5" />, color: 'blue', graphPath: 'M0,24 L10,23 L20,25 L30,22 L40,24 L50,18 L60,14 L70,11 L80,16 L90,18 L100,20' },
      { title: 'Supply Shortage', value: results ? `$${results.economic_impact?.impact?.supply_shortage}B` : '--', sub: '↑ vs Baseline', icon: <ArrowDownCircle className="w-3.5 h-3.5" />, color: 'red', graphPath: 'M0,25 L10,22 L20,24 L30,19 L40,21 L50,16 L60,18 L70,14 L80,17 L90,12 L100,15' },
      { title: 'Replacement Cost', value: results ? `$${results.economic_impact?.impact?.replacement_procurement}B` : '--', sub: 'Procurement', icon: <Building className="w-3.5 h-3.5" />, color: 'emerald', graphPath: 'M0,15 L15,14 L30,17 L45,15 L60,21 L75,19 L90,25 L100,24' },
    ],
    'Economic Impact': [
      { title: 'Total Impact', value: results ? `$${results.economic_impact?.impact?.total}B` : '--', sub: 'P50 Estimate', icon: <Gauge className="w-3.5 h-3.5" />, color: 'red', graphPath: 'M0,25 L10,22 L20,24 L30,19 L40,21 L50,16 L60,18 L70,14 L80,17 L90,12 L100,15' },
      { title: 'Supply Shortage', value: results ? `$${results.economic_impact?.impact?.supply_shortage}B` : '--', sub: '↑ vs Baseline', icon: <ArrowDownCircle className="w-3.5 h-3.5" />, color: 'blue', graphPath: 'M0,25 L10,23 L20,25 L30,20 L40,22 L50,18 L60,20 L70,12 L80,15 L90,8 L100,10' },
      { title: 'Logistics', value: results ? `$${results.economic_impact?.impact?.logistics}B` : '--', sub: '↑ vs Baseline', icon: <Ship className="w-3.5 h-3.5" />, color: 'amber', graphPath: 'M0,24 L10,23 L20,25 L30,22 L40,24 L50,18 L60,14 L70,11 L80,16 L90,18 L100,20' },
      { title: 'Reserve Impact', value: results ? `$${results.economic_impact?.impact?.reserve}B` : '--', sub: 'SPR Drawdown', icon: <DatabaseIcon />, color: 'emerald', graphPath: 'M0,26 L15,24 L30,25 L45,20 L60,22 L75,17 L90,19 L100,15' },
      { title: 'P10 Range', value: results ? `$${results.economic_impact?.uncertainty?.p10}B` : '--', sub: '↓ Optimistic', icon: <BarChart2 className="w-3.5 h-3.5" />, color: 'emerald', graphPath: 'M0,15 L15,14 L30,17 L45,15 L60,21 L75,19 L90,25 L100,24' },
      { title: 'P90 Range', value: results ? `$${results.economic_impact?.uncertainty?.p90}B` : '--', sub: '↑ Pessimistic', icon: <BarChart2 className="w-3.5 h-3.5" />, color: 'purple', graphPath: 'M0,26 L15,25 L30,27 L45,21 L60,23 L75,17 L90,19 L100,15' },
    ],
  };

  const keyMetrics = [
    { label: 'Global Supply Gap', icon: <ArrowDownCircle size={16} />, iconCls: 'border-red-500/50 text-red-500 bg-red-950/30', pct: km ? `↑ ${km.supply_gap_pct}%` : '--', up: true, value: km ? `${km.supply_gap_mbd}` : '--', unit: 'Mb/d', spark: 'red' },
    { label: 'Price Impact (Oil)', icon: <DollarSign size={16} />, iconCls: 'border-amber-500/50 text-amber-500 bg-amber-950/30', pct: km ? `↑ ${km.oil_price_pct}%` : '--', up: true, value: km ? `$${km.oil_price_usd}` : '--', unit: '/bbl', spark: 'red' },
    { label: 'LNG Price Impact', icon: <Flame size={16} />, iconCls: 'border-orange-500/50 text-orange-500 bg-orange-950/30', pct: km ? `↑ ${km.lng_price_pct}%` : '--', up: true, value: km ? `$${km.lng_price_usd}` : '--', unit: '/MMBtu', spark: 'red' },
    { label: 'Reserve Depletion (India)', icon: <Building size={16} />, iconCls: 'border-emerald-500/50 text-emerald-500 bg-emerald-950/30', pct: km ? `↑ ${km.reserve_depletion_pct}%` : '--', up: true, value: km ? `${km.reserve_depletion_days}` : '--', unit: 'Days', spark: 'green' },
    { label: 'Shipping Cost Index', icon: <Ship size={16} />, iconCls: 'border-blue-500/50 text-blue-500 bg-blue-950/30', pct: km ? `↑ ${km.shipping_cost_pct}%` : '--', up: true, value: km ? `${km.shipping_cost_index}` : '--', unit: 'Index', spark: 'red' },
    { label: 'Refinery Utilization (India)', icon: <Factory size={16} />, iconCls: 'border-slate-500/50 text-slate-400 bg-slate-800/30', pct: km ? `↓ ${km.refinery_utilization_delta_pct}%` : '--', up: false, value: km ? `${km.refinery_utilization_pct}` : '--', unit: '%', spark: 'green' },
  ];

  return (
    <div className="h-full min-h-[850px] min-w-[1280px] w-full bg-[#0f181b] p-3 flex flex-col gap-3 text-slate-300 font-sans">

      <SnapshotFallbackBadge />

      {/* TOAST */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-emerald-700/60 text-emerald-300 text-xs font-bold px-4 py-2 rounded shadow-2xl">
          {toast}
        </div>
      )}

      {/* COMPARE STRATEGIES MODAL */}
      {compareOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center" onClick={() => setCompareOpen(false)}>
          <div className="bg-[#141d22] border border-slate-700 rounded-md shadow-2xl w-[640px] max-h-[70vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3 border-b border-slate-700/60 pb-2">
              <h3 className="text-[12px] font-black tracking-wider text-white uppercase">Compare Saved Scenarios</h3>
              <button onClick={() => setCompareOpen(false)} className="text-slate-400 hover:text-white text-lg leading-none">×</button>
            </div>
            {savedScenarios.length === 0 ? (
              <div className="text-xs text-slate-500 py-6 text-center">No saved scenarios yet. Run a simulation and press Save Scenario.</div>
            ) : (
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-700/50">
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Target</th>
                    <th className="pb-2 font-medium text-right">Severity</th>
                    <th className="pb-2 font-medium text-right">Days</th>
                    <th className="pb-2 font-medium text-right">P50 Gap</th>
                    <th className="pb-2 font-medium text-right">Econ Impact</th>
                  </tr>
                </thead>
                <tbody className="font-bold text-slate-300">
                  {savedScenarios.map(s => (
                    <tr key={s.id} className="border-b border-slate-800/50 last:border-0">
                      <td className="py-2 pr-2 truncate max-w-[160px]">{s.name}</td>
                      <td className="py-2 pr-2 font-mono text-[10px] text-slate-400">{s.targetId}</td>
                      <td className="py-2 text-right">{Math.round(s.severity * 100)}%</td>
                      <td className="py-2 text-right">{s.duration}</td>
                      <td className="py-2 text-right text-amber-400">{s.p50Gap != null ? `${s.p50Gap}M` : '--'}</td>
                      <td className="py-2 text-right text-red-400">{s.econTotal != null ? `$${s.econTotal}B` : '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex justify-between items-center bg-[#182227] rounded-md border border-slate-700/50 p-2 px-4 shadow-sm shrink-0">
        <h1 className="text-sm font-black tracking-widest text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] flex items-center gap-2 uppercase">
           <Activity className="h-4 w-4 text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]" />
           SCENARIO SIMULATION LAB
        </h1>
        <div className="flex items-center gap-2">
          {status === 'COMPLETED' && scenarioId && (
            <button
              onClick={() => router.push(`/response-orchestrator?scenario_id=${scenarioId}`)}
              className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors shadow shadow-blue-900/50"
            >
              Proceed to Response Orchestrator
            </button>
          )}
          <button onClick={() => setCompareOpen(true)} className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-[#0f181b] hover:bg-slate-800 border border-slate-700 rounded transition-colors">
            Compare Strategies
          </button>
          <button onClick={saveScenario} className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-600 border border-emerald-800 rounded transition-colors">
            Save Scenario
          </button>
        </div>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-md p-3 flex items-start justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-red-400">Simulation Job Failed</h3>
              <p className="text-xs text-slate-300 mt-0.5">{error}</p>
              {jobId && <p className="text-[10px] text-slate-500 font-mono mt-1">Job ID: {jobId}</p>}
            </div>
          </div>
          <button onClick={runSimulation} className="px-4 py-1.5 bg-red-900/50 hover:bg-red-800 text-red-200 text-xs font-bold rounded transition-colors border border-red-700/50">
            Retry Simulation
          </button>
        </div>
      )}

      {/* MAIN GRID */}
      <div className="flex-1 flex gap-3 min-h-0">

        {/* LEFT COLUMN: CONFIGURATION PANEL */}
        <div className="w-[300px] flex flex-col gap-3 flex-shrink-0 bg-[#182227] rounded-md border border-slate-700/50 overflow-y-auto no-scrollbar shadow-sm">
          <div className="p-3 border-b border-slate-700/50 font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] uppercase tracking-wider bg-slate-800/20">
            Configuration Panel
          </div>
          <div className="p-4 flex flex-col gap-5">
            <div>
              <label className="block text-[13px] font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] uppercase tracking-wider mb-2">Event Type</label>
              <select
                value={eventType}
                onChange={(e) => selectEvent(e.target.value)}
                className="w-full bg-[#11181c] border border-slate-700/80 rounded p-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500 appearance-none"
              >
                {Object.keys(EVENT_TARGETS).map(ev => <option key={ev}>{ev}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] uppercase tracking-wider mb-2">Target</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  value={targetSearch}
                  onChange={(e) => setTargetSearch(e.target.value)}
                  placeholder="Search chokepoint or region..."
                  className="w-full bg-[#11181c] border border-slate-700/80 rounded py-2 pr-2 pl-8 text-[11px] font-bold text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-500"
                />
                {targetMatches.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-[#101a1f] border border-slate-700 rounded shadow-2xl z-30 overflow-hidden">
                    {targetMatches.map(t => (
                      <button
                        key={t.id}
                        onClick={() => selectTarget(t)}
                        className="w-full flex justify-between items-center px-3 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800 text-left"
                      >
                        <span className="font-bold">{t.name}</span>
                        <span className="text-[9px] text-slate-500 uppercase">{t.kind}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-2 h-24 bg-[#0a1014] rounded-md border border-slate-700/80 flex items-center justify-center relative overflow-hidden">
                 <img src="/target-map.png" alt="Target Map" className="w-full h-full object-cover opacity-80" />
                 <div className="absolute bottom-1 right-1.5 flex items-center gap-1 bg-red-950/80 border border-red-900 rounded px-1.5 py-0.5 text-[9px] font-bold text-red-300">
                   <MapPin size={9} /> {targetId}
                 </div>
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] uppercase tracking-wider mb-2">Target ID</label>
              <input type="text" value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-full bg-[#11181c] border border-slate-700/80 rounded p-2 text-xs font-bold text-red-400 focus:outline-none focus:border-red-500" />
              {targetSaturated && (
                <p className="mt-1.5 flex items-start gap-1.5 text-[10px] font-bold leading-snug text-amber-400">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  Baseline risk is already {targetBaseline != null ? `${targetBaseline}/100` : 'at maximum'}. Severity changes will barely move this target on the map. Pick a lower-risk target such as the Strait of Malacca to see the map react.
                </p>
              )}
            </div>

            <div className="space-y-4">
              <label className="block text-[13px] font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] uppercase tracking-wider">Parameters</label>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[12px] font-black text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">Severity: <span className="font-bold text-slate-200 drop-shadow-none">{(severity * 100).toFixed(0)}%</span> <span className={`font-bold ml-1 ${sevLabel.cls}`}>{sevLabel.text}</span></span>
                  <input type="number" value={(severity * 100).toFixed(0)} readOnly className="w-14 bg-[#11181c] border border-slate-700/80 rounded py-1 px-2 text-xs font-bold text-center text-white outline-none" />
                </div>
                <input type="range" min="0" max="1" step="0.05" value={severity} onChange={(e) => setSeverity(parseFloat(e.target.value))} className="w-full accent-emerald-500 h-1 bg-slate-400 rounded-lg appearance-none cursor-pointer drop-shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                <div className="flex justify-between mt-1.5 text-[10px] text-slate-400 font-bold"><span>Low</span><span className="text-center">Moderate</span><span>High</span></div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[12px] font-black text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">Duration: <span className="font-bold text-slate-200 drop-shadow-none">{duration} Days</span></span>
                  <input type="number" value={duration} readOnly className="w-14 bg-[#11181c] border border-slate-700/80 rounded py-1 px-2 text-xs font-bold text-center text-white outline-none" />
                </div>
                <input type="range" min="1" max="120" step="1" value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} className="w-full accent-emerald-500 h-1 bg-slate-400 rounded-lg appearance-none cursor-pointer drop-shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                <div className="flex justify-between mt-1.5 text-[10px] text-slate-400 font-bold"><span>0 Days</span><span className="text-center">60</span><span>120 Days</span></div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="block text-[13px] font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] uppercase tracking-wider">Commodity</label>
              <div className="flex items-center gap-4 text-[11px] font-bold text-slate-200 flex-wrap">
                {['Crude Oil', 'LNG', 'Coal', 'Electricity'].map(c => (
                  <label key={c} className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
                    <div className={`w-4 h-4 rounded-sm flex items-center justify-center border ${commodities.includes(c) ? 'bg-[#3e6853] border-[#3e6853] drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-transparent border-slate-500'}`}>
                      {commodities.includes(c) && <svg viewBox="0 0 24 24" width="12" height="12" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                    </div>
                    <input type="checkbox" className="hidden" checked={commodities.includes(c)} onChange={() => toggleCommodity(c)} />
                    {c}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-2 pb-2">
              <label className="block text-[13px] font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] uppercase tracking-wider">Regions/Assets Affected</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Add region and press Enter..."
                  value={regionSearch}
                  onChange={(e) => setRegionSearch(e.target.value)}
                  onKeyDown={handleRegionKeyDown}
                  className="w-full bg-[#11181c] border border-slate-700/80 rounded-md px-3 py-2 pl-8 text-[11px] font-bold text-white focus:outline-none focus:border-slate-500"
                />
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {regions.map(r => (
                  <div key={r} className="flex items-center gap-1.5 bg-[#1a2327] border border-slate-700/80 rounded px-2.5 py-1 text-[11px] text-slate-300">
                    {r}
                    <button onClick={() => removeRegion(r)} className="text-slate-500 hover:text-white mt-0.5">×</button>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={runSimulation}
              disabled={running}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 bg-[#3e6853] hover:bg-[#2d4d3d] disabled:bg-slate-700 text-white text-[13px] font-bold rounded-md transition-colors shadow-sm"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {running ? 'Running...' : 'Run Simulation'}
            </button>
          </div>
        </div>

        {/* CENTER COLUMN: RESULTS */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">

          {/* IMPACT CASCADE VIEW */}
          <div className="bg-[#182227] rounded-md border border-slate-700/50 p-3 h-[105px] flex-shrink-0 shadow-sm flex flex-col justify-between">
             <div className="flex justify-between items-center mb-1 w-full px-1">
               <h3 className="text-[12px] font-black tracking-wider text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] uppercase">IMPACT CASCADE VIEW</h3>
               <button
                 onClick={() => setTimelineMode(m => !m)}
                 className={`px-3 py-1 text-[10px] border rounded transition-colors ${timelineMode ? 'border-cyan-600/60 bg-cyan-800/40 text-cyan-200' : 'border-slate-600 text-slate-400 hover:bg-slate-700 bg-[#182227]'}`}
               >
                 {timelineMode ? 'View as Cascade' : 'View as Timeline'}
               </button>
             </div>

             <div className="flex-1 bg-[#151a1e] border border-slate-800/80 rounded-md overflow-hidden mt-1 px-3 py-1">
                {timelineMode
                  ? <CascadeTimeline duration={duration} severity={severity} />
                  : <CascadeFlow eventType={eventType} severity={severity} km={km} ind={ind} />}
             </div>
          </div>

          {/* MAIN MAP */}
          <div className="flex-1 bg-[#182227] rounded-md border border-slate-700/50 relative overflow-hidden shadow-sm">
             <div className="absolute inset-0 bg-slate-950 flex items-center justify-center">
                 {assets.length > 0 ? (
                   <MapViewer
                     assets={assets}
                     routes={displayRoutes}
                     chokepoints={displayChokepoints}
                     overlayPreview={previewShown}
                     onFeatureSelect={(f: SelectedMapFeature) => {
                       setTargetId(f.id);
                       setScenarioName(`Disruption: ${f.name}`);
                       showToast(`Target set: ${f.name}`);
                     }}
                   />
                 ) : <div className="animate-pulse text-sm">Loading Graph...</div>}
             </div>

             {previewShown && (
               <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 rounded border border-dashed border-amber-500/80 bg-amber-950/90 px-3 py-1 text-[10px] font-black tracking-wider text-amber-300 backdrop-blur">
                 PREVIEW ESTIMATE, not a full simulation
               </div>
             )}

             {/* Map Legend mimicking reference */}
             <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-slate-700 rounded p-3 text-[10px] text-slate-300 flex flex-col gap-2 z-10 backdrop-blur">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Production</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-500"></div> Refinery</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div> Port / Terminal</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500"></div> Storage Facility</div>
                <div className="flex items-center gap-2 mt-1 border-t border-slate-700 pt-1 text-red-400"><AlertTriangle className="w-3 h-3" /> Chokepoint</div>
                <div className="text-[9px] text-slate-500 border-t border-slate-700 pt-1 mt-1">Click a marker to set it as target</div>
             </div>
          </div>

          {/* SPLIT SUMMARY & CHART */}
          <div className="flex gap-3 h-48 flex-shrink-0">
             <div className="w-1/3 bg-[#182227] rounded-md border border-slate-700/50 p-3 shadow-sm flex flex-col">
                <h3 className="text-[11px] font-black tracking-wider text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] uppercase mb-3">Scenario Summary</h3>
                <div className="flex flex-col gap-2 text-xs flex-1 font-bold">
                   <div className="flex"><span className="w-24 text-slate-400">Name</span><span className="text-slate-200 truncate">{scenarioName}</span></div>
                   <div className="flex"><span className="w-24 text-slate-400">Type</span><span className="text-slate-200">{targetId.startsWith('CHK') ? 'Chokepoint Disruption' : 'Asset Disruption'}</span></div>
                   <div className="flex"><span className="w-24 text-slate-400">Severity</span><span className="text-slate-200">{(severity*100).toFixed(0)}% Capacity Reduction</span></div>
                   <div className="flex"><span className="w-24 text-slate-400">Duration</span><span className="text-slate-200">{duration} Days</span></div>
                   <div className="flex"><span className="w-24 text-slate-400">Commodities</span><span className="text-slate-200 truncate">{commodities.length ? commodities.join(', ') : 'All'}</span></div>
                </div>
             </div>

             <div className="flex-1 bg-[#182227] rounded-md border border-slate-700/50 p-3 shadow-sm flex flex-col relative">
                <h3 className="text-[11px] font-black tracking-wider text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] uppercase mb-2">Monte Carlo Outlook <span className="text-slate-400 normal-case drop-shadow-none">(Supply Gap)</span></h3>

                {results?.monte_carlo ? (
                  <div className="flex-1 flex">
                    <div className="flex-1 -ml-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={mcData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorProb" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                          <XAxis dataKey="gap" tick={{fontSize: 9, fill: '#64748b'}} stroke="#334155" />
                          <YAxis tick={{fontSize: 9, fill: '#64748b'}} stroke="#334155" />
                          <Tooltip contentStyle={{backgroundColor: '#0f172a', border: '1px solid #1e293b', fontSize: '10px'}} />
                          <Area type="monotone" dataKey="probability" stroke="#3b82f6" fillOpacity={1} fill="url(#colorProb)" />
                          <ReferenceLine x={results.monte_carlo.p10_gap} stroke="#10b981" strokeDasharray="3 3" label={{ position: 'top', value: 'P10', fill: '#10b981', fontSize: 9 }} />
                          <ReferenceLine x={results.monte_carlo.p50_gap} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'top', value: 'P50', fill: '#f59e0b', fontSize: 9 }} />
                          <ReferenceLine x={results.monte_carlo.p90_gap} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: 'P90', fill: '#ef4444', fontSize: 9 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-32 flex flex-col justify-center gap-3 pl-2 text-xs font-bold">
                       <div className="flex justify-between"><span className="text-slate-400">Expected (P50)</span><span className="text-slate-200">{results.monte_carlo.p50_gap}M</span></div>
                       <div className="flex justify-between"><span className="text-emerald-400">P10 (Optimistic)</span><span className="text-emerald-400">{results.monte_carlo.p10_gap}M</span></div>
                       <div className="flex justify-between"><span className="text-red-400">P90 (Pessimistic)</span><span className="text-red-400">{results.monte_carlo.p90_gap}M</span></div>
                       <div className="border-t border-slate-700 mt-2 pt-2 flex justify-between">
                         <span className="text-slate-400 text-[10px]">Simulations Run</span>
                         <span className="text-slate-200 text-[10px]">{results.uncertainty?.sample_count || 'UNAVAILABLE'}</span>
                       </div>
                       <div>
                         <div className="flex justify-between text-[10px] mb-1">
                           <span className="text-slate-500">Confidence</span>
                           <span className="text-blue-400">
                             {results.uncertainty?.sample_count ? 'HIGH' : 'UNAVAILABLE'}
                           </span>
                         </div>
                       </div>
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 mt-6">Run simulation to generate probability distribution</div>
                )}
             </div>
          </div>

          {/* IMPACT BREAKDOWN ROW */}
          <div className="flex flex-col gap-2 mt-3 flex-shrink-0 relative">
             <div className="flex items-center gap-4 mb-1">
                 <h2 className="text-[11px] text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] font-black uppercase tracking-wider ml-1">IMPACT BREAKDOWN</h2>
                 <div className="flex bg-[#11181c] border border-slate-700/50 rounded-md overflow-hidden text-[10px] font-bold">
                    {IMPACT_TABS.map((tab, i) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 py-1 transition-colors ${i < IMPACT_TABS.length - 1 ? 'border-r border-slate-700/50' : ''} ${activeTab === tab ? 'bg-[#1d4ed8]/20 text-blue-400' : 'text-slate-400 hover:bg-slate-800'}`}
                      >
                        {tab}
                      </button>
                    ))}
                 </div>
             </div>

             <div className="flex gap-2 h-[85px] w-full">
               {impactCards[activeTab].map(card => (
                 <ImpactCard key={card.title} title={card.title} value={card.value} sub={card.sub} icon={card.icon} color={card.color} graphPath={card.graphPath} />
               ))}
             </div>
          </div>

        </div>

        {/* RIGHT COLUMN: METRICS */}
        <div className="w-[310px] flex flex-col gap-3 flex-shrink-0 overflow-y-auto no-scrollbar pb-6 text-slate-300">

          {/* KEY IMPACT METRICS */}
          <div className="bg-[#0f171b] rounded-md border border-slate-700/50 p-4 flex flex-col gap-3">
             <h3 className="text-[11px] font-black tracking-wider text-slate-300 uppercase mb-1">Key Impact Metrics <span className="normal-case text-slate-500 font-bold">({duration} Days)</span></h3>

             {keyMetrics.map((m, i) => (
               <div key={m.label} className={`flex justify-between items-center ${i < keyMetrics.length - 1 ? 'border-b border-slate-700/50 pb-3' : 'pt-1'}`}>
                 <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${m.iconCls}`}>
                       {m.icon}
                    </div>
                    <div className="flex flex-col">
                       <span className="text-[11px] font-bold text-slate-200">{m.label}</span>
                       {m.spark === 'red' ? <SparklineRed /> : <SparklineGreen />}
                    </div>
                 </div>
                 <div className="flex flex-col items-end">
                    <span className={`text-[11px] font-black ${m.up ? 'text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]' : 'text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]'}`}>{m.pct}</span>
                    <span className="text-[11px] font-bold text-slate-200">{m.value} <span className="text-[10px] text-slate-400 font-normal">{m.unit}</span></span>
                 </div>
               </div>
             ))}
          </div>

          {/* ECONOMIC IMPACT */}
          <div className="bg-[#0f171b] rounded-md border border-slate-700/50 p-4 flex flex-col gap-3">
             <h3 className="text-[11px] font-black tracking-wider text-slate-300 uppercase mb-1">Economic Impact <span className="normal-case text-slate-500 font-bold">(INDIA)</span></h3>

             <div className="flex justify-between items-center">
                <span className="text-[11px] font-medium text-slate-400">Fuel Price Pressure</span>
                <span className="text-[11px] font-black text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">{ind ? `↑ ${ind.fuel_price_pct}%` : '--'}</span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-[11px] font-medium text-slate-400">Inflation Impact</span>
                <span className="text-[11px] font-black text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">{ind ? `↑ ${ind.inflation_pct}%` : '--'}</span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-[11px] font-medium text-slate-400">Current Account Impact</span>
                <span className="text-[11px] font-black text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]">{ind ? `-$${ind.current_account_b}B` : '--'}</span>
             </div>
             <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] font-medium text-slate-400">GDP Impact</span>
                <span className="text-[11px] font-black text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">{ind ? `↓ -${ind.gdp_pct}%` : '--'}</span>
             </div>
             <div className="text-[9px] text-slate-500 mt-1">
                *Compared to baseline (no disruption)
             </div>
          </div>

          {/* AFFECTED VOLUMES */}
          <div className="bg-[#0f171b] rounded-md border border-slate-700/50 p-4 flex flex-col gap-3">
             <h3 className="text-[11px] font-black tracking-wider text-slate-300 uppercase mb-1">Affected Volumes <span className="normal-case text-slate-500 font-bold">({duration} Days)</span></h3>

             {results ? (
               <table className="w-full text-left text-[11px]">
                 <thead>
                   <tr className="text-slate-500 border-b border-slate-700/50">
                     <th className="pb-2 font-medium">Commodity</th>
                     <th className="pb-2 font-medium text-right">Baseline (Mb/d)</th>
                     <th className="pb-2 font-medium text-right">After Scenario</th>
                     <th className="pb-2 font-medium text-right">Change</th>
                   </tr>
                 </thead>
                 <tbody className="font-bold text-slate-300">
                   {volumeRows.map((v: { commodity: string; baseline: number; after: number; change_pct: number }) => (
                     <tr key={v.commodity}>
                       <td className="py-2">{v.commodity}</td>
                       <td className="py-2 text-right">{v.baseline.toFixed(2)}</td>
                       <td className="py-2 text-right">{v.after.toFixed(2)}</td>
                       <td className="py-2 text-right text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)] font-black">↓ {v.change_pct}%</td>
                     </tr>
                   ))}
                   <tr className="border-t border-slate-700/50">
                     <td className="py-2 pt-3">Total</td>
                     <td className="py-2 pt-3 text-right">{volumeTotal.baseline.toFixed(2)}</td>
                     <td className="py-2 pt-3 text-right">{volumeTotal.after.toFixed(2)}</td>
                     <td className="py-2 pt-3 text-right text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)] font-black">
                       ↓ {volumeTotal.baseline > 0 ? Math.round((1 - volumeTotal.after / volumeTotal.baseline) * 100) : 0}%
                     </td>
                   </tr>
                 </tbody>
               </table>
             ) : (
               <div className="text-[11px] text-slate-500 py-4 text-center">Run simulation to compute affected volumes</div>
             )}
          </div>

          {/* EXPORT & SHARE */}
          <div className="bg-[#0f171b] rounded-md border border-slate-700/50 p-4 flex flex-col gap-3">
             <h3 className="text-[11px] font-black tracking-wider text-slate-300 uppercase mb-2">Export & Share</h3>
             <button onClick={downloadReport} className="w-full py-2 flex items-center justify-center gap-2 text-[11px] font-bold bg-[#1d4ed8]/30 hover:bg-[#1d4ed8]/50 text-blue-400 border border-blue-600/50 rounded-md transition-colors shadow-sm"><Download size={14} /> Download Report (PDF)</button>
             <button onClick={downloadCSV} className="w-full py-2 flex items-center justify-center gap-2 text-[11px] font-bold bg-[#1e293b]/50 hover:bg-[#1e293b] text-slate-300 border border-slate-700/80 rounded-md transition-colors"><Download size={14} /> Download Data (CSV)</button>
             <button onClick={shareLink} className="w-full py-2 flex items-center justify-center gap-2 text-[11px] font-bold bg-[#1e293b]/50 hover:bg-[#1e293b] text-slate-300 border border-slate-700/80 rounded-md transition-colors"><Share2 size={14} /> Share Scenario Link</button>
             <div className="flex justify-between items-center mt-2 text-[10px] text-slate-500">
               <span>Scenario ID: {scenarioId || 'Not yet run'}</span>
               <button onClick={copyScenarioId} title="Copy Scenario ID"><Copy size={12} className="cursor-pointer hover:text-slate-300" /></button>
               {results && runMode === 'snapshot' && (
                 <span className="ml-2 rounded border border-red-500/80 bg-red-950/80 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-red-300">
                   OFFLINE SNAPSHOT RUN, NOT A LIVE SIMULATION
                 </span>
               )}
               {results && runMode === 'sync_fallback' && (
                 <span className="ml-2 rounded border border-amber-500/80 bg-amber-950/80 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-amber-300">
                   INLINE RUN, JOB QUEUE DOWN
                 </span>
               )}
               {results && runMode === 'live' && results.presentation_model && (
                 <span className="ml-2 rounded border border-amber-500/80 bg-amber-950/80 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-amber-300">
                   MODELED ESTIMATE, TARGET NOT IN LIVE GRAPH
                 </span>
               )}
             </div>
          </div>

        </div>

      </div>
    </div>
  );
}

export default function ScenarioLab() {
  return (
    <Suspense fallback={<div className="p-8 text-white">Loading Scenario Lab...</div>}>
      <ScenarioLabContent />
    </Suspense>
  );
}

function ImpactCard({ title, value, sub, icon, color = 'slate', graphPath }: {
  title: string; value: string; sub: string; icon: React.ReactNode; color?: string; graphPath?: string;
}) {
  const colorMap: Record<string, { text: string; border: string; bg: string; stroke: string; fill: string }> = {
    'blue': { text: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-950/30', stroke: '#3b82f6', fill: 'url(#gradBlue)' },
    'emerald': { text: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-950/30', stroke: '#10b981', fill: 'url(#gradEmerald)' },
    'amber': { text: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-950/30', stroke: '#f59e0b', fill: 'url(#gradAmber)' },
    'red': { text: 'text-red-400', border: 'border-red-500/30', bg: 'bg-red-950/30', stroke: '#ef4444', fill: 'url(#gradRed)' },
    'purple': { text: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-950/30', stroke: '#a855f7', fill: 'url(#gradPurple)' },
    'slate': { text: 'text-slate-400', border: 'border-slate-500/30', bg: 'bg-slate-800/30', stroke: '#64748b', fill: 'url(#gradSlate)' },
  };

  const c = colorMap[color] || colorMap.slate;
  const p = graphPath || 'M0,20 L20,18 L40,22 L60,15 L80,18 L100,12';
  const pFill = p + ' L100,30 L0,30 Z';

  return (
    <div className="bg-[#13191d] flex-1 rounded-md border border-slate-700/40 p-2 shadow-sm flex flex-col justify-between group hover:border-slate-600 transition-colors">
      <div className="flex items-center gap-1.5 mb-1 relative z-10">
        <div className={`w-5 h-5 rounded-full border ${c.border} ${c.bg} flex items-center justify-center shrink-0 ${c.text}`}>{icon}</div>
        <span className="text-[9.5px] font-bold text-slate-300 truncate">{title}</span>
      </div>
      <div className="flex items-end justify-between gap-1 flex-1 relative z-10">
         {/* Left Side: Data */}
         <div className="flex flex-col justify-end h-full">
            <div className="text-[13px] font-black text-white leading-none drop-shadow-[0_0_5px_rgba(255,255,255,0.4)]">{value}</div>
            <div className={`text-[8.5px] mt-1 font-bold ${sub.includes('↑') ? 'text-red-400' : (sub.includes('↓') ? 'text-emerald-400' : 'text-slate-500')} whitespace-nowrap`}>
               {sub.includes('↑') ? <span className="drop-shadow-[0_0_3px_rgba(239,68,68,0.5)]">{sub}</span> :
                sub.includes('↓') ? <span className="drop-shadow-[0_0_3px_rgba(16,185,129,0.5)]">{sub}</span> :
                sub}
            </div>
         </div>
         {/* Right Side: Graph */}
         <div className="w-[50px] h-7 opacity-80 shrink-0 mb-0.5">
           <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-full">
             <defs>
                <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5"/><stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/></linearGradient>
                <linearGradient id="gradEmerald" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity="0.5"/><stop offset="100%" stopColor="#10b981" stopOpacity="0"/></linearGradient>
                <linearGradient id="gradAmber" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity="0.5"/><stop offset="100%" stopColor="#f59e0b" stopOpacity="0"/></linearGradient>
                <linearGradient id="gradRed" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity="0.5"/><stop offset="100%" stopColor="#ef4444" stopOpacity="0"/></linearGradient>
                <linearGradient id="gradPurple" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a855f7" stopOpacity="0.5"/><stop offset="100%" stopColor="#a855f7" stopOpacity="0"/></linearGradient>
             </defs>
             <path d={pFill} fill={c.fill} />
             <path d={p} fill="none" stroke={c.stroke} strokeWidth="2" strokeLinejoin="round" />
           </svg>
         </div>
      </div>
    </div>
  );
}

// Math helper for Monte Carlo Chart visual
function generateBellCurve(p10: number, p50: number, p90: number) {
  const stdDev = (p90 - p10) / 2.56; // Approx mapping
  const variance = stdDev * stdDev;
  const data = [];
  for (let i = p10 - (stdDev * 2); i <= p90 + (stdDev * 2); i += (stdDev / 5)) {
    const x = i;
    const probability = (1 / Math.sqrt(2 * Math.PI * variance)) * Math.exp(-Math.pow(x - p50, 2) / (2 * variance));
    // Normalize for chart aesthetics
    data.push({ gap: parseFloat(x.toFixed(1)), probability: probability * 100 });
  }
  return data;
}
// Sparkline components
const SparklineRed = () => (
  <svg viewBox="0 0 100 20" className="w-24 h-3 overflow-visible mt-1">
    <path d="M0,10 Q10,12 20,8 T40,12 T60,6 T80,14 T100,10" fill="none" stroke="#ef4444" strokeWidth="1.5" />
  </svg>
);

const SparklineGreen = () => (
  <svg viewBox="0 0 100 20" className="w-24 h-3 overflow-visible mt-1">
    <path d="M0,10 Q10,8 20,12 T40,8 T60,14 T80,6 T100,10" fill="none" stroke="#10b981" strokeWidth="1.5" />
  </svg>
);

// Icons
const DatabaseIcon = () => <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>;
const RouteIcon = () => <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><circle cx="6" cy="19" r="3"></circle><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"></path><circle cx="18" cy="5" r="3"></circle></svg>;

interface CascadeStageProps {
  icon: React.ReactNode;
  ring: string;
  title: string;
  sub: string;
}

const CascadeStage = ({ icon, ring, title, sub }: CascadeStageProps) => (
  <div className="flex items-center gap-2 flex-shrink-0">
    <div className={`w-8 h-8 rounded-full border flex items-center justify-center ${ring}`}>
      {icon}
    </div>
    <div className="flex flex-col">
      <span className="text-[11px] font-extrabold text-white leading-tight drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">{title}</span>
      <span className="text-[10px] text-slate-400 font-bold leading-tight">{sub}</span>
    </div>
  </div>
);

const CascadeArrow = () => (
  <span className="text-slate-600 text-sm font-bold drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">→</span>
);

const CascadeFlow = ({ eventType, severity, km, ind }: {
  eventType: string; severity: number;
  km?: { oil_price_pct: number; refinery_utilization_delta_pct: number; avg_delay_days: number } | null;
  ind?: { gdp_pct: number } | null;
}) => (
  <div className="flex items-center justify-between w-full h-full overflow-x-auto no-scrollbar">
    <CascadeStage icon={<Activity size={14} />} ring="border-red-500/50 bg-red-950/20 text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]" title="Event Trigger" sub={eventType} />
    <CascadeArrow />
    <CascadeStage icon={<Zap size={14} />} ring="border-amber-500/50 bg-amber-950/20 text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]" title="Supply Shock" sub={`-${Math.round(severity * 100)}% Capacity`} />
    <CascadeArrow />
    <CascadeStage icon={<Anchor size={14} />} ring="border-amber-500/50 bg-amber-950/20 text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]" title="Shipping Impact" sub={km ? `+${km.avg_delay_days}d Delays` : 'Delays & Rerouting'} />
    <CascadeArrow />
    <CascadeStage icon={<MapPin size={14} />} ring="border-emerald-500/50 bg-emerald-950/20 text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" title="Port & Refinery" sub={km ? `-${km.refinery_utilization_delta_pct}% Utilization` : 'Utilization Drop'} />
    <CascadeArrow />
    <CascadeStage icon={<BarChart2 size={14} />} ring="border-purple-500/50 bg-purple-950/20 text-purple-500 drop-shadow-[0_0_5px_rgba(168,85,247,0.5)]" title="Market Impact" sub={km ? `+${km.oil_price_pct}% Prices` : 'Price Increase'} />
    <CascadeArrow />
    <CascadeStage icon={<Gauge size={14} />} ring="border-red-500/50 bg-red-950/20 text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]" title="Economic Impact" sub={ind ? `-${ind.gdp_pct}% GDP` : 'Inflation & GDP'} />
  </div>
);

// Alternative cascade rendering: the same stages placed on a day axis scaled to
// the scenario duration.
const CascadeTimeline = ({ duration, severity }: { duration: number; severity: number }) => {
  const stages = [
    { day: 0, label: 'Event Trigger', color: '#ef4444' },
    { day: Math.max(1, Math.round(duration * 0.05)), label: 'Supply Shock', color: '#f59e0b' },
    { day: Math.round(duration * 0.2), label: 'Shipping Impact', color: '#f59e0b' },
    { day: Math.round(duration * 0.4), label: 'Port & Refinery', color: '#10b981' },
    { day: Math.round(duration * 0.65), label: 'Market Impact', color: '#a855f7' },
    { day: Math.round(duration * 0.9), label: 'Economic Impact', color: '#ef4444' },
  ];
  return (
    <div className="relative w-full h-full px-2">
      <div className="absolute left-2 right-2 top-1/2 h-[2px] bg-slate-700 rounded" />
      {stages.map(s => (
        <div key={s.label} className="absolute top-0 bottom-0 flex flex-col items-center justify-center" style={{ left: `${4 + (s.day / duration) * 88}%` }}>
          <span className="text-[9px] font-bold text-slate-300 whitespace-nowrap mb-0.5">{s.label}</span>
          <div className="w-3 h-3 rounded-full border-2 border-[#151a1e]" style={{ backgroundColor: s.color, boxShadow: `0 0 ${6 + severity * 6}px ${s.color}` }} />
          <span className="text-[9px] font-mono text-slate-500 mt-0.5">Day {s.day}</span>
        </div>
      ))}
    </div>
  );
};
