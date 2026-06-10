import type { AtlasEntity } from '@/types/atlas';

/** Human-readable ontology / record label for research UI tables. */
export function atlasEntityClassLabel(entity: AtlasEntity): string {
  if (entity.recordCategory === 'location') {
    return entity.locationType
      ? `Place · ${entity.locationType.replace(/_/g, ' ')}`
      : 'Place';
  }
  return entity.class;
}

export function atlasEntityIsPlace(entity: AtlasEntity): boolean {
  return entity.recordCategory === 'location';
}

export function atlasEntityIsOnGlobe(entity: AtlasEntity): boolean {
  return entity.lat != null && entity.lon != null && entity.coordProvenance !== 'unmapped';
}
