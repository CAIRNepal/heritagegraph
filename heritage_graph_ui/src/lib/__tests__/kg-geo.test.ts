import { describe, expect, it } from 'vitest';

import {
  LOCATION_PREDICATE_RE,
  parseCoord,
  propagateCoordsAlongLocationEdges,
  type GeoCoord,
} from '@/lib/kg-geo';

describe('LOCATION_PREDICATE_RE', () => {
  it('matches location predicates and rejects others', () => {
    for (const p of ['located_at', 'has_current_location', 'took_place_at', 'residence']) {
      expect(LOCATION_PREDICATE_RE.test(p)).toBe(true);
    }
    for (const p of ['invokes_deity', 'manages', 'depicts']) {
      expect(LOCATION_PREDICATE_RE.test(p)).toBe(false);
    }
  });
});

describe('parseCoord', () => {
  it('parses numbers and numeric strings', () => {
    expect(parseCoord(27.7)).toBe(27.7);
    expect(parseCoord('27.7')).toBe(27.7);
    expect(parseCoord(null)).toBeUndefined();
    expect(parseCoord('not-a-number')).toBeUndefined();
  });
});

describe('propagateCoordsAlongLocationEdges', () => {
  it('propagates coords across chained location edges in any edge order', () => {
    const coords = new Map<string, GeoCoord>([['place', { lat: 27.7, lon: 85.3 }]]);
    // Reverse order: the murti edge appears before the shrine gets coords.
    const links = [
      { source: 'murti', target: 'shrine', predicate: 'has_current_location' },
      { source: 'shrine', target: 'place', predicate: 'located_at' },
    ];
    const inherited = propagateCoordsAlongLocationEdges(coords, links);
    expect(inherited.get('shrine')).toEqual({ lat: 27.7, lon: 85.3 });
    expect(inherited.get('murti')).toEqual({ lat: 27.7, lon: 85.3 });
    expect(coords.size).toBe(3);
  });

  it('does not propagate along non-location predicates', () => {
    const coords = new Map<string, GeoCoord>([['a', { lat: 1, lon: 2 }]]);
    const inherited = propagateCoordsAlongLocationEdges(coords, [
      { source: 'b', target: 'a', predicate: 'invokes_deity' },
    ]);
    expect(inherited.size).toBe(0);
  });

  it('never overwrites existing coordinates', () => {
    const coords = new Map<string, GeoCoord>([
      ['a', { lat: 1, lon: 2 }],
      ['b', { lat: 9, lon: 9 }],
    ]);
    propagateCoordsAlongLocationEdges(coords, [
      { source: 'b', target: 'a', predicate: 'located_at' },
    ]);
    expect(coords.get('b')).toEqual({ lat: 9, lon: 9 });
  });
});
