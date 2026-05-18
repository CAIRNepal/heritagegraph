'use client';

import { useEffect, useRef } from 'react';
import { NODE_TYPE_CONFIG, type GraphNode } from '../heritage-data';

interface MapViewProps {
  nodes: GraphNode[];
  selectedId: string | null;
  onNodeSelect: (node: GraphNode) => void;
}

export function MapView({ nodes, selectedId, onNodeSelect }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map());

  const geoNodes = nodes.filter((n) => n.lat && n.long);

  useEffect(() => {
    if (!containerRef.current || geoNodes.length === 0) return;

    let mounted = true;

    import('leaflet').then((L) => {
      if (!mounted || !containerRef.current) return;

      // Inject CSS once
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Destroy previous map instance
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current.clear();
      }

      const center: [number, number] =
        geoNodes.length > 0
          ? [
              geoNodes.reduce((s, n) => s + parseFloat(n.lat!), 0) / geoNodes.length,
              geoNodes.reduce((s, n) => s + parseFloat(n.long!), 0) / geoNodes.length,
            ]
          : [27.72, 85.32];

      const map = L.default.map(containerRef.current, {
        center,
        zoom: 11,
        zoomControl: true,
        attributionControl: true,
      });

      L.default.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
          attribution: '© OpenStreetMap © CARTO',
          subdomains: 'abcd',
          maxZoom: 19,
        },
      ).addTo(map);

      mapRef.current = map;

      for (const node of geoNodes) {
        const cfg = NODE_TYPE_CONFIG[node.nodeType];
        const lat = parseFloat(node.lat!);
        const lng = parseFloat(node.long!);

        const icon = L.default.divIcon({
          className: '',
          html: `
            <div style="
              width:38px; height:38px; border-radius:50%;
              background:radial-gradient(circle at 35% 35%, ${cfg.glowColor}, ${cfg.color});
              border:2px solid ${cfg.glowColor};
              box-shadow:0 0 10px ${cfg.color}99;
              display:flex; align-items:center; justify-content:center;
              font-size:17px; cursor:pointer;
            ">${cfg.emoji}</div>
            <div style="
              position:absolute; top:40px; left:50%; transform:translateX(-50%);
              white-space:nowrap; font-size:11px; font-weight:600; color:#e5e7eb;
              text-shadow:0 1px 3px #000; pointer-events:none;
            ">${node.label}</div>`,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        });

        const marker = L.default.marker([lat, lng], { icon });
        marker.addTo(map);
        marker.on('click', () => onNodeSelect(node));

        markersRef.current.set(node.id, marker);
      }
    });

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current.clear();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoNodes.map((n) => n.id).join(',')]);

  // Fly to selected node
  useEffect(() => {
    if (!mapRef.current || !selectedId) return;
    const node = geoNodes.find((n) => n.id === selectedId);
    if (node?.lat && node?.long) {
      mapRef.current.flyTo([parseFloat(node.lat), parseFloat(node.long)], 14, {
        animate: true,
        duration: 0.8,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  if (geoNodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-gray-500 text-sm">No nodes with geographic coordinates in current filter.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" style={{ zIndex: 0 }} />
      {/* Overlay: geo node count */}
      <div className="absolute top-3 right-3 z-[400] bg-gray-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 backdrop-blur-sm pointer-events-none">
        <span className="text-white font-semibold">{geoNodes.length}</span> geo-referenced nodes
      </div>
    </div>
  );
}
