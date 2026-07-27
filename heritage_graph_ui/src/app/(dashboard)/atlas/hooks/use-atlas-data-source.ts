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

function readKgCache(scope: string): KgGraphResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(KG_CACHE_PREFIX + scope);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedKgResponse;
    if (!parsed.resp || Date.now() - parsed.fetchedAt > KG_CACHE_TTL_MS) return null;
    return parsed.resp;
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
      let resp = readKgCache(scope);
      const cacheHit = resp != null;
      if (!resp) {
        resp = await fetchKgGraph(API_BASE, token, {
          signal: ac.signal,
          scope,
          includeLux: 'linked',
        });
      }
      if (ac.signal.aborted || loadToken !== useAtlasStore.getState().liveLoadToken) return;
      if (!cacheHit) writeKgCache(scope, resp);

      const hydrated = hydrateAtlasFromKgGraph(resp);
      if (hydrated.entities.length === 0) {
        useAtlasStore.setState({
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
        datasetMeta: datasetMetaFromKgResponse(resp, API_BASE),
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
      useAtlasStore.setState({
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
