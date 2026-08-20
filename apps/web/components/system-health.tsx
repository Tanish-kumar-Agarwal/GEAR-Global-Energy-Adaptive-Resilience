'use client';
import { useEffect, useState } from 'react';

export function SystemHealthComponent() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:8000/api/v1/health/components')
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-xs text-slate-500 p-3">Loading health...</div>;
  if (!data || !data.components) return <div className="text-xs text-slate-500 italic p-3">HEALTH DATA UNAVAILABLE</div>;

  const comps = data.components;
  const getStatusColor = (status: string) => {
    if (status === 'healthy') return 'text-emerald-400';
    if (status === 'degraded') return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="flex flex-col gap-2 p-3 text-[10px] text-slate-300 h-full">
      <h3 className="font-bold tracking-wider text-slate-400 uppercase border-b border-slate-700 pb-1 mb-1">System Health</h3>
      <div className="flex justify-between">
        <span>API</span>
        <span className="text-emerald-400 font-mono">HEALTHY</span>
      </div>
      <div className="flex justify-between">
        <span>POSTGRESQL</span>
        <span className={`font-mono uppercase ${getStatusColor(comps.postgresql)}`}>{comps.postgresql || 'UNAVAILABLE'}</span>
      </div>
      <div className="flex justify-between">
        <span>NEO4J</span>
        <span className={`font-mono uppercase ${getStatusColor(comps.neo4j)}`}>{comps.neo4j || 'UNAVAILABLE'}</span>
      </div>
      <div className="flex justify-between">
        <span>REDIS</span>
        <span className={`font-mono uppercase ${getStatusColor(comps.redis)}`}>{comps.redis || 'UNAVAILABLE'}</span>
      </div>
      <div className="flex justify-between">
        <span>CELERY</span>
        <span className={`font-mono uppercase ${getStatusColor(comps.celery)}`}>{comps.celery || 'UNAVAILABLE'}</span>
      </div>
    </div>
  );
}
