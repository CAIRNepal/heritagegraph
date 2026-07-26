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
  DataSource,
  HeritageAssertion,
  OntologyClass,
  OntologyEdge,
  ReliabilityTier,
} from '@/types/atlas';
import { ONTOLOGY_CLASSES, tierRank } from '@/types/atlas';

import { entityExistedAtYear } from '@/lib/atlas-temporal';

import type { AtlasLocationCatalogStats } from '@/lib/atlas-api-hydrate';
import type { MuseumDatasetMeta } from '@/lib/heritage-museum/museum-rigor';

import { computeAtlasTimelineExtents } from '../atlas-time-extents';

const entitiesSeed = ATLAS_DUMMY_ENTITIES;
const extents = computeAtlasTimelineExtents(entitiesSeed);

export type EraEnabledRecord = Record<AtlasEra, boolean>;

export type ClassEnabledRecord = Record<OntologyClass, boolean>;

export type AtlasDataSource = 'demo' | 'live';
export type AtlasCorpusStatus = 'idle' | 'loading' | 'ready' | 'error';

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
  /** Set when the live load failed due to missing/invalid auth (401/403). */
  corpusErrorAuth: boolean;
  /** Live corpus place-mapping coverage (undefined in demo mode). */
  locationStats: AtlasLocationCatalogStats | null;
  /** Dataset provenance for the live KG projection (null in demo mode). */
  datasetMeta: MuseumDatasetMeta | null;
  /** Live projection scope: reviewed public graph vs curator preview (auth-gated). */
  liveScope: 'reviewed' | 'all';
  /** Increment to invalidate in-flight live corpus loads. */
  liveLoadToken: number;
  /** When true, timeline year hides entities outside their existence span. */
  temporalFilterEnabled: boolean;

  eraEnabled: EraEnabledRecord;
  classEnabled: ClassEnabledRecord;
  confidenceFloor: number;
  reliabilityFloor: ReliabilityTier;

  selectedId: string | null;
  muted: boolean;
  playing: boolean;
  currentYear: number;
  minYear: number;
  maxYear: number;

  hoveredEntityId: string | null;
  hoverScreenPos: { x: number; y: number } | null;

  getFilteredEntities: () => AtlasEntity[];
  getGlobeEntities: () => AtlasEntity[];
  getEntityById: (id: string | null) => AtlasEntity | undefined;
  getEntityAssertions: (id: string) => HeritageAssertion[];
  getProvenanceSummary: (id: string) => ProvenanceSummary | null;

  toggleEra: (era: AtlasEra) => void;
  toggleClass: (c: OntologyClass) => void;

  selectEntity: (id: string | null, playTone?: boolean) => void;
  setHover: (id: string | null, pos: { x: number; y: number } | null) => void;

  setPlaying: (p: boolean) => void;
  togglePlaying: () => void;
  setCurrentYear: (y: number) => void;
  stepTimeline: () => void;
  setMuted: (m: boolean) => void;
  toggleMuted: () => void;
  hydrateMuteFromBrowser: () => void;

  setDataSource: (source: AtlasDataSource) => void;
  setLiveScope: (scope: 'reviewed' | 'all') => void;
  setTemporalFilterEnabled: (enabled: boolean) => void;
  resetDemoCorpus: () => void;
  loadLiveCorpus: () => void;
}

export const useAtlasStore = create<AtlasState>((set, get) => ({
  entities: entitiesSeed,
  sources: ATLAS_SOURCES,
  agents: ATLAS_AGENTS,
  edges: ATLAS_ONTOLOGY_EDGES,

  dataSource: 'demo',
  corpusStatus: 'ready',
  corpusError: null,
  corpusErrorAuth: false,
  locationStats: null,
  datasetMeta: null,
  liveScope: 'reviewed',
  liveLoadToken: 0,
  temporalFilterEnabled: true,

  eraEnabled: allErasOn(),
  classEnabled: allClassesOn(),
  confidenceFloor: 0,
  reliabilityFloor: 'D',

  selectedId: null,
  muted: false,
  playing: false,
  currentYear: Math.min(extents.maxYear, Math.max(extents.minYear, 1900)),
  minYear: extents.minYear,
  maxYear: extents.maxYear,

  hoveredEntityId: null,
  hoverScreenPos: null,

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
    return get()
      .getFilteredEntities()
      .filter(
        (e) =>
          e.lat != null &&
          e.lon != null &&
          e.coordProvenance !== 'unmapped',
      );
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

  setDataSource(source) {
    if (source === get().dataSource) return;
    if (source === 'demo') {
      const demoExtents = computeAtlasTimelineExtents(entitiesSeed);
      set((s) => ({
        liveLoadToken: s.liveLoadToken + 1,
        dataSource: 'demo',
        entities: entitiesSeed,
        edges: ATLAS_ONTOLOGY_EDGES,
        sources: ATLAS_SOURCES,
        agents: ATLAS_AGENTS,
        corpusStatus: 'ready',
        corpusError: null,
        corpusErrorAuth: false,
        locationStats: null,
        datasetMeta: null,
        minYear: demoExtents.minYear,
        maxYear: demoExtents.maxYear,
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

  setLiveScope(scope) {
    if (scope === get().liveScope) return;
    set((s) => ({
      liveScope: scope,
      liveLoadToken: s.liveLoadToken + 1,
      // Reload when already in live mode; demo keeps the preference for later.
      corpusStatus: s.dataSource === 'live' ? 'idle' : s.corpusStatus,
    }));
    atlasTrack('corpus_scope', { scope });
    atlasSound.play('tick');
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
