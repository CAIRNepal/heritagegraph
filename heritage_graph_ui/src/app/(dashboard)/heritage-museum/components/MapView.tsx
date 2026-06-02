'use client';

import { useEffect, useMemo, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import { HERITAGE_MUSEUM_TILE_LAYER } from '@/lib/map-tiles';

import { NODE_TYPE_CONFIG, type GraphNode } from '../heritage-data';

interface MapViewProps {
  nodes: GraphNode[];
  selectedId: string | null;
  onNodeSelect: (node: GraphNode) => void;
}

// Numbers used for marker geometry. Kept in one place so the icon HTML and the
// click-target offset stay in lockstep.
const MARKER_SIZE = 38;
const MARKER_SIZE_SELECTED = 52;

type LeafletNS = typeof import('leaflet');
type LeafletMap = ReturnType<LeafletNS['map']>;
type LeafletMarker = ReturnType<LeafletNS['marker']>;

function isValidCoord(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const fLat = typeof lat === 'string' ? parseFloat(lat) : (lat as number);
  const fLng = typeof lng === 'string' ? parseFloat(lng) : (lng as number);
  if (!Number.isFinite(fLat) || !Number.isFinite(fLng)) return null;
  if (Math.abs(fLat) > 90 || Math.abs(fLng) > 180) return null;
  return { lat: fLat, lng: fLng };
}

function buildIconHtml(node: GraphNode, selected: boolean): string {
  const cfg = NODE_TYPE_CONFIG[node.nodeType];
  const size = selected ? MARKER_SIZE_SELECTED : MARKER_SIZE;
  const ring = selected
    ? `box-shadow:0 0 0 4px ${cfg.color}55, 0 0 18px ${cfg.color};`
    : `box-shadow:0 0 10px ${cfg.color}99;`;
  return `
    <div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:radial-gradient(circle at 35% 35%, ${cfg.glowColor}, ${cfg.color});
      border:2px solid ${cfg.glowColor};
      ${ring}
      display:flex;align-items:center;justify-content:center;
      font-size:${selected ? 22 : 17}px;cursor:pointer;
      font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif;
      transition:transform 0.2s ease;
    ">${cfg.emoji}</div>
    <div style="
      position:absolute;top:${size + 2}px;left:50%;transform:translateX(-50%);
      white-space:nowrap;font-size:11px;font-weight:600;
      color:${selected ? '#fbbf24' : '#e5e7eb'};
      text-shadow:0 1px 3px #000;pointer-events:none;
    ">${node.label.replace(/[<>]/g, '')}</div>`;
}

export function MapView({ nodes, selectedId, onNodeSelect }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<LeafletNS | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());

  // Filter once per render — same reference identity unless `nodes` changed.
  const geoNodes = useMemo(
    () =>
      nodes
        .map((n) => {
          const coord = isValidCoord(n.lat, n.long);
          return coord ? { node: n, coord } : null;
        })
        .filter((x): x is { node: GraphNode; coord: { lat: number; lng: number } } => x !== null),
    [nodes],
  );

  // Stable signature so we only rebuild markers when the *set* changes, not on
  // every re-render of the parent.
  const geoSignature = useMemo(
    () => geoNodes.map((x) => x.node.id).sort().join(','),
    [geoNodes],
  );

  // ── Init / teardown ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || geoNodes.length === 0) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    import('leaflet').then((mod) => {
      if (cancelled || !containerRef.current) return;
      const L = mod.default ?? mod;
      leafletRef.current = L as unknown as LeafletNS;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current.clear();
      }

      const center: [number, number] = [
        geoNodes.reduce((s, n) => s + n.coord.lat, 0) / geoNodes.length,
        geoNodes.reduce((s, n) => s + n.coord.lng, 0) / geoNodes.length,
      ];

      const map = L.map(containerRef.current, {
        center,
        zoom: 11,
        zoomControl: true,
        attributionControl: true,
      });
      map.getContainer().classList.add('hm-map-root');

      L.tileLayer(HERITAGE_MUSEUM_TILE_LAYER.url, {
        attribution: HERITAGE_MUSEUM_TILE_LAYER.attribution,
        subdomains: HERITAGE_MUSEUM_TILE_LAYER.subdomains,
        maxZoom: HERITAGE_MUSEUM_TILE_LAYER.maxZoom,
      }).addTo(map);

      for (const { node, coord } of geoNodes) {
        const icon = L.divIcon({
          className: 'hm-map-marker',
          html: buildIconHtml(node, node.id === selectedId),
          iconSize: [MARKER_SIZE, MARKER_SIZE],
          iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
        });
        const marker = L.marker([coord.lat, coord.lng], { icon }).addTo(map);
        marker.on('click', () => onNodeSelect(node));
        markersRef.current.set(node.id, marker);
      }

      if (geoNodes.length > 1) {
        const bounds = L.latLngBounds(
          geoNodes.map(({ coord }) => [coord.lat, coord.lng] as [number, number]),
        );
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 });
      }

      const syncMapSize = () => {
        map.invalidateSize();
      };
      syncMapSize();
      window.setTimeout(syncMapSize, 80);

      const host = containerRef.current;
      if (host && typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => syncMapSize());
        resizeObserver.observe(host);
      }
      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      const map = mapRef.current;
      mapRef.current = null;
      markersRef.current.clear();
      map?.remove();
    };
    // We intentionally depend on the *signature*, not the geoNodes array, so
    // identical sets don't trigger a full map teardown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoSignature]);

  // ── Selection: fly + re-icon the affected markers ────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    // Refresh every marker's icon so the old selected one drops its halo.
    for (const { node } of geoNodes) {
      const marker = markersRef.current.get(node.id);
      if (!marker) continue;
      const icon = L.divIcon({
        className: 'hm-map-marker',
        html: buildIconHtml(node, node.id === selectedId),
        iconSize: [MARKER_SIZE, MARKER_SIZE],
        iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
      });
      marker.setIcon(icon);
    }

    if (!selectedId) return;
    const hit = geoNodes.find((g) => g.node.id === selectedId);
    if (hit) {
      map.flyTo([hit.coord.lat, hit.coord.lng], 14, { animate: true, duration: 0.8 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, geoSignature]);

  // ── Empty state ──────────────────────────────────────────────────────────
  if (geoNodes.length === 0) {
    const total = nodes.length;
    return (
      <div
        className="w-full h-full flex items-center justify-center p-6"
        role="status"
        aria-live="polite"
      >
        <div className="max-w-md text-center space-y-2">
          <p className="text-3xl" aria-hidden="true">📍</p>
          <p className="text-gray-300 text-sm font-medium">
            No geo-referenced nodes in the current filter
          </p>
          <p className="text-gray-500 text-xs">
            {total === 0
              ? 'No nodes match the active filters. Try broadening your search.'
              : `${total} node${total === 1 ? '' : 's'} in view, but none carry valid lat/long. Contribute coordinates in the entity editor to see them here.`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" style={{ zIndex: 0 }} />
      <div className="absolute top-3 right-3 z-[400] bg-gray-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 backdrop-blur-sm pointer-events-none">
        <span className="text-white font-semibold">{geoNodes.length}</span>
        {' of '}
        <span className="text-white font-semibold">{nodes.length}</span>
        {' nodes geo-referenced'}
      </div>
    </div>
  );
}
