'use client';

import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

import { hydrateAtlasFromInstanceGraph } from '@/lib/atlas-api-hydrate';
import { fetchInstanceGraphData } from '@/lib/instance-graph';
import { getApiErrorMessage } from '@/lib/api-client';
import { getPublicApiUrl } from '@/lib/api-base';
import { atlasTrack } from '@/lib/atlas-telemetry';

import { computeAtlasTimelineExtents } from '../atlas-time-extents';
import { useAtlasStore } from './use-atlas-store';

const API_BASE = getPublicApiUrl();

/**
 * Boots corpus hydration: curated demo by default; opt into live via toggle or `?source=live`.
 */
export function useAtlasDataSource() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const dataSource = useAtlasStore((s) => s.dataSource);
  const corpusStatus = useAtlasStore((s) => s.corpusStatus);
  const abortRef = useRef<AbortController | null>(null);
  const bootstrappedRef = useRef(false);

  const tryLoadLive = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const loadToken = useAtlasStore.getState().liveLoadToken;
    const token = (session as { accessToken?: string } | null)?.accessToken;
    useAtlasStore.setState({ corpusStatus: 'loading', corpusError: null });
    atlasTrack('corpus_load_start', { mode: 'live' });

    try {
      const raw = await fetchInstanceGraphData(API_BASE, token, { signal: ac.signal });
      if (ac.signal.aborted || loadToken !== useAtlasStore.getState().liveLoadToken) return;

      const hydrated = hydrateAtlasFromInstanceGraph(raw);
      if (hydrated.entities.length === 0) {
        useAtlasStore.setState({
          corpusStatus: 'error',
          corpusError: 'No entities returned from the API.',
        });
        return;
      }
      const extents = computeAtlasTimelineExtents(hydrated.entities);
      if (loadToken !== useAtlasStore.getState().liveLoadToken) return;

      useAtlasStore.setState({
        entities: hydrated.entities,
        edges: hydrated.edges,
        dataSource: 'live',
        corpusStatus: 'ready',
        corpusError: null,
        locationStats: hydrated.locationStats,
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
        entities: hydrated.entities.length,
        spatial: hydrated.spatialCount,
      });
    } catch (err) {
      if (ac.signal.aborted) return;
      const message = getApiErrorMessage(err, 'Could not reach the HeritageGraph API.');
      useAtlasStore.setState({
        corpusStatus: 'error',
        corpusError: message,
      });
      atlasTrack('corpus_load_error', { message });
    }
  }, [session]);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    if (searchParams.get('source') === 'live') {
      useAtlasStore.getState().loadLiveCorpus();
    }
  }, [searchParams]);

  useEffect(() => {
    if (dataSource === 'live' && corpusStatus === 'idle') {
      void tryLoadLive();
    }
  }, [dataSource, corpusStatus, tryLoadLive]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { loadLiveCorpus: tryLoadLive, abortLiveLoad: () => abortRef.current?.abort() };
}
