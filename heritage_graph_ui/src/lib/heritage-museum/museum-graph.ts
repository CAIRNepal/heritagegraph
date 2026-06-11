import type { GraphData, GraphLink, GraphNode, ImageCredit } from '@/app/(dashboard)/heritage-museum/heritage-data';
import { NODE_TYPE_CONFIG } from '@/app/(dashboard)/heritage-museum/heritage-data';
import { parseCoord, propagateCoordsAlongLocationEdges, type GeoCoord } from '@/lib/kg-geo';
import type { KgGraphNode } from '@/lib/kg-graph';
import type { NodeType } from '@/lib/ontology/__generated__/heritage-viz-config';

function linkEndpointId(endpoint: string | GraphNode): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.id;
}

function syntheticNarrative(n: KgGraphNode, nodeType: NodeType, isLux: boolean): string {
  const typeLabel = NODE_TYPE_CONFIG[nodeType].label;
  if (isLux) {
    return 'Linked Yale LUX collection record — open the external catalogue for images and catalogue metadata.';
  }
  return `${n.label} is a ${typeLabel} entity in the reviewed HeritageGraph public knowledge graph. Select related nodes in the graph or open the full record to explore connections and provenance.`;
}

/** Narrative + key facts for live KG nodes; prefers API comment/media over placeholders. */
export function enrichKgNodeForMuseum(
  n: KgGraphNode,
  nodeType: NodeType,
): Pick<
  GraphNode,
  'description' | 'storyText' | 'keyFacts' | 'imageUrl' | 'images' | 'imageCredits'
> {
  const cfg = NODE_TYPE_CONFIG[nodeType];
  const isLux = n.sourceLayer === 'lux';
  const typeLabel = cfg.label;

  const apiComment = n.comment?.trim() ?? '';
  const description = apiComment || syntheticNarrative(n, nodeType, isLux);

  const keyFacts: Array<{ label: string; value: string }> = [];
  if (isLux && n.externalUri) {
    keyFacts.push({ label: 'Yale LUX', value: n.externalUri });
  }
  if (n.narrativeSource) {
    keyFacts.push({ label: 'Narrative source', value: n.narrativeSource });
  }
  if (n.imageSource) {
    keyFacts.push({ label: 'Image source', value: n.imageSource });
  }
  keyFacts.push({ label: 'Entity type', value: typeLabel });
  if (cfg.cidocMapping) {
    keyFacts.push({ label: 'CIDOC-CRM', value: cfg.cidocMapping });
  }
  if (n.inceptionYear?.trim()) {
    keyFacts.push({ label: 'Temporal', value: n.inceptionYear.trim() });
  }
  if (n.lat?.trim() && n.long?.trim()) {
    keyFacts.push({ label: 'Coordinates', value: `${n.lat.trim()}, ${n.long.trim()}` });
  }

  const imageCredits: Record<string, ImageCredit> | undefined = n.imageCredits
    ? Object.fromEntries(
        Object.entries(n.imageCredits).map(([url, c]) => [
          url,
          {
            license: c.license,
            licenseUrl: c.licenseUrl,
            artist: c.artist,
            descriptionUrl: c.descriptionUrl,
            source: c.source,
            retrieved: c.retrieved,
          },
        ]),
      )
    : undefined;

  return {
    description,
    storyText: description,
    keyFacts,
    imageUrl: n.imageUrl ?? undefined,
    images: n.images?.length ? n.images : n.imageUrl ? [n.imageUrl] : undefined,
    imageCredits,
  };
}

/** Copy lat/long from geo-referenced neighbours along location predicates. */
export function propagateGeoFromLinks(nodes: GraphNode[], links: GraphLink[]): void {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const coordById = new Map<string, GeoCoord>();

  for (const n of nodes) {
    const lat = parseCoord(n.lat);
    const lon = parseCoord(n.long);
    if (lat != null && lon != null) {
      coordById.set(n.id, { lat, lon });
    }
  }

  const geoLinks = links.map((l) => ({
    source: linkEndpointId(l.source),
    target: linkEndpointId(l.target),
    predicate: l.predicate,
  }));

  const inherited = propagateCoordsAlongLocationEdges(coordById, geoLinks);
  for (const [id, coords] of inherited) {
    const node = byId.get(id);
    if (node) {
      node.lat = String(coords.lat);
      node.long = String(coords.lon);
    }
  }
}

/** Apply museum-side enrichment after kgToGraphData (geo propagation). */
export function enrichMuseumGraph(graph: GraphData): GraphData {
  propagateGeoFromLinks(graph.nodes, graph.links);
  return graph;
}

function pickRepresentative(group: GraphNode[]): GraphNode {
  const canonicalId = group.find((n) => n.canonicalMemberId)?.canonicalMemberId;
  return [...group].sort((a, b) => {
    if (canonicalId) {
      const aCanon = a.id === canonicalId || a.canonicalMemberId === canonicalId ? 1 : 0;
      const bCanon = b.id === canonicalId || b.canonicalMemberId === canonicalId ? 1 : 0;
      if (bCanon !== aCanon) return bCanon - aCanon;
    }
    const aMedia = a.imageUrl || a.images?.length ? 1 : 0;
    const bMedia = b.imageUrl || b.images?.length ? 1 : 0;
    if (bMedia !== aMedia) return bMedia - aMedia;
    const aStory = (a.storyText || a.description || '').length;
    const bStory = (b.storyText || b.description || '').length;
    if (bStory !== aStory) return bStory - aStory;
    const aCluster = a.clusterLabel && a.label === a.clusterLabel ? 1 : 0;
    const bCluster = b.clusterLabel && b.label === b.clusterLabel ? 1 : 0;
    if (bCluster !== aCluster) return bCluster - aCluster;
    return a.label.localeCompare(b.label);
  })[0];
}

/** Collapse multiple KG nodes that share the same identity cluster (same type). */
export function collapseClusterDuplicates(graph: GraphData): GraphData {
  const byCluster = new Map<string, GraphNode[]>();
  const unclustered: GraphNode[] = [];

  for (const node of graph.nodes) {
    if (!node.clusterId) {
      unclustered.push(node);
      continue;
    }
    const key = `${node.nodeType}:${node.clusterId}`;
    const bucket = byCluster.get(key) ?? [];
    bucket.push(node);
    byCluster.set(key, bucket);
  }

  const idRemap = new Map<string, string>();
  const kept: GraphNode[] = [...unclustered];

  for (const group of byCluster.values()) {
    if (group.length === 1) {
      kept.push(group[0]);
      continue;
    }
    const rep = pickRepresentative(group);
    const aliases = group.filter((n) => n.id !== rep.id).map((n) => n.label);
    kept.push({
      ...rep,
      clusterAliases: aliases,
      tags: [...(rep.tags ?? []), `identity:${group.length} records merged`],
    });
    for (const n of group) {
      if (n.id !== rep.id) {
        idRemap.set(n.id, rep.id);
      }
    }
  }

  const keptIds = new Set(kept.map((n) => n.id));
  const seen = new Set<string>();
  const links: GraphLink[] = [];

  for (const l of graph.links) {
    const srcRaw = typeof l.source === 'string' ? l.source : l.source.id;
    const tgtRaw = typeof l.target === 'string' ? l.target : l.target.id;
    const src = idRemap.get(srcRaw) ?? srcRaw;
    const tgt = idRemap.get(tgtRaw) ?? tgtRaw;
    if (src === tgt) continue;
    if (!keptIds.has(src) || !keptIds.has(tgt)) continue;
    const key = `${src}→${tgt}→${l.predicate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ ...l, source: src, target: tgt });
  }

  return { nodes: kept, links };
}
