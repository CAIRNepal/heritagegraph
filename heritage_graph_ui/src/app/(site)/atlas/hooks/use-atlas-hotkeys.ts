'use client';

import type { RefObject } from 'react';
import { useEffect } from 'react';

import type { AtlasGlobeHandles } from '@/app/(site)/atlas/globe-handles';

import { useAtlasStore } from './use-atlas-store';
import { useAtlasUiStore } from './use-atlas-ui-store';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

interface UseAtlasHotkeysOptions {
  globeHandlesRef: RefObject<AtlasGlobeHandles | null>;
  onPlayJourney: () => void;
}

/**
 * Atlas keyboard map (capture-phase so ⌘K wins over the dashboard palette):
 * ⌘K or / search · esc dismiss · space play · ←/→ scrub · b bookmark ·
 * r reset view · +/- zoom · j journey.
 */
export function useAtlasHotkeys({ globeHandlesRef, onPlayJourney }: UseAtlasHotkeysOptions) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const ui = useAtlasUiStore.getState();
      const atlas = useAtlasStore.getState();

      // Spotlight: ⌘K / Ctrl+K — intercept before the global command menu.
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        ui.setSpotlightOpen(!ui.spotlightOpen);
        return;
      }

      if (isTypingTarget(e.target)) return;

      switch (e.key) {
        case '/': {
          e.preventDefault();
          ui.setSpotlightOpen(true);
          break;
        }
        case 'Escape': {
          if (ui.spotlightOpen) ui.setSpotlightOpen(false);
          else if (ui.filtersOpen) ui.setFiltersOpen(false);
          else if (ui.layersOpen) ui.setLayersOpen(false);
          else if (ui.story.active) ui.stopStory();
          else if (atlas.selectedId) atlas.selectEntity(null);
          break;
        }
        case ' ': {
          e.preventDefault();
          if (ui.story.active) ui.setStoryPlaying(!ui.story.playing);
          else atlas.togglePlaying();
          break;
        }
        case 'ArrowRight':
        case 'ArrowLeft': {
          if (ui.spotlightOpen) return;
          e.preventDefault();
          const span = Math.max(1, atlas.maxYear - atlas.minYear);
          const step = Math.max(1, Math.round(span / 200));
          atlas.setCurrentYear(atlas.currentYear + (e.key === 'ArrowRight' ? step : -step));
          break;
        }
        case 'b': {
          if (atlas.selectedId) ui.toggleBookmark(atlas.selectedId);
          break;
        }
        case 'r': {
          globeHandlesRef.current?.resetView();
          break;
        }
        case '+':
        case '=': {
          globeHandlesRef.current?.zoomIn();
          break;
        }
        case '-': {
          globeHandlesRef.current?.zoomOut();
          break;
        }
        case 'j': {
          if (!ui.story.active) onPlayJourney();
          break;
        }
        default:
          break;
      }
    };

    document.addEventListener('keydown', onKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [globeHandlesRef, onPlayJourney]);
}
