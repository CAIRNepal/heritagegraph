import type { KgGraphResponse } from '@/lib/kg-graph';

/**
 * Dataset identity, citation, and reproducibility for the whole platform.
 *
 * How HeritageGraph is cited must not depend on which surface the reader came
 * from, so the release, DOI, citation string, and SPARQL endpoint live here
 * rather than inside any one page. Keep this module free of page view models.
 */

/** Release aligned with CITATION.cff / CHANGELOG.md */
export const HERITAGEGRAPH_RELEASE = '0.1.0';

export const HERITAGEGRAPH_REPOSITORY = 'https://github.com/CAIRNepal/heritagegraph';

/**
 * Zenodo DOI, or null until the first deposit exists.
 *
 * Deliberately nullable rather than a placeholder string. A stand-in like
 * `10.5281/zenodo.XXXXXXX` renders as a real identifier in the Methods table and
 * gets copied into bibliographies via the citation button; null forces every
 * call site to say "not yet deposited" instead. Set this, `CITATION.cff` and
 * `.zenodo.json` together when the release is deposited.
 */
export const HERITAGEGRAPH_DOI: string | null = null;

export const HERITAGEGRAPH_PUBLIC_GRAPH = 'https://w3id.org/heritagegraph/graph/public';

/** Pinned SHA-256 of data/reconciled/danam-heritagegraph.nq (L0 research dump). */
export const DANAM_NQ_SHA256 =
  '14decfcdf95aee0799b65b572e4ef0ec6cabc8581201661b35ee5a6d059c050c';

/**
 * Citation string offered by the "copy citation" buttons.
 *
 * Includes the DOI only when one exists, so the copied text is never a citation
 * a reader cannot resolve.
 */
export const HERITAGEGRAPH_CITATION = [
  `Oli, N. & Karki, N. HeritageGraph: A Cultural Heritage Linked Open Data Platform`,
  `(v${HERITAGEGRAPH_RELEASE}). CAIR-Nepal.`,
  HERITAGEGRAPH_DOI ? `https://doi.org/${HERITAGEGRAPH_DOI}` : HERITAGEGRAPH_REPOSITORY,
].join(' ');

/**
 * License stratification for the Methods table (code + data layers).
 *
 * `key` indexes the `methods.licenses.layers.*` messages; the layer name and
 * note are prose and belong in the message catalogue, not here. `license` is a
 * licence identifier and is intentionally not translated.
 */
export const LICENSE_MATRIX: ReadonlyArray<{
  key: string;
  license: string;
}> = [
  { key: 'software', license: 'MIT' },
  { key: 'curatedOverlay', license: 'CC BY 4.0' },
  { key: 'openstreetmap', license: 'ODbL 1.0' },
  { key: 'wikidata', license: 'CC0 1.0' },
  { key: 'unesco', license: 'UNESCO terms' },
  { key: 'intangible', license: 'CC BY 4.0 + CARE' },
];

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

/** Provenance of one fetched knowledge-graph snapshot, as cited to the reader. */
export interface DatasetMeta {
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

/** @deprecated Use DatasetMeta — kept for gradual call-site migration. */
export type MuseumDatasetMeta = DatasetMeta;

export function datasetMetaFromKgResponse(
  resp: KgGraphResponse,
  apiBase?: string,
): DatasetMeta {
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

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
