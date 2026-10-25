import { describe, expect, it } from 'vitest';

import type { Connection } from '@/app/(site)/heritage-museum/components/exhibit/exhibit-utils';
import { MAX_RING, planRing } from '@/app/(site)/heritage-museum/components/exhibit/ego-ring';

const conn = (id: string, predicate: string, score = 0) =>
  ({ other: { id, label: id }, predicate, direction: 'in', score } as unknown as Connection & { score: number });

const relationOf = (c: Connection) => c.predicate;
const scoreOf = (c: Connection) => (c as Connection & { score: number }).score;

describe('planRing', () => {
  it('keeps a small ring whole and labels each relation once', () => {
    const ring = planRing([conn('a', 'in'), conn('b', 'in'), conn('c', 'for')], relationOf, scoreOf);
    expect(ring.map((e) => (e.kind === 'record' ? [e.connection.other.id, e.showRelation] : null))).toEqual([
      ['a', true],
      ['b', false],
      ['c', true],
    ]);
  });

  it('caps a hub, keeps every relation, and summarises the rest', () => {
    const many = Array.from({ length: 50 }, (_, i) => conn(`t${i}`, 'located here', i));
    const ring = planRing([...many, conn('god', 'dedicated to'), conn('fest', 'held here')], relationOf, scoreOf);
    expect(ring.length).toBeLessThanOrEqual(MAX_RING);
    const relations = new Set(ring.map((e) => (e.kind === 'record' ? e.connection.predicate : e.relation)));
    expect(relations).toEqual(new Set(['located here', 'dedicated to', 'held here']));
    const more = ring.find((e) => e.kind === 'more');
    const shown = ring.filter((e) => e.kind === 'record' && e.connection.predicate === 'located here').length;
    expect(more && more.kind === 'more' && more.count + shown).toBe(50);
    const first = ring.find((e) => e.kind === 'record' && e.connection.predicate === 'located here');
    expect(first && first.kind === 'record' && first.connection.other.id).toBe('t49');
  });
});
