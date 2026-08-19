'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Package, Map as MapIcon, Globe, ShieldAlert, TrendingUp, TrendingDown, Clock, Database } from 'lucide-react';
import { RiskTrendChart, RiskExposures, ActiveEventsList } from '@/components/risk-components';
import { MapViewer } from '@/components/map-viewer';
import { ApiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';

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
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ApiClient.getWatchlistAssets().then(res => {
      setAssets(res.slice(0, 10)); // Just show top 10
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-xs text-slate-500 animate-pulse">Loading watchlist...</div>;
  if (!assets.length) return <div className="text-xs text-slate-500 italic">No assets available.</div>;

  return (
    <div className="flex flex-col gap-1 overflow-y-auto pr-2">
      {assets.map(a => (
        <div key={a.id} className="flex justify-between items-center bg-slate-800/40 p-1.5 rounded border border-slate-700/50">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-300">{a.name}</span>
            <span className="text-[9px] text-slate-500">{a.type}</span>
          </div>
          <span className="text-[9px] font-mono text-amber-500">Vol: {a.capacity}</span>
        </div>
      ))}
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
              <h3 className="text-[11px] font-bold tracking-wider text-slate-400 mb-1">RISK INDEX</h3>
              <div className="flex items-baseline gap-1">
                {riskEval?.status === 'data_unavailable' ? (
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
              <span className="text-sm font-medium text-emerald-400">
                {riskEval && riskEval.status !== 'data_unavailable' ? (riskEval.systemic_risk_score > 70 ? 'High' : 'Moderate') : ''}
              </span>
            </div>
              <RiskTrendChart entityId={activeEntityId} />
          </div>
          
          <div className="flex flex-col gap-2">
            {riskEval?.status === 'data_unavailable' ? (
               <div className="text-[10px] text-slate-500 italic p-2 border border-slate-700/50 rounded">No active risks documented in backend</div>
            ) : (
              <>
                <RiskItem label="Active Critical Risks" value={riskEval?.active_critical_risks ?? "--"} trend="UP" severity="HIGH" />
                <RiskItem label="Active High Risks" value={riskEval?.active_high_risks ?? "--"} trend="RIGHT" severity="MEDIUM" />
                <RiskItem label="Total Monitored Events" value={riskEval?.event_count ?? "--"} trend="RIGHT" severity="LOW" />
              </>
            )}
          </div>
        </div>

        {/* TOP EXPOSURES */}
        <div className="bg-[#182227] rounded-md border border-slate-700/50 p-4 flex-1 min-h-[220px] flex flex-col">
          <h3 className="text-[11px] font-bold tracking-wider text-slate-400 mb-1 uppercase">Top Exposures</h3>
          <p className="text-[10px] text-slate-500 mb-4">By Risk Contribution</p>
          <div className="flex-1">
            <RiskExposures entityId={activeEntityId} />
          </div>
        </div>

        {/* WATCHLIST */}
        <div className="bg-[#182227] rounded-md border border-slate-700/50 p-4 flex-1 min-h-[220px] flex flex-col">
          <h3 className="text-[11px] font-bold tracking-wider text-slate-400 mb-1 uppercase">Watchlist</h3>
          <p className="text-[10px] text-slate-500 mb-3">(At Risk Assets)</p>
          <div className="flex-1">
            <WatchlistList />
          </div>
        </div>
      </div>

      {/* CENTER COLUMN */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        
        {/* KPI ROW */}
        <div className="flex gap-3 h-[80px]">
          <KPICard title="SYSTEMIC RISK INDEX" value={overview?.systemic_risk || "--"} max="100" status="Elevated" statusColor="text-amber-500" chart />
          <KPICard title="SUPPLY STRESS LEVEL" value={overview?.supply_stress ? `${overview.supply_stress}%` : "--"} status="Moderate" statusColor="text-amber-400" chart />
          <div className="flex-1 rounded-md overflow-hidden flex">
            <UnavailableData label="RESERVE COVERAGE" />
          </div>
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
             {assets.length > 0 ? <MapViewer assets={assets} /> : <div className="animate-pulse">Loading map...</div>}
          </div>

          {selectedAsset && (
            <AssetPopover asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
          )}
        </div>

        {/* BOTTOM SECTION */}
        <div className="flex gap-3 h-[140px]">
          <div className="flex-1 bg-[#182227] rounded-md overflow-hidden flex flex-col">
            <UnavailableData label="SUPPLY CHAIN STATUS" />
          </div>
          
          <div className="w-[400px] bg-[#182227] rounded-md border border-slate-700/50 p-3 flex flex-col">
            <h3 className="text-[11px] font-bold tracking-wider text-slate-400 mb-2 uppercase flex items-center gap-2">
              Global News Feed
            </h3>
            <div className="flex-1 overflow-y-auto pr-2">
              {overview?.recent_events && overview.recent_events.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {overview.recent_events.map((ev: any) => (
                    <div key={ev.id} className="text-[10px] text-slate-300 border-b border-slate-800/50 pb-2">
                      <span className="text-red-400 font-bold">[{ev.type}]</span> {ev.location} - Severity: {ev.severity.toFixed(2)}
                      <div className="text-[8px] text-slate-500 mt-1">{new Date(ev.timestamp).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <ActiveEventsList />
              )}
          </div>
        </div>
        </div>

      </div>

      {/* RIGHT COLUMN */}
      <div className="w-[300px] flex flex-col gap-3 flex-shrink-0 overflow-y-auto no-scrollbar">
        
        {/* PRICING SNAPSHOT */}
        <div className="bg-[#182227] rounded-md h-[120px]">
          <UnavailableData label="PRICING SNAPSHOT" />
        </div>

        {/* SYSTEM STATUS */}
        <div className="bg-[#182227] rounded-md h-[120px]">
          <UnavailableData label="RISK CATEGORIES" />
        </div>

        {/* RISK HEATMAP */}
        <div className="bg-[#182227] rounded-md flex-1 min-h-[150px]">
          <UnavailableData label="RISK HEATMAP" />
        </div>

        {/* GLOBAL SUPPLY BALANCE */}
        <div className="bg-[#182227] rounded-md flex-1 min-h-[200px]">
          <UnavailableData label="GLOBAL SUPPLY BALANCE" />
        </div>
        
        {/* SYSTEM LOGS SMALL */}
        <div className="bg-[#182227] rounded-md h-[120px]">
          <UnavailableData label="SYSTEM HEALTH" />
        </div>

      </div>

    </div>
  );
}

function RiskItem({ label, value, trend, severity }: any) {
  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'HIGH': return 'text-red-400 border-red-400/30 bg-red-400/10';
      case 'MEDIUM': return 'text-amber-400 border-amber-400/30 bg-amber-400/10';
      case 'LOW': return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className={`p-2 rounded border flex items-center justify-between ${getSeverityColor(severity)}`}>
      <span className="text-xs">{label}</span>
      <div className="flex items-center gap-1 font-mono text-sm">
        <span>{value}</span>
        {trend === 'UP' && <TrendingUp size={12} />}
        {trend === 'DOWN' && <TrendingDown size={12} />}
        {trend === 'RIGHT' && <span className="text-[10px]">→</span>}
        <span className="text-[9px] uppercase ml-1">({severity})</span>
      </div>
    </div>
  );
}

function KPICard({ title, value, unit, status, statusColor, max, chart }: any) {
  return (
    <div className="bg-[#182227] flex-1 rounded-md border border-slate-700/50 p-3 shadow-sm flex flex-col justify-between">
      <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">{title}</h3>
      <div className="flex justify-between items-end mt-1">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-medium text-slate-200">{value}</span>
            {max && <span className="text-xs text-slate-500">/{max}</span>}
            {unit && <span className="text-xs text-slate-400">{unit}</span>}
          </div>
          <div className={`text-[10px] font-medium ${statusColor}`}>{status}</div>
        </div>
        {chart && (
          <div className="w-16 h-8 opacity-50">
            {/* Sparkline placeholder for metrics */}
          </div>
        )}
      </div>
    </div>
  );
}
