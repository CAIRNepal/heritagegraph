/**
 * Whether an image can honestly be shown as a 360° panorama.
 *
 * An equirectangular capture covers 360° horizontally and 180° vertically, so
 * it is always close to 2:1. Anything else wrapped onto a sphere is a flat
 * photograph on curved geometry — it does not gain immersion, and the seam and
 * pole distortion make it read as a bug.
 *
 * This lives outside `PanoramaViewer` on purpose: that module is lazily
 * imported because it pulls in three.js, so callers that only need to decide
 * *whether* to offer the panorama must be able to ask without paying for the
 * WebGL bundle.
 */

/** Tolerance on the 2:1 ratio, to allow for cropping and rounding. */
const EQUIRECT_TOLERANCE = 0.15;

export function isEquirectangular(width: number, height: number): boolean {
  if (!width || !height) return false;
  return Math.abs(width / height - 2) <= EQUIRECT_TOLERANCE;
}
