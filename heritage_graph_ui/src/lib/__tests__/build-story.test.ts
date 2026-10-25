import { describe, expect, it } from 'vitest';

import type { KgGraphEdge, KgGraphNode } from '@/lib/kg-graph';
import { buildStory, indexGraph, recordRef, storyReadyRecords } from '@/lib/stories/build-story';

const R = 'https://cair-nepal.org/heritagegraph/resource/';
const HG = 'https://cair-nepal.org/heritagegraph/';
const CRM = 'http://www.cidoc-crm.org/cidoc-crm/';

const node = (id: string, label: string, extra: Partial<KgGraphNode> = {}): KgGraphNode => ({
  id: R + id,
  types: [],
  label,
  comment: null,
  lat: null,
  long: null,
  ...extra,
});

const edge = (s: string, local: string, o: string, ns = HG): KgGraphEdge => ({
  source: R + s,
  target: R + o,
  predicate: ns + local,
  predicateLocal: local,
  predicateLabel: local,
  provenance: { source: 'Wikidata', confidence: 'likely', confidenceScore: null, assertedBy: 'wikidata_import', temporalScope: null, assertedAt: null },
});

const nodes = [
  node('structure/1', 'Nyatapola Temple', { labels: { en: 'Nyatapola Temple', ne: 'न्यातपोल मन्दिर' }, imageUrl: 'https://x/n.jpg' }),
  node('location/2', 'Bhaktapur', { labels: { ne: 'भक्तपुर' } }),
  node('deity/3', 'Siddhi Lakshmi'),
  node('tradition/4', 'Hinduism'),
  node('structure/5', 'Dattatreya Temple', { imageUrl: 'https://x/d.jpg' }),
  node('structure/6', 'Bhairavnath Temple'),
  node('source/7', 'Gutschow 2011'),
  node('festival/8', 'Biska Jatra'),
];
const edges = [
  edge('structure/1', 'P55_has_current_location', 'location/2', CRM),
  edge('structure/1', 'dedicated_to', 'deity/3'),
  edge('structure/1', 'hasReligiousTradition', 'tradition/4'),
  edge('structure/1', 'cites', 'source/7'),
  edge('structure/1', 'instance_of', 'tradition/4'),
  edge('structure/5', 'P55_has_current_location', 'location/2', CRM),
  edge('structure/6', 'located_at', 'location/2'),
  edge('festival/8', 'P7_took_place_at', 'location/2', CRM),
];
const index = indexGraph({ nodes, edges });

describe('recordRef', () => {
  it('reads segment and key from a resource IRI', () => {
    expect(recordRef(R + 'festival/25')).toEqual({ segment: 'festival', pk: '25' });
    expect(recordRef('https://example.org/x')).toBeNull();
  });
});

describe('buildStory', () => {
  it('asks belief before place before tradition, and keeps provenance', () => {
    const story = buildStory(index, R + 'structure/1')!;
    expect(story.focus.labelNe).toBe('न्यातपोल मन्दिर');
    expect(story.stops.map((s) => s.question.en)).toEqual([
      'Who is it for?',
      'Where does it stand?',
      'Which tradition keeps it?',
    ]);
    const where = story.stops[1].links[0];
    expect(where.phrase).toBe('stands in');
    expect(where.record.labelNe).toBe('भक्तपुर');
    expect(where.provenance?.source).toBe('Wikidata');
  });

  it('puts cited records in sources and leaves type edges out of the plot', () => {
    const story = buildStory(index, R + 'structure/1')!;
    expect(story.sources.map((s) => s.label)).toEqual(['Gutschow 2011']);
    expect(story.stops.flatMap((s) => s.links).some((l) => l.record.label === 'Hinduism' && l.phrase === 'instance of')).toBe(false);
  });

  it('gathers inbound edges that raise one question into one stop, photographed first', () => {
    const story = buildStory(index, R + 'location/2')!;
    const stands = story.stops.find((s) => s.question.en === 'What stands here?')!;
    expect(stands.links.map((l) => l.record.label)).toEqual([
      'Nyatapola Temple',
      'Dattatreya Temple',
      'Bhairavnath Temple',
    ]);
    expect(stands.links.every((l) => l.phrase === 'is home to')).toBe(true);
    expect(story.stops.some((s) => s.question.en === 'What happens here?')).toBe(true);
  });
});

describe('storyReadyRecords', () => {
  it('lists records that can answer at least two questions', () => {
    const labels = storyReadyRecords(index).map((r) => r.label);
    expect(labels).toContain('Nyatapola Temple');
    expect(labels).toContain('Bhaktapur');
    expect(labels).not.toContain('Siddhi Lakshmi');
  });

  it('ranks a story that reaches belief above one that only lists places', () => {
    const labels = storyReadyRecords(index).map((r) => r.label);
    expect(labels.indexOf('Nyatapola Temple')).toBeLessThan(labels.indexOf('Bhaktapur'));
  });
});
