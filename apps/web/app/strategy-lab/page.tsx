'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, Check, ChevronDown, AlertTriangle } from 'lucide-react';
import { ApiClient } from '@/lib/api';
import { SnapshotFallbackBadge } from '@/components/snapshot-badge';

// ---------------------------------------------------------------------------
// HONESTY RULE (project standard): every value on this page is either read
// from a live API response or renders an explicit unavailable state. The
// backend reports DATA_UNAVAILABLE for several strategy fields; those are
// surfaced as such, never filled in with plausible numbers.
// ---------------------------------------------------------------------------

const UNAVAILABLE = new Set(['DATA_UNAVAILABLE', 'data_unavailable', 'UNAVAILABLE']);

function isAvail(v: unknown): boolean {
  return v != null && !UNAVAILABLE.has(String(v));
}

// Real entity ids (verified against the live dataset) each lever acts on.
const LEVER_DEFS: { key: string; label: string; targetId: string }[] = [
  { key: 'supplier_diversification', label: 'Supplier Diversification', targetId: 'SUP_002' },
  { key: 'route_diversification', label: 'Route Diversification', targetId: 'RT_HORMUZ_INDIA' },
  { key: 'reserve_strategy', label: 'Reserve Allocation Strategy', targetId: 'STR_VISAKHAPATNAM' },
  { key: 'chokepoint_diversification', label: 'Chokepoint Diversification', targetId: 'CHK_HORMUZ' },
];

// The procurement optimizer needs a completed disruption run as its input;
// these are the baseline parameters the page simulates before optimizing.
const OPT_BASELINE = { name: 'Optimization baseline: Strait of Malacca', target_id: 'CHK_MALACCA', severity: 0.7, duration_days: 30 };

interface StrategyResult {
  id: string;
  status: string;
  baseline_scenario_id: string;
  levers?: { type: string; target_id: string }[];
  result?: {
    resilience?: {
      supply_resilience?: { score?: unknown; reason?: string };
      route_resilience?: { score?: unknown; reason?: string };
      dependency_concentration?: { before?: number; after?: number };
    };
    economic_impact?: { status?: string; avoided_loss?: unknown; reason?: string };
    provenance?: { source: string; action: string; timestamp: string }[];
    assumptions?: string[];
    strategic_state?: { affected_suppliers?: string[] };
  };
}

interface OptimizationOutcome {
  status: string;
  result?: {
    objective?: { baseline_shortage?: number; optimized_shortage?: number; improvement?: number };
    allocations?: { route_flows?: Record<string, number>; reserve_drawdowns?: Record<string, number> };
    reserve_usage?: { shortages?: Record<string, number> };
    economic_impact?: { impact?: Record<string, unknown>; price_source?: { name?: string; price?: number } };
  };
}

function UnavailablePanel({ reason }: { reason?: string }) {
  return (
    <div className="flex items-center justify-center bg-slate-900/50 border border-dashed border-slate-700 h-full w-full rounded p-4 text-center">
      <div className="flex flex-col items-center">
        <span className="text-red-400/80 font-bold text-[10px] uppercase tracking-widest mb-1">DATA UNAVAILABLE</span>
        <span className="text-slate-500 text-[9px] max-w-[220px]">{reason ?? 'The live API does not provide this data.'}</span>
      </div>
    </div>
  );
}

export default function StrategyLab() {
  // Lever availability comes from GET /strategy/options; null = not loaded.
  const [options, setOptions] = useState<Record<string, unknown> | null>(null);
  const [optionsError, setOptionsError] = useState(false);
  const [levers, setLevers] = useState<Record<string, boolean>>({
    supplier_diversification: true,
    route_diversification: true,
    reserve_strategy: false,
    chokepoint_diversification: false,
  });

  const [strategyRunning, setStrategyRunning] = useState(false);
  const [strategyError, setStrategyError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<StrategyResult | null>(null);

  const [optPhase, setOptPhase] = useState<'idle' | 'baseline' | 'optimizing' | 'done' | 'failed'>('idle');
  const [optimization, setOptimization] = useState<OptimizationOutcome | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    ApiClient.getStrategyOptions()
      .then(setOptions)
      .catch(() => setOptionsError(true));
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, []);

  const leverAvailable = (key: string): boolean => options != null && options[key] === true;

  const toggleLever = (key: string) => {
    if (!leverAvailable(key)) return;
    setLevers(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const runStrategy = async () => {
    const active = LEVER_DEFS.filter(l => levers[l.key] && leverAvailable(l.key))
      .map(l => ({ type: l.key, target_id: l.targetId }));
    if (active.length === 0) { setStrategyError('Select at least one available lever'); return; }
    setStrategyRunning(true);
    setStrategyError(null);
    try {
      const created = await ApiClient.createStrategyScenario({
        name: 'Strategic Diversification Plan',
        baseline_scenario_id: 'baseline-default',
        levers: active,
      });
      const sid = created.strategy_id ?? created.id;
      let attempts = 0;
      pollTimer.current = setInterval(async () => {
        attempts++;
        if (attempts > 40) {
          if (pollTimer.current) clearInterval(pollTimer.current);
          setStrategyRunning(false);
          setStrategyError('Strategy evaluation timed out');
          return;
        }
        try {
          const s = await ApiClient.getStrategyScenario(sid);
          if (s.status === 'COMPLETED' || s.status === 'FAILED') {
            if (pollTimer.current) clearInterval(pollTimer.current);
            setStrategy(s);
            setStrategyRunning(false);
            if (s.status === 'FAILED') setStrategyError('Strategy evaluation failed on the backend');
          }
        } catch {
          if (pollTimer.current) clearInterval(pollTimer.current);
          setStrategyRunning(false);
          setStrategyError('Lost connection while polling the strategy job');
        }
      }, 1500);
    } catch {
      setStrategyRunning(false);
      setStrategyError('Could not reach the strategy API');
    }
  };

  // Baseline disruption run, then procurement optimization on its job.
  const runOptimization = async () => {
    setOptPhase('baseline');
    setOptimization(null);
    try {
      const scenario = await ApiClient.createScenario(OPT_BASELINE);
      const run = await ApiClient.runScenario(scenario.id);
      const runJobId = String(run.job_id);

      // Wait for the baseline simulation to finish.
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 1500));
        const res = await ApiClient.getScenarioResults(scenario.id);
        if (res.job_status === 'COMPLETED') break;
        if (res.job_status === 'FAILED') throw new Error('baseline failed');
        if (i === 39) throw new Error('baseline timed out');
      }

      setOptPhase('optimizing');
      // The optimizer keys off the scenario RUN JOB id (its request field is
      // named scenario_id, but the backend resolves it in the jobs table).
      const opt = await ApiClient.runProcurementOptimization(runJobId);
      const optJobId = String((opt as { job_id?: string }).job_id);
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 1500));
        const res = await ApiClient.getOptimizationResult(optJobId);
        if (res.status === 'COMPLETED') { setOptimization(res); setOptPhase('done'); return; }
        if (res.status === 'FAILED') throw new Error('optimization failed');
      }
      throw new Error('optimization timed out');
    } catch {
      setOptPhase('failed');
    }
  };

  const objective = optimization?.result?.objective;
  const routeFlows = optimization?.result?.allocations?.route_flows;
  const drawdowns = optimization?.result?.allocations?.reserve_drawdowns;
  const shortages = optimization?.result?.reserve_usage?.shortages;
  const dep = strategy?.result?.resilience?.dependency_concentration;
  const econ = strategy?.result?.economic_impact;
  const maxFlow = routeFlows ? Math.max(...Object.values(routeFlows), 0.001) : 1;

  return (
    <div className="h-full min-h-[850px] min-w-[1280px] w-full bg-[#0f181b] p-3 flex gap-3 text-slate-300 font-sans">
      <SnapshotFallbackBadge />

      {/* LEFT COLUMN: CONFIGURATION PANEL */}
      <div className="w-[300px] flex flex-col gap-3 flex-shrink-0 bg-[#182227] rounded-md border border-slate-700/50 overflow-y-auto no-scrollbar shadow-sm">
        <div className="p-3 border-b border-slate-700/50 font-medium text-[11px] uppercase tracking-wider text-slate-400 bg-slate-800/50">
          Configuration Panel
        </div>
        <div className="p-4 flex flex-col gap-5">
          <div className="text-[10px] text-slate-500 mb-2 border-b border-slate-700/50 pb-2">Strategy Planner & Overlay Configurator</div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1.5">Baseline Target</label>
            <div className="relative">
              <select className="w-full bg-[#0f181b] border border-slate-700 rounded p-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 appearance-none">
                <option>Active Physical Baseline</option>
              </select>
              <ChevronDown className="w-3 h-3 absolute right-3 top-3 text-slate-500 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-2">Strategic Levers</label>
            {optionsError ? (
              <div className="text-[10px] text-amber-400 flex items-start gap-1.5">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                Lever availability could not be loaded from the API; evaluation is disabled.
              </div>
            ) : options == null ? (
              <div className="text-[10px] text-slate-500 animate-pulse">Loading lever availability...</div>
            ) : (
              <div className="flex flex-col gap-2">
                {LEVER_DEFS.map(l => (
                  <div key={l.key} onClick={() => toggleLever(l.key)} className={leverAvailable(l.key) ? 'cursor-pointer' : ''}>
                    <Checkbox
                      label={l.label}
                      checked={!!levers[l.key] && leverAvailable(l.key)}
                      disabled={!leverAvailable(l.key)}
                    />
                  </div>
                ))}
                <Checkbox label="Financial Optimization (CAPEX)" checked={false} disabled={true} />
                {options.financial_optimization != null && !isAvail(options.financial_optimization) && (
                  <div className="text-[9px] text-slate-500 italic">
                    The API reports Financial Optimization as DATA_UNAVAILABLE (missing authoritative CAPEX inputs).
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={runStrategy}
            disabled={strategyRunning || options == null || optionsError}
            className="w-full mt-2 flex items-center justify-center gap-2 py-3 bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 text-white text-xs font-bold rounded transition-colors"
          >
            {strategyRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {strategyRunning ? 'Evaluating Strategy...' : 'Evaluate Strategy Overlay'}
          </button>
          {strategyError && <div className="text-[10px] text-red-400">{strategyError}</div>}

          <div className="border-t border-slate-700/50 pt-4">
            <label className="block text-[11px] font-medium text-slate-300 mb-1.5">Procurement Optimization</label>
            <div className="text-[9px] text-slate-500 mb-2">
              Simulates the baseline disruption ({OPT_BASELINE.name.replace('Optimization baseline: ', '')},
              {' '}{Math.round(OPT_BASELINE.severity * 100)}% severity, {OPT_BASELINE.duration_days} days), then optimizes
              route flows and reserve drawdowns against it.
            </div>
            <button
              onClick={runOptimization}
              disabled={optPhase === 'baseline' || optPhase === 'optimizing'}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-800 hover:bg-blue-700 disabled:bg-slate-700 text-white text-xs font-bold rounded transition-colors"
            >
              {(optPhase === 'baseline' || optPhase === 'optimizing') ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {optPhase === 'baseline' ? 'Simulating Baseline...'
                : optPhase === 'optimizing' ? 'Optimizing Procurement...'
                : 'Run Procurement Optimization'}
            </button>
            {optPhase === 'failed' && <div className="text-[10px] text-red-400 mt-1.5">Optimization failed or timed out on the backend</div>}
          </div>
        </div>
      </div>

      {/* CENTER COLUMN: RESULTS */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">

        {/* ROW 1: STRATEGIC IMPACT OVERVIEW */}
        <div className="bg-[#182227] rounded-md border border-slate-700/50 p-4 shadow-sm relative">
          <h2 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-4">Strategic Impact Overview <span className="normal-case text-slate-500 font-normal">Calculated structural changes against baseline</span></h2>
          <div className="flex justify-between border-t border-slate-700/50 pt-4 relative min-h-[80px]">
            {strategy || optimization ? (
              <div className="flex gap-8 px-4 w-full justify-between items-center">
                <TopKpi
                  label="Strategy Status"
                  value={strategy ? strategy.status : 'NOT RUN'}
                  color={strategy?.status === 'COMPLETED' ? 'text-emerald-400' : 'text-slate-500'}
                  sub={strategy ? `Strategy ID: ${strategy.id.substring(0, 8)}` : 'Evaluate a strategy overlay'}
                />
                <TopKpi
                  label="Avoided Physical Shortage"
                  value={objective?.improvement != null ? `${objective.improvement.toFixed(2)} Mb/d` : 'UNAVAILABLE'}
                  color={objective?.improvement != null ? 'text-emerald-400' : 'text-slate-500'}
                  sub={objective ? 'From procurement optimization' : 'Run the procurement optimization'}
                />
                <TopKpi
                  label="Avoided Economic Loss"
                  value={isAvail(econ?.avoided_loss) ? String(econ?.avoided_loss) : 'UNAVAILABLE'}
                  color={isAvail(econ?.avoided_loss) ? 'text-emerald-400' : 'text-slate-500'}
                  sub={econ?.reason ?? ''}
                />
                <TopKpi
                  label="Dependency Concentration"
                  value={dep?.before != null && dep?.after != null ? `${dep.before} → ${dep.after}` : 'UNAVAILABLE'}
                  color={dep?.before != null ? 'text-emerald-400' : 'text-slate-500'}
                  sub={dep?.before != null ? 'Calculated delta' : ''}
                />
              </div>
            ) : (
              <div className="w-full text-center text-slate-500 text-xs mt-4">Run an evaluation to populate structural impact</div>
            )}
          </div>
        </div>

        {/* ROW 2: LEVERS & OPTIMIZED FLOWS */}
        <div className="flex gap-3 h-48 flex-shrink-0">
          <div className="w-[40%] bg-[#182227] rounded-md border border-slate-700/50 p-4 relative flex flex-col">
            <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-3">Strategic Pillar Execution</h3>
            {!strategy ? (
              <div className="text-xs text-slate-500 mt-4 text-center">Evaluate a strategy overlay first</div>
            ) : (
              <div className="text-xs text-slate-300 overflow-y-auto">
                <div><span className="font-bold text-slate-400">Baseline:</span> {strategy.baseline_scenario_id}</div>
                <div className="mt-2 font-bold text-slate-400">Levers Applied:</div>
                <ul className="list-disc pl-4 mt-1 text-[10px]">
                  {(strategy.levers ?? []).map((l, i) => (
                    <li key={i}>{l.type.replace(/_/g, ' ').toUpperCase()} <span className="text-slate-500">({l.target_id})</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="w-[60%] bg-[#182227] rounded-md border border-slate-700/50 p-4 relative flex flex-col">
            <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-3">Optimized Route Flows <span className="normal-case text-slate-500 font-normal">(Mb/d, from procurement optimizer)</span></h3>
            {routeFlows ? (
              <div className="flex flex-col gap-1 overflow-y-auto pr-1">
                {Object.entries(routeFlows).sort(([, a], [, b]) => b - a).map(([id, flow]) => (
                  <div key={id} className="flex items-center gap-2 text-[10px]">
                    <span className="w-36 truncate text-slate-400">{id}</span>
                    <div className="flex-1 h-2 bg-slate-800 rounded overflow-hidden">
                      <div className="h-full bg-blue-500/70" style={{ width: `${(flow / maxFlow) * 100}%` }} />
                    </div>
                    <span className="w-10 text-right font-mono text-slate-200">{flow.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <UnavailablePanel reason="Run the procurement optimization to compute route reallocations." />
            )}
          </div>
        </div>

        {/* ROW 3: AFFECTED ENTITIES & RESERVE DRAWDOWNS */}
        <div className="flex-1 bg-[#182227] rounded-md border border-slate-700/50 p-4 relative flex flex-col min-h-[150px]">
          <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-3">Affected Physical Entities</h3>
          {!strategy && !optimization ? (
            <div className="text-xs text-slate-500 mt-4 text-center">Run an evaluation to populate affected entities</div>
          ) : (
            <div className="flex gap-2 text-xs">
              <div className="p-3 bg-slate-900 rounded border border-slate-700 flex-1">
                <h4 className="font-bold text-[10px] text-slate-500 uppercase mb-2">Affected Suppliers (strategy overlay)</h4>
                {strategy?.result?.strategic_state?.affected_suppliers?.length ? (
                  <ul className="list-disc pl-4 text-slate-300 text-[10px]">
                    {strategy.result.strategic_state.affected_suppliers.map(s => <li key={s}>{s}</li>)}
                  </ul>
                ) : (
                  <div className="text-[10px] text-slate-500 italic">The overlay reported no directly affected suppliers.</div>
                )}
              </div>
              <div className="p-3 bg-slate-900 rounded border border-slate-700 flex-1">
                <h4 className="font-bold text-[10px] text-slate-500 uppercase mb-2">Reserve Drawdowns (Mb/d, optimizer)</h4>
                {drawdowns ? (
                  <ul className="text-slate-300 text-[10px] space-y-0.5">
                    {Object.entries(drawdowns).map(([id, v]) => (
                      <li key={id} className="flex justify-between"><span>{id}</span><span className="font-mono">{v.toFixed(2)}</span></li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-[10px] text-slate-500 italic">Not computed; run the procurement optimization.</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ROW 4: BOTTOM METRICS */}
        <div className="flex gap-3 h-32 flex-shrink-0">
          <div className="w-[30%] bg-[#182227] rounded-md border border-slate-700/50 p-3 relative flex flex-col">
            <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-2">Shortage: Baseline vs Optimized</h3>
            {objective ? (
              <div className="flex flex-col gap-1.5 text-[10px] mt-1">
                <div className="flex justify-between"><span className="text-slate-400">Baseline shortage</span><span className="font-mono text-red-400">{objective.baseline_shortage?.toFixed(2)} Mb/d</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Optimized shortage</span><span className="font-mono text-emerald-400">{objective.optimized_shortage?.toFixed(2)} Mb/d</span></div>
                <div className="flex justify-between border-t border-slate-700/50 pt-1.5"><span className="text-slate-400">Improvement</span><span className="font-mono text-emerald-400 font-bold">{objective.improvement?.toFixed(2)} Mb/d</span></div>
              </div>
            ) : (
              <UnavailablePanel reason="Run the procurement optimization for a baseline vs optimized comparison." />
            )}
          </div>
          <div className="w-[30%] bg-[#182227] rounded-md border border-slate-700/50 p-3 relative flex flex-col">
            <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-2">Strategic Assumptions</h3>
            {strategy?.result?.assumptions?.length ? (
              <ul className="list-disc pl-4 text-[9px] text-slate-400 h-full overflow-y-auto">
                {strategy.result.assumptions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            ) : (
              <div className="text-[9px] text-slate-600 italic">No strategy evaluated</div>
            )}
          </div>
          <div className="w-[40%] bg-[#182227] rounded-md border border-slate-700/50 p-3 relative flex flex-col">
            <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-2">Strategy Provenance</h3>
            {strategy?.result?.provenance?.length ? (
              <div className="text-[9px] text-slate-400 space-y-1 overflow-y-auto h-full">
                {strategy.result.provenance.map((p, i) => (
                  <div key={i} className="flex justify-between border-b border-slate-700/50 pb-1">
                    <span>[{p.source}]</span> <span>{p.action}</span> <span className="text-slate-600">{p.timestamp.slice(0, 19).replace('T', ' ')}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[9px] text-slate-600 italic">No strategy evaluated</div>
            )}
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: METRICS */}
      <div className="w-[280px] flex flex-col gap-3 flex-shrink-0 overflow-y-auto no-scrollbar">

        <div className="bg-[#182227] rounded-md border border-slate-700/50 p-4 shadow-sm flex flex-col relative h-[250px]">
          <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3">Country Shortages After Optimization</h3>
          {shortages ? (
            <div className="flex flex-col gap-2 text-[11px]">
              {Object.entries(shortages).map(([country, v]) => (
                <div key={country} className="flex justify-between items-center">
                  <span className="text-slate-300 font-bold">{country}</span>
                  <span className={`font-mono font-bold ${v > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{v.toFixed(2)} Mb/d</span>
                </div>
              ))}
              <div className="text-[9px] text-slate-500 mt-2">0.00 means the optimizer fully covered demand for that country.</div>
            </div>
          ) : (
            <UnavailablePanel reason="Run the procurement optimization to compute per-country shortages." />
          )}
        </div>

        <div className="bg-[#182227] rounded-md border border-slate-700/50 p-4 shadow-sm relative h-[180px]">
          <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3">Risk Assessment Summary</h3>
          {strategy ? (
            <div className="flex flex-col gap-2 text-[10px] text-slate-400">
              <div>
                Supplier Resilience:
                <span className={`font-bold ml-1 ${isAvail(strategy.result?.resilience?.supply_resilience?.score) ? 'text-white' : 'text-slate-500'}`}>
                  {isAvail(strategy.result?.resilience?.supply_resilience?.score) ? String(strategy.result?.resilience?.supply_resilience?.score) : 'UNAVAILABLE'}
                </span>
                {strategy.result?.resilience?.supply_resilience?.reason && (
                  <div className="text-[9px] text-slate-600">{strategy.result.resilience.supply_resilience.reason}</div>
                )}
              </div>
              <div>
                Route Resilience:
                <span className={`font-bold ml-1 ${isAvail(strategy.result?.resilience?.route_resilience?.score) ? 'text-white' : 'text-slate-500'}`}>
                  {isAvail(strategy.result?.resilience?.route_resilience?.score) ? String(strategy.result?.resilience?.route_resilience?.score) : 'UNAVAILABLE'}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 text-center mt-4">No strategy evaluated</div>
          )}
        </div>

        <div className="flex-1 bg-[#182227] rounded-md border border-slate-700/50 p-4 shadow-sm relative min-h-[140px]">
          <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3">CAPEX Funding Plan</h3>
          <UnavailablePanel reason={econ?.reason ?? 'The API reports financial inputs (CapEx, route costs) as unavailable.'} />
        </div>

      </div>

    </div>
  );
}

function TopKpi({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="flex flex-col gap-1 pr-6 border-r border-slate-700/50 last:border-0">
      <span className="text-[10px] text-slate-400 whitespace-nowrap">{label}</span>
      <span className={`text-xl font-bold tracking-tight ${color}`}>{value}</span>
      <span className="text-[9px] text-slate-500 whitespace-nowrap">{sub}</span>
    </div>
  );
}

function Checkbox({ label, checked, disabled }: { label: string; checked: boolean; disabled?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${disabled ? 'opacity-50' : ''}`}>
      <div className={`w-3 h-3 flex items-center justify-center rounded border ${checked ? 'bg-emerald-600 border-emerald-500' : 'border-slate-600'}`}>
        {checked && <Check className="w-2.5 h-2.5 text-white" />}
      </div>
      <span className="text-[11px] text-slate-300">{label}</span>
    </div>
  );
}
