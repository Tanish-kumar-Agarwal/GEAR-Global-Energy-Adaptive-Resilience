'use client';

import { ShieldAlert, Activity, Network, LineChart, Target, User, Database } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useEffect, useState } from 'react';
import { ApiClient } from '@/lib/api';

export function TopNav() {
  const pathname = usePathname();
  const [healthStatus, setHealthStatus] = useState<string>('UNKNOWN');
  const [components, setComponents] = useState<any>({});

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await ApiClient.getHealthComponents();
        setHealthStatus(res.status);
        setComponents(res.components);
      } catch (err) {
        setHealthStatus('UNAVAILABLE');
      }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-[#0f181b] border-b border-[#182227] flex items-center justify-between px-4 flex-shrink-0 z-40 shadow-sm">
      <div className="flex h-full items-center">
        {/* LOGO */}
        <Link href="/war-room">
          <div className="flex flex-col items-center justify-center mr-8 cursor-pointer group">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-emerald-900/50 flex items-center justify-center text-emerald-400 group-hover:bg-slate-700 transition-colors">
              <span className="font-bold text-lg leading-none">G</span>
            </div>
          </div>
        </Link>
        
        {/* 5 TABS */}
        <div className="flex h-full border-l border-[#182227]">
          <Tab 
            href="/war-room" 
            icon={<ShieldAlert size={16} />} 
            title="WAR ROOM" 
            sub="Monitor & Detect" 
            active={pathname === '/war-room'} 
          />
          <Tab 
            href="/scenario-lab" 
            icon={<Activity size={16} />} 
            title="SCENARIO LAB" 
            sub="Simulate & Predict" 
            active={pathname === '/scenario-lab'} 
          />
          <Tab 
            href="/response-orchestrator" 
            icon={<Network size={16} />} 
            title="RESPONSE ORCHESTRATOR" 
            sub="Optimize & Recommend" 
            active={pathname === '/response-orchestrator'} 
          />
          <Tab 
            href="/strategy-lab" 
            icon={<LineChart size={16} />} 
            title="STRATEGY LAB" 
            sub="Plan & Invest" 
            active={pathname === '/strategy-lab'} 
          />
          <Tab 
            href="/data-intelligence" 
            icon={<Database size={16} />} 
            title="DATA INTELLIGENCE" 
            sub="Source & Ingestion" 
            active={pathname === '/data-intelligence'} 
          />
        </div>
      </div>
      
      {/* FAR RIGHT ITEMS */}
      <div className="flex items-center gap-6">
        <div className="flex flex-col text-right">
           <div className="flex items-center gap-2 justify-end relative group cursor-pointer">
             <div className={`w-2 h-2 rounded-full animate-pulse ${healthStatus === 'healthy' || healthStatus === 'ok' ? 'bg-emerald-500' : healthStatus === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
             <span className={`text-[10px] font-bold tracking-wider uppercase ${healthStatus === 'healthy' || healthStatus === 'ok' ? 'text-emerald-500' : healthStatus === 'degraded' ? 'text-yellow-500' : 'text-red-500'}`}>{healthStatus === 'UNKNOWN' ? 'DATA UNAVAILABLE' : healthStatus}</span>
             
             {/* Tooltip for components */}
             <div className="absolute top-full right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded shadow-lg p-2 hidden group-hover:block z-50">
                <div className="text-[10px] font-mono text-gray-300">
                   {Object.entries(components || {}).map(([key, val]) => (
                     <div key={key} className="flex justify-between py-1">
                       <span>{key}:</span>
                       <span className={val === 'healthy' ? 'text-emerald-400' : val === 'degraded' ? 'text-yellow-400' : 'text-red-400'}>{val as string}</span>
                     </div>
                   ))}
                   {Object.keys(components || {}).length === 0 && <span>No component data</span>}
                </div>
             </div>
           </div>
           <div className="text-[10px] text-slate-400">16:42:31 UTC</div>
           <div className="text-[10px] text-slate-500">26 May 2025</div>
        </div>

        <div className="flex items-center gap-2 pl-6 border-l border-[#182227]">
           <div className="w-8 h-8 rounded-full bg-orange-600 border border-slate-600 flex items-center justify-center overflow-hidden">
             {/* Indian Flag Placeholder */}
             <div className="w-full h-full flex flex-col"><div className="bg-orange-500 flex-1"></div><div className="bg-white flex-1 relative"><div className="w-2 h-2 rounded-full border border-blue-800 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div></div><div className="bg-green-600 flex-1"></div></div>
           </div>
           <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-200">India Command</span>
              <span className="text-[10px] text-slate-500">Administrator <span className="ml-1 text-[8px]">▼</span></span>
           </div>
        </div>
      </div>
    </header>
  );
}

function Tab({ href, icon, title, sub, active }: any) {
  return (
    <Link href={href}>
      <div className={`h-full flex flex-col justify-center px-6 border-r border-[#182227] border-t-2 transition-colors cursor-pointer ${
        active 
          ? 'bg-slate-800/50 border-t-blue-500' 
          : 'border-t-transparent hover:bg-slate-800/30'
      }`}>
        <div className={`flex items-center gap-2 ${active ? 'text-blue-400' : 'text-slate-400'}`}>
          {icon}
          <span className="text-[11px] font-bold tracking-wide uppercase">{title}</span>
        </div>
        <div className={`text-[10px] pl-6 ${active ? 'text-slate-300' : 'text-slate-500'}`}>
          {sub}
        </div>
      </div>
    </Link>
  );
}
