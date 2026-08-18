'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Clock, LineChart, Shield, Settings, HelpCircle, Network } from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  
  return (
    <aside className="w-16 h-screen bg-[#0f172a] border-r border-[#1e293b] flex flex-col items-center py-4 flex-shrink-0 z-50">
      <div className="flex flex-col gap-6 w-full items-center mb-auto">
        {/* Logo Icon Placeholder */}
        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-blue-400 font-bold border border-blue-900/50">
          G
        </div>
        
        {/* Primary Nav */}
        <nav className="flex flex-col gap-4 w-full px-2">
          <Link href="/war-room"><NavItem icon={<LayoutGrid size={20} />} active={pathname === '/war-room'} /></Link>
          <Link href="/scenario-lab"><NavItem icon={<Clock size={20} />} active={pathname === '/scenario-lab'} /></Link>
          <Link href="/strategy-lab"><NavItem icon={<LineChart size={20} />} active={pathname === '/strategy-lab'} /></Link>
          <NavItem icon={<Shield size={20} />} />
        </nav>
      </div>
      
      {/* Secondary Nav */}
      <div className="flex flex-col gap-4 w-full items-center px-2 mt-auto">
        <NavItem icon={<Network size={20} />} />
        <NavItem icon={<HelpCircle size={20} />} />
        <NavItem icon={<Settings size={20} />} />
      </div>
    </aside>
  );
}

function NavItem({ icon, active }: { icon: React.ReactNode; active?: boolean }) {
  return (
    <div className={`w-10 h-10 rounded flex items-center justify-center transition-colors ${active ? 'bg-slate-800 text-blue-400 border border-slate-700' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}>
      {icon}
    </div>
  );
}
