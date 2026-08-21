'use client';

import React, { useState } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area, LineChart, Line,
} from 'recharts';
import { Database } from 'lucide-react';
import { DATA_MODE } from '@/lib/config';
import {
  HACKATHON_INGESTION_SOURCES,
  HACKATHON_PIPELINE_OVERVIEW,
  HACKATHON_PIPELINE_HEALTH,
  HACKATHON_FAILURE_BREAKDOWN,
  HACKATHON_INGESTION_VOLUME_24H,
  HACKATHON_DATA_QUALITY,
  HACKATHON_TOP_PIPELINES,
  HACKATHON_PIPELINE_ALERTS,
  HACKATHON_SYSTEM_RESOURCES,
  DemoIngestionSource,
} from '@/data/snapshot';

// ---------------------------------------------------------------------------
// VALUE ARCHITECTURE (project honesty standard, do not weaken):
//   The backend implements NO ingestion or pipeline telemetry. There is no
//   source catalog, no pipeline-run history, no data-quality scoring, and no
//   host metrics (/intelligence/data-sources and every pipeline endpoint 404).
//
//   SNAPSHOT builds  every panel renders the HACKATHON_* demo telemetry from
//                    data/snapshot.ts: an invented, internally consistent ops
//                    story disclosed by the global DEMO DATA badge.
//   LIVE mode        no demo numbers, period. Each panel states its real
//                    availability: amber DATA UNAVAILABLE where an endpoint
//                    is missing, dim NOT MODELED where the concept does not
//                    exist in the backend at all. The page makes no network
//                    calls because there is nothing real to call.
// ---------------------------------------------------------------------------

const IS_DEMO = DATA_MODE === 'HACKATHON_SNAPSHOT';

const fmtRecords = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
};

const SOURCE_STATUS_STYLE: Record<DemoIngestionSource['status'], string> = {
  'OK (Green)': 'text-emerald-500',
  Lagging: 'text-amber-500',
  Error: 'text-red-500',
};

const reliabilityDot = (pct: number): string => {
  if (pct >= 94) return 'bg-emerald-500';
  if (pct >= 80) return 'bg-amber-500';
  return 'bg-red-500';
};

// --------------------------- honest gap states -----------------------------

function BackendUnavailable({ reason }: { reason: string }) {
  return (
    <div className="flex flex-1 min-h-[110px] items-center justify-center rounded bg-amber-950/15 border border-dashed border-amber-800/50 p-4 text-center">
      <div className="flex flex-col items-center">
        <span className="text-amber-400/90 font-bold text-[10px] uppercase tracking-widest mb-1">DATA UNAVAILABLE</span>
        <span className="text-slate-500 text-[9px] max-w-[260px]">{reason}</span>
      </div>
    </div>
  );
}

function NotModeledPanel({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="flex flex-1 min-h-[110px] items-center justify-center rounded bg-slate-900/30 border border-slate-800 p-4 text-center">
      <div className="flex flex-col items-center">
        <span className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mb-1">{title}: Not Modeled</span>
        <span className="text-slate-600 text-[9px] max-w-[300px]">{reason}</span>
      </div>
    </div>
  );
}

function LiveModeNotice() {
  return (
    <div className="flex items-center gap-3 rounded-md border border-dashed border-amber-800/50 bg-amber-950/15 px-4 py-2.5 mb-4">
      <Database size={14} className="text-amber-400/80 flex-shrink-0" />
      <p className="text-[10px] leading-relaxed text-slate-400">
        <span className="font-bold uppercase tracking-widest text-amber-400/90">Live mode</span>
        <span className="mx-2 text-slate-600">|</span>
        The backend implements no ingestion telemetry: no source catalog, pipeline runs, data-quality scoring, or host
        metrics. Each panel below states exactly what is missing. No demo numbers are shown in this mode.
      </p>
    </div>
  );
}

// ------------------------------- panels ------------------------------------

function Panel({ title, suffix, className, children }: {
  title: string; suffix?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={`bg-[#182227] border border-[#233138] rounded-md p-4 flex flex-col ${className ?? ''}`}>
      <h2 className="text-xs font-bold text-slate-300 tracking-wider uppercase mb-3">
        {title} {suffix && <span className="text-slate-500 normal-case font-normal">{suffix}</span>}
      </h2>
      {children}
    </div>
  );
}

function SourceTable() {
  return (
    <>
      <div className="flex text-[10px] text-slate-500 mb-2 px-2">
        <div className="flex-1">Primary Source</div>
        <div className="w-28 text-center">Last Sync (UTC)</div>
        <div className="w-16 text-right">Records/day</div>
        <div className="w-16 text-center">Reliability</div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1">
        {HACKATHON_INGESTION_SOURCES.map((s) => (
          <div key={s.name} className="flex items-center text-[11px] hover:bg-[#233138]/50 py-2 px-2 rounded transition-colors border-b border-[#233138]/50 last:border-0">
            <div className="flex-1 flex flex-col min-w-0">
              <span className="font-semibold text-slate-200 truncate">{s.name}</span>
              <span className={`text-[10px] ${SOURCE_STATUS_STYLE[s.status]} flex items-center gap-1 mt-0.5`}>
                <span className={`w-1.5 h-1.5 rounded-full ${SOURCE_STATUS_STYLE[s.status].replace('text-', 'bg-')}`}></span>
                {s.status}
              </span>
            </div>
            <div className="w-28 text-center text-slate-400 font-mono text-[10px] leading-tight whitespace-pre-line">
              {s.lastSync.replace(' ', '\n')}
            </div>
            <div className="w-16 text-right text-slate-300 font-mono">{s.recordsPerDay ? fmtRecords(s.recordsPerDay) : '0'}</div>
            <div className="w-16 flex items-center justify-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${reliabilityDot(s.reliability)}`}></span>
              <span className="text-slate-300 font-mono">{s.reliability}%</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function KpiStrip() {
  const o = HACKATHON_PIPELINE_OVERVIEW;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      <KpiCard label="Total Pipelines" value={String(o.totalPipelines)} sub="Active" subClass="text-emerald-500" />
      <KpiCard label="Pipeline Success Rate" value={`${o.successRatePct}%`} valueClass="text-emerald-400"
        sub={`${o.succeededLast24h} of ${o.runsLast24h} runs, 24h`} ring={o.successRatePct} />
      <KpiCard label="Avg Ingestion Latency" value={`${o.avgIngestionLatencyMin} min`} sub="24h avg" />
      <KpiCard label="Avg Processing Time" value={`${o.avgProcessingTimeSec} sec`} sub="24h avg" />
      <KpiCard label="Failed Runs" value={String(o.failedRunsLast24h)} valueClass="text-red-500" sub="Last 24h" />
      <KpiCard label="Records Processed" value={fmtRecords(o.recordsProcessedLast24h)} valueClass="text-emerald-400" sub="Last 24h" bars />
    </div>
  );
}

function KpiCard({ label, value, sub, valueClass, subClass, ring, bars }: {
  label: string; value: string; sub: string; valueClass?: string; subClass?: string; ring?: number; bars?: boolean;
}) {
  return (
    <div className="bg-[#1c272c] border border-[#233138] rounded p-3 flex flex-col justify-between min-h-[86px]">
      <span className="text-[10px] text-slate-400">{label}</span>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className={`text-xl font-semibold leading-tight ${valueClass ?? 'text-slate-200'}`}>{value}</div>
          <div className={`text-[10px] ${subClass ?? 'text-slate-500'}`}>{sub}</div>
        </div>
        {ring !== undefined && (
          <svg viewBox="0 0 36 36" className="w-9 h-9 flex-shrink-0">
            <path className="text-[#233138]" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
            <path className="text-emerald-500" strokeDasharray={`${ring}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
          </svg>
        )}
        {bars && (
          <div className="flex items-end gap-0.5 h-6 opacity-70 flex-shrink-0">
            {[4, 7, 5, 8, 6, 9].map((v, i) => <div key={i} className="w-1 bg-emerald-500 rounded-t-sm" style={{ height: `${v * 10}%` }}></div>)}
          </div>
        )}
      </div>
    </div>
  );
}

function IngestionVolumeChart() {
  return (
    <>
      <div className="flex justify-between items-center -mt-1 mb-2">
        <span className="text-[10px] text-slate-500">Records per hour, trailing 24h</span>
        <div className="flex gap-4 text-[10px]">
          <div className="flex items-center gap-1.5"><span className="w-2 h-0.5 bg-emerald-500"></span> Ingested</div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-0.5 bg-blue-500"></span> Processed</div>
        </div>
      </div>
      <div className="flex-1 -ml-4 min-h-[170px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={HACKATHON_INGESTION_VOLUME_24H} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorIng" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorPro" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#233138" vertical={false} />
            <XAxis dataKey="hour" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickMargin={10} minTickGap={24} />
            <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtRecords(v)} />
            <Tooltip
              contentStyle={{ backgroundColor: '#182227', borderColor: '#233138', fontSize: '12px', color: '#cbd5e1' }}
              itemStyle={{ color: '#e2e8f0' }}
              formatter={(value) => (typeof value === 'number' ? fmtRecords(value) : value)}
            />
            <Area type="monotone" dataKey="ingested" name="Ingested" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorIng)" isAnimationActive={false} />
            <Area type="monotone" dataKey="processed" name="Processed" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorPro)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function HealthDonut() {
  const total = HACKATHON_PIPELINE_HEALTH.reduce((sum, d) => sum + d.value, 0);
  return (
    <div className="flex-1 flex items-center justify-between">
      <div className="w-[120px] h-[120px] relative flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={HACKATHON_PIPELINE_HEALTH} cx="50%" cy="50%" innerRadius={40} outerRadius={55} paddingAngle={2} dataKey="value" stroke="none" isAnimationActive={false}>
              {HACKATHON_PIPELINE_HEALTH.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-slate-200">{total}</span>
          <span className="text-[10px] text-slate-500">Total</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 flex-1 ml-4">
        {HACKATHON_PIPELINE_HEALTH.map((d) => (
          <div key={d.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: d.color }}></span>
              <span className="text-slate-400">{d.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-mono">{d.value}</span>
              <span className="text-slate-500 text-[10px] w-10 text-right">({Math.round((d.value / total) * 100)}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FailureBreakdown() {
  return (
    <div className="flex-1 min-h-[140px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={HACKATHON_FAILURE_BREAKDOWN} margin={{ top: 0, right: 20, left: 0, bottom: 0 }} barSize={6}>
          <CartesianGrid strokeDasharray="3 3" stroke="#233138" horizontal={false} />
          <XAxis type="number" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} domain={[0, 3]} tickCount={4} allowDecimals={false} />
          <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} width={100} />
          <Tooltip cursor={{ fill: '#233138' }} contentStyle={{ backgroundColor: '#182227', borderColor: '#233138', fontSize: '12px' }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {HACKATHON_FAILURE_BREAKDOWN.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AlertsTable() {
  return (
    <>
      <div className="flex text-[10px] text-slate-500 mb-2 px-2">
        <div className="w-36">Time (UTC)</div>
        <div className="w-44">Pipeline</div>
        <div className="w-20">Severity</div>
        <div className="w-32">Event</div>
        <div className="flex-1">Details</div>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1">
        {HACKATHON_PIPELINE_ALERTS.map((a, i) => {
          const sevColor = a.severity === 'Critical' ? 'text-red-500' : 'text-amber-500';
          return (
            <div key={i} className="flex items-center text-[11px] py-1.5 px-2 hover:bg-[#233138]/50 rounded transition-colors border-b border-[#233138]/50 last:border-0">
              <div className="w-36 text-slate-400 font-mono text-[10px]">{a.time}</div>
              <div className="w-44 text-slate-300 truncate pr-2">{a.pipeline}</div>
              <div className={`w-20 flex items-center gap-1.5 ${sevColor}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${sevColor.replace('text-', 'bg-')}`}></span>
                {a.severity}
              </div>
              <div className="w-32 text-slate-300 truncate pr-2">{a.event}</div>
              <div className="flex-1 text-slate-400 truncate pr-2" title={a.details}>{a.details}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function QualityGauge() {
  const q = HACKATHON_DATA_QUALITY;
  return (
    <div className="flex-1 flex flex-col items-center justify-center">
      <div className="relative w-44 h-[88px] overflow-hidden mb-1">
        <svg viewBox="0 0 100 50" className="w-full h-full">
          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#233138" strokeWidth="12" strokeLinecap="round" />
          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#10b981" strokeWidth="12" strokeLinecap="round" pathLength="100" strokeDasharray={`${q.score} 100`} />
        </svg>
        <div className="absolute bottom-0 inset-x-0 flex flex-col items-center justify-end">
          <div className="text-3xl font-bold text-white flex items-baseline gap-1">
            {q.score}<span className="text-sm text-slate-400 font-normal">/100</span>
          </div>
          <div className="text-emerald-500 font-medium text-xs">{q.band} (70-89)</div>
        </div>
      </div>
      <div className="w-full space-y-2 mt-4 px-1">
        {q.components.map((c) => (
          <div key={c.name} className="flex items-center text-[11px]">
            <span className="w-24 text-slate-400">{c.name}</span>
            <div className="flex-1 h-1.5 bg-[#233138] rounded overflow-hidden mr-2">
              <div className={`h-full rounded ${c.value >= 90 ? 'bg-emerald-500' : c.value >= 80 ? 'bg-emerald-400' : 'bg-amber-500'}`} style={{ width: `${c.value}%` }}></div>
            </div>
            <span className="w-7 text-right text-slate-300 font-mono">{c.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopPipelines() {
  const max = Math.max(...HACKATHON_TOP_PIPELINES.map((p) => p.volume));
  return (
    <div className="flex-1 flex flex-col justify-center space-y-4">
      {HACKATHON_TOP_PIPELINES.map((p, i) => (
        <div key={p.name} className="flex items-center text-xs">
          <div className="w-4 text-slate-500">{i + 1}</div>
          <div className="w-36 text-slate-300 truncate pr-1" title={p.name}>{p.name}</div>
          <div className="flex-1 ml-1 flex items-center">
            <div className="h-2 rounded bg-emerald-500 mr-2" style={{ width: `${(p.volume / max) * 100}%` }}></div>
            <div className="text-slate-400 text-[10px] w-12 text-right font-mono">{fmtRecords(p.volume)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SystemResources() {
  return (
    <div className="flex justify-between items-end flex-1 pb-1">
      {HACKATHON_SYSTEM_RESOURCES.map((r, idx) => (
        <div key={r.name} className={`flex flex-col items-center flex-1 ${idx === 1 ? 'border-x border-[#233138]/50' : ''}`}>
          <span className="text-[10px] text-slate-400 mb-2">{r.name}</span>
          <div className="relative w-14 h-14 mb-2">
            <svg viewBox="0 0 36 36" className="w-full h-full">
              <path className="text-[#233138]" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
              <path className="text-emerald-500" strokeDasharray={`${r.pct}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-200">{r.pct}%</div>
          </div>
          <div className="h-4 w-full px-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={r.spark.map((value) => ({ value }))}>
                <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={1} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}

// --------------------------------- page ------------------------------------

export default function DataIntelligencePage() {
  const [tab, setTab] = useState<'sources' | 'datamart'>('sources');

  return (
    <div className="flex flex-col min-h-full bg-[#0f181b] text-slate-300 p-4 font-sans">

      {/* Sub header: tabs + system toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-4 border-b border-[#233138] w-full pb-1">
          <button
            onClick={() => setTab('sources')}
            className={`px-4 py-2 text-sm font-semibold mb-[-5px] ${tab === 'sources' ? 'text-white border-b-2 border-emerald-500' : 'text-slate-400 hover:text-slate-300'}`}
          >
            Data Source
          </button>
          <button
            onClick={() => setTab('datamart')}
            className={`px-4 py-2 text-sm font-semibold mb-[-5px] ${tab === 'datamart' ? 'text-white border-b-2 border-emerald-500' : 'text-slate-400 hover:text-slate-300'}`}
          >
            Datamart Status
          </button>
        </div>
        <button className="ml-4 flex-shrink-0 bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 px-4 py-1.5 text-xs font-bold rounded flex items-center gap-2 hover:bg-emerald-600/30 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
          SYSTEM
        </button>
      </div>

      {!IS_DEMO && <LiveModeNotice />}

      {tab === 'datamart' ? (
        <div className="flex-1 flex">
          <NotModeledPanel
            title="Datamart Status"
            reason="The backend has no datamart or warehouse layer; there are no tables, refresh jobs, or freshness contracts to report on in any mode."
          />
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4 flex-1">

          {/* Left: source catalog */}
          <div className="col-span-12 xl:col-span-3 flex flex-col gap-4">
            <Panel title="Source Management & Ingestion Status" className="flex-1 overflow-hidden">
              {IS_DEMO ? <SourceTable /> : (
                <BackendUnavailable reason="The API has no source-catalog or ingestion-status endpoint (/intelligence/data-sources is not implemented)." />
              )}
            </Panel>
          </div>

          {/* Center: pipeline & processing */}
          <div className="col-span-12 xl:col-span-6 flex flex-col gap-4">
            <Panel title="Pipeline & Processing Overview">
              {IS_DEMO ? <KpiStrip /> : (
                <BackendUnavailable reason="No pipeline registry or run history exists in the backend; counts, success rates, and latency cannot be measured." />
              )}
            </Panel>

            <Panel title="Ingestion Volume" suffix="(Records)" className="relative min-h-[230px] flex-1">
              {IS_DEMO ? <IngestionVolumeChart /> : (
                <BackendUnavailable reason="No ingestion metering exists; per-hour record counts are not recorded anywhere." />
              )}
            </Panel>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Panel title="Pipeline Health Distribution">
                {IS_DEMO ? <HealthDonut /> : (
                  <BackendUnavailable reason="No pipeline registry exists to report health from." />
                )}
              </Panel>
              <Panel title="Failure Breakdown" suffix="(Last 24h)">
                {IS_DEMO ? <FailureBreakdown /> : (
                  <BackendUnavailable reason="No run history exists to classify failures from." />
                )}
              </Panel>
            </div>

            <Panel title="Recent Pipeline Alerts & Events" className="flex-1 overflow-hidden min-h-[160px]">
              {IS_DEMO ? <AlertsTable /> : (
                <BackendUnavailable reason="No alerting or event stream exists for the ingestion layer." />
              )}
            </Panel>
          </div>

          {/* Right: quality, top pipelines, resources */}
          <div className="col-span-12 xl:col-span-3 flex flex-col gap-4">
            <Panel title="Data Quality Score" className="min-h-[260px]">
              {IS_DEMO ? <QualityGauge /> : (
                <BackendUnavailable reason="No data-quality scoring service exists; completeness, validity, freshness, and consistency are not computed." />
              )}
            </Panel>

            <Panel title="Top Pipelines by Volume" suffix="(Last 24h)" className="flex-1 min-h-[210px]">
              {IS_DEMO ? <TopPipelines /> : (
                <BackendUnavailable reason="No per-pipeline throughput is recorded." />
              )}
            </Panel>

            <Panel title="System Resources" suffix={IS_DEMO ? '(Demo)' : undefined} className="min-h-[180px]">
              {IS_DEMO ? <SystemResources /> : (
                <NotModeledPanel title="Host Metrics" reason="The backend exposes no CPU, memory, or disk telemetry." />
              )}
            </Panel>
          </div>

        </div>
      )}
    </div>
  );
}
