'use client';

import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_STYLE_URL, MAPLIBRE_WORKER_URL } from '@/lib/config';
import {
  HACKATHON_HEATMAP_REGIONS,
  HACKATHON_CHOKEPOINTS,
  HACKATHON_SUPPLY_ROUTES,
  HACKATHON_TOP_RISKS,
  HeatmapRegion,
} from '@/data/snapshot';

const RISK_FILL: maplibregl.ExpressionSpecification = [
  'case',
  ['>=', ['get', 'risk'], 70], '#ef4444',
  ['>=', ['get', 'risk'], 45], '#f59e0b',
  '#10b981',
];

// Weight of a route crossing the region, by status.
const ROUTE_WEIGHT = { disrupted: 65, at_risk: 55, stable: 30 } as const;
// Top-risk events are systemic signals, damped so a geographic chokepoint
// inside the region still dominates when it is hotter.
const EVENT_WEIGHT = 0.7;
const BASE_RISK = 20;

function pointInPolygon([x, y]: [number, number], ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Region risk is derived from the same data that drives the main map: the
// hottest chokepoint inside the region, the worst route status crossing it,
// and the top-risk events tagged to it. The region keeps the worst signal.
function riskForRegion(region: HeatmapRegion): number {
  let risk = BASE_RISK;
  for (const c of HACKATHON_CHOKEPOINTS) {
    if (pointInPolygon([c.lng, c.lat], region.polygon)) risk = Math.max(risk, c.risk);
  }
  for (const route of HACKATHON_SUPPLY_ROUTES) {
    if (route.path.some(p => pointInPolygon(p, region.polygon))) {
      risk = Math.max(risk, ROUTE_WEIGHT[route.status]);
    }
  }
  for (const eventId of region.riskEventIds) {
    const event = HACKATHON_TOP_RISKS.find(r => r.id === eventId);
    if (event) risk = Math.max(risk, Math.round(event.index * EVENT_WEIGHT));
  }
  return risk;
}

function centroid(ring: [number, number][]): [number, number] {
  const [sx, sy] = ring.reduce(([ax, ay], [x, y]) => [ax + x, ay + y], [0, 0]);
  return [sx / ring.length, sy / ring.length];
}

// Live scores from GET /risks/heatmap win when the backend has scored the
// region (joined by region name); everything else keeps the locally derived
// risk so the whole world stays tinted even with sparse backend coverage.
function resolvedRisk(r: HeatmapRegion, liveScores?: Record<string, number>): number {
  return liveScores?.[r.name] ?? riskForRegion(r);
}

function regionsToGeoJSON(liveScores?: Record<string, number>): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: HACKATHON_HEATMAP_REGIONS.map(r => ({
      type: 'Feature',
      properties: { id: r.id, name: r.name, risk: resolvedRisk(r, liveScores) },
      geometry: { type: 'Polygon', coordinates: [[...r.polygon, r.polygon[0]]] },
    })),
  };
}

function regionLabelsToGeoJSON(liveScores?: Record<string, number>): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: HACKATHON_HEATMAP_REGIONS.map(r => ({
      type: 'Feature',
      properties: { id: r.id, risk: resolvedRisk(r, liveScores) },
      geometry: { type: 'Point', coordinates: centroid(r.polygon) },
    })),
  };
}

// Non-interactive MapLibre mini map: the whole world with translucent
// risk-tinted region fills over the shared dark basemap.
export function RiskHeatmapMap({ regionScores }: { regionScores?: Record<string, number> }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const loaded = useRef(false);
  const scoresRef = useRef(regionScores);

  useEffect(() => {
    scoresRef.current = regionScores;
    const m = map.current;
    if (!m || !loaded.current) return;
    (m.getSource('region-risks') as maplibregl.GeoJSONSource | undefined)?.setData(regionsToGeoJSON(regionScores));
    (m.getSource('region-risk-labels') as maplibregl.GeoJSONSource | undefined)?.setData(regionLabelsToGeoJSON(regionScores));
  }, [regionScores]);

  useEffect(() => {
    if (map.current || !container.current) return;

    maplibregl.setWorkerUrl(MAPLIBRE_WORKER_URL);

    const m = new maplibregl.Map({
      container: container.current,
      style: MAP_STYLE_URL,
      center: [15.0, 23.0],
      zoom: -0.85,
      minZoom: -1.5,
      renderWorldCopies: false,
      interactive: false,
      attributionControl: false,
    });
    map.current = m;

    m.on('load', () => {
      m.resize();
      loaded.current = true;
      m.addSource('region-risks', { type: 'geojson', data: regionsToGeoJSON(scoresRef.current) });
      m.addSource('region-risk-labels', { type: 'geojson', data: regionLabelsToGeoJSON(scoresRef.current) });
      m.addLayer({
        id: 'region-risk-fill',
        type: 'fill',
        source: 'region-risks',
        paint: { 'fill-color': RISK_FILL, 'fill-opacity': 0.38 },
      });
      m.addLayer({
        id: 'region-risk-outline',
        type: 'line',
        source: 'region-risks',
        paint: { 'line-color': RISK_FILL, 'line-width': 1, 'line-opacity': 0.7 },
      });
      m.addLayer({
        id: 'region-risk-label',
        type: 'symbol',
        source: 'region-risk-labels',
        layout: {
          'text-field': ['to-string', ['get', 'risk']],
          'text-font': ['Montserrat Medium'],
          'text-size': 10,
        },
        paint: {
          'text-color': RISK_FILL,
          'text-halo-color': '#0b1220',
          'text-halo-width': 1.2,
        },
      });
    });

    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  return <div ref={container} className="absolute inset-0 w-full h-full" />;
}
