'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef } from 'react';

import type { AtlasGlobeHandles } from '@/app/(site)/atlas/globe-handles';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { atlasSound } from '@/lib/atlas-sound';

import { AtlasGlobeLoading } from './components/atlas-loading-fallbacks';
import { EmptyState } from './components/EmptyState';
import { MarkerTooltip } from './components/HeritageGlobe/MarkerTooltip';
import { SampleDataBanner } from './components/SampleDataBanner';
import { EntityDetailsContent, EntitySidebar } from './components/Sidebar/EntitySidebar';
import { ExplorerSidebar } from './components/Sidebar/ExplorerSidebar';
import { Filters } from './components/Search/Filters';
import { Layers } from './components/Search/Layers';
import { Legend } from './components/Search/Legend';
import { MiniMap } from './components/Search/MiniMap';
import { SpotlightSearch } from './components/Search/SpotlightSearch';
import { StoryMode, buildJourneyStops } from './components/Timeline/StoryMode';
import { Timeline } from './components/Timeline/Timeline';
import { useAtlasDataSource } from './hooks/use-atlas-data-source';
import { useAtlasHotkeys } from './hooks/use-atlas-hotkeys';
import { useAtlasStore } from './hooks/use-atlas-store';
import { useAtlasUiStore } from './hooks/use-atlas-ui-store';
import { useAtlasUrlState } from './hooks/use-atlas-url-state';
import { useFullscreen } from './hooks/use-fullscreen';

/** Isolate Cesium/resium + worker boot from the main atlas chunk. */
const GlobeView = dynamic(
  () => import('./views/globe-view').then((m) => ({ default: m.GlobeView })),
  { ssr: false, loading: () => <AtlasGlobeLoading /> },
);

export default function AtlasClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeHandlesRef = useRef<AtlasGlobeHandles | null>(null);
  const isMobile = useIsMobile();

  const playing = useAtlasStore((s) => s.playing);
  const stepTimeline = useAtlasStore((s) => s.stepTimeline);
  const selectedId = useAtlasStore((s) => s.selectedId);
  const getEntityById = useAtlasStore((s) => s.getEntityById);
  const selectEntity = useAtlasStore((s) => s.selectEntity);
  const storyActive = useAtlasUiStore((s) => s.story.active);

  const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef);

  useAtlasDataSource();
  useAtlasUrlState();

  const playJourney = useCallback(() => {
    const st = useAtlasStore.getState();
    const stops = buildJourneyStops(st.getFilteredEntities());
    useAtlasUiStore.getState().startStory(stops);
  }, []);

  useAtlasHotkeys({ globeHandlesRef, onPlayJourney: playJourney });

  useEffect(() => {
    useAtlasUiStore.getState().hydrateFromBrowser();
    useAtlasStore.getState().hydrateMuteFromBrowser();
    atlasSound.init();
  }, []);

  // Timeline playback.
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => stepTimeline(), 420);
    return () => window.clearInterval(id);
  }, [playing, stepTimeline]);

  // Selecting anything counts as onboarding + feeds "recently viewed".
  useEffect(() => {
    if (!selectedId) return;
    const ui = useAtlasUiStore.getState();
    ui.recordRecent(selectedId);
    if (!ui.onboardingDismissed) ui.dismissOnboarding();
  }, [selectedId]);

  const selectedEntity = selectedId ? getEntityById(selectedId) : undefined;

  return (
    <div
      ref={containerRef}
      className={[
        'relative flex h-full w-full flex-1 flex-col overflow-hidden bg-[#02040a]',
        isFullscreen ? 'fixed inset-0 z-50' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Center stage: the living globe. */}
      <GlobeView globeHandlesRef={globeHandlesRef} />

      {/* Focus vignette when a site is selected. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-700"
        style={{
          opacity: selectedId && !storyActive ? 1 : 0,
          background:
            'radial-gradient(75% 75% at 50% 45%, transparent 55%, rgba(2,4,10,0.42) 100%)',
        }}
      />

      <MarkerTooltip />

      {/* Not inside a collapsible panel: the sample-corpus warning must be
          visible on every viewport and in every panel state. */}
      <SampleDataBanner />

      {/* Left column — explorer. */}
      <ExplorerSidebar onPlayJourney={playJourney} />
      <Filters />

      {/* Right column — entity dossier (desktop) + globe controls. */}
      <EntitySidebar />
      <Layers
        onZoomIn={() => globeHandlesRef.current?.zoomIn()}
        onZoomOut={() => globeHandlesRef.current?.zoomOut()}
        onResetView={() => globeHandlesRef.current?.resetView()}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => void toggleFullscreen()}
      />

      {/* Overlays. */}
      <Legend />
      <MiniMap globeHandlesRef={globeHandlesRef} />
      <Timeline />
      <StoryMode />
      <SpotlightSearch />
      <EmptyState onPlayJourney={playJourney} />

      {/* Mobile: entity dossier as a bottom sheet. */}
      {isMobile ? (
        <Drawer
          open={selectedEntity != null && !storyActive}
          onOpenChange={(open) => {
            if (!open) selectEntity(null);
          }}
        >
          <DrawerContent className="h-[78vh] rounded-t-2xl border-border/40 bg-background/90 backdrop-blur-xl">
            <DrawerTitle className="sr-only">
              {selectedEntity?.name ?? 'Heritage details'}
            </DrawerTitle>
            {selectedEntity ? (
              <EntityDetailsContent
                entity={selectedEntity}
                onClose={() => selectEntity(null)}
              />
            ) : null}
          </DrawerContent>
        </Drawer>
      ) : null}
    </div>
  );
}
