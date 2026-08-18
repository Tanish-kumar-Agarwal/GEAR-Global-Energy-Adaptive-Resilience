'use client';

import { useState, useEffect } from 'react';
import { Activity, Loader2, Download, Share2, Search, SlidersHorizontal, Info, Target, AlertTriangle, TrendingUp, TrendingDown, Anchor, Globe, Clock } from 'lucide-react';
import { RequiresAPI } from '@/components/ui/requires-api';
import { MapViewer } from '@/components/map-viewer';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function ScenarioLab() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [scenarioName, setScenarioName] = useState('Hormuz Disruption');
  const [severity, setSeverity] = useState(0.7);
  const [duration, setDuration] = useState(30);
  const [assets, setAssets] = useState<any[]>([]);

  useEffect(() => {
    fetch('http://localhost:8000/api/v1/world/assets')
      .then(r => r.json())
      .then(data => setAssets(data))
      .catch(e => console.error(e));
  }, []);

  const runSimulation = async () => {
    setRunning(true);
    setResults(null);
    try {
      // 1. Create scenario
      const createRes = await fetch('http://localhost:8000/api/v1/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: scenarioName,
          chokepoint_id: 'CHK_HORMUZ',
          severity: severity,
          duration_days: duration
        })
      });
      const scenario = await createRes.json();

      // 2. Trigger run
      await fetch(`http://localhost:8000/api/v1/scenarios/${scenario.id}/run`, { method: 'POST' });

      // 3. Poll (hackathon wait)
      setTimeout(async () => {
        const res = await fetch(`http://localhost:8000/api/v1/scenarios/${scenario.id}/results`);
        const data = await res.json();
        setResults(data.results);
        setRunning(false);
      }, 2500);

    } catch (e) {
      console.error(e);
      setRunning(false);
    }
  };

  // Generate bell curve data based on backend P10, P50, P90
  const mcData = results?.monte_carlo ? generateBellCurve(results.monte_carlo.p10_gap, results.monte_carlo.p50_gap, results.monte_carlo.p90_gap) : [];

  return (
    <div className="h-full w-full bg-[#0f172a] p-3 flex flex-col gap-3 text-slate-300 font-sans overflow-hidden">
      
      {/* HEADER SECTION (Inside the page since topnav is global, but the reference has a specific title bar here) */}
      <div className="flex justify-between items-center bg-[#1e293b] rounded-md border border-slate-700/50 p-2 px-4 shadow-sm shrink-0">
        <h1 className="text-sm font-bold tracking-widest text-slate-200 flex items-center gap-2 uppercase">
           <Activity className="h-4 w-4 text-emerald-400" />
           IMAGE 13: THE CORRECT STRATEGIC SCENARIO SIMULATION LAB
        </h1>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-[#0f172a] hover:bg-slate-800 border border-slate-700 rounded transition-colors">
            Compare Strategies
          </button>
          <button className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-600 border border-emerald-800 rounded transition-colors">
            Save Scenario
          </button>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="flex-1 flex gap-3 min-h-0">
        
        {/* LEFT COLUMN: CONFIGURATION PANEL */}
        <div className="w-[300px] flex flex-col gap-3 flex-shrink-0 bg-[#1e293b] rounded-md border border-slate-700/50 overflow-y-auto no-scrollbar shadow-sm">
          <div className="p-3 border-b border-slate-700/50 font-medium text-[11px] uppercase tracking-wider text-slate-400 bg-slate-800/50">
            Configuration Panel
          </div>
          <div className="p-4 flex flex-col gap-5">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1.5">Event Type</label>
              <select className="w-full bg-[#0f172a] border border-slate-700 rounded p-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 appearance-none">
                <option>Chokepoint Disruption</option>
                <option>Production Shock</option>
              </select>
            </div>
            
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1.5">Target</label>
              <div className="relative">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-500" />
                <input type="text" placeholder="Search chokepoint or region..." className="w-full bg-[#0f172a] border border-slate-700 rounded p-2 pl-7 text-xs text-slate-300 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="mt-2 h-24 bg-slate-900 rounded border border-slate-700/50 flex items-center justify-center relative overflow-hidden">
                 <Globe className="h-24 w-24 text-slate-800 absolute opacity-30" />
                 <div className="z-10 flex items-center gap-1 text-[10px] text-red-400 bg-red-950/80 border border-red-900 px-2 py-0.5 rounded">
                   <Target className="h-3 w-3" /> Strait of Hormuz
                 </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1.5">Chokepoint</label>
              <select className="w-full bg-[#0f172a] border border-slate-700 rounded p-2 text-xs text-red-400 font-medium focus:outline-none focus:border-red-500 appearance-none">
                <option>Strait of Hormuz</option>
              </select>
            </div>

            <div className="space-y-4">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700/50 pb-1">Parameters</label>
              
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-[11px] text-slate-300">Severity: {(severity * 100).toFixed(0)}% <span className="text-amber-400 ml-1">(MODERATE)</span></span>
                  <input type="number" value={(severity * 100).toFixed(0)} readOnly className="w-12 bg-[#0f172a] border border-slate-700 rounded p-1 text-xs text-center text-slate-300" />
                </div>
                <input type="range" min="0" max="1" step="0.05" value={severity} onChange={(e) => setSeverity(parseFloat(e.target.value))} className="w-full accent-blue-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                <div className="flex justify-between mt-1 text-[9px] text-slate-500"><span className="w-8">30%</span><span className="w-8 text-center">Yield</span><span className="w-8 text-right">High</span></div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-[11px] text-slate-300">Duration: {duration} Days</span>
                  <input type="number" value={duration} readOnly className="w-12 bg-[#0f172a] border border-slate-700 rounded p-1 text-xs text-center text-slate-300" />
                </div>
                <input type="range" min="1" max="120" step="1" value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} className="w-full accent-blue-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                <div className="flex justify-between mt-1 text-[9px] text-slate-500"><span className="w-8">0 Days</span><span className="w-8 text-center">Yield</span><span className="w-8 text-right">120 Days</span></div>
              </div>
            </div>

            <button 
              onClick={runSimulation}
              disabled={running}
              className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 text-white text-xs font-bold rounded transition-colors shadow-lg shadow-emerald-900/20"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {running ? 'Running...' : 'Run Simulation'}
            </button>
          </div>
        </div>

        {/* CENTER COLUMN: RESULTS */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          
          {/* IMPACT CASCADE VIEW */}
          <div className="bg-[#1e293b] rounded-md border border-slate-700/50 p-3 h-24 flex-shrink-0 shadow-sm relative">
             <div className="absolute top-2 left-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">Impact Cascade View</div>
             <div className="absolute top-2 right-3"><button className="px-2 py-0.5 text-[9px] border border-slate-600 rounded text-slate-400 hover:bg-slate-700">View as Timeline</button></div>
             <div className="mt-4 h-full">
                <RequiresAPI endpoint="GET /api/v1/world/supply-chain-status" />
             </div>
          </div>

          {/* MAIN MAP */}
          <div className="flex-1 bg-[#1e293b] rounded-md border border-slate-700/50 relative overflow-hidden shadow-sm">
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
             <div className="w-1/3 bg-[#1e293b] rounded-md border border-slate-700/50 p-3 shadow-sm flex flex-col">
                <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3">Scenario Summary</h3>
                <div className="flex flex-col gap-2 text-xs flex-1">
                   <div className="flex"><span className="w-24 text-slate-500">Name</span><span className="text-slate-200 truncate">{scenarioName}</span></div>
                   <div className="flex"><span className="w-24 text-slate-500">Type</span><span className="text-slate-200">Checkpoint Disruption</span></div>
                   <div className="flex"><span className="w-24 text-slate-500">Severity</span><span className="text-slate-200">{(severity*100).toFixed(0)}% Capacity Reduction</span></div>
                   <div className="flex"><span className="w-24 text-slate-500">Duration</span><span className="text-slate-200">{duration} Days</span></div>
                   <div className="flex"><span className="w-24 text-slate-500">Start Date</span><span className="text-slate-200">26 May 2025</span></div>
                </div>
             </div>

             <div className="flex-1 bg-[#1e293b] rounded-md border border-slate-700/50 p-3 shadow-sm flex flex-col relative">
                <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-2">Monte Carlo Outlook <span className="text-slate-500 normal-case">(Supply Gap)</span></h3>
                
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
                    <div className="w-32 flex flex-col justify-center gap-3 pl-2 text-xs">
                       <div className="flex justify-between"><span className="text-slate-400">Expected (P50)</span><span className="text-slate-200">{results.monte_carlo.p50_gap}M</span></div>
                       <div className="flex justify-between"><span className="text-emerald-400">P10 (Optimistic)</span><span className="text-emerald-400">{results.monte_carlo.p10_gap}M</span></div>
                       <div className="flex justify-between"><span className="text-red-400">P90 (Pessimistic)</span><span className="text-red-400">{results.monte_carlo.p90_gap}M</span></div>
                       <div className="border-t border-slate-700 mt-2 pt-2 flex justify-between"><span className="text-slate-500 text-[10px]">Simulations Run</span><span className="text-slate-300 text-[10px]">10,000</span></div>
                       <div>
                         <div className="flex justify-between text-[10px] mb-1"><span className="text-slate-500">Confidence</span><span className="text-blue-400">78%</span></div>
                         <div className="w-full bg-slate-800 h-1 rounded"><div className="bg-blue-500 h-1 rounded" style={{width: '78%'}}></div></div>
                       </div>
                    </div>
                  </div>
                ) : (
                   <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 mt-6">Run simulation to generate probability distribution</div>
                )}
             </div>
          </div>

          {/* IMPACT BREAKDOWN ROW */}
          <div className="flex gap-2 h-[72px] flex-shrink-0">
             <div className="bg-slate-800 rounded flex items-center px-2 py-1 text-[9px] text-slate-400 h-6 shrink-0 absolute -mt-4 left-3 font-medium border border-slate-700/50">IMPACT BREAKDOWN</div>
             
             <ImpactCard title="Supply Gap" value={results ? `${results.monte_carlo?.p50_gap}M` : '--'} sub="vs Baseline" icon={<Anchor className="w-3 h-3 text-blue-400" />} />
             <ImpactCard title="Storage Depletion" value={results ? "3.2 Days" : '--'} sub="vs Baseline" icon={<DatabaseIcon />} />
             <ImpactCard title="Route Disruption" value={results ? "68 %" : '--'} sub="of Traffic Affected" icon={<RouteIcon />} />
             <ImpactCard title="Port Congestion" value={results ? "41 %" : '--'} sub="vs Baseline" icon={<ShipIcon />} color="text-red-400" />
             <ImpactCard title="Refinery Utilization" value={results ? "↓11 %" : '--'} sub="vs Baseline" icon={<FactoryIcon />} />
             <ImpactCard title="Delivery Delay" value={results ? "6.8 Days" : '--'} sub="Average Increase" icon={<Clock className="w-3 h-3 text-purple-400" />} />
          </div>

        </div>

        {/* RIGHT COLUMN: METRICS */}
        <div className="w-[280px] flex flex-col gap-3 flex-shrink-0 overflow-y-auto no-scrollbar">
          
          <div className="bg-[#1e293b] rounded-md border border-slate-700/50 p-4 shadow-sm flex flex-col gap-4">
            <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Key Impact Metrics <span className="normal-case text-slate-500">(30 Days)</span></h3>
            <div className="flex flex-col gap-3">
              <RightMetric label="Global Supply Gap" value="21.3 Mb/d" trend="↑ 21%" color="text-red-400" />
              <RightMetric label="Price Impact (Oil)" value="$104 /bbl" trend="↑ 24%" color="text-red-400" />
              <RightMetric label="LNG Price Impact" value="$16.8 /MMBtu" trend="↑ 32%" color="text-red-400" />
              <RightMetric label="Reserve Depletion (India)" value="3.2 Days" trend="↑ 32%" color="text-red-400" />
              <RightMetric label="Shipping Cost Index" value="241 Index" trend="↑ 41%" color="text-red-400" />
              <RightMetric label="Refinery Utilization (India)" value="78 %" trend="↓ 11%" color="text-emerald-400" />
            </div>
          </div>

          <div className="bg-[#1e293b] rounded-md border border-slate-700/50 p-4 shadow-sm relative overflow-hidden min-h-[140px]">
            <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3">Economic Impact <span className="normal-case text-slate-500">(India)</span></h3>
            <RequiresAPI endpoint="GET /api/v1/market/economic-impact" />
          </div>

          <div className="bg-[#1e293b] rounded-md border border-slate-700/50 p-4 shadow-sm relative overflow-hidden min-h-[180px] flex-1">
            <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3">Affected Volumes <span className="normal-case text-slate-500">(30 Days)</span></h3>
            <RequiresAPI endpoint="GET /api/v1/market/affected-volumes" />
          </div>

          <div className="bg-[#1e293b] rounded-md border border-slate-700/50 p-4 shadow-sm">
            <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3">Export & Share</h3>
            <div className="flex flex-col gap-2">
               <button className="w-full py-1.5 flex items-center justify-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded transition-colors"><Download size={14} /> Download Report (PDF)</button>
               <button className="w-full py-1.5 flex items-center justify-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded transition-colors"><Download size={14} /> Download Data (CSV)</button>
               <button className="w-full py-1.5 flex items-center justify-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded transition-colors"><Share2 size={14} /> Share Scenario Link</button>
            </div>
            <div className="text-[9px] text-slate-500 text-center mt-3 font-mono">Scenario ID: SCN-2025-05-26-1423</div>
          </div>

        </div>

      </div>
    </div>
  );
}

function ImpactCard({ title, value, sub, icon, color = "text-slate-200" }: any) {
  return (
    <div className="bg-[#1e293b] flex-1 rounded-md border border-slate-700/50 p-2 shadow-sm flex flex-col justify-between">
      <div className="flex items-center gap-1 mb-1">
        <div className="w-4 h-4 rounded bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0">{icon}</div>
        <span className="text-[9px] text-slate-400 uppercase truncate leading-tight">{title}</span>
      </div>
      <div>
         <div className={`text-lg font-medium leading-none ${color}`}>{value}</div>
         <div className="text-[9px] text-slate-500 mt-1">{sub}</div>
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

// Icons
const DatabaseIcon = () => <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>;
const RouteIcon = () => <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><circle cx="6" cy="19" r="3"></circle><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"></path><circle cx="18" cy="5" r="3"></circle></svg>;
const ShipIcon = () => <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-red-400"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"></path><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"></path><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"></path><path d="M12 10v4"></path><path d="M12 2v3"></path></svg>;
const FactoryIcon = () => <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path><path d="M17 18h1"></path><path d="M12 18h1"></path><path d="M7 18h1"></path></svg>;
