'use client';

import { useEffect, useMemo, useState } from 'react';

import { getPublicApiUrl } from '@/lib/api-base';
import { fetchKgGraph, type KgGraphResponse } from '@/lib/kg-graph';
import { indexGraph, type GraphIndex } from '@/lib/stories/build-story';

// One request per page load, shared by every story surface: moving from a
// record to its story or to a neighbour must not refetch the whole graph.
// The fetch time travels with the graph: a story cites the graph as it was
// when this page read it, not "now".
let pending: Promise<{ graph: KgGraphResponse; fetchedAt: string }> | null = null;

function loadGraph(): Promise<{ graph: KgGraphResponse; fetchedAt: string }> {
  if (!pending) {
    pending = fetchKgGraph(getPublicApiUrl(), undefined, { includeLux: 'none' })
      .then((graph) => ({ graph, fetchedAt: new Date().toISOString() }))
      .catch((err) => {
        pending = null;
        throw err;
      });
  }
  return pending;
}

export interface StoryGraphState {
  index: GraphIndex | null;
  /** When the graph was read from the server (ISO timestamp). */
  fetchedAt: string | null;
  loading: boolean;
  error: string | null;
}

/** The reviewed public graph, indexed for story building. */
export function useStoryGraph(): StoryGraphState {
  const [graph, setGraph] = useState<KgGraphResponse | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadGraph()
      .then((g) => {
        if (!alive) return;
        setGraph(g.graph);
        setFetchedAt(g.fetchedAt);
      })
      .catch((err: unknown) => alive && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      alive = false;
    };
  }, []);

  const index = useMemo(() => (graph ? indexGraph(graph) : null), [graph]);
  return { index, fetchedAt, loading: !graph && !error, error };
}
