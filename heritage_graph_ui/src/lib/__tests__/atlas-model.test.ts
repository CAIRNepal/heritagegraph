import { describe, expect, it } from 'vitest';

import type { GraphNode } from '@/app/(site)/heritage-museum/heritage-data';
import {
  decodeGrid,
  distanceKm,
  eraOf,
  mapFacts,
  nearbyPlaces,
  placesOf,
  sampleGrid,
  type AtlasPlace,
} from '@/lib/heritage-atlas/atlas-model';

const node = (id: string, lat?: string, long?: string, inceptionYear?: string) =>
  ({ id, label: id, nodeType: 'Place', cidocMapping: '', hgCategory: 'spatial', description: '', storyText: '', relations: [], lat, long, inceptionYear }) as GraphNode;

describe('placesOf', () => {
  it('keeps records located in Nepal and flags the valley', () => {
    const ps = placesOf([
      node('swayambhu', '27.7149', '85.2904', '460'),
      node('lumbini', '27.4833', '83.2761'),
      node('nowhere'),
      node('pole', '88', '98'),
    ]);
    expect(ps.map((p) => p.node.id)).toEqual(['swayambhu', 'lumbini']);
    expect(ps[0].inValley).toBe(true);
    expect(ps[1].inValley).toBe(false);
    expect(ps[0].year).toBe(460);
  });

  it('leaves out a point borrowed from the containing place', () => {
    const borrowed = { ...node('shrine', '27.7172', '85.3240'), coordinateSource: 'inherited' as const };
    const gazetteer = { ...node('boudha', '27.7215', '85.3620'), coordinateSource: 'gazetteer' as const };
    expect(placesOf([borrowed, gazetteer]).map((p) => p.node.id)).toEqual(['boudha']);
  });
});

describe('eraOf', () => {
  it('puts years in the museum’s periods', () => {
    expect(eraOf(-249)).toBe('early');
    expect(eraOf(460)).toBe('licchavi');
    expect(eraOf(1000)).toBe('transitional');
    expect(eraOf(1702)).toBe('malla');
    expect(eraOf(1768)).toBe('shah');
    expect(eraOf(1990)).toBe('shah');
    expect(eraOf(null)).toBe('undated');
  });
});

describe('distanceKm', () => {
  it('measures Swayambhunath to Lumbini at about 203 km', () => {
    expect(distanceKm({ lat: 27.7149, lon: 85.2904 }, { lat: 27.4833, lon: 83.2761 })).toBeCloseTo(200, -1);
  });
});

describe('elevation grid', () => {
  it('decodes little-endian uint16 and interpolates', () => {
    const values = new Uint16Array([100, 200, 300, 400]);
    const b64 = btoa(String.fromCharCode(...new Uint8Array(values.buffer)));
    const g = decodeGrid({ west: 0, north: 1, step: 1, cols: 2, rows: 2, metres: b64 });
    expect(sampleGrid(g, 1, 0)).toBe(100);
    expect(sampleGrid(g, 0.5, 0.5)).toBe(250);
    expect(sampleGrid(g, 5, 5)).toBeNull();
  });
});

describe('mapFacts', () => {
  const ps = placesOf([
    node('a', '27.70', '85.30', '460'),
    node('b', '27.71', '85.31'),
    node('c', '29.19', '83.99', '1380'),
    node('d', '26.73', '85.93'),
  ]) as AtlasPlace[];
  const alt: Record<string, number> = { a: 1400, b: 1310, c: 3855, d: 85 };
  const facts = mapFacts(ps, (p) => alt[p.node.id]);

  it('states the valley share, oldest, highest, lowest and the western gap', () => {
    expect(facts.map((f) => f.kind)).toEqual(['valley', 'oldest', 'highest', 'lowest', 'gap']);
    const valley = facts[0] as Extract<(typeof facts)[number], { kind: 'valley' }>;
    expect([valley.count, valley.total]).toEqual([2, 4]);
    expect((facts[2] as { place: AtlasPlace }).place.node.id).toBe('c');
    expect((facts[3] as { place: AtlasPlace }).place.node.id).toBe('d');
  });

  it('finds places within a radius, nearest first', () => {
    const near = nearbyPlaces(ps[0], ps, 15);
    expect(near.map((x) => x.place.node.id)).toEqual(['b']);
  });
});
