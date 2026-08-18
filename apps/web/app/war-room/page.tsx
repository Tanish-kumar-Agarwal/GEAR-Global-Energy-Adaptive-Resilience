'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Package, Map as MapIcon, Globe, ShieldAlert, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { RequiresAPI } from '@/components/ui/requires-api';
import { MapViewer } from '@/components/map-viewer';

export default function WarRoom() {
  const [overview, setOverview] = useState<any>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('http://localhost:8000/api/v1/world/overview').then(r => r.json()),
      fetch('http://localhost:8000/api/v1/world/assets').then(r => r.json())
    ]).then(([ovData, asData]) => {
      setOverview(ovData);
      setAssets(asData);
      setLoading(false);
    }).catch(e => {
      console.error(e);
      setLoading(false);
    });
  }, []);

  return (
    <div className="h-full w-full bg-[#0f172a] p-3 flex gap-3 text-slate-300 font-sans overflow-hidden">
      
      {/* LEFT COLUMN */}
      <div className="w-[320px] flex flex-col gap-3 flex-shrink-0 overflow-y-auto no-scrollbar">
        
        {/* RISK INDEX CARD */}
        <div className="bg-[#1e293b] rounded-md border border-slate-700/50 p-4 shadow-sm flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-[11px] font-bold tracking-wider text-slate-400 mb-1">RISK INDEX</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-light text-emerald-400">67</span>
                <span className="text-sm font-medium text-slate-500">/100</span>
              </div>
              <span className="text-sm font-medium text-emerald-400">Moderate</span>
            </div>
            <div className="h-10 w-24">
              <RequiresAPI endpoint="GET /api/v1/risks/trend" />
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <RiskItem label="Chokepoint Risk (Hormuz/Red Sea)" value="72" trend="UP" severity="HIGH" />
            <RiskItem label="Supplier Concentration Risk" value="48" trend="DOWN" severity="MEDIUM" />
            <RiskItem label="Logistics Network Health" value="61" trend="RIGHT" severity="MEDIUM" />
            <RiskItem label="Weather Risk" value="32" trend="RIGHT" severity="LOW" />
          </div>
        </div>

        {/* TOP EXPOSURES */}
        <div className="bg-[#1e293b] rounded-md border border-slate-700/50 p-4 flex-1 min-h-[220px] flex flex-col">
          <h3 className="text-[11px] font-bold tracking-wider text-slate-400 mb-1 uppercase">Top Exposures</h3>
          <p className="text-[10px] text-slate-500 mb-4">By Risk Contribution</p>
          <div className="flex-1">
            <RequiresAPI endpoint="GET /api/v1/risks/exposures" />
          </div>
        </div>

        {/* WATCHLIST */}
        <div className="bg-[#1e293b] rounded-md border border-slate-700/50 p-4 flex-1 min-h-[220px] flex flex-col">
          <h3 className="text-[11px] font-bold tracking-wider text-slate-400 mb-1 uppercase">Watchlist</h3>
          <p className="text-[10px] text-slate-500 mb-3">(At Risk Assets)</p>
          <div className="flex-1">
            <RequiresAPI endpoint="GET /api/v1/world/assets?sort=risk" />
          </div>
        </div>
      </div>

      {/* CENTER COLUMN */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        
        {/* KPI ROW */}
        <div className="flex gap-3 h-[80px]">
          <KPICard title="SYSTEMIC RISK INDEX" value={overview?.systemic_risk || "--"} max="100" status="Elevated" statusColor="text-amber-500" chart />
          <KPICard title="SUPPLY STRESS LEVEL" value={overview?.supply_stress ? `${overview.supply_stress}%` : "--"} status="Moderate" statusColor="text-amber-400" chart />
          <KPICard title="RESERVE COVERAGE (India)" value="9.8" unit="Days" status="Below Target" statusColor="text-red-400" chart />
        </div>

        {/* MAIN MAP */}
        <div className="flex-1 bg-[#1e293b] rounded-md border border-slate-700/50 overflow-hidden relative">
          <div className="absolute top-2 left-2 z-10 flex gap-1 bg-slate-900/80 p-1 rounded border border-slate-700">
            <button className="px-3 py-1 text-[10px] uppercase bg-blue-600 rounded text-white font-medium">Supply Routes</button>
            <button className="px-3 py-1 text-[10px] uppercase hover:bg-slate-800 rounded">Chokepoints</button>
            <button className="px-3 py-1 text-[10px] uppercase hover:bg-slate-800 rounded">Ports</button>
            <button className="px-3 py-1 text-[10px] uppercase hover:bg-slate-800 rounded">Production</button>
            <button className="px-3 py-1 text-[10px] uppercase hover:bg-slate-800 rounded">Refineries</button>
            <button className="px-3 py-1 text-[10px] uppercase hover:bg-slate-800 rounded">Storage</button>
          </div>
          
          <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
             {assets.length > 0 ? <MapViewer assets={assets} /> : <div className="animate-pulse">Loading map...</div>}
          </div>

          {/* Example Asset Popover Overlay */}
          <div className="absolute top-16 right-4 w-72 bg-slate-800 rounded border border-slate-600 shadow-2xl p-4 z-20">
            <h4 className="text-sm font-bold text-slate-200 mb-2 border-b border-slate-700 pb-2">PARADIP PORT</h4>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Current Capacity</span>
              <span className="font-mono">15 MMTPA</span>
            </div>
            <div className="flex justify-between text-xs mb-4">
              <span className="text-slate-400">Utilization</span>
              <span className="text-red-400 font-bold">92% (CRITICAL)</span>
            </div>
            
            <h5 className="text-[10px] uppercase text-slate-500 mb-2">Dependency Analysis (Neo4j Graph)</h5>
            <div className="h-24 bg-slate-900 rounded mb-4">
               <RequiresAPI endpoint="GET /api/v1/assets/PRT_PARADIP/dependencies" />
            </div>

            <h5 className="text-[10px] uppercase text-slate-500 mb-2">Risk Assessment (MILP ID)</h5>
            <div className="h-16 bg-slate-900 rounded">
               <RequiresAPI endpoint="POST /api/v1/optimization/procurement" />
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION */}
        <div className="flex gap-3 h-[140px]">
          <div className="flex-1 bg-[#1e293b] rounded-md border border-slate-700/50 p-3 flex flex-col">
            <h3 className="text-[11px] font-bold tracking-wider text-slate-400 mb-2 uppercase">Supply Chain Status Overview</h3>
            <div className="flex-1">
               <RequiresAPI endpoint="GET /api/v1/world/supply-chain-status" />
            </div>
          </div>
          
          <div className="w-[400px] bg-[#1e293b] rounded-md border border-slate-700/50 p-3 flex flex-col">
            <h3 className="text-[11px] font-bold tracking-wider text-slate-400 mb-2 uppercase flex items-center gap-2">
              Global News Feed
            </h3>
            <div className="flex-1">
               <RequiresAPI endpoint="GET /api/v1/intelligence/news" />
            </div>
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN */}
      <div className="w-[300px] flex flex-col gap-3 flex-shrink-0 overflow-y-auto no-scrollbar">
        
        {/* PRICING SNAPSHOT */}
        <div className="bg-[#1e293b] rounded-md border border-slate-700/50 p-4">
          <h3 className="text-[11px] font-bold tracking-wider text-slate-400 mb-3 uppercase">Pricing Snapshot</h3>
          <RequiresAPI endpoint="GET /api/v1/market/prices" />
        </div>

        {/* SYSTEM STATUS */}
        <div className="bg-[#1e293b] rounded-md border border-slate-700/50 p-4">
          <h3 className="text-[11px] font-bold tracking-wider text-slate-400 mb-3 uppercase">System Status</h3>
          <RequiresAPI endpoint="GET /api/v1/risks/categories" />
        </div>

        {/* RISK HEATMAP */}
        <div className="bg-[#1e293b] rounded-md border border-slate-700/50 p-4 flex-1 min-h-[150px] flex flex-col">
          <h3 className="text-[11px] font-bold tracking-wider text-slate-400 mb-1 uppercase">Risk Heatmap</h3>
          <p className="text-[10px] text-slate-500 mb-2">(By Region)</p>
          <div className="flex-1">
            <RequiresAPI endpoint="GET /api/v1/risks/heatmap" />
          </div>
        </div>

        {/* GLOBAL SUPPLY BALANCE */}
        <div className="bg-[#1e293b] rounded-md border border-slate-700/50 p-4 flex-1 min-h-[200px] flex flex-col">
          <h3 className="text-[11px] font-bold tracking-wider text-slate-400 mb-1 uppercase">Global Supply Balance <span className="text-[9px] normal-case">(mb/d)</span></h3>
          <div className="flex-1 mt-2">
            <RequiresAPI endpoint="GET /api/v1/market/balance-timeseries" />
          </div>
        </div>
        
        {/* SYSTEM LOGS SMALL */}
        <div className="bg-[#1e293b] rounded-md border border-slate-700/50 p-4">
          <h3 className="text-[11px] font-bold tracking-wider text-slate-400 mb-3 uppercase">System Status</h3>
          <RequiresAPI endpoint="GET /api/v1/health/components" />
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
    <div className="bg-[#1e293b] flex-1 rounded-md border border-slate-700/50 p-3 shadow-sm flex flex-col justify-between">
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
            <RequiresAPI endpoint="..." />
          </div>
        )}
      </div>
    </div>
  );
}
