'use client';

import type { RefObject } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import { useAtlasStore } from '../hooks/use-atlas-store';
import { ATLAS_SPOTLIGHT, computeSpotlightDiameterPx } from '../lib/atlas-spotlight-config';

interface SpotlightDiscProps {
  shellRef: RefObject<HTMLElement | null>;
  children: React.ReactNode;
  /** Optional: wrap Cesium / globe canvas with FX filter preset */
  globeFxClassName?: string;
}

/** Circular globe viewport + diameter measurement for `--atlas-spot-d`. */
export function SpotlightDisc({ shellRef, children, globeFxClassName }: SpotlightDiscProps) {
  const discRef = useRef<HTMLDivElement>(null);
  const [showGrid, setShowGrid] = useState(false);
  const discTransparent = useAtlasStore((s) => s.discTransparent);

  const discStyle = useMemo(
    () =>
      ({
        width: `min(var(--atlas-spot-d, ${String(ATLAS_SPOTLIGHT.fallbackDiameterPx)}px), calc(100vw - ${String(ATLAS_SPOTLIGHT.viewportInsetHorizontalPx)}px))`,
        height: `min(var(--atlas-spot-d, ${String(ATLAS_SPOTLIGHT.fallbackDiameterPx)}px), calc(100dvh - ${String(ATLAS_SPOTLIGHT.viewportInsetVerticalPx)}px))`,
      }) as const,
    [],
  );

  useEffect(() => {
    setShowGrid(new URLSearchParams(window.location.search).get('atlas') === 'grid');
  }, []);

  useEffect(() => {
    const shell = shellRef.current;
    const disc = discRef.current;
    if (!shell || !disc) return;

    const ro = new ResizeObserver(() => {
      const discRect = disc.getBoundingClientRect();
      const shellRect = shell.getBoundingClientRect();

      const d = computeSpotlightDiameterPx(discRect.width, discRect.height);

      // Measure actual gutter widths from the real DOM layout instead of static config
      const gutterL = Math.max(0, Math.round(discRect.left - shellRect.left));
      const gutterR = Math.max(0, Math.round(shellRect.right - discRect.right));
      const { gutterBottomPx } = ATLAS_SPOTLIGHT;

      shell.style.setProperty('--atlas-spot-d', `${String(d)}px`);
      shell.style.setProperty('--atlas-gutter-l', `${String(gutterL)}px`);
      shell.style.setProperty('--atlas-gutter-r', `${String(gutterR)}px`);
      shell.style.setProperty('--atlas-gutter-b', `${String(Math.round(gutterBottomPx))}px`);
    });

    ro.observe(disc);
    // Also observe the shell so we recalculate on any layout shift
    ro.observe(shell);
    return () => ro.disconnect();
  }, [shellRef]);

  return (
    <div
      ref={discRef}
      className={cn('relative flex h-full min-h-[200px] items-center justify-center lg:min-h-0')}
    >
      <div
        className={cn(
          'atlas-spot-mask atlas-gpu-layer relative overflow-hidden rounded-full',
          discTransparent ?
            'border border-border/30 bg-transparent shadow-[0_0_0_1px_rgba(255,255,255,0.05)_inset,0_8px_32px_rgba(0,0,0,0.35)]'
          : 'border border-border/45 bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset,0_8px_32px_rgba(0,0,0,0.55)]',
        )}
        style={discStyle}
      >
        <div
          className={cn(
            'pointer-events-auto absolute inset-0 [&_.cesium-viewer-toolbar]:hidden',
            globeFxClassName,
          )}
        >
          {children}
        </div>
        {showGrid ?
          <div
            className="pointer-events-none absolute inset-0 z-10 opacity-[0.12]"
            style={{
              backgroundImage: `
                  linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px),
                  linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)
                `,
              backgroundSize: '16px 16px',
            }}
            aria-hidden
          />
        : null}
      </div>
    </div>
  );
}
