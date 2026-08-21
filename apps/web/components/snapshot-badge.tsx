'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Database } from 'lucide-react';
import { DATA_MODE } from '@/lib/config';
import { subscribeSnapshotFallback } from '@/lib/api';

// Two very different situations share this slot and must not look alike:
//
// 1. DELIBERATE snapshot build (DATA_MODE = HACKATHON_SNAPSHOT, e.g. the
//    deployed demo link): a calm, neutral DEMO DATA indicator. Honest, always
//    visible, never styled like an error, because nothing is broken.
// 2. LIVE mode with the API unreachable: the alarming red badge, because the
//    page is showing fallback data the viewer expected to be live.
export function SnapshotFallbackBadge() {
  const [endpoints, setEndpoints] = useState<string[]>([]);

  useEffect(() => {
    if (DATA_MODE === 'HACKATHON_SNAPSHOT') return;
    return subscribeSnapshotFallback(setEndpoints);
  }, []);

  if (DATA_MODE === 'HACKATHON_SNAPSHOT') {
    return (
      <div
        title="This deployment runs on embedded demo data captured from the live system. No backend is connected."
        className="fixed top-2 right-3 z-[60] flex items-center gap-1.5 rounded border border-slate-600/70 bg-slate-900/95 px-2.5 py-1 text-[10px] font-bold tracking-wider text-slate-300 shadow-lg"
      >
        <Database size={11} className="text-cyan-400" />
        DEMO DATA
      </div>
    );
  }

  // The user requested to completely remove the red alarming "API UNREACHABLE" error badge
  return null;
}
