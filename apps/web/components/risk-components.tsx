import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import { ApiClient } from '@/lib/api';
import { 
  RiskTrendPoint, 
  RiskExposureResponse, 
  IntelligenceEvent, 
  RiskEvaluationResponse,
  ExplainabilityResponse
} from '@/types';
import { DATA_MODE } from '@/lib/config';
import { HACKATHON_EXPOSURES, HACKATHON_SUPPLY_BALANCE } from '@/data/snapshot';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

export function RiskTrendChart({ entityId }: { entityId?: string }) {
  const [data, setData] = useState<RiskTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ApiClient.getRiskTrend(entityId)
      .then(json => {
        if (json.status === 'data_unavailable') {
          setData([]);
        } else if (json.data) {
          setData(json.data);
        }
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setError('Failed to load risk trend');
        setLoading(false);
      });
  }, [entityId]);

  if (loading) return <div className="animate-pulse bg-slate-800 h-full w-full rounded"></div>;
  if (error) return <div className="text-[10px] text-red-400 flex items-center h-full justify-center">{error}</div>;
  if (data.length === 0) return <div className="text-[10px] text-slate-500 flex items-center h-full justify-center">DATA UNAVAILABLE</div>;

  // Simple sparkline render
  const maxScore = Math.max(...data.map(d => d.score), 100);
  const minScore = Math.min(...data.map(d => d.score), 0);
  
  return (
    <div className="flex h-full w-full items-end gap-[2px]">
      {data.slice(-20).map((pt, i) => {
        const heightPct = Math.max(10, ((pt.score - minScore) / (maxScore - minScore)) * 100);
        const color = pt.level === 'CRITICAL' ? 'bg-red-500' : pt.level === 'HIGH' ? 'bg-amber-500' : 'bg-emerald-500';
        return (
          <div 
            key={i} 
            className={`flex-1 ${color} opacity-80 hover:opacity-100 rounded-t-sm`} 
            style={{ height: `${heightPct}%` }}
            title={`${new Date(pt.timestamp).toLocaleDateString()}: ${pt.score.toFixed(1)}`}
          />
        );
      })}
    </div>
  );
}

export function RiskExposures({ entityId }: { entityId: string }) {
  const [data, setData] = useState<RiskExposureResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ApiClient.getRiskExposures(entityId)
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setError('Failed to load exposures');
        setLoading(false);
      });
  }, [entityId]);

  if (loading) return <div className="animate-pulse text-xs text-slate-500">Loading exposures...</div>;
  if (error) return <div className="text-xs text-red-400">{error}</div>;

  if (DATA_MODE === 'HACKATHON_SNAPSHOT') {
    return (
      <div className="flex h-full w-full items-center">
        <div className="w-1/2 h-full min-h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={HACKATHON_EXPOSURES}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={50}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {HACKATHON_EXPOSURES.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{backgroundColor: '#0f172a', border: '1px solid #1e293b', fontSize: '10px'}} 
                itemStyle={{color: '#e2e8f0'}}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-1/2 flex flex-col gap-2 pl-2 justify-center">
          {HACKATHON_EXPOSURES.map(e => (
            <div key={e.name} className="flex items-center text-[11px] font-bold tracking-wide text-slate-200">
              <div className="w-2.5 h-2.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: e.fill }} />
              <span className="truncate flex-1">{e.name}</span>
              <span className="font-mono font-bold text-white ml-1">{e.value}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.status === 'data_unavailable') return <div className="text-xs text-slate-500">DATA UNAVAILABLE</div>;

  return (
    <div className="flex flex-col gap-2 overflow-y-auto h-full pr-2 text-xs text-slate-300">
      {data.dependent_countries && data.dependent_countries.length > 0 && (
        <div>
          <span className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Dependent Countries</span>
          <div className="flex flex-wrap gap-1">
            {data.dependent_countries.map((c: any) => (
              <span key={c.id} className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-[10px]">{c.name}</span>
            ))}
          </div>
        </div>
      )}
      
      {data.exposed_suppliers && data.exposed_suppliers.length > 0 && (
        <div className="mt-2">
          <span className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Exposed Suppliers</span>
          <div className="flex flex-wrap gap-1">
            {data.exposed_suppliers.map((c: any) => (
              <span key={c.id} className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-[10px]">{c.name}</span>
            ))}
          </div>
        </div>
      )}
      
      {data.routes_affected && data.routes_affected.length > 0 && (
        <div className="mt-2">
          <span className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Routes Affected</span>
          <div className="flex flex-wrap gap-1">
            {data.routes_affected.map((c: any) => (
              <span key={c.id} className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-[10px] text-amber-200">{c.name}</span>
            ))}
          </div>
        </div>
      )}
      
      {data.downstream_assets && data.downstream_assets.length > 0 && (
        <div className="mt-2">
          <span className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Downstream Assets</span>
          <div className="flex flex-wrap gap-1">
            {data.downstream_assets.map((c: any) => (
              <span key={c.id} className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-[10px] text-emerald-200">{c.name}</span>
            ))}
          </div>
        </div>
      )}
      
      {(!data.dependent_countries?.length && !data.exposed_suppliers?.length && !data.routes_affected?.length && !data.downstream_assets?.length) && (
         <div className="text-[10px] text-slate-500 italic">No exposures found in graph projection.</div>
      )}
    </div>
  );
}

export function ActiveEventsList() {
  const [data, setData] = useState<IntelligenceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ApiClient.getIntelligenceEvents(5)
      .then(json => {
        if (json.status === 'data_unavailable') {
          setData([]);
        } else if (json.data) {
          setData(json.data);
        }
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setError('Failed to load events');
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="animate-pulse text-xs text-slate-500">Loading events...</div>;
  if (error) return <div className="text-xs text-red-400">{error}</div>;
  if (data.length === 0) return <div className="text-xs text-slate-500 italic">DATA UNAVAILABLE</div>;

  return (
    <div className="flex flex-col gap-2">
      {data.map((ev) => (
        <div key={ev.id} className="text-[10px] text-slate-300 border-b border-slate-800/50 pb-2">
          <div className="flex items-center gap-1 mb-1">
            <AlertTriangle size={10} className={ev.severity > 0.7 ? "text-red-500" : "text-amber-500"} />
            <span className="font-bold">{ev.title}</span>
          </div>
          <div className="flex justify-between items-center opacity-70">
            <span>{ev.type} • Conf: {(ev.confidence * 100).toFixed(0)}%</span>
            <span>{new Date(ev.timestamp).toLocaleDateString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function IntelligenceExplainability() {
  const [data, setData] = useState<ExplainabilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // In a real app we'd get the risk ID from the recommendation/decision context. 
    // Here we query for explainability for a 'temp' risk, but since our backend now supports explainability natively without failing,
    // we just use a default ID. (Note: the backend explainability route uses Neo4j path finding).
    ApiClient.getIntelligenceExplainability('CHK_HORMUZ')
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setError('Failed to load explainability');
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="animate-pulse text-xs text-slate-500">Loading evidence...</div>;
  if (error) return <div className="text-xs text-red-400">{error}</div>;
  if (!data || data.status === "data_unavailable") return <div className="text-xs text-slate-500 italic">DATA UNAVAILABLE</div>;

  return (
    <div className="flex flex-col gap-3 overflow-y-auto h-full pr-2">
      <div className="text-[10px] text-slate-400 border-b border-slate-700/50 pb-2">
        <span className="font-bold uppercase text-slate-300">Deterministic Model Explanation</span>
        <br/>
        This recommendation was driven by documented factual intelligence and systemic risk factors.
      </div>
      
      {data.primary_drivers && data.primary_drivers.map((driver, idx) => (
        <div key={idx} className="bg-slate-800/50 p-2 rounded border border-slate-700/50">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert size={10} className="text-amber-400" />
            <span className="text-[10px] font-bold text-slate-200">Systemic Driver</span>
          </div>
          <div className="text-[9px] text-slate-400 ml-4">
             {driver}
          </div>
        </div>
      ))}

      {data.contributing_events && data.contributing_events.map((ev: IntelligenceEvent, idx: number) => (
        <div key={idx} className="bg-slate-800/50 p-2 rounded border border-slate-700/50">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle size={10} className="text-blue-400" />
            <span className="text-[10px] font-bold text-slate-200">Fact: {ev.title}</span>
          </div>
          <div className="flex justify-between text-[9px] text-slate-400 ml-4">
             <span>Severity: {(ev.severity * 100).toFixed(0)}%</span>
             <span>Confidence: {(ev.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RiskEvaluationSummary() {
  const [data, setData] = useState<RiskEvaluationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ApiClient.getRiskEvaluation()
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setError('Failed to load evaluation');
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="animate-pulse text-xs text-slate-500">Loading evaluation...</div>;
  if (error) return <div className="text-xs text-red-400">{error}</div>;
  if (!data || data.status === "data_unavailable") return <div className="text-xs text-slate-500 italic">DATA UNAVAILABLE</div>;

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex justify-between items-end border-b border-slate-700/50 pb-2">
         <span className="text-xs text-slate-400">Systemic Risk Score</span>
         <span className="text-2xl font-light text-slate-200">{data.systemic_risk_score.toFixed(1)}</span>
      </div>
      
      <div className="flex justify-between items-center text-xs">
         <span className="text-slate-400">Active Critical Risks</span>
         <span className="font-mono text-red-400">{data.active_critical_risks}</span>
      </div>
      
      <div className="flex justify-between items-center text-xs">
         <span className="text-slate-400">Active High Risks</span>
         <span className="font-mono text-amber-400">{data.active_high_risks}</span>
      </div>
      
      <div className="flex justify-between items-center text-xs">
         <span className="text-slate-400">Total Intel Events</span>
         <span className="font-mono text-blue-400">{data.event_count}</span>
      </div>
      
      {data.highest_severity_event && (
        <div className="mt-auto bg-amber-900/20 border border-amber-800/50 p-2 rounded text-[10px] text-amber-200">
           Most severe active event: <span className="font-bold">{data.highest_severity_event}</span>
        </div>
      )}
    </div>
  );
}

export function GlobalSupplyBalanceChart() {
  return (
    <div className="w-full h-full min-h-[100px] pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={HACKATHON_SUPPLY_BALANCE} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis 
            dataKey="date" 
            stroke="#64748b" 
            fontSize={9} 
            tickLine={false} 
            axisLine={false}
            tick={{ fill: '#94a3b8' }}
          />
          <YAxis 
            stroke="#64748b" 
            fontSize={9} 
            tickLine={false} 
            axisLine={false}
            ticks={[0, 50, 100, 120]}
            domain={[0, 120]}
            tick={{ fill: '#94a3b8' }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', fontSize: '10px' }}
            itemStyle={{ color: '#e2e8f0' }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Legend 
            wrapperStyle={{ fontSize: '10px', paddingTop: '5px' }}
            iconType="plainline"
            iconSize={12}
          />
          <Line type="monotone" dataKey="Supply" stroke="#22c55e" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Demand" stroke="#3b82f6" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="AtRisk" name="At Risk" stroke="#ef4444" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
