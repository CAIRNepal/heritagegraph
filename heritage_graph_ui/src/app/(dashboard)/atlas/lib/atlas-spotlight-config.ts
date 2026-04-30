/**
 * Atlas globe spotlight — edit this object to resize the circular viewport and side docks.
 *
 * | Field | Effect |
 * |-------|--------|
 * | `maxDiameterPx` | Upper cap on disc diameter (pixels). |
 * | `minDiameterPx` | Lower bound when layout allows (pixels). |
 * | `sizeMultiplier` | Quick scale for the disc without retuning caps (e.g. `1.15` ≈ 15% larger). |
 * | `viewportInsetHorizontalPx` | Total horizontal margin budget subtracted from `100vw` when capping width. |
 * | `viewportInsetVerticalPx` | Total vertical margin budget subtracted from `100dvh` when capping height. |
 * | `gutterLeftPx` / `gutterRightPx` | Target width of left/right docks (pixels); wider = less room for the disc. |
 * | `gutterBottomPx` | Bottom gutter CSS var (usually `0`). |
 * | `fallbackDiameterPx` | Matches CSS `--atlas-spot-d` default until the first layout measure. |
 *
 * Globe disc lives in `components/spotlight-frame.tsx` (`SpotlightDisc`); gutters feed the around-globe grid in `components/globe-workspace.tsx`.
 */
export const ATLAS_SPOTLIGHT = {
  maxDiameterPx: 920,
  minDiameterPx: 280,
  sizeMultiplier: 1,
  viewportInsetHorizontalPx: 64,
  viewportInsetVerticalPx: 192,
  gutterLeftPx: 320,
  gutterRightPx: 360,
  gutterBottomPx: 0,
  fallbackDiameterPx: 560,
} as const;

function snapEvenDiameter(n: number): number {
  const rounded = Math.round(n);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

/** Compute snapped disc diameter from the center grid cell and current viewport. */
export function computeSpotlightDiameterPx(cellWidth: number, cellHeight: number): number {
  const cfg = ATLAS_SPOTLIGHT;
  const cell = Math.min(cellWidth, cellHeight);
  if (typeof window === 'undefined') {
    return snapEvenDiameter(
      Math.min(Math.max(cell * cfg.sizeMultiplier, cfg.minDiameterPx), cfg.maxDiameterPx),
    );
  }

  const vwCap = Math.max(0, window.innerWidth - cfg.viewportInsetHorizontalPx);
  const vhCap = Math.max(0, window.innerHeight - cfg.viewportInsetVerticalPx);
  const upper = Math.min(cfg.maxDiameterPx, vwCap, vhCap);

  let raw = Math.min(cell * cfg.sizeMultiplier, upper);
  raw = Math.max(cfg.minDiameterPx, raw);
  raw = Math.min(raw, upper);

  return snapEvenDiameter(raw);
}
