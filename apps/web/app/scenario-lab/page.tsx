'use client';

import { useState, useEffect, Suspense } from 'react';
import { Activity, Loader2, Download, Share2, Search, SlidersHorizontal, Info, Target, AlertTriangle, TrendingUp, TrendingDown, Anchor, Globe, Clock, Zap, MapPin, BarChart2, Gauge, ArrowDownCircle, DollarSign, Flame, Building, Ship, Factory, Copy } from 'lucide-react';
import { RequiresAPI } from '@/components/ui/requires-api';
import { MapViewer } from '@/components/map-viewer';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ApiClient } from '@/lib/api';
import { useJobPolling } from '@/lib/useJobPolling';
import { useSearchParams, useRouter } from 'next/navigation';

function ScenarioLabContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const initialTarget = searchParams.get('target_id') || 'CHK_HORMUZ';
  
  const [running, setRunning] = useState(false);
  const [scenarioName, setScenarioName] = useState(`Disruption: ${initialTarget}`);
  const [targetId, setTargetId] = useState(initialTarget);
  const [severity, setSeverity] = useState(0.7);
  const [duration, setDuration] = useState(30);
  const [assets, setAssets] = useState<any[]>([]);
  const [eventType, setEventType] = useState('Strait of Hormuz');
  
  const [commodities, setCommodities] = useState<string[]>(['Crude Oil', 'LNG']);
  const [regions, setRegions] = useState<string[]>(['India', 'Global', 'Strait of Hormuz']);
  const [regionSearch, setRegionSearch] = useState('');
  
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
  
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  
  const { status, results, error } = useJobPolling(jobId, scenarioId);

  useEffect(() => {
    // If polling hook says it's done or failed, stop local spinning state
    if (status === 'COMPLETED' || status === 'FAILED' || error) {
      setRunning(false);
    }
  }, [status, error]);

  useEffect(() => {
    fetch('http://localhost:8000/api/v1/world/assets')
      .then(r => r.json())
      .then(data => setAssets(data))
      .catch(e => console.error(e));
  }, []);

  const runSimulation = async () => {
    setRunning(true);
    setJobId(null);
    setScenarioId(null);
    try {
      const scenario = await ApiClient.createScenario({
        name: scenarioName,
        target_id: targetId,
        severity: severity,
        duration_days: duration
      });

      const job = await ApiClient.runScenario(scenario.id);
      
      setScenarioId(scenario.id);
      setJobId(job.job_id);
    } catch (e) {
      console.error(e);
      setRunning(false);
    }
  };

  // Generate bell curve data based on backend P10, P50, P90
  const mcData = results?.monte_carlo ? generateBellCurve(results.monte_carlo.p10_gap, results.monte_carlo.p50_gap, results.monte_carlo.p90_gap) : [];

  return (
    <div className="h-full min-h-[850px] min-w-[1280px] w-full bg-[#0f181b] p-3 flex flex-col gap-3 text-slate-300 font-sans">
      
      {/* HEADER SECTION (Inside the page since topnav is global, but the reference has a specific title bar here) */}
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
          <button className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-[#0f181b] hover:bg-slate-800 border border-slate-700 rounded transition-colors">
            Compare Strategies
          </button>
          <button className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-600 border border-emerald-800 rounded transition-colors">
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
                onChange={(e) => setEventType(e.target.value)}
                className="w-full bg-[#11181c] border border-slate-700/80 rounded p-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500 appearance-none"
              >
                <option>Strait of Hormuz</option>
                <option>China export controls</option>
                <option>Red Sea shipping disruption</option>
                <option>Taiwan Strait escalation</option>
                <option>Russia sanctions</option>
              </select>
            </div>
            
            <div>
              <label className="block text-[13px] font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] uppercase tracking-wider mb-2">Target</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input type="text" placeholder="Search chokepoint or region..." className="w-full bg-[#11181c] border border-slate-700/80 rounded py-2 pr-2 pl-8 text-[11px] font-bold text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-500" />
              </div>
              <div className="mt-2 h-24 bg-[#0a1014] rounded-md border border-slate-700/80 flex items-center justify-center relative overflow-hidden">
                 <img src="/target-map.png" alt="Target Map" className="w-full h-full object-cover" />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] uppercase tracking-wider mb-2">Target ID</label>
              <input type="text" value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-full bg-[#11181c] border border-slate-700/80 rounded p-2 text-xs font-bold text-red-400 focus:outline-none focus:border-red-500" />
            </div>

            <div className="space-y-4">
              <label className="block text-[13px] font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] uppercase tracking-wider">Parameters</label>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[12px] font-black text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">Severity: <span className="font-bold text-slate-200 drop-shadow-none">{(severity * 100).toFixed(0)}%</span> <span className="text-amber-500 font-bold ml-1 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]">(MODERATE)</span></span>
                  <input type="number" value={(severity * 100).toFixed(0)} readOnly className="w-14 bg-[#11181c] border border-slate-700/80 rounded py-1 px-2 text-xs font-bold text-center text-white outline-none" />
                </div>
                <input type="range" min="0" max="1" step="0.05" value={severity} onChange={(e) => setSeverity(parseFloat(e.target.value))} className="w-full accent-emerald-500 h-1 bg-slate-400 rounded-lg appearance-none cursor-pointer drop-shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                <div className="flex justify-between mt-1.5 text-[10px] text-slate-400 font-bold"><span>30%</span><span className="text-center">Field</span><span>High</span></div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[12px] font-black text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">Duration: <span className="font-bold text-slate-200 drop-shadow-none">{duration} Days</span></span>
                  <input type="number" value={duration} readOnly className="w-14 bg-[#11181c] border border-slate-700/80 rounded py-1 px-2 text-xs font-bold text-center text-white outline-none" />
                </div>
                <input type="range" min="1" max="120" step="1" value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} className="w-full accent-emerald-500 h-1 bg-slate-400 rounded-lg appearance-none cursor-pointer drop-shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                <div className="flex justify-between mt-1.5 text-[10px] text-slate-400 font-bold"><span>0 Days</span><span className="text-center">Field</span><span>120 Days</span></div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="block text-[13px] font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] uppercase tracking-wider">Commodity</label>
              <div className="flex items-center gap-4 text-[11px] font-bold text-slate-200">
                 <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
                   <div className={`w-4 h-4 rounded-sm flex items-center justify-center border ${commodities.includes('Crude Oil') ? 'bg-[#3e6853] border-[#3e6853] drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-transparent border-slate-500'}`}>
                     {commodities.includes('Crude Oil') && <svg viewBox="0 0 24 24" width="12" height="12" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                   </div>
                   <input type="checkbox" className="hidden" checked={commodities.includes('Crude Oil')} onChange={() => toggleCommodity('Crude Oil')} />
                   Crude Oil
                 </label>
                 <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
                   <div className={`w-4 h-4 rounded-sm flex items-center justify-center border ${commodities.includes('LNG') ? 'bg-[#3e6853] border-[#3e6853] drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-transparent border-slate-500'}`}>
                     {commodities.includes('LNG') && <svg viewBox="0 0 24 24" width="12" height="12" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                   </div>
                   <input type="checkbox" className="hidden" checked={commodities.includes('LNG')} onChange={() => toggleCommodity('LNG')} />
                   LNG
                 </label>
                 <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
                   <div className={`w-4 h-4 rounded-sm flex items-center justify-center border ${commodities.includes('Coal') ? 'bg-[#3e6853] border-[#3e6853] drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-transparent border-slate-500'}`}>
                     {commodities.includes('Coal') && <svg viewBox="0 0 24 24" width="12" height="12" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                   </div>
                   <input type="checkbox" className="hidden" checked={commodities.includes('Coal')} onChange={() => toggleCommodity('Coal')} />
                   Coal
                 </label>
                 <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
                   <div className={`w-4 h-4 rounded-sm flex items-center justify-center border ${commodities.includes('Electricity') ? 'bg-[#3e6853] border-[#3e6853] drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-transparent border-slate-500'}`}>
                     {commodities.includes('Electricity') && <svg viewBox="0 0 24 24" width="12" height="12" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                   </div>
                   <input type="checkbox" className="hidden" checked={commodities.includes('Electricity')} onChange={() => toggleCommodity('Electricity')} />
                   Electricity
                 </label>
              </div>
            </div>

            <div className="space-y-3 pt-2 pb-2">
              <label className="block text-[13px] font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] uppercase tracking-wider">Regions/Assets Affected</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Search region or asset..." 
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
                <div className="ml-auto text-slate-500 hover:text-slate-300 cursor-pointer">
                   <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                </div>
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
               <button className="px-3 py-1 text-[10px] border border-slate-600 rounded text-slate-400 hover:bg-slate-700 bg-[#182227]">View as Timeline</button>
             </div>
             
             <div className="flex-1 bg-[#151a1e] border border-slate-800/80 rounded-md overflow-hidden mt-1 px-3 py-1">
                <CascadeFlow eventType={eventType} severity={severity} />
             </div>
          </div>

          {/* MAIN MAP */}
          <div className="flex-1 bg-[#182227] rounded-md border border-slate-700/50 relative overflow-hidden shadow-sm">
             <div className="absolute inset-0 bg-slate-950 flex items-center justify-center">
                 {assets.length > 0 ? <MapViewer assets={assets} /> : <div className="animate-pulse text-sm">Loading Graph...</div>}
             </div>
             
             {/* Map Legend mimicking reference */}
             <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-slate-700 rounded p-3 text-[10px] text-slate-300 flex flex-col gap-2 z-10 backdrop-blur">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Production</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-500"></div> Refinery</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div> Port / Terminal</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500"></div> Storage Facility</div>
                <div className="flex items-center gap-2 mt-1 border-t border-slate-700 pt-1 text-red-400"><AlertTriangle className="w-3 h-3" /> Checkpoint</div>
             </div>

             {/* Blast Radius Visual (CSS overlay on center map) */}
             {results && (
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-red-500/20 rounded-full animate-ping z-0 pointer-events-none" style={{ left: '55%', top: '45%' }}></div>
             )}
          </div>

          {/* SPLIT SUMMARY & CHART */}
          <div className="flex gap-3 h-48 flex-shrink-0">
             <div className="w-1/3 bg-[#182227] rounded-md border border-slate-700/50 p-3 shadow-sm flex flex-col">
                <h3 className="text-[11px] font-black tracking-wider text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] uppercase mb-3">Scenario Summary</h3>
                <div className="flex flex-col gap-2 text-xs flex-1 font-bold">
                   <div className="flex"><span className="w-24 text-slate-400">Name</span><span className="text-slate-200 truncate">{scenarioName}</span></div>
                   <div className="flex"><span className="w-24 text-slate-400">Type</span><span className="text-slate-200">Checkpoint Disruption</span></div>
                   <div className="flex"><span className="w-24 text-slate-400">Severity</span><span className="text-slate-200">{(severity*100).toFixed(0)}% Capacity Reduction</span></div>
                   <div className="flex"><span className="w-24 text-slate-400">Duration</span><span className="text-slate-200">{duration} Days</span></div>
                   <div className="flex"><span className="w-24 text-slate-400">Start Date</span><span className="text-slate-200">26 May 2025</span></div>
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
                    <button className="px-3 py-1 bg-[#1d4ed8]/20 text-blue-400 border-r border-slate-700/50">Physical Impact</button>
                    <button className="px-3 py-1 text-slate-400 hover:bg-slate-800 border-r border-slate-700/50">Logistics Impact</button>
                    <button className="px-3 py-1 text-slate-400 hover:bg-slate-800 border-r border-slate-700/50">Market Impact</button>
                    <button className="px-3 py-1 text-slate-400 hover:bg-slate-800">Economic Impact</button>
                 </div>
             </div>
             
             <div className="flex gap-2 h-[85px] w-full">
               <ImpactCard title="Supply Gap" value="21%" sub="↓ vs Baseline" icon={<Building className="w-3.5 h-3.5" />} color="blue" graphPath="M0,25 L10,23 L20,25 L30,20 L40,22 L50,18 L60,20 L70,12 L80,15 L90,8 L100,10" />
               <ImpactCard title="Storage Depletion" value="3.2 Days" sub="↓ vs Baseline" icon={<DatabaseIcon />} color="emerald" graphPath="M0,26 L15,24 L30,25 L45,20 L60,22 L75,17 L90,19 L100,15" />
               <ImpactCard title="Route Disruption" value="68 %" sub="of Traffic Affected" icon={<RouteIcon />} color="amber" graphPath="M0,24 L10,23 L20,25 L30,22 L40,24 L50,18 L60,14 L70,11 L80,16 L90,18 L100,20" />
               <ImpactCard title="Port Congestion" value="41%" sub="↑ vs Baseline" icon={<Anchor className="w-3.5 h-3.5" />} color="red" graphPath="M0,25 L10,22 L20,24 L30,19 L40,21 L50,16 L60,18 L70,14 L80,17 L90,12 L100,15" />
               <ImpactCard title="Refinery Utilization" value="↓ 11%" sub="vs Baseline" icon={<FactoryIcon />} color="emerald" graphPath="M0,15 L15,14 L30,17 L45,15 L60,21 L75,19 L90,25 L100,24" />
               <ImpactCard title="Delivery Delay" value="6.8 Days" sub="Average Increase" icon={<Clock className="w-3.5 h-3.5" />} color="purple" graphPath="M0,26 L15,25 L30,27 L45,21 L60,23 L75,17 L90,19 L100,15" />
             </div>
          </div>

        </div>

        {/* RIGHT COLUMN: METRICS */}
        <div className="w-[310px] flex flex-col gap-3 flex-shrink-0 overflow-y-auto no-scrollbar pb-6 text-slate-300">
          
          {/* KEY IMPACT METRICS */}
          <div className="bg-[#0f171b] rounded-md border border-slate-700/50 p-4 flex flex-col gap-3">
             <h3 className="text-[11px] font-black tracking-wider text-slate-300 uppercase mb-1">Key Impact Metrics <span className="normal-case text-slate-500 font-bold">(30 Days)</span></h3>
             
             {/* Item 1 */}
             <div className="flex justify-between items-center border-b border-slate-700/50 pb-3">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full border border-red-500/50 flex items-center justify-center text-red-500 bg-red-950/30 shrink-0">
                     <ArrowDownCircle size={16} />
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[11px] font-bold text-slate-200">Global Supply Gap</span>
                     <SparklineRed />
                  </div>
               </div>
               <div className="flex flex-col items-end">
                  <span className="text-[11px] font-black text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">↑ 21%</span>
                  <span className="text-[11px] font-bold text-slate-200">21.3 <span className="text-[10px] text-slate-400 font-normal">Mb/d</span></span>
               </div>
             </div>

             {/* Item 2 */}
             <div className="flex justify-between items-center border-b border-slate-700/50 pb-3">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full border border-amber-500/50 flex items-center justify-center text-amber-500 bg-amber-950/30 shrink-0">
                     <DollarSign size={16} />
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[11px] font-bold text-slate-200">Price Impact (Oil)</span>
                     <SparklineRed />
                  </div>
               </div>
               <div className="flex flex-col items-end">
                  <span className="text-[11px] font-black text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">↑ 24%</span>
                  <span className="text-[11px] font-bold text-slate-200">$104 <span className="text-[10px] text-slate-400 font-normal">/bbl</span></span>
               </div>
             </div>

             {/* Item 3 */}
             <div className="flex justify-between items-center border-b border-slate-700/50 pb-3">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full border border-orange-500/50 flex items-center justify-center text-orange-500 bg-orange-950/30 shrink-0">
                     <Flame size={16} />
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[11px] font-bold text-slate-200">LNG Price Impact</span>
                     <SparklineRed />
                  </div>
               </div>
               <div className="flex flex-col items-end">
                  <span className="text-[11px] font-black text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">↑ 32%</span>
                  <span className="text-[11px] font-bold text-slate-200">$16.8 <span className="text-[10px] text-slate-400 font-normal">/MMBtu</span></span>
               </div>
             </div>

             {/* Item 4 */}
             <div className="flex justify-between items-center border-b border-slate-700/50 pb-3">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full border border-emerald-500/50 flex items-center justify-center text-emerald-500 bg-emerald-950/30 shrink-0">
                     <Building size={16} />
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[11px] font-bold text-slate-200">Reserve Depletion (India)</span>
                     <SparklineGreen />
                  </div>
               </div>
               <div className="flex flex-col items-end">
                  <span className="text-[11px] font-black text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">↑ 32%</span>
                  <span className="text-[11px] font-bold text-slate-200">3.2 <span className="text-[10px] text-slate-400 font-normal">Days</span></span>
               </div>
             </div>

             {/* Item 5 */}
             <div className="flex justify-between items-center border-b border-slate-700/50 pb-3">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full border border-blue-500/50 flex items-center justify-center text-blue-500 bg-blue-950/30 shrink-0">
                     <Ship size={16} />
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[11px] font-bold text-slate-200">Shipping Cost Index</span>
                     <SparklineRed />
                  </div>
               </div>
               <div className="flex flex-col items-end">
                  <span className="text-[11px] font-black text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">↑ 41%</span>
                  <span className="text-[11px] font-bold text-slate-200">241 <span className="text-[10px] text-slate-400 font-normal">Index</span></span>
               </div>
             </div>

             {/* Item 6 */}
             <div className="flex justify-between items-center pt-1">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full border border-slate-500/50 flex items-center justify-center text-slate-400 bg-slate-800/30 shrink-0">
                     <Factory size={16} />
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[11px] font-bold text-slate-200">Refinery Utilization (India)</span>
                     <SparklineGreen />
                  </div>
               </div>
               <div className="flex flex-col items-end">
                  <span className="text-[11px] font-black text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">↓ 11%</span>
                  <span className="text-[11px] font-bold text-slate-200">78 <span className="text-[10px] text-slate-400 font-normal">%</span></span>
               </div>
             </div>

          </div>

          {/* ECONOMIC IMPACT */}
          <div className="bg-[#0f171b] rounded-md border border-slate-700/50 p-4 flex flex-col gap-3">
             <h3 className="text-[11px] font-black tracking-wider text-slate-300 uppercase mb-1">Economic Impact <span className="normal-case text-slate-500 font-bold">(INDIA)</span></h3>
             
             <div className="flex justify-between items-center">
                <span className="text-[11px] font-medium text-slate-400">Fuel Price Pressure</span>
                <span className="text-[11px] font-black text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">↑ 11.2%</span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-[11px] font-medium text-slate-400">Inflation Impact</span>
                <span className="text-[11px] font-black text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">↑ 0.68%</span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-[11px] font-medium text-slate-400">Current Account Impact</span>
                <span className="text-[11px] font-black text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]">-$9.4B</span>
             </div>
             <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] font-medium text-slate-400">GDP Impact</span>
                <span className="text-[11px] font-black text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">↓ -0.32%</span>
             </div>
             <div className="text-[9px] text-slate-500 mt-1">
                *Compared to baseline (no disruption)
             </div>
          </div>

          {/* AFFECTED VOLUMES */}
          <div className="bg-[#0f171b] rounded-md border border-slate-700/50 p-4 flex flex-col gap-3">
             <h3 className="text-[11px] font-black tracking-wider text-slate-300 uppercase mb-1">Affected Volumes <span className="normal-case text-slate-500 font-bold">(30 Days)</span></h3>
             
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
                 <tr>
                   <td className="py-2">Crude Oil</td>
                   <td className="py-2 text-right">5.18</td>
                   <td className="py-2 text-right">4.07</td>
                   <td className="py-2 text-right text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)] font-black">↓ 21%</td>
                 </tr>
                 <tr>
                   <td className="py-2">LNG</td>
                   <td className="py-2 text-right">2.85</td>
                   <td className="py-2 text-right">2.18</td>
                   <td className="py-2 text-right text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)] font-black">↓ 24%</td>
                 </tr>
                 <tr>
                   <td className="py-2 border-b border-slate-700/50">Products</td>
                   <td className="py-2 text-right border-b border-slate-700/50">1.32</td>
                   <td className="py-2 text-right border-b border-slate-700/50">1.10</td>
                   <td className="py-2 text-right text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)] font-black border-b border-slate-700/50">↓ 17%</td>
                 </tr>
                 <tr>
                   <td className="py-2 pt-3">Total</td>
                   <td className="py-2 pt-3 text-right">9.35</td>
                   <td className="py-2 pt-3 text-right">7.35</td>
                   <td className="py-2 pt-3 text-right text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)] font-black">↓ 21%</td>
                 </tr>
               </tbody>
             </table>
          </div>

          {/* EXPORT & SHARE */}
          <div className="bg-[#0f171b] rounded-md border border-slate-700/50 p-4 flex flex-col gap-3">
             <h3 className="text-[11px] font-black tracking-wider text-slate-300 uppercase mb-2">Export & Share</h3>
             <button className="w-full py-2 flex items-center justify-center gap-2 text-[11px] font-bold bg-[#1d4ed8]/30 hover:bg-[#1d4ed8]/50 text-blue-400 border border-blue-600/50 rounded-md transition-colors shadow-sm"><Download size={14} /> Download Report (PDF)</button>
             <button className="w-full py-2 flex items-center justify-center gap-2 text-[11px] font-bold bg-[#1e293b]/50 hover:bg-[#1e293b] text-slate-300 border border-slate-700/80 rounded-md transition-colors"><Download size={14} /> Download Data (CSV)</button>
             <button className="w-full py-2 flex items-center justify-center gap-2 text-[11px] font-bold bg-[#1e293b]/50 hover:bg-[#1e293b] text-slate-300 border border-slate-700/80 rounded-md transition-colors"><Share2 size={14} /> Share Scenario Link</button>
             <div className="flex justify-between items-center mt-2 text-[10px] text-slate-500">
               <span>Scenario ID: SCN-2025-05-26-1423</span>
               <Copy size={12} className="cursor-pointer hover:text-slate-300" />
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

function ImpactCard({ title, value, sub, icon, color = "slate", graphPath }: any) {
  const colorMap: any = {
    'blue': { text: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-950/30', stroke: '#3b82f6', fill: 'url(#gradBlue)' },
    'emerald': { text: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-950/30', stroke: '#10b981', fill: 'url(#gradEmerald)' },
    'amber': { text: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-950/30', stroke: '#f59e0b', fill: 'url(#gradAmber)' },
    'red': { text: 'text-red-400', border: 'border-red-500/30', bg: 'bg-red-950/30', stroke: '#ef4444', fill: 'url(#gradRed)' },
    'purple': { text: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-950/30', stroke: '#a855f7', fill: 'url(#gradPurple)' },
    'slate': { text: 'text-slate-400', border: 'border-slate-500/30', bg: 'bg-slate-800/30', stroke: '#64748b', fill: 'url(#gradSlate)' },
  };

  const c = colorMap[color];
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
const ShipIcon = () => <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-red-400"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"></path><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"></path><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"></path><path d="M12 10v4"></path><path d="M12 2v3"></path></svg>;
const FactoryIcon = () => <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path><path d="M17 18h1"></path><path d="M12 18h1"></path><path d="M7 18h1"></path></svg>;

const CascadeFlow = ({ eventType = "Strait of Hormuz", severity = 0.7 }: any) => (
  <div className="flex items-center justify-between w-full h-full overflow-x-auto no-scrollbar">
    
    <div className="flex items-center gap-2 flex-shrink-0">
      <div className="w-8 h-8 rounded-full border border-red-500/50 bg-red-950/20 flex items-center justify-center text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">
        <Activity size={14} />
      </div>
      <div className="flex flex-col">
        <span className="text-[11px] font-extrabold text-white leading-tight drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">Event Trigger</span>
        <span className="text-[10px] text-slate-400 font-bold leading-tight">{eventType}</span>
      </div>
    </div>
    <span className="text-slate-600 text-sm font-bold drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">→</span>

    <div className="flex items-center gap-2 flex-shrink-0">
      <div className="w-8 h-8 rounded-full border border-amber-500/50 bg-amber-950/20 flex items-center justify-center text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]">
        <Zap size={14} />
      </div>
      <div className="flex flex-col">
        <span className="text-[11px] font-extrabold text-white leading-tight drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">Supply Shock</span>
        <span className="text-[10px] text-slate-400 font-bold leading-tight">-{Math.round(severity * 100)}% Capacity</span>
      </div>
    </div>
    <span className="text-slate-600 text-sm font-bold drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">→</span>

    <div className="flex items-center gap-2 flex-shrink-0">
      <div className="w-8 h-8 rounded-full border border-amber-500/50 bg-amber-950/20 flex items-center justify-center text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]">
        <Anchor size={14} />
      </div>
      <div className="flex flex-col">
        <span className="text-[11px] font-extrabold text-white leading-tight drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">Shipping Impact</span>
        <span className="text-[10px] text-slate-400 font-bold leading-tight">Delays & Rerouting</span>
      </div>
    </div>
    <span className="text-slate-600 text-sm font-bold drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">→</span>

    <div className="flex items-center gap-2 flex-shrink-0">
      <div className="w-8 h-8 rounded-full border border-emerald-500/50 bg-emerald-950/20 flex items-center justify-center text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">
        <MapPin size={14} />
      </div>
      <div className="flex flex-col">
        <span className="text-[11px] font-extrabold text-white leading-tight drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">Port & Refinery</span>
        <span className="text-[10px] text-slate-400 font-bold leading-tight">Utilization Drop</span>
      </div>
    </div>
    <span className="text-slate-600 text-sm font-bold drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">→</span>

    <div className="flex items-center gap-2 flex-shrink-0">
      <div className="w-8 h-8 rounded-full border border-purple-500/50 bg-purple-950/20 flex items-center justify-center text-purple-500 drop-shadow-[0_0_5px_rgba(168,85,247,0.5)]">
        <BarChart2 size={14} />
      </div>
      <div className="flex flex-col">
        <span className="text-[11px] font-extrabold text-white leading-tight drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">Market Impact</span>
        <span className="text-[10px] text-slate-400 font-bold leading-tight">Price Increase</span>
      </div>
    </div>
    <span className="text-slate-600 text-sm font-bold drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">→</span>

    <div className="flex items-center gap-2 flex-shrink-0">
      <div className="w-8 h-8 rounded-full border border-red-500/50 bg-red-950/20 flex items-center justify-center text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">
        <Gauge size={14} />
      </div>
      <div className="flex flex-col">
        <span className="text-[11px] font-extrabold text-white leading-tight drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">Economic Impact</span>
        <span className="text-[10px] text-slate-400 font-bold leading-tight">Inflation & GDP</span>
      </div>
    </div>
    
  </div>
);
