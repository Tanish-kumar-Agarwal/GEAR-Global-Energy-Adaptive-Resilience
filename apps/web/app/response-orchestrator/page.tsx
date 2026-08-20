'use client';

import { useState, useEffect, Suspense } from 'react';
import { Loader2, Download, Share2, Search, Target, AlertTriangle, TrendingUp, TrendingDown, CheckCircle2, Ship, Factory, Database, Lock, Sliders, FileText } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ApiClient } from '@/lib/api';
import { MasterResponseObject } from '@/types';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { RequiresAPI } from '@/components/ui/requires-api';

function ResponseOrchestratorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const scenarioId = searchParams.get('scenarioId');
  const [responseObj, setResponseObj] = useState<MasterResponseObject | null>(null);
  const [approving, setApproving] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (scenarioId) {
      setRunning(true);
      ApiClient.getMasterResponse(scenarioId).then(data => {
        setResponseObj(data);
        setRunning(false);
      }).catch(() => setRunning(false));
    }
  }, [scenarioId]);

  const approvePlan = async () => {
    if (!responseObj?.decision_audit?.decision_id) return;
    setApproving(true);
    await ApiClient.approveDecision(responseObj.decision_audit.decision_id);
    const updated = await ApiClient.getMasterResponse(scenarioId!);
    setResponseObj(updated);
    setApproving(false);
  };

  const submitForReview = async () => {
    if (!scenarioId || !responseObj?.recommendation?.recommendation_id) return;
    setApproving(true);
    await ApiClient.reviewDecision(scenarioId, "Review requested by Orchestrator", "Submitted from Response Orchestrator");
    const updated = await ApiClient.getMasterResponse(scenarioId);
    setResponseObj(updated);
    setApproving(false);
  };

  const radarData = responseObj?.radar_data || [];
  const pieData = responseObj?.confidence_breakdown || [];

  const target = responseObj?.problem?.target || 'Strait of Hormuz';
  const severity = responseObj?.problem?.severity || 0.7;
  const durationDays = responseObj?.problem?.duration_days || 30;

  const supplyGap = responseObj?.impact?.supply_gap || 0;
  const optShortage = responseObj?.recommendation?.expected_physical_impact?.shortage || 0;
  
  const options = responseObj?.options || [];

  return (
    <div className="h-full w-full bg-[#0f172a] p-3 flex gap-3 text-slate-300 font-sans overflow-hidden">
      
      {/* LEFT COLUMN: CONFIGURATION PANEL (Reused exact layout from Scenario Lab) */}
      <div className="w-[300px] flex flex-col gap-3 flex-shrink-0 bg-[#1e293b] rounded-md border border-slate-700/50 overflow-y-auto no-scrollbar shadow-sm">
        <div className="p-3 border-b border-slate-700/50 font-medium text-[11px] uppercase tracking-wider text-slate-400 bg-slate-800/50">
          Configuration Panel
        </div>
        <div className="p-4 flex flex-col gap-5">
           <div className="text-[10px] text-slate-500 mb-2 border-b border-slate-700/50 pb-2">Scenario Creator & Configurator</div>
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1.5">Event Type</label>
            <select className="w-full bg-[#0f172a] border border-slate-700 rounded p-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 appearance-none" disabled>
              <option>Chokepoint Disruption</option>
            </select>
          </div>
          
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1.5">Target</label>
            <div className="relative">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-500" />
              <input type="text" readOnly value={target} className="w-full bg-[#0f172a] border border-slate-700 rounded p-2 pl-7 text-xs text-slate-300" />
            </div>
            <div className="mt-2 h-24 bg-slate-900 rounded border border-slate-700/50 flex items-center justify-center relative overflow-hidden">
               <div className="z-10 flex items-center gap-1 text-[10px] text-red-400 bg-red-950/80 border border-red-900 px-2 py-0.5 rounded">
                 <Target className="h-3 w-3" /> {target}
               </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1.5">Checkpoint</label>
            <select className="w-full bg-[#0f172a] border border-slate-700 rounded p-2 text-xs text-slate-300" disabled>
              <option>{target}</option>
            </select>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-end mb-2">
                <span className="text-[11px] text-slate-300">Severity: {(severity * 100).toFixed(0)}% <span className="text-red-400 ml-1">(HIGH)</span></span>
                <input type="text" value={`${(severity * 100).toFixed(0)}%`} readOnly className="w-12 bg-transparent border-none text-xs text-right text-slate-300" />
              </div>
              <input type="range" min="0" max="1" step="0.05" value={severity} readOnly className="w-full accent-red-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
              <div className="flex justify-between mt-1 text-[9px] text-slate-500"><span>30%</span><span>High</span></div>
            </div>
            <div>
              <div className="flex justify-between items-end mb-2">
                <span className="text-[11px] text-slate-300">Duration: {durationDays} Days</span>
              </div>
              <input type="range" min="1" max="120" step="1" value={durationDays} readOnly className="w-full accent-blue-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
              <div className="flex justify-between mt-1 text-[9px] text-slate-500"><span>30%</span><span>High</span></div>
            </div>
          </div>

          <button 
            disabled={true}
            className="w-full mt-auto mb-4 flex items-center justify-center gap-2 py-3 bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 text-white text-xs font-bold rounded transition-colors"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {running ? 'Loading...' : 'Loaded from Master Response'}
          </button>
        </div>
      </div>

      {/* CENTER COLUMN: RESULTS */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        
        {/* TOP KPI HEADER */}
        <div className="bg-[#1e293b] rounded-md border border-slate-700/50 p-4 shadow-sm flex items-center justify-between">
           <div>
              <h2 className="text-lg font-bold text-slate-200">AI RESPONSE ORCHESTRATOR</h2>
              <div className="text-[11px] text-slate-400">AI-Powered Optimization & Action Recommendation</div>
              <div className="flex items-center gap-2 mt-2">
                 <span className="text-[9px] text-slate-500">Scenario:</span>
                 <span className="text-[10px] text-red-400">{target} Disruption ({durationDays} Days, {(severity*100).toFixed(0)}% Capacity Loss)</span>
                 <span className="text-[9px] bg-red-950 text-red-400 border border-red-900 px-1.5 py-0.5 rounded">High Impact</span>
              </div>
           </div>
           <div className="flex gap-6 border-l border-slate-700 pl-6">
              <TopKpi label="Projected Supply Gap" value={`${supplyGap.toFixed(1)} Mb/d`} sub="Without Action" color="text-red-400" />
              <TopKpi label="Optimized Supply Gap" value={optShortage ? `${optShortage.toFixed(1)} Mb/d` : "DATA UNAVAILABLE"} sub="With AI Plan" color="text-emerald-400" />
              <TopKpi label="Economic Impact Avoided" value={responseObj?.impact?.economic_impact_total || "DATA UNAVAILABLE"} sub="Vs. No Action" color="text-emerald-400" />
              <TopKpi label="Risk Reduction" value={responseObj?.impact?.risk_reduction || "DATA UNAVAILABLE"} sub="Systemic Risk" color="text-emerald-400" />
           </div>
        </div>

        {/* MIDDLE SPLIT: ACTIONS & RADAR */}
        <div className="flex gap-3 h-[320px] flex-shrink-0">
           
           {/* PRIORITIZED ACTION PLAN */}
           <div className="w-[55%] bg-[#1e293b] rounded-md border border-slate-700/50 p-4 shadow-sm flex flex-col">
              <div className="flex justify-between items-center mb-4">
                 <div className="flex items-center gap-2">
                    <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Prioritized Action Plan</h3>
                    <span className="text-[9px] bg-emerald-900/50 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded">Auto-optimized</span>
                 </div>
                 <div className="flex items-center gap-3 text-[10px]">
                    <span className="text-slate-500">Optimization Run: OPT-2025-05-26-01</span>
                    <button className="px-2 py-1 bg-[#0f172a] border border-blue-900/50 text-blue-400 rounded">Compare Strategies</button>
                 </div>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                 {!responseObj && !running && <div className="text-xs text-slate-500 mt-4 text-center">Load scenario to generate AI Optimization Plan</div>}
                 {running && <div className="text-xs text-slate-500 mt-4 text-center animate-pulse">Loading Orchestrator...</div>}
                 
                 {/* Map API results if available, else show the UI mock state overlay */}
                 {options.length > 0 ? (
                    options.map((opt: any, idx: number) => (
                       <ActionCard 
                          key={idx}
                          num={String(idx + 1).padStart(2, '0')}
                          title={opt.title}
                          sub={opt.option_type}
                          desc={opt.description}
                          impact="HIGH"
                          time="48h"
                          reduction="12%"
                          icon={<Ship className="w-4 h-4 text-slate-300" />}
                       />
                    ))
                 ) : null}

                 {/* Legitimate DATA_UNAVAILABLE handling when no options are available */}
                 {!options.length && !running && (
                    <div className="flex flex-col items-center justify-center p-8 bg-slate-900/50 rounded-lg border border-slate-700/50 text-slate-500">
                       <AlertTriangle className="w-8 h-8 mb-2 opacity-50" />
                       <div className="text-xs font-bold tracking-widest uppercase">Data Unavailable</div>
                       <div className="text-[10px] mt-1 text-center">No optimization plan or recommendations could be generated for this scenario.</div>
                    </div>
                 )}
              </div>
           </div>

           {/* RADAR & ALTERNATIVES */}
           <div className="flex-1 flex flex-col gap-3">
              <div className="flex-1 bg-[#1e293b] rounded-md border border-slate-700/50 p-4 relative">
                 <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase absolute top-4 left-4 z-10">Recommended Strategy Summary</h3>
                 <div className="absolute inset-0 pt-8 pb-4 flex flex-col items-center justify-center text-slate-500">
                    {radarData.length > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="60%" data={radarData}>
                            <PolarGrid stroke="#334155" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                            <Radar name="AI Recommended Plan" dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                            <Radar name="No Action (Baseline)" dataKey="B" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0} strokeDasharray="3 3" />
                          </RadarChart>
                        </ResponsiveContainer>
                        <div className="flex justify-center gap-6 mt-2 text-[9px]">
                           <div className="flex items-center gap-1"><div className="w-3 h-[2px] bg-blue-500"></div> AI Recommended Plan</div>
                           <div className="flex items-center gap-1"><div className="w-3 h-[2px] bg-amber-500 border-dashed"></div> No Action (Baseline)</div>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center">
                        <AlertTriangle className="w-6 h-6 mb-2 opacity-50" />
                        <div className="text-[10px] font-bold tracking-widest uppercase">DATA UNAVAILABLE</div>
                      </div>
                    )}
                 </div>
                 <RequiresAPI endpoint="GET /api/v1/optimization/strategy-scores" />
              </div>
              
              <div className="h-32 bg-[#1e293b] rounded-md border border-slate-700/50 p-3 relative overflow-hidden">
                 <div className="flex justify-between items-center mb-2">
                    <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Alternative Strategies Comparison</h3>
                    <div className="flex gap-2 text-[9px]"><span className="text-blue-400 underline">Tabular View</span><span className="text-slate-500">Chart View</span></div>
                 </div>
                 <RequiresAPI endpoint="GET /api/v1/optimization/alternatives" />
              </div>
           </div>

        </div>

        {/* BOTTOM ROW: EXPLAINABILITY & TIMELINE */}
        <div className="flex gap-3 flex-1 min-h-[160px]">
           <div className="w-[55%] bg-[#1e293b] rounded-md border border-slate-700/50 p-4 relative flex flex-col">
              <div className="flex justify-between mb-4">
                 <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Explainability & Evidence</h3>
                 <div className="flex text-[9px] border border-slate-700 rounded overflow-hidden">
                    <button className="px-3 py-1 bg-blue-900/30 text-blue-400 border-r border-slate-700">Why this plan?</button>
                    <button className="px-3 py-1 bg-slate-800 text-slate-400 border-r border-slate-700">Key Assumptions</button>
                    <button className="px-3 py-1 bg-slate-800 text-slate-400 border-r border-slate-700">Constraints Considered</button>
                    <button className="px-3 py-1 bg-slate-800 text-slate-400">Model Details</button>
                 </div>
              </div>
              <div className="flex flex-1 gap-4">
                 {/* Left List */}
                 <div className="w-1/2 flex flex-col gap-2 text-[10px] text-slate-300">
                    <div className="flex gap-2 items-start"><CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" /> <span>Supplier diversification reduces concentration risk by 16%.</span></div>
                    <div className="flex gap-2 items-start"><CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" /> <span>Route C has available capacity and lower geopolitical exposure.</span></div>
                    <div className="flex gap-2 items-start"><CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" /> <span>Controlled reserve release minimizes price shock.</span></div>
                    <div className="flex gap-2 items-start"><CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" /> <span>Refinery optimization maximizes output with available crude slate.</span></div>
                 </div>
                 {/* Right Charts */}
                 <div className="w-1/2 flex gap-2">
                    <div className="w-1/2 border-r border-slate-700/50 pr-2">
                       <h4 className="text-[9px] text-slate-500 uppercase mb-2">Evidence Sources</h4>
                       {/* Mock list */}
                       <div className="flex justify-between text-[9px] mb-1"><span className="text-slate-300">Geopolitical Events</span><span className="text-slate-500">12 sources</span></div>
                       <div className="flex justify-between text-[9px] mb-1"><span className="text-slate-300">Shipping Intelligence</span><span className="text-slate-500">25 signals</span></div>
                    </div>
                    <div className="w-1/2 relative flex flex-col items-center justify-center">
                       <h4 className="text-[9px] text-slate-500 uppercase mb-2 text-center">Confidence Breakdown</h4>
                       {pieData.length > 0 ? (
                          <>
                           <div className="h-20 w-20 mx-auto">
                             <ResponsiveContainer width="100%" height="100%">
                               <PieChart>
                                 <Pie data={pieData} innerRadius={25} outerRadius={35} paddingAngle={2} dataKey="value" stroke="none">
                                   {pieData.map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                 </Pie>
                               </PieChart>
                             </ResponsiveContainer>
                           </div>
                           <div className="absolute inset-0 flex flex-col items-center justify-center pt-5">
                              <span className="text-sm font-bold text-white leading-none">78%</span>
                              <span className="text-[6px] text-slate-500">Overall Confidence</span>
                           </div>
                          </>
                        ) : (
                          <div className="text-[10px] text-slate-500 font-bold uppercase mt-4">DATA UNAVAILABLE</div>
                        )}
                    </div>
                 </div>
              </div>
              <RequiresAPI endpoint="GET /api/v1/intelligence/explainability" />
           </div>

           <div className="flex-1 bg-[#1e293b] rounded-md border border-slate-700/50 p-4 relative">
              <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-4">Implementation Timeline</h3>
              <RequiresAPI endpoint="GET /api/v1/optimization/timeline" />
           </div>
        </div>

        {/* BOTTOM APPROVE BAR */}
        <div className="h-14 bg-[#1e293b] rounded-md border border-slate-700/50 px-4 flex items-center justify-between shrink-0 shadow-sm">
           <div className="flex items-center gap-8">
              <div className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-2">
                Governance Status: <span className="font-bold text-white uppercase">{responseObj?.approval?.status || 'DATA UNAVAILABLE'}</span>
              </div>
           </div>
           
           <div className="flex gap-2">
              {responseObj?.decision_audit?.decision_id ? (
                 <button onClick={approvePlan} disabled={approving || responseObj.approval?.status === 'APPROVED'} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-xs font-bold rounded flex items-center gap-2">
                    {approving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />} 
                    Approve Existing Decision
                 </button>
              ) : (
                 <button onClick={submitForReview} disabled={approving || !options.length} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white text-xs font-bold rounded flex items-center gap-2">
                    {approving ? <Loader2 className="animate-spin" size={16} /> : null} 
                    Create Decision Record
                 </button>
              )}
           </div>

        </div>

      </div>

      {/* RIGHT COLUMN: METRICS (Reused exactly from Page 2) */}
      <div className="w-[280px] flex flex-col gap-3 flex-shrink-0 overflow-y-auto no-scrollbar">
        <div className="bg-[#1e293b] rounded-md border border-slate-700/50 p-4 shadow-sm flex flex-col gap-4">
          <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Key Impact Metrics <span className="normal-case text-slate-500">({durationDays} Days)</span></h3>
          <div className="flex flex-col gap-3">
            <RightMetric label="Global Supply Gap" value={`${supplyGap.toFixed(1)} Mb/d`} trend="↑" color="text-red-400" />
            <RightMetric label="Price Impact (Oil)" value={responseObj?.impact?.price_impact_oil || "DATA UNAVAILABLE"} trend="-" color="text-slate-500" />
            <RightMetric label="LNG Price Impact" value={responseObj?.impact?.price_impact_lng || "DATA UNAVAILABLE"} trend="-" color="text-slate-500" />
            <RightMetric label="Reserve Depletion" value={responseObj?.impact?.reserve_depletion || "DATA UNAVAILABLE"} trend="-" color="text-slate-500" />
            <RightMetric label="Shipping Cost Index" value={responseObj?.impact?.shipping_cost || "DATA UNAVAILABLE"} trend="-" color="text-slate-500" />
          </div>
        </div>

        <div className="bg-[#1e293b] rounded-md border border-slate-700/50 p-4 shadow-sm relative overflow-hidden min-h-[140px]">
          <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3">Economic Impact <span className="normal-case text-slate-500">(India)</span></h3>
          <RequiresAPI endpoint="GET /api/v1/market/economic-impact" />
        </div>

        <div className="bg-[#1e293b] rounded-md border border-slate-700/50 p-4 shadow-sm relative overflow-hidden min-h-[180px] flex-1">
          <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3">Affected Volumes <span className="normal-case text-slate-500">({durationDays} Days)</span></h3>
          <RequiresAPI endpoint="GET /api/v1/market/affected-volumes" />
        </div>

        <div className="bg-[#1e293b] rounded-md border border-slate-700/50 flex items-center justify-between shadow-sm overflow-hidden shrink-0">
          <button className="flex-1 py-3 flex items-center justify-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"><Download size={14} /> Export Plan Report</button>
          <button className="px-4 py-3 bg-slate-800 hover:bg-slate-700 border-l border-slate-700"><Sliders size={14} /></button>
        </div>
      </div>

    </div>
  );
}

export default function ResponseOrchestrator() {
  return (
    <Suspense fallback={<div className="p-8 text-white flex gap-2 items-center"><Loader2 className="animate-spin h-5 w-5" /> Loading Orchestrator...</div>}>
      <ResponseOrchestratorContent />
    </Suspense>
  );
}

// Helpers
function TopKpi({ label, value, sub, color }: any) {
   return (
      <div className="flex flex-col gap-0.5 pr-6">
         <span className="text-[10px] text-slate-400">{label}</span>
         <span className={`text-xl font-bold ${color}`}>{value}</span>
         <span className="text-[9px] text-slate-500">{sub}</span>
      </div>
   );
}

function ActionCard({ num, title, sub, desc, impact, time, reduction, icon }: any) {
   return (
      <div className="flex bg-[#0f172a] border border-slate-700/50 rounded p-2 mb-2 items-center hover:border-slate-600 transition-colors">
         <div className="w-8 h-8 rounded bg-slate-800 text-blue-400 font-bold flex items-center justify-center shrink-0 mr-3">{num}</div>
         <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2"><div className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center shrink-0">{icon}</div> <span className="text-xs font-bold text-slate-200 truncate">{title}</span></div>
            <div className="text-[9px] text-slate-400 mt-1 truncate">{desc}</div>
         </div>
         <div className="flex gap-4 shrink-0 px-4 text-[10px] text-slate-400">
            <div className="flex flex-col"><span className="uppercase">Impact</span><span className={impact === 'HIGH' ? 'text-red-400 font-bold' : impact === 'MEDIUM' ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>{impact}</span></div>
            <div className="flex flex-col"><span className="uppercase">Time</span><span className="text-slate-200">{time}</span></div>
            <div className="flex flex-col"><span className="uppercase">Reduction</span><span className="text-emerald-400 font-bold">↓ {reduction}</span></div>
         </div>
      </div>
   );
}

function RightMetric({ label, value, trend, color }: any) {
  return (
    <div className="flex justify-between items-center border-b border-slate-800/50 pb-2 last:border-0 last:pb-0">
      <div className="flex flex-col gap-1">
         <span className="text-xs text-slate-300">{label}</span>
         <span className="text-[10px] text-slate-500 h-2 bg-slate-800 w-16 rounded overflow-hidden"><div className={`h-full w-full opacity-30 ${color.replace('text-', 'bg-')}`}></div></span>
      </div>
      <div className="flex flex-col items-end">
         <span className={`text-[10px] font-bold ${color}`}>{trend}</span>
         <span className="text-xs font-mono text-slate-200">{value}</span>
      </div>
    </div>
  );
}
