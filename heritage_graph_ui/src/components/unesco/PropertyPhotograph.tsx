'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { IconPhotoOff } from '@tabler/icons-react';

import { ImageAttribution } from '@/app/(dashboard)/heritage-museum/components/ImageAttribution';
import { aspectRatioOf, imageryFor } from '@/lib/unesco/imagery';

import { Parallax } from './depth';
import { cn } from '@/lib/utils';

interface PropertyPhotographProps {
  /** A `MonumentZone.key`, or `'lumbini'`. */
  subjectKey: string;
  /**
   * Alt text. Describes the photograph, not the monument's significance —
   * a screen-reader user needs to know what is depicted, not marketing copy.
   */
  alt: string;
  /**
   * Where the credit line sits.
   *  - `overlay` — over the image, for full-bleed photography.
   *  - `below`   — under the image, on the page surface.
   *  - `none`    — caller renders <PhotographCredit> itself. Required when the
   *    photograph is wrapped in a link: the credit contains its own licence and
   *    description anchors, and an <a> inside an <a> is invalid HTML that makes
   *    React's hydration fail outright.
   */
  creditPlacement?: 'overlay' | 'below' | 'none';
  /** Force an aspect ratio instead of the image's intrinsic one. */
  aspect?: string;
  className?: string;
  imageClassName?: string;
  /** Set on the one photograph above the fold so it is not lazy-loaded. */
  priority?: boolean;
  sizes?: string;
  /**
   * Parallax travel in pixels for the image layer. Any children (a title, a
   * scrim) stay put, so the two read as separate planes. Omit for no parallax.
   */
  parallax?: number;
  children?: React.ReactNode;
}

/**
 * A photograph with its licence and author credit, or an explicit
 * "no photograph recorded" state.
 *
 * The empty state is deliberate design, not a failure mode. Two of the eight
 * cultural subjects had no image anywhere in the project; the fix was to source
 * credited photographs, but the state stays because the graph's long tail will
 * keep producing subjects without one, and an unrelated stock image under a
 * monument's name would be a fabrication.
 */
export function PropertyPhotograph({
  subjectKey,
  alt,
  creditPlacement = 'overlay',
  aspect,
  className,
  imageClassName,
  priority = false,
  sizes = '100vw',
  parallax,
  children,
}: PropertyPhotographProps) {
  const t = useTranslations('unescoEntry');
  const imagery = imageryFor(subjectKey);
  const image = imagery?.image ?? null;

  // Reserve the box before the image arrives — the landing page's CLS budget
  // is zero, and an unreserved <Image fill> collapses to nothing until load.
  const ratio = aspect ?? (image ? aspectRatioOf(image) : '3 / 2');

  if (!image) {
    return (
      <div
        className={cn(
          'relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-border bg-muted/50 p-6 text-center',
          className,
        )}
        style={{ aspectRatio: ratio }}
      >
        <IconPhotoOff className="size-6 text-muted-foreground" aria-hidden="true" />
        <p className="max-w-[28ch] text-sm text-muted-foreground">{t('noPhotographRecorded')}</p>
        {children}
      </div>
    );
  }

  return (
    <figure className={cn('relative overflow-hidden rounded-xl bg-muted', className)}>
      <div className="relative w-full" style={{ aspectRatio: ratio }}>
        {parallax ? (
          <Parallax distance={parallax} className="absolute inset-0">
            <div className="relative h-full w-full">
              <Image
                src={image.url}
                alt={alt}
                fill
                sizes={sizes}
                priority={priority}
                className={cn('object-cover', imageClassName)}
              />
            </div>
          </Parallax>
        ) : (
          <Image
            src={image.url}
            alt={alt}
            fill
            sizes={sizes}
            priority={priority}
            className={cn('object-cover', imageClassName)}
          />
        )}
        {creditPlacement === 'overlay' ? (
          /* Scrim exists so the credit stays legible over any photograph.
             Neutral black, not a token: it darkens the photo, which is the
             same in both themes. */
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/75 to-transparent"
            aria-hidden="true"
          />
        ) : null}
        {children}
      </div>

      {/* figcaption is a direct child of <figure> in both placements — the HTML
          spec allows it only as figure's first or last child, and burying it in
          the aspect-ratio wrapper made it invalid. */}
      {creditPlacement === 'overlay' ? (
        <figcaption className="absolute inset-x-0 bottom-0 p-3">
          <ImageAttribution credit={image.credit} variant="onImage" />
        </figcaption>
      ) : null}
      {creditPlacement === 'below' ? (
        <figcaption className="pt-2">
          <ImageAttribution credit={image.credit} variant="onSurface" />
        </figcaption>
      ) : null}
    </figure>
  );
}


/**
 * The licence/author line for a subject's photograph, rendered on its own.
 *
 * Use with `creditPlacement="none"` whenever the photograph sits inside a link,
 * so the credit's own anchors stay outside that link.
 */
export function PhotographCredit({
  subjectKey,
  variant = 'onSurface',
  className,
}: {
  subjectKey: string;
  variant?: 'onImage' | 'onSurface';
  className?: string;
}) {
  const image = imageryFor(subjectKey)?.image ?? null;
  if (!image) return null;
  return <ImageAttribution credit={image.credit} variant={variant} className={className} />;
}
