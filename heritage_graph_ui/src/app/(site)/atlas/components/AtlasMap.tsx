'use client';

/**
 * The atlas map: Nepal in shaded relief, every located record as a marker.
 *
 * Leaflet with two baked relief images (tools/bake_atlas_relief.py) instead of
 * a tile server, so the map is legible and quick: ~0.5 MB for the whole basemap
 * against the old globe's ~4 MB of Cesium and ~175 tile requests. A Streets
 * layer (OpenStreetMap, or NEXT_PUBLIC_MAP_TILE_URL) is one click away for
 * finding the way to a place.
 *
 * Markers near each other at the current zoom merge into a numbered cluster
 * that zooms in when clicked. Labels that would overlap are hidden, the
 * selected place's label first in line to stay. The selected place draws
 * dashed lines to the places it is connected to, labelled with the distance.
 *
 * The map is a picture of the list beside it: every place on it can also be
 * reached from the list by keyboard and screen reader.
 */

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import type { AtlasPlace } from '@/lib/heritage-atlas/atlas-model';
import { NEPAL_BOUNDS, VALLEY_BOUNDS, distanceKm } from '@/lib/heritage-atlas/atlas-model';
import { NEPAL_OUTLINE } from '@/lib/heritage-museum/nepal-outline';
import { HERITAGE_MUSEUM_TILE_LAYER } from '@/lib/map-tiles';

export interface ReliefMeta {
  nepal: { image: string; bounds: [[number, number], [number, number]] };
  valley: { image: string; bounds: [[number, number], [number, number]] };
}

export type MapCommand = { kind: 'nepal' | 'valley' } | { kind: 'fit'; points: { lat: number; lon: number }[] };

interface AtlasMapProps {
  places: AtlasPlace[];
  selectedId: string | null;
  onSelect: (place: AtlasPlace) => void;
  colorOf: (place: AtlasPlace) => string;
  /** Located places connected to the selected one; drawn as lines. */
  linked: AtlasPlace[];
  relief: ReliefMeta | null;
  basemap: 'terrain' | 'streets';
  command: (MapCommand & { n: number }) | null;
  /** False while the selection is only the default, so the page opens on all of Nepal. */
  followSelection: boolean;
  formatKm: (km: number) => string;
  labels: { mapAria: string; cluster: (n: number) => string; attribution: string };
}

const CLUSTER_PX = 34;
const asBounds = (b: { west: number; east: number; south: number; north: number }) =>
  L.latLngBounds([b.south, b.west], [b.north, b.east]);

export function AtlasMap({ places, selectedId, onSelect, colorOf, linked, relief, basemap, command, followSelection, formatKm, labels }: AtlasMapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const reliefRef = useRef<L.ImageOverlay[]>([]);
  const streetsRef = useRef<L.TileLayer | null>(null);
  const placesLayer = useRef<L.LayerGroup | null>(null);
  const linksLayer = useRef<L.LayerGroup | null>(null);
  const [zoomTick, setZoomTick] = useState(0);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── map, once ──
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const map = L.map(el, {
      zoomControl: false,
      attributionControl: true,
      minZoom: 6,
      maxZoom: 16,
      zoomSnap: 0.25,
      maxBounds: L.latLngBounds([24.5, 77.5], [32.3, 90.8]),
      maxBoundsViscosity: 0.8,
    });
    map.attributionControl.setPrefix(false);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    map.createPane('relief').style.zIndex = '250';
    map.createPane('shroud').style.zIndex = '300';
    map.createPane('links').style.zIndex = '420';
    map.createPane('places').style.zIndex = '450';
    map.fitBounds(asBounds(NEPAL_BOUNDS), { padding: [8, 8] });

    const nepal = NEPAL_OUTLINE.map(([lon, lat]) => L.latLng(lat, lon));
    const world = [L.latLng(10, 60), L.latLng(10, 110), L.latLng(45, 110), L.latLng(45, 60)];
    L.polygon([world, nepal], { pane: 'shroud', className: 'atlas-shroud', interactive: false, stroke: false }).addTo(map);
    L.polyline([...nepal, nepal[0]], { pane: 'shroud', className: 'atlas-border', interactive: false }).addTo(map);

    linksLayer.current = L.layerGroup().addTo(map);
    placesLayer.current = L.layerGroup().addTo(map);
    map.on('zoomend', () => setZoomTick((n) => n + 1));
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    mapRef.current = map;
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── relief images ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !relief) return;
    const overlays = [relief.nepal, relief.valley].map((r, i) =>
      L.imageOverlay(`/atlas/${r.image}`, r.bounds, {
        pane: 'relief',
        className: 'atlas-relief',
        attribution: i === 0 ? labels.attribution : undefined,
        interactive: false,
      }).addTo(map),
    );
    reliefRef.current = overlays;
    return () => overlays.forEach((o) => o.remove());
  }, [relief, labels.attribution]);

  // ── base map ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (basemap === 'streets') {
      streetsRef.current ??= L.tileLayer(HERITAGE_MUSEUM_TILE_LAYER.url, {
        attribution: HERITAGE_MUSEUM_TILE_LAYER.attribution,
        maxZoom: HERITAGE_MUSEUM_TILE_LAYER.maxZoom,
        className: 'atlas-streets',
      });
      streetsRef.current.addTo(map);
      reliefRef.current.forEach((o) => o.setOpacity(0));
    } else {
      streetsRef.current?.remove();
      reliefRef.current.forEach((o) => o.setOpacity(1));
    }
  }, [basemap, relief]);

  // ── markers, clusters, labels ──
  useEffect(() => {
    const map = mapRef.current;
    const layer = placesLayer.current;
    if (!map || !layer) return;
    layer.clearLayers();

    // Greedy clustering in screen space at this zoom. The selected place leads
    // its group so it is never hidden inside someone else's cluster.
    const order = [...places].sort((a, b) => Number(b.node.id === selectedId) - Number(a.node.id === selectedId));
    const pts = order.map((p) => map.latLngToLayerPoint([p.lat, p.lon]));
    const taken = new Array(order.length).fill(false);
    const groups: number[][] = [];
    order.forEach((_, i) => {
      if (taken[i]) return;
      const g = [i];
      taken[i] = true;
      order.forEach((_, j) => {
        if (!taken[j] && pts[i].distanceTo(pts[j]) < CLUSTER_PX) {
          taken[j] = true;
          g.push(j);
        }
      });
      groups.push(g);
    });

    const tooltips: { el: HTMLElement; priority: number }[] = [];
    for (const g of groups) {
      if (g.length > 1) {
        const members = g.map((i) => order[i]);
        const hasSel = members.some((p) => p.node.id === selectedId);
        const lat = members.reduce((s, p) => s + p.lat, 0) / members.length;
        const lon = members.reduce((s, p) => s + p.lon, 0) / members.length;
        const size = Math.round(30 + Math.sqrt(members.length) * 5);
        const marker = L.marker([lat, lon], {
          pane: 'places',
          icon: L.divIcon({
            className: '',
            html: `<span class="atlas-cluster${hasSel ? ' is-selected' : ''}" style="width:${size}px;height:${size}px">${members.length}</span>`,
            iconSize: [size, size],
          }),
          title: labels.cluster(members.length),
          alt: labels.cluster(members.length),
          keyboard: true,
        });
        const b = L.latLngBounds(members.map((p) => [p.lat, p.lon] as [number, number]));
        // Records on (almost) the same spot never separate by zooming — several
        // share a site-level coordinate — so those open a list to pick from.
        const sameSpot = map.distance(b.getSouthWest(), b.getNorthEast()) < 60 || map.getZoom() >= 14.5;
        if (sameSpot) {
          const box = document.createElement('div');
          box.className = 'atlas-pick';
          for (const m of [...members].sort((x, y) => x.node.label.localeCompare(y.node.label))) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = m.node.label;
            btn.addEventListener('click', () => {
              map.closePopup();
              onSelectRef.current(m);
            });
            box.appendChild(btn);
          }
          marker.bindPopup(box, { className: 'atlas-pick-popup', closeButton: true, autoPan: true });
        } else {
          marker.on('click', () => {
            if (reduced) map.fitBounds(b, { padding: [70, 70], maxZoom: 15 });
            else map.flyToBounds(b, { padding: [70, 70], maxZoom: 15, duration: 0.6 });
          });
        }
        layer.addLayer(marker);
        continue;
      }
      const p = order[g[0]];
      const sel = p.node.id === selectedId;
      if (sel) layer.addLayer(L.circleMarker([p.lat, p.lon], { pane: 'places', radius: 16, className: 'atlas-ring', interactive: false }));
      const dot = L.circleMarker([p.lat, p.lon], {
        pane: 'places',
        radius: sel ? 9 : 7,
        className: sel ? 'atlas-dot is-selected' : 'atlas-dot',
        fillColor: colorOf(p),
        fillOpacity: 1,
      });
      dot.on('click', () => onSelectRef.current(p));
      dot.bindTooltip(p.node.label, { permanent: true, direction: 'right', offset: [9, 0], className: sel ? 'atlas-label is-selected' : 'atlas-label', interactive: false });
      layer.addLayer(dot);
      const el = dot.getTooltip()?.getElement();
      if (el) tooltips.push({ el, priority: sel ? 2 : 0 });
    }

    // Hide labels that would overprint one already placed.
    requestAnimationFrame(() => {
      const placed: DOMRect[] = [];
      tooltips
        .sort((a, b) => b.priority - a.priority)
        .forEach(({ el }) => {
          const r = el.getBoundingClientRect();
          const hit = placed.some((q) => r.left < q.right + 2 && r.right > q.left - 2 && r.top < q.bottom && r.bottom > q.top);
          el.style.visibility = hit ? 'hidden' : 'visible';
          if (!hit) placed.push(r);
        });
    });
  }, [places, selectedId, colorOf, zoomTick, labels, reduced]);

  // ── connection lines ──
  useEffect(() => {
    const map = mapRef.current;
    const layer = linksLayer.current;
    const sel = places.find((p) => p.node.id === selectedId);
    if (!map || !layer) return;
    layer.clearLayers();
    if (!sel) return;
    for (const t of linked) {
      if (t.node.id === sel.node.id) continue;
      layer.addLayer(L.polyline([[sel.lat, sel.lon], [t.lat, t.lon]], { pane: 'links', className: 'atlas-link', interactive: false }));
      const km = distanceKm(sel, t);
      // A label needs room: on a line a few pixels long it only covers markers.
      const px = map.latLngToLayerPoint([sel.lat, sel.lon]).distanceTo(map.latLngToLayerPoint([t.lat, t.lon]));
      if (km >= 3 && px >= 70) {
        layer.addLayer(
          L.tooltip({ permanent: true, direction: 'center', className: 'atlas-link-label', interactive: false })
            .setLatLng([(sel.lat + t.lat) / 2, (sel.lon + t.lon) / 2])
            .setContent(formatKm(km)),
        );
      }
    }
  }, [places, selectedId, linked, formatKm, zoomTick]);

  // ── bring the selected place into view ──
  useEffect(() => {
    const map = mapRef.current;
    const sel = places.find((p) => p.node.id === selectedId);
    if (!map || !sel || !followSelection) return;
    const ll = L.latLng(sel.lat, sel.lon);
    const target = sel.inValley ? Math.max(map.getZoom(), 12.5) : Math.max(map.getZoom(), 8);
    if (map.getZoom() >= target && map.getBounds().pad(-0.15).contains(ll)) return;
    if (reduced) map.setView(ll, target);
    else map.flyTo(ll, target, { duration: 0.8 });
    // Only on selection change; zooming by hand must not snap back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, followSelection]);

  // ── explicit moves from the controls ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !command) return;
    const b =
      command.kind === 'fit'
        ? L.latLngBounds(command.points.map((p) => [p.lat, p.lon] as [number, number]))
        : asBounds(command.kind === 'nepal' ? NEPAL_BOUNDS : VALLEY_BOUNDS);
    const opts = { padding: [40, 40] as [number, number], maxZoom: 13 };
    if (reduced) map.fitBounds(b, opts);
    else map.flyToBounds(b, { ...opts, duration: 0.7 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command?.n]);

  return <div ref={hostRef} role="region" aria-label={labels.mapAria} className="atlas-map absolute inset-0" />;
}
