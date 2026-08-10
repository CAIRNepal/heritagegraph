'use client';

import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Home,
  Layers as LayersIcon,
  Map as MapIcon,
  Maximize,
  Minimize,
  Minus,
  MoonStar,
  Plus,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import { useAtlasStore } from '../../hooks/use-atlas-store';
import { useAtlasUiStore } from '../../hooks/use-atlas-ui-store';
import { ATLAS_GLASS } from '../../lib/atlas-format';
import { ATLAS_IMAGERY_LAYERS } from '../../lib/atlas-layers';

interface LayersProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

function ControlButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={cn(
        'h-9 w-9 rounded-xl text-foreground/80 hover:bg-muted/60 hover:text-foreground',
        active && 'bg-primary/15 text-primary',
      )}
    >
      {children}
    </Button>
  );
}

/** Floating globe controls (zoom / home / fullscreen) + the layers drawer. */
export function Layers({
  onZoomIn,
  onZoomOut,
  onResetView,
  isFullscreen,
  onToggleFullscreen,
}: LayersProps) {
  const t = useTranslations('Atlas');
  const layersOpen = useAtlasUiStore((s) => s.layersOpen);
  const setLayersOpen = useAtlasUiStore((s) => s.setLayersOpen);
  const imageryLayer = useAtlasUiStore((s) => s.imageryLayer);
  const setImageryLayer = useAtlasUiStore((s) => s.setImageryLayer);
  const nightLights = useAtlasUiStore((s) => s.nightLights);
  const toggleNightLights = useAtlasUiStore((s) => s.toggleNightLights);
  const boundaries = useAtlasUiStore((s) => s.boundaries);
  const toggleBoundaries = useAtlasUiStore((s) => s.toggleBoundaries);
  const showLegend = useAtlasUiStore((s) => s.showLegend);
  const toggleLegend = useAtlasUiStore((s) => s.toggleLegend);
  const showMiniMap = useAtlasUiStore((s) => s.showMiniMap);
  const toggleMiniMap = useAtlasUiStore((s) => s.toggleMiniMap);
  const muted = useAtlasStore((s) => s.muted);
  const setMuted = useAtlasStore((s) => s.setMuted);

  return (
    <>
      <div
        className={cn(
          ATLAS_GLASS,
          'pointer-events-auto absolute right-4 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-0.5 p-1',
        )}
        role="toolbar"
        aria-label={t('layers.globeControls')}
      >
        <ControlButton label={t('layers.zoomIn')} onClick={onZoomIn}>
          <Plus className="h-4 w-4" strokeWidth={1.5} />
        </ControlButton>
        <ControlButton label={t('layers.zoomOut')} onClick={onZoomOut}>
          <Minus className="h-4 w-4" strokeWidth={1.5} />
        </ControlButton>
        <ControlButton label={t('layers.resetView')} onClick={onResetView}>
          <Home className="h-4 w-4" strokeWidth={1.5} />
        </ControlButton>
        <div className="mx-1.5 my-0.5 h-px bg-border/50" />
        <ControlButton label="Layers" onClick={() => setLayersOpen(!layersOpen)} active={layersOpen}>
          <LayersIcon className="h-4 w-4" strokeWidth={1.5} />
        </ControlButton>
        <ControlButton
          label={isFullscreen ? t('layers.exitFullscreen') : t('layers.fullscreen')}
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? (
            <Minimize className="h-4 w-4" strokeWidth={1.5} />
          ) : (
            <Maximize className="h-4 w-4" strokeWidth={1.5} />
          )}
        </ControlButton>
      </div>

      <AnimatePresence>
        {layersOpen ? (
          <motion.section
            key="layers-panel"
            initial={{ opacity: 0, x: 18, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 18, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            aria-label={t('layers.mapLayers')}
            className={cn(
              ATLAS_GLASS,
              'pointer-events-auto absolute right-[4.5rem] top-1/2 z-40 w-64 -translate-y-1/2 p-4',
            )}
          >
            <h3 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold tracking-tight">
              <MapIcon className="h-3.5 w-3.5" strokeWidth={1.5} /> Layers
            </h3>

            <div className="grid grid-cols-2 gap-1.5">
              {ATLAS_IMAGERY_LAYERS.map((layer) => (
                <button
                  key={layer.id}
                  type="button"
                  aria-pressed={imageryLayer === layer.id}
                  onClick={() => setImageryLayer(layer.id)}
                  className={cn(
                    'rounded-xl border px-2.5 py-2 text-left transition-colors',
                    imageryLayer === layer.id
                      ? 'border-primary/45 bg-primary/12 text-primary'
                      : 'border-border/50 bg-muted/30 text-muted-foreground hover:text-foreground',
                  )}
                >
                  <p className="text-[12px] font-medium leading-tight">{layer.label}</p>
                  <p className="mt-0.5 truncate text-[9px] opacity-70">{layer.description}</p>
                </button>
              ))}
            </div>

            <div className="mt-3 space-y-2.5 border-t border-border/40 pt-3">
              <label className="flex items-center justify-between gap-3 text-[12px] font-medium">
                <span className="flex items-center gap-1.5">
                  <MoonStar className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                  Night city lights
                </span>
                <Switch checked={nightLights} onCheckedChange={toggleNightLights} />
              </label>
              <label className="flex items-center justify-between gap-3 text-[12px] font-medium">
                <span>Borders & place names</span>
                <Switch checked={boundaries} onCheckedChange={toggleBoundaries} />
              </label>
              <label className="flex items-center justify-between gap-3 text-[12px] font-medium">
                <span>{t('legend.title')}</span>
                <Switch checked={showLegend} onCheckedChange={toggleLegend} />
              </label>
              <label className="flex items-center justify-between gap-3 text-[12px] font-medium">
                <span>{t('layers.miniMap')}</span>
                <Switch checked={showMiniMap} onCheckedChange={toggleMiniMap} />
              </label>
              <label className="flex items-center justify-between gap-3 text-[12px] font-medium">
                <span>{t('layers.sounds')}</span>
                <Switch checked={!muted} onCheckedChange={(v) => setMuted(!v)} />
              </label>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </>
  );
}
