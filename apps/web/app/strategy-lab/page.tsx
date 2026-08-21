'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2, Check, ChevronDown, AlertTriangle, Info } from 'lucide-react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ApiClient } from '@/lib/api';
import { SnapshotFallbackBadge } from '@/components/snapshot-badge';

// ---------------------------------------------------------------------------
// VALUE ARCHITECTURE (project honesty standard, do not weaken):
//   USER INPUT        budget, horizon, priorities, funding split, assumptions.
//                     Real because the user supplied them. Tagged blue.
//   LIVE              read from backend responses (overlay, optimizer, risk
//                     endpoints) exactly as returned. Tagged emerald.
//   ASSUMPTION-BASED  financial metrics computed from the LIVE optimizer
//                     result plus the user's editable assumptions. Tagged
//                     purple, derivation shown, editing an assumption moves
//                     the number. Never hardcoded.
// Anything not traceable to one of the three does not appear (the reference's
// initiatives roadmap, strategic score, Sharpe ratio and scenario-comparison
// rows are deliberately absent or rendered as not modeled).
// ---------------------------------------------------------------------------

const UNAVAILABLE = new Set(['DATA_UNAVAILABLE', 'data_unavailable', 'UNAVAILABLE']);
const isAvail = (v: unknown): boolean => v != null && !UNAVAILABLE.has(String(v));

const LEVER_DEFS: { key: string; label: string; targetId: string }[] = [
  { key: 'supplier_diversification', label: 'Supplier Diversification', targetId: 'SUP_002' },
  { key: 'route_diversification', label: 'Route Diversification', targetId: 'RT_HORMUZ_INDIA' },
  { key: 'reserve_strategy', label: 'Reserve Allocation Strategy', targetId: 'STR_VISAKHAPATNAM' },
  { key: 'chokepoint_diversification', label: 'Chokepoint Diversification', targetId: 'CHK_HORMUZ' },
];

const OPT_BASELINE = { name: 'Optimization baseline: Strait of Malacca', target_id: 'CHK_MALACCA', severity: 0.7, duration_days: 30 };

const PILLARS: { key: string; label: string; color: string }[] = [
  { key: 'infrastructure', label: 'Infrastructure Resilience', color: '#3b82f6' },
  { key: 'supply', label: 'Supply Diversification', color: '#10b981' },
  { key: 'operations', label: 'Operational Efficiency', color: '#f59e0b' },
  { key: 'technology', label: 'Technology & Innovation', color: '#a855f7' },
  { key: 'market', label: 'Market Intelligence', color: '#06b6d4' },
];

const FUNDING_SOURCES: { key: string; label: string; color: string }[] = [
  { key: 'government', label: 'Government Budget', color: '#3b82f6' },
  { key: 'ppp', label: 'Public-Private Partnership', color: '#10b981' },
  { key: 'multilateral', label: 'Multilateral Funding', color: '#f59e0b' },
  { key: 'private', label: 'Private Investment', color: '#a855f7' },
];

const HORIZONS = [3, 5, 10];
const START_YEAR = 2026;

interface StrategyResult {
  id: string;
  status: string;
  baseline_scenario_id: string;
  levers?: { type: string; target_id: string }[];
  result?: {
    resilience?: {
      supply_resilience?: { score?: unknown; reason?: string };
      route_resilience?: { score?: unknown; reason?: string };
      dependency_concentration?: { before?: unknown; after?: unknown };
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
  };
}

// --------------------------- empty / gap states ----------------------------

function AwaitingAction({ prompt, onRun, running }: { prompt: string; onRun?: () => void; running?: boolean }) {
  return (
    <div className="flex items-center justify-center bg-slate-900/40 border border-slate-800 h-full w-full rounded p-4 text-center">
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Awaiting Step 2</span>
        <span className="text-slate-500 text-[9px] max-w-[230px]">{prompt}</span>
        {onRun && (
          <button onClick={onRun} disabled={running} className="mt-1 px-2.5 py-1 text-[9px] font-bold rounded border border-blue-700/60 bg-blue-900/30 text-blue-300 hover:bg-blue-900/60 disabled:opacity-50 transition-colors">
            {running ? 'Running...' : 'Run procurement optimization'}
          </button>
        )}
      </div>
    </div>
  );
}

function BackendUnavailable({ reason }: { reason?: string }) {
  return (
    <div className="flex items-center justify-center bg-amber-950/15 border border-dashed border-amber-800/50 h-full w-full rounded p-4 text-center">
      <div className="flex flex-col items-center">
        <span className="text-amber-400/90 font-bold text-[10px] uppercase tracking-widest mb-1">DATA UNAVAILABLE</span>
        <span className="text-slate-500 text-[9px] max-w-[230px]">{reason ?? 'The live API reports this data as unavailable.'}</span>
      </div>
    </div>
  );
}

function NotModeledPanel({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="flex items-center justify-center bg-slate-900/30 border border-slate-800 h-full w-full rounded p-4 text-center">
      <div className="flex flex-col items-center">
        <span className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mb-1">{title}: Not Modeled</span>
        <span className="text-slate-600 text-[9px] max-w-[300px]">{reason}</span>
      </div>
    </div>
  );
}

// Provenance tag rendered next to every number so its origin is one glance away.
function Tag({ kind }: { kind: 'user' | 'live' | 'assumption' }) {
  const styles = {
    user: 'border-blue-700/60 bg-blue-950/40 text-blue-300',
    live: 'border-emerald-700/60 bg-emerald-950/40 text-emerald-300',
    assumption: 'border-purple-700/60 bg-purple-950/40 text-purple-300',
  }[kind];
  const label = { user: 'USER INPUT', live: 'LIVE', assumption: 'ASSUMPTION-BASED' }[kind];
  return <span className={`rounded border px-1 py-px text-[7px] font-black tracking-wider ${styles}`}>{label}</span>;
}

// ------------------------------- page --------------------------------------

export default function StrategyLab() {
  // ---- Category 1: user inputs ----
  const [budgetB, setBudgetB] = useState(24.5);
  const [horizon, setHorizon] = useState(5);
  const [objective, setObjective] = useState('Strengthen Energy Security & Resilience');
  const [riskAppetite, setRiskAppetite] = useState('Moderate');
  const [priorities, setPriorities] = useState<Record<string, boolean>>({
    infrastructure: true, supply: true, operations: true, technology: true, market: true,
  });
  const [funding, setFunding] = useState<Record<string, number>>({ government: 40, ppp: 30, multilateral: 20, private: 10 });

  // Editable assumptions behind every financial metric. Defaults are stated,
  // visible, and each change recomputes the tagged figures live.
  const [assump, setAssump] = useState({
    discountPct: 8,        // discount rate, %/yr
    energyValue: 80,       // value of relieved supply, USD per barrel
    omPct: 5,              // operations and maintenance, % of budget per year
    rampYears: 2,          // years until the strategy reaches full effect
  });

  // ---- Category 2: live backend state ----
  const [options, setOptions] = useState<Record<string, unknown> | null>(null);
  const [optionsError, setOptionsError] = useState(false);
  const [levers, setLevers] = useState<Record<string, boolean>>({
    supplier_diversification: true, route_diversification: true, reserve_strategy: false, chokepoint_diversification: false,
  });
  const [strategy, setStrategy] = useState<StrategyResult | null>(null);
  const [strategyRunning, setStrategyRunning] = useState(false);
  const [strategyError, setStrategyError] = useState<string | null>(null);
  const [optPhase, setOptPhase] = useState<'idle' | 'baseline' | 'optimizing' | 'done' | 'failed'>('idle');
  const [optimization, setOptimization] = useState<OptimizationOutcome | null>(null);
  const [riskCategories, setRiskCategories] = useState<{ label: string; score: number | null; level?: string | null; status?: string }[] | null>(null);
  const [systemicRisk, setSystemicRisk] = useState<number | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    ApiClient.getStrategyOptions().then(setOptions).catch(() => setOptionsError(true));
    ApiClient.getRiskCategories()
      .then(c => setRiskCategories((c?.categories ?? []) as typeof riskCategories))
      .catch(() => setRiskCategories(null));
    ApiClient.getRiskEvaluation()
      .then(r => { if (typeof r?.systemic_risk_score === 'number') setSystemicRisk(Math.round(r.systemic_risk_score)); })
      .catch(() => setSystemicRisk(null));
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, []);

  const leverAvailable = (key: string): boolean => options != null && options[key] === true;

  const runStrategy = async () => {
    const active = LEVER_DEFS.filter(l => levers[l.key] && leverAvailable(l.key)).map(l => ({ type: l.key, target_id: l.targetId }));
    if (active.length === 0) { setStrategyError('Select at least one available lever'); return; }
    setStrategyRunning(true);
    setStrategyError(null);
    try {
      const created = await ApiClient.createStrategyScenario({ name: 'Strategic Diversification Plan', baseline_scenario_id: 'baseline-default', levers: active });
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

  const runOptimization = async () => {
    setOptPhase('baseline');
    setOptimization(null);
    try {
      const scenario = await ApiClient.createScenario(OPT_BASELINE);
      const run = await ApiClient.runScenario(scenario.id);
      const runJobId = String(run.job_id);
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 1500));
        const res = await ApiClient.getScenarioResults(scenario.id);
        if (res.job_status === 'COMPLETED') break;
        if (res.job_status === 'FAILED') throw new Error('baseline failed');
        if (i === 39) throw new Error('baseline timed out');
      }
      setOptPhase('optimizing');
      // The optimizer resolves its scenario_id field in the JOBS table, so it
      // gets the scenario run's job id.
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

  const optRunning = optPhase === 'baseline' || optPhase === 'optimizing';
  const objectiveRes = optimization?.result?.objective;
  const routeFlows = optimization?.result?.allocations?.route_flows;
  const drawdowns = optimization?.result?.allocations?.reserve_drawdowns;
  const shortages = optimization?.result?.reserve_usage?.shortages;
  const dep = strategy?.result?.resilience?.dependency_concentration;
  const econ = strategy?.result?.economic_impact;
  const improvement = objectiveRes?.improvement ?? null; // LIVE, Mb/d

  // ---- Category 1 derivations (pure functions of user inputs) ----
  const activePillars = PILLARS.filter(p => priorities[p.key]);
  const pillarData = activePillars.map(p => ({
    name: p.label, color: p.color, value: +(budgetB / Math.max(activePillars.length, 1)).toFixed(2),
  }));
  const fundingTotal = Object.values(funding).reduce((a, b) => a + b, 0) || 1;
  const fundingData = FUNDING_SOURCES.map(s => ({
    name: s.label, color: s.color,
    pct: Math.round((funding[s.key] / fundingTotal) * 100),
    value: +((funding[s.key] / fundingTotal) * budgetB).toFixed(2),
  }));

  // ---- Category 3: assumption-derived financials ----
  // Only computable once the optimizer has produced a REAL improvement.
  const fin = useMemo(() => {
    if (improvement == null) return null;
    // 1 Mb/d = 1,000,000 bbl/day; benefit = improvement * value * 365 days.
    const annualBenefitB = (improvement * assump.energyValue * 365) / 1000; // $B/yr
    const omCostB = budgetB * (assump.omPct / 100);
    const netCF = annualBenefitB - omCostB;
    const r = assump.discountPct / 100;
    let npv = -budgetB;
    for (let t = 1; t <= horizon; t++) {
      const rampFactor = Math.min(1, t / Math.max(assump.rampYears, 1));
      npv += (netCF * rampFactor) / Math.pow(1 + r, t);
    }
    const roiAnnualPct = (netCF / budgetB) * 100;
    const payback = netCF > 0 ? budgetB / netCF : null;
    return {
      annualBenefitB, netCF,
      npv: +npv.toFixed(1),
      roiAnnualPct: +roiAnnualPct.toFixed(1),
      payback: payback != null && payback <= horizon ? +payback.toFixed(1) : payback != null ? +payback.toFixed(1) : null,
      paybackBeyondHorizon: payback != null && payback > horizon,
    };
  }, [improvement, assump, budgetB, horizon]);

  // Projection: LIVE baseline/optimized shortage, assumption-based rollout ramp.
  const projection = useMemo(() => {
    if (objectiveRes?.baseline_shortage == null || improvement == null) return null;
    const base = objectiveRes.baseline_shortage;
    return Array.from({ length: horizon + 1 }, (_, t) => ({
      year: START_YEAR + t,
      Baseline: +base.toFixed(2),
      'With Strategy': +(base - improvement * Math.min(1, t / Math.max(assump.rampYears, 1))).toFixed(2),
    }));
  }, [objectiveRes, improvement, horizon, assump.rampYears]);

  const setFundingPct = (key: string, v: number) => setFunding(prev => ({ ...prev, [key]: Math.max(0, Math.min(100, v)) }));
  const setAssumpField = (key: keyof typeof assump, v: number) => setAssump(prev => ({ ...prev, [key]: v }));

  const riskColor = (level?: string | null, score?: number | null) => {
    const s = score ?? 0;
    if (level === 'HIGH' || level === 'CRITICAL' || s >= 70) return 'text-red-400';
    if (level === 'MEDIUM' || s >= 45) return 'text-amber-400';
    return 'text-emerald-400';
  };

  return (
    <div className="h-full min-h-[900px] min-w-[1280px] w-full bg-[#0f181b] p-3 flex gap-3 text-slate-300 font-sans">
      <SnapshotFallbackBadge />

      {/* LEFT: CONFIGURATION */}
      <div className="w-[300px] flex flex-col flex-shrink-0 bg-[#182227] rounded-md border border-slate-700/50 overflow-y-auto no-scrollbar shadow-sm">
        <div className="p-3 border-b border-slate-700/50 font-medium text-[11px] uppercase tracking-wider text-slate-400 bg-slate-800/50">
          Configuration Panel
        </div>
        <div className="p-4 flex flex-col gap-4">
          <div className="text-[10px] text-slate-500 border-b border-slate-700/50 pb-2">Strategy Planner & Investment Configurator</div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1.5">Planning Horizon <Tag kind="user" /></label>
            <div className="relative">
              <select value={horizon} onChange={e => setHorizon(parseInt(e.target.value))} className="w-full bg-[#0f181b] border border-slate-700 rounded p-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 appearance-none">
                {HORIZONS.map(h => <option key={h} value={h}>{h} Years ({START_YEAR}-{START_YEAR + h})</option>)}
              </select>
              <ChevronDown className="w-3 h-3 absolute right-3 top-3 text-slate-500 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1.5">Strategic Objective <Tag kind="user" /></label>
            <div className="relative">
              <select value={objective} onChange={e => setObjective(e.target.value)} className="w-full bg-[#0f181b] border border-slate-700 rounded p-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 appearance-none">
                <option>Strengthen Energy Security & Resilience</option>
                <option>Minimize Import Dependency</option>
                <option>Accelerate Diversification</option>
              </select>
              <ChevronDown className="w-3 h-3 absolute right-3 top-3 text-slate-500 pointer-events-none" />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[11px] font-medium text-slate-300">Total Budget <Tag kind="user" /></label>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500">$</span>
                <input type="number" min={1} max={100} step={0.5} value={budgetB}
                  onChange={e => setBudgetB(Math.max(0.5, parseFloat(e.target.value) || 0.5))}
                  className="w-14 bg-[#0f181b] border border-slate-700 rounded py-1 px-1.5 text-[11px] font-mono text-white text-right outline-none focus:border-blue-500" />
                <span className="text-[10px] text-slate-500">B</span>
              </div>
            </div>
            <input type="range" min={1} max={100} step={0.5} value={budgetB} onChange={e => setBudgetB(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 h-1 bg-slate-400 rounded-lg appearance-none cursor-pointer" />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-2">Investment Priority <Tag kind="user" /></label>
            <div className="flex flex-col gap-1.5">
              {PILLARS.map(p => (
                <div key={p.key} onClick={() => setPriorities(prev => ({ ...prev, [p.key]: !prev[p.key] }))} className="cursor-pointer">
                  <Checkbox label={p.label} checked={!!priorities[p.key]} />
                </div>
              ))}
            </div>
            <div className="text-[9px] text-slate-600 mt-1 italic">Budget splits equally across selected pillars.</div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1.5">Risk Appetite <Tag kind="user" /></label>
            <div className="relative">
              <select value={riskAppetite} onChange={e => setRiskAppetite(e.target.value)} className="w-full bg-[#0f181b] border border-slate-700 rounded p-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 appearance-none">
                <option>Conservative</option>
                <option>Moderate</option>
                <option>Aggressive</option>
              </select>
              <ChevronDown className="w-3 h-3 absolute right-3 top-3 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {/* ASSUMPTIONS: the stated basis of every purple-tagged number */}
          <div className="border border-purple-800/40 bg-purple-950/10 rounded p-2.5">
            <div className="flex items-center gap-1.5 mb-2">
              <Info size={11} className="text-purple-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300">Financial Assumptions</span>
            </div>
            <div className="text-[9px] text-slate-500 mb-2">
              The system has no authoritative cost data (the API reports CapEx inputs as unavailable). Every
              ASSUMPTION-BASED figure is computed from the live optimizer result plus these editable values.
            </div>
            {([
              ['discountPct', 'Discount rate (%/yr)'],
              ['energyValue', 'Value of relieved supply ($/bbl)'],
              ['omPct', 'O&M cost (% of budget /yr)'],
              ['rampYears', 'Years to full effect'],
            ] as [keyof typeof assump, string][]).map(([key, label]) => (
              <div key={key} className="flex justify-between items-center py-0.5">
                <span className="text-[10px] text-slate-400">{label}</span>
                <input type="number" step={key === 'rampYears' ? 1 : 0.5} min={0} value={assump[key]}
                  onChange={e => setAssumpField(key, Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-14 bg-[#0f181b] border border-slate-700 rounded py-0.5 px-1.5 text-[10px] font-mono text-white text-right outline-none focus:border-purple-500" />
              </div>
            ))}
            <div className="text-[8px] text-slate-600 mt-1.5 leading-snug">
              NPV = -budget + Σ (benefit - O&M) × ramp / (1+r)^t over the horizon.
              Benefit = avoided shortage (live) × $/bbl × 365.
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-2">Strategic Levers (Step 1) {options != null && <Tag kind="live" />}</label>
            {optionsError ? (
              <div className="text-[10px] text-amber-400 flex items-start gap-1.5">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                Lever availability could not be loaded from the API; evaluation is disabled.
              </div>
            ) : options == null ? (
              <div className="text-[10px] text-slate-500 animate-pulse">Loading lever availability...</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {LEVER_DEFS.map(l => (
                  <div key={l.key} onClick={() => toggleLeverSafe(l.key)} className={leverAvailable(l.key) ? 'cursor-pointer' : ''}>
                    <Checkbox label={l.label} checked={!!levers[l.key] && leverAvailable(l.key)} disabled={!leverAvailable(l.key)} />
                  </div>
                ))}
                <Checkbox label="Financial Optimization (CAPEX)" checked={false} disabled={true} />
                {options.financial_optimization != null && !isAvail(options.financial_optimization) && (
                  <div className="text-[9px] text-slate-500 italic">The API reports Financial Optimization as DATA_UNAVAILABLE (missing authoritative CAPEX inputs).</div>
                )}
              </div>
            )}
          </div>

          <button onClick={runStrategy} disabled={strategyRunning || options == null || optionsError}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 text-white text-xs font-bold rounded transition-colors">
            {strategyRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {strategyRunning ? 'Evaluating Strategy...' : '1 · Evaluate Strategy Overlay'}
          </button>
          {strategyError && <div className="text-[10px] text-red-400">{strategyError}</div>}

          <button onClick={runOptimization} disabled={optRunning}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-800 hover:bg-blue-700 disabled:bg-slate-700 text-white text-xs font-bold rounded transition-colors">
            {optRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {optPhase === 'baseline' ? 'Simulating Baseline...' : optPhase === 'optimizing' ? 'Optimizing Procurement...' : '2 · Run Procurement Optimization'}
          </button>
          {optPhase === 'failed' && <div className="text-[10px] text-red-400">Optimization failed or timed out on the backend</div>}
          <div className="text-[9px] text-slate-600">
            Step 2 simulates the baseline disruption (Strait of Malacca, 70% severity, 30 days) and optimizes route flows and reserves against it.
          </div>
        </div>
      </div>

      {/* CENTER */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">

        {/* KPI STRIP */}
        <div className="bg-[#182227] rounded-md border border-slate-700/50 p-4 shadow-sm">
          <h2 className="text-[11px] font-bold tracking-wider text-slate-300 uppercase mb-3">Strategic Investment Overview <span className="normal-case text-slate-500 font-normal">Financial figures derive from the live optimizer result and your stated assumptions</span></h2>
          <div className="grid grid-cols-5 gap-3">
            <Kpi label="Total Investment" tag="user" value={`$${budgetB.toFixed(1)}B`} sub={`${horizon} Year Plan`} color="text-white" />
            <Kpi label="Avoided Shortage" tag="live"
              value={improvement != null ? `${improvement.toFixed(2)} Mb/d` : 'Awaiting step 2'}
              sub={improvement != null ? 'From procurement optimizer' : 'Computed by the optimizer'}
              color={improvement != null ? 'text-emerald-400' : 'text-slate-500'} />
            <Kpi label="NPV (Discounted)" tag="assumption"
              value={fin ? `$${fin.npv}B` : 'Awaiting step 2'}
              sub={fin ? `at ${assump.discountPct}% over ${horizon}y` : 'Needs the live optimizer result'}
              color={fin ? (fin.npv >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-slate-500'} />
            <Kpi label="Expected ROI" tag="assumption"
              value={fin ? `${fin.roiAnnualPct}%` : 'Awaiting step 2'}
              sub={fin ? 'Annualized, net of O&M' : 'Needs the live optimizer result'}
              color={fin ? (fin.roiAnnualPct >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-slate-500'} />
            <Kpi label="Payback Period" tag="assumption"
              value={fin ? (fin.payback != null ? `${fin.payback} Years` : 'Never') : 'Awaiting step 2'}
              sub={fin ? (fin.paybackBeyondHorizon ? 'Beyond your horizon' : 'Average') : 'Needs the live optimizer result'}
              color={fin ? (fin.paybackBeyondHorizon || fin.payback == null ? 'text-amber-400' : 'text-emerald-400') : 'text-slate-500'} />
          </div>
        </div>

        {/* ALLOCATION + PROJECTION */}
        <div className="flex gap-3 h-[230px] flex-shrink-0">
          <div className="w-[42%] bg-[#182227] rounded-md border border-slate-700/50 p-4 flex flex-col">
            <h3 className="text-[11px] font-bold tracking-wider text-slate-300 uppercase mb-1">Strategic Pillar Allocation <Tag kind="user" /></h3>
            <div className="flex-1 flex items-center">
              <div className="w-1/2 h-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pillarData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={2} dataKey="value" stroke="none">
                      {pillarData.map(p => <Cell key={p.name} fill={p.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-sm font-bold text-white">${budgetB.toFixed(1)}B</span>
                  <span className="text-[8px] text-slate-500">Total Allocation</span>
                </div>
              </div>
              <div className="w-1/2 flex flex-col gap-1.5 pl-2">
                {pillarData.map(p => (
                  <div key={p.name} className="flex items-center text-[10px]">
                    <div className="w-2 h-2 rounded-sm mr-2 shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="truncate flex-1 text-slate-300">{p.name}</span>
                    <span className="font-mono text-white ml-1">${p.value}B</span>
                  </div>
                ))}
                {pillarData.length === 0 && <span className="text-[10px] text-slate-500 italic">Select at least one priority</span>}
              </div>
            </div>
          </div>

          <div className="flex-1 bg-[#182227] rounded-md border border-slate-700/50 p-4 flex flex-col">
            <h3 className="text-[11px] font-bold tracking-wider text-slate-300 uppercase mb-1">
              Shortage Projection <span className="normal-case text-slate-500 font-normal">(Mb/d, baseline vs with strategy)</span>{' '}
              <Tag kind="live" /> <Tag kind="assumption" />
            </h3>
            {projection ? (
              <>
                <ResponsiveContainer width="100%" height="88%">
                  <LineChart data={projection} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="year" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', fontSize: '10px' }} />
                    <Legend wrapperStyle={{ fontSize: '9px' }} iconType="plainline" iconSize={10} />
                    <Line type="monotone" dataKey="Baseline" stroke="#64748b" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="With Strategy" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="text-[8px] text-slate-600">Levels are live optimizer output; the {assump.rampYears}-year rollout ramp is a stated assumption.</div>
              </>
            ) : (
              <AwaitingAction prompt="Both series derive from the procurement optimization plus your rollout assumption." onRun={runOptimization} running={optRunning} />
            )}
          </div>
        </div>

        {/* ROUTE FLOWS + OVERLAY */}
        <div className="flex gap-3 h-[190px] flex-shrink-0">
          <div className="flex-1 bg-[#182227] rounded-md border border-slate-700/50 p-4 flex flex-col">
            <h3 className="text-[11px] font-bold tracking-wider text-slate-300 uppercase mb-2">Optimized Route Flows <span className="normal-case text-slate-500 font-normal">(Mb/d)</span> <Tag kind="live" /></h3>
            {routeFlows ? (
              <div className="flex flex-col gap-1 overflow-y-auto pr-1">
                {Object.entries(routeFlows).sort(([, a], [, b]) => b - a).map(([id, flow]) => {
                  const maxFlow = Math.max(...Object.values(routeFlows), 0.001);
                  return (
                    <div key={id} className="flex items-center gap-2 text-[10px]">
                      <span className="w-36 truncate text-slate-400">{id}</span>
                      <div className="flex-1 h-2 bg-slate-800 rounded overflow-hidden">
                        <div className="h-full bg-blue-500/70" style={{ width: `${(flow / maxFlow) * 100}%` }} />
                      </div>
                      <span className="w-10 text-right font-mono text-slate-200">{flow.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <AwaitingAction prompt="Route reallocations are computed by the procurement optimization." onRun={runOptimization} running={optRunning} />
            )}
          </div>

          <div className="w-[38%] bg-[#182227] rounded-md border border-slate-700/50 p-4 flex flex-col">
            <h3 className="text-[11px] font-bold tracking-wider text-slate-300 uppercase mb-2">Strategy Overlay (Step 1) <Tag kind="live" /></h3>
            {!strategy ? (
              <div className="text-xs text-slate-500 text-center mt-6">Run step 1 to evaluate structural levers</div>
            ) : (
              <div className="text-[10px] text-slate-300 overflow-y-auto flex flex-col gap-1.5">
                <div><span className="text-slate-500">Status:</span> <span className={strategy.status === 'COMPLETED' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{strategy.status}</span></div>
                <div>
                  <span className="text-slate-500">Dependency concentration:</span>{' '}
                  {isAvail(dep?.before) && isAvail(dep?.after)
                    ? <span className="font-mono text-emerald-400">{String(dep?.before)} → {String(dep?.after)}</span>
                    : <span className="text-amber-400/90 font-bold">DATA UNAVAILABLE</span>}
                </div>
                <div>
                  <span className="text-slate-500">Avoided economic loss:</span>{' '}
                  {isAvail(econ?.avoided_loss)
                    ? <span className="font-mono text-emerald-400">{String(econ?.avoided_loss)}</span>
                    : <span className="text-amber-400/90 font-bold">DATA UNAVAILABLE</span>}
                  {econ?.reason && <div className="text-[8px] text-slate-600">{econ.reason}</div>}
                </div>
                <div>
                  <span className="text-slate-500">Affected suppliers:</span>{' '}
                  {strategy.result?.strategic_state?.affected_suppliers?.length
                    ? strategy.result.strategic_state.affected_suppliers.join(', ')
                    : <span className="italic text-slate-500">none reported</span>}
                </div>
                {strategy.result?.assumptions?.length ? (
                  <div className="text-[9px] text-slate-500 border-t border-slate-700/50 pt-1 mt-0.5">
                    {strategy.result.assumptions.map((a, i) => <div key={i}>• {a}</div>)}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* ROADMAP SLOT: explicitly not modeled */}
        <div className="h-[92px] flex-shrink-0 bg-[#182227] rounded-md border border-slate-700/50 p-3 flex flex-col">
          <h3 className="text-[11px] font-bold tracking-wider text-slate-300 uppercase mb-1.5">Strategic Initiatives Roadmap</h3>
          <NotModeledPanel title="Initiative tracking" reason="Named initiatives, milestones, statuses and progress have no source anywhere in the system, so this build does not display them." />
        </div>

        {/* BOTTOM ROW */}
        <div className="flex gap-3 flex-1 min-h-[120px]">
          <div className="w-[30%] bg-[#182227] rounded-md border border-slate-700/50 p-3 flex flex-col">
            <h3 className="text-[10px] font-bold tracking-wider text-slate-300 uppercase mb-2">Shortage: Baseline vs Optimized <Tag kind="live" /></h3>
            {objectiveRes ? (
              <div className="flex flex-col gap-1.5 text-[10px] mt-1">
                <div className="flex justify-between"><span className="text-slate-400">Baseline shortage</span><span className="font-mono text-red-400">{objectiveRes.baseline_shortage?.toFixed(2)} Mb/d</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Optimized shortage</span><span className="font-mono text-emerald-400">{objectiveRes.optimized_shortage?.toFixed(2)} Mb/d</span></div>
                <div className="flex justify-between border-t border-slate-700/50 pt-1.5"><span className="text-slate-400">Improvement</span><span className="font-mono text-emerald-400 font-bold">{objectiveRes.improvement?.toFixed(2)} Mb/d</span></div>
              </div>
            ) : (
              <AwaitingAction prompt="The comparison comes from the procurement optimization." onRun={runOptimization} running={optRunning} />
            )}
          </div>
          <div className="w-[35%] bg-[#182227] rounded-md border border-slate-700/50 p-3 flex flex-col">
            <h3 className="text-[10px] font-bold tracking-wider text-slate-300 uppercase mb-2">Reserve Drawdowns <span className="normal-case text-slate-500 font-normal">(Mb/d)</span> <Tag kind="live" /></h3>
            {drawdowns ? (
              <ul className="text-slate-300 text-[10px] space-y-0.5 overflow-y-auto">
                {Object.entries(drawdowns).map(([id, v]) => (
                  <li key={id} className="flex justify-between"><span className="text-slate-400">{id}</span><span className="font-mono">{v.toFixed(2)}</span></li>
                ))}
              </ul>
            ) : (
              <div className="text-[10px] text-slate-500 italic mt-2">Awaiting step 2, computed by the procurement optimization.</div>
            )}
          </div>
          <div className="flex-1 bg-[#182227] rounded-md border border-slate-700/50 p-3 flex flex-col">
            <h3 className="text-[10px] font-bold tracking-wider text-slate-300 uppercase mb-2">Strategy Provenance <Tag kind="live" /></h3>
            {strategy?.result?.provenance?.length ? (
              <div className="text-[9px] text-slate-400 space-y-1 overflow-y-auto">
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

        {/* TIMELINE: derived purely from the user's horizon */}
        <div className="h-[64px] flex-shrink-0 bg-[#182227] rounded-md border border-slate-700/50 px-4 py-2.5">
          <div className="flex justify-between items-center mb-1.5">
            <h3 className="text-[10px] font-bold tracking-wider text-slate-300 uppercase">Implementation Timeline</h3>
            <Tag kind="user" />
          </div>
          <div className="relative flex justify-between items-center px-2">
            <div className="absolute left-2 right-2 top-1/2 h-px bg-slate-700" />
            {Array.from({ length: horizon + 1 }, (_, i) => (
              <div key={i} className="relative flex flex-col items-center">
                <div className={`w-2 h-2 rounded-full border ${i === 0 ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-800 border-slate-600'}`} />
                <span className="text-[8px] font-mono text-slate-500 mt-0.5">{START_YEAR + i}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className="w-[280px] flex flex-col gap-3 flex-shrink-0 overflow-y-auto no-scrollbar">

        <div className="bg-[#182227] rounded-md border border-slate-700/50 p-4 shadow-sm flex flex-col h-[210px]">
          <h3 className="text-[10px] font-bold tracking-wider text-slate-300 uppercase mb-3">Strategic Impact Metrics <Tag kind="live" /></h3>
          {optimization && shortages && routeFlows && drawdowns ? (
            <div className="flex flex-col gap-2 text-[10px]">
              <div className="flex justify-between"><span className="text-slate-400">Avoided shortage</span><span className="font-mono font-bold text-emerald-400">{improvement?.toFixed(2)} Mb/d</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Countries fully covered</span><span className="font-mono font-bold text-emerald-400">{Object.values(shortages).filter(v => v === 0).length}/{Object.keys(shortages).length}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Routes carrying flow</span><span className="font-mono font-bold text-white">{Object.values(routeFlows).filter(v => v > 0).length}/{Object.keys(routeFlows).length}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Reserves engaged</span><span className="font-mono font-bold text-white">{Object.values(drawdowns).filter(v => v > 0).length}/{Object.keys(drawdowns).length}</span></div>
            </div>
          ) : (
            <AwaitingAction prompt="All impact metrics derive from the procurement optimization." onRun={runOptimization} running={optRunning} />
          )}
        </div>

        <div className="bg-[#182227] rounded-md border border-slate-700/50 p-4 shadow-sm h-[200px] flex flex-col">
          <h3 className="text-[10px] font-bold tracking-wider text-slate-300 uppercase mb-3">Risk Assessment Summary <Tag kind="live" /></h3>
          {riskCategories && riskCategories.length ? (
            <div className="flex flex-col gap-1.5 text-[10px]">
              {riskCategories.slice(0, 4).map(c => (
                <div key={c.label} className="flex justify-between items-center">
                  <span className="text-slate-400">{c.label}</span>
                  <span className={`font-bold ${riskColor(c.level, c.score)}`}>{c.level ?? (c.score != null ? c.score : 'N/A')}</span>
                </div>
              ))}
              <div className="flex justify-between items-center border-t border-slate-700/50 pt-1.5 mt-1">
                <span className="text-slate-400">Systemic risk score</span>
                {systemicRisk != null
                  ? <span className={`font-mono font-bold ${riskColor(null, systemicRisk)}`}>{systemicRisk}/100</span>
                  : <span className="text-slate-500 font-bold">UNAVAILABLE</span>}
              </div>
            </div>
          ) : (
            <BackendUnavailable reason="Risk categories could not be loaded from the live API." />
          )}
        </div>

        <div className="bg-[#182227] rounded-md border border-slate-700/50 p-4 shadow-sm flex flex-col">
          <h3 className="text-[10px] font-bold tracking-wider text-slate-300 uppercase mb-1">Funding Plan <Tag kind="user" /></h3>
          <div className="text-[8px] text-slate-600 mb-2">Your intended split of the ${budgetB.toFixed(1)}B budget. Not sourced from data.</div>
          <div className="h-[120px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={fundingData} cx="50%" cy="50%" innerRadius={34} outerRadius={52} paddingAngle={2} dataKey="value" stroke="none">
                  {fundingData.map(f => <Cell key={f.name} fill={f.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[11px] font-bold text-white">${budgetB.toFixed(1)}B</span>
              <span className="text-[7px] text-slate-500">Total Funding</span>
            </div>
          </div>
          <div className="flex flex-col gap-1 mt-2">
            {FUNDING_SOURCES.map(s => (
              <div key={s.key} className="flex items-center gap-2 text-[10px]">
                <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                <span className="flex-1 truncate text-slate-300">{s.label}</span>
                <input type="number" min={0} max={100} value={funding[s.key]}
                  onChange={e => setFundingPct(s.key, parseInt(e.target.value) || 0)}
                  className="w-11 bg-[#0f181b] border border-slate-700 rounded py-0.5 px-1 text-[9px] font-mono text-white text-right outline-none focus:border-blue-500" />
                <span className="text-slate-500 text-[9px]">%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#182227] rounded-md border border-slate-700/50 p-4 shadow-sm flex flex-col min-h-[110px]">
          <h3 className="text-[10px] font-bold tracking-wider text-slate-300 uppercase mb-2">CAPEX Cost Model</h3>
          <BackendUnavailable reason={econ?.reason ?? 'The API reports CapEx and route costs as missing from authoritative inputs. Financial figures on this page therefore rely on your stated assumptions.'} />
        </div>

      </div>
    </div>
  );

  function toggleLeverSafe(key: string) {
    if (!leverAvailable(key)) return;
    setLevers(prev => ({ ...prev, [key]: !prev[key] }));
  }
}

function Kpi({ label, value, sub, color, tag }: { label: string; value: string; sub: string; color: string; tag: 'user' | 'live' | 'assumption' }) {
  return (
    <div className="bg-[#0f181b] border border-slate-700/60 rounded p-2.5 flex flex-col gap-0.5">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[9px] text-slate-500 truncate">{label}</span>
        <Tag kind={tag} />
      </div>
      <span className={`text-lg font-bold tracking-tight font-mono ${color}`}>{value}</span>
      <span className="text-[8px] text-slate-500 truncate">{sub}</span>
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
