'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';

import {
  fetchHeritageDemoCorpus,
  type CorpusProvenance,
  type GraphData,
} from '@/app/(site)/heritage-museum/heritage-data';
import { getPublicApiUrl, isPublicApiUrlConfigured } from '@/lib/api-base';
import { attachRelations, kgToGraphData } from '@/lib/heritage-museum/live-graph';
import { enrichMuseumGraph } from '@/lib/heritage-museum/museum-graph';
import { fetchKgGraph, type KgGraphResponse } from '@/lib/kg-graph';
import { datasetMetaFromKgResponse, type DatasetMeta } from '@/lib/provenance';

export type CollectionSource = 'demo' | 'live';
export type LiveError = 'unconfigured' | 'notfound' | 'timeout' | 'live';

export const API_BASE = getPublicApiUrl();
/** Give up on the live graph after this long and say so, rather than spin forever. */
const LIVE_TIMEOUT_MS = 20_000;

/**
 * The heritage collection the museum and the atlas both show: the illustrated
 * demo corpus, or the live reviewed knowledge graph.
 *
 * The demo corpus loads once and always renders. The live graph loads on
 * request: curated graph first (≈0.5 s), Yale LUX links after in the
 * background (the backend queries a remote endpoint for those, ≈20 s), merged
 * only if they add anything.
 */
export function useHeritageCollection() {
  const { data: session } = useSession();

  const [source, setSource] = useState<CollectionSource>('demo');

  const [demoGraph, setDemoGraph] = useState<GraphData | null>(null);
  const [demoProvenance, setDemoProvenance] = useState<CorpusProvenance | null>(null);
  const [demoLoading, setDemoLoading] = useState(true);
  const [demoError, setDemoError] = useState<string | null>(null);

  const [liveGraph, setLiveGraph] = useState<GraphData | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<LiveError | null>(null);
  const [datasetMeta, setDatasetMeta] = useState<DatasetMeta | null>(null);
  const liveAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetchHeritageDemoCorpus()
      .then(({ graph, provenance }) => {
        setDemoGraph(graph);
        setDemoProvenance(
          provenance
            ? { retrieved: provenance.retrieved, generatedBy: provenance.generatedBy, imageSource: provenance.imageSource, note: provenance.note }
            : null,
        );
        setDemoLoading(false);
      })
      .catch(() => {
        setDemoError('demo');
        setDemoLoading(false);
      });
  }, []);

  const applyLiveResponse = useCallback((resp: KgGraphResponse) => {
    const { nodes, links } = kgToGraphData(resp);
    setDatasetMeta(datasetMetaFromKgResponse(resp, API_BASE));
    attachRelations(nodes, links);
    enrichMuseumGraph({ nodes, links });
    setLiveGraph({ nodes, links });
  }, []);

  const loadLive = useCallback(async () => {
    if (!API_BASE || !isPublicApiUrlConfigured()) {
      console.error('heritage collection: NEXT_PUBLIC_API_URL is not set, so the live graph cannot load.');
      setLiveError('unconfigured');
      setLiveLoading(false);
      return;
    }
    liveAbortRef.current?.abort();
    const ctrl = new AbortController();
    liveAbortRef.current = ctrl;
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      ctrl.abort();
    }, LIVE_TIMEOUT_MS);
    setLiveLoading(true);
    setLiveError(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const token = (session as any)?.accessToken as string | undefined;
    try {
      applyLiveResponse(await fetchKgGraph(API_BASE, token, { includeLux: 'none', signal: ctrl.signal }));
    } catch (err) {
      if (ctrl.signal.aborted && !timedOut) return; // superseded by a newer load
      const msg = err instanceof Error ? err.message : '';
      if (timedOut) {
        setLiveError('timeout');
      } else if (/\b404\b/.test(msg)) {
        console.error(`heritage collection: ${API_BASE}/api/v1/cidoc/kg/graph/ returned 404. Check NEXT_PUBLIC_API_URL (baked in at build time).`);
        setLiveError('notfound');
      } else {
        console.error('heritage collection: live graph failed to load', err);
        setLiveError('live');
      }
      return;
    } finally {
      window.clearTimeout(timer);
      if (liveAbortRef.current === ctrl) setLiveLoading(false);
    }

    fetchKgGraph(API_BASE, token, { includeLux: 'linked', signal: ctrl.signal })
      .then((resp) => {
        if ((resp.counts.luxNodes ?? 0) > 0 && liveAbortRef.current === ctrl) applyLiveResponse(resp);
      })
      .catch(() => {
        /* the curated graph is already showing; LUX links are optional */
      });
  }, [session, applyLiveResponse]);

  useEffect(() => () => liveAbortRef.current?.abort(), []);

  /** Switch collections. Returns false when live data is not configured. */
  const switchTo = useCallback(
    (next: CollectionSource): boolean => {
      if (next === 'live') {
        if (!API_BASE || !isPublicApiUrlConfigured()) {
          setLiveError('unconfigured');
          return false;
        }
        setSource('live');
        if (!liveGraph) void loadLive();
      } else {
        setSource('demo');
        setLiveError(null);
      }
      return true;
    },
    [liveGraph, loadLive],
  );

  const retryLive = useCallback(() => {
    setLiveError(null);
    void loadLive();
  }, [loadLive]);

  const graph = source === 'live' ? liveGraph : demoGraph;
  return {
    source,
    switchTo,
    graph,
    /** Waiting for the first graph of the current source. */
    loading: source === 'live' ? liveLoading && !liveGraph : demoLoading,
    error: source === 'live' ? liveError : demoError,
    liveLoading,
    liveError,
    dismissLiveError: () => setLiveError(null),
    retryLive,
    setLiveGraph,
    datasetMeta: source === 'live' ? datasetMeta : null,
    demoProvenance,
    demoCount: demoGraph?.nodes.length ?? 0,
  };
}

export type HeritageCollection = ReturnType<typeof useHeritageCollection>;
