/**
 * Deep links between the three exploration surfaces: Heritage Museum, Atlas and
 * the knowledge pages.
 *
 * The Museum and Atlas both hydrate live mode from `GET /api/v1/cidoc/kg/graph/`
 * and both keep the response's node id verbatim, so a node id is a shared
 * identifier *in live mode only*. Demo mode uses two unrelated corpora
 * (`src/data/heritage-demo.json` vs `src/data/atlas-dummy.ts`), where the ids do
 * not correspond and a cross-link would silently select nothing.
 *
 * Both surfaces already read their selection from the query string — Atlas via
 * `?selected=`, the Museum via `?node=` — so linking needs no new plumbing. The
 * param names differ, which is why they are centralised here rather than
 * hand-built at each call site.
 */

export type CrossSurfaceDataSource = 'demo' | 'live';

/**
 * Atlas globe focused on `nodeId`, or `null` when a link would not resolve.
 *
 * Atlas applies `?selected=` only if the id is present in its loaded corpus, so
 * this returns a link only for live mode. Callers should additionally require
 * coordinates: Atlas is place-first, and an entity it cannot place is an entity
 * the user would arrive to find unselected.
 */
export function atlasHrefForNode(
  nodeId: string,
  dataSource: CrossSurfaceDataSource,
): string | null {
  if (dataSource !== 'live' || !nodeId) return null;
  return `/atlas?source=live&selected=${encodeURIComponent(nodeId)}`;
}

/** Museum story view focused on `nodeId`, or `null` when it would not resolve. */
export function museumStoryHrefForNode(
  nodeId: string,
  dataSource: CrossSurfaceDataSource,
): string | null {
  if (dataSource !== 'live' || !nodeId) return null;
  return `/heritage-museum?source=live&view=xr&node=${encodeURIComponent(nodeId)}`;
}
