'use client';

import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

import { hydrateAtlasFromKgGraph } from '@/lib/atlas-kg-hydrate';
import { getApiErrorMessage } from '@/lib/api-client';
import { getPublicApiUrl } from '@/lib/api-base';
import { atlasTrack } from '@/lib/atlas-telemetry';
import { datasetMetaFromKgResponse } from '@/lib/provenance';
import { fetchKgGraph, type KgGraphResponse } from '@/lib/kg-graph';

import { computeAtlasTimelineExtents } from '../atlas-time-extents';
import { useAtlasStore } from './use-atlas-store';

const API_BASE = getPublicApiUrl();

const KG_CACHE_PREFIX = 'atlas:kg-corpus:v2:';
const KG_CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedKgResponse {
  fetchedAt: number;
  resp: KgGraphResponse;
}

function readKgCache(scope: string): CachedKgResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(KG_CACHE_PREFIX + scope);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedKgResponse;
    if (!parsed.resp || Date.now() - parsed.fetchedAt > KG_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeKgCache(scope: string, resp: KgGraphResponse): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      KG_CACHE_PREFIX + scope,
      JSON.stringify({ fetchedAt: Date.now(), resp } satisfies CachedKgResponse),
    );
  } catch {
    /* storage quota — cache is best-effort */
  }
}

/**
 * State applied whenever a live load ends without data.
 *
 * The store boots with the sample corpus mounted, so every live failure path
 * must explicitly clear it. Otherwise the globe keeps rendering fictional
 * heritage — with confidence scores and agent attributions — while
 * `dataSource` still reads `'live'`.
 */
const EMPTY_LIVE_CORPUS = {
  entities: [],
  edges: [],
  sources: [],
  agents: [],
  dataSource: 'live' as const,
  locationStats: null,
  datasetMeta: null,
  selectedId: null,
};

function friendlyCorpusError(err: unknown): { message: string; auth: boolean } {
  const raw = getApiErrorMessage(err, 'Could not reach the HeritageGraph API.');
  if (/\b401\b/.test(raw)) {
    return { message: 'Sign in to load the live knowledge graph.', auth: true };
  }
  if (/\b403\b/.test(raw)) {
    return { message: 'Your account does not have access to this graph scope.', auth: true };
  }
  return { message: raw, auth: false };
}

/**
 * Boots corpus hydration: live reviewed KG when the API is configured
 * (same honesty as Museum); demo via toggle or `?source=demo`.
 * Live mode loads `GET /api/v1/cidoc/kg/graph/`.
 */
export function useAtlasDataSource() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const dataSource = useAtlasStore((s) => s.dataSource);
  const corpusStatus = useAtlasStore((s) => s.corpusStatus);
  const liveScope = useAtlasStore((s) => s.liveScope);
  const abortRef = useRef<AbortController | null>(null);
  const bootstrappedRef = useRef(false);

  const tryLoadLive = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const loadToken = useAtlasStore.getState().liveLoadToken;
    const scope = useAtlasStore.getState().liveScope;
    const token = (session as { accessToken?: string } | null)?.accessToken;
    useAtlasStore.setState({ corpusStatus: 'loading', corpusError: null, corpusErrorAuth: false });
    atlasTrack('corpus_load_start', { mode: 'live', scope });

    try {
      const cached = readKgCache(scope);
      const cacheHit = cached != null;
      // Provenance records when the data left the server, not when this render
      // happened to read it out of sessionStorage.
      let fetchedAt = cached ? new Date(cached.fetchedAt).toISOString() : '';
      let resp = cached?.resp ?? null;
      if (!resp) {
        resp = await fetchKgGraph(API_BASE, token, {
          signal: ac.signal,
          scope,
          includeLux: 'linked',
        });
        fetchedAt = new Date().toISOString();
      }
      if (ac.signal.aborted || loadToken !== useAtlasStore.getState().liveLoadToken) return;
      if (!cacheHit) writeKgCache(scope, resp);

      const hydrated = hydrateAtlasFromKgGraph(resp);
      if (hydrated.entities.length === 0) {
        // Empty is a valid answer, and it must look empty. Leaving the sample
        // corpus mounted here would show a populated globe of fictional
        // heritage while the store reports the source as `live`.
        useAtlasStore.setState({
          ...EMPTY_LIVE_CORPUS,
          corpusStatus: 'error',
          corpusError: 'The reviewed knowledge graph has no published entities yet.',
        });
        return;
      }
      const extents = computeAtlasTimelineExtents(hydrated.entities);
      if (loadToken !== useAtlasStore.getState().liveLoadToken) return;

      useAtlasStore.setState({
        entities: hydrated.entities,
        edges: hydrated.edges,
        sources: hydrated.sources,
        agents: hydrated.agents,
        dataSource: 'live',
        corpusStatus: 'ready',
        corpusError: null,
        locationStats: hydrated.locationStats,
        datasetMeta: datasetMetaFromKgResponse(resp, API_BASE, fetchedAt),
        minYear: extents.minYear,
        maxYear: extents.maxYear,
        currentYear: Math.min(
          extents.maxYear,
          Math.max(extents.minYear, useAtlasStore.getState().currentYear),
        ),
        selectedId: null,
      });
      atlasTrack('corpus_load_ready', {
        mode: 'live',
        scope,
        cacheHit,
        entities: hydrated.entities.length,
        spatial: hydrated.spatialCount,
        edgesWithProvenance: resp.counts?.edgesWithProvenance ?? 0,
      });
    } catch (err) {
      if (ac.signal.aborted) return;
      const { message, auth } = friendlyCorpusError(err);
      // Same rule as the empty case: a failed live load must not silently fall
      // back to the sample corpus while still reporting `dataSource: 'live'`.
      // The user has to switch to demo deliberately.
      useAtlasStore.setState({
        ...EMPTY_LIVE_CORPUS,
        corpusStatus: 'error',
        corpusError: message,
        corpusErrorAuth: auth,
      });
      atlasTrack('corpus_load_error', { message });
    }
  }, [session]);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    const sourceParam = searchParams.get('source');
    if (sourceParam === 'demo') {
      useAtlasStore.getState().setDataSource('demo');
      return;
    }
    // Live by default when API is configured (Nature-rigor: don't hide the SoR
    // behind a demo corpus). Explicit `?source=live` also forces a reload.
    if (API_BASE && (sourceParam === 'live' || sourceParam == null)) {
      useAtlasStore.getState().loadLiveCorpus();
    }
  }, [searchParams]);

  useEffect(() => {
    if (dataSource === 'live' && corpusStatus === 'idle') {
      void tryLoadLive();
    }
  }, [dataSource, corpusStatus, liveScope, tryLoadLive]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { loadLiveCorpus: tryLoadLive, abortLiveLoad: () => abortRef.current?.abort() };
}
