'use client';

import { useState, useEffect } from 'react';
import { Loader2, Search, Check, Download, Sliders, ChevronDown } from 'lucide-react';
import { RequiresAPI } from '@/components/ui/requires-api';

export default function StrategyLab() {
  const [running, setRunning] = useState(false);
  const [strategyResult, setStrategyResult] = useState<any>(null);
  
  // Levers state
  const [levers, setLevers] = useState({
    supplier_diversification: true,
    route_diversification: true,
    reserve_strategy: false
  });

  const planStrategy = async () => {
    setRunning(true);
    try {
        // Enqueue strategy scenario
        const activeLevers: any[] = [];
        if (levers.supplier_diversification) activeLevers.push({ type: 'supplier_diversification', target_id: 'SUP_002' });
        
        const res = await fetch('http://localhost:8000/api/v1/strategy/scenarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Strategic Diversification Plan',
                baseline_scenario_id: 'baseline-default',
                levers: activeLevers
            })
        });
        const data = await res.json();
        const sid = data.strategy_id;
        
        // Poll for completion
        const interval = setInterval(async () => {
            const pollRes = await fetch(`http://localhost:8000/api/v1/strategy/scenarios/${sid}`);
            const pollData = await pollRes.json();
            if (pollData.status === 'COMPLETED' || pollData.status === 'FAILED') {
                clearInterval(interval);
                setStrategyResult(pollData);
                setRunning(false);
            }
        }, 1500);
        
    } catch (e) {
        setRunning(false);
        console.error(e);
    }
  };

  const toggleLever = (key: keyof typeof levers) => {
    setLevers(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderDataUnavailable = () => (
      <div className="flex items-center justify-center bg-slate-900/50 border border-dashed border-slate-700 h-full w-full rounded p-4 text-center">
          <div className="flex flex-col items-center">
              <span className="text-red-400/80 font-bold text-[10px] uppercase tracking-widest mb-1">DATA UNAVAILABLE</span>
              <span className="text-slate-500 text-[9px] max-w-[200px]">Financial or forecasting models are not populated with authoritative inputs for this baseline.</span>
          </div>
      </div>
  );

  return (
    <div className="h-full min-h-[850px] min-w-[1280px] w-full bg-[#0f181b] p-3 flex gap-3 text-slate-300 font-sans">
      
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
            <div className="flex flex-col gap-2">
               <div onClick={() => toggleLever('supplier_diversification')} className="cursor-pointer">
                   <Checkbox label="Supplier Diversification" checked={levers.supplier_diversification} />
               </div>
               <div onClick={() => toggleLever('route_diversification')} className="cursor-pointer">
                   <Checkbox label="Route Diversification" checked={levers.route_diversification} />
               </div>
               <div onClick={() => toggleLever('reserve_strategy')} className="cursor-pointer">
                   <Checkbox label="Reserve Allocation Strategy" checked={levers.reserve_strategy} />
               </div>
               <Checkbox label="Financial Optimization (CAPEX)" checked={false} disabled={true} />
            </div>
            <div className="text-[9px] text-slate-500 mt-2 italic">Note: Financial Optimization is disabled due to missing authoritative CAPEX inputs.</div>
          </div>

          <button 
            onClick={planStrategy}
            disabled={running}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 text-white text-xs font-bold rounded transition-colors"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {running ? 'Simulating Strategy...' : 'Evaluate Strategy Overhead'}
          </button>
        </div>
      </div>

      {/* CENTER COLUMN: RESULTS */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        
        {/* ROW 1: STRATEGIC INVESTMENT OVERVIEW */}
        <div className="bg-[#182227] rounded-md border border-slate-700/50 p-4 shadow-sm relative">
           <h2 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-4">Strategic Impact Overview <span className="normal-case text-slate-500 font-normal">Calculated structural changes against baseline</span></h2>
           
           <div className="flex justify-between border-t border-slate-700/50 pt-4 relative min-h-[80px]">
              {strategyResult ? (
                  <div className="flex gap-8 px-4 w-full justify-between items-center">
                      <TopKpi label="Status" value={strategyResult.status.toUpperCase()} color={strategyResult.status === 'COMPLETED' ? "text-emerald-400" : "text-amber-400"} sub={`Strategy ID: ${strategyResult.id.substring(0,8)}`} />
                      <TopKpi label="Avoided Physical Shortage" value="DATA UNAVAILABLE" color="text-slate-500" sub="Requires full graph re-simulation" />
                      <TopKpi label="Avoided Economic Loss" value={strategyResult.result?.economic_impact?.status || "UNAVAILABLE"} color="text-slate-500" sub={strategyResult.result?.economic_impact?.reason || ""} />
                      <TopKpi label="Dependency Concentration" value={`${strategyResult.result?.resilience?.dependency_concentration?.before || 0} → ${strategyResult.result?.resilience?.dependency_concentration?.after || 0}`} color="text-emerald-400" sub="Calculated Delta" />
                  </div>
              ) : (
                  <div className="w-full text-center text-slate-500 text-xs mt-4">Run simulation to evaluate baseline overlays</div>
              )}
           </div>
        </div>

        {/* ROW 2: ALLOCATION & PROJECTION */}
        <div className="flex gap-3 h-48 flex-shrink-0">
           <div className="w-[40%] bg-[#182227] rounded-md border border-slate-700/50 p-4 relative flex flex-col">
              <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-4">Strategic Pillar Execution</h3>
              {!strategyResult ? (
                  <RequiresAPI endpoint="POST /api/v1/strategy/scenarios" />
              ) : (
                  <div className="text-xs text-slate-300">
                      <div><span className="font-bold text-slate-400">Targeting Baseline:</span> {strategyResult.baseline_scenario_id}</div>
                      <div className="mt-2"><span className="font-bold text-slate-400">Levers Applied:</span></div>
                      <ul className="list-disc pl-4 mt-1 text-[10px]">
                          {strategyResult.levers?.map((l: any, i: number) => (
                              <li key={i}>{l.type.replace('_', ' ').toUpperCase()}</li>
                          )) || "None"}
                      </ul>
                  </div>
              )}
           </div>
           <div className="w-[60%] bg-[#182227] rounded-md border border-slate-700/50 p-4 relative flex flex-col">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Long-Term Forecast Projection</h3>
              </div>
              {renderDataUnavailable()}
           </div>
        </div>

        {/* ROW 3: INITIATIVES ROADMAP */}
        <div className="flex-1 bg-[#182227] rounded-md border border-slate-700/50 p-4 relative flex flex-col min-h-[150px]">
           <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-4">Affected Physical Entities</h3>
           {!strategyResult ? (
               <RequiresAPI endpoint="GET /api/v1/strategy/scenarios/{id}" />
           ) : (
               <div className="flex gap-2 text-xs">
                   <div className="p-3 bg-slate-900 rounded border border-slate-700 flex-1">
                       <h4 className="font-bold text-[10px] text-slate-500 uppercase mb-2">Affected Suppliers</h4>
                       <ul className="list-disc pl-4 text-slate-300 text-[10px]">
                           {strategyResult.result?.strategic_state?.affected_suppliers?.map((s: string) => <li key={s}>{s}</li>) || <li>No directly affected suppliers found.</li>}
                       </ul>
                   </div>
               </div>
           )}
        </div>

        {/* ROW 4: BOTTOM METRICS */}
        <div className="flex gap-3 h-32 flex-shrink-0">
           <div className="w-[30%] bg-[#182227] rounded-md border border-slate-700/50 p-3 relative flex flex-col">
              <div className="flex justify-between items-center mb-2">
                 <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Scenario Comparison</h3>
              </div>
              <RequiresAPI endpoint="GET /api/v1/strategy/scenarios/{id}/comparison" />
           </div>
           <div className="w-[30%] bg-[#182227] rounded-md border border-slate-700/50 p-3 relative flex flex-col">
              <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-2">Strategic Assumptions</h3>
              {strategyResult ? (
                  <ul className="list-disc pl-4 text-[9px] text-slate-400 h-full overflow-y-auto">
                      {strategyResult.result?.assumptions?.map((a: string, i: number) => <li key={i}>{a}</li>) || "None"}
                  </ul>
              ) : (
                  <div className="text-[9px] text-slate-600 italic">No scenario executed</div>
              )}
           </div>
           <div className="w-[40%] bg-[#182227] rounded-md border border-slate-700/50 p-3 relative flex flex-col">
              <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-2">Strategy Provenance</h3>
              {strategyResult ? (
                  <div className="text-[9px] text-slate-400 space-y-1 overflow-y-auto h-full">
                      {strategyResult.result?.provenance?.map((p: any, i: number) => (
                          <div key={i} className="flex justify-between border-b border-slate-700/50 pb-1">
                              <span>[{p.source}]</span> <span>{p.action}</span> <span className="text-slate-600">{p.timestamp}</span>
                          </div>
                      ))}
                  </div>
              ) : (
                  <div className="text-[9px] text-slate-600 italic">No scenario executed</div>
              )}
           </div>
        </div>

      </div>

      {/* RIGHT COLUMN: METRICS */}
      <div className="w-[280px] flex flex-col gap-3 flex-shrink-0 overflow-y-auto no-scrollbar">
        
        {/* IMPACT METRICS */}
        <div className="bg-[#182227] rounded-md border border-slate-700/50 p-4 shadow-sm flex flex-col relative h-[250px]">
          <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-4">Strategic Impact Metrics</h3>
          {renderDataUnavailable()}
        </div>

        {/* RISK ASSESSMENT */}
        <div className="bg-[#182227] rounded-md border border-slate-700/50 p-4 shadow-sm relative h-[180px]">
          <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-4">Risk Assessment Summary</h3>
          {strategyResult ? (
              <div className="flex flex-col gap-2">
                 <div className="text-[10px] text-slate-400">Supplier Resilience Score: <span className="text-white font-bold ml-1">{strategyResult.result?.resilience?.supply_resilience?.score || 'UNAVAILABLE'}</span></div>
                 <div className="text-[10px] text-slate-400">Route Resilience Score: <span className="text-white font-bold ml-1">{strategyResult.result?.resilience?.route_resilience?.score || 'UNAVAILABLE'}</span></div>
              </div>
          ) : (
              <div className="text-xs text-slate-500 text-center mt-4">Waiting for run...</div>
          )}
        </div>

        {/* FUNDING PLAN */}
        <div className="flex-1 bg-[#182227] rounded-md border border-slate-700/50 p-4 shadow-sm relative min-h-[140px]">
          <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-4">CAPEX Funding Plan</h3>
          {renderDataUnavailable()}
        </div>

      </div>

    </div>
  );
}

// Helpers
function TopKpi({ label, value, sub, color }: any) {
   return (
      <div className="flex flex-col gap-1 pr-6 border-r border-slate-700/50 last:border-0">
         <span className="text-[10px] text-slate-400 whitespace-nowrap">{label}</span>
         <span className={`text-xl font-bold tracking-tight ${color}`}>{value}</span>
         <span className="text-[9px] text-slate-500 whitespace-nowrap">{sub}</span>
      </div>
   );
}

function Checkbox({ label, checked, disabled }: any) {
   return (
      <div className={`flex items-center gap-2 ${disabled ? 'opacity-50' : ''}`}>
         <div className={`w-3 h-3 flex items-center justify-center rounded border ${checked ? 'bg-emerald-600 border-emerald-500' : 'border-slate-600'}`}>
            {checked && <Check className="w-2.5 h-2.5 text-white" />}
         </div>
         <span className="text-[11px] text-slate-300">{label}</span>
      </div>
   );
}
