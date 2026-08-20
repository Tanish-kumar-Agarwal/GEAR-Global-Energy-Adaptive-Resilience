import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DATA_MODE } from '@/lib/config';
import { HACKATHON_MAP_ROUTES } from '@/data/snapshot';

interface Asset {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  capacity: number;
}

export function MapViewer({ assets }: { assets: Asset[] }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (map.current || !mapContainer.current) return; // initialize map only once
    
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json', // Dark theme matching reference
      center: [75.0, 20.0], // Centered on India/Global
      zoom: 1.2, // Zoomed out to show global paths
      attributionControl: false
    });

    const currentMap = map.current;

    currentMap.on('load', () => {
       currentMap.resize();

       // We can add lines (routes) and points (assets) here later
       assets.forEach(asset => {
           const color = asset.type === 'PORT' ? '#3b82f6' : asset.type === 'REFINERY' ? '#eab308' : '#10b981';
           
           // Create a DOM element for each marker.
           const el = document.createElement('div');
           el.className = 'w-3 h-3 rounded-full border border-slate-900 shadow-md';
           el.style.backgroundColor = color;
           
           // Add marker to map
           new maplibregl.Marker(el)
               .setLngLat([asset.lng, asset.lat])
               .setPopup(
                   new maplibregl.Popup({ offset: 15, closeButton: false, className: "bg-slate-800 text-xs border border-slate-600 rounded text-slate-200 p-1" })
                   .setHTML(`<strong>${asset.name}</strong><br/>${asset.type}`)
               )
               .addTo(currentMap);
       });

       if (DATA_MODE === 'HACKATHON_SNAPSHOT') {
           HACKATHON_MAP_ROUTES.forEach((route: any) => {
               // Draw Current Path (Disrupted)
               currentMap.addSource(`${route.id}-current`, {
                   type: 'geojson',
                   data: {
                       type: 'Feature',
                       properties: { name: route.name },
                       geometry: {
                           type: 'LineString',
                           coordinates: route.currentPath
                       }
                   }
               });
               currentMap.addLayer({
                   id: `${route.id}-current-line`,
                   type: 'line',
                   source: `${route.id}-current`,
                   layout: { 'line-join': 'round', 'line-cap': 'round' },
                   paint: { 'line-color': '#ef4444', 'line-width': 2, 'line-opacity': 0.7 }
               });

               // Draw Alternative Path (Mitigation)
               currentMap.addSource(`${route.id}-alternative`, {
                   type: 'geojson',
                   data: {
                       type: 'Feature',
                       properties: { name: route.name + ' Alt' },
                       geometry: {
                           type: 'LineString',
                           coordinates: route.alternativePath
                       }
                   }
               });
               currentMap.addLayer({
                   id: `${route.id}-alternative-line`,
                   type: 'line',
                   source: `${route.id}-alternative`,
                   layout: { 'line-join': 'round', 'line-cap': 'round' },
                   paint: { 'line-color': '#10b981', 'line-width': 2, 'line-opacity': 0.7, 'line-dasharray': [2, 2] }
               });
           });

           // Add hover popups for routes
           const popup = new maplibregl.Popup({
               closeButton: false,
               closeOnClick: false,
               className: "bg-slate-800 text-xs border border-slate-600 rounded text-slate-200 p-1"
           });

           HACKATHON_MAP_ROUTES.forEach((route: any) => {
               const layers = [`${route.id}-current-line`, `${route.id}-alternative-line`];
               layers.forEach(layer => {
                   currentMap.on('mouseenter', layer, (e) => {
                       currentMap.getCanvas().style.cursor = 'pointer';
                       const description = e.features![0].properties.name;
                       popup.setLngLat(e.lngLat).setHTML(`<strong>${description}</strong>`).addTo(currentMap);
                   });
                   currentMap.on('mouseleave', layer, () => {
                       currentMap.getCanvas().style.cursor = '';
                       popup.remove();
                   });
               });
           });
       }
    });

    return () => {
      currentMap.remove();
      map.current = null;
    };
  }, [assets]);

  return (
    <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
  );
}
