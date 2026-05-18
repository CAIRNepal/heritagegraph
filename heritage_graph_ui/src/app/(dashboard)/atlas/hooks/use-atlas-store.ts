'use client';

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import { ATLAS_AGENTS } from '@/data/atlas-agents';
import { ATLAS_DUMMY_ENTITIES } from '@/data/atlas-dummy';
import { ATLAS_ONTOLOGY_EDGES } from '@/data/atlas-relationships';
import { ATLAS_SOURCES } from '@/data/atlas-sources';
import { atlasSound } from '@/lib/atlas-sound';
import { atlasTrack } from '@/lib/atlas-telemetry';
import type {
  Agent,
  AtlasEntity,
  AtlasEra,
  AtlasViewId,
  DataSource,
  HeritageAssertion,
  OntologyClass,
  OntologyEdge,
  ReliabilityTier,
} from '@/types/atlas';
import { ONTOLOGY_CLASSES, RELIABILITY_ORDER, tierRank } from '@/types/atlas';

import type { AtlasFxPresetId } from '../lib/atlas-fx-presets';
import { ATLAS_FX_PRESET_ORDER } from '../lib/atlas-fx-presets';
import { entityExistedAtYear } from '@/lib/atlas-temporal';

import { computeAtlasTimelineExtents } from '../atlas-time-extents';

const ATLAS_FX_STORAGE_KEY = 'atlas:fx';
const ATLAS_CITY_STORAGE_KEY = 'atlas:city';

/** User-facing globe disc size (multiplier on layout cell). */
export const ATLAS_SPOTLIGHT_SCALE_MIN = 0.55;
export const ATLAS_SPOTLIGHT_SCALE_MAX = 1;
/** Keyboard nudge step for `[` / `]`. */
export const ATLAS_SPOTLIGHT_SCALE_STEP = 0.04;

export type AtlasFlirPolarity = 'whot' | 'bhot';

/** Persisted FX snapshot (subset of store). */
interface AtlasFxPersisted {
  fxPreset: AtlasFxPresetId;
  fxSensitivity: number;
  fxBloom: number;
  fxPixelation: number;
  fxFlirPolarity: AtlasFlirPolarity;
  fxEcoQuality: boolean;
  discTransparent: boolean;
  spotlightScale: number;
}

export function clampAtlasSpotlightScale(n: number): number {
  return Math.min(
    ATLAS_SPOTLIGHT_SCALE_MAX,
    Math.max(ATLAS_SPOTLIGHT_SCALE_MIN, n),
  );
}

function readFxPersisted(): Partial<AtlasFxPersisted> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ATLAS_FX_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<AtlasFxPersisted>;
  } catch {
    return null;
  }
}

function writeFxPersisted(partial: AtlasFxPersisted): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ATLAS_FX_STORAGE_KEY, JSON.stringify(partial));
  } catch {
    /* ignore quota */
  }
}

function readCityId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ATLAS_CITY_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeCityId(id: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (id == null) window.localStorage.removeItem(ATLAS_CITY_STORAGE_KEY);
    else window.localStorage.setItem(ATLAS_CITY_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

const fxSeed = readFxPersisted();
const citySeed = readCityId();

const entitiesSeed = ATLAS_DUMMY_ENTITIES;
const extents = computeAtlasTimelineExtents(entitiesSeed);

export type EraEnabledRecord = Record<AtlasEra, boolean>;

export type ClassEnabledRecord = Record<OntologyClass, boolean>;

export type AtlasDataSource = 'demo' | 'live';
export type AtlasCorpusStatus = 'idle' | 'loading' | 'ready' | 'error';

export type GraphEdgeSlice = 'all' | 'ritual_structure' | 'guthi_structure';
export type AtlasSidebarPanelId =
  | 'fx'
  | 'city'
  | 'graph'
  | 'documents'
  | 'time'
  | 'search'
  | 'ai'
  | 'ops';

export const ATLAS_ERAS_ORDER: AtlasEra[] = ['ancient', 'medieval', 'early_modern', 'modern'];

function allErasOn(): EraEnabledRecord {
  return { ancient: true, medieval: true, early_modern: true, modern: true };
}

function allClassesOn(): ClassEnabledRecord {
  return ONTOLOGY_CLASSES.reduce<ClassEnabledRecord>((acc, c) => {
    acc[c] = true;
    return acc;
  }, {} as ClassEnabledRecord);
}

function passesConfidence(assertions: HeritageAssertion[], floor: number): boolean {
  if (assertions.length === 0) return true;
  const maxC = Math.max(...assertions.map((a) => a.confidenceScore));
  return maxC >= floor;
}

function passesReliability(
  assertions: HeritageAssertion[],
  sources: DataSource[],
  floor: ReliabilityTier,
): boolean {
  if (assertions.length === 0) return true;
  const maxAllowed = tierRank(floor);
  return assertions.some((a) =>
    a.derivedFromSourceIds.some((sid) => {
      const s = sources.find((ss) => ss.id === sid);
      return s != null && tierRank(s.reliabilityTier) <= maxAllowed;
    }),
  );
}

function deriveFilteredEntities(
  eraEnabled: EraEnabledRecord,
  classEnabled: ClassEnabledRecord,
  entityList: AtlasEntity[],
  sources: DataSource[],
  confidenceFloor: number,
  reliabilityFloor: ReliabilityTier,
  currentYear: number,
  temporalFilterEnabled: boolean,
): AtlasEntity[] {
  const eraOn = ATLAS_ERAS_ORDER.filter((e) => eraEnabled[e]);
  const eraSet = eraOn.length === 0 || eraOn.length === ATLAS_ERAS_ORDER.length ? null : new Set(eraOn);

  const classOn = ONTOLOGY_CLASSES.filter((c) => classEnabled[c]);
  const classSet =
    classOn.length === 0 || classOn.length === ONTOLOGY_CLASSES.length ? null : new Set(classOn);

  return entityList.filter((e) => {
    if (eraSet && !eraSet.has(e.era)) return false;
    if (classSet && !classSet.has(e.class)) return false;
    if (temporalFilterEnabled && !entityExistedAtYear(e, currentYear)) return false;
    if (!passesConfidence(e.assertions, confidenceFloor)) return false;
    if (!passesReliability(e.assertions, sources, reliabilityFloor)) return false;
    return true;
  });
}

export interface ProvenanceSummary {
  latestAssertion: HeritageAssertion | null;
  tierHistogram: Record<ReliabilityTier, number>;
  avgConfidence: number;
  conflictCount: number;
}

let timelineTickCounter = 0;

interface AtlasState {
  entities: AtlasEntity[];
  sources: DataSource[];
  agents: Agent[];
  edges: OntologyEdge[];

  dataSource: AtlasDataSource;
  corpusStatus: AtlasCorpusStatus;
  corpusError: string | null;
  /** Increment to invalidate in-flight live corpus loads. */
  liveLoadToken: number;
  /** When true, timeline year hides entities outside their existence span. */
  temporalFilterEnabled: boolean;

  eraEnabled: EraEnabledRecord;
  classEnabled: ClassEnabledRecord;
  confidenceFloor: number;
  reliabilityFloor: ReliabilityTier;

  /** Maximized workspace panel (null = grid + globe in disc). */
  focusedView: AtlasViewId | null;
  /** Globe disc backdrop transparency. */
  discTransparent: boolean;
  /** Globe spotlight diameter scale vs layout cell (clamped). */
  spotlightScale: number;
  graphEdgeSlice: GraphEdgeSlice;

  selectedId: string | null;
  panelOpen: boolean;
  muted: boolean;
  showShortcutHelp: boolean;
  playing: boolean;
  currentYear: number;
  minYear: number;
  maxYear: number;

  hoveredEntityId: string | null;
  hoverScreenPos: { x: number; y: number } | null;

  fxPreset: AtlasFxPresetId;
  fxSensitivity: number;
  fxBloom: number;
  fxPixelation: number;
  fxFlirPolarity: AtlasFlirPolarity;
  fxEcoQuality: boolean;
  selectedCityId: string | null;
  cityPaletteOpen: boolean;
  /** One-at-a-time accordion panel in right sidebar. */
  activeSidebarPanel: AtlasSidebarPanelId | null;

  getFilteredEntities: () => AtlasEntity[];
  getGlobeEntities: () => AtlasEntity[];
  getEntityById: (id: string | null) => AtlasEntity | undefined;
  getEntityAssertions: (id: string) => HeritageAssertion[];
  getProvenanceSummary: (id: string) => ProvenanceSummary | null;
  getEdgesForView: () => OntologyEdge[];

  focusView: (v: AtlasViewId | null) => void;
  toggleDiscTransparent: () => void;
  setDiscTransparent: (v: boolean) => void;
  setSpotlightScale: (n: number, options?: { withSound?: boolean }) => void;
  setGraphEdgeSlice: (s: GraphEdgeSlice) => void;
  toggleEra: (era: AtlasEra) => void;
  toggleClass: (c: OntologyClass) => void;
  cycleReliabilityFloor: (dir: -1 | 1) => void;
  cycleConfidenceFloor: (dir: -1 | 1) => void;

  selectEntity: (id: string | null, playTone?: boolean) => void;
  setHover: (id: string | null, pos: { x: number; y: number } | null) => void;

  togglePanel: () => void;
  closeOverlays: () => void;
  setPlaying: (p: boolean) => void;
  togglePlaying: () => void;
  setCurrentYear: (y: number) => void;
  stepTimeline: () => void;
  toggleShortcutHelp: () => void;
  setMuted: (m: boolean) => void;
  toggleMuted: () => void;

  hydrateMuteFromBrowser: () => void;
  hydrateAtlasFxFromStorage: () => void;

  setFxPreset: (p: AtlasFxPresetId) => void;
  setFxSensitivity: (n: number) => void;
  setFxBloom: (n: number) => void;
  setFxPixelation: (n: number) => void;
  toggleFlirPolarity: () => void;
  setFxEcoQuality: (eco: boolean) => void;
  cycleFxPreset: (dir: -1 | 1) => void;
  selectCity: (id: string | null) => void;
  setCityPaletteOpen: (open: boolean) => void;
  openSidebarPanel: (id: AtlasSidebarPanelId) => void;
  toggleSidebarPanel: (id: AtlasSidebarPanelId) => void;
  closeSidebarPanel: () => void;

  setDataSource: (source: AtlasDataSource) => void;
  setTemporalFilterEnabled: (enabled: boolean) => void;
  resetDemoCorpus: () => void;
  loadLiveCorpus: () => void;
}

function snapshotFxPersist(st: AtlasState): AtlasFxPersisted {
  return {
    fxPreset: st.fxPreset,
    fxSensitivity: st.fxSensitivity,
    fxBloom: st.fxBloom,
    fxPixelation: st.fxPixelation,
    fxFlirPolarity: st.fxFlirPolarity,
    fxEcoQuality: st.fxEcoQuality,
    discTransparent: st.discTransparent,
    spotlightScale: st.spotlightScale,
  };
}

const CONFIDENCE_STEPS = [0, 0.35, 0.55, 0.72, 0.85];

export const useAtlasStore = create<AtlasState>((set, get) => ({
  entities: entitiesSeed,
  sources: ATLAS_SOURCES,
  agents: ATLAS_AGENTS,
  edges: ATLAS_ONTOLOGY_EDGES,

  dataSource: 'demo',
  corpusStatus: 'ready',
  corpusError: null,
  liveLoadToken: 0,
  temporalFilterEnabled: true,

  eraEnabled: allErasOn(),
  classEnabled: allClassesOn(),
  confidenceFloor: 0,
  reliabilityFloor: 'D',

  focusedView: null,
  discTransparent: fxSeed?.discTransparent ?? false,
  spotlightScale: clampAtlasSpotlightScale(fxSeed?.spotlightScale ?? 1),
  graphEdgeSlice: 'all',

  selectedId: null,
  panelOpen: true,
  muted: false,
  showShortcutHelp: false,
  playing: false,
  currentYear: Math.min(extents.maxYear, Math.max(extents.minYear, 1900)),
  minYear: extents.minYear,
  maxYear: extents.maxYear,

  hoveredEntityId: null,
  hoverScreenPos: null,

  fxPreset: fxSeed?.fxPreset ?? 'normal',
  fxSensitivity: fxSeed?.fxSensitivity ?? 1,
  fxBloom: fxSeed?.fxBloom ?? 0.35,
  fxPixelation: fxSeed?.fxPixelation ?? 16,
  fxFlirPolarity: fxSeed?.fxFlirPolarity ?? 'whot',
  fxEcoQuality: fxSeed?.fxEcoQuality ?? false,
  selectedCityId: citySeed,
  cityPaletteOpen: false,
  activeSidebarPanel: null,

  getFilteredEntities() {
    const st = get();
    return deriveFilteredEntities(
      st.eraEnabled,
      st.classEnabled,
      st.entities,
      st.sources,
      st.confidenceFloor,
      st.reliabilityFloor,
      st.currentYear,
      st.temporalFilterEnabled,
    );
  },

  getGlobeEntities() {
    return get().getFilteredEntities().filter((e) => e.lat != null && e.lon != null);
  },

  getEntityById(id) {
    if (!id) return undefined;
    return get().entities.find((e) => e.id === id);
  },

  getEntityAssertions(id) {
    const e = get().getEntityById(id);
    return e?.assertions ?? [];
  },

  getProvenanceSummary(id) {
    const e = get().getEntityById(id);
    if (!e) return null;
    const sources = get().sources;
    const assertions = e.assertions;
    const latest =
      assertions.length === 0
        ? null
        : [...assertions].sort((a, b) => b.generatedAtTime.localeCompare(a.generatedAtTime))[0];

    const tierHistogram: Record<ReliabilityTier, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const a of assertions) {
      for (const sid of a.derivedFromSourceIds) {
        const s = sources.find((ss) => ss.id === sid);
        if (s) tierHistogram[s.reliabilityTier] += 1;
      }
    }
    const avgConfidence =
      assertions.length === 0
        ? 0
        : assertions.reduce((sum, a) => sum + a.confidenceScore, 0) / assertions.length;
    const conflictCount = assertions.filter((a) => a.reconciliationStatus === 'conflicting').length;

    return { latestAssertion: latest, tierHistogram, avgConfidence, conflictCount };
  },

  getEdgesForView() {
    const edges = get().edges;
    const slice = get().graphEdgeSlice;
    const ids = new Set(get().getFilteredEntities().map((e) => e.id));

    const ritualPredicates = new Set([
      'ritual_on_structure',
      'includes_ritual_event',
      'invokes_deity',
      'performs_ritual',
      'participates_in_ritual',
    ]);
    const guthiPredicates = new Set(['holds_custody_of', 'managed_by_guthi', 'member_of_group']);

    return edges.filter((ed) => {
      if (!ids.has(ed.source) || !ids.has(ed.target)) return false;
      if (slice === 'all') return true;
      if (slice === 'ritual_structure') return ritualPredicates.has(ed.predicate);
      if (slice === 'guthi_structure') return guthiPredicates.has(ed.predicate);
      return true;
    });
  },

  focusView(v) {
    set({ focusedView: v });
    atlasSound.play('click');
  },

  toggleDiscTransparent() {
    const discTransparent = !get().discTransparent;
    set({ discTransparent });
    atlasSound.play('click');
    writeFxPersisted(snapshotFxPersist(get()));
  },

  setDiscTransparent(v) {
    if (get().discTransparent === v) return;
    set({ discTransparent: v });
    atlasSound.play('click');
    writeFxPersisted(snapshotFxPersist(get()));
  },

  setSpotlightScale(n, options) {
    const withSound = options?.withSound ?? true;
    const spotlightScale = clampAtlasSpotlightScale(n);
    if (spotlightScale === get().spotlightScale) {
      if (withSound) atlasSound.play('tick');
      return;
    }
    set({ spotlightScale });
    if (withSound) atlasSound.play('click');
    writeFxPersisted(snapshotFxPersist(get()));
  },

  setGraphEdgeSlice(s) {
    set({ graphEdgeSlice: s });
    atlasSound.play('click');
  },

  toggleEra(era) {
    set((s) => {
      const nextEnabled = { ...s.eraEnabled, [era]: !s.eraEnabled[era] };
      const count = ATLAS_ERAS_ORDER.filter((e) => nextEnabled[e]).length;
      if (count === 0) return { eraEnabled: allErasOn() };
      return { eraEnabled: nextEnabled };
    });
    atlasSound.play('click');
  },

  toggleClass(c) {
    set((s) => {
      const nextEnabled = { ...s.classEnabled, [c]: !s.classEnabled[c] };
      const count = ONTOLOGY_CLASSES.filter((x) => nextEnabled[x]).length;
      if (count === 0) return { classEnabled: allClassesOn() };
      return { classEnabled: nextEnabled };
    });
    atlasSound.play('click');
  },

  cycleReliabilityFloor(dir) {
    const order = RELIABILITY_ORDER;
    const i = order.indexOf(get().reliabilityFloor);
    const ni = Math.min(order.length - 1, Math.max(0, i + dir));
    set({ reliabilityFloor: order[ni] ?? 'D' });
    atlasSound.play('tick');
  },

  cycleConfidenceFloor(dir) {
    const steps = CONFIDENCE_STEPS;
    const cur = get().confidenceFloor;
    let idx = steps.findIndex((x) => x >= cur - 1e-6);
    if (idx < 0) idx = 0;
    const ni = Math.min(steps.length - 1, Math.max(0, idx + dir));
    set({ confidenceFloor: steps[ni] ?? 0 });
    atlasSound.play('tick');
  },

  selectEntity(id, playTone = true) {
    set({ selectedId: id });
    if (id) {
      atlasTrack('entity_select', { id });
      if (playTone) atlasSound.play('select');
    }
  },

  setHover(id, pos) {
    set({ hoveredEntityId: id, hoverScreenPos: pos });
  },

  togglePanel() {
    set((s) => {
      const open = !s.panelOpen;
      atlasSound.play(open ? 'uiOpen' : 'uiClose');
      return { panelOpen: open };
    });
  },

  closeOverlays() {
    atlasSound.play('click');
    set({
      panelOpen: false,
      showShortcutHelp: false,
      selectedId: null,
      hoveredEntityId: null,
      hoverScreenPos: null,
      cityPaletteOpen: false,
      focusedView: null,
      activeSidebarPanel: null,
    });
  },

  setPlaying(p) {
    set({ playing: p });
    if (p) atlasSound.play('whoosh');
  },

  togglePlaying() {
    const playing = !get().playing;
    set({ playing });
    if (playing) atlasSound.play('whoosh');
  },

  setCurrentYear(y) {
    const { minYear, maxYear } = get();
    set({ currentYear: Math.min(maxYear, Math.max(minYear, y)) });
  },

  stepTimeline() {
    const { currentYear, maxYear, minYear } = get();
    const span = maxYear - minYear || 1;
    const leap = Math.max(2, Math.floor(span / 120));
    let next = currentYear + leap;
    if (next > maxYear) next = minYear;
    set({ currentYear: next });
    timelineTickCounter += 1;
    if (timelineTickCounter % 2 === 0) atlasSound.play('tick');
  },

  toggleShortcutHelp() {
    set((s) => {
      const next = !s.showShortcutHelp;
      atlasSound.play(next ? 'uiOpen' : 'uiClose');
      return { showShortcutHelp: next };
    });
  },

  setMuted(m) {
    atlasSound.setMuted(m);
    set({ muted: m });
  },

  toggleMuted() {
    const next = atlasSound.toggleMuted();
    set({ muted: next });
    atlasSound.play('click');
  },

  hydrateMuteFromBrowser() {
    atlasSound.refreshMuteFromStorage();
    set({ muted: atlasSound.isMuted() });
  },

  hydrateAtlasFxFromStorage() {
    const fx = readFxPersisted();
    const city = readCityId();
    set({
      fxPreset: fx?.fxPreset ?? 'normal',
      fxSensitivity: fx?.fxSensitivity ?? 1,
      fxBloom: fx?.fxBloom ?? 0.35,
      fxPixelation: fx?.fxPixelation ?? 16,
      fxFlirPolarity: fx?.fxFlirPolarity ?? 'whot',
      fxEcoQuality: fx?.fxEcoQuality ?? false,
      discTransparent: fx?.discTransparent ?? false,
      spotlightScale: clampAtlasSpotlightScale(fx?.spotlightScale ?? 1),
      selectedCityId: city,
    });
  },

  setFxPreset(p) {
    set({ fxPreset: p });
    atlasSound.play('click');
    writeFxPersisted(snapshotFxPersist(get()));
  },

  setFxSensitivity(n) {
    const fxSensitivity = Math.min(2.4, Math.max(0.35, n));
    set({ fxSensitivity });
    writeFxPersisted(snapshotFxPersist(get()));
  },

  setFxBloom(n) {
    const fxBloom = Math.min(1, Math.max(0, n));
    set({ fxBloom });
    writeFxPersisted(snapshotFxPersist(get()));
  },

  setFxPixelation(n) {
    const fxPixelation = Math.min(144, Math.max(4, Math.round(n)));
    set({ fxPixelation });
    writeFxPersisted(snapshotFxPersist(get()));
  },

  toggleFlirPolarity() {
    const fxFlirPolarity = get().fxFlirPolarity === 'whot' ? 'bhot' : 'whot';
    set({ fxFlirPolarity });
    atlasSound.play('tick');
    writeFxPersisted(snapshotFxPersist(get()));
  },

  setFxEcoQuality(eco) {
    set({ fxEcoQuality: eco });
    atlasSound.play('click');
    writeFxPersisted(snapshotFxPersist(get()));
  },

  cycleFxPreset(dir) {
    const order = ATLAS_FX_PRESET_ORDER;
    const i = order.indexOf(get().fxPreset);
    const ni = (i + dir + order.length) % order.length;
    const next = order[ni] ?? 'normal';
    set({ fxPreset: next });
    atlasSound.play('tick');
    writeFxPersisted(snapshotFxPersist(get()));
  },

  selectCity(id) {
    set({ selectedCityId: id });
    writeCityId(id);
    if (id) atlasSound.play('click');
  },

  setCityPaletteOpen(open) {
    set((s) => {
      if (open !== s.cityPaletteOpen) {
        atlasSound.play(open ? 'uiOpen' : 'uiClose');
      }
      return { cityPaletteOpen: open };
    });
  },

  openSidebarPanel(id) {
    set({ activeSidebarPanel: id });
    atlasSound.play('uiOpen');
  },

  toggleSidebarPanel(id) {
    set((s) => {
      const activeSidebarPanel = s.activeSidebarPanel === id ? null : id;
      atlasSound.play(activeSidebarPanel ? 'uiOpen' : 'uiClose');
      return { activeSidebarPanel };
    });
  },

  closeSidebarPanel() {
    set({ activeSidebarPanel: null });
    atlasSound.play('uiClose');
  },

  setDataSource(source) {
    if (source === get().dataSource) return;
    if (source === 'demo') {
      const extents = computeAtlasTimelineExtents(entitiesSeed);
      set((s) => ({
        liveLoadToken: s.liveLoadToken + 1,
        dataSource: 'demo',
        entities: entitiesSeed,
        edges: ATLAS_ONTOLOGY_EDGES,
        corpusStatus: 'ready',
        corpusError: null,
        minYear: extents.minYear,
        maxYear: extents.maxYear,
        selectedId: null,
      }));
      atlasTrack('corpus_mode', { mode: 'demo' });
      atlasSound.play('click');
      return;
    }
    set((s) => ({ dataSource: 'live', corpusStatus: 'idle', liveLoadToken: s.liveLoadToken + 1 }));
    atlasTrack('corpus_mode', { mode: 'live' });
    atlasSound.play('click');
  },

  setTemporalFilterEnabled(enabled) {
    set({ temporalFilterEnabled: enabled });
    atlasSound.play('tick');
  },

  resetDemoCorpus() {
    get().setDataSource('demo');
  },

  loadLiveCorpus() {
    set({ dataSource: 'live', corpusStatus: 'idle' });
  },
}));

/** Subscribes to the filtered entity list; updates when era/class/floors/year change. */
export function useFilteredAtlasEntities(): AtlasEntity[] {
  return useAtlasStore(
    useShallow((s) =>
      deriveFilteredEntities(
        s.eraEnabled,
        s.classEnabled,
        s.entities,
        s.sources,
        s.confidenceFloor,
        s.reliabilityFloor,
        s.currentYear,
        s.temporalFilterEnabled,
      ),
    ),
  );
}

/** Subscribes to ontology edges visible for the current graph slice and filtered nodes. */
export function useAtlasViewEdges(): OntologyEdge[] {
  return useAtlasStore(useShallow((s) => s.getEdgesForView()));
}
