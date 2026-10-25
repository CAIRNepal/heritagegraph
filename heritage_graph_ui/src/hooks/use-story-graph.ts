'use client';

import { useEffect, useMemo, useState } from 'react';

import { getPublicApiUrl } from '@/lib/api-base';
import { fetchKgGraph, type KgGraphResponse } from '@/lib/kg-graph';
import { indexGraph, type GraphIndex } from '@/lib/stories/build-story';

// One request per page load, shared by every story surface: moving from a
// record to its story or to a neighbour must not refetch the whole graph.
let pending: Promise<KgGraphResponse> | null = null;

function loadGraph(): Promise<KgGraphResponse> {
  if (!pending) {
    pending = fetchKgGraph(getPublicApiUrl(), undefined, { includeLux: 'none' }).catch((err) => {
      pending = null;
      throw err;
    });
  }
  return pending;
}

export interface StoryGraphState {
  index: GraphIndex | null;
  loading: boolean;
  error: string | null;
}

/** The reviewed public graph, indexed for story building. */
export function useStoryGraph(): StoryGraphState {
  const [graph, setGraph] = useState<KgGraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadGraph()
      .then((g) => alive && setGraph(g))
      .catch((err: unknown) => alive && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      alive = false;
    };
  }, []);

  const index = useMemo(() => (graph ? indexGraph(graph) : null), [graph]);
  return { index, loading: !graph && !error, error };
}
