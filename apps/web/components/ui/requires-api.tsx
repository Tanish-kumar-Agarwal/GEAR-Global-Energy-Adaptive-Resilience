import React from 'react';
import { Database } from 'lucide-react';

export function RequiresAPI({ endpoint, children }: { endpoint: string; children?: React.ReactNode }) {
  return (
    <div className="relative w-full h-full min-h-[100px] flex items-center justify-center overflow-hidden rounded-md group bg-slate-900/40 border border-slate-800/60">
      {/* Blurred background content if provided */}
      {children && (
        <div className="absolute inset-0 opacity-20 filter blur-[2px] pointer-events-none select-none">
          {children}
        </div>
      )}
      
      {/* Overlay indicator */}
      <div className="relative z-10 flex flex-col items-center justify-center p-4 text-center">
        <Database className="h-6 w-6 text-slate-500 mb-2 opacity-50 group-hover:opacity-100 transition-opacity" />
        <span className="text-xs font-mono font-medium text-slate-400 bg-slate-950/80 px-2 py-1 rounded border border-slate-800">
          Requires API:
        </span>
        <span className="text-[10px] font-mono text-slate-500 mt-1 break-all px-2 max-w-[200px]">
          {endpoint}
        </span>
      </div>
    </div>
  );
}
