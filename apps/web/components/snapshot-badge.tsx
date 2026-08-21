'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { subscribeSnapshotFallback } from '@/lib/api';

// Persistent warning shown whenever ANY panel on the page is rendering
// snapshot data because the live API could not be reached. Fallback data must
// never masquerade as a real result.
export function SnapshotFallbackBadge() {
  const [endpoints, setEndpoints] = useState<string[]>([]);

  useEffect(() => subscribeSnapshotFallback(setEndpoints), []);

  if (endpoints.length === 0) return null;

  return (
    <div
      title={`Snapshot data served for: ${endpoints.join(', ')}`}
      className="fixed top-2 right-3 z-[60] flex items-center gap-2 rounded border border-red-500/80 bg-red-950/95 px-3 py-1.5 text-[11px] font-black tracking-wider text-red-300 shadow-2xl"
    >
      <AlertTriangle size={13} className="text-red-400" />
      SNAPSHOT DATA, API UNREACHABLE ({endpoints.length})
    </div>
  );
}
