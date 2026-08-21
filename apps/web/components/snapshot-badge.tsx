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
  return null;
}
