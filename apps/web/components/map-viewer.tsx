import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

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
      center: [45.0, 20.0], // Centered roughly on Middle East/Global
      zoom: 1.5,
      attributionControl: false
    });

    map.current.on('load', () => {
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
               .addTo(map.current!);
       });
    });

  }, [assets]);

  return (
    <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
  );
}
