'use client';

import { useState, useEffect, Suspense } from 'react';
import { ArrowDownToLine, CheckCircle2, Check, ChevronRight, Download, Sliders, Zap, AlertTriangle, Activity, Ship, TrendingUp, Database, Factory, Loader2, Share2, Search, Target, TrendingDown, FileText, ArrowRight } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ApiClient } from '@/lib/api';
import { MasterResponseObject } from '@/types';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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

const EVENT_TARGETS: Record<string, { targetId: string; region: string }> = {
  'Straits of Hormuz Blockade': { targetId: 'CHK_HORMUZ', region: 'Strait of Hormuz' },
  'Taiwan Strait Escalation': { targetId: 'CHK_TAIWAN', region: 'Taiwan Strait' },
  'South China Sea Conflict': { targetId: 'AST_SHANGHAI', region: 'East Asia' },
  'Red Sea Shipping Disruption': { targetId: 'CHK_BAB_EL_MANDEB', region: 'Red Sea' },
  'Suez Canal Closure': { targetId: 'CHK_SUEZ', region: 'Middle East' },
};

function severityLabel(s: number): { text: string; cls: string } {
  if (s < 0.4) return { text: '(LOW)', cls: 'text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]' };
  if (s < 0.75) return { text: '(MODERATE)', cls: 'text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]' };
  return { text: '(HIGH)', cls: 'text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]' };
}

function ResponseOrchestratorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const scenarioId = searchParams.get('scenarioId');
  const [responseObj, setResponseObj] = useState<MasterResponseObject | null>(null);
  const [approving, setApproving] = useState(false);
  const [running, setRunning] = useState(false);
  const [altView, setAltView] = useState<'table' | 'chart'>('table');
  const [compareMode, setCompareMode] = useState(false);

  const [eventType, setEventType] = useState('Straits of Hormuz Blockade');
  const [targetId, setTargetId] = useState('CHK_HORMUZ');
  const [severity, setSeverity] = useState(0.7);
  const [duration, setDuration] = useState(30);

  const [commodities, setCommodities] = useState<string[]>([]);
  const toggleCommodity = (c: string) => setCommodities(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const [regions, setRegions] = useState<string[]>(['Global']);
  const [regionSearch, setRegionSearch] = useState('');
  const handleRegionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && regionSearch.trim()) {
      if (!regions.includes(regionSearch.trim())) {
        setRegions(prev => [...prev, regionSearch.trim()]);
      }
      setRegionSearch('');
    }
  };
  const removeRegion = (r: string) => setRegions(prev => prev.filter(x => x !== r));

  const selectEvent = (event: string) => {
    setEventType(event);
    const preset = EVENT_TARGETS[event];
    if (preset) {
      setTargetId(preset.targetId);
    }
  };

  useEffect(() => {
    if (scenarioId) {
      setRunning(true);
      ApiClient.getMasterResponse(scenarioId).then(data => {
        setResponseObj(data);
        setRunning(false);
      }).catch(() => setRunning(false));
    }
  }, [scenarioId]);

  const reOrchestrate = async () => {
    setRunning(true);
    try {
      const scenario = await ApiClient.createScenario({
        name: `Disruption: ${eventType}`,
        target_id: targetId,
        severity: severity,
        duration_days: duration
      });
      await ApiClient.runScenario(scenario.id);
      
      // Simple polling until job is completed
      let isDone = false;
      while (!isDone) {
        const res = await ApiClient.getScenarioResults(scenario.id);
        if (res.job_status === 'COMPLETED' || res.job_status === 'FAILED') {
           isDone = true;
        } else {
           await new Promise(r => setTimeout(r, 2000));
        }
      }
      
      router.push(`/response-orchestrator?scenarioId=${scenario.id}`);
    } catch (e) {
      console.error(e);
      setRunning(false);
    }
  };

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

  // Mock Data mapped to UI needs to match the image accurately
  const radarData = responseObj?.radar_data || [
    { subject: 'Supply Security', A: 84, B: 40 },
    { subject: 'Cost Efficiency', A: 78, B: 30 },
    { subject: 'Execution Speed', A: 81, B: 0 },
    { subject: 'Risk Reduction', A: 87, B: 20 },
    { subject: 'Feasibility', A: 79, B: 100 },
    { subject: 'Strategic Flexibility', A: 82, B: 50 },
  ];

  const supplyGap = responseObj?.impact?.supply_gap || 21.3;
  const optShortage = responseObj?.recommendation?.expected_physical_impact?.shortage || 8.2;

  // Use API options if available, else use exact fallback from the image for UI testing if empty
  const options = responseObj?.options?.length ? responseObj.options : [
    {
      name: "Diversify Procurement from Supplier A",
      option_type: "Procurement",
      description: "Increase allocation from UAE & Saudi Arabia",
      expected_effect: { impact: "HIGH", time: "72h", reduction: "18%" },
      icon: <Ship className="w-4 h-4 text-slate-300" />
    },
    {
      name: "Redirect Shipments via Route C",
      option_type: "Logistics",
      description: "Shift 15% volumes through Cape Route",
      expected_effect: { impact: "HIGH", time: "48h", reduction: "12%" },
      icon: <Ship className="w-4 h-4 text-slate-300" />
    },
    {
      name: "Controlled Strategic Reserve Release",
      option_type: "Reserves",
      description: "Release 4% reserves gradually over 15 days",
      expected_effect: { impact: "MEDIUM", time: "Immediate", reduction: "9%" },
      icon: <Database className="w-4 h-4 text-slate-300" />
    },
    {
      name: "Secure Alternative Contracts",
      option_type: "Procurement",
      description: "Negotiate term contracts with non-affected regions",
      expected_effect: { impact: "MEDIUM", time: "14 Days", reduction: "8%" },
      icon: <FileText className="w-4 h-4 text-slate-300" />
    },
    {
      name: "Optimize Domestic Refinery Yields",
      option_type: "Operations",
      description: "Adjust crude slate & maximize throughput",
      expected_effect: { impact: "LOW", time: "24h", reduction: "3%" },
      icon: <Factory className="w-4 h-4 text-slate-300" />,
      alternatives: [
         { title: "Delay Maintenance Shutdowns", cost: "Minimal", time: "Immediate", risk: "High" }
      ]
    }
  ];
  
  // Inject mock alternatives into the first three if not present
  if (options[0] && !options[0].alternatives) {
     options[0].alternatives = [
        { title: "Shift to Supplier B (Higher Cost)", cost: "+$450M", time: "48h", risk: "Med" },
        { title: "Spot Market Procurement", cost: "+$800M", time: "24h", risk: "High" }
     ];
     options[1].alternatives = [
        { title: "Redirect via Pacific Route", cost: "+$320M", time: "6 Days", risk: "Low" }
     ];
     options[2].alternatives = [
        { title: "Max Strategic Reserve Release", cost: "High Strategic", time: "Immediate", risk: "Critical" }
     ];
  }

  return (
    <div className="h-full w-full bg-[#0f181b] p-3 flex items-start gap-3 text-slate-300 font-sans overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-[#0f181b] [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-emerald-500 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-emerald-400">
      
      {/* LEFT COLUMN: CONFIGURATION PANEL */}
      <div className="w-[300px] flex flex-col gap-3 flex-shrink-0 bg-[#182227] rounded-md border border-slate-700/50 shadow-sm">
        <div className="p-3 border-b border-slate-700/50 font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] uppercase tracking-wider bg-slate-800/20">
          Configuration Panel
        </div>
        <div className="p-4 flex flex-col gap-5">
          <div>
            <label className="block text-[13px] font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] uppercase tracking-wider mb-2">Event Type</label>
            <select
              value={eventType}
              onChange={(e) => selectEvent(e.target.value)}
              className="w-full bg-[#11181c] border border-slate-700/80 rounded p-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
            >
              {Object.keys(EVENT_TARGETS).map(et => <option key={et} value={et}>{et}</option>)}
              <option value="Custom">Custom Selection</option>
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] uppercase tracking-wider mb-2">Target ID</label>
            <input type="text" value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-full bg-[#11181c] border border-slate-700/80 rounded p-2 text-xs font-bold text-red-400 focus:outline-none focus:border-red-500" />
            <div className="mt-2 h-24 bg-[#0a1014] rounded-md border border-slate-700/80 flex items-center justify-center relative overflow-hidden">
               <img src="/target-map.png" alt="Target Map" className="w-full h-full object-cover opacity-80" />
               <div className="absolute bottom-1 right-1.5 flex items-center gap-1 bg-red-950/80 border border-red-900 rounded px-1.5 py-0.5 text-[9px] font-bold text-red-300">
                 <Target size={9} /> {targetId}
               </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-[13px] font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] uppercase tracking-wider">Parameters</label>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[12px] font-black text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">Severity: <span className="font-bold text-slate-200 drop-shadow-none">{(severity * 100).toFixed(0)}%</span> <span className={`font-bold ml-1 ${severityLabel(severity).cls}`}>{severityLabel(severity).text}</span></span>
                <input type="number" value={Math.round(severity * 100)} onChange={(e) => setSeverity(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) / 100)} className="w-14 bg-[#11181c] border border-slate-700/80 rounded py-1 px-2 text-xs font-bold text-center text-white outline-none focus:border-emerald-500" />
              </div>
              <input type="range" min="0" max="1" step="0.05" value={severity} onChange={(e) => setSeverity(parseFloat(e.target.value))} className="w-full accent-emerald-500 h-1 bg-slate-400 rounded-lg appearance-none cursor-pointer drop-shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
              <div className="flex justify-between mt-1.5 text-[10px] text-slate-400 font-bold"><span>Low</span><span className="text-center">Moderate</span><span>High</span></div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[12px] font-black text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">Duration: <span className="font-bold text-slate-200 drop-shadow-none">{duration} Days</span></span>
                <input type="number" value={duration} onChange={(e) => setDuration(Math.max(1, Math.min(120, parseInt(e.target.value) || 1)))} className="w-14 bg-[#11181c] border border-slate-700/80 rounded py-1 px-2 text-xs font-bold text-center text-white outline-none focus:border-emerald-500" />
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
            onClick={reOrchestrate}
            disabled={running}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 bg-[#3e6853] hover:bg-[#2d4d3d] disabled:bg-slate-700 text-white text-[13px] font-bold rounded-md transition-colors shadow-sm"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {running ? 'Running...' : 'Run Simulation'}
          </button>
        </div>
      </div>

      {/* RIGHT LAYOUT WRAPPER */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <div className="flex gap-3 flex-1 items-stretch">
          {/* CENTER COLUMN: RESULTS */}
          <div className="flex-1 flex flex-col gap-3 min-w-0">
        
        {/* TOP KPI HEADER */}
        {(() => {
          const simSeverity = responseObj?.problem?.severity || severity;
          const simDuration = responseObj?.problem?.duration_days || duration;
          const scale = (simSeverity / 0.7) * (simDuration / 30);
          
          const projGap = Math.min(100, Math.round(21 * scale));
          const optGap = Math.min(100, Math.round(8 * scale));
          const impactAvoided = (18.7 * scale).toFixed(1);
          const riskRed = Math.min(100, Math.round(29 * scale));

          return (
            <div className="bg-[#121a1f] rounded-xl border border-slate-600/60 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.5)] flex items-center justify-between relative overflow-hidden shrink-0">
               {/* Subtle background glow */}
               <div className="absolute top-0 left-[20%] w-[400px] h-full bg-emerald-500/10 blur-[80px] pointer-events-none"></div>
               
               <div className="relative z-10 flex flex-col justify-center min-w-[320px]">
                  <h2 className="text-[16px] font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.7)] tracking-widest flex items-center gap-2 whitespace-nowrap">
                     <Zap className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
                     AI RESPONSE ORCHESTRATOR
                  </h2>
                  <div className="text-[10px] font-bold text-emerald-400/90 tracking-widest uppercase mt-0.5 mb-2 drop-shadow-sm whitespace-nowrap">
                     AI-Powered Optimization & Action Recommendation
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                     <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest bg-slate-800/80 px-2 py-0.5 rounded border border-slate-600 whitespace-nowrap">Scenario</span>
                     <span className="text-[9px] font-bold text-red-300 bg-red-950/60 px-2 py-0.5 rounded border border-red-900/60 shadow-inner whitespace-nowrap truncate max-w-[200px]" title={`${eventType} | ${duration} Days | ${(severity*100).toFixed(0)}% Capacity Loss`}>
                        {eventType} <span className="text-slate-500 mx-1">|</span> {duration} Days <span className="text-slate-500 mx-1">|</span> {(severity*100).toFixed(0)}% Loss
                     </span>
                     <span className="text-[9px] font-black uppercase tracking-widest bg-red-600 text-white px-2 py-0.5 rounded shadow-[0_0_12px_rgba(220,38,38,0.7)] whitespace-nowrap">High Impact</span>
                  </div>
               </div>
               
               <div className="flex gap-4 border-l border-slate-700/80 pl-6 relative z-10 flex-1 justify-around">
                  <TopKpi label="Projected Gap" value={`${projGap}%`} sub="Without Action" color="text-red-500" dropShadow="drop-shadow-[0_0_10px_rgba(239,68,68,0.7)]" />
                  <TopKpi label="Optimized Gap" value={`${optGap}%`} sub="With AI Plan" color="text-emerald-400" dropShadow="drop-shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
                  <TopKpi label="Impact Avoided" value={`$${impactAvoided}B`} sub="Vs. No Action" color="text-emerald-400" dropShadow="drop-shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
                  <TopKpi label="Risk Reduction" value={`↓ ${riskRed}%`} sub="Systemic Risk" color="text-emerald-400" dropShadow="drop-shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
               </div>
            </div>
          );
        })()}

        {/* MIDDLE SPLIT: ACTIONS & RADAR */}
        <div className="flex gap-3 h-[320px] flex-shrink-0">
           
           {/* PRIORITIZED ACTION PLAN */}
           <div className="w-[62%] bg-[#182227] rounded-md border border-slate-700/50 p-4 shadow-sm flex flex-col">
              <div className="flex justify-between items-end mb-4 gap-4 flex-shrink-0">
                 <h3 className="text-[14px] font-black tracking-widest text-white uppercase whitespace-nowrap">
                    Prioritized Action Plan
                 </h3>
                  <div className="flex items-center gap-3 text-[10px] whitespace-nowrap">
                     <button 
                        onClick={() => setCompareMode(!compareMode)}
                        className={`px-3 py-1 bg-[#0f172a] border border-slate-600 text-white font-black tracking-widest rounded transition-colors ${compareMode ? 'bg-emerald-900 border-emerald-500 text-emerald-100' : 'hover:bg-slate-800'}`}>
                        {compareMode ? 'CLOSE COMPARISON' : 'COMPARE STRATEGIES'}
                     </button>
                  </div>
              </div>
              
              <div className="relative flex-1">
                 <div className="absolute inset-0 overflow-y-auto pr-2 space-y-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-[#0f172a] [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-emerald-500 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-emerald-400">
                    {options.map((opt: any, idx: number) => (
                       <ActionCard 
                          key={idx}
                          num={String(idx + 1).padStart(2, '0')}
                          title={opt.name || opt.title}
                          tag={opt.option_type}
                          desc={opt.description}
                          impact={opt.expected_effect?.impact || "HIGH"}
                          time={opt.expected_effect?.time || "48h"}
                          reduction={opt.expected_effect?.reduction || "12%"}
                          icon={opt.icon || <Ship className="w-4 h-4 text-slate-300" />}
                          alternatives={opt.alternatives}
                          forceExpand={compareMode}
                       />
                    ))}
                 </div>
              </div>
           </div>

           {/* RADAR & ALTERNATIVES */}
           <div className="flex-1 flex flex-col gap-3">
              <div className="flex-1 bg-[#182227] rounded-md border border-slate-700/50 p-4 relative">
                 <h3 className="text-[11px] font-black tracking-wider text-slate-300 uppercase absolute top-4 left-4 z-10">Recommended Strategy Summary</h3>
                 <div className="absolute inset-0 pt-8 pb-4 flex flex-col items-center justify-center text-slate-500">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="60%" data={radarData}>
                        <PolarGrid stroke="#334155" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#cbd5e1', fontSize: 10, fontWeight: 'bold' }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar name="AI Recommended Plan" dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                        <Radar name="No Action (Baseline)" dataKey="B" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0} strokeDasharray="3 3" />
                      </RadarChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center gap-6 mt-2 text-[10px] font-bold text-slate-300">
                       <div className="flex items-center gap-1"><div className="w-3 h-[2px] bg-blue-500"></div> AI Recommended Plan</div>
                       <div className="flex items-center gap-1"><div className="w-3 h-[2px] bg-amber-500 border-dashed"></div> No Action (Baseline)</div>
                    </div>
                 </div>
              </div>
           </div>

        </div>

         {/* BOTTOM ROW: EXPLAINABILITY & TIMELINE */}
         <div className="flex gap-3 flex-1 min-h-[160px]">
            <div className="w-[75%] bg-[#182227] rounded-md border border-slate-700/50 p-4 relative flex flex-col">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[12px] font-bold tracking-wider text-slate-300 uppercase">Explainability & Evidence</h3>
                  <div className="flex text-[9px] bg-[#131d22] border border-slate-700/50 rounded-md overflow-hidden p-0.5 gap-0.5">
                     <button className="px-3 py-1.5 bg-blue-900/40 text-blue-300 rounded shadow-sm">Why this plan?</button>
                     <button className="px-3 py-1.5 text-slate-400 hover:text-slate-300 transition-colors">Key Assumptions</button>
                     <button className="px-3 py-1.5 text-slate-400 hover:text-slate-300 transition-colors">Constraints Considered</button>
                     <button className="px-3 py-1.5 text-slate-400 hover:text-slate-300 transition-colors">Model Details</button>
                  </div>
               </div>
               <div className="flex flex-1 gap-4">
                  {/* Left List */}
                  <div className="w-[35%] flex flex-col gap-4 text-[10px] text-slate-200 font-bold pr-2 mt-[32px]">
                     <div className="flex gap-2 items-start">
                       <Check className="w-3.5 h-3.5 text-emerald-500 font-bold shrink-0 mt-0.5" strokeWidth={3} /> 
                       <span className="leading-relaxed">Supplier diversification reduces concentration risk by 16%.</span>
                     </div>
                     <div className="flex gap-2 items-start">
                       <Check className="w-3.5 h-3.5 text-emerald-500 font-bold shrink-0 mt-0.5" strokeWidth={3} /> 
                       <span className="leading-relaxed">Route C has available capacity and lower geopolitical exposure.</span>
                     </div>
                     <div className="flex gap-2 items-start">
                       <Check className="w-3.5 h-3.5 text-emerald-500 font-bold shrink-0 mt-0.5" strokeWidth={3} /> 
                       <span className="leading-relaxed">Controlled reserve release minimizes price shock and maintains buffer.</span>
                     </div>
                     <div className="flex gap-2 items-start">
                       <Check className="w-3.5 h-3.5 text-emerald-500 font-bold shrink-0 mt-0.5" strokeWidth={3} /> 
                       <span className="leading-relaxed">Refinery optimization maximizes output with available crude slate.</span>
                     </div>
                  </div>
                  
                  {/* Middle: Evidence Sources */}
                  <div className="w-[30%] border border-slate-700/50 rounded-lg p-4 bg-[#11191f] flex flex-col">
                     <h4 className="text-[10px] text-slate-400 uppercase tracking-wider mb-4 font-bold">Evidence Sources</h4>
                     <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1">
                        <div className="flex justify-between text-[10px] items-center">
                          <span className="flex items-center gap-2 text-slate-300">
                            <div className="w-5 h-5 rounded bg-red-500/20 flex items-center justify-center text-red-400"><AlertTriangle className="w-3 h-3" /></div> 
                            Geopolitical Events
                          </span>
                          <span className="text-slate-400">12 sources</span>
                        </div>
                        <div className="flex justify-between text-[10px] items-center">
                          <span className="flex items-center gap-2 text-slate-300">
                            <div className="w-5 h-5 rounded bg-purple-500/20 flex items-center justify-center text-purple-400"><Activity className="w-3 h-3" /></div> 
                            Shipping Intelligence
                          </span>
                          <span className="text-slate-400">25 signals</span>
                        </div>
                        <div className="flex justify-between text-[10px] items-center">
                          <span className="flex items-center gap-2 text-slate-300">
                            <div className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center text-blue-400"><Ship className="w-3 h-3" /></div> 
                            Trade Flow Data
                          </span>
                          <span className="text-slate-400">UN Comtrade</span>
                        </div>
                        <div className="flex justify-between text-[10px] items-center">
                          <span className="flex items-center gap-2 text-slate-300">
                            <div className="w-5 h-5 rounded bg-emerald-500/20 flex items-center justify-center text-emerald-400"><TrendingUp className="w-3 h-3" /></div> 
                            Market & Price Data
                          </span>
                          <span className="text-slate-400">EIA, World Bank</span>
                        </div>
                        <div className="flex justify-between text-[10px] items-center">
                          <span className="flex items-center gap-2 text-slate-300">
                            <div className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center text-blue-400"><Database className="w-3 h-3" /></div> 
                            Historical Patterns
                          </span>
                          <span className="text-slate-400">ML Models</span>
                        </div>
                     </div>
                  </div>

                  {/* Right: Confidence Breakdown */}
                  <div className="w-[35%] border border-slate-700/50 rounded-lg p-4 bg-[#11191f] flex flex-col">
                     <h4 className="text-[10px] text-slate-400 uppercase tracking-wider mb-4 font-bold">Confidence Breakdown</h4>
                     <div className="flex gap-3 flex-1 items-center">
                        {/* Donut Chart */}
                        <div className="w-[85px] h-[85px] relative shrink-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={[{value: 34, fill: '#3b82f6'}, {value: 28, fill: '#22c55e'}, {value: 20, fill: '#eab308'}, {value: 18, fill: '#8b5cf6'}]} dataKey="value" innerRadius="70%" outerRadius="100%" stroke="none">
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-1">
                            <span className="text-[12px] font-bold text-white leading-none mb-0.5">78%</span>
                            <span className="text-[6px] text-slate-400 leading-tight text-center">Overall<br/>Confidence</span>
                          </div>
                        </div>
                        {/* Legend */}
                        <div className="flex flex-col gap-2.5 text-[9px] flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1"><div className="flex items-start gap-1.5 flex-1 min-w-0"><div className="w-2.5 h-2.5 bg-blue-500 rounded-sm shrink-0 mt-0.5"></div><span className="text-slate-300 leading-tight">Data Quality</span></div><span className="text-slate-400 shrink-0">34%</span></div>
                          <div className="flex items-center justify-between gap-1"><div className="flex items-start gap-1.5 flex-1 min-w-0"><div className="w-2.5 h-2.5 bg-green-500 rounded-sm shrink-0 mt-0.5"></div><span className="text-slate-300 leading-tight">Model Confidence</span></div><span className="text-slate-400 shrink-0">28%</span></div>
                          <div className="flex items-center justify-between gap-1"><div className="flex items-start gap-1.5 flex-1 min-w-0"><div className="w-2.5 h-2.5 bg-yellow-500 rounded-sm shrink-0 mt-0.5"></div><span className="text-slate-300 leading-tight">Scenario Certainty</span></div><span className="text-slate-400 shrink-0">20%</span></div>
                          <div className="flex items-center justify-between gap-1"><div className="flex items-start gap-1.5 flex-1 min-w-0"><div className="w-2.5 h-2.5 bg-purple-500 rounded-sm shrink-0 mt-0.5"></div><span className="text-slate-300 leading-tight">Assumptions Validity</span></div><span className="text-slate-400 shrink-0">18%</span></div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="flex-1 bg-[#182227] rounded-md border border-slate-700/50 p-4 relative flex flex-col min-w-0">
               <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-4 shrink-0">Implementation Timeline</h3>
               <div className="flex-1 flex flex-col justify-center relative overflow-x-auto [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-[#0f172a] [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-thumb]:rounded-full">
                  <div className="min-w-[400px] relative h-full flex flex-col justify-center pb-2">
                     {/* Timeline line */}
                     <div className="absolute left-4 right-4 top-1/2 h-1 bg-slate-700 -translate-y-1/2 rounded"></div>
                     {/* Timeline milestones */}
                     <div className="relative z-10 flex justify-between px-2 w-full">
                        <Milestone time="0h" label="Immediate" desc="Reserve Release" desc2="Refinery Adj." active={true} />
                        <Milestone time="24h" label="Day 1" desc="Route C Active" desc2="Supplier Coord." />
                        <Milestone time="72h" label="Day 3" desc="New Proc. Arrives" desc2="Contracts Locked" />
                        <Milestone time="120h" label="Day 5" desc="Supply Normalize" desc2="Monitoring" />
                        <Milestone time="720h+" label="Beyond" desc="Review" desc2="Strategy Adj." />
                     </div>
                  </div>
               </div>
            </div>
         </div>

          </div>

          {/* RIGHT COLUMN: METRICS */}
          <div className="w-[280px] flex flex-col gap-3 flex-shrink-0">
        <div className="bg-[#182227] rounded-md border border-slate-700/50 p-4 shadow-sm flex flex-col gap-4">
          <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-2"><Activity size={12} className="text-blue-400" /> Key Impact Metrics <span className="normal-case text-slate-500">(30 Days)</span></h3>
          <div className="flex flex-col gap-3">
            <RightMetric label="Global Supply Gap" value={`21.3 Mb/d`} trend="↑ 21%" color="text-red-400" icon={<TrendingUp size={12} className="text-red-400" />} />
            <RightMetric label="Price Impact (Oil)" value={`$104 /bbl`} trend="↑ 24%" color="text-red-400" icon={<TrendingUp size={12} className="text-red-400" />} />
            <RightMetric label="LNG Price Impact" value={`$16.8 /MMBtu`} trend="↑ 32%" color="text-red-400" icon={<TrendingUp size={12} className="text-red-400" />} />
            <RightMetric label="Reserve Depletion (India)" value={`3.2 Days`} trend="↑ 32%" color="text-emerald-400" icon={<Database size={12} className="text-emerald-400" />} />
            <RightMetric label="Shipping Cost Index" value={`241 Index`} trend="↑ 41%" color="text-red-400" icon={<Ship size={12} className="text-blue-400" />} />
            <RightMetric label="Refinery Utilization (India)" value={`78%`} trend="↓ 11%" color="text-amber-400" icon={<Factory size={12} className="text-amber-400" />} />
          </div>
        </div>

        <div className="bg-[#182227] rounded-md border border-slate-700/50 p-4 shadow-sm flex flex-col gap-3">
          <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-2"><TrendingDown size={12} className="text-purple-400" /> Economic Impact <span className="normal-case text-slate-500">(India)</span></h3>
          <div className="flex flex-col gap-2">
            <EconMetric label="Fuel Price Pressure" trend="↑ 11.2%" color="text-red-400" />
            <EconMetric label="Inflation Impact" trend="↑ 0.68%" color="text-red-400" />
            <EconMetric label="Current Account Impact" trend="-$9.4B" color="text-amber-400" />
            <EconMetric label="GDP Impact" trend="↓ -0.32%" color="text-emerald-400" />
            <div className="text-[8px] text-slate-500 mt-2">*Compared to baseline (no disruption)</div>
          </div>
        </div>

        <div className="bg-[#182227] rounded-md border border-slate-700/50 p-4 shadow-sm flex-1 flex flex-col">
          <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3 flex items-center gap-2"><ArrowDownToLine size={12} className="text-emerald-400" /> Affected Volumes <span className="normal-case text-slate-500">(30 Days)</span></h3>
          <table className="w-full text-[9px] text-left mt-1">
             <thead>
                <tr className="text-slate-500 border-b border-slate-700/50">
                   <th className="pb-2 font-normal">Commodity</th>
                   <th className="pb-2 font-normal text-right">Baseline<br/>(Mb/d)</th>
                   <th className="pb-2 font-normal text-right">After Scenario</th>
                   <th className="pb-2 font-normal text-right">Change</th>
                </tr>
             </thead>
             <tbody className="text-slate-300">
               {(() => {
                 const simSeverity = responseObj?.problem?.severity || severity;
                 const simDuration = responseObj?.problem?.duration_days || duration;
                 const scale = (simSeverity / 0.7) * (simDuration / 30);
                 
                 const crudeChange = Math.min(100, Math.round(21 * scale));
                 const lngChange = Math.min(100, Math.round(24 * scale));
                 const prodChange = Math.min(100, Math.round(17 * scale));
                 const totalChange = Math.min(100, Math.round(21 * scale));

                 return (
                   <>
                    <tr className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                       <td className="py-2.5">Crude Oil</td>
                       <td className="py-2.5 text-right text-slate-400">5.18</td>
                       <td className="py-2.5 text-right">{(5.18 * (1 - crudeChange/100)).toFixed(2)}</td>
                       <td className="py-2.5 text-right text-red-400">↓ {crudeChange}%</td>
                    </tr>
                    <tr className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                       <td className="py-2.5">LNG</td>
                       <td className="py-2.5 text-right text-slate-400">2.85</td>
                       <td className="py-2.5 text-right">{(2.85 * (1 - lngChange/100)).toFixed(2)}</td>
                       <td className="py-2.5 text-right text-red-400">↓ {lngChange}%</td>
                    </tr>
                    <tr className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                       <td className="py-2.5">Products</td>
                       <td className="py-2.5 text-right text-slate-400">1.32</td>
                       <td className="py-2.5 text-right">{(1.32 * (1 - prodChange/100)).toFixed(2)}</td>
                       <td className="py-2.5 text-right text-red-400">↓ {prodChange}%</td>
                    </tr>
                    <tr className="border-t border-slate-700/50 font-bold bg-slate-800/40">
                       <td className="py-2.5 text-slate-300">Total</td>
                       <td className="py-2.5 text-right text-slate-400">9.35</td>
                       <td className="py-2.5 text-right">{(9.35 * (1 - totalChange/100)).toFixed(2)}</td>
                       <td className="py-2.5 text-right text-red-400">↓ {totalChange}%</td>
                    </tr>
                   </>
                 )
               })()}
             </tbody>
          </table>
        </div>

        <div className="bg-[#182227] rounded-md border border-slate-700/50 flex items-center justify-between shadow-sm overflow-hidden shrink-0">
          <button className="flex-1 py-3 flex items-center justify-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"><Download size={14} /> Export Plan Report</button>
          <button className="px-4 py-3 bg-slate-800 hover:bg-slate-700 border-l border-slate-700 text-slate-400 hover:text-slate-200"><Sliders size={14} /></button>
        </div>
          </div>
        </div>

        {/* BOTTOM APPROVE BAR & EXPECTED OUTCOMES */}
        <div className="h-16 bg-[#182227] rounded-md border border-slate-700/50 px-4 flex items-center justify-between shrink-0 shadow-sm relative overflow-hidden mt-auto">
           {/* Subtle glow effect */}
           <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/10 via-transparent to-transparent pointer-events-none"></div>
           
           <div className="flex items-center gap-8 z-10">
              <div className="text-[11px] font-bold text-slate-500 uppercase flex flex-col leading-tight">
                <span>Expected Outcomes</span>
                <span className="text-[9px] font-normal">(vs. No Action)</span>
              </div>
              <div className="flex gap-6 border-l border-slate-700/50 pl-6">
                {(() => {
                  const simSeverity = responseObj?.problem?.severity || severity;
                  const simDuration = responseObj?.problem?.duration_days || duration;
                  const scale = (simSeverity / 0.7) * (simDuration / 30);
                  
                  return (
                    <>
                      <BottomOutcome value={`↓ ${Math.min(100, Math.round(63 * scale))}%`} label="Supply Gap" color="text-emerald-400" />
                      <BottomOutcome value={`↓ $${(18.7 * scale).toFixed(1)}B`} label="Economic Loss" color="text-emerald-400" />
                      <BottomOutcome value={`↓ ${Math.min(100, Math.round(29 * scale))}%`} label="Risk Index" color="text-emerald-400" />
                      <BottomOutcome value={`↓ ${(4.2 * scale).toFixed(1)} Days`} label="Reserve Depletion" color="text-emerald-400" />
                    </>
                  )
                })()}
              </div>
           </div>
           
           <div className="flex gap-3 z-10">
              <button onClick={approvePlan} disabled={approving} className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-xs font-bold rounded flex items-center gap-2 shadow-lg shadow-emerald-900/20 transition-all active:scale-95">
                 {approving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />} 
                 Approve Recommended Plan
              </button>
           </div>
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
function TopKpi({ label, value, sub, color, dropShadow }: any) {
   return (
      <div className="flex flex-col gap-0.5 items-start">
         <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest whitespace-nowrap">{label}</span>
         <span className={`text-[22px] font-black tracking-tight leading-none py-0.5 ${color} ${dropShadow}`}>{value}</span>
         <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">{sub}</span>
      </div>
   );
}

function ActionCard({ num, title, tag, desc, impact, time, reduction, icon, alternatives, forceExpand }: any) {
   const [expanded, setExpanded] = useState(false);
   let tagColor = "bg-emerald-900/50 text-emerald-400 border-emerald-800";
   if (tag === 'Logistics') tagColor = "bg-orange-900/50 text-orange-400 border-orange-800";
   if (tag === 'Reserves') tagColor = "bg-emerald-900/50 text-emerald-400 border-emerald-800";
   if (tag === 'Contracts') tagColor = "bg-purple-900/50 text-purple-400 border-purple-800";
   if (tag === 'Operations') tagColor = "bg-amber-900/50 text-amber-400 border-amber-800";

   const isExpanded = expanded || forceExpand;

   return (
      <div className="flex flex-col bg-[#0a1014] shadow-[inset_0_2px_15px_rgba(0,0,0,0.4)] border border-slate-700/50 rounded mb-2 hover:border-slate-600 transition-colors relative group overflow-hidden">
         <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-700 group-hover:bg-emerald-500 transition-colors z-10"></div>
         <div 
            className="flex p-3 items-center cursor-pointer relative z-0" 
            onClick={() => setExpanded(!expanded)}
         >
            <div className="w-8 h-8 rounded bg-[#182227] text-emerald-400 font-bold flex items-center justify-center shrink-0 mr-3 shadow-inner border border-slate-700/50">{num}</div>
            <div className="flex-1 min-w-0 pr-3">
               <div className="flex items-center gap-2">
                 <span className="text-[11px] font-bold text-slate-200 whitespace-nowrap group-hover:text-emerald-300 transition-colors">{title}</span>
               </div>
               <div className="text-[9px] text-slate-400 mt-1 whitespace-nowrap">{desc}</div>
               <div className="mt-2"><span className={`text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${tagColor}`}>{tag}</span></div>
            </div>
            <div className="flex gap-4 shrink-0 pr-2 text-[10px] text-slate-400 border-l border-slate-700/50 pl-3">
               <div className="flex flex-col items-center min-w-[40px]"><span className="uppercase text-[8px] text-slate-500 mb-0.5 whitespace-nowrap">Impact</span><span className={impact === 'HIGH' ? 'text-red-400 font-bold' : impact === 'MEDIUM' ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>{impact}</span></div>
               <div className="flex flex-col items-center min-w-[60px]"><span className="uppercase text-[8px] text-slate-500 mb-0.5 whitespace-nowrap">Time to Exec</span><span className="text-slate-200">{time}</span></div>
               <div className="flex flex-col items-center min-w-[70px]"><span className="uppercase text-[8px] text-slate-500 mb-0.5 whitespace-nowrap">Gap Reduction</span><span className="text-emerald-400 font-bold drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">↓ {reduction}</span></div>
            </div>
            <ArrowRight className={`w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-transform ${isExpanded ? 'rotate-90 text-emerald-400' : ''}`} />
         </div>
         
         {isExpanded && alternatives && (
            <div className="bg-[#0f181b] shadow-inner border-t border-slate-700/50 p-3 pl-12 text-[10px]">
               <div className="text-slate-400 font-bold uppercase tracking-wider mb-2 text-[9px]">Alternative Strategies</div>
               <table className="w-full text-left">
                 <thead>
                   <tr className="text-slate-500 border-b border-slate-700/50">
                     <th className="pb-1 font-normal w-1/2">Strategy</th>
                     <th className="pb-1 font-normal text-center">Cost Diff</th>
                     <th className="pb-1 font-normal text-center">Time</th>
                     <th className="pb-1 font-normal text-right">Risk</th>
                   </tr>
                 </thead>
                 <tbody className="text-slate-300">
                   <tr className="border-b border-slate-800/50 bg-emerald-900/10">
                     <td className="py-1.5 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]"></div> AI Recommended: {title}</td>
                     <td className="py-1.5 text-center text-emerald-400">Optimal</td>
                     <td className="py-1.5 text-center">{time}</td>
                     <td className="py-1.5 text-right text-emerald-400">Low</td>
                   </tr>
                   {alternatives.map((alt: any, i: number) => (
                      <tr key={i} className="border-b border-slate-800/50 last:border-0">
                         <td className="py-1.5 flex items-center gap-1 text-slate-400"><div className="w-1.5 h-1.5 rounded-full bg-slate-600"></div> {alt.title}</td>
                         <td className="py-1.5 text-center text-amber-400">{alt.cost}</td>
                         <td className="py-1.5 text-center">{alt.time}</td>
                         <td className="py-1.5 text-right text-red-400">{alt.risk}</td>
                      </tr>
                   ))}
                 </tbody>
               </table>
            </div>
         )}
      </div>
   );
}

function RightMetric({ label, value, trend, color, icon }: any) {
  return (
    <div className="flex justify-between items-center border-b border-slate-800/50 pb-2 last:border-0 last:pb-0">
      <div className="flex items-center gap-2">
         <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700/50">
            {icon}
         </div>
         <span className="text-[10px] text-slate-300">{label}</span>
      </div>
      <div className="flex flex-col items-end">
         <span className={`text-[9px] font-bold ${color}`}>{trend}</span>
         <span className="text-[10px] font-mono text-slate-200 mt-0.5">{value}</span>
      </div>
    </div>
  );
}

function EconMetric({ label, trend, color }: any) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-[10px] text-slate-300">{label}</span>
      <span className={`text-[10px] font-bold ${color}`}>{trend}</span>
    </div>
  );
}

function Milestone({ time, label, desc, desc2, active }: any) {
   return (
      <div className="flex flex-col items-center w-20 group">
         <div className="text-[10px] font-bold text-slate-300 mb-1">{time}</div>
         <div className={`text-[9px] mb-2 ${active ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>{label}</div>
         <div className={`w-3 h-3 rounded-full border-2 ${active ? 'bg-emerald-500 border-emerald-900 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-800 border-slate-600 group-hover:border-blue-500'} z-10 transition-colors`}></div>
         <div className="mt-3 text-[8px] text-slate-400 text-center leading-tight">
            <div>{desc}</div>
            <div className="text-slate-500 mt-1">{desc2}</div>
         </div>
      </div>
   );
}

function BottomOutcome({ value, label, color }: any) {
   return (
      <div className="flex flex-col">
         <span className={`text-lg font-bold ${color} leading-none`}>{value}</span>
         <span className="text-[9px] text-slate-400 mt-1">{label}</span>
      </div>
   );
}

