'use client';

/**
 * The entry experience at `/`.
 *
 * WHAT A VISITOR MEETS, IN ORDER
 *  1. The name. A full-bleed photograph with the wordmark over it and one line
 *     saying what this is. An earlier version led with "Seven monument zones"
 *     — true, but it told a first-time visitor what they were looking at
 *     without ever telling them where they were.
 *  2. Why a graph. One concrete example — a temple, its guthi, its festival,
 *     its deity — beside a live web of the seven zones. The idea is meant to
 *     land visually before it is read.
 *  3. The seven places, as a connected index. Numbered, because the count is
 *     the point; no catalogue codes, because a visitor cannot read them.
 *  4. Lumbini, composed rather than posted.
 *  5. What is on the World Heritage List and what else we keep, credits,
 *     provenance.
 *
 * WRITTEN FOR SOMEONE WITH NO BACKGROUND IN ANY OF THIS
 * The copy here says "place", not "entity"; "connection", not "edge"; "checked
 * by someone", not "reviewed record"; and nothing on the page explains its own
 * interface. Identifiers, property numbers and licence detail all still exist —
 * they live on each place's own record and in the footer, where a researcher
 * looks and a visitor never has to.
 *
 * Deliberately removed: a Kathmandu Valley facts panel and a register of all
 * four properties. Both restated things already visible elsewhere on the page
 * and read as filler between the parts that matter.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { IconArrowRight } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { imageReveal, revealOnScroll, wideColumn } from '@/lib/design';
import { useReveal } from '@/lib/use-reveal';
import { KATHMANDU_VALLEY, LUMBINI } from '@/lib/unesco/ground-truth';
import { museumHref } from '@/lib/unesco/graph-bindings';

import {
  Eyebrow,
  GraphBoundaryNote,
  PropertyPhotograph,
  ProvenanceFooter,
  ZoneCollection,
} from './entry-sections';
import { ImageCreditsList, SourcedFacts, SubjectDescription } from './SourcedFacts';
import { Constellation } from './Constellation';
import { Wordmark } from './Wordmark';
import { CardWeb } from './CardWeb';
import { NextSteps } from './NextSteps';
import { AmbientWash, LiveBackdrop } from './depth';

const CREDITED_SUBJECTS = [
  ...(KATHMANDU_VALLEY.monumentZones ?? []).map((z) => z.key),
  'lumbini',
] as const;

export function UnescoEntry() {
  const t = useTranslations('unescoEntry');
  const reveal = useReveal();

  return (
    <div className="relative flex flex-col gap-20 pb-24 md:gap-28">
      {/* Slow motes behind the whole page — near the threshold of noticing, so
          the page feels alive without competing with the photography. */}
      <LiveBackdrop />
      {/* ── 1. The name ── */}
      <section aria-labelledby="entry-title" className="relative">
        <motion.div variants={imageReveal} initial="hidden" animate="show">
          <PropertyPhotograph
            subjectKey="bhaktapur-durbar-square"
            alt={t('photographOf', { name: t('zones.bhaktapur-durbar-square') })}
            aspect="16 / 9"
            sizes="100vw"
            priority
            creditPlacement="none"
            /* `bg-transparent` matters: the figure's default muted fill would
               show through wherever the mask below makes the photograph
               transparent, and a grey band is exactly the hard edge the mask
               exists to remove. */
            className="rounded-none bg-transparent"
            /* The photograph does not end, it dissolves. Masking the image (not
               the figure — the wordmark is a child and must stay opaque) lets
               the page background come through the bottom third, so there is no
               seam between the picture and the page. */
            imageClassName="scale-[1.06] [mask-image:linear-gradient(to_bottom,#000_0%,#000_52%,rgba(0,0,0,0.55)_78%,transparent_100%)]"
            parallax={70}
          >
            {/* Two scrims, both fading out before the bottom edge so neither
                deposits a dark band where the photograph is disappearing.
                Vertical carries the top of the frame and the header above it;
                horizontal darkens the left, where the type sits, and leaves the
                right side of the photograph at full brightness. A single
                symmetrical scrim strong enough for the lede would have flattened
                the whole picture. */}
            <div
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.46)_46%,rgba(0,0,0,0.24)_74%,transparent_100%)]"
              aria-hidden="true"
            />
            {/* The horizontal scrim carries the SAME vertical mask as the
                photograph. It has no falloff of its own — a left-to-right
                gradient is equally dark at the top and the bottom — so without
                the mask it kept painting grey over the page background below
                where the photograph had already dissolved, and put a hard edge
                exactly where the figure ended. */}
            <div
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.5)_0%,rgba(0,0,0,0.28)_38%,transparent_68%)] [mask-image:linear-gradient(to_bottom,#000_0%,#000_52%,transparent_100%)]"
              aria-hidden="true"
            />
            {/* Type sits in the upper, still-opaque part of the frame. It used
                to sit at the bottom, which is now the part that fades away. */}
            <div className="absolute inset-0 flex items-center">
              <div className={`${wideColumn} -mt-6 sm:-mt-10`}>
                <Eyebrow className="text-white/70">{t('eyebrow')}</Eyebrow>
                {/* The wordmark sits forward of the photograph, which drifts
                    behind it on scroll — the two read as separate planes
                    rather than as text on a picture. */}
                <Wordmark
                  id="entry-title"
                  first={t('wordmarkFirst')}
                  second={t('wordmarkSecond')}
                  className="mt-3"
                />
                <p className="mt-4 max-w-[46ch] text-sm leading-relaxed text-white/85 sm:text-lg">
                  {t('heroLede')}
                </p>
              </div>
            </div>
          </PropertyPhotograph>
        </motion.div>
      </section>

      {/* ── 2. Why a graph ── prose beside a live web ── */}
      <section aria-labelledby="intro-heading" className="relative isolate">
        <AmbientWash />
        <div className={wideColumn}>
          {/* The prose sits above the graph rather than beside it. In a side
              column the constellation was ~500px wide, which is not enough room
              for perspective to read as depth. */}
          <div className="mx-auto max-w-3xl text-center">
            <motion.div {...reveal} variants={revealOnScroll}>
              <h2
                id="intro-heading"
                className="mx-auto max-w-[22ch] font-serif text-3xl leading-[1.1] text-balance sm:text-4xl"
              >
                {t('introTitle')}
              </h2>
              <p className="mx-auto mt-5 max-w-[58ch] leading-relaxed text-muted-foreground">
                {t('introBody')}
              </p>
              <p className="mx-auto mt-4 max-w-[58ch] leading-relaxed text-foreground">
                {t('introBody2')}
              </p>
              <Link
                href="/about"
                className="group mt-7 inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                {t('introCta')}
                <IconArrowRight
                  className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                  aria-hidden="true"
                />
              </Link>
            </motion.div>
          </div>

          <motion.div {...reveal} variants={revealOnScroll} className="mt-10">
            <Constellation className="aspect-[4/3] sm:aspect-[2/1] lg:aspect-[5/2]" />
            <p className="mt-1 text-center text-xs text-muted-foreground">
              {t('constellationHint')}
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── 3. The seven zones, as the readable index ── */}
      <section aria-labelledby="zones-heading">
        <motion.div {...reveal} variants={revealOnScroll} className={`${wideColumn} mb-8`}>
          <Eyebrow>{t('inscribedYear', { year: KATHMANDU_VALLEY.yearInscribed })}</Eyebrow>
          <h2
            id="zones-heading"
            className="mt-2 font-serif text-3xl leading-tight text-balance sm:text-4xl"
          >
            {t('zonesHeadingPlain')}
          </h2>
          <p className="mt-4 max-w-[64ch] leading-relaxed text-muted-foreground">
            {t('zonesPlainNote')}
          </p>
        </motion.div>

        <div className={wideColumn}>
          <CardWeb>
            <ZoneCollection layout="grid" headingLevel={3} />
          </CardWeb>
        </div>
      </section>

      {/* ── 4. Two doors out ── */}
      <NextSteps />

      {/* ── 5. Lumbini ──
          Was a full-bleed 21:9 band with the text underneath, which read as a
          photograph dropped onto the page. It is a half-width picture set into
          a composition now: glow behind it, edges feathered into the page, and
          the heading beside it rather than below. */}
      <section aria-labelledby="lumbini-heading" className="relative isolate">
        <AmbientWash />
        <motion.div {...reveal} variants={revealOnScroll} className={wideColumn}>
          <div className="grid items-center gap-10 @3xl/main:grid-cols-[1fr_1fr] @3xl/main:gap-16">
            <div className="relative">
              {/* A soft bloom under the picture. Without it the feathered edges
                  fade into flat paper and read as a mistake rather than a
                  treatment. */}
              {/* Bleeds outward vertically at every size, horizontally only
                  once there is room for it. `-inset-6` on a phone puts the
                  glow's box 24px past the column and scrolls the page sideways;
                  the blur spreads horizontally on its own, and blur is ink, not
                  layout, so it costs no overflow. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-y-6 inset-x-0 -z-10 rounded-[2rem] bg-primary/[0.07] blur-2xl @2xl/main:-inset-x-6"
              />
              <PropertyPhotograph
                subjectKey="lumbini"
                alt={t('photographOf', { name: t('properties.lumbini') })}
                aspect="4 / 3"
                sizes="(max-width: 900px) 92vw, 40rem"
                creditPlacement="none"
                className="rounded-2xl bg-transparent shadow-[0_24px_60px_-28px_rgba(0,0,0,0.45)]"
                imageClassName="[mask-image:radial-gradient(120%_120%_at_50%_42%,#000_58%,rgba(0,0,0,0.72)_82%,transparent_100%)]"
                parallax={34}
              />
            </div>
            <div>
              <Eyebrow>{t('culturalHeading')}</Eyebrow>
              <h2
                id="lumbini-heading"
                className="mt-2 max-w-[22ch] font-serif text-3xl leading-tight text-balance sm:text-4xl"
              >
                {t('properties.lumbini')}
              </h2>
              <p className="mt-4 max-w-[46ch] leading-relaxed text-muted-foreground">
                {t('lumbiniLede')}
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                {t('inscribedYear', { year: LUMBINI.yearInscribed })}
              </p>
              <Button asChild className="mt-6">
                <Link href={museumHref('lumbini')}>
                  {t('openInMuseum')}
                  <IconArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>

          {/* The sourced detail sits below the composition rather than crammed
              into a column beside it, under a heading that says what it is. */}
          <div className="mt-12 border-t border-border pt-8">
            <Eyebrow className="mb-4">{t('recordedDetails')}</Eyebrow>
            <div className="grid gap-8 @3xl/main:grid-cols-[1.15fr_1fr] @3xl/main:gap-14">
              <SubjectDescription subjectKey="lumbini" />
              <SourcedFacts subjectKey="lumbini" />
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── 6. Boundary, credits, provenance ── */}
      <GraphBoundaryNote />

      <div className={wideColumn}>
        <div className="mx-auto max-w-3xl border-t border-border pt-8">
          <ImageCreditsList subjectKeys={CREDITED_SUBJECTS} />
        </div>
      </div>
      <ProvenanceFooter />
    </div>
  );
}
