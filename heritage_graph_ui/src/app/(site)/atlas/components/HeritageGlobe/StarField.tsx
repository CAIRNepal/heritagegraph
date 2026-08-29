'use client';

import { useMemo } from 'react';

/** Deterministic PRNG so the sky is stable across renders. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function starShadows(count: number, seed: number, alpha: number): string {
  const rand = mulberry32(seed);
  const shadows: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const x = (rand() * 100).toFixed(2);
    const y = (rand() * 100).toFixed(2);
    const a = (alpha * (0.4 + rand() * 0.6)).toFixed(2);
    shadows.push(`${x}vw ${y}vh 0 rgba(255,255,255,${a})`);
  }
  return shadows.join(', ');
}

/** Subtle particle star field rendered behind the transparent Cesium canvas. */
export function StarField() {
  const layers = useMemo(
    () => [
      { size: 1, shadows: starShadows(140, 11, 0.55), duration: '7s' },
      { size: 1.6, shadows: starShadows(60, 47, 0.75), duration: '11s' },
      { size: 2.2, shadows: starShadows(22, 83, 0.9), duration: '17s' },
    ],
    [],
  );

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes atlas-star-twinkle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        @media (prefers-reduced-motion: reduce) {
          .atlas-star-layer { animation: none !important; }
        }
      `}</style>
      {layers.map((layer, i) => (
        <div
          key={i}
          className="atlas-star-layer absolute rounded-full"
          style={{
            width: layer.size,
            height: layer.size,
            boxShadow: layer.shadows,
            animation: `atlas-star-twinkle ${layer.duration} ease-in-out infinite`,
            animationDelay: `${i * 1.7}s`,
          }}
        />
      ))}
    </div>
  );
}
