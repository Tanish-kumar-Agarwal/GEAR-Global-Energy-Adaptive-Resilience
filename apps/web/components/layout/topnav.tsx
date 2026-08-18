'use client';

import { ShieldAlert, Activity, Network, LineChart, Target, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="h-16 bg-[#0f172a] border-b border-[#1e293b] flex items-center justify-between px-4 flex-shrink-0 z-40 shadow-sm">
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
        <div className="flex h-full border-l border-[#1e293b]">
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
            href="#" 
            icon={<Target size={16} />} 
            title="DECISION CENTER" 
            sub="Approve & Act" 
            active={false} 
          />
        </div>
      </div>
      
      {/* FAR RIGHT ITEMS */}
      <div className="flex items-center gap-6">
        <div className="flex flex-col text-right">
           <div className="flex items-center gap-2 justify-end">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
             <span className="text-[10px] font-bold text-emerald-500 tracking-wider">LIVE</span>
           </div>
           <div className="text-[10px] text-slate-400">16:42:31 UTC</div>
           <div className="text-[10px] text-slate-500">26 May 2025</div>
        </div>

        <div className="flex items-center gap-2 pl-6 border-l border-[#1e293b]">
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
      <div className={`h-full flex flex-col justify-center px-6 border-r border-[#1e293b] border-t-2 transition-colors cursor-pointer ${
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
