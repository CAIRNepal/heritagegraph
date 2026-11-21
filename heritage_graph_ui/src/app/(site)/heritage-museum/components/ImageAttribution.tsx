'use client';

import { cn } from '@/lib/utils';

import type { ImageCredit } from '../heritage-data';

/**
 * Where the credit line is being drawn. This exists because attribution has to
 * work on two very different grounds:
 *
 *  - `onImage` — over a photograph's dark scrim. Cannot use theme tokens: the
 *    ground is the photograph, which is the same in both themes, so the text
 *    stays white regardless of theme. Raised from the previous `white/55`,
 *    which measured below AA even over the darkest part of the scrim.
 *  - `onSurface` — on a card or page ground. Must use tokens, or it renders
 *    white-on-cream in light mode.
 *
 * The old single hardcoded `text-white/55` silently failed the moment the
 * component was used outside the museum's dark media viewer.
 */
type AttributionVariant = 'onImage' | 'onSurface';

const VARIANT_CLASSES: Record<AttributionVariant, { text: string; link: string }> = {
  onImage: {
    text: 'text-white/85',
    link: 'underline decoration-white/40 underline-offset-2 hover:text-white focus-visible:text-white',
  },
  onSurface: {
    text: 'text-muted-foreground',
    link: 'underline decoration-muted-foreground/50 underline-offset-2 hover:text-foreground focus-visible:text-foreground',
  },
};

/**
 * Renders the licensing/attribution line for a displayed image. This is a
 * legal requirement for CC-BY-SA assets and a provenance expectation for the
 * publishable corpus. Returns null when no credit metadata is available so it
 * never fabricates an attribution.
 */
export function ImageAttribution({
  credit,
  className = '',
  variant = 'onImage',
  focusable = true,
}: {
  credit?: ImageCredit;
  className?: string;
  variant?: AttributionVariant;
  /**
   * False keeps the links out of the Tab order. For grids, where two credit
   * links per card tripled the stops a keyboard user had to pass; the same
   * credit is reachable on the record's own view.
   */
  focusable?: boolean;
}) {
  if (!credit || (!credit.artist && !credit.license && !credit.descriptionUrl)) return null;

  const { artist, license, licenseUrl, descriptionUrl, source } = credit;
  const v = VARIANT_CLASSES[variant];
  const tabIndex = focusable ? undefined : -1;

  return (
    <p className={cn('text-[10px] leading-tight', v.text, className)}>
      {/*
        Compact by design. Creative Commons asks for attribution "in any
        reasonable manner based on the medium" — so rather than spell out
        author, licence AND a separate "Wikimedia Commons ↗" link on every
        thumbnail, the author's name itself carries the link to the source
        file page. That satisfies author + source + licence in one short line.
        The full title-author-source-licence credit, which CC BY-SA 3.0
        requires a title for, is listed once per page by <ImageCreditsList>.
      */}
      {artist ? (
        descriptionUrl ? (
          <a
            href={descriptionUrl}
            tabIndex={tabIndex}
            target="_blank"
            rel="noopener noreferrer"
            title={source ? `${artist} — ${source}` : artist}
            className={cn('rounded-xs focus-visible:outline-2 focus-visible:outline-offset-2', v.link)}
          >
            {artist}
          </a>
        ) : (
          <span>{artist}</span>
        )
      ) : null}
      {artist && license ? <span aria-hidden="true"> · </span> : null}
      {license ?
        licenseUrl ?
          <a
            href={licenseUrl}
            tabIndex={tabIndex}
            target="_blank"
            rel="noopener noreferrer license"
            className={cn('rounded-xs focus-visible:outline-2 focus-visible:outline-offset-2', v.link)}
          >
            {license}
          </a>
        : <span>{license}</span>
      : null}
    </p>
  );
}
