'use client';

import { create } from 'zustand';

import type { AtlasImageryLayerId } from '../lib/atlas-layers';

const BOOKMARKS_KEY = 'atlas:bookmarks:v1';
const RECENT_KEY = 'atlas:recent:v1';
const LAYER_KEY = 'atlas:layer:v1';
const ONBOARDING_KEY = 'atlas:onboarded:v1';

const RECENT_MAX = 8;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota — best effort */
  }
}

export interface AtlasStoryState {
  active: boolean;
  /** Ordered entity ids for the current journey. */
  stopIds: string[];
  index: number;
  playing: boolean;
}

export interface AtlasCameraCenter {
  lat: number;
  lon: number;
  /** Camera height above the ellipsoid in metres. */
  height: number;
}

interface AtlasUiState {
  /** Persisted entity id bookmarks. */
  bookmarkIds: string[];
  /** Most-recent-first list of viewed entity ids. */
  recentIds: string[];

  imageryLayer: AtlasImageryLayerId;
  nightLights: boolean;
  boundaries: boolean;

  showLegend: boolean;
  showMiniMap: boolean;

  spotlightOpen: boolean;
  filtersOpen: boolean;
  layersOpen: boolean;
  explorerOpen: boolean;
  /** Mobile entity bottom-sheet visibility follows selection; explicit dismiss flag. */
  entitySheetDismissed: boolean;

  onboardingDismissed: boolean;

  story: AtlasStoryState;

  /** Coarse camera position (throttled) for the mini-map. */
  cameraCenter: AtlasCameraCenter | null;
  setCameraCenter: (center: AtlasCameraCenter) => void;

  hydrateFromBrowser: () => void;

  toggleBookmark: (id: string) => void;
  isBookmarked: (id: string) => boolean;
  recordRecent: (id: string) => void;

  setImageryLayer: (id: AtlasImageryLayerId) => void;
  toggleNightLights: () => void;
  toggleBoundaries: () => void;
  toggleLegend: () => void;
  toggleMiniMap: () => void;

  setSpotlightOpen: (open: boolean) => void;
  setFiltersOpen: (open: boolean) => void;
  setLayersOpen: (open: boolean) => void;
  setExplorerOpen: (open: boolean) => void;
  setEntitySheetDismissed: (dismissed: boolean) => void;
  dismissOnboarding: () => void;

  startStory: (stopIds: string[]) => void;
  stopStory: () => void;
  setStoryIndex: (index: number) => void;
  setStoryPlaying: (playing: boolean) => void;
  closeAllOverlays: () => void;
}

export const useAtlasUiStore = create<AtlasUiState>((set, get) => ({
  bookmarkIds: [],
  recentIds: [],

  imageryLayer: 'satellite',
  nightLights: true,
  boundaries: true,

  showLegend: false,
  showMiniMap: true,

  spotlightOpen: false,
  filtersOpen: false,
  layersOpen: false,
  explorerOpen: true,
  entitySheetDismissed: false,

  onboardingDismissed: true,

  story: { active: false, stopIds: [], index: 0, playing: false },

  cameraCenter: null,
  setCameraCenter(center) {
    set({ cameraCenter: center });
  },

  hydrateFromBrowser() {
    set({
      bookmarkIds: readJson<string[]>(BOOKMARKS_KEY, []),
      recentIds: readJson<string[]>(RECENT_KEY, []),
      imageryLayer: readJson<AtlasImageryLayerId>(LAYER_KEY, 'satellite'),
      onboardingDismissed: readJson<boolean>(ONBOARDING_KEY, false),
    });
  },

  toggleBookmark(id) {
    set((s) => {
      const has = s.bookmarkIds.includes(id);
      const bookmarkIds = has
        ? s.bookmarkIds.filter((b) => b !== id)
        : [id, ...s.bookmarkIds];
      writeJson(BOOKMARKS_KEY, bookmarkIds);
      return { bookmarkIds };
    });
  },

  isBookmarked(id) {
    return get().bookmarkIds.includes(id);
  },

  recordRecent(id) {
    set((s) => {
      const recentIds = [id, ...s.recentIds.filter((r) => r !== id)].slice(0, RECENT_MAX);
      writeJson(RECENT_KEY, recentIds);
      return { recentIds };
    });
  },

  setImageryLayer(id) {
    set({ imageryLayer: id });
    writeJson(LAYER_KEY, id);
  },

  toggleNightLights() {
    set((s) => ({ nightLights: !s.nightLights }));
  },

  toggleBoundaries() {
    set((s) => ({ boundaries: !s.boundaries }));
  },

  toggleLegend() {
    set((s) => ({ showLegend: !s.showLegend }));
  },

  toggleMiniMap() {
    set((s) => ({ showMiniMap: !s.showMiniMap }));
  },

  setSpotlightOpen(open) {
    set({ spotlightOpen: open });
  },

  setFiltersOpen(open) {
    set({ filtersOpen: open, layersOpen: open ? false : get().layersOpen });
  },

  setLayersOpen(open) {
    set({ layersOpen: open, filtersOpen: open ? false : get().filtersOpen });
  },

  setExplorerOpen(open) {
    set({ explorerOpen: open });
  },

  setEntitySheetDismissed(dismissed) {
    set({ entitySheetDismissed: dismissed });
  },

  dismissOnboarding() {
    set({ onboardingDismissed: true });
    writeJson(ONBOARDING_KEY, true);
  },

  startStory(stopIds) {
    if (stopIds.length === 0) return;
    set({
      story: { active: true, stopIds, index: 0, playing: true },
      onboardingDismissed: true,
      spotlightOpen: false,
      filtersOpen: false,
      layersOpen: false,
    });
    writeJson(ONBOARDING_KEY, true);
  },

  stopStory() {
    set({ story: { active: false, stopIds: [], index: 0, playing: false } });
  },

  setStoryIndex(index) {
    set((s) => {
      const max = s.story.stopIds.length - 1;
      const clamped = Math.max(0, Math.min(max, index));
      return { story: { ...s.story, index: clamped } };
    });
  },

  setStoryPlaying(playing) {
    set((s) => ({ story: { ...s.story, playing } }));
  },

  closeAllOverlays() {
    set((s) => ({
      spotlightOpen: false,
      filtersOpen: false,
      layersOpen: false,
      story: s.story.active
        ? { active: false, stopIds: [], index: 0, playing: false }
        : s.story,
    }));
  },
}));
