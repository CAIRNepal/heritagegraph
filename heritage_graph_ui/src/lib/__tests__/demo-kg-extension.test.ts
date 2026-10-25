import { describe, expect, it } from 'vitest';

import curated from '@/data/heritage-demo.json';
import extension from '@/data/heritage-demo-kg.json';

interface FrozenRecord {
  '@id': string;
  label: string;
  description: string;
  storyText: string;
  imageUrl?: string;
  images?: string[];
  imageCredits?: Record<string, { license?: string; descriptionUrl?: string }>;
  lat?: string;
  coordinateSource?: string;
  recordSource?: { citation?: string | null };
  kgRelations: { predicate: string; target: string }[];
}

const records = extension['@graph'] as FrozenRecord[];
const curatedIds = new Set(curated['@graph'].map((n) => n['@id']));
const ids = new Set(records.map((n) => n['@id']));

describe('demo corpus: records frozen from the knowledge graph', () => {
  it('adds records without touching the curated originals', () => {
    expect(records.length).toBe(extension._provenance.records);
    expect(records.length).toBeGreaterThan(curated['@graph'].length);
    for (const id of ids) expect(curatedIds.has(id)).toBe(false);
  });

  it('credits every photograph with its licence and Commons page', () => {
    for (const n of records) {
      for (const url of n.images ?? []) {
        expect(n.imageCredits?.[url]?.license, url).toBeTruthy();
        expect(n.imageCredits?.[url]?.descriptionUrl, url).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
      }
      if (n.imageUrl) expect(n.images).toContain(n.imageUrl);
    }
  });

  it('keeps only sourced text and never invents narrative', () => {
    for (const n of records) {
      expect(n.storyText).toBe('');
      if (n.description) expect(n.recordSource?.citation, n.label).toBeTruthy();
    }
  });

  it('never carries coordinates borrowed from another record', () => {
    for (const n of records) {
      if (n.lat) expect(n.coordinateSource).not.toBe('inherited');
    }
  });

  it('links only to records the demo corpus contains', () => {
    for (const n of records) {
      for (const r of n.kgRelations) expect(ids.has(r.target) || curatedIds.has(r.target), `${n.label} ${r.predicate}`).toBe(true);
    }
  });
});
