import type { Agent } from '@/types/atlas';

/**
 * Synthetic agents for the Atlas sample corpus.
 *
 * These are placeholders that exist only to demonstrate the shape of a
 * provenance chain — one agent per role the model supports. They are
 * deliberately impossible to mistake for real attributions.
 *
 * This file previously named apparently-real Nepali scholars and real
 * institutions (Tribhuvan University, the National Museum of Nepal, the Patan
 * Museum, the Pashupatinath priest council) and attributed invented,
 * confidence-scored heritage claims to them. Nobody consented to that, the
 * claims were not theirs, and a screenshot of it would be indistinguishable
 * from a real attribution. Never reintroduce a real person or institution here:
 * demo attribution belongs to fictional agents, and real attribution belongs to
 * the live graph.
 *
 * IDs are neutral too: `agent-gopal-vajracharya` shipped the surname into
 * every JS bundle and every graph export, even after the display name was
 * fixed. Keep identifiers role-based.
 */
export const ATLAS_AGENTS: Agent[] = [
  {
    id: 'agent-researcher-a',
    name: 'Sample Researcher A',
    role: 'researcher',
    institutionalAffiliation: 'Example Institute of Heritage Studies (sample data)',
  },
  {
    id: 'agent-curator-b',
    name: 'Sample Curator B',
    role: 'curator',
    institutionalAffiliation: 'Example Museum (sample data)',
  },
  {
    id: 'agent-custodian-c',
    name: 'Sample Ritual Custodian C',
    role: 'priest',
    institutionalAffiliation: 'Example temple custodian council (sample data)',
  },
  {
    id: 'agent-community-d',
    name: 'Sample Community Contributor D',
    role: 'community',
    institutionalAffiliation: 'Example heritage volunteer group (sample data)',
  },
  {
    id: 'agent-field-team-e',
    name: 'Sample Field Documentation Team E',
    role: 'researcher',
    institutionalAffiliation: 'Example university archaeology unit (sample data)',
  },
  {
    id: 'agent-researcher-f',
    name: 'Sample Researcher F',
    role: 'researcher',
    institutionalAffiliation: 'Example cultural inventory office (sample data)',
  },
  {
    id: 'agent-curator-g',
    name: 'Sample Curator G',
    role: 'curator',
    institutionalAffiliation: 'Example regional museum (sample data)',
  },
  {
    id: 'agent-anonymous-contributor',
    name: 'Sample anonymous contributor',
    role: 'community',
  },
  {
    id: 'agent-ocr-pipeline',
    name: 'Sample document-ingest pipeline',
    role: 'system',
    institutionalAffiliation: 'Example automated agent (sample data)',
  },
  {
    id: 'agent-festival-committee',
    name: 'Sample festival organising committee',
    role: 'community',
    institutionalAffiliation: 'Example municipality (sample data)',
  },
];
