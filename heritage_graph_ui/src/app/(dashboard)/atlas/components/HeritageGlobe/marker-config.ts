import type { AtlasEntity, OntologyClass } from '@/types/atlas';

/**
 * Marker design system: every ontology class maps to one of eight heritage
 * archetypes, each with its own colour and glyph shape. Marker sprites are
 * generated once per archetype on a canvas (glow halo + glyph core) so the
 * globe can render thousands of billboards without per-frame canvas work.
 */

export type AtlasMarkerArchetype =
  | 'temple'
  | 'monastery'
  | 'artifact'
  | 'festival'
  | 'architecture'
  | 'living'
  | 'event'
  | 'intangible';

export interface AtlasMarkerStyle {
  id: AtlasMarkerArchetype;
  label: string;
  color: string;
  classes: OntologyClass[];
}

export const MARKER_ARCHETYPES: AtlasMarkerStyle[] = [
  { id: 'temple', label: 'Temples', color: '#fbbf24', classes: ['Temple'] },
  { id: 'monastery', label: 'Stupas & Monasteries', color: '#fb923c', classes: ['Stupa', 'Chaitya'] },
  { id: 'artifact', label: 'Art & Artifacts', color: '#a78bfa', classes: ['Murti', 'Paubha', 'ArchitecturalElement'] },
  { id: 'festival', label: 'Festivals', color: '#f472b6', classes: ['Festival', 'ChariotFestival', 'MaskedDance'] },
  { id: 'architecture', label: 'Civic Architecture', color: '#38bdf8', classes: ['Pati', 'Sattal', 'Dharmashala', 'DhungeDhara', 'Pokhari'] },
  { id: 'living', label: 'Living Heritage', color: '#34d399', classes: ['Guthi', 'CasteGroup', 'LivingGoddessTenure', 'Person'] },
  { id: 'event', label: 'Historical Events', color: '#f87171', classes: ['HistoricalEvent'] },
  { id: 'intangible', label: 'Deities & Rituals', color: '#e879f9', classes: ['Deity', 'RitualEvent'] },
];

const CLASS_TO_ARCHETYPE: Record<OntologyClass, AtlasMarkerStyle> = MARKER_ARCHETYPES.reduce(
  (acc, style) => {
    for (const cls of style.classes) acc[cls] = style;
    return acc;
  },
  {} as Record<OntologyClass, AtlasMarkerStyle>,
);

export function markerStyleForEntity(entity: Pick<AtlasEntity, 'class'>): AtlasMarkerStyle {
  return CLASS_TO_ARCHETYPE[entity.class] ?? MARKER_ARCHETYPES[0];
}

export function archetypeForClass(cls: OntologyClass): AtlasMarkerArchetype {
  return (CLASS_TO_ARCHETYPE[cls] ?? MARKER_ARCHETYPES[0]).id;
}

// ─── Sprite generation ─────────────────────────────────────────────────────────

const SPRITE_PX = 72;
const DPR = 2;

type SpriteVariant = 'base' | 'active';

const spriteCache = new Map<string, HTMLCanvasElement>();
const clusterCache = new Map<string, HTMLCanvasElement>();

function drawGlyph(
  ctx: CanvasRenderingContext2D,
  archetype: AtlasMarkerArchetype,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.beginPath();
  switch (archetype) {
    case 'temple': {
      // Pagoda: stacked roof triangles
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r * 0.8, cy - r * 0.15);
      ctx.lineTo(cx + r * 0.42, cy - r * 0.15);
      ctx.lineTo(cx + r * 0.95, cy + r * 0.75);
      ctx.lineTo(cx - r * 0.95, cy + r * 0.75);
      ctx.lineTo(cx - r * 0.42, cy - r * 0.15);
      ctx.lineTo(cx - r * 0.8, cy - r * 0.15);
      ctx.closePath();
      break;
    }
    case 'monastery': {
      // Stupa dome + pinnacle
      ctx.arc(cx, cy + r * 0.18, r * 0.82, Math.PI, 0);
      ctx.lineTo(cx + r * 0.82, cy + r * 0.55);
      ctx.lineTo(cx - r * 0.82, cy + r * 0.55);
      ctx.closePath();
      ctx.rect(cx - r * 0.1, cy - r * 0.95, r * 0.2, r * 0.35);
      break;
    }
    case 'artifact': {
      ctx.moveTo(cx, cy - r * 0.95);
      ctx.lineTo(cx + r * 0.72, cy);
      ctx.lineTo(cx, cy + r * 0.95);
      ctx.lineTo(cx - r * 0.72, cy);
      ctx.closePath();
      break;
    }
    case 'festival': {
      const spikes = 5;
      for (let i = 0; i < spikes * 2; i += 1) {
        const rad = i % 2 === 0 ? r : r * 0.45;
        const a = (i * Math.PI) / spikes - Math.PI / 2;
        const x = cx + Math.cos(a) * rad;
        const y = cy + Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    }
    case 'architecture': {
      const s = r * 0.72;
      ctx.rect(cx - s, cy - s, s * 2, s * 2);
      break;
    }
    case 'living': {
      ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2);
      ctx.moveTo(cx + r * 0.85, cy);
      ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
      break;
    }
    case 'event': {
      ctx.moveTo(cx - r * 0.85, cy - r * 0.7);
      ctx.lineTo(cx + r * 0.85, cy - r * 0.7);
      ctx.lineTo(cx, cy + r * 0.9);
      ctx.closePath();
      break;
    }
    case 'intangible': {
      // Four-point sparkle
      ctx.moveTo(cx, cy - r);
      ctx.quadraticCurveTo(cx + r * 0.14, cy - r * 0.14, cx + r, cy);
      ctx.quadraticCurveTo(cx + r * 0.14, cy + r * 0.14, cx, cy + r);
      ctx.quadraticCurveTo(cx - r * 0.14, cy + r * 0.14, cx - r, cy);
      ctx.quadraticCurveTo(cx - r * 0.14, cy - r * 0.14, cx, cy - r);
      ctx.closePath();
      break;
    }
  }
}

/** Glowing marker sprite: soft halo + white glyph on a coloured core. */
export function markerSprite(
  archetype: AtlasMarkerArchetype,
  color: string,
  variant: SpriteVariant = 'base',
): HTMLCanvasElement {
  const key = `${archetype}:${color}:${variant}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;

  const size = SPRITE_PX * DPR;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const c = size / 2;
  const active = variant === 'active';

  // Outer glow halo
  const halo = ctx.createRadialGradient(c, c, size * 0.08, c, c, size * 0.5);
  halo.addColorStop(0, `${color}e6`);
  halo.addColorStop(0.35, `${color}${active ? '99' : '66'}`);
  halo.addColorStop(1, `${color}00`);
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);

  // Core disc
  const coreR = size * (active ? 0.24 : 0.2);
  ctx.beginPath();
  ctx.arc(c, c, coreR, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = size * 0.02;
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.stroke();

  if (active) {
    ctx.beginPath();
    ctx.arc(c, c, size * 0.34, 0, Math.PI * 2);
    ctx.lineWidth = size * 0.012;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.stroke();
  }

  // Glyph
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.98)';
  drawGlyph(ctx, archetype, c, c, coreR * 0.62);
  ctx.fill('evenodd');
  ctx.restore();

  spriteCache.set(key, canvas);
  return canvas;
}

/** Cluster sprite: frosted circle sized by member count with a count label. */
export function clusterSprite(count: number, dominantColor: string): HTMLCanvasElement {
  const bucket = count < 10 ? String(count) : count < 50 ? `${Math.floor(count / 10) * 10}+` : count < 100 ? '50+' : '99+';
  const key = `${bucket}:${dominantColor}`;
  const cached = clusterCache.get(key);
  if (cached) return cached;

  const scale = count < 10 ? 0.72 : count < 50 ? 0.86 : 1;
  const size = Math.round(88 * DPR * scale);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const c = size / 2;

  const halo = ctx.createRadialGradient(c, c, size * 0.18, c, c, size * 0.5);
  halo.addColorStop(0, `${dominantColor}55`);
  halo.addColorStop(1, `${dominantColor}00`);
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);

  ctx.beginPath();
  ctx.arc(c, c, size * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10, 16, 28, 0.78)';
  ctx.fill();
  ctx.lineWidth = size * 0.018;
  ctx.strokeStyle = `${dominantColor}dd`;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(c, c, size * 0.37, 0, Math.PI * 2);
  ctx.lineWidth = size * 0.008;
  ctx.strokeStyle = `${dominantColor}66`;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.font = `600 ${Math.round(size * 0.21)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(bucket, c, c + size * 0.01);

  clusterCache.set(key, canvas);
  return canvas;
}
