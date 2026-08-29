'use client';

/**
 * The hero photograph, cycling through Nepal's UNESCO-listed cultural heritage.
 *
 * WHAT IT SHOWS, AND WHY THAT SET
 * The subjects are derived from `ground-truth.ts` — the seven monument zones of
 * the Kathmandu Valley property plus Lumbini — not hand-listed here. So the set
 * is "UNESCO-listed cultural heritage in Nepal" by construction, and it cannot
 * drift from the module that is the single authority for UNESCO facts on this
 * site. Sagarmatha and Chitwan are absent because they are inscribed as natural
 * properties and fall outside a record scoped to cultural heritage.
 *
 * THREE THINGS THIS HAD TO GET RIGHT
 *
 *  1. A visible pause control, and no auto-advance under reduced motion.
 *     Content that moves on its own without a way to stop it fails WCAG 2.2.2 —
 *     the same defect that was just removed from the museum's story carousel.
 *     Adding a second one on the front page would have been a poor trade.
 *  2. Attribution that follows the image. These photographs are CC BY-SA, so
 *     the credit is a licence condition, and a credit for a photograph that is
 *     no longer on screen is not a credit. It changes with the frame.
 *  3. Two layers in flight, never eight. This is the LCP element. Only the
 *     current and the next frame are mounted, and only the first carries
 *     `priority`, so the page still paints on one image and the swap has the
 *     following one already decoded.
 *
 * The photograph's own treatment — 16/9, the dissolve mask, the parallax, the
 * 1.06 scale — is unchanged from the single static hero it replaces. Only the
 * source rotates; the frame, the scrims and the wordmark above it do not move.
 */

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'framer-motion';
import { IconPlayerPause, IconPlayerPlay } from '@tabler/icons-react';

import { ImageAttribution } from '@/app/(site)/heritage-museum/components/ImageAttribution';
import { imageryFor } from '@/lib/unesco/imagery';
import { KATHMANDU_VALLEY, LUMBINI } from '@/lib/unesco/ground-truth';
import { cn } from '@/lib/utils';

import { Parallax } from './depth';

/** How long each photograph holds. Long enough to look at, not a slideshow. */
const HOLD_MS = 7000;

/**
 * The image treatment, kept identical to the static hero it replaces.
 *
 * The fade ends at 86%, not 100%: the image carries a parallax translate, so its
 * box slides inside the figure that clips it, and at 100% the clip cut the
 * photograph while the mask still had alpha left — a hard line across the page.
 */
const IMAGE_CLASS =
  'object-cover scale-[1.06] [mask-image:linear-gradient(to_bottom,#000_0%,#000_46%,rgba(0,0,0,0.5)_68%,transparent_86%)]';

interface Subject {
  key: string;
  /** Translation key for the place's name, under `unescoEntry`. */
  labelKey: string;
}

const SUBJECTS: Subject[] = [
  ...(KATHMANDU_VALLEY.monumentZones ?? []).map((z) => ({
    key: z.key,
    labelKey: `zones.${z.key}`,
  })),
  { key: LUMBINI.key, labelKey: `properties.${LUMBINI.key}` },
].filter((s) => Boolean(imageryFor(s.key)?.image));

export function HeroPhotographs({ children }: { children?: React.ReactNode }) {
  const t = useTranslations('unescoEntry');
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Motion preference is unknown on the server, so autoplay only ever starts
  // after mount. Rendering the same first frame either way keeps the markup
  // identical across hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const count = SUBJECTS.length;
  const advance = useCallback(() => setIndex((i) => (i + 1) % count), [count]);

  const autoplay = mounted && !reduce && !paused && count > 1;
  useEffect(() => {
    if (!autoplay) return;
    const id = window.setInterval(advance, HOLD_MS);
    return () => window.clearInterval(id);
  }, [autoplay, advance]);

  if (count === 0) return null;

  const current = SUBJECTS[index];
  // The frame after this one is mounted at zero opacity so its bytes are
  // already decoded when it becomes visible. Nothing else is in the DOM.
  const next = SUBJECTS[(index + 1) % count];
  const visible = count > 1 ? [current, next] : [current];
  const credit = imageryFor(current.key)?.image?.credit ?? null;
  const currentName = t(current.labelKey);

  return (
    <figure className="relative m-0 overflow-hidden bg-transparent">
      <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
        {visible.map((subject) => {
          const image = imageryFor(subject.key)?.image;
          if (!image) return null;
          const isCurrent = subject.key === current.key;
          return (
            <motion.div
              key={subject.key}
              className="absolute inset-0"
              initial={false}
              animate={{ opacity: isCurrent ? 1 : 0 }}
              transition={{ duration: reduce ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] }}
              aria-hidden={!isCurrent}
            >
              <Parallax distance={70} className="absolute inset-0">
                <div className="relative h-full w-full">
                  <Image
                    src={image.url}
                    alt={isCurrent ? t('photographOf', { name: t(subject.labelKey) }) : ''}
                    fill
                    sizes="100vw"
                    // Only the first frame blocks paint. The rest are swaps.
                    priority={subject.key === SUBJECTS[0].key}
                    className={IMAGE_CLASS}
                  />
                </div>
              </Parallax>
            </motion.div>
          );
        })}

        {children}

        {/* Which place this is, who took the photograph, and a way to stop it.
            SURFACE tokens, not on-image whites. This row sits at the foot of the
            frame, which is exactly where the dissolve mask has taken the
            photograph to nothing — so it is on the page background, not on the
            picture. White text there was invisible in light mode, which is the
            same defect the caption plates elsewhere on this page exist to
            avoid. `onSurface` is the attribution variant built for it. */}
        <div className="absolute inset-x-0 bottom-0 z-10">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-5 pb-5 sm:px-6 lg:px-8">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
              {currentName}
            </p>
            {credit ? (
              <div className="min-w-0">
                <ImageAttribution credit={credit} variant="onSurface" />
              </div>
            ) : null}

            <div className="ml-auto flex items-center gap-2">
              {/* Which frame, as dots. Buttons, not decoration — a reader who
                  wants a particular place should not have to wait for it. */}
              <div className="hidden items-center gap-1.5 sm:flex">
                {SUBJECTS.map((s, i) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={t(s.labelKey)}
                    aria-current={i === index}
                    className={cn(
                      'size-1.5 rounded-full transition-all focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring',
                      i === index
                        ? 'w-4 bg-primary'
                        : 'bg-muted-foreground/40 hover:bg-muted-foreground/70',
                    )}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                aria-pressed={paused}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-2.5 py-1 text-[0.7rem] text-muted-foreground backdrop-blur-sm transition-colors hover:border-primary/30 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {paused ? (
                  <IconPlayerPlay className="size-3.5" aria-hidden="true" />
                ) : (
                  <IconPlayerPause className="size-3.5" aria-hidden="true" />
                )}
                {paused ? t('heroPlay') : t('heroPause')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}
