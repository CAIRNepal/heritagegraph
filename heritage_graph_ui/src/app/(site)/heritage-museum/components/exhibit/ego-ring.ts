import type { Connection } from './exhibit-utils';

/** More records than this on the ring and the labels collide. */
export const MAX_RING = 14;
export type RingEntry =
  | { kind: 'record'; connection: Connection; showRelation: boolean }
  | { kind: 'more'; relation: string; count: number };

/**
 * Which connections get a place on the ring. Every relation keeps at least
 * one representative; photographed, better-connected records go first; the
 * rest of each relation becomes one "+N more" entry, so a city with fifty
 * "located here" records reads as a few temples and "+44 more located here".
 * Each relation is written once, on its first line, not on every line.
 */
export function planRing(
  connections: Connection[],
  relationOf: (c: Connection) => string,
  score: (c: Connection) => number,
  max = MAX_RING,
): RingEntry[] {
  if (connections.length <= max) {
    const seen = new Set<string>();
    return connections.map((c) => {
      const rel = relationOf(c);
      const first = !seen.has(rel);
      seen.add(rel);
      return { kind: 'record', connection: c, showRelation: first };
    });
  }
  const groups = new Map<string, Connection[]>();
  for (const c of connections) {
    const rel = relationOf(c);
    (groups.get(rel) ?? groups.set(rel, []).get(rel)!).push(c);
  }
  const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  // Slots: one per relation first, then shared out by group size; groups that
  // overflow give one slot to their "+N more" entry.
  const budget = Math.max(max - ordered.filter(([, cs]) => cs.length > 1).length, ordered.length);
  const slots = new Map(ordered.map(([rel]) => [rel, 1]));
  let left = budget - ordered.length;
  while (left > 0) {
    let grew = false;
    for (const [rel, cs] of ordered) {
      if (left <= 0) break;
      if (slots.get(rel)! < cs.length) {
        slots.set(rel, slots.get(rel)! + 1);
        left--;
        grew = true;
      }
    }
    if (!grew) break;
  }
  const out: RingEntry[] = [];
  for (const [rel, cs] of ordered) {
    const take = [...cs].sort((a, b) => score(b) - score(a)).slice(0, slots.get(rel));
    take.forEach((c, i) => out.push({ kind: 'record', connection: c, showRelation: i === 0 }));
    if (cs.length > take.length) out.push({ kind: 'more', relation: rel, count: cs.length - take.length });
  }
  return out;
}
