import type { InstanceCategory } from '@/lib/instance-graph';
import type { AtlasEntity } from '@/types/atlas';

const CATEGORY_TO_KNOWLEDGE_DOMAIN: Record<InstanceCategory, string> = {
  structure: 'structure',
  deity: 'deity',
  person: 'person',
  location: 'location',
  event: 'event',
  ritual: 'ritual',
  festival: 'festival',
  guthi: 'guthi',
  monument: 'monument',
  iconography: 'iconography',
  period: 'period',
  tradition: 'tradition',
  source: 'source',
};

/** Parse live graph node id (`structure_42`) into knowledge route parts. */
export function parseLiveNodeId(nodeId: string): { domain: string; recordId: string } | null {
  const idx = nodeId.indexOf('_');
  if (idx <= 0) return null;
  const category = nodeId.slice(0, idx) as InstanceCategory;
  const recordId = nodeId.slice(idx + 1);
  if (!recordId) return null;
  const domain = CATEGORY_TO_KNOWLEDGE_DOMAIN[category];
  if (!domain) return null;
  return { domain, recordId };
}

/** `/knowledge/<domain>/view/<id>` when the entity is backed by a CIDOC row. */
export function getAtlasKnowledgeHref(entity: AtlasEntity): string | null {
  if (entity.knowledgeDomain && entity.cidocRecordId) {
    return `/knowledge/${entity.knowledgeDomain}/view/${encodeURIComponent(entity.cidocRecordId)}`;
  }
  // KG-projection ids are resource IRIs; without a parsed domain there is no
  // knowledge page (e.g. linked LUX stubs expose `externalUri` instead).
  if (entity.id.startsWith('http://') || entity.id.startsWith('https://')) return null;
  const parsed = parseLiveNodeId(entity.id);
  if (!parsed) return null;
  return `/knowledge/${parsed.domain}/view/${parsed.recordId}`;
}

export function atlasEntityHasKnowledgeLink(entity: AtlasEntity): boolean {
  return getAtlasKnowledgeHref(entity) != null;
}
