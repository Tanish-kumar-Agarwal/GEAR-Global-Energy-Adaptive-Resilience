'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Package, Map as MapIcon, Globe, ShieldAlert, TrendingUp, TrendingDown, Clock, Database } from 'lucide-react';
import { RiskTrendChart, RiskExposures, ActiveEventsList, GlobalSupplyBalanceChart } from '@/components/risk-components';
import { SystemHealthComponent } from '@/components/system-health';
import { MapViewer } from '@/components/map-viewer';
import { ApiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { DATA_MODE } from '@/lib/config';
import { HACKATHON_TOP_RISKS, HACKATHON_WORLD_OVERVIEW } from '@/data/snapshot';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

function UnavailableData({ label }: { label: string }) {
  return (
    <div className="relative w-full h-full min-h-[100px] flex items-center justify-center overflow-hidden rounded-md bg-slate-900/40 border border-slate-800/60">
      <div className="relative z-10 flex flex-col items-center justify-center p-4 text-center opacity-70">
        <Database className="h-5 w-5 text-slate-500 mb-2 opacity-50" />
        <span className="text-xs font-bold tracking-wider text-slate-500 mb-1">{label}</span>
        <span className="text-[10px] font-mono text-slate-600 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
          DATA UNAVAILABLE
        </span>
      </div>
    </div>
  );
}

function WatchlistList() {
  const getAssetType = (id: string) => {
    switch (id) {
      case 'R1': return 'Chokepoint';
      case 'R2': return 'Policy';
      case 'R3': return 'Route';
      case 'R4': return 'Geopolitics';
      case 'R5': return 'Policy';
      default: return 'Asset';
    }
  };

  const getTargetArrow = (id: string) => {
    return id === 'R5' ? (
      <span className="text-amber-400 font-bold">→</span>
    ) : (
      <span className="text-red-500 font-bold">↑</span>
    );
  };

  const getRiskColor = (index: number) => {
    if (index > 90) return 'text-red-500';
    if (index > 80) return 'text-red-400';
    return 'text-amber-400';
  };

  return (
    <div className="flex flex-col w-full h-full text-[11px]">
      <div className="flex justify-between items-center text-[10px] text-slate-400 border-b border-slate-700/50 pb-2 mb-2 font-bold tracking-wider uppercase">
        <span className="flex-[1.5]">Asset</span>
        <span className="flex-1 text-center">Type</span>
        <span className="w-12 text-center">Risk</span>
        <span className="w-12 text-center">Target</span>
      </div>
      <div className="flex flex-col gap-1 overflow-y-auto pr-1 pb-2">
        {HACKATHON_TOP_RISKS.map(a => (
          <div key={a.id} className="flex justify-between items-center py-1 border-b border-slate-800/50 last:border-0">
            <span className="flex-[1.5] font-extrabold text-slate-200 truncate pr-2">
              {a.event.replace(' escalation', '').replace(' export controls', ' Controls').replace(' shipping disruption', ' Shipping')}
            </span>
            <span className="flex-1 text-slate-300 text-center font-extrabold">{getAssetType(a.id)}</span>
            <span className={`w-12 text-center font-mono font-extrabold ${getRiskColor(a.index)}`}>{a.index}</span>
            <span className="w-12 text-center text-[12px] font-extrabold">{getTargetArrow(a.id)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssetPopover({ asset, onClose }: { asset: any, onClose: () => void }) {
  const [deps, setDeps] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    ApiClient.getGraphDependencies('EnergyAsset', asset.id)
      .then(res => {
        setDeps(res);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [asset.id]);

  return (
    <div className="absolute top-16 right-4 w-72 bg-slate-800 rounded border border-slate-600 shadow-2xl p-4 z-20">
      <div className="flex justify-between items-center mb-2 border-b border-slate-700 pb-2">
        <h4 className="text-sm font-bold text-slate-200">{asset.name}</h4>
        <button onClick={onClose} className="text-slate-400 hover:text-white">&times;</button>
      </div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">Current Capacity</span>
        <span className="font-mono">{asset.capacity}</span>
      </div>
      <div className="flex justify-between text-xs mb-4">
        <span className="text-slate-400">Type</span>
        <span className="text-slate-300 font-bold">{asset.type}</span>
      </div>
      
      <h5 className="text-[10px] uppercase text-slate-500 mb-2">Dependency Analysis (Neo4j Graph)</h5>
      <div className="h-24 bg-slate-900 rounded mb-4 overflow-y-auto p-2 text-[10px] text-slate-400">
         {loading ? "Analyzing topology..." : (
           deps?.status === 'data_unavailable' ? "Graph data unavailable" : (
             <div className="flex flex-col gap-1">
               <div>Upstream Paths: {deps?.upstream_exposure?.paths?.length || 0}</div>
               <div>Downstream Paths: {deps?.downstream_exposure?.paths?.length || 0}</div>
             </div>
           )
         )}
      </div>

      <h5 className="text-[10px] uppercase text-slate-500 mb-2">Risk Assessment (MILP ID)</h5>
      <div className="h-16 bg-slate-900 rounded flex flex-col items-center justify-center p-2 text-[10px] text-slate-500">
         <span className="mb-2">Select scenario to optimize</span>
         <button 
           onClick={() => router.push(`/scenario-lab?target_id=${asset.id}`)}
           className="px-4 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-bold"
         >
           Create Scenario
         </button>
      </div>
    </div>
  );
}

export default function WarRoom() {
  const [overview, setOverview] = useState<any>(null);
  const [riskEval, setRiskEval] = useState<any>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);

  // In a real app we'd get this from a context, hardcoding the chokepoint for the MVP view
  const activeEntityId = "CHK_HORMUZ"; 

  useEffect(() => {
    Promise.all([
      ApiClient.getWorldOverview(),
      ApiClient.getRiskEvaluation(),
      fetch('http://localhost:8000/api/v1/world/assets').then(r => r.json())
    ]).then(([ovData, riskData, asData]) => {
      setOverview(ovData);
      setRiskEval(riskData);
      setAssets(asData);
      setLoading(false);
    }).catch(e => {
      console.error(e);
      setLoading(false);
    });
  }, []);

  return (
    <div className="h-full min-h-[850px] min-w-[1280px] w-full bg-[#0f181b] p-3 flex gap-3 text-slate-300 font-sans">
      
      {/* LEFT COLUMN */}
      <div className="w-[320px] flex flex-col gap-3 flex-shrink-0 overflow-y-auto no-scrollbar">
        
        {/* RISK INDEX CARD */}
        <div className="bg-[#182227] rounded-md border border-slate-700/50 p-4 shadow-sm flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-[11px] font-bold tracking-wider text-blue-200/80 drop-shadow-sm mb-1">RISK INDEX</h3>
              <div className="flex items-baseline gap-1 drop-shadow-[0_0_10px_rgba(255,255,255,0.15)]">
                {DATA_MODE === 'HACKATHON_SNAPSHOT' ? (
                  <>
                    <span className="text-4xl font-light text-red-400">86</span>
                    <span className="text-sm font-medium text-slate-500">/100</span>
                  </>
                ) : riskEval?.status === 'data_unavailable' ? (
                  <span className="text-xl font-medium text-slate-500">UNAVAILABLE</span>
                ) : (
                  <>
                    <span className="text-4xl font-light text-emerald-400">
                      {riskEval ? riskEval.systemic_risk_score.toFixed(0) : "--"}
                    </span>
                    <span className="text-sm font-medium text-slate-500">/100</span>
                  </>
                )}
              </div>
              <span className="text-sm font-medium text-red-400">
                {DATA_MODE === 'HACKATHON_SNAPSHOT' ? 'High' : (riskEval && riskEval.status !== 'data_unavailable' ? (riskEval.systemic_risk_score > 70 ? 'High' : 'Moderate') : '')}
              </span>
            </div>
              <RiskTrendChart entityId={activeEntityId} />
          </div>
          
          <div className="flex flex-col gap-2 mt-2">
            {DATA_MODE === 'HACKATHON_SNAPSHOT' ? (
              <div className="flex flex-col gap-2 h-full overflow-y-auto no-scrollbar pb-2">
                {HACKATHON_TOP_RISKS.map((risk, i) => {
                  let severity = 'HIGH';
                  let trend = 'UP';
                  if (risk.index < 80) { severity = 'MEDIUM'; trend = 'RIGHT'; }
                  if (risk.index > 90) trend = 'UP';
                  else if (risk.index === 82) trend = 'DOWN';
                  
                  return (
                    <RiskItem 
                      key={risk.id}
                      label={risk.event}
                      value={risk.index}
                      trend={trend}
                      severity={severity}
                    />
                  );
                })}
              </div>
            ) : (
              riskEval?.status === 'data_unavailable' ? (
                 <div className="text-[10px] text-slate-500 italic p-2 border border-slate-700/50 rounded">No active risks documented in backend</div>
              ) : (
                <>
                  <RiskItem label="Active Critical Risks" value={riskEval?.active_critical_risks ?? "--"} trend="UP" severity="HIGH" />
                  <RiskItem label="Active High Risks" value={riskEval?.active_high_risks ?? "--"} trend="RIGHT" severity="MEDIUM" />
                  <RiskItem label="Total Monitored Events" value={riskEval?.event_count ?? "--"} trend="RIGHT" severity="LOW" />
                </>
              )
            )}
          </div>
        </div>

        {/* TOP EXPOSURES */}
        <div className="bg-[#182227] rounded-md border border-slate-700/50 p-4 flex-1 min-h-[220px] flex flex-col">
          <h3 className="text-[12px] font-black tracking-wider text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] mb-1 uppercase">Top Exposures</h3>
          <p className="text-[10px] font-bold text-slate-400 mb-4">By Risk Contribution</p>
          <div className="flex-1">
            <RiskExposures entityId={activeEntityId} />
          </div>
        </div>

        {/* WATCHLIST */}
        <div className="bg-[#182227] rounded-md border border-slate-700/50 p-4 flex-1 min-h-[220px] flex flex-col">
          <h3 className="text-[12px] font-black tracking-wider text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] mb-2 uppercase">WATCHLIST <span className="normal-case text-[10px] text-slate-400 font-bold">(At Risk Assets)</span></h3>
          <div className="flex-1">
            <WatchlistList />
          </div>
        </div>
      </div>

      {/* CENTER COLUMN */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        
        {/* KPI ROW */}
        <div className="flex gap-3 min-h-[90px]">
          <KPICard title="SYSTEMIC RISK INDEX" value={overview?.systemic_risk || "--"} max="100" status={overview?.status === "ok" ? (overview.systemic_risk > 70 ? "Elevated" : "Moderate") : "DATA UNAVAILABLE"} statusColor={overview?.systemic_risk > 70 ? "text-red-400" : "text-slate-400"} chartType="up-red" />
          <KPICard title="SUPPLY STRESS LEVEL" value={overview?.supply_stress ? `${overview.supply_stress}%` : "--"} status={overview?.supply_stress > 30 ? "High" : (overview?.supply_stress ? "Moderate" : "DATA UNAVAILABLE")} statusColor="text-amber-400" chartType="up-amber" />
          {DATA_MODE === 'HACKATHON_SNAPSHOT' ? (
              <KPICard title="RESERVE COVERAGE (India)" value="9.8" unit="Days" status="Below Target" statusColor="text-red-400" chartType="down-red" />
            ) : (
              <UnavailableData label="RESERVE COVERAGE" />
            )}
        </div>

        {/* MAIN MAP */}
        <div className="flex-1 bg-[#182227] rounded-md border border-slate-700/50 overflow-hidden relative">
          <div className="absolute top-2 left-2 z-10 flex gap-1 bg-slate-900/80 p-1 rounded border border-slate-700">
            <button className="px-3 py-1 text-[10px] uppercase bg-blue-600 rounded text-white font-medium">Supply Routes</button>
            <button className="px-3 py-1 text-[10px] uppercase hover:bg-slate-800 rounded">Chokepoints</button>
            <button className="px-3 py-1 text-[10px] uppercase hover:bg-slate-800 rounded">Ports</button>
            <button className="px-3 py-1 text-[10px] uppercase hover:bg-slate-800 rounded">Production</button>
            <button className="px-3 py-1 text-[10px] uppercase hover:bg-slate-800 rounded">Refineries</button>
            <button className="px-3 py-1 text-[10px] uppercase hover:bg-slate-800 rounded">Storage</button>
          </div>
          
          <div className="absolute inset-0 bg-slate-900 flex items-center justify-center cursor-pointer" onClick={() => {
            // Mock map interaction since actual webGL is too heavy, 
            // if we have assets, just select the first one to demonstrate interaction
            if (assets.length > 0 && !selectedAsset) setSelectedAsset(assets[0]);
          }}>
             {DATA_MODE === 'HACKATHON_SNAPSHOT' || assets.length > 0 ? <MapViewer assets={assets} /> : <div className="animate-pulse">Loading map...</div>}
          </div>

          {selectedAsset && (
            <AssetPopover asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
          )}
        </div>

        {/* BOTTOM SECTION */}
        <div className="flex flex-col gap-3 h-[170px]">
          <div className="flex-[0.55] bg-[#182227] rounded-md border border-slate-700/50 p-3 flex flex-col">
            <h3 className="text-[12px] font-black tracking-wider text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] mb-2 uppercase">SUPPLY CHAIN STATUS OVERVIEW</h3>
            <div className="flex-1 overflow-hidden">
              <SupplyChainStatusOverview />
            </div>
          </div>
          
          <div className="flex-[0.45] bg-[#182227] rounded-md border border-slate-700/50 px-3 py-2 flex flex-col justify-center">
            <h3 className="text-[10px] font-black tracking-wider text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] mb-1 uppercase">GLOBAL NEWS FEED</h3>
            <div className="flex-1 overflow-hidden">
              <GlobalNewsFeedHorizontal />
            </div>
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN */}
      <div className="w-[300px] flex flex-col gap-3 flex-shrink-0 overflow-y-auto no-scrollbar">
        
        {/* PRICING SNAPSHOT */}
        <div className="bg-[#182227] rounded-md h-[120px] p-3 flex flex-col border border-slate-700/50">
          <h3 className="text-[12px] font-black tracking-wider text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] mb-2 uppercase">PRICING SNAPSHOT (USD)</h3>
          {DATA_MODE === 'HACKATHON_SNAPSHOT' ? (
            <div className="flex flex-col gap-1 text-[11px]">
              <div className="flex justify-between"><span className="text-slate-200 font-bold">Brent Crude</span><span className="font-mono font-bold text-white">64.82 <span className="text-emerald-400 ml-1">+2.35%</span></span></div>
              <div className="flex justify-between"><span className="text-slate-200 font-bold">WTI Crude</span><span className="font-mono font-bold text-white">61.47 <span className="text-emerald-400 ml-1">+2.18%</span></span></div>
              <div className="flex justify-between"><span className="text-slate-200 font-bold">LNG (JKM)</span><span className="font-mono font-bold text-white">12.34 <span className="text-emerald-400 ml-1">+1.92%</span></span></div>
              <div className="flex justify-between"><span className="text-slate-200 font-bold">Coal (API2)</span><span className="font-mono font-bold text-white">104.6 <span className="text-red-400 ml-1">-0.45%</span></span></div>
            </div>
          ) : <UnavailableData label="" />}
        </div>

        {/* SYSTEM STATUS */}
        <div className="bg-[#182227] rounded-md h-[120px] p-3 flex flex-col border border-slate-700/50">
          <h3 className="text-[12px] font-black tracking-wider text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] mb-2 uppercase">SYSTEM STATUS</h3>
          {DATA_MODE === 'HACKATHON_SNAPSHOT' ? (
            <div className="flex flex-col gap-1 text-[11px] font-bold text-slate-300">
              <div className="flex justify-between items-center"><span className="flex items-center gap-2"><Globe size={12}/> Geopolitical Risk</span><span className="text-red-400 font-mono font-bold">72 ↑</span></div>
              <div className="flex justify-between items-center"><span className="flex items-center gap-2"><Package size={12}/> Logistics Risk</span><span className="text-amber-400 font-mono font-bold">61 →</span></div>
              <div className="flex justify-between items-center"><span className="flex items-center gap-2"><Database size={12}/> Supply Risk</span><span className="text-emerald-400 font-mono font-bold">42 ↓</span></div>
              <div className="flex justify-between items-center"><span className="flex items-center gap-2"><Activity size={12}/> Market Risk</span><span className="text-emerald-400 font-mono font-bold">32 ↓</span></div>
            </div>
          ) : <UnavailableData label="" />}
        </div>

        {/* RISK HEATMAP */}
        <div className="bg-[#182227] rounded-md flex-1 min-h-[150px] p-3 flex flex-col border border-slate-700/50">
          <h3 className="text-[12px] font-black tracking-wider text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] mb-2 uppercase">RISK HEATMAP <span className="normal-case text-slate-400 text-[10px] font-bold">(By Region)</span></h3>
          {DATA_MODE === 'HACKATHON_SNAPSHOT' ? (
             <div className="flex-1 w-full h-full relative overflow-hidden rounded mt-1">
                <img 
                  src="/risk-map-cropped.png" 
                  alt="Risk Heatmap" 
                  className="w-full h-full object-contain opacity-90 hover:opacity-100 transition-opacity" 
                />
             </div>
          ) : <UnavailableData label="" />}
        </div>

        {/* GLOBAL SUPPLY BALANCE */}
        <div className="bg-[#182227] rounded-md flex-1 min-h-[150px] p-3 flex flex-col border border-slate-700/50">
          <h3 className="text-[12px] font-black tracking-wider text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] mb-2 uppercase">GLOBAL SUPPLY BALANCE <span className="normal-case text-slate-400 text-[10px] font-bold">(Mton)</span></h3>
          {DATA_MODE === 'HACKATHON_SNAPSHOT' ? (
             <GlobalSupplyBalanceChart />
          ) : <UnavailableData label="" />}
        </div>
        
        <div className="bg-[#182227] rounded-md min-h-[150px] p-3 border border-slate-700/50">
          <SystemHealthComponent />
        </div>

      </div>

    </div>
  );
}

function RiskItem({ label, value, trend, severity }: any) {
  const getSeverityStyles = (sev: string) => {
    switch (sev) {
      case 'HIGH': return { wrapper: 'border-slate-700/50 border-l-red-500 bg-red-950/20', text: 'text-red-400', glow: 'drop-shadow-[0_0_8px_rgba(248,113,113,0.6)]' };
      case 'MEDIUM': return { wrapper: 'border-slate-700/50 border-l-amber-500 bg-amber-950/20', text: 'text-amber-400', glow: 'drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]' };
      case 'LOW': return { wrapper: 'border-slate-700/50 border-l-emerald-500 bg-emerald-950/20', text: 'text-emerald-400', glow: 'drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]' };
      default: return { wrapper: 'border-slate-700/50 border-l-slate-500 bg-slate-900/50', text: 'text-slate-400', glow: 'drop-shadow-[0_0_5px_rgba(148,163,184,0.5)]' };
    }
  };
  const styles = getSeverityStyles(severity);

  return (
    <div className={`p-3 rounded-md border-y border-r border-l-[3px] flex flex-col gap-1.5 ${styles.wrapper}`}>
      <span className="text-[12px] text-white font-bold tracking-wide drop-shadow-[0_0_6px_rgba(255,255,255,0.4)] line-clamp-1" title={label}>{label}</span>
      <div className={`flex items-center gap-1.5 font-sans ${styles.glow}`}>
        <span className={`text-2xl font-bold ${styles.text}`}>{value}</span>
        {trend === 'UP' && <TrendingUp size={16} className={styles.text} />}
        {trend === 'DOWN' && <TrendingDown size={16} className={styles.text} />}
        {trend === 'RIGHT' && <span className={`text-sm font-bold ${styles.text}`}>→</span>}
        <span className={`text-[10px] uppercase font-black tracking-wider ${styles.text}`}>({severity})</span>
      </div>
    </div>
  );
}

function SupplyChainStatusOverview() {
  return (
    <div className="flex items-center justify-between h-full px-2 w-full">
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-2">
           <div className="w-5 h-5 rounded-full bg-emerald-950/40 border border-emerald-500/50 flex items-center justify-center text-emerald-500"><Activity size={10}/></div>
           <span className="text-[11px] text-slate-200 font-bold">Production</span>
        </div>
        <span className="text-emerald-500 font-bold text-[10px]">Stable</span>
      </div>
      <span className="text-slate-500">→</span>
      
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-2">
           <div className="w-5 h-5 rounded-full bg-amber-950/40 border border-amber-500/50 flex items-center justify-center text-amber-500"><TrendingDown size={10}/></div>
           <span className="text-[11px] text-slate-200 font-bold">Transportation</span>
        </div>
        <span className="text-amber-500 font-bold text-[10px]">At Risk</span>
      </div>
      <span className="text-slate-500">→</span>
      
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-2">
           <div className="w-5 h-5 rounded-full bg-red-950/40 border border-red-500/50 flex items-center justify-center text-red-500"><AlertTriangle size={10}/></div>
           <span className="text-[11px] text-slate-200 font-bold">Ports & Terminals</span>
        </div>
        <span className="text-red-500 font-bold text-[10px]">Disrupted</span>
      </div>
      <span className="text-slate-500">→</span>
      
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-2">
           <div className="w-5 h-5 rounded-full bg-emerald-950/40 border border-emerald-500/50 flex items-center justify-center text-emerald-500"><Activity size={10}/></div>
           <span className="text-[11px] text-slate-200 font-bold">Refining</span>
        </div>
        <span className="text-emerald-500 font-bold text-[10px]">Stable</span>
      </div>
      <span className="text-slate-500">→</span>

      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-2">
           <div className="w-5 h-5 rounded-full bg-emerald-950/40 border border-emerald-500/50 flex items-center justify-center text-emerald-500"><Package size={10}/></div>
           <span className="text-[11px] text-slate-200 font-bold">Distribution</span>
        </div>
        <span className="text-emerald-500 font-bold text-[10px]">Stable</span>
      </div>
      <span className="text-slate-500">→</span>

      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-2">
           <div className="w-5 h-5 rounded-full bg-amber-950/40 border border-amber-500/50 flex items-center justify-center text-amber-500"><Clock size={10}/></div>
           <span className="text-[11px] text-slate-200 font-bold">End Demand</span>
        </div>
        <span className="text-amber-500 font-bold text-[10px]">Moderate</span>
      </div>
    </div>
  );
}

function GlobalNewsFeedHorizontal() {
  const news = [
    { time: '3h ago', text: 'US increases pressure on Iran on exports with new sanctions.', source: 'Reuters' },
    { time: '3h ago', text: 'Tanker demurrage rates in Red Sea reach 38%.', source: 'Bloomberg' },
    { time: '4h ago', text: 'West Africa ports face severe congestion.', source: 'Platts' },
    { time: '5h ago', text: 'OPEC+ confirms output adjustment in June.', source: 'CNBC' },
    { time: '6h ago', text: 'Asia LNG prices spike amid supply uncertainty.', source: 'Energy Connects' },
  ];
  return (
    <div className="flex gap-4 items-center overflow-x-auto no-scrollbar w-full h-full pb-1">
      {news.map((n, i) => (
        <div key={i} className="flex flex-col min-w-[200px] border-r border-slate-700/50 pr-4 last:border-0 h-full justify-center">
           <div className="flex items-start gap-2 mb-1">
              <span className="text-[10px] text-slate-400 whitespace-nowrap pt-0.5">{n.time}</span>
              <span className="text-[10px] font-bold text-slate-200 leading-tight flex-1">{n.text}</span>
           </div>
           <span className="text-[9px] text-slate-500 text-left pl-10">{n.source}</span>
        </div>
      ))}
    </div>
  );
}

const sysRiskData = [20, 25, 22, 30, 28, 35, 40, 32, 45, 50, 48, 55, 60, 58, 65].map((v, i) => ({ value: v }));
const supplyStressData = [10, 15, 12, 18, 15, 22, 20, 25, 22, 28, 25, 30, 28, 32, 30].map((v, i) => ({ value: v }));
const reserveCovData = [40, 45, 42, 38, 40, 35, 38, 32, 35, 30, 28, 32, 25, 20, 22].map((v, i) => ({ value: v }));

function Sparkline({ data, color }: { data: any[], color: string }) {
  const colorId = color.replace('#', '');
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`color-${colorId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.6}/>
            <stop offset="95%" stopColor={color} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fillOpacity={1} fill={`url(#color-${colorId})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function KPICard({ title, value, unit, status, statusColor, max, chartType }: any) {
  return (
    <div className="bg-[#182227] flex-1 rounded-md border border-slate-700/50 p-3 shadow-sm flex flex-col justify-between">
      <h3 className="text-[12px] font-black tracking-wider text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] uppercase">{title}</h3>
      <div className="flex justify-between items-end mt-1">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-white">{value}</span>
            {max && <span className="text-xs font-bold text-slate-400">/{max}</span>}
            {unit && <span className="text-xs font-bold text-slate-400">{unit}</span>}
          </div>
          <div className={`text-[11px] font-bold tracking-wide mt-1 ${statusColor}`}>{status}</div>
        </div>
        {chartType && (
          <div className="w-24 h-10 opacity-90 pb-1">
            {chartType === 'up-red' && <Sparkline data={sysRiskData} color="#f97316" />}
            {chartType === 'up-amber' && <Sparkline data={supplyStressData} color="#fbbf24" />}
            {chartType === 'down-red' && <Sparkline data={reserveCovData} color="#3b82f6" />}
          </div>
        )}
      </div>
    </div>
  );
}
