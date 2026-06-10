import type { GraphData } from '@/app/(dashboard)/heritage-museum/heritage-data';
import type { KgGraphResponse } from '@/lib/kg-graph';

/** Release aligned with CITATION.cff / CHANGELOG.md */
export const HERITAGEGRAPH_RELEASE = '0.1.0';

export const HERITAGEGRAPH_DOI = '10.5281/zenodo.XXXXXXX';

export const HERITAGEGRAPH_PUBLIC_GRAPH =
  'https://w3id.org/heritagegraph/graph/public';

export const HERITAGEGRAPH_CITATION = `Oli, N. & Karki, N. HeritageGraph: A Cultural Heritage Linked Open Data Platform (v${HERITAGEGRAPH_RELEASE}). CAIR-Nepal. https://github.com/CAIRNepal/CHLOD`;

/** Resource URI segment → knowledge route domain (when they differ). */
const RESOURCE_SEGMENT_TO_DOMAIN: Readonly<Record<string, string>> = {
  culturalentity: 'entity',
};

/** Curated resource IRI → knowledge-base detail page. */
export function resourceIriToDetailHref(iri: string): string | null {
  const m = iri.match(/\/resource\/([^/]+)\/([^/?#]+)\/?$/);
  if (!m) return null;
  const domain = RESOURCE_SEGMENT_TO_DOMAIN[m[1]] ?? m[1];
  return `/knowledge/${domain}/view/${encodeURIComponent(m[2])}`;
}

export function isCuratedResourceIri(iri: string): boolean {
  return iri.includes('/resource/');
}

export interface MuseumDatasetMeta {
  release: string;
  scope: 'reviewed' | 'all';
  graphUri: string;
  layers: string[];
  nodeCount: number;
  edgeCount: number;
  edgesWithProvenance?: number;
  luxLinkCount?: number;
  includeLux?: boolean;
  fetchedAt: string;
  apiBase?: string;
}

export function datasetMetaFromKgResponse(
  resp: KgGraphResponse,
  apiBase?: string,
): MuseumDatasetMeta {
  return {
    release: HERITAGEGRAPH_RELEASE,
    scope: 'reviewed',
    graphUri: resp.graph?.split('+')[0] ?? HERITAGEGRAPH_PUBLIC_GRAPH,
    layers: resp.layers ?? [resp.graph],
    nodeCount: resp.counts?.nodes ?? resp.nodes.length,
    edgeCount: resp.counts?.edges ?? resp.edges.length,
    edgesWithProvenance: resp.counts?.edgesWithProvenance,
    luxLinkCount: resp.luxLinkCount,
    includeLux: resp.includeLux,
    fetchedAt: new Date().toISOString(),
    apiBase,
  };
}

/** SPARQL for the visible subgraph (reviewed public partition). */
export function sparqlForPublicSubgraph(
  graphUri: string = HERITAGEGRAPH_PUBLIC_GRAPH,
  limit = 500,
): string {
  return `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
SELECT ?s ?p ?o WHERE {
  GRAPH <${graphUri}> {
    ?s ?p ?o .
    FILTER(isIRI(?o))
    FILTER(?p != rdf:type)
  }
}
LIMIT ${limit}`;
}

export function publicSparqlEndpoint(apiBase: string): string {
  const env = process.env.NEXT_PUBLIC_SPARQL_URL?.trim();
  if (env) return env;
  return `${apiBase.replace(/\/$/, '')}/cidoc/sparql/`;
}

export function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportVisibleGraphPayload(
  graph: GraphData,
  meta: MuseumDatasetMeta | null,
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

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
