'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, Clock, Package, Globe, TrendingUp, TrendingDown, Database, Layers, Maximize2, Check } from 'lucide-react';
import { RiskTrendChart, RiskExposures, ActiveEventsList, GlobalSupplyBalanceChart } from '@/components/risk-components';
import { SystemHealthComponent } from '@/components/system-health';
import { MapViewer, MAP_LAYER_IDS, MAP_LAYER_LABELS, MapLayerId, SelectedMapFeature } from '@/components/map-viewer';
import { RiskHeatmapMap } from '@/components/risk-heatmap-map';
import { ApiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { HACKATHON_TOP_RISKS, HACKATHON_MAP_ASSETS, HACKATHON_SUPPLY_ROUTES, HACKATHON_CHOKEPOINTS, SupplyRoute, MapAsset } from '@/data/snapshot';
import { DisasterEvent, DisastersSummaryResponse } from '@/types';
import {
  toSupplyRoutes, toChokepoints, toMapAssets, toRegionScores, toTopRisks,
  toWatchlist, toNewsItems, toPriceRows, toCategoryRows, indiaReserveCoverage,
  toBalanceSeries, toSupplyChainStages, ChokepointRow, WatchlistRow, PriceRow,
  CategoryRow, BalancePoint, StageStatus,
} from '@/lib/live-adapters';
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

// Live rows are risk-scored assets/chokepoints from the backend; without them
// the designed snapshot watchlist keeps the panel populated.
function WatchlistList({ rows }: { rows?: WatchlistRow[] | null }) {
  const getRiskColor = (index: number) => {
    if (index > 90) return 'text-red-500';
    if (index > 80) return 'text-red-400';
    if (index > 50) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const items: { id: string; name: string; kind: string; risk: number; arrowUp: boolean }[] =
    rows && rows.length
      ? rows.map(r => ({ id: r.id, name: r.name, kind: r.kind, risk: r.risk ?? 0, arrowUp: (r.risk ?? 0) >= 50 }))
      : HACKATHON_TOP_RISKS.map(a => ({
          id: a.id,
          name: a.event.replace(' escalation', '').replace(' export controls', ' Controls').replace(' shipping disruption', ' Shipping'),
          kind: ({ R1: 'Chokepoint', R2: 'Policy', R3: 'Route', R4: 'Geopolitics', R5: 'Policy' } as Record<string, string>)[a.id] ?? 'Asset',
          risk: a.index,
          arrowUp: a.id !== 'R5',
        }));

  return (
    <div className="flex flex-col w-full h-full text-[11px]">
      <div className="flex justify-between items-center text-[10px] text-slate-400 border-b border-slate-700/50 pb-2 mb-2 font-bold tracking-wider uppercase">
        <span className="flex-[1.5]">Asset</span>
        <span className="flex-1 text-center">Type</span>
        <span className="w-12 text-center">Risk</span>
        <span className="w-12 text-center">Target</span>
      </div>
      <div className="flex flex-col gap-1 overflow-y-auto pr-1 pb-2">
        {items.map(a => (
          <div key={a.id} className="flex justify-between items-center py-1 border-b border-slate-800/50 last:border-0">
            <span className="flex-[1.5] font-extrabold text-slate-200 truncate pr-2">{a.name}</span>
            <span className="flex-1 text-slate-300 text-center font-extrabold">{a.kind}</span>
            <span className={`w-12 text-center font-mono font-extrabold ${getRiskColor(a.risk)}`}>{a.risk}</span>
            <span className="w-12 text-center text-[12px] font-extrabold">
              {a.arrowUp
                ? <span className="text-red-500 font-bold">↑</span>
                : <span className="text-amber-400 font-bold">→</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface GraphDependencies {
  status?: string;
  blast_radius?: Record<string, unknown>;
  upstream_exposure?: Array<{ Supplier?: string; Commodity?: string } | string[]> | { paths?: Array<{ Supplier?: string; Commodity?: string } | string[]> };
  downstream_exposure?: Array<{ Supplier?: string; Commodity?: string } | string[]> | { paths?: Array<{ Supplier?: string; Commodity?: string } | string[]> };
  [key: string]: unknown;
}

interface AssetPopoverProps {
  asset: { id: string; name: string; capacity?: number | string; type?: string; [key: string]: unknown };
  onClose: () => void;
}

function AssetPopover({ asset, onClose }: AssetPopoverProps) {
  const [deps, setDeps] = useState<GraphDependencies | null>(null);
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
         {loading ? "Analyzing topology..." : (() => {
           if (!deps || deps.status === 'data_unavailable') return "Graph data unavailable";
           // Live graph returns arrays of exposure rows; the older snapshot
           // shape nests them under .paths. Support both.
           const upstream = Array.isArray(deps.upstream_exposure) ? deps.upstream_exposure : deps.upstream_exposure?.paths ?? [];
           const downstream = Array.isArray(deps.downstream_exposure) ? deps.downstream_exposure : deps.downstream_exposure?.paths ?? [];
           return (
             <div className="flex flex-col gap-1">
               <div>Upstream Paths: {upstream.length}</div>
               <div>Downstream Paths: {downstream.length}</div>
               {upstream.slice(0, 3).map((u: { Supplier?: string; Commodity?: string } | string[], i: number) => (
                 <div key={i} className="text-slate-500 truncate">
                   {Array.isArray(u) ? u.join(' > ') : `${u.Supplier ?? 'Supplier'} (${u.Commodity ?? 'flow'})`}
                 </div>
               ))}
               {upstream.length > 3 && <div className="text-slate-600">+{upstream.length - 3} more suppliers</div>}
             </div>
           );
         })()}
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

const ALL_LAYERS_ON: Record<MapLayerId, boolean> = {
  routes: true, chokepoints: true, disasters: true, ports: true, production: true, refineries: true, storage: true,
};

function MapToolbar({ layers, setLayers, onFullscreen, disasterSummary }: {
  layers: Record<MapLayerId, boolean>;
  setLayers: React.Dispatch<React.SetStateAction<Record<MapLayerId, boolean>>>;
  onFullscreen: () => void;
  disasterSummary?: DisastersSummaryResponse | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const allOn = MAP_LAYER_IDS.every(id => layers[id]);

  const toggle = (id: MapLayerId) => setLayers(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="relative z-20 flex items-center gap-1 px-2 h-9 bg-[#101a1f] border-b border-slate-700/50 flex-shrink-0">
      <span className="text-[10px] text-slate-500 mr-1">View:</span>
      {MAP_LAYER_IDS.map(id => (
        <button
          key={id}
          onClick={() => toggle(id)}
          className={`px-2.5 py-1 text-[10px] rounded-sm border transition-colors ${
            layers[id]
              ? 'bg-cyan-800/70 border-cyan-600/60 text-cyan-100'
              : 'bg-slate-900/60 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          {MAP_LAYER_LABELS[id]}
        </button>
      ))}
      <button
        onClick={() => setLayers({ ...ALL_LAYERS_ON })}
        className={`px-2.5 py-1 text-[10px] rounded-sm border transition-colors ${
          allOn
            ? 'bg-cyan-800/70 border-cyan-600/60 text-cyan-100'
            : 'bg-slate-900/60 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
        }`}
      >
        All Layers
      </button>

      {/* GDACS Live Hazard Alert Badge */}
      {disasterSummary && disasterSummary.total_active_disasters > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-950/60 border border-red-500/40 text-[9.5px] font-mono text-red-300 ml-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          <span className="font-bold text-red-200">GDACS LIVE:</span>
          <span>{disasterSummary.total_active_disasters} Active Hazards</span>
          {disasterSummary.counts_by_alert_level?.Red > 0 && (
            <span className="bg-red-600/80 text-white font-bold px-1 rounded text-[8.5px]">
              {disasterSummary.counts_by_alert_level.Red} RED
            </span>
          )}
        </div>
      )}

      <div className="flex-1" />
      <div className="relative">
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] rounded-sm border border-slate-700/50 bg-slate-900/60 text-slate-300 hover:bg-slate-800"
        >
          <Layers size={11} /> Layers
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-[#101a1f] border border-slate-700/60 rounded-sm shadow-2xl p-1 flex flex-col">
            {MAP_LAYER_IDS.map(id => (
              <button
                key={id}
                onClick={() => toggle(id)}
                className="flex items-center justify-between px-2 py-1.5 text-[10px] text-slate-300 hover:bg-slate-800 rounded-sm text-left"
              >
                {MAP_LAYER_LABELS[id]}
                {layers[id] && <Check size={11} className="text-cyan-400" />}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={onFullscreen}
        title="Fullscreen"
        className="p-1.5 rounded-sm border border-slate-700/50 bg-slate-900/60 text-slate-300 hover:bg-slate-800"
      >
        <Maximize2 size={11} />
      </button>
    </div>
  );
}

export default function WarRoom() {
  const [overview, setOverview] = useState<any>(null);
  const [riskEval, setRiskEval] = useState<any>(null);
  const [assets, setAssets] = useState<MapAsset[]>(HACKATHON_MAP_ASSETS);
  const [routes, setRoutes] = useState<SupplyRoute[]>(HACKATHON_SUPPLY_ROUTES);
  const [chokepoints, setChokepoints] = useState<ChokepointRow[]>(HACKATHON_CHOKEPOINTS);
  const [disasters, setDisasters] = useState<DisasterEvent[]>([]);
  const [disasterSummary, setDisasterSummary] = useState<DisastersSummaryResponse | null>(null);
  const [regionScores, setRegionScores] = useState<Record<string, number> | undefined>(undefined);
  const [topRisks, setTopRisks] = useState<{ id: string; event: string; index: number }[]>(
    HACKATHON_TOP_RISKS.map(r => ({ id: r.id, event: r.event, index: r.index })),
  );
  const [watchlist, setWatchlist] = useState<WatchlistRow[] | null>(null);
  const [news, setNews] = useState<{ time: string; text: string; source: string }[] | null>(null);
  const [prices, setPrices] = useState<PriceRow[] | null>(null);
  const [categories, setCategories] = useState<CategoryRow[] | null>(null);
  const [reserve, setReserve] = useState<{ days: number; belowTarget: boolean } | null>(null);
  const [balance, setBalance] = useState<BalancePoint[] | null>(null);
  const [stages, setStages] = useState<{ transportation: StageStatus; ports: StageStatus; demand: StageStatus } | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [mapLayers, setMapLayers] = useState<Record<MapLayerId, boolean>>({ ...ALL_LAYERS_ON });
  const mapPanelRef = useRef<HTMLDivElement>(null);

  // In a real app we'd get this from a context, hardcoding the chokepoint for the MVP view
  const activeEntityId = "CHK_HORMUZ";

  // Every call goes through ApiClient, which serves the live backend and
  // falls back to snapshot payloads per request, so each panel fills with the
  // best data available without any panel blocking another.
  useEffect(() => {
    ApiClient.getWorldOverview().then(setOverview).catch(console.error);
    ApiClient.getRiskEvaluation().then(setRiskEval).catch(console.error);
    ApiClient.getWorldRoutes().then(r => setRoutes(toSupplyRoutes(r))).catch(console.error);
    ApiClient.getLiveDisasters().then(res => { if (res?.data) setDisasters(res.data); }).catch(console.error);
    ApiClient.getDisastersSummary().then(setDisasterSummary).catch(console.error);
    Promise.all([ApiClient.getWatchlistAssets(), ApiClient.getWorldChokepoints()])
      .then(([liveAssets, liveChokepoints]) => {
        setAssets(toMapAssets(liveAssets));
        setChokepoints(toChokepoints(liveChokepoints));
        const rows = toWatchlist(liveAssets, liveChokepoints);
        if (rows.length) setWatchlist(rows);
      })
      .catch(console.error);
    ApiClient.getRiskHeatmap()
      .then(h => {
        setRegionScores(toRegionScores(h));
        const risks = toTopRisks(h);
        if (risks.length) setTopRisks(risks);
      })
      .catch(console.error);
    ApiClient.getIntelligenceEvents(5)
      .then(e => { const items = toNewsItems(e); if (items.length) setNews(items); })
      .catch(console.error);
    ApiClient.getMarketPrices()
      .then(p => { const rows = toPriceRows(p); if (rows.length) setPrices(rows); })
      .catch(console.error);
    ApiClient.getRiskCategories()
      .then(c => { const rows = toCategoryRows(c); if (rows.length) setCategories(rows); })
      .catch(console.error);
    ApiClient.getMarketReserveCoverage()
      .then(r => setReserve(indiaReserveCoverage(r)))
      .catch(console.error);
    Promise.all([ApiClient.getSupplyChainStatus(), ApiClient.getMarketBalanceTimeseries()])
      .then(([scs, ts]) => {
        setStages(toSupplyChainStages(scs));
        const series = toBalanceSeries(ts, typeof scs?.volume_at_risk_mbd === 'number' ? scs.volume_at_risk_mbd : null);
        if (series.length) setBalance(series);
      })
      .catch(console.error);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      mapPanelRef.current?.requestFullscreen();
    }
  };

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
                <span className={`text-4xl font-light ${
                  (riskEval?.systemic_risk_score ?? 0) > 70 ? 'text-red-400'
                    : (riskEval?.systemic_risk_score ?? 0) > 40 ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}>
                  {riskEval && riskEval.status !== 'data_unavailable' ? Math.round(riskEval.systemic_risk_score) : '--'}
                </span>
                <span className="text-sm font-medium text-slate-500">/100</span>
              </div>
              <span className={`text-sm font-medium ${
                (riskEval?.systemic_risk_score ?? 0) > 70 ? 'text-red-400'
                  : (riskEval?.systemic_risk_score ?? 0) > 40 ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}>
                {riskEval && riskEval.status !== 'data_unavailable'
                  ? (riskEval.systemic_risk_score > 70 ? 'High' : riskEval.systemic_risk_score > 40 ? 'Moderate' : 'Low')
                  : ''}
              </span>
            </div>
              <RiskTrendChart entityId={activeEntityId} />
          </div>
          
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex flex-col gap-2 h-full overflow-y-auto no-scrollbar pb-2">
              {topRisks.map(risk => {
                const severity = risk.index >= 70 ? 'HIGH' : risk.index >= 45 ? 'MEDIUM' : 'LOW';
                const trend = risk.index >= 80 ? 'UP' : risk.index >= 45 ? 'RIGHT' : 'DOWN';
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
            <WatchlistList rows={watchlist} />
          </div>
        </div>
      </div>

      {/* CENTER COLUMN */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        
        {/* KPI ROW */}
        <div className="flex gap-3 min-h-[90px]">
          <KPICard title="SYSTEMIC RISK INDEX" value={overview?.systemic_risk || "--"} max="100" status={overview?.status === "ok" ? (overview.systemic_risk > 70 ? "Elevated" : "Moderate") : "DATA UNAVAILABLE"} statusColor={overview?.systemic_risk > 70 ? "text-red-400" : "text-slate-400"} chartType="up-red" />
          <KPICard title="SUPPLY STRESS LEVEL" value={overview?.supply_stress ? `${overview.supply_stress}%` : "--"} status={overview?.supply_stress > 30 ? "High" : (overview?.supply_stress ? "Moderate" : "DATA UNAVAILABLE")} statusColor="text-amber-400" chartType="up-amber" />
          {reserve ? (
              <KPICard
                title="RESERVE COVERAGE (India)"
                value={reserve.days}
                unit="Days"
                status={reserve.belowTarget ? 'Below Target' : 'On Target'}
                statusColor={reserve.belowTarget ? 'text-red-400' : 'text-emerald-400'}
                chartType="down-red"
              />
            ) : (
              <UnavailableData label="RESERVE COVERAGE" />
            )}
        </div>

        {/* MAIN MAP */}
        <div ref={mapPanelRef} className="flex-1 bg-[#182227] rounded-md border border-slate-700/50 overflow-hidden relative flex flex-col">
          <MapToolbar layers={mapLayers} setLayers={setMapLayers} onFullscreen={toggleFullscreen} disasterSummary={disasterSummary} />

          <div className="relative flex-1 bg-slate-900">
            <MapViewer
              assets={assets}
              routes={routes}
              chokepoints={chokepoints}
              disasters={disasters}
              visibleLayers={mapLayers}
              onFeatureSelect={(feature: SelectedMapFeature) => setSelectedAsset(feature)}
            />
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
              <SupplyChainStatusOverview stages={stages} />
            </div>
          </div>
          
          <div className="flex-[0.45] bg-[#182227] rounded-md border border-slate-700/50 px-3 py-2 flex flex-col justify-center">
            <h3 className="text-[10px] font-black tracking-wider text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] mb-1 uppercase">GLOBAL NEWS FEED</h3>
            <div className="flex-1 overflow-hidden">
              <GlobalNewsFeedHorizontal news={news} />
            </div>
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN */}
      <div className="w-[300px] flex flex-col gap-3 flex-shrink-0 overflow-y-auto no-scrollbar">
        
        {/* PRICING SNAPSHOT */}
        <div className="bg-[#182227] rounded-md h-[120px] p-3 flex flex-col border border-slate-700/50">
          <h3 className="text-[12px] font-black tracking-wider text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] mb-2 uppercase">PRICING SNAPSHOT (USD)</h3>
          {prices ? (
            <div className="flex flex-col gap-1 text-[11px]">
              {prices.map(p => (
                <div key={p.name} className="flex justify-between">
                  <span className="text-slate-200 font-bold">{p.name}</span>
                  <span className="font-mono font-bold text-white">
                    {p.price}
                    {p.change_pct != null && (
                      <span className={`ml-1 ${p.change_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {p.change_pct >= 0 ? '+' : ''}{p.change_pct}%
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ) : <UnavailableData label="" />}
        </div>

        {/* SYSTEM STATUS */}
        <div className="bg-[#182227] rounded-md h-[120px] p-3 flex flex-col border border-slate-700/50">
          <h3 className="text-[12px] font-black tracking-wider text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] mb-2 uppercase">SYSTEM STATUS</h3>
          {categories ? (
            <div className="flex flex-col gap-1 text-[11px] font-bold text-slate-300">
              {categories.slice(0, 4).map(c => {
                const Icon = c.label.startsWith('Geo') ? Globe
                  : c.label.startsWith('Log') ? Package
                  : c.label.startsWith('Sup') ? Database
                  : Activity;
                const color = c.score >= 70 ? 'text-red-400' : c.score >= 45 ? 'text-amber-400' : 'text-emerald-400';
                return (
                  <div key={c.label} className="flex justify-between items-center">
                    <span className="flex items-center gap-2"><Icon size={12} /> {c.label}</span>
                    <span className={`${color} font-mono font-bold`}>{c.score} {c.trend}</span>
                  </div>
                );
              })}
            </div>
          ) : <UnavailableData label="" />}
        </div>

        {/* RISK HEATMAP */}
        <div className="bg-[#182227] rounded-md flex-1 min-h-[190px] p-3 flex flex-col border border-slate-700/50">
          <h3 className="text-[12px] font-black tracking-wider text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] mb-2 uppercase">RISK HEATMAP <span className="normal-case text-slate-400 text-[10px] font-bold">(By Region)</span></h3>
          <div className="relative flex-1 min-h-[120px] rounded overflow-hidden border border-slate-800/60 mb-2">
            <RiskHeatmapMap regionScores={regionScores} />
          </div>
          <div className="flex gap-2 text-[8px] font-bold text-slate-400 justify-center">
            <span className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-sm"></div> Very High</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 bg-amber-500 rounded-sm"></div> High</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500 rounded-sm"></div> Low</span>
          </div>
        </div>

        {/* GLOBAL SUPPLY BALANCE */}
        <div className="bg-[#182227] rounded-md flex-1 min-h-[150px] p-3 flex flex-col border border-slate-700/50">
          <h3 className="text-[12px] font-black tracking-wider text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] mb-2 uppercase">GLOBAL SUPPLY BALANCE <span className="normal-case text-slate-400 text-[10px] font-bold">(Mton)</span></h3>
          <GlobalSupplyBalanceChart data={balance ?? undefined} />
        </div>
        
        <div className="bg-[#182227] rounded-md min-h-[150px] p-3 border border-slate-700/50">
          <SystemHealthComponent />
        </div>

      </div>

    </div>
  );
}

interface RiskItemProps {
  label: string;
  value: string | number;
  trend: 'UP' | 'DOWN' | 'RIGHT' | string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | string;
}

function RiskItem({ label, value, trend, severity }: RiskItemProps) {
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

const STAGE_STYLES: Record<string, { badge: string; text: string; icon: React.ReactNode }> = {
  Stable: { badge: 'bg-emerald-950/40 border-emerald-500/50 text-emerald-500', text: 'text-emerald-500', icon: <Activity size={10} /> },
  Moderate: { badge: 'bg-amber-950/40 border-amber-500/50 text-amber-500', text: 'text-amber-500', icon: <Clock size={10} /> },
  'At Risk': { badge: 'bg-amber-950/40 border-amber-500/50 text-amber-500', text: 'text-amber-500', icon: <TrendingDown size={10} /> },
  Disrupted: { badge: 'bg-red-950/40 border-red-500/50 text-red-500', text: 'text-red-500', icon: <AlertTriangle size={10} /> },
};

// Live route health drives the Transportation / Ports / End Demand nodes; the
// snapshot defaults keep the strip identical when no live status is available.
function SupplyChainStatusOverview({ stages }: { stages: { transportation: StageStatus; ports: StageStatus; demand: StageStatus } | null }) {
  const nodes: { label: string; status: string; icon?: React.ReactNode }[] = [
    { label: 'Production', status: 'Stable' },
    { label: 'Transportation', status: stages?.transportation ?? 'At Risk' },
    { label: 'Ports & Terminals', status: stages ? (stages.ports === 'At Risk' ? 'Disrupted' : stages.ports) : 'Disrupted' },
    { label: 'Refining', status: 'Stable' },
    { label: 'Distribution', status: 'Stable', icon: <Package size={10} /> },
    { label: 'End Demand', status: stages ? (stages.demand === 'At Risk' ? 'Moderate' : 'Stable') : 'Moderate' },
  ];

  return (
    <div className="flex items-center justify-between h-full px-2 w-full">
      {nodes.map((n, i) => {
        const style = STAGE_STYLES[n.status] ?? STAGE_STYLES.Stable;
        return (
          <React.Fragment key={n.label}>
            {i > 0 && <span className="text-slate-500">→</span>}
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${style.badge}`}>
                  {n.icon ?? style.icon}
                </div>
                <span className="text-[11px] text-slate-200 font-bold">{n.label}</span>
              </div>
              <span className={`${style.text} font-bold text-[10px]`}>{n.status}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

const DEFAULT_NEWS = [
  { time: '3h ago', text: 'US increases pressure on Iran on exports with new sanctions.', source: 'Reuters' },
  { time: '3h ago', text: 'Tanker demurrage rates in Red Sea reach 38%.', source: 'Bloomberg' },
  { time: '4h ago', text: 'West Africa ports face severe congestion.', source: 'Platts' },
  { time: '5h ago', text: 'OPEC+ confirms output adjustment in June.', source: 'CNBC' },
  { time: '6h ago', text: 'Asia LNG prices spike amid supply uncertainty.', source: 'Energy Connects' },
];

function GlobalNewsFeedHorizontal({ news: liveNews }: { news?: { time: string; text: string; source: string }[] | null }) {
  const news = liveNews && liveNews.length ? liveNews : DEFAULT_NEWS;
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

const sysRiskData = [20, 25, 22, 30, 28, 35, 40, 32, 45, 50, 48, 55, 60, 58, 65].map((v) => ({ value: v }));
const supplyStressData = [10, 15, 12, 18, 15, 22, 20, 25, 22, 28, 25, 30, 28, 32, 30].map((v) => ({ value: v }));
const reserveCovData = [40, 45, 42, 38, 40, 35, 38, 32, 35, 30, 28, 32, 25, 20, 22].map((v) => ({ value: v }));

function Sparkline({ data, color }: { data: Array<{ value: number }>; color: string }) {
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

interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  status: string;
  statusColor: string;
  max?: string | number;
  chartType?: 'up-red' | 'up-amber' | 'down-red' | string;
}

function KPICard({ title, value, unit, status, statusColor, max, chartType }: KPICardProps) {
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
