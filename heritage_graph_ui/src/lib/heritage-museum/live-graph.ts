import {
  NODE_TYPE_CONFIG,
  type GraphData,
  type GraphLink,
  type GraphNode,
} from '@/app/(site)/heritage-museum/heritage-data';
import { collapseClusterDuplicates, enrichKgNodeForMuseum } from '@/lib/heritage-museum/museum-graph';
import { rdfTypeToNodeType, type KgGraphResponse, type KgNeighborhoodResponse } from '@/lib/kg-graph';

/**
 * Turning the live knowledge graph (`/api/v1/cidoc/kg/graph/`) into the
 * GraphData the museum and the atlas both render.
 */

// ── Live Knowledge Graph → museum graph conversion ────────────────────────────
//
// The live view reads the Oxigraph PUBLIC graph: every node is typed by its real
// rdf:type and every edge is a real triple (see lib/kg-graph.ts + the backend
// /kg/graph/ endpoint). Node types come straight from the ontology via
// RDF_CLASS_URI_TO_NODE_TYPE — no lossy category enum, no heuristic edges.
// Nodes whose rdf:type maps to no NodeType are dropped to stay ontology-faithful.
export function kgToGraphData(resp: KgGraphResponse): GraphData {
  const nodes: GraphNode[] = [];
  const kept = new Set<string>();

  for (const n of resp.nodes) {
    const nodeType = rdfTypeToNodeType(n.types);
    if (!nodeType) continue; // not an ontology class we visualise
    const cfg = NODE_TYPE_CONFIG[nodeType];
    kept.add(n.id);
    const isLux = n.sourceLayer === 'lux';
    const narrative = enrichKgNodeForMuseum(n, nodeType);
    nodes.push({
      id: n.id,
      label: n.label,
      labelNe: devanagariLabel(n.labels, n.label),
      recordSource: n.recordSource ?? null,
      nodeType,
      cidocMapping: cfg.cidocMapping,
      hgCategory: cfg.hgCategory as GraphNode['hgCategory'],
      description: narrative.description,
      storyText: narrative.storyText,
      imageUrl: narrative.imageUrl,
      images: narrative.images,
      imageCredits: narrative.imageCredits,
      lat: n.lat ?? undefined,
      long: n.long ?? undefined,
      inceptionYear: n.inceptionYear ?? undefined,
      tags: isLux ? ['Yale LUX', 'Collection link'] : undefined,
      keyFacts: narrative.keyFacts,
      clusterId: n.clusterId ?? undefined,
      clusterLabel: n.clusterLabel ?? undefined,
      typeScope: n.typeScope ?? undefined,
      canonicalMemberId: n.canonicalMemberId ?? undefined,
      relations: [],
    });
  }

  const links: GraphLink[] = resp.edges
    .filter((e) => kept.has(e.source) && kept.has(e.target))
    .map((e) => ({
      source: e.source,
      target: e.target,
      predicate: (e.predicateLocal || 'associated_with').replace(/-/g, '_'),
      provenance: e.provenance ?? null,
    }));

  return collapseClusterDuplicates({ nodes, links });
}

/** The record's Nepali (else Nepal Bhasa) label, when it differs from the display label. */
export function devanagariLabel(labels: Record<string, string> | undefined, label: string): string | undefined {
  const ne = labels?.ne ?? labels?.new;
  return ne && ne !== label ? ne : undefined;
}

// Local name of an IRI (after the last # or /).
function iriLocalName(iri: string): string {
  if (!iri) return '';
  const i = Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/'));
  return i >= 0 ? iri.slice(i + 1) : iri;
}

// Convert a node's neighborhood (click-to-expand) into nodes + links. Only typed
// resource neighbours are kept — literals (label/comment) and untyped IRIs drop out.
export function kgNeighborhoodToGraph(
  centerId: string,
  resp: KgNeighborhoodResponse,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const seen = new Set<string>();

  for (const e of resp.edges) {
    if (!e.value || !/^https?:\/\//.test(e.value)) continue; // skip literals
    const nodeType = e.valueType ? rdfTypeToNodeType([e.valueType]) : null;
    if (!nodeType) continue; // only render ontology-typed neighbours
    if (!seen.has(e.value)) {
      seen.add(e.value);
      const cfg = NODE_TYPE_CONFIG[nodeType];
      const isLux = e.value.includes('/imported/lux/');
      const narrative = enrichKgNodeForMuseum(
        {
          id: e.value,
          types: e.valueType ? [e.valueType] : [],
          label: e.valueLabel || iriLocalName(e.value),
          comment: null,
          lat: null,
          long: null,
          sourceLayer: isLux ? 'lux' : 'curated',
          externalUri: isLux ? e.value : null,
        },
        nodeType,
      );
      nodes.push({
        id: e.value,
        label: e.valueLabel || iriLocalName(e.value),
        nodeType,
        cidocMapping: cfg.cidocMapping,
        hgCategory: cfg.hgCategory as GraphNode['hgCategory'],
        description: narrative.description,
        storyText: narrative.storyText,
        keyFacts: narrative.keyFacts,
        tags: isLux ? ['Yale LUX', 'Collection link'] : undefined,
        relations: [],
      });
    }
    const predicate = (iriLocalName(e.predicate) || 'associated_with').replace(/-/g, '_');
    links.push(
      e.direction === 'outbound'
        ? { source: centerId, target: e.value, predicate }
        : { source: e.value, target: centerId, predicate },
    );
  }
  return { nodes, links };
}

// Build a HeritageRelation[] for every node from the edge list so the
// StoryPanel's Connections section works for live data too.
export function attachRelations(nodes: GraphNode[], links: GraphLink[]): void {
  const byId = new Map<string, GraphNode>();
  for (const n of nodes) {
    n.relations = [];
    byId.set(n.id, n);
  }
  for (const l of links) {
    const sourceId = typeof l.source === 'string' ? l.source : l.source.id;
    const targetId = typeof l.target === 'string' ? l.target : l.target.id;
    const src = byId.get(sourceId);
    const tgt = byId.get(targetId);
    if (src && tgt) {
      src.relations.push({
        predicate: l.predicate,
        targetId,
        targetLabel: tgt.label,
        provenance: l.provenance ?? null,
      });
    }
  }
}
