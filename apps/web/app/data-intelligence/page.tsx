'use client';

import React from 'react';
function UnavailableData({ label }: { label: string }) {
  return (
    <div className="relative w-full h-full min-h-[100px] flex items-center justify-center overflow-hidden rounded-md bg-slate-900/40 border border-slate-800/60">
      <div className="relative z-10 flex flex-col items-center justify-center p-4 text-center opacity-70">
        <span className="text-[10px] font-mono text-slate-600 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
          DATA UNAVAILABLE
        </span>
      </div>
    </div>
  );
}

export default function DataIntelligencePage() {
  return (
    <div className="flex flex-col h-full bg-[#0f181b] overflow-auto text-slate-300 p-4">
      
      {/* Sub Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-4 border-b border-[#233138] w-full">
          <button className="px-4 py-2 text-sm font-semibold text-white border-b-2 border-emerald-500">Data Source</button>
          <button className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-slate-300">Datamart Status</button>
        </div>
        <button className="ml-4 flex-shrink-0 bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 px-4 py-1.5 text-xs font-bold rounded flex items-center gap-2 hover:bg-emerald-600/30 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
          SYSTEM
        </button>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-12 gap-4 flex-1">
        
        {/* Left Column: Source Management (approx 3 cols) */}
        <div className="col-span-12 xl:col-span-3 flex flex-col gap-4">
          <div className="bg-[#182227] border border-[#233138] rounded-md p-4 flex-1 flex flex-col relative overflow-hidden">
            <h2 className="text-xs font-bold text-slate-400 tracking-wider mb-4 uppercase">Source Management & Ingestion Status</h2>
            <UnavailableData label="SOURCE MANAGEMENT" />
          </div>
        </div>

        {/* Center Column: Pipeline & Processing (approx 6 cols) */}
        <div className="col-span-12 xl:col-span-6 flex flex-col gap-4">
          
          {/* Top KPIs */}
          <div className="bg-[#182227] border border-[#233138] rounded-md p-4 relative overflow-hidden">
             <h2 className="text-xs font-bold text-slate-400 tracking-wider mb-4 uppercase">Pipeline & Processing Overview</h2>
             <div className="h-[80px]">
                <UnavailableData label="PIPELINE KPIS" />
             </div>
          </div>

          {/* Ingestion Volume */}
          <div className="bg-[#182227] border border-[#233138] rounded-md p-4 relative overflow-hidden h-[250px]">
             <h2 className="text-xs font-bold text-slate-400 tracking-wider mb-4 uppercase">Ingestion Volume (Records)</h2>
             <UnavailableData label="INGESTION VOLUME" />
          </div>

          {/* Middle row split */}
          <div className="grid grid-cols-2 gap-4 flex-1">
            <div className="bg-[#182227] border border-[#233138] rounded-md p-4 relative overflow-hidden h-[180px]">
               <h2 className="text-xs font-bold text-slate-400 tracking-wider mb-4 uppercase">Pipeline Health Distribution</h2>
               <UnavailableData label="HEALTH DISTRIBUTION" />
            </div>
            <div className="bg-[#182227] border border-[#233138] rounded-md p-4 relative overflow-hidden h-[180px]">
               <h2 className="text-xs font-bold text-slate-400 tracking-wider mb-4 uppercase">Failure Breakdown (Last 24h)</h2>
               <UnavailableData label="FAILURE BREAKDOWN" />
            </div>
          </div>

          {/* Bottom Alerts Table */}
          <div className="bg-[#182227] border border-[#233138] rounded-md p-4 relative overflow-hidden h-[200px]">
             <h2 className="text-xs font-bold text-slate-400 tracking-wider mb-4 uppercase">Recent Pipeline Alerts & Events</h2>
             <UnavailableData label="PIPELINE ALERTS" />
          </div>

        </div>

        {/* Right Column: Data Quality & Top Pipelines (approx 3 cols) */}
        <div className="col-span-12 xl:col-span-3 flex flex-col gap-4">
          
          <div className="bg-[#182227] border border-[#233138] rounded-md p-4 relative overflow-hidden h-[250px]">
            <h2 className="text-xs font-bold text-slate-400 tracking-wider mb-4 uppercase">Data Quality Score</h2>
            <UnavailableData label="DATA QUALITY" />
          </div>

          <div className="bg-[#182227] border border-[#233138] rounded-md p-4 relative overflow-hidden flex-1 min-h-[250px]">
            <h2 className="text-xs font-bold text-slate-400 tracking-wider mb-4 uppercase">Top Pipelines by Volume (Last 24h)</h2>
            <UnavailableData label="TOP PIPELINES" />
          </div>

          <div className="bg-[#182227] border border-[#233138] rounded-md p-4 relative overflow-hidden h-[150px]">
            <h2 className="text-xs font-bold text-slate-400 tracking-wider mb-4 uppercase">System Resources (Live)</h2>
            <UnavailableData label="SYSTEM RESOURCES" />
          </div>

        </div>

      </div>
    </div>
  );
}
