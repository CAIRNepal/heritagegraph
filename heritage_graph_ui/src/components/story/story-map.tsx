import Link from 'next/link';

import { cn } from '@/lib/utils';

export interface StoryMapItem {
  id: string;
  label: string;
  phrase: string;
  direction: 'out' | 'in';
  href?: string;
}

interface StoryMapProps {
  focusLabel: string;
  items: StoryMapItem[];
  /** Items up to this index are drawn; later ones stay faint. */
  revealed: number;
  /** The item the reader is on now. */
  active?: number;
  className?: string;
}

const W = 400;
const H = 440;
const CX = W / 2;
const CY = H / 2;
const R = 150;

function wrap(text: string, max = 18): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > max && line) {
      lines.push(line);
      line = w;
    } else {
      line = (line + ' ' + w).trim();
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

/**
 * The record at the centre and the records the story reaches around it, each
 * edge labelled with how it reads. Drawn as the reader goes: the map is what
 * they have walked, not a picture of the whole graph.
 */
export function StoryMap({ focusLabel, items, revealed, active, className }: StoryMapProps) {
  const n = Math.max(items.length, 1);
  const points = items.map((item, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { item, x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle), i };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn('h-auto w-full', className)} role="img" aria-label={`Map of ${focusLabel} and ${items.length} linked records`}>
      {points.map(({ item, x, y, i }) => {
        const shown = i < revealed;
        const mx = (CX + x) / 2;
        const my = (CY + y) / 2;
        return (
          <g key={item.id} className="transition-opacity duration-500" opacity={shown ? 1 : 0.14}>
            <line x1={CX} y1={CY} x2={x} y2={y} className="stroke-story-ink" strokeWidth={1} />
            {shown && (
              <text x={mx} y={my - 4} textAnchor="middle" className="fill-story-accent text-[10px] font-semibold">
                {item.direction === 'out' ? `${item.phrase} →` : `← ${item.phrase}`}
              </text>
            )}
          </g>
        );
      })}

      <rect x={CX - 8} y={CY - 8} width={16} height={16} className="fill-story-accent" />
      {wrap(focusLabel, 22).map((line, k) => (
        <text key={k} x={CX} y={CY + 26 + k * 13} textAnchor="middle" className="fill-story-ink text-[12px] font-bold">
          {line}
        </text>
      ))}

      {points.map(({ item, x, y, i }) => {
        const shown = i < revealed;
        const isActive = i === active;
        const below = y >= CY;
        const label = (
          <g className="transition-opacity duration-500" opacity={shown ? 1 : 0.14}>
            <rect
              x={x - 6}
              y={y - 6}
              width={12}
              height={12}
              className={cn(isActive ? 'fill-story-accent' : 'fill-story-paper', 'stroke-story-accent')}
              strokeWidth={2}
            />
            {wrap(item.label).map((line, k, all) => (
              <text
                key={k}
                x={x}
                y={below ? y + 22 + k * 12 : y - 14 - (all.length - 1 - k) * 12}
                textAnchor="middle"
                className="fill-story-ink text-[11px] font-semibold"
              >
                {line}
              </text>
            ))}
          </g>
        );
        return item.href && shown ? (
          <Link key={item.id} href={item.href} aria-label={item.label}>
            {label}
          </Link>
        ) : (
          <g key={item.id}>{label}</g>
        );
      })}
    </svg>
  );
}
