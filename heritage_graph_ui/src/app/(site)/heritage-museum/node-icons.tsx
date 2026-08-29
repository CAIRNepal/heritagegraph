'use client';

// Deterministic, font-independent node iconography (replaces emoji).
// Path data is baked from @tabler/icons by scripts/gen-node-icons.mjs, so every
// surface — D3 graph, Leaflet markers, timeline, story panel, XR, legend —
// renders identically across platforms and embeds cleanly in publication
// figures. Two consumers: a React component and a raw-SVG-string helper (for
// the canvas/HTML contexts that can't take a React node).

import { NODE_ICON_INNER, NODE_ICON_GLYPH } from './node-icons.generated';

export { NODE_ICON_INNER, NODE_ICON_GLYPH };

/** Neutral fallback when a node type has no mapped glyph. */
const FALLBACK_INNER = '<circle cx="12" cy="12" r="3.5" />';

export function nodeIconInner(nodeType: string): string {
  return NODE_ICON_INNER[nodeType] ?? FALLBACK_INNER;
}

interface NodeGlyphProps {
  nodeType: string;
  size?: number;
  /** Stroke colour; defaults to currentColor so it inherits text colour. */
  color?: string;
  strokeWidth?: number;
  className?: string;
  /** Accessible label; omit to mark the glyph decorative. */
  title?: string;
}

export function NodeGlyph({
  nodeType,
  size = 20,
  color = 'currentColor',
  strokeWidth = 2,
  className,
  title,
}: NodeGlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={{ __html: nodeIconInner(nodeType) }}
    />
  );
}

/** Raw SVG markup for non-React contexts (Leaflet divIcon HTML, D3, etc.). */
export function nodeGlyphSvg(
  nodeType: string,
  opts: { size?: number; color?: string; strokeWidth?: number } = {},
): string {
  const { size = 20, color = '#fff', strokeWidth = 2 } = opts;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" ` +
    `stroke-linecap="round" stroke-linejoin="round">${nodeIconInner(nodeType)}</svg>`
  );
}
