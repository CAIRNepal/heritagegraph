/**
 * Freeze records from the live knowledge graph into the museum's demo corpus.
 *
 * The demo corpus is the museum's default view: self-contained and always
 * rendering, but only 46 hand-made records. This adds records from the
 * reviewed public graph, frozen so the demo stays reproducible, and carrying
 * only what the graph can source:
 *
 *  - label, and the Nepali / Nepal Bhasa label where there is one;
 *  - the description only when the record cites a source;
 *  - photographs with the licence and author their Commons page states;
 *  - coordinates only when they are the record's own (never borrowed);
 *  - the date, the typed links, and the record's own source.
 *
 * Every photographed record is taken, with the records it links to so its
 * links resolve. A record whose name matches one of the 46 originals is the
 * same subject: it is dropped and its links point at the original.
 *
 * Usage (from heritage_graph_ui, with the backend running and
 * NEXT_PUBLIC_API_URL pointing at it):
 *   npm run freeze:kg        # write
 *   npm run check:kg         # fail if the frozen file is stale
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { getPublicApiUrl } from '../src/lib/api-base';
import { rdfTypeToNodeType, type KgGraphNode, type KgGraphResponse } from '../src/lib/kg-graph';

const ROOT = path.resolve(__dirname, '..');
const CURATED = path.join(ROOT, 'src/data/heritage-demo.json');
const OUT = path.join(ROOT, 'src/data/heritage-demo-kg.json');
const API = getPublicApiUrl();
const CHECK = process.argv.includes('--check');

/** Edges that describe a record rather than connect it. */
const SKIP_PREDICATES = new Set(['instance_of', 'cites']);

/**
 * Same subject, different name: the graph labels these only in Devanagari,
 * so name matching cannot see them. Keyed by the Wikidata item each cites.
 */
const SAME_AS_CURATED: Record<string, string> = {
  Q11378: 'heritage:ShivaLord', // शिव
};

/** Kinds that can name the same subject; a temple is never its goddess. */
const KIND_FAMILY: Record<string, string> = {
  Temple: 'site',
  ArchitecturalStructure: 'site',
  BuddhistMonument: 'site',
  SacredSite: 'site',
  Settlement: 'site',
  Place: 'site',
  Festival: 'event',
  HistoricalEvent: 'event',
  RitualEvent: 'event',
  TimeSpan: 'period',
  HistoricalPeriod: 'period',
};
const family = (nodeType: string) => KIND_FAMILY[nodeType] ?? nodeType;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[—–-].*$/, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(the|temple|stupa|mandir)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function ownCoords(n: KgGraphNode): { lat?: string; long?: string; coordinateSource?: string } {
  if (n.coordinateSource === 'inherited' || n.lat == null || n.long == null) return {};
  return { lat: String(n.lat), long: String(n.long), ...(n.coordinateSource ? { coordinateSource: n.coordinateSource } : {}) };
}

async function main() {
  const curated = JSON.parse(readFileSync(CURATED, 'utf8'));
  const curatedByName = new Map<string, { id: string; family: string }>();
  const curatedIds = new Set<string>(curated['@graph'].map((item: { '@id': string }) => item['@id']));
  for (const item of curated['@graph']) if (item.label) curatedByName.set(norm(item.label), { id: item['@id'], family: family(item.nodeType) });

  if (!API) throw new Error('Set NEXT_PUBLIC_API_URL to the backend origin');
  const res = await fetch(`${API}/api/v1/cidoc/kg/graph/?scope=reviewed&include_lux=none`);
  if (!res.ok) throw new Error(`kg/graph responded ${res.status}`);
  const kg = (await res.json()) as KgGraphResponse;

  const typed = new Map<string, { node: KgGraphNode; nodeType: string }>();
  for (const n of kg.nodes) {
    const nodeType = rdfTypeToNodeType(n.types);
    if (nodeType) typed.set(n.id, { node: n, nodeType });
  }

  // Same subject as a curated original: link to the original instead.
  const alias = new Map<string, string>();
  const duplicates: string[] = [];
  for (const [id, { node, nodeType }] of typed) {
    const qid = node.recordSource?.citation?.match(/\bWikidata (Q\d+)/)?.[1];
    const named = curatedByName.get(norm(node.label));
    const hit = (named && named.family === family(nodeType) ? named.id : undefined) ?? (qid ? SAME_AS_CURATED[qid] : undefined);
    if (hit) {
      alias.set(id, hit);
      duplicates.push(`${node.label} -> ${hit}`);
    }
  }
  const resolve = (id: string) => alias.get(id) ?? id;

  const edges = kg.edges.filter((e) => typed.has(e.source) && typed.has(e.target) && !SKIP_PREDICATES.has(e.predicateLocal));
  const photographed = [...typed.values()].filter(({ node }) => node.imageUrl && !alias.has(node.id)).map(({ node }) => node.id);
  const keep = new Set(photographed);
  for (const e of edges) {
    if (keep.has(e.source) && !alias.has(e.target)) keep.add(e.target);
    if (keep.has(e.target) && !alias.has(e.source)) keep.add(e.source);
  }

  const relationsOf = new Map<string, { predicate: string; target: string }[]>();
  for (const e of edges) {
    const s = resolve(e.source);
    const o = resolve(e.target);
    if (s === o || (!keep.has(e.source) && !keep.has(e.target))) continue;
    if (alias.has(e.source)) continue; // links from a curated original stay as the original authored them
    if (!keep.has(e.source)) continue;
    if (!keep.has(o) && !curatedIds.has(o)) continue; // target outside the extension
    const list = relationsOf.get(s) ?? relationsOf.set(s, []).get(s)!;
    if (!list.some((r) => r.predicate === e.predicateLocal && r.target === o)) list.push({ predicate: e.predicateLocal, target: o });
  }

  const graph = [...keep]
    .sort()
    .map((id) => {
      const { node, nodeType } = typed.get(id)!;
      const ne = node.labels?.ne ?? node.labels?.new;
      const sourced = Boolean(node.recordSource);
      const images = (node.images ?? []).filter((u) => node.imageCredits?.[u]);
      return {
        '@id': id,
        nodeType,
        label: node.label,
        ...(ne && ne !== node.label ? { labelNe: ne } : {}),
        description: sourced && node.comment ? node.comment : '',
        storyText: '',
        ...ownCoords(node),
        ...(node.inceptionYear ? { inceptionYear: String(node.inceptionYear) } : {}),
        ...(images.length ? { imageUrl: images[0], images, imageCredits: Object.fromEntries(images.map((u) => [u, node.imageCredits![u]])) } : {}),
        ...(node.recordSource ? { recordSource: node.recordSource } : {}),
        kgRelations: relationsOf.get(id) ?? [],
      };
    });

  const out = {
    _provenance: {
      generatedBy: 'scripts/freeze-kg-extension.ts',
      source: `${kg.graph} (scope=reviewed)`,
      records: graph.length,
      note:
        'Frozen from the reviewed public knowledge graph. Only sourced fields: labels, cited descriptions, licensed photographs, own coordinates, dates, typed links and each record’s own source. Records matching a curated original by name are folded into it.',
      foldedIntoCurated: duplicates.sort(),
    },
    '@graph': graph,
  };
  const serialized = JSON.stringify(out, null, 1) + '\n';

  if (CHECK) {
    const current = readFileSync(OUT, 'utf8');
    if (current !== serialized) {
      console.error('✗ heritage-demo-kg.json is stale — run: npm run freeze:kg');
      process.exit(1);
    }
    console.log('✓ knowledge-graph extension is up to date');
    return;
  }
  writeFileSync(OUT, serialized);
  console.log(`✓ ${graph.length} records (${photographed.length} photographed), ${edges.length} links considered, ${duplicates.length} folded into curated originals`);
  for (const d of duplicates) console.log('   folded:', d);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
