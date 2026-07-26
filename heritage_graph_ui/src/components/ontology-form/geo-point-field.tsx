"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { OPENSTREETMAP_TILE_LAYER } from "@/lib/map-tiles";
import { MAP_DEFAULT } from "@/lib/map-config";

type LatLng = { lat?: string; lng?: string };

interface GeoPointFieldProps {
  idPrefix: string;
  value: LatLng | null | undefined;
  onChange: (next: LatLng) => void;
  disabled?: boolean;
  errorRing?: string;
  /** When map tiles fail (offline), show manual inputs only */
  preferInputsOnly?: boolean;
}

/**
 * Leaflet map picker + lat/lng inputs + optional GPS.
 * Leaflet is loaded dynamically so SSR bundles stay small.
 */
export function GeoPointField({
  idPrefix,
  value,
  onChange,
  disabled,
  errorRing,
  preferInputsOnly = false,
}: GeoPointFieldProps) {
  const mapHostRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const lat = value?.lat ?? "";
  const lng = value?.lng ?? "";

  const syncMarker = useCallback(
    (L: typeof import("leaflet"), latNum: number, lngNum: number) => {
      const map = mapInstanceRef.current;
      // Guard: setView during/after teardown throws `_leaflet_pos` of undefined.
      if (!map || !(map as unknown as { _loaded?: boolean })._loaded) return;
      if (!markerRef.current) {
        markerRef.current = L.marker([latNum, lngNum]).addTo(map);
      } else {
        markerRef.current.setLatLng([latNum, lngNum]);
      }
      map.setView([latNum, lngNum], map.getZoom() > 14 ? map.getZoom() : 15);
    },
    []
  );

  useEffect(() => {
    if (preferInputsOnly || disabled) return;
    let cancelled = false;
    (async () => {
      try {
        const L = await import("leaflet");
        await import("leaflet/dist/leaflet.css");
        // Webpack rewrites leaflet's relative image paths against the page URL
        // (`/contribute/...`), so markers 404 unless we pin absolute asset URLs.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });
        if (cancelled || !mapHostRef.current) return;
        const el = mapHostRef.current;
        const initLat = parseFloat(String(value?.lat ?? "").replace(",", "."));
        const initLng = parseFloat(String(value?.lng ?? "").replace(",", "."));
        const hasValue = Number.isFinite(initLat) && Number.isFinite(initLng);
        // When the field has no value, open at the deployment's configured default
        // (a neutral world view unless re-homed via NEXT_PUBLIC_MAP_DEFAULT_*).
        const center: [number, number] = hasValue
          ? [initLat, initLng]
          : [MAP_DEFAULT.lat, MAP_DEFAULT.lon];
        const map = L.map(el, {
          zoomControl: true,
          attributionControl: true,
        }).setView(center, hasValue ? 12 : MAP_DEFAULT.zoom);
        L.tileLayer(OPENSTREETMAP_TILE_LAYER.url, {
          maxZoom: OPENSTREETMAP_TILE_LAYER.maxZoom,
          attribution: OPENSTREETMAP_TILE_LAYER.attribution,
        }).addTo(map);
        map.on("click", (e) => {
          const { lat: la, lng: ln } = e.latlng;
          onChange({ lat: la.toFixed(6), lng: ln.toFixed(6) });
          syncMarker(L, la, ln);
        });
        mapInstanceRef.current = map;
        if (Number.isFinite(initLat) && Number.isFinite(initLng)) {
          syncMarker(L, initLat, initLng);
        }
        setTimeout(() => {
          if (!cancelled && mapInstanceRef.current === map) {
            try {
              map.invalidateSize();
            } catch {
              /* map already removed */
            }
          }
        }, 50);
        setMapReady(true);
      } catch {
        if (!cancelled) setMapError("Map unavailable; use coordinates below.");
      }
    })();
    return () => {
      cancelled = true;
      const map = mapInstanceRef.current;
      mapInstanceRef.current = null;
      markerRef.current = null;
      try {
        map?.stop();
        map?.remove();
      } catch {
        /* zoom transition can throw `_leaflet_pos` after unmount */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map init once; marker syncs in a separate effect
  }, [disabled, onChange, preferInputsOnly, syncMarker]);

  useEffect(() => {
    if (!mapReady || mapError) return;
    if (!mapInstanceRef.current) return;
    const latNum = parseFloat(String(lat).replace(",", "."));
    const lngNum = parseFloat(String(lng).replace(",", "."));
    if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
      void import("leaflet").then((Mod) => syncMarker(Mod, latNum, lngNum));
    }
  }, [lat, lng, mapReady, mapError, syncMarker]);

  const useGps = () => {
    if (!navigator.geolocation) {
      setMapError("Geolocation not supported in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = pos.coords.latitude.toFixed(6);
        const ln = pos.coords.longitude.toFixed(6);
        onChange({ lat: la, lng: ln });
        setMapError(null);
      },
      () => setMapError("Could not read GPS position (permission denied or unavailable).")
    );
  };

  return (
    <div className="space-y-2">
      {!preferInputsOnly && !disabled ? (
        <div className="space-y-1">
          <div
            ref={mapHostRef}
            className={cn(
              "h-48 w-full overflow-hidden rounded-md border bg-muted/40",
              mapError && "hidden"
            )}
            aria-label="Map: click to set coordinates"
          />
          {mapError ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">{mapError}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={useGps} disabled={disabled}>
              Use my GPS
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Input
          id={`${idPrefix}-lat`}
          type="text"
          inputMode="decimal"
          value={lat}
          onChange={(e) => onChange({ ...value, lat: e.target.value, lng })}
          placeholder="Latitude"
          disabled={disabled}
          className={errorRing}
        />
        <Input
          id={`${idPrefix}-lng`}
          type="text"
          inputMode="decimal"
          value={lng}
          onChange={(e) => onChange({ ...value, lat, lng: e.target.value })}
          placeholder="Longitude"
          disabled={disabled}
          className={errorRing}
        />
      </div>
    </div>
  );
}
