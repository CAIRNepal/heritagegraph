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
 *  3. The seven zones, as an index with the official UNESCO reference on each.
 *  4. Lumbini.
 *  5. The boundary of what is UNESCO-inscribed, credits, provenance.
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
  SerialPropertyCaution,
  ZoneCollection,
} from './entry-sections';
import { ImageCreditsList, SourcedFacts } from './SourcedFacts';
import { Constellation } from './Constellation';
import { AmbientWash } from './depth';

const CREDITED_SUBJECTS = [
  ...(KATHMANDU_VALLEY.monumentZones ?? []).map((z) => z.key),
  'lumbini',
] as const;

export function UnescoEntry() {
  const t = useTranslations('unescoEntry');
  const reveal = useReveal();

  return (
    <div className="flex flex-col gap-20 pb-24 md:gap-28">
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
            className="rounded-none"
            imageClassName="scale-[1.06]"
            parallax={70}
          >
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/15"
              aria-hidden="true"
            />
            <div className="absolute inset-0 flex items-end">
              <div className={`${wideColumn} pb-9 md:pb-16`}>
                <Eyebrow className="text-white/70">{t('eyebrow')}</Eyebrow>
                {/* The wordmark sits forward of the photograph, which drifts
                    behind it on scroll — the two read as separate planes
                    rather than as text on a picture. */}
                <h1
                  id="entry-title"
                  className="mt-3 font-serif text-[2.6rem] leading-[0.95] tracking-[-0.03em] text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)] sm:text-7xl lg:text-8xl"
                >
                  {t('wordmark')}
                </h1>
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
          <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
            <motion.div {...reveal} variants={revealOnScroll}>
              <h2
                id="intro-heading"
                className="max-w-[18ch] font-serif text-3xl leading-[1.1] text-balance sm:text-4xl"
              >
                {t('introTitle')}
              </h2>
              <p className="mt-5 max-w-[54ch] leading-relaxed text-muted-foreground">
                {t('introBody')}
              </p>
              <p className="mt-4 max-w-[54ch] leading-relaxed text-foreground">{t('introBody2')}</p>
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

            <motion.div {...reveal} variants={revealOnScroll}>
              <Constellation />
              <p className="mt-2 text-center text-xs text-muted-foreground">
                {t('constellationHint')}
              </p>
            </motion.div>
          </div>
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
            {t('zonesHeading')}
          </h2>
          <SerialPropertyCaution className="mt-6 max-w-[68ch]" />
        </motion.div>

        <div className={wideColumn}>
          <ZoneCollection layout="grid" headingLevel={3} />
        </div>
      </section>

      {/* ── 4. Lumbini ── */}
      <section aria-labelledby="lumbini-heading">
        <motion.div {...reveal} variants={revealOnScroll}>
          <PropertyPhotograph
            subjectKey="lumbini"
            alt={t('photographOf', { name: t('properties.lumbini') })}
            aspect="21 / 9"
            sizes="100vw"
            creditPlacement="none"
            className="rounded-none"
            parallax={50}
          />
        </motion.div>
        <motion.div {...reveal} variants={revealOnScroll} className={`${wideColumn} mt-10`}>
          <div className="grid gap-8 md:grid-cols-[1.3fr_1fr] md:gap-14">
            <div>
              <Eyebrow>{t('culturalHeading')}</Eyebrow>
              <h2
                id="lumbini-heading"
                className="mt-2 max-w-[20ch] font-serif text-3xl leading-tight text-balance sm:text-4xl"
              >
                {t('properties.lumbini')}
              </h2>
              <p className="mt-3 font-mono text-sm text-muted-foreground">
                {t('inscribedYear', { year: LUMBINI.yearInscribed })}
              </p>
              <Button asChild className="mt-6">
                <Link href={museumHref('lumbini')}>
                  {t('openInMuseum')}
                  <IconArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
            <SourcedFacts subjectKey="lumbini" />
          </div>
        </motion.div>
      </section>

      {/* ── 5. Boundary, credits, provenance ── */}
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
