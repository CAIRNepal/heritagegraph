import type { DatasetMeta } from '@/lib/provenance';
import { HERITAGEGRAPH_RELEASE } from '@/lib/provenance';

import type { GraphData } from '../heritage-data';

/**
 * JSON-LD-flavoured snapshot of exactly what the visitor can see, for citation.
 *
 * Shaped by the museum's own `GraphData`, so it belongs here rather than in
 * `lib/provenance`, which must stay free of page view models.
 */
export function exportVisibleGraphPayload(
  graph: GraphData,
  meta: DatasetMeta | null,
  dataSource: 'demo' | 'live',
): Record<string, unknown> {
  return {
    '@context': {
      hg: 'https://w3id.org/heritagegraph/',
      prov: 'http://www.w3.org/ns/prov#',
    },
    type: 'heritagegraph:MuseumSubgraphExport',
    release: HERITAGEGRAPH_RELEASE,
    exportedAt: new Date().toISOString(),
    dataSource,
    dataset: meta,
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      nodeType: n.nodeType,
      cidocMapping: n.cidocMapping,
      lat: n.lat,
      long: n.long,
    })),
    edges: graph.links.map((l) => {
      const source = typeof l.source === 'string' ? l.source : l.source.id;
      const target = typeof l.target === 'string' ? l.target : l.target.id;
      return {
        source,
        target,
        predicate: l.predicate,
        provenance: l.provenance ?? null,
      };
    }),
  };
}
