'use client';

import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_STYLE_URL, MAPLIBRE_WORKER_URL } from '@/lib/config';

export interface MiniMapTarget {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: 'chokepoint' | 'asset';
}

// Zoom per entity type: close enough that the target is identifiable, wide
// enough for geographic context in a ~96px-tall panel.
const ZOOM: Record<MiniMapTarget['kind'], number> = { chokepoint: 4.2, asset: 5 };

function colorForRisk(risk: number | null): string {
  if (risk == null) return '#64748b';
  if (risk >= 70) return '#ef4444';
  if (risk >= 40) return '#f59e0b';
  return '#10b981';
}

function targetToGeoJSON(t: MiniMapTarget, risk: number | null, isPreview: boolean): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {
        label: risk != null ? `${t.name}\nRisk: ${Math.round(risk)}${isPreview ? ' (est.)' : ''}` : t.name,
        color: colorForRisk(risk),
      },
      geometry: { type: 'Point', coordinates: [t.lng, t.lat] },
    }],
  };
}

// Target-selector mini map: always centred on and labeled with the CURRENT
// selection (a stale label here once showed Hormuz for a Malacca selection).
// When the severity preview is active the marker takes the previewed risk
// color and the PREVIEW EST. tag, same honesty treatment as the main map.
export function TargetMiniMap({ target, targetId, previewRisk = null, isPreview = false }: {
  target: MiniMapTarget | null;
  targetId: string;
  previewRisk?: number | null;
  isPreview?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const loaded = useRef(false);
  const stateRef = useRef({ target, previewRisk, isPreview });

  useEffect(() => {
    stateRef.current = { target, previewRisk, isPreview };
    const m = map.current;
    if (!m || !loaded.current) return;
    const source = m.getSource('target-point') as maplibregl.GeoJSONSource | undefined;
    if (!target) {
      // No stale marker under the unavailable overlay.
      source?.setData({ type: 'FeatureCollection', features: [] });
      return;
    }
    source?.setData(targetToGeoJSON(target, previewRisk, isPreview));
    m.flyTo({ center: [target.lng, target.lat], zoom: ZOOM[target.kind], duration: 900, essential: true });
  }, [target, previewRisk, isPreview]);

  useEffect(() => {
    if (map.current || !container.current) return;
    maplibregl.setWorkerUrl(MAPLIBRE_WORKER_URL);
    const initial = stateRef.current.target;
    const m = new maplibregl.Map({
      container: container.current,
      style: MAP_STYLE_URL,
      center: initial ? [initial.lng, initial.lat] : [40, 22],
      zoom: initial ? ZOOM[initial.kind] : 1,
      interactive: false,
      attributionControl: false,
      renderWorldCopies: false,
    });
    map.current = m;
    m.on('load', () => {
      m.resize();
      const { target: t, previewRisk: r, isPreview: p } = stateRef.current;
      m.addSource('target-point', {
        type: 'geojson',
        data: t ? targetToGeoJSON(t, r, p) : { type: 'FeatureCollection', features: [] },
      });
      m.addLayer({
        id: 'target-halo', type: 'circle', source: 'target-point',
        paint: { 'circle-radius': 11, 'circle-color': ['get', 'color'], 'circle-opacity': 0.25 },
      });
      m.addLayer({
        id: 'target-dot', type: 'circle', source: 'target-point',
        paint: { 'circle-radius': 5, 'circle-color': ['get', 'color'], 'circle-stroke-width': 1.5, 'circle-stroke-color': '#0b1220' },
      });
      m.addLayer({
        id: 'target-label', type: 'symbol', source: 'target-point',
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Montserrat Medium'],
          'text-size': 10,
          'text-anchor': 'top',
          'text-offset': [0, 1.1],
          'text-line-height': 1.2,
        },
        paint: { 'text-color': '#e2e8f0', 'text-halo-color': '#0b1220', 'text-halo-width': 1.2 },
      });
      loaded.current = true;
      if (t) m.jumpTo({ center: [t.lng, t.lat], zoom: ZOOM[t.kind] });
    });
    return () => {
      loaded.current = false;
      m.remove();
      map.current = null;
    };
  }, []);

  // The map div stays mounted in every state (unmounting it would orphan the
  // MapLibre instance); overlays communicate preview and unavailable states.
  return (
    <>
      <div ref={container} className="absolute inset-0 w-full h-full" />
      {isPreview && target && (
        <div className="absolute top-1 left-1 z-10 rounded border border-dashed border-amber-500/80 bg-amber-950/85 px-1 py-0.5 text-[8px] font-black tracking-wider text-amber-300">
          PREVIEW EST.
        </div>
      )}
      {!target && (
        // No coordinates: say so explicitly. Never show a default view that
        // implies a location; a silently wrong place is the bug this replaces.
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-[#0a1014]/90 px-2 text-center">
          <span className="text-[10px] font-bold text-amber-400">No coordinates for {targetId}</span>
          <span className="text-[9px] text-slate-500">This target is not in the live dataset, so the map cannot show it</span>
        </div>
      )}
    </>
  );
}
