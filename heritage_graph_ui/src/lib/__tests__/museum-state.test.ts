import { describe, expect, it } from 'vitest';

import type { GraphNode } from '@/app/(site)/heritage-museum/heritage-data';
import {
  DEFAULT_STATE,
  eraCounts,
  filterCollection,
  parseMuseumParams,
  serializeMuseumParams,
} from '@/lib/heritage-museum/museum-state';

const node = (id: string, label: string, extra: Partial<GraphNode> = {}): GraphNode => ({
  id,
  label,
  nodeType: 'Temple',
  cidocMapping: 'heritageGraph:Temple',
  hgCategory: 'tangible',
  description: '',
  storyText: '',
  relations: [],
  ...extra,
});

describe('parseMuseumParams', () => {
  it('reads the unified parameters', () => {
    const s = parseMuseumParams(new URLSearchParams('source=live&node=x&lens=map&kind=event&era=malla&q=jatra'));
    expect(s).toEqual({ source: 'live', node: 'x', lens: 'map', kind: 'event', era: 'malla', q: 'jatra' });
  });

  it('keeps old museum and atlas links working', () => {
    expect(parseMuseumParams(new URLSearchParams('view=2d&node=a')).lens).toBe('connections');
    expect(parseMuseumParams(new URLSearchParams('view=timeline')).lens).toBe('timeline');
    expect(parseMuseumParams(new URLSearchParams('view=xr')).lens).toBe('exhibit');
    expect(parseMuseumParams(new URLSearchParams('selected=b&source=demo')).node).toBe('b');
  });

  it('ignores values it does not know', () => {
    const s = parseMuseumParams(new URLSearchParams('source=other&lens=globe&kind=nope&era=future'));
    expect(s).toEqual(DEFAULT_STATE);
  });
});

describe('serializeMuseumParams', () => {
  it('writes only what differs from the default, and round-trips', () => {
    expect(serializeMuseumParams(DEFAULT_STATE)).toBe('');
    const state = { ...DEFAULT_STATE, source: 'live' as const, node: 'https://x/resource/structure/67', lens: 'map' as const, era: 'malla' as const };
    expect(parseMuseumParams(new URLSearchParams(serializeMuseumParams(state)))).toEqual(state);
  });
});

describe('filterCollection', () => {
  const nodes = [
    node('1', 'Nyatapola Temple', { labelNe: 'न्यातपोल मन्दिर', inceptionYear: '1702' }),
    node('2', 'Indra Jatra', { hgCategory: 'event', nodeType: 'Festival' }),
    node('3', 'Changu Narayan Temple', { inceptionYear: '464' }),
  ];

  it('finds a record by its Nepali label', () => {
    expect(filterCollection(nodes, { kind: null, era: null, q: 'न्यातपोल' }).map((n) => n.id)).toEqual(['1']);
  });

  it('filters by kind and period together, sorted by label', () => {
    expect(filterCollection(nodes, { kind: 'tangible', era: null, q: '' }).map((n) => n.label)).toEqual([
      'Changu Narayan Temple',
      'Nyatapola Temple',
    ]);
    expect(filterCollection(nodes, { kind: null, era: 'malla', q: '' }).map((n) => n.id)).toEqual(['1']);
    expect(filterCollection(nodes, { kind: null, era: 'undated', q: '' }).map((n) => n.id)).toEqual(['2']);
  });

  it('counts periods after search and kind', () => {
    const c = eraCounts(nodes, { kind: 'tangible', q: '' });
    expect(c.malla).toBe(1);
    expect(c.licchavi).toBe(1);
    expect(c.undated).toBe(0);
  });
});

describe('devanagariLabel', () => {
  it('prefers Nepali, falls back to Nepal Bhasa, and skips a repeat of the label', async () => {
    const { devanagariLabel } = await import('@/lib/heritage-museum/live-graph');
    expect(devanagariLabel({ en: 'Indra Jatra', ne: 'इन्द्रजात्रा', new: 'येँया' }, 'Indra Jatra')).toBe('इन्द्रजात्रा');
    expect(devanagariLabel({ new: 'येँया' }, 'Indra Jatra')).toBe('येँया');
    expect(devanagariLabel({ ne: 'कुमारी' }, 'कुमारी')).toBeUndefined();
    expect(devanagariLabel(undefined, 'x')).toBeUndefined();
  });
});
