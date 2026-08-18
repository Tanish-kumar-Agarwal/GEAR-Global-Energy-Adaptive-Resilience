'use client';

import { useState } from 'react';
import { Loader2, Search, Check, Download, Sliders, ChevronDown } from 'lucide-react';
import { RequiresAPI } from '@/components/ui/requires-api';

export default function StrategyLab() {
  const [running, setRunning] = useState(false);
  const [budget, setBudget] = useState(24.5);

  const planStrategy = async () => {
    setRunning(true);
    // Simulate a fake API call delay to show loading state
    setTimeout(() => {
      setRunning(false);
    }, 2500);
  };

  return (
    <div className="h-full w-full bg-[#0f172a] p-3 flex gap-3 text-slate-300 font-sans overflow-hidden">
      
      {/* LEFT COLUMN: CONFIGURATION PANEL */}
      <div className="w-[300px] flex flex-col gap-3 flex-shrink-0 bg-[#1e293b] rounded-md border border-slate-700/50 overflow-y-auto no-scrollbar shadow-sm">
        <div className="p-3 border-b border-slate-700/50 font-medium text-[11px] uppercase tracking-wider text-slate-400 bg-slate-800/50">
          Configuration Panel
        </div>
        <div className="p-4 flex flex-col gap-5">
           <div className="text-[10px] text-slate-500 mb-2 border-b border-slate-700/50 pb-2">Strategy Planner & Investment Configurator</div>
          
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1.5">Planning Horizon</label>
            <div className="relative">
              <select className="w-full bg-[#0f172a] border border-slate-700 rounded p-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 appearance-none">
                <option>5 Years (2025-2030)</option>
              </select>
              <ChevronDown className="w-3 h-3 absolute right-3 top-3 text-slate-500 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1.5">Strategic Objective</label>
            <div className="relative">
              <select className="w-full bg-[#0f172a] border border-slate-700 rounded p-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 appearance-none">
                <option>Strengthen Energy Security & Resilience</option>
              </select>
              <ChevronDown className="w-3 h-3 absolute right-3 top-3 text-slate-500 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1.5">Budget Allocation</label>
            <div className="flex justify-between items-end mb-2">
              <span className="text-[9px] text-slate-500">Low</span>
              <span className="text-[9px] text-slate-500">High</span>
            </div>
            <input type="range" min="5" max="100" step="0.5" value={budget} onChange={(e) => setBudget(parseFloat(e.target.value))} className="w-full accent-emerald-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
            <div className="flex justify-between items-center mt-4 border-b border-slate-700/50 pb-2">
              <span className="text-xs text-slate-400">Total Budget</span>
              <span className="text-sm text-slate-200">${budget.toFixed(1)}B</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-2">Investment Priority</label>
            <div className="flex flex-col gap-2">
               <Checkbox label="Supply Diversification" checked />
               <Checkbox label="Infrastructure Resilience" checked />
               <Checkbox label="Operational Efficiency" checked />
               <Checkbox label="Market Intelligence" checked />
               <Checkbox label="Technology & Innovation" checked />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1.5">Risk Appetite</label>
            <div className="relative">
              <select className="w-full bg-[#0f172a] border border-slate-700 rounded p-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 appearance-none">
                <option>Moderate</option>
              </select>
              <ChevronDown className="w-3 h-3 absolute right-3 top-3 text-slate-500 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1.5">Regions of Focus</label>
            <div className="relative mb-2">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-500" />
              <input type="text" placeholder="Search regions..." className="w-full bg-[#0f172a] border border-slate-700 rounded p-2 pl-7 text-xs text-slate-300" />
            </div>
            <div className="flex flex-wrap gap-2 text-[9px] border border-slate-700 rounded p-2 bg-[#0f172a]">
               <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded flex items-center gap-1">Middle East ✕</span>
               <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded flex items-center gap-1">Africa ✕</span>
               <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded flex items-center gap-1">Asia Pacific ✕</span>
            </div>
          </div>

          <button 
            onClick={planStrategy}
            disabled={running}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 text-white text-xs font-bold rounded transition-colors"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {running ? 'Planning...' : 'Plan & Optimize Strategy'}
          </button>
        </div>
      </div>

      {/* CENTER COLUMN: RESULTS */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        
        {/* ROW 1: STRATEGIC INVESTMENT OVERVIEW */}
        <div className="bg-[#1e293b] rounded-md border border-slate-700/50 p-4 shadow-sm relative">
           <h2 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-4">Strategic Investment Overview <span className="normal-case text-slate-500 font-normal">Optimal allocation across strategic pillars</span></h2>
           
           <div className="flex justify-between border-t border-slate-700/50 pt-4">
              <TopKpi label="Total Investment" value="$24.5B" sub="5 Year Plan" color="text-emerald-400" />
              <TopKpi label="Expected ROI" value="18.7%" sub="Average Annual" color="text-emerald-400" />
              <TopKpi label="Risk Adjusted Return" value="2.34" sub="Sharpe Ratio" color="text-emerald-400" />
              <TopKpi label="NPV (Net Present Value)" value="$12.6B" sub="(Discounted)" color="text-emerald-400" />
              <TopKpi label="Payback Period" value="3.8 Years" sub="Average" color="text-emerald-400" />
              <TopKpi label="Strategic Score" value="87/100" sub="High Impact" color="text-emerald-400" />
           </div>
           
           {/* The UI is built to match the reference, but the actual data contract does not exist yet */}
           <RequiresAPI endpoint="GET /api/v1/strategy/investment-overview" />
        </div>

        {/* ROW 2: ALLOCATION & PROJECTION */}
        <div className="flex gap-3 h-48 flex-shrink-0">
           <div className="w-[40%] bg-[#1e293b] rounded-md border border-slate-700/50 p-4 relative flex flex-col">
              <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-4">Strategic Pillar Allocation</h3>
              <RequiresAPI endpoint="GET /api/v1/strategy/pillar-allocation" />
           </div>
           <div className="w-[60%] bg-[#1e293b] rounded-md border border-slate-700/50 p-4 relative flex flex-col">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Investment Impact Projection</h3>
                 <button className="px-2 py-0.5 text-[9px] bg-slate-800 border border-slate-700 rounded text-slate-400">View as Cumulative</button>
              </div>
              <RequiresAPI endpoint="GET /api/v1/strategy/impact-projection" />
           </div>
        </div>

        {/* ROW 3: INITIATIVES ROADMAP */}
        <div className="flex-1 bg-[#1e293b] rounded-md border border-slate-700/50 p-4 relative flex flex-col min-h-[150px]">
           <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-4">Strategic Initiatives Roadmap</h3>
           <RequiresAPI endpoint="GET /api/v1/strategy/initiatives" />
        </div>

        {/* ROW 4: BOTTOM METRICS */}
        <div className="flex gap-3 h-32 flex-shrink-0">
           <div className="w-[30%] bg-[#1e293b] rounded-md border border-slate-700/50 p-3 relative flex flex-col">
              <div className="flex justify-between items-center mb-2">
                 <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Scenario Comparison</h3>
                 <button className="px-2 py-0.5 text-[8px] bg-slate-800 border border-slate-700 rounded text-slate-400">Compare Scenarios</button>
              </div>
              <RequiresAPI endpoint="GET /api/v1/strategy/scenario-comparison" />
           </div>
           <div className="w-[30%] bg-[#1e293b] rounded-md border border-slate-700/50 p-3 relative flex flex-col">
              <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-2">Strategic Benefits Summary <span className="normal-case text-slate-500">(vs. No Action)</span></h3>
              <RequiresAPI endpoint="GET /api/v1/strategy/benefits" />
           </div>
           <div className="w-[40%] bg-[#1e293b] rounded-md border border-slate-700/50 p-3 relative flex flex-col">
              <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-2">Implementation Timeline Overview</h3>
              <RequiresAPI endpoint="GET /api/v1/strategy/timeline-overview" />
           </div>
        </div>

      </div>

      {/* RIGHT COLUMN: METRICS */}
      <div className="w-[280px] flex flex-col gap-3 flex-shrink-0 overflow-y-auto no-scrollbar">
        
        {/* IMPACT METRICS */}
        <div className="bg-[#1e293b] rounded-md border border-slate-700/50 p-4 shadow-sm flex flex-col relative h-[250px]">
          <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Strategic Impact Metrics <span className="normal-case text-slate-500">(2030)</span></h3>
          <RequiresAPI endpoint="GET /api/v1/strategy/impact-metrics" />
        </div>

        {/* RISK ASSESSMENT */}
        <div className="bg-[#1e293b] rounded-md border border-slate-700/50 p-4 shadow-sm relative h-[180px]">
          <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Risk Assessment Summary</h3>
          <RequiresAPI endpoint="GET /api/v1/strategy/risk-assessment" />
        </div>

        {/* FUNDING PLAN */}
        <div className="flex-1 bg-[#1e293b] rounded-md border border-slate-700/50 p-4 shadow-sm relative min-h-[140px]">
          <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Funding Plan</h3>
          <RequiresAPI endpoint="GET /api/v1/strategy/funding-plan" />
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
         <span className={`text-2xl font-medium tracking-tight ${color}`}>{value}</span>
         <span className="text-[10px] text-slate-500 whitespace-nowrap">{sub}</span>
      </div>
   );
}

function Checkbox({ label, checked }: any) {
   return (
      <div className="flex items-center gap-2">
         <div className={`w-3 h-3 flex items-center justify-center rounded border ${checked ? 'bg-emerald-600 border-emerald-500' : 'border-slate-600'}`}>
            {checked && <Check className="w-2.5 h-2.5 text-white" />}
         </div>
         <span className="text-[11px] text-slate-300">{label}</span>
      </div>
   );
}
