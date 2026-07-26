'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';

import { useShallow } from 'zustand/react/shallow';

import type { AtlasGlobeHandles } from '@/app/(dashboard)/atlas/globe-handles';
import { cn } from '@/lib/utils';

import { useAtlasStore } from '../../hooks/use-atlas-store';
import { useAtlasUiStore } from '../../hooks/use-atlas-ui-store';
import { ATLAS_GLASS } from '../../lib/atlas-format';
import { markerStyleForEntity } from '../HeritageGlobe/marker-config';

const MAP_W = 184;
const MAP_H = 184;
const WORLD_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/0/0/0';

/** Web-mercator projection into minimap pixel space. */
function project(lat: number, lon: number): { x: number; y: number } {
  const x = ((lon + 180) / 360) * MAP_W;
  const clamped = Math.max(-85, Math.min(85, lat));
  const rad = (clamped * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * MAP_H;
  return { x, y };
}

function unproject(x: number, y: number): { lat: number; lon: number } {
  const lon = (x / MAP_W) * 360 - 180;
  const n = Math.PI * (1 - (2 * y) / MAP_H);
  const lat = (Math.atan(Math.sinh(n)) * 180) / Math.PI;
  return { lat, lon };
}

interface MiniMapProps {
  globeHandlesRef: RefObject<AtlasGlobeHandles | null>;
}

/** Overview world map: heritage dots + live camera crosshair; click to fly. */
export function MiniMap({ globeHandlesRef }: MiniMapProps) {
  const entities = useAtlasStore(useShallow((s) => s.getGlobeEntities()));
  const show = useAtlasUiStore((s) => s.showMiniMap);
  const cameraCenter = useAtlasUiStore((s) => s.cameraCenter);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tileRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = WORLD_TILE_URL;
    img.onload = () => {
      tileRef.current = img;
      draw();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = MAP_W * dpr;
    canvas.height = MAP_H * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#060b16';
    ctx.fillRect(0, 0, MAP_W, MAP_H);
    if (tileRef.current) {
      ctx.globalAlpha = 0.55;
      ctx.drawImage(tileRef.current, 0, 0, MAP_W, MAP_H);
      ctx.globalAlpha = 1;
    }

    for (const e of entities) {
      if (e.lat == null || e.lon == null) continue;
      const { x, y } = project(e.lat, e.lon);
      ctx.beginPath();
      ctx.arc(x, y, 1.4, 0, Math.PI * 2);
      ctx.fillStyle = markerStyleForEntity(e).color;
      ctx.fill();
    }

    if (cameraCenter) {
      const { x, y } = project(cameraCenter.lat, cameraCenter.lon);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 9, y);
      ctx.lineTo(x + 9, y);
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x, y + 9);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  };

  useEffect(() => {
    if (show) draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, entities, cameraCenter]);

  return (
    <AnimatePresence>
      {show ? (
        <motion.button
          key="minimap"
          type="button"
          aria-label="Overview map — click to fly"
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          className={cn(
            ATLAS_GLASS,
            'pointer-events-auto absolute bottom-28 right-4 z-20 hidden overflow-hidden p-1 lg:block',
          )}
          onClick={(ev) => {
            const rect = ev.currentTarget.getBoundingClientRect();
            const { lat, lon } = unproject(
              ev.clientX - rect.left - 4,
              ev.clientY - rect.top - 4,
            );
            globeHandlesRef.current?.flyToCoords(lon, lat, 2_400_000);
          }}
        >
          <canvas
            ref={canvasRef}
            style={{ width: MAP_W, height: MAP_H }}
            className="rounded-xl"
          />
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}
