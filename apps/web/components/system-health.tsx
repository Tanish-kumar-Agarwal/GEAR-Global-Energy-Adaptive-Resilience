'use client';
import { useEffect, useState } from 'react';
import { DATA_MODE } from '@/lib/config';
import { HACKATHON_SYSTEM_HEALTH } from '@/data/snapshot';

interface HealthData {
  components?: Record<string, string>;
}

export function SystemHealthComponent() {
  const [data, setData] = useState<HealthData | null>(DATA_MODE === 'HACKATHON_SNAPSHOT' ? HACKATHON_SYSTEM_HEALTH : null);
  const [loading, setLoading] = useState(DATA_MODE !== 'HACKATHON_SNAPSHOT');

  useEffect(() => {
    if (DATA_MODE === 'HACKATHON_SNAPSHOT') return;
    // Deliberately NOT going through ApiClient: its snapshot fallback would
    // report a healthy stack while the backend is down, which is exactly what
    // a health panel must not do.
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    fetch(`${base}/health/components`)
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
    <div className="flex flex-col gap-2 p-1 text-[11px] text-slate-300 h-full">
      <h3 className="text-[12px] font-black tracking-wider text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] uppercase border-b border-slate-700/50 pb-2 mb-1">SYSTEM HEALTH</h3>
      <div className="flex justify-between items-center">
        <span className="font-bold">API</span>
        <span className="text-emerald-400 font-mono font-bold text-[10px]">HEALTHY</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="font-bold">POSTGRESQL</span>
        <span className={`font-mono font-bold text-[10px] uppercase ${getStatusColor(comps.postgresql)}`}>{comps.postgresql || 'UNAVAILABLE'}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="font-bold">NEO4J</span>
        <span className={`font-mono font-bold text-[10px] uppercase ${getStatusColor(comps.neo4j)}`}>{comps.neo4j || 'UNAVAILABLE'}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="font-bold">REDIS</span>
        <span className={`font-mono font-bold text-[10px] uppercase ${getStatusColor(comps.redis)}`}>{comps.redis || 'UNAVAILABLE'}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="font-bold">CELERY</span>
        <span className={`font-mono font-bold text-[10px] uppercase ${getStatusColor(comps.celery)}`}>{comps.celery || 'UNAVAILABLE'}</span>
      </div>
    </div>
  );
}
