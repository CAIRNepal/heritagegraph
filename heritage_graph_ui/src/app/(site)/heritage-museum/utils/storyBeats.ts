import { recordFor } from '@/lib/records/entity-records';

import {
  NODE_TYPE_CONFIG,
  RELATION_LABELS,
  type GraphNode,
} from '../heritage-data';

/**
 * One card in the story carousel.
 *
 * `sourced` is the important field. The carousel is a hero: whatever it shows
 * reads as fact. Most of these beats are built from the demo corpus's
 * `description` / `storyText` / `history` / `culturalRole` / `architecture` /
 * `significance` / `rituals` fields, and that corpus disclaims all of them in
 * its own `_provenance` block — "no recorded source… must not be cited". Beats
 * built from structured data (the fact table, real graph edges) or from a
 * frozen sourced record are a different thing entirely, and the UI has to be
 * able to tell them apart to caption one and not the other.
 *
 * The `icon` field is gone: it was an emoji per beat, rendered beside the
 * title. `node-icons.tsx` replaced emoji everywhere else so surfaces render
 * identically and embed cleanly in publication figures, and the sparkle on the
 * intro beat was the specific thing that made a generated line read as
 * machine-written filler.
 */
export interface Beat {
  title: string;
  lines: string[];
  type: 'intro' | 'facts' | 'story' | 'history' | 'culture' | 'arch' | 'rituals' | 'visit';
  /** False when the text comes from a corpus field with no recorded source. */
  sourced: boolean;
}

function nonEmptyLines(lines: string[]): string[] {
  return lines.map((l) => (l ?? '').trim()).filter(Boolean);
}

export function clampBeatIndex(idx: number, beatCount: number): number {
  if (beatCount <= 0) return 0;
  return ((idx % beatCount) + beatCount) % beatCount;
}

/**
 * The opening line, or nothing.
 *
 * This used to end with
 * `` `${node.label} — ${typeLabel} in the HeritageGraph knowledge graph.` ``
 * — a restatement of the node's type, generated when no prose existed, shown in
 * the hero with a sparkle beside it. It is the clearest sourcing objection the
 * page offered: a research artefact whose lead sentence is machine-written
 * filler about its own data model.
 *
 * There is no fallback now. A frozen sourced record is preferred over corpus
 * prose where one exists, because a cited Wikipedia lead is worth more than an
 * uncited paragraph written for a demo; failing both, the beat carries no line
 * and the facts beat leads instead.
 */
function introLine(node: GraphNode): { text: string; sourced: boolean } | null {
  const record = recordFor(node.id)?.description?.text?.trim();
  if (record) return { text: record, sourced: true };
  const fromFields = node.description?.trim() || node.storyText?.trim();
  if (fromFields) return { text: fromFields, sourced: false };
  return null;
}

/**
 * @param unsourcedProse true when the node's prose fields come from the demo
 *   corpus, which disclaims them. Threaded in rather than inferred, because a
 *   live reviewed node's `description` is the API's `rdfs:comment` and IS
 *   sourced — the same field name means different things per data source.
 */
export function buildBeats(node: GraphNode, unsourcedProse = true): Beat[] {
  const beats: Beat[] = [];
  const intro = introLine(node);
  const proseSourced = !unsourcedProse;

  beats.push({
    title: node.label,
    lines: intro ? [intro.text] : [],
    type: 'intro',
    sourced: intro ? intro.sourced || proseSourced : true,
  });

  const factLines: string[] = [];
  if (node.keyFacts?.length) {
    for (const f of node.keyFacts) {
      if (f.label && f.value) factLines.push(`${f.label}  ·  ${f.value}`);
    }
  } else {
    const cfg = NODE_TYPE_CONFIG[node.nodeType];
    if (cfg?.label) factLines.push(`Entity type  ·  ${cfg.label}`);
    // No CIDOC-CRM here. The ontology mapping belongs behind disclosure on the
    // record, not on a hero card a first-time visitor is handed unasked.
    if (node.inceptionYear?.trim()) factLines.push(`Temporal  ·  ${node.inceptionYear.trim()}`);
    if (node.lat?.trim() && node.long?.trim()) {
      factLines.push(`Coordinates  ·  ${node.lat.trim()}, ${node.long.trim()}`);
    }
  }
  if (factLines.length) {
    beats.push({ title: 'Key Facts', type: 'facts', lines: factLines, sourced: true });
  }

  if (node.storyText?.trim() && node.storyText.trim() !== intro?.text) {
    const sentences = node.storyText.replace(/\n/g, ' ').split(/(?<=\.)\s+/);
    const chunks: string[] = [];
    let buf = '';
    for (const s of sentences) {
      if (buf.length + s.length > 300 && buf) {
        chunks.push(buf.trim());
        buf = `${s} `;
      } else {
        buf += `${s} `;
      }
    }
    if (buf.trim()) chunks.push(buf.trim());
    chunks.forEach((c, i) =>
      beats.push({
        title: i === 0 ? 'The Story' : 'Continued…',
        lines: [c],
        type: 'story',
        sourced: proseSourced,
      }),
    );
  }

  if (node.history?.trim()) {
    beats.push({ title: 'History', lines: [node.history], type: 'history', sourced: proseSourced });
  }

  if (node.culturalRole?.trim()) {
    beats.push({
      title: 'Cultural Role',
      lines: [node.culturalRole],
      type: 'culture',
      sourced: proseSourced,
    });
  }

  if (node.architecture?.trim()) {
    beats.push({
      title: 'Architecture',
      lines: [node.architecture],
      type: 'arch',
      sourced: proseSourced,
    });
  }

  if (node.significance?.trim()) {
    beats.push({
      title: 'Significance',
      lines: [node.significance],
      type: 'culture',
      sourced: proseSourced,
    });
  }

  if (node.relations?.length) {
    const lines = node.relations.slice(0, 10).map((r) => {
      const pred =
        RELATION_LABELS[r.predicate] ?? r.predicate.replace(/_/g, ' ');
      const target = r.targetLabel?.trim() || r.targetId;
      return `${pred}  ·  ${target}`;
    });
    // Real graph edges, so this beat is sourced whatever the prose fields are.
    beats.push({ title: 'Connections', lines, type: 'culture', sourced: true });
  }

  if (node.rituals?.length) {
    const half = Math.ceil(node.rituals.length / 2);
    beats.push({
      title: 'Rituals & Traditions',
      lines: node.rituals.slice(0, half),
      type: 'rituals',
      sourced: proseSourced,
    });
    if (node.rituals.length > half) {
      beats.push({
        title: 'More Rituals',
        lines: node.rituals.slice(half),
        type: 'rituals',
        sourced: proseSourced,
      });
    }
  }

  if (node.visitNote?.trim()) {
    beats.push({
      title: 'Visitor Guide',
      lines: [node.visitNote],
      type: 'visit',
      sourced: proseSourced,
    });
  }

  const filtered = beats
    .map((b) => ({ ...b, lines: nonEmptyLines(b.lines) }))
    .filter((b) => b.lines.length > 0);

  if (filtered.length === 0) {
    /*
     * A third generated string used to live here — "Explore connections and
     * provenance for X in the HeritageGraph knowledge graph." Same objection as
     * the intro fallback: a sentence about the data model, presented as the
     * record's content, for exactly the records that have the least to show.
     *
     * Returning an empty list is the honest answer, and it is what lets the
     * caller decline to run the story component at all rather than render a
     * carousel with one filler card in it.
     */
    return [];
  }

  return filtered;
}
