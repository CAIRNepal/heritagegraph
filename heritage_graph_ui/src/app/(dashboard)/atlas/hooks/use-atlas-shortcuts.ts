'use client';

import { type RefObject, useEffect } from 'react';

import { atlasSound } from '@/lib/atlas-sound';
import { ATLAS_VIEW_IDS } from '@/types/atlas';

import type { AtlasGlobeHandles } from '../globe-handles';
import { CURATED_CITY_ORDER } from '../lib/atlas-cities';
import { ATLAS_SPOTLIGHT_SCALE_STEP, useAtlasStore } from './use-atlas-store';

/** Keys 1–6 maximize these panels (excludes `globe`). */
const ATLAS_WORKSPACE_PANELS = ATLAS_VIEW_IDS.slice(1);

function editableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return el.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

interface UseAtlasShortcutsOptions {
  containerRef: RefObject<HTMLElement | null>;
  globeHandlesRef: RefObject<AtlasGlobeHandles | null>;
}

export function useAtlasShortcuts(options: UseAtlasShortcutsOptions): void {
  const { containerRef, globeHandlesRef } = options;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (editableTarget(e.target)) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        atlasSound.play('uiOpen');
        useAtlasStore.getState().setCityPaletteOpen(true);
        window.setTimeout(() => {
          document.getElementById('atlas-city-palette-input')?.focus();
        }, 0);
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const {
        togglePanel,
        closeOverlays,
        togglePlaying,
        toggleShortcutHelp,
        toggleMuted,
        toggleDiscTransparent,
        setCurrentYear,
        minYear,
        maxYear,
        selectEntity,
        getGlobeEntities,
        selectedId,
        showShortcutHelp,
        focusView,
        cycleReliabilityFloor,
        cycleConfidenceFloor,
        fxPreset,
        cycleFxPreset,
        toggleFlirPolarity,
        selectCity,
      } = useAtlasStore.getState();

      const prevent = () => {
        e.preventDefault();
      };

      switch (e.key) {
        case 'f':
        case 'F':
          if (e.shiftKey) return;
          prevent();
          atlasSound.play('click');
          void (async () => {
            const el = containerRef.current;
            if (!el) return;
            try {
              if (!document.fullscreenElement) {
                const rq = (
                  el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }
                ).webkitRequestFullscreen;
                await el.requestFullscreen?.().catch(async () => {
                  if (rq) await rq();
                });
              } else {
                await document.exitFullscreen?.();
              }
            } catch {
              atlasSound.play('error');
            }
          })();
          break;
        case 's':
        case 'S':
          if (e.shiftKey) return;
          prevent();
          togglePanel();
          break;
        case ' ':
          prevent();
          togglePlaying();
          break;
        case 'z':
        case 'Z':
          if (e.shiftKey) return;
          prevent();
          atlasSound.play('click');
          globeHandlesRef.current?.zoomIn();
          break;
        case 'x':
        case 'X':
          if (e.shiftKey) return;
          prevent();
          atlasSound.play('click');
          globeHandlesRef.current?.zoomOut();
          break;
        case '0':
          prevent();
          atlasSound.play('whoosh');
          if (e.shiftKey) {
            selectCity(null);
          }
          globeHandlesRef.current?.resetView();
          break;
        case 'ArrowUp':
          prevent();
          atlasSound.play('click');
          {
            const list = getGlobeEntities();
            if (list.length === 0) break;
            const idx = selectedId ? list.findIndex((s) => s.id === selectedId) : 0;
            const next = list[(idx <= 0 ? list.length : idx) - 1];
            selectEntity(next.id);
            globeHandlesRef.current?.flyToEntity(next.id);
          }
          break;
        case 'ArrowDown':
          prevent();
          atlasSound.play('click');
          {
            const list = getGlobeEntities();
            if (list.length === 0) break;
            const idx = selectedId ? list.findIndex((s) => s.id === selectedId) : -1;
            const next = list[(idx + 1) % list.length];
            selectEntity(next.id);
            globeHandlesRef.current?.flyToEntity(next.id);
          }
          break;
        case 'j':
        case 'J':
          if (e.shiftKey) return;
          prevent();
          atlasSound.play('click');
          {
            const prevStore = useAtlasStore.getState();
            const ord = [...CURATED_CITY_ORDER] as string[];
            const sid = prevStore.selectedCityId;
            let idx = sid ? ord.indexOf(sid) : -1;
            if (idx < 0) idx = 0;
            const prev = ord[(idx + ord.length - 1) % ord.length];
            if (prev) {
              prevStore.selectCity(prev);
              globeHandlesRef.current?.flyToCity(prev);
            }
          }
          break;
        case 'l':
        case 'L':
          if (e.shiftKey) return;
          prevent();
          atlasSound.play('click');
          {
            const st = useAtlasStore.getState();
            const ord = [...CURATED_CITY_ORDER] as string[];
            const sid = st.selectedCityId;
            let idx = sid ? ord.indexOf(sid) : -1;
            if (idx < 0) idx = -1;
            const next = ord[(idx + 1) % ord.length];
            if (next) {
              st.selectCity(next);
              globeHandlesRef.current?.flyToCity(next);
            }
          }
          break;
        case 'p':
        case 'P':
          prevent();
          atlasSound.play('tick');
          cycleFxPreset(e.shiftKey ? -1 : 1);
          break;
        case 'b':
        case 'B':
          if (e.shiftKey) return;
          prevent();
          if (fxPreset === 'flir') toggleFlirPolarity();
          break;
        case 't':
        case 'T':
          if (e.shiftKey) return;
          prevent();
          atlasSound.play('click');
          toggleDiscTransparent();
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6': {
          prevent();
          const i = Number.parseInt(e.key, 10) - 1;
          const panel = ATLAS_WORKSPACE_PANELS[i];
          if (panel) focusView(panel);
          break;
        }
        case '7': {
          prevent();
          focusView(null);
          break;
        }
        case '[':
        case '{':
          prevent();
          if (e.key === '{' || e.shiftKey) {
            useAtlasStore.getState().setSpotlightScale(
              useAtlasStore.getState().spotlightScale - ATLAS_SPOTLIGHT_SCALE_STEP,
            );
          } else {
            atlasSound.play('tick');
            cycleReliabilityFloor(-1);
          }
          break;
        case ']':
        case '}':
          prevent();
          if (e.key === '}' || e.shiftKey) {
            useAtlasStore.getState().setSpotlightScale(
              useAtlasStore.getState().spotlightScale + ATLAS_SPOTLIGHT_SCALE_STEP,
            );
          } else {
            atlasSound.play('tick');
            cycleReliabilityFloor(1);
          }
          break;
        case ',':
          prevent();
          atlasSound.play('tick');
          cycleConfidenceFloor(-1);
          break;
        case '.':
          prevent();
          atlasSound.play('tick');
          cycleConfidenceFloor(1);
          break;
        case 'g':
        case 'G':
          if (e.shiftKey) return;
          prevent();
          document.getElementById('atlas-search-input')?.focus();
          break;
        case 'Escape':
          prevent();
          if (showShortcutHelp) {
            atlasSound.play('uiClose');
            useAtlasStore.setState({ showShortcutHelp: false });
          } else {
            closeOverlays();
          }
          break;
        case '?':
          prevent();
          toggleShortcutHelp();
          break;
        case 'm':
        case 'M':
          if (e.shiftKey) return;
          prevent();
          toggleMuted();
          break;
        case 'Home':
          prevent();
          setCurrentYear(minYear);
          atlasSound.play('click');
          break;
        case 'End':
          prevent();
          setCurrentYear(maxYear);
          atlasSound.play('click');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [containerRef, globeHandlesRef]);
}
