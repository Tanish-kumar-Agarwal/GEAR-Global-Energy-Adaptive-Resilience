'use client';

import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_STYLE_URL, MAPLIBRE_WORKER_URL } from '@/lib/config';
import { HACKATHON_SUPPLY_ROUTES, HACKATHON_CHOKEPOINTS, SupplyRoute, RouteStatus } from '@/data/snapshot';

export type MapLayerId = 'routes' | 'chokepoints' | 'ports' | 'production' | 'refineries' | 'storage';

export const MAP_LAYER_IDS: MapLayerId[] = ['routes', 'chokepoints', 'ports', 'production', 'refineries', 'storage'];

export const MAP_LAYER_LABELS: Record<MapLayerId, string> = {
  routes: 'Supply Routes',
  chokepoints: 'Chokepoints',
  ports: 'Ports',
  production: 'Production',
  refineries: 'Refineries',
  storage: 'Storage',
};

export interface MapAssetInput {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  capacity: number;
}

// risk: null = the risk engine has not scored this chokepoint yet; the map
// shows a neutral "unscored" chip so a blank Suez never looks like a calm Suez.
export interface MapChokepointInput {
  id: string;
  name: string;
  lat: number;
  lng: number;
  risk: number | null;
  // Saturated at baseline: in preview mode these are dimmed so the entities
  // that actually move with the severity slider carry the visual signal.
  pinned?: boolean;
}

export interface SelectedMapFeature {
  id: string;
  name: string;
  type: string;
  capacity: number;
}

interface MapViewerProps {
  assets: MapAssetInput[];
  routes?: SupplyRoute[];
  chokepoints?: MapChokepointInput[];
  visibleLayers?: Record<MapLayerId, boolean>;
  onFeatureSelect?: (feature: SelectedMapFeature) => void;
  // True while the overlay shows a severity-preview estimate rather than a
  // completed run: chips and route lines render washed out so an estimate can
  // never be mistaken for a real simulation result.
  overlayPreview?: boolean;
}

const ALL_VISIBLE: Record<MapLayerId, boolean> = {
  routes: true, chokepoints: true, ports: true, production: true, refineries: true, storage: true,
};

const STATUS_COLORS: Record<RouteStatus, string> = {
  stable: '#10b981',
  at_risk: '#f59e0b',
  disrupted: '#ef4444',
};

const ROUTE_COLOR_EXPR: maplibregl.ExpressionSpecification = [
  'match', ['get', 'status'],
  'disrupted', STATUS_COLORS.disrupted,
  'at_risk', STATUS_COLORS.at_risk,
  STATUS_COLORS.stable,
];

// MapLibre layer ids owned by each toggleable layer group.
const LAYER_GROUPS: Record<MapLayerId, string[]> = {
  routes: ['routes-glow', 'routes-glow-pulse', 'routes-line'],
  chokepoints: ['chokepoints-point', 'chokepoints-label'],
  ports: ['assets-ports'],
  production: ['assets-production'],
  refineries: ['assets-refineries'],
  storage: ['assets-storage'],
};

const ASSET_CATEGORIES = ['ports', 'production', 'refineries', 'storage'] as const;
type AssetCategory = (typeof ASSET_CATEGORIES)[number];

// Terminals ride on the Ports layer; unknown live-mode types fall back to ports too.
function categoryOfAssetType(type: string): AssetCategory {
  switch (type?.toUpperCase()) {
    case 'REFINERY': return 'refineries';
    case 'PRODUCTION':
    case 'FIELD':
    case 'WELL': return 'production';
    case 'STORAGE':
    case 'RESERVE': return 'storage';
    default: return 'ports';
  }
}

// Dash phase sequence from the MapLibre ant-path example: stepping through it
// makes the dashes appear to travel along the line.
const DASH_SEQUENCE: number[][] = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5],
  [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2],
  [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
];

type RouteInput = SupplyRoute & { pinned?: boolean };

function routesToGeoJSON(routes: RouteInput[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: routes.map(r => ({
      type: 'Feature',
      properties: { id: r.id, name: r.name, status: r.status, commodity: r.commodity, pinned: !!r.pinned },
      geometry: { type: 'LineString', coordinates: r.path },
    })),
  };
}

type ChokepointTier = 'critical' | 'elevated' | 'low' | 'unscored';

function chokepointTier(risk: number | null): ChokepointTier {
  if (risk == null) return 'unscored';
  if (risk >= 60) return 'critical';
  if (risk >= 40) return 'elevated';
  return 'low';
}

function chokepointsToGeoJSON(chokepoints: MapChokepointInput[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: chokepoints.map(c => ({
      type: 'Feature',
      properties: {
        id: c.id,
        name: c.name,
        // -1 keeps unscored chips sorting last; the label shows riskLabel.
        risk: c.risk ?? -1,
        riskLabel: c.risk == null ? 'unscored' : String(c.risk),
        tier: chokepointTier(c.risk),
        pinned: !!c.pinned,
        type: 'CHOKEPOINT',
      },
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
    })),
  };
}

function assetsToGeoJSON(assets: MapAssetInput[], category: AssetCategory): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: assets
      .filter(a => categoryOfAssetType(a.type) === category)
      .map(a => ({
        type: 'Feature',
        properties: { id: a.id, name: a.name, type: a.type, capacity: a.capacity },
        geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
      })),
  };
}

function drawOnCanvas(size: number, draw: (ctx: CanvasRenderingContext2D) => void): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);
  return ctx.getImageData(0, 0, size, size);
}

// Stretchable rounded-rect background for chokepoint label chips.
function makeChipImage(borderColor: string): { data: ImageData; options: Partial<maplibregl.StyleImageMetadata> } {
  const w = 64, h = 40, r = 10;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.beginPath();
  ctx.roundRect(1.5, 1.5, w - 3, h - 3, r);
  ctx.fillStyle = 'rgba(9, 14, 22, 0.92)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = borderColor;
  ctx.stroke();
  return {
    data: ctx.getImageData(0, 0, w, h),
    options: {
      pixelRatio: 2,
      stretchX: [[16, 48]],
      stretchY: [[16, 24]],
      content: [10, 8, 54, 32],
    },
  };
}

// Distinct circular badge glyph per asset type.
function makeAssetGlyph(color: string, symbol: 'anchor' | 'flame' | 'derrick' | 'tank' | 'diamond'): ImageData {
  return drawOnCanvas(44, ctx => {
    ctx.beginPath();
    ctx.arc(22, 22, 19, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10, 16, 26, 0.95)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = color;
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    switch (symbol) {
      case 'anchor':
        ctx.arc(22, 12.5, 3, 0, Math.PI * 2);
        ctx.moveTo(22, 15.5);
        ctx.lineTo(22, 31);
        ctx.moveTo(16, 20);
        ctx.lineTo(28, 20);
        ctx.moveTo(13, 26);
        ctx.arc(22, 22.5, 9, Math.PI * 0.85, Math.PI * 0.15, true);
        ctx.stroke();
        break;
      case 'flame':
        ctx.moveTo(22, 10);
        ctx.quadraticCurveTo(31, 22, 22, 33);
        ctx.quadraticCurveTo(13, 22, 22, 10);
        ctx.fill();
        break;
      case 'derrick':
        ctx.moveTo(22, 11);
        ctx.lineTo(30, 32);
        ctx.lineTo(14, 32);
        ctx.closePath();
        ctx.moveTo(17.5, 24);
        ctx.lineTo(26.5, 24);
        ctx.stroke();
        break;
      case 'tank':
        ctx.ellipse(22, 15, 8, 3, 0, 0, Math.PI * 2);
        ctx.moveTo(14, 15);
        ctx.lineTo(14, 29);
        ctx.ellipse(22, 29, 8, 3, 0, Math.PI, 0, true);
        ctx.moveTo(30, 29);
        ctx.lineTo(30, 15);
        ctx.stroke();
        break;
      case 'diamond':
        ctx.moveTo(22, 11);
        ctx.lineTo(32, 22);
        ctx.lineTo(22, 33);
        ctx.lineTo(12, 22);
        ctx.closePath();
        ctx.stroke();
        break;
    }
  });
}

const ASSET_ICON_EXPR: maplibregl.ExpressionSpecification = [
  'match', ['get', 'type'],
  'PORT', 'icon-port',
  'TERMINAL', 'icon-terminal',
  'REFINERY', 'icon-refinery',
  'PRODUCTION', 'icon-production',
  'FIELD', 'icon-production',
  'WELL', 'icon-production',
  'STORAGE', 'icon-storage',
  'RESERVE', 'icon-storage',
  'icon-port',
];

function addMapImages(map: maplibregl.Map) {
  map.addImage('icon-port', makeAssetGlyph('#3b82f6', 'anchor'), { pixelRatio: 2 });
  map.addImage('icon-terminal', makeAssetGlyph('#06b6d4', 'diamond'), { pixelRatio: 2 });
  map.addImage('icon-refinery', makeAssetGlyph('#f59e0b', 'flame'), { pixelRatio: 2 });
  map.addImage('icon-production', makeAssetGlyph('#10b981', 'derrick'), { pixelRatio: 2 });
  map.addImage('icon-storage', makeAssetGlyph('#a855f7', 'tank'), { pixelRatio: 2 });

  const chips: [string, string][] = [
    ['chip-critical', '#b91c1c'],
    ['chip-elevated', '#b45309'],
    ['chip-low', '#047857'],
    ['chip-unscored', '#475569'],
  ];
  chips.forEach(([id, color]) => {
    const { data, options } = makeChipImage(color);
    map.addImage(id, data, options);
  });
}

function addSourcesAndLayers(
  map: maplibregl.Map,
  assets: MapAssetInput[],
  routes: SupplyRoute[],
  chokepoints: MapChokepointInput[],
) {
  map.addSource('supply-routes', { type: 'geojson', data: routesToGeoJSON(routes) });
  map.addSource('chokepoints', { type: 'geojson', data: chokepointsToGeoJSON(chokepoints) });
  ASSET_CATEGORIES.forEach(cat => {
    map.addSource(`assets-${cat}`, { type: 'geojson', data: assetsToGeoJSON(assets, cat) });
  });

  map.addLayer({
    id: 'routes-glow',
    type: 'line',
    source: 'supply-routes',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': ROUTE_COLOR_EXPR, 'line-width': 7, 'line-blur': 4, 'line-opacity': 0.18 },
  });
  map.addLayer({
    id: 'routes-glow-pulse',
    type: 'line',
    source: 'supply-routes',
    filter: ['==', ['get', 'status'], 'disrupted'],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': STATUS_COLORS.disrupted, 'line-width': 11, 'line-blur': 6, 'line-opacity': 0.2 },
  });
  map.addLayer({
    id: 'routes-line',
    type: 'line',
    source: 'supply-routes',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': ROUTE_COLOR_EXPR,
      'line-width': 1.8,
      'line-opacity': 0.95,
      'line-dasharray': DASH_SEQUENCE[0],
    },
  });

  ASSET_CATEGORIES.forEach(cat => {
    map.addLayer({
      id: `assets-${cat}`,
      type: 'symbol',
      source: `assets-${cat}`,
      layout: {
        'icon-image': ASSET_ICON_EXPR,
        'icon-size': 0.55,
        'icon-allow-overlap': true,
        'text-field': ['get', 'name'],
        'text-font': ['Montserrat Regular'],
        'text-size': 9,
        'text-anchor': 'top',
        'text-offset': [0, 1.3],
        'text-optional': true,
      },
      paint: {
        'text-color': '#94a3b8',
        'text-halo-color': '#0b1220',
        'text-halo-width': 1,
      },
    });
  });

  // Chokepoint layers go last so the risk chips render above asset markers and
  // always place, matching the reference where chips overlay everything.
  map.addLayer({
    id: 'chokepoints-point',
    type: 'circle',
    source: 'chokepoints',
    paint: {
      'circle-radius': 4,
      'circle-color': [
        'match', ['get', 'tier'],
        'critical', STATUS_COLORS.disrupted,
        'elevated', STATUS_COLORS.at_risk,
        'low', STATUS_COLORS.stable,
        '#64748b',
      ],
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#0b1220',
    },
  });
  map.addLayer({
    id: 'chokepoints-label',
    type: 'symbol',
    source: 'chokepoints',
    layout: {
      'icon-image': [
        'match', ['get', 'tier'],
        'critical', 'chip-critical',
        'elevated', 'chip-elevated',
        'low', 'chip-low',
        'chip-unscored',
      ],
      'icon-text-fit': 'both',
      'icon-text-fit-padding': [3, 7, 3, 7],
      // Collisions hide chips instead of stacking them; highest risk places first
      // (lower sort key wins), so crowded zoom levels keep the critical chips.
      // Unscored chips carry risk -1 and therefore always place last.
      'symbol-sort-key': ['-', 100, ['get', 'risk']],
      'text-field': ['concat', ['get', 'name'], '\nRisk: ', ['get', 'riskLabel']],
      'text-font': ['Montserrat Medium'],
      'text-size': 10,
      'text-justify': 'center',
      'text-anchor': 'top',
      'text-offset': [0, 0.9],
      'text-line-height': 1.25,
    },
    paint: {
      'text-color': [
        'match', ['get', 'tier'],
        'critical', '#fca5a5',
        'elevated', '#fcd34d',
        'low', '#6ee7b7',
        '#94a3b8',
      ],
    },
  });
}

export function MapViewer({
  assets,
  routes = HACKATHON_SUPPLY_ROUTES,
  chokepoints = HACKATHON_CHOKEPOINTS,
  visibleLayers = ALL_VISIBLE,
  onFeatureSelect,
  overlayPreview = false,
}: MapViewerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const loaded = useRef(false);
  const rafId = useRef<number>(0);
  const assetsRef = useRef(assets);
  const routesRef = useRef(routes);
  const chokepointsRef = useRef(chokepoints);
  const visibleRef = useRef(visibleLayers);
  const onSelectRef = useRef(onFeatureSelect);

  useEffect(() => { onSelectRef.current = onFeatureSelect; }, [onFeatureSelect]);

  // Initialize the map exactly once; data and visibility flow in via the effects below.
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    maplibregl.setWorkerUrl(MAPLIBRE_WORKER_URL);

    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE_URL,
      center: [40.0, 22.0],
      zoom: 1.5,
      minZoom: 1.0,
      // One world only: repeated copies duplicate every route and risk chip.
      // Note: maxBounds (constructor or setMaxBounds) throws in maplibre-gl
      // 6.4.1, so overpan clamping is deliberately not used here.
      renderWorldCopies: false,
      attributionControl: false,
    });
    map.current = m;
    // Test handle for browser-level verification of map data (main map only).
    if (typeof window !== 'undefined') (window as { __gearMap?: maplibregl.Map }).__gearMap = m;

    const applyVisibility = () => {
      const vis = visibleRef.current;
      (Object.keys(LAYER_GROUPS) as MapLayerId[]).forEach(group => {
        LAYER_GROUPS[group].forEach(layerId => {
          if (m.getLayer(layerId)) {
            m.setLayoutProperty(layerId, 'visibility', vis[group] ? 'visible' : 'none');
          }
        });
      });
    };

    m.on('load', () => {
      m.resize();
      addMapImages(m);
      addSourcesAndLayers(m, assetsRef.current, routesRef.current, chokepointsRef.current);
      applyVisibility();
      loaded.current = true;

      const interactiveLayers = ['chokepoints-point', 'chokepoints-label', ...ASSET_CATEGORIES.map(c => `assets-${c}`)];
      interactiveLayers.forEach(layerId => {
        m.on('click', layerId, e => {
          const props = e.features?.[0]?.properties;
          if (!props) return;
          onSelectRef.current?.({
            id: String(props.id),
            name: String(props.name),
            type: String(props.type),
            capacity: Number(props.capacity ?? props.risk ?? 0),
          });
        });
        m.on('mouseenter', layerId, () => { m.getCanvas().style.cursor = 'pointer'; });
        m.on('mouseleave', layerId, () => { m.getCanvas().style.cursor = ''; });
      });

      // Single rAF loop for the whole map: dash march at ~12fps plus a slow
      // opacity pulse on the disrupted-route glow. Toggling layers never
      // touches this loop, so there is exactly one to cancel on unmount.
      let dashStep = -1;
      const animate = (t: number) => {
        if (!map.current) return;
        const nextStep = Math.floor((t / 80) % DASH_SEQUENCE.length);
        if (nextStep !== dashStep) {
          dashStep = nextStep;
          m.setPaintProperty('routes-line', 'line-dasharray', DASH_SEQUENCE[dashStep]);
        }
        const pulse = 0.12 + 0.22 * (0.5 + 0.5 * Math.sin(t / 450));
        m.setPaintProperty('routes-glow-pulse', 'line-opacity', pulse);
        rafId.current = requestAnimationFrame(animate);
      };
      rafId.current = requestAnimationFrame(animate);
    });

    return () => {
      cancelAnimationFrame(rafId.current);
      loaded.current = false;
      m.remove();
      map.current = null;
    };
  }, []);

  // Live asset refresh: push new data into existing sources, no map teardown.
  // The ref keeps the latest assets for the one-time load handler above.
  useEffect(() => {
    assetsRef.current = assets;
    const m = map.current;
    if (!m || !loaded.current) return;
    ASSET_CATEGORIES.forEach(cat => {
      const source = m.getSource(`assets-${cat}`) as maplibregl.GeoJSONSource | undefined;
      source?.setData(assetsToGeoJSON(assets, cat));
    });
  }, [assets]);

  // Same live-refresh pattern for routes and chokepoints.
  useEffect(() => {
    routesRef.current = routes;
    const m = map.current;
    if (!m || !loaded.current) return;
    (m.getSource('supply-routes') as maplibregl.GeoJSONSource | undefined)?.setData(routesToGeoJSON(routes));
  }, [routes]);

  useEffect(() => {
    chokepointsRef.current = chokepoints;
    const m = map.current;
    if (!m || !loaded.current) return;
    (m.getSource('chokepoints') as maplibregl.GeoJSONSource | undefined)?.setData(chokepointsToGeoJSON(chokepoints));
  }, [chokepoints]);

  // Preview styling: entities saturated at baseline (pinned) fade far back so
  // the ones that actually move with the slider carry the signal; the dashed
  // PREVIEW banner over the map marks the whole state as an estimate.
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded.current) return;
    const pinnedDim = (normal: number, dimmed: number): maplibregl.ExpressionSpecification =>
      ['case', ['==', ['get', 'pinned'], true], dimmed, normal];
    if (m.getLayer('chokepoints-label')) {
      m.setPaintProperty('chokepoints-label', 'icon-opacity', overlayPreview ? pinnedDim(0.95, 0.3) : 1);
      m.setPaintProperty('chokepoints-label', 'text-opacity', overlayPreview ? pinnedDim(0.95, 0.4) : 1);
    }
    if (m.getLayer('routes-line')) {
      m.setPaintProperty('routes-line', 'line-opacity', overlayPreview ? pinnedDim(0.85, 0.25) : 0.95);
    }
    if (m.getLayer('routes-glow')) {
      m.setPaintProperty('routes-glow', 'line-opacity', overlayPreview ? pinnedDim(0.18, 0.05) : 0.18);
    }
  }, [overlayPreview]);

  // Layer toggling: one setLayoutProperty per MapLibre layer in the group.
  useEffect(() => {
    visibleRef.current = visibleLayers;
    const m = map.current;
    if (!m || !loaded.current) return;
    (Object.keys(LAYER_GROUPS) as MapLayerId[]).forEach(group => {
      LAYER_GROUPS[group].forEach(layerId => {
        if (m.getLayer(layerId)) {
          m.setLayoutProperty(layerId, 'visibility', visibleLayers[group] ? 'visible' : 'none');
        }
      });
    });
  }, [visibleLayers]);

  return <div ref={mapContainer} className="absolute inset-0 w-full h-full" />;
}
