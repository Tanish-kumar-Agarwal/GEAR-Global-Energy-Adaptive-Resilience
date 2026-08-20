'use client';

import React from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar, Label, AreaChart, Area 
} from 'recharts';
import { CheckCircle2, AlertTriangle, XCircle, Clock, Server, Cpu, HardDrive } from 'lucide-react';

const sourcesData = [
  { name: 'EIA', status: 'OK (Green)', statusColor: 'text-emerald-500', sync: 'Last Sync', time: '2021-07-13 19:39:56', records: '2.34M', rel: '95%', relColor: 'bg-emerald-500' },
  { name: 'GEM', status: 'OK (Green)', statusColor: 'text-emerald-500', sync: 'Last Sync', time: '2021-07-13 19:29:53', records: '1.91M', rel: '95%', relColor: 'bg-emerald-500' },
  { name: 'ACLED', status: 'Lagging', statusColor: 'text-amber-500', sync: 'Last Sync', time: '2021-07-21 23:27:17', records: '528K', rel: '86%', relColor: 'bg-amber-500' },
  { name: 'GDELT', status: 'OK (Green)', statusColor: 'text-emerald-500', sync: 'Last Sync', time: '2021-07-17 23:29:19', records: '3.29M', rel: '86%', relColor: 'bg-emerald-500' },
  { name: 'Open-Meteo', status: 'OK (Green)', statusColor: 'text-emerald-500', sync: 'Last Sync', time: '2021-07-17 20:35:17', records: '1.02M', rel: '86%', relColor: 'bg-emerald-500' },
  { name: 'IEA (Baseline)', status: 'OK (Green)', statusColor: 'text-emerald-500', sync: 'Last Sync', time: '2021-07-19 11:30:08', records: '1.98M', rel: '86%', relColor: 'bg-emerald-500' },
  { name: 'Comtrade', status: 'Lagging', statusColor: 'text-amber-500', sync: 'Last Sync', time: '2021-07-13 11:34:12', records: '615K', rel: '86%', relColor: 'bg-amber-500' },
  { name: 'World Bank', status: 'Error', statusColor: 'text-red-500', sync: 'Last Sync', time: '2021-07-18 22:23:35', records: '0', rel: '86%', relColor: 'bg-red-500' },
];

const ingestionData = Array.from({ length: 24 }).map((_, i) => ({
  time: `${i.toString().padStart(2, '0')}:00`,
  ingested: 500000 + Math.random() * 1500000 + (Math.sin(i / 3) * 500000),
  processed: 450000 + Math.random() * 1400000 + (Math.sin(i / 3) * 450000),
}));

const healthData = [
  { name: 'Healthy', value: 19, color: '#10b981' },
  { name: 'Warning', value: 3, color: '#f59e0b' },
  { name: 'Critical', value: 2, color: '#ef4444' },
];

const failureData = [
  { name: 'Source Timeout', value: 2, fill: '#ef4444' },
  { name: 'Data Validation', value: 1, fill: '#f59e0b' },
  { name: 'Processing Error', value: 1, fill: '#f59e0b' },
];

const topPipelines = [
  { name: 'EIA Pipeline', value: 2.84 },
  { name: 'GDELT Pipeline', value: 2.31 },
  { name: 'Open-Meteo Pipeline', value: 1.92 },
  { name: 'IEA Pipeline', value: 1.78 },
  { name: 'GEM Pipeline', value: 1.14 },
];

const alertsData = [
  { time: '2021-07-21 23:27:17', pipeline: 'ACLED Pipeline', severity: 'Warning', sevColor: 'text-amber-500', event: 'Data Delayed', details: 'Ingestion behind schedule by 45m' },
  { time: '2021-07-21 20:35:17', pipeline: 'Open-Meteo Pipeline', severity: 'Warning', sevColor: 'text-amber-500', event: 'High Latency', details: 'Processing time above threshold' },
  { time: '2021-07-18 22:23:35', pipeline: 'World Bank Pipeline', severity: 'Critical', sevColor: 'text-red-500', event: 'Connection Failed', details: 'Unable to fetch data from source' },
];

const sparklineData = Array.from({ length: 15 }).map(() => ({ value: Math.random() * 100 }));

export default function DataIntelligencePage() {
  return (
    <div className="flex flex-col min-h-full bg-[#0f181b] text-slate-300 p-4 font-sans">
      
      {/* Sub Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-4 border-b border-[#233138] w-full pb-1">
          <button className="px-4 py-2 text-sm font-semibold text-white border-b-2 border-emerald-500 mb-[-5px]">Data Source</button>
          <button className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-slate-300">Datamart Status</button>
        </div>
        <button className="ml-4 flex-shrink-0 bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 px-4 py-1.5 text-xs font-bold rounded flex items-center gap-2 hover:bg-emerald-600/30 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
          SYSTEM
        </button>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-12 gap-4 flex-1">
        
        {/* Left Column: Source Management */}
        <div className="col-span-12 xl:col-span-3 flex flex-col gap-4">
          <div className="bg-[#182227] border border-[#233138] rounded-md p-4 flex-1 flex flex-col overflow-hidden">
            <h2 className="text-xs font-bold text-slate-300 tracking-wider mb-4 uppercase">Source Management & Ingestion Status</h2>
            
            <div className="flex text-[10px] text-slate-500 mb-2 px-2">
              <div className="flex-1">Primary Source</div>
              <div className="w-20 text-center">Connection</div>
              <div className="w-24 text-center">Last Sync</div>
              <div className="w-16 text-right">Data Ingested<br/>Records/day</div>
              <div className="w-16 text-center">Source<br/>Reliability</div>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-1 space-y-1 custom-scrollbar">
              {sourcesData.map((s, i) => (
                <div key={i} className="flex items-center text-[11px] hover:bg-[#233138]/50 py-2 px-2 rounded transition-colors border-b border-[#233138]/50 last:border-0">
                  <div className="flex-1 flex flex-col">
                    <span className="font-semibold text-slate-200">{s.name}</span>
                    <span className={`text-[10px] ${s.statusColor} flex items-center gap-1 mt-0.5`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.statusColor.replace('text-', 'bg-')}`}></span>
                      {s.status}
                    </span>
                  </div>
                  <div className="w-20 text-center text-slate-400">{s.sync}</div>
                  <div className="w-24 text-center text-slate-400 font-mono text-[10px]">{s.time.replace(' ', '\n')}</div>
                  <div className="w-16 text-right text-slate-300">{s.records}</div>
                  <div className="w-16 flex items-center justify-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${s.relColor}`}></span>
                    <span className="text-slate-300">{s.rel}</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center text-[11px] py-2 px-2">
                <div className="bg-[#233138] rounded px-2 py-1 text-slate-400 flex items-center gap-1 cursor-pointer hover:bg-slate-700">
                  <span>+</span> etc.
                </div>
                <div className="flex-1 text-center text-slate-600">—</div>
                <div className="flex-1 text-center text-slate-600">—</div>
                <div className="flex-1 text-center text-slate-600">—</div>
              </div>
            </div>
          </div>
        </div>

        {/* Center Column: Pipeline & Processing */}
        <div className="col-span-12 xl:col-span-6 flex flex-col gap-4">
          
          {/* Top KPIs */}
          <div className="bg-[#182227] border border-[#233138] rounded-md p-4">
             <h2 className="text-xs font-bold text-slate-300 tracking-wider mb-3 uppercase">Pipeline & Processing Overview</h2>
             <div className="grid grid-cols-5 gap-3">
                <div className="bg-[#1c272c] border border-[#233138] rounded p-3 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-400">Total Pipelines</span>
                  <div>
                    <div className="text-2xl font-semibold text-slate-200">24</div>
                    <div className="text-xs text-emerald-500">Active</div>
                  </div>
                </div>
                <div className="bg-[#1c272c] border border-[#233138] rounded p-3 flex flex-col justify-between relative overflow-hidden">
                  <span className="text-[10px] text-slate-400">Pipeline Success Rate</span>
                  <div className="flex items-end justify-between z-10 relative">
                    <div className="w-10 h-10 border-4 border-emerald-500 rounded-full border-r-emerald-900/30"></div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-emerald-400">98.6%</div>
                      <div className="text-[10px] text-slate-500">24h avg</div>
                    </div>
                  </div>
                </div>
                <div className="bg-[#1c272c] border border-[#233138] rounded p-3 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-400">Avg. Ingestion Latency</span>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-lg font-semibold text-emerald-400">12.4 min</div>
                      <div className="text-[10px] text-slate-500">24h avg</div>
                    </div>
                  </div>
                  <div className="h-6 w-full mt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sparklineData}>
                        <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-[#1c272c] border border-[#233138] rounded p-3 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-400">Avg. Processing Time</span>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-lg font-semibold text-emerald-400">18.7 sec</div>
                      <div className="text-[10px] text-slate-500">24h avg</div>
                    </div>
                  </div>
                  <div className="h-6 w-full mt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sparklineData}>
                        <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-[#1c272c] border border-[#233138] rounded p-3 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-400">Failed Pipelines</span>
                  <div>
                    <div className="text-2xl font-semibold text-red-500">3</div>
                    <div className="text-xs text-slate-500">Last 24h</div>
                  </div>
                </div>
                <div className="bg-[#1c272c] border border-[#233138] rounded p-3 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-400">Records Processed</span>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-lg font-semibold text-emerald-400">12.84M</div>
                      <div className="text-[10px] text-slate-500">Last 24h</div>
                    </div>
                    <div className="flex items-end gap-0.5 h-6 opacity-70">
                      {[4,7,5,8,6,9].map((v,i) => <div key={i} className="w-1 bg-emerald-500 rounded-t-sm" style={{height: `${v*10}%`}}></div>)}
                    </div>
                  </div>
                </div>
             </div>
          </div>

          {/* Ingestion Volume */}
          <div className="bg-[#182227] border border-[#233138] rounded-md p-4 relative flex flex-col min-h-[220px]">
             <div className="flex justify-between items-center mb-4">
               <h2 className="text-xs font-bold text-slate-300 tracking-wider uppercase">Ingestion Volume (Records)</h2>
               <div className="flex gap-4 text-[10px]">
                 <div className="flex items-center gap-1.5"><span className="w-2 h-0.5 bg-emerald-500"></span> Ingested</div>
                 <div className="flex items-center gap-1.5"><span className="w-2 h-0.5 bg-blue-500"></span> Processed</div>
               </div>
             </div>
             <div className="flex-1 -ml-4">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ingestionData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorIng" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorPro" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#233138" vertical={false} />
                    <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickMargin={10} minTickGap={30} />
                    <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000000).toFixed(1)}M`} />
                    <Tooltip contentStyle={{ backgroundColor: '#182227', borderColor: '#233138', fontSize: '12px', color: '#cbd5e1' }} itemStyle={{ color: '#e2e8f0' }}/>
                    <Area type="monotone" dataKey="ingested" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorIng)" />
                    <Area type="monotone" dataKey="processed" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorPro)" />
                  </AreaChart>
               </ResponsiveContainer>
             </div>
          </div>

          {/* Middle row split */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#182227] border border-[#233138] rounded-md p-4 flex flex-col">
               <h2 className="text-xs font-bold text-slate-300 tracking-wider mb-2 uppercase">Pipeline Health Distribution</h2>
               <div className="flex-1 flex items-center justify-between">
                 <div className="w-[120px] h-[120px] relative">
                   <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                       <Pie data={healthData} cx="50%" cy="50%" innerRadius={40} outerRadius={55} paddingAngle={2} dataKey="value" stroke="none">
                         {healthData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                       </Pie>
                     </PieChart>
                   </ResponsiveContainer>
                   <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <span className="text-xl font-bold text-slate-200">24</span>
                     <span className="text-[10px] text-slate-500">Total</span>
                   </div>
                 </div>
                 <div className="flex flex-col gap-2 flex-1 ml-4">
                   {healthData.map((d, i) => (
                     <div key={i} className="flex items-center justify-between text-xs">
                       <div className="flex items-center gap-2">
                         <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: d.color }}></span>
                         <span className="text-slate-400">{d.name}</span>
                       </div>
                       <div className="flex items-center gap-2">
                         <span className="text-slate-300">{d.value}</span>
                         <span className="text-slate-500 text-[10px] w-8 text-right">({Math.round((d.value/24)*100)}%)</span>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
            </div>
            <div className="bg-[#182227] border border-[#233138] rounded-md p-4 flex flex-col">
               <h2 className="text-xs font-bold text-slate-300 tracking-wider mb-4 uppercase">Failure Breakdown <span className="text-slate-500 normal-case">(Last 24h)</span></h2>
               <div className="flex-1">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart layout="vertical" data={failureData} margin={{ top: 0, right: 20, left: 0, bottom: 0 }} barSize={6}>
                     <CartesianGrid strokeDasharray="3 3" stroke="#233138" horizontal={false} />
                     <XAxis type="number" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} domain={[0, 3]} tickCount={4} />
                     <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} width={100} />
                     <Tooltip cursor={{fill: '#233138'}} contentStyle={{ backgroundColor: '#182227', borderColor: '#233138', fontSize: '12px' }}/>
                     <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                       {failureData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                     </Bar>
                   </BarChart>
                 </ResponsiveContainer>
               </div>
               <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 pl-[100px]">
                  <span>Unknown</span>
                  <span className="pr-[20px]">0</span>
               </div>
            </div>
          </div>

          {/* Bottom Alerts Table */}
          <div className="bg-[#182227] border border-[#233138] rounded-md p-4 flex-1 flex flex-col overflow-hidden min-h-[160px]">
             <h2 className="text-xs font-bold text-slate-300 tracking-wider mb-3 uppercase">Recent Pipeline Alerts & Events</h2>
             <div className="flex text-[10px] text-slate-500 mb-2 px-2">
               <div className="w-32">Time</div>
               <div className="w-36">Pipeline</div>
               <div className="w-24">Severity</div>
               <div className="w-32">Event</div>
               <div className="flex-1">Details</div>
             </div>
             <div className="flex-1 overflow-y-auto space-y-1">
               {alertsData.map((a, i) => (
                 <div key={i} className="flex items-center text-[11px] py-1.5 px-2 hover:bg-[#233138]/50 rounded transition-colors border-b border-[#233138]/50 last:border-0">
                   <div className="w-32 text-slate-400 font-mono text-[10px]">{a.time}</div>
                   <div className="w-36 text-slate-300">{a.pipeline}</div>
                   <div className={`w-24 flex items-center gap-1.5 ${a.sevColor}`}>
                     <span className={`w-1.5 h-1.5 rounded-full ${a.sevColor.replace('text-', 'bg-')}`}></span>
                     {a.severity}
                   </div>
                   <div className="w-32 text-slate-300">{a.event}</div>
                   <div className="flex-1 text-slate-400 truncate pr-2" title={a.details}>{a.details}</div>
                 </div>
               ))}
             </div>
          </div>

        </div>

        {/* Right Column: Data Quality & Top Pipelines */}
        <div className="col-span-12 xl:col-span-3 flex flex-col gap-4">
          
          <div className="bg-[#182227] border border-[#233138] rounded-md p-4 flex flex-col h-[260px]">
            <h2 className="text-xs font-bold text-slate-300 tracking-wider uppercase mb-6">Data Quality Score</h2>
            <div className="flex-1 relative flex flex-col items-center justify-center">
              {/* Custom SVG Gauge */}
              <div className="relative w-48 h-24 overflow-hidden mb-4">
                 <svg viewBox="0 0 100 50" className="w-full h-full drop-shadow-md">
                   <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#233138" strokeWidth="12" strokeLinecap="round" />
                   <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#10b981" strokeWidth="12" strokeLinecap="round" pathLength="100" strokeDasharray="87 100" />
                   <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#f59e0b" strokeWidth="12" strokeLinecap="round" pathLength="100" strokeDasharray="50 100" className="opacity-0" /> {/* Just for ref */}
                 </svg>
                 <div className="absolute bottom-0 inset-x-0 flex flex-col items-center justify-end">
                   <div className="text-4xl font-bold text-white flex items-baseline gap-1">
                     87<span className="text-sm text-slate-400 font-normal">/100</span>
                   </div>
                   <div className="text-emerald-500 font-medium text-sm mt-1">Good</div>
                 </div>
              </div>
              
              <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-[11px] mt-4 w-full px-4">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded bg-emerald-500"></div><span className="text-slate-300">Excellent (90-100)</span></div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded bg-emerald-400"></div><span className="text-slate-300">Good (70-89)</span></div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded bg-amber-500"></div><span className="text-slate-300">Fair (50-69)</span></div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded bg-red-500"></div><span className="text-slate-300">Poor (&lt;50)</span></div>
              </div>
            </div>
          </div>

          <div className="bg-[#182227] border border-[#233138] rounded-md p-4 flex flex-col flex-1 min-h-[220px]">
            <h2 className="text-xs font-bold text-slate-300 tracking-wider mb-4 uppercase">Top Pipelines by Volume <span className="text-slate-500 normal-case">(Last 24h)</span></h2>
            <div className="flex-1 flex flex-col justify-center space-y-4">
              {topPipelines.map((p, i) => (
                <div key={i} className="flex items-center text-xs">
                  <div className="w-4 text-slate-500">{i+1}</div>
                  <div className="w-32 text-slate-300">{p.name}</div>
                  <div className="flex-1 ml-2 flex items-center">
                    <div className="h-2 rounded bg-emerald-500 mr-2" style={{width: `${(p.value/3)*100}%`}}></div>
                    <div className="text-slate-400 text-[10px] w-8">{p.value}M</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#182227] border border-[#233138] rounded-md p-4 flex flex-col h-[180px]">
            <h2 className="text-xs font-bold text-slate-300 tracking-wider mb-4 uppercase">System Resources <span className="text-slate-500 normal-case">(Live)</span></h2>
            <div className="flex justify-between items-end flex-1 pb-2">
              
              {/* CPU */}
              <div className="flex flex-col items-center flex-1">
                <span className="text-[10px] text-slate-400 mb-2">CPU Usage</span>
                <div className="relative w-14 h-14 mb-2">
                  <svg viewBox="0 0 36 36" className="w-full h-full">
                    <path className="text-[#233138]" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                    <path className="text-emerald-500" strokeDasharray="42, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-200">42%</div>
                </div>
                <div className="h-4 w-full px-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sparklineData}>
                        <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={1} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                </div>
              </div>

              {/* Memory */}
              <div className="flex flex-col items-center flex-1 border-x border-[#233138]/50">
                <span className="text-[10px] text-slate-400 mb-2">Memory Usage</span>
                <div className="relative w-14 h-14 mb-2">
                  <svg viewBox="0 0 36 36" className="w-full h-full">
                    <path className="text-[#233138]" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                    <path className="text-emerald-500" strokeDasharray="68, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-200">68%</div>
                </div>
                <div className="h-4 w-full px-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sparklineData}>
                        <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={1} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                </div>
              </div>

              {/* Disk I/O */}
              <div className="flex flex-col items-center flex-1">
                <span className="text-[10px] text-slate-400 mb-2">Disk I/O</span>
                <div className="relative w-14 h-14 mb-2">
                  <svg viewBox="0 0 36 36" className="w-full h-full">
                    <path className="text-[#233138]" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                    <path className="text-emerald-500" strokeDasharray="53, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-200">53%</div>
                </div>
                <div className="h-4 w-full px-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sparklineData}>
                        <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={1} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
