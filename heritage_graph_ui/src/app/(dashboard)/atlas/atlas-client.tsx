'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';

import type { AtlasGlobeHandles } from '@/app/(dashboard)/atlas/globe-handles';

import { atlasSound } from '@/lib/atlas-sound';

import { AtlasGlobeLoading } from './components/atlas-loading-fallbacks';
import { EntityPanel } from './components/entity-panel';
import { FocusedShellOverlay } from './components/globe-workspace';
import { ShortcutHelpOverlay } from './components/shortcut-help';
import { CommandBar } from './components/status-strip';
import { TimelineBar } from './components/timeline-bar';
import { useAtlasShortcuts } from './hooks/use-atlas-shortcuts';
import { useAtlasStore } from './hooks/use-atlas-store';
import { useFullscreen } from './hooks/use-fullscreen';
import { cssFilterForPreset } from './lib/atlas-fx-presets';
import { ATLAS_SPOTLIGHT } from './lib/atlas-spotlight-config';

/** Isolate Cesium/resium + worker boot from the main atlas chunk (avoids SSR/webpack runtime issues). */
const GlobeView = dynamic(
  () => import('./views/globe-view').then((m) => ({ default: m.GlobeView })),
  {
    ssr: false,
    loading: () => <AtlasGlobeLoading />,
  },
);

export default function AtlasClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeHandlesRef = useRef<AtlasGlobeHandles | null>(null);

  const playing = useAtlasStore((s) => s.playing);
  const stepTimeline = useAtlasStore((s) => s.stepTimeline);
  const fxPreset = useAtlasStore((s) => s.fxPreset);

  const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef);

  useAtlasShortcuts({ containerRef, globeHandlesRef });

  useEffect(() => {
    useAtlasStore.getState().hydrateMuteFromBrowser();
    useAtlasStore.getState().hydrateAtlasFxFromStorage();
    atlasSound.init();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Seed the static gutter CSS vars; SpotlightDisc ResizeObserver will override with real values
    el.style.setProperty('--atlas-gutter-l', `${String(ATLAS_SPOTLIGHT.gutterLeftPx)}px`);
    el.style.setProperty('--atlas-gutter-r', `${String(ATLAS_SPOTLIGHT.gutterRightPx)}px`);
    el.style.setProperty('--atlas-gutter-b', `${String(ATLAS_SPOTLIGHT.gutterBottomPx)}px`);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => stepTimeline(), 420);
    return () => window.clearInterval(id);
  }, [playing, stepTimeline]);

  return (
    <>
      <div
        ref={containerRef}
        style={
          {
            '--atlas-fx-filter': cssFilterForPreset(fxPreset),
          } as CSSProperties
        }
        className={[
          'atlas-shell-grid flex flex-col relative flex-1 w-full h-full overflow-hidden bg-background',
          isFullscreen ? 'fixed inset-0 z-50' : '',
        ].filter(Boolean).join(' ')}
      >
        <CommandBar isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} />

        <div className="relative min-h-0 flex-1 w-full h-full">
          <GlobeView globeHandlesRef={globeHandlesRef} shellRef={containerRef} />
          {/* Full-shell maximized panel — outside the disc mask, covers the full area below the CommandBar */}
          <FocusedShellOverlay />
          <EntityPanel />
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
          <TimelineBar />
        </div>
      </div>

      <ShortcutHelpOverlay />
    </>
  );
}
