/**
 * Deep links between the exploration surfaces: Heritage Museum, Atlas and the
 * knowledge pages.
 *
 * The Museum and the Atlas load the same collection (useHeritageCollection):
 * the illustrated demo corpus or the live graph from
 * `GET /api/v1/cidoc/kg/graph/`, both keeping node ids verbatim. So a node id
 * is a shared identifier in either source, and links carry the source along.
 *
 * The atlas is now the museum's map lens, so both helpers build museum URLs;
 * old `/atlas?selected=` links still redirect there.
 */

export type CrossSurfaceDataSource = 'demo' | 'live';

/**
 * The museum's map lens focused on `nodeId`. Callers should require
 * coordinates: a record the map cannot place opens without a marker.
 */
export function atlasHrefForNode(nodeId: string, dataSource: CrossSurfaceDataSource): string | null {
  if (!nodeId) return null;
  return `/heritage-museum?source=${dataSource}&node=${encodeURIComponent(nodeId)}&lens=map`;
}

/** Museum focused on `nodeId`. */
export function museumStoryHrefForNode(nodeId: string, dataSource: CrossSurfaceDataSource): string | null {
  if (!nodeId) return null;
  return `/heritage-museum?source=${dataSource}&node=${encodeURIComponent(nodeId)}`;
}
