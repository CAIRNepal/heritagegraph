import { describe, expect, it } from 'vitest';

import {
  hydrateAtlasFromKgGraph,
  parseResourceIri,
  yearFromTemporalHint,
} from '@/lib/atlas-kg-hydrate';
import type { KgGraphResponse } from '@/lib/kg-graph';

const BASE = 'https://w3id.org/heritagegraph/resource';
const CRM = 'http://www.cidoc-crm.org/cidoc-crm';
const HG = 'https://w3id.org/heritagegraph';

function fixture(): KgGraphResponse {
  return {
    graph: 'https://w3id.org/heritagegraph/graph/public',
    includeLux: true,
    luxLinkCount: 1,
    nodes: [
      {
        id: `${BASE}/location/1`,
        types: [`${CRM}/E53_Place`],
        label: 'Patan Durbar Square',
        comment: 'Royal square of Lalitpur.',
        lat: '27.6729',
        long: '85.3265',
        inceptionYear: null,
      },
      {
        id: `${BASE}/structure/2`,
        types: [`${HG}/Temple`],
        label: 'Krishna Mandir',
        comment: 'Stone shikhara temple commissioned by Siddhinarasimha Malla.',
        lat: null,
        long: null,
        inceptionYear: '1637',
        imageUrl: 'https://upload.wikimedia.org/krishna.jpg',
        images: ['https://upload.wikimedia.org/krishna.jpg'],
      },
      {
        id: `${BASE}/deity/3`,
        types: [`${CRM}/E28_Conceptual_Object`],
        label: 'Krishna',
        comment: null,
        lat: null,
        long: null,
      },
      {
        id: 'https://lux.collections.yale.edu/data/object/abc',
        types: [`${CRM}/E22_Human-Made_Object`],
        label: 'Paubha of Krishna',
        comment: null,
        lat: null,
        long: null,
        sourceLayer: 'lux',
        externalUri: 'https://lux.collections.yale.edu/view/object/abc',
      },
      {
        id: `${BASE}/location/4`,
        types: [`${CRM}/E53_Place`],
        label: 'Completely Unknown Hamlet',
        comment: null,
        lat: null,
        long: null,
      },
    ],
    edges: [
      {
        source: `${BASE}/structure/2`,
        target: `${BASE}/location/1`,
        predicate: `${CRM}/P55_has_current_location`,
        predicateLocal: 'has_current_location',
        predicateLabel: 'has current location',
        provenance: null,
      },
      {
        source: `${BASE}/structure/2`,
        target: `${BASE}/deity/3`,
        predicate: `${HG}/invokes_deity`,
        predicateLocal: 'invokes_deity',
        predicateLabel: 'invokes deity',
        provenance: {
          source: 'Slusser, Nepal Mandala (1982)',
          confidence: 'high',
          confidenceScore: 0.9,
          assertedBy: 'researcher@example.org',
          temporalScope: '1637/..',
          assertedAt: '2026-01-15T10:00:00Z',
        },
      },
    ],
    counts: { nodes: 5, edges: 2, edgesWithProvenance: 1 },
  };
}

describe('parseResourceIri', () => {
  it('parses curated resource IRIs', () => {
    expect(parseResourceIri(`${BASE}/structure/42`)).toEqual({
      segment: 'structure',
      recordId: '42',
    });
    expect(parseResourceIri('https://lux.collections.yale.edu/data/object/abc')).toBeNull();
  });
});

describe('yearFromTemporalHint', () => {
  it('extracts plausible years', () => {
    expect(yearFromTemporalHint('1637')).toBe(1637);
    expect(yearFromTemporalHint('c. 1637 CE')).toBe(1637);
    expect(yearFromTemporalHint('17th century')).toBeUndefined();
    expect(yearFromTemporalHint(null)).toBeUndefined();
  });
});

describe('hydrateAtlasFromKgGraph', () => {
  it('uses IRIs as ids and parses knowledge links', () => {
    const corpus = hydrateAtlasFromKgGraph(fixture());
    const temple = corpus.entities.find((e) => e.id === `${BASE}/structure/2`);
    expect(temple).toBeDefined();
    expect(temple?.knowledgeDomain).toBe('structure');
    expect(temple?.cidocRecordId).toBe('2');
    expect(temple?.class).toBe('Temple');
    expect(temple?.foundedYear).toBe(1637);
    expect(temple?.era).toBe('early_modern');
    expect(temple?.imageUrl).toBe('https://upload.wikimedia.org/krishna.jpg');
  });

  it('assigns coord tiers: verified, inherited, gazetteer, unmapped', () => {
    const corpus = hydrateAtlasFromKgGraph(fixture());
    const byId = new Map(corpus.entities.map((e) => [e.id, e]));

    // API lat/long → verified
    expect(byId.get(`${BASE}/location/1`)?.coordProvenance).toBe('verified');
    // Temple inherits from the located place via has_current_location
    const temple = byId.get(`${BASE}/structure/2`);
    expect(temple?.coordProvenance).toBe('inherited');
    expect(temple?.lat).toBeCloseTo(27.6729);
    // Deity has no location edges or label match → unmapped (invokes_deity must not propagate)
    expect(byId.get(`${BASE}/deity/3`)?.coordProvenance).toBe('unmapped');
    expect(byId.get(`${BASE}/location/4`)?.coordProvenance).toBe('unmapped');
  });

  it('builds assertions only from provenance-backed edges', () => {
    const corpus = hydrateAtlasFromKgGraph(fixture());
    const temple = corpus.entities.find((e) => e.id === `${BASE}/structure/2`);
    expect(temple?.assertions).toHaveLength(1);
    const assertion = temple!.assertions[0];
    expect(assertion.assertedProperty).toBe('invokes_deity');
    expect(assertion.confidenceScore).toBe(0.9);
    expect(assertion.reconciliationStatus).toBe('confirmed');
    expect(assertion.derivedFromSourceIds).toHaveLength(1);

    // No synthetic `catalogued_in` placeholders anywhere.
    for (const e of corpus.entities) {
      expect(e.assertions.every((a) => a.assertedProperty !== 'catalogued_in')).toBe(true);
    }
  });

  it('derives sources and agents from edge provenance', () => {
    const corpus = hydrateAtlasFromKgGraph(fixture());
    expect(corpus.sources).toHaveLength(1);
    expect(corpus.sources[0].name).toBe('Slusser, Nepal Mandala (1982)');
    expect(corpus.sources[0].reliabilityTier).toBe('A');
    expect(corpus.agents).toHaveLength(1);
    expect(corpus.agents[0].name).toBe('researcher@example.org');
  });

  it('maps edges with predicateLocal and provenance flag', () => {
    const corpus = hydrateAtlasFromKgGraph(fixture());
    expect(corpus.edges).toHaveLength(2);
    const provEdge = corpus.edges.find((e) => e.predicate === 'invokes_deity');
    expect(provEdge?.hasProvenance).toBe(true);
    const fkEdge = corpus.edges.find((e) => e.predicate === 'has_current_location');
    expect(fkEdge?.hasProvenance).toBe(false);
  });

  it('marks LUX stubs with externalUri and no knowledge link', () => {
    const corpus = hydrateAtlasFromKgGraph(fixture());
    const lux = corpus.entities.find((e) => e.sourceLayer === 'lux');
    expect(lux).toBeDefined();
    expect(lux?.externalUri).toBe('https://lux.collections.yale.edu/view/object/abc');
    expect(lux?.knowledgeDomain).toBeUndefined();
    expect(lux?.cidocRecordId).toBeUndefined();
  });

  it('computes place catalog stats over location rows', () => {
    const corpus = hydrateAtlasFromKgGraph(fixture());
    expect(corpus.locationStats.totalPlaces).toBe(2);
    expect(corpus.locationStats.mappedOnGlobe).toBe(1);
    expect(corpus.locationStats.unmapped).toBe(1);
    expect(corpus.locationStats.verified).toBe(1);
  });
});
