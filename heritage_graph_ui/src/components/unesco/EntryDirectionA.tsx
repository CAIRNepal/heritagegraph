'use client';

/**
 * Direction A — "The Serial Property".
 *
 * Thesis: the composition itself carries the fact. The seven zones are laid out
 * as one continuous horizontal band, read left to right, so a visitor perceives
 * them as a single object before reading a word of explanation. The caption
 * then names what they already saw.
 *
 * Depth order is photograph → identity → sourced facts → into the graph. No
 * ontology on the first screen, and the force graph is reached by following a
 * thread, never by landing on it.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'framer-motion';
import { IconArrowRight } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import {
  imageReveal,
  revealOnScroll,
  revealProps,
  wideColumn,
} from '@/lib/design';
import { KATHMANDU_VALLEY, LUMBINI } from '@/lib/unesco/ground-truth';
import { museumHref } from '@/lib/unesco/graph-bindings';

import {
  Eyebrow,
  GraphBoundaryNote,
  PropertyPhotograph,
  ProvenanceFooter,
  ScopeStatement,
  SerialPropertyCaution,
  ValleyFacts,
  ZoneCollection,
} from './entry-sections';

export function EntryDirectionA() {
  const t = useTranslations('unescoEntry');
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col gap-20 pb-24 md:gap-28">
      {/* ── Hero ── one photograph, one line of identity ── */}
      <section aria-labelledby="entry-a-title" className="relative">
        <motion.div
          variants={imageReveal}
          initial={reduceMotion ? false : "hidden"}
          animate="show"
        >
          <PropertyPhotograph
            subjectKey="bhaktapur-durbar-square"
            alt={t('photographOf', { name: t('zones.bhaktapur-durbar-square') })}
            aspect="16 / 9"
            sizes="100vw"
            priority
            className="rounded-none"
          >
            {/* Scrim carries the title. Neutral black because it darkens the
                photograph, which is identical in both themes. */}
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10"
              aria-hidden="true"
            />
            <div className="absolute inset-0 flex items-end">
              <div className={`${wideColumn} pb-10 md:pb-16`}>
                <Eyebrow className="text-white/75">{t('eyebrow')}</Eyebrow>
                <h1
                  id="entry-a-title"
                  className="mt-3 max-w-[18ch] font-serif text-4xl leading-[1.05] text-balance text-white sm:text-5xl lg:text-6xl"
                >
                  {t('directionA.title')}
                </h1>
                <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-white/85 sm:text-lg">
                  {t('directionA.lede')}
                </p>
              </div>
            </div>
          </PropertyPhotograph>
        </motion.div>
      </section>

      {/* ── Identity + facts ── */}
      <motion.section
        variants={revealOnScroll}
        {...revealProps(reduceMotion)}
        aria-labelledby="valley-heading"
        className={wideColumn}
      >
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr] md:gap-14">
          <div>
            <Eyebrow>{t('culturalHeading')}</Eyebrow>
            <h2 id="valley-heading" className="mt-2 font-serif text-3xl leading-tight text-balance sm:text-4xl">
              {t('properties.kathmandu-valley')}
            </h2>
            <p className="mt-4 max-w-[58ch] text-lg leading-relaxed text-muted-foreground">
              {t('listSummary')}
            </p>
            <p className="mt-3 max-w-[58ch] leading-relaxed text-foreground">{t('serialNote')}</p>
            <SerialPropertyCaution className="mt-6 max-w-[62ch]" />
          </div>
          <ValleyFacts className="md:pt-8" />
        </div>
      </motion.section>

      {/* ── The seven zones, as one band ── */}
      <section aria-labelledby="zones-heading">
        <div className={`${wideColumn} mb-7`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow>{KATHMANDU_VALLEY.yearInscribed}</Eyebrow>
              <h2 id="zones-heading" className="mt-2 font-serif text-3xl leading-tight text-balance">
                {t('zonesHeading')}
              </h2>
            </div>
            <p className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
              <IconArrowRight className="size-4" aria-hidden="true" />
              {t('allZones')}
            </p>
          </div>
        </div>
        {/* Horizontal on wide screens, but the same markup reflows to a single
            column below sm — a band that cannot be swiped on a phone would be
            the weakest point of this direction. */}
        <div className="hidden sm:block">
          <ZoneCollection layout="band" />
        </div>
        <div className={`${wideColumn} sm:hidden`}>
          <ZoneCollection layout="grid" />
        </div>
      </section>

      {/* ── Lumbini, given its own ground ── */}
      <motion.section
        variants={revealOnScroll}
        {...revealProps(reduceMotion)}
        aria-labelledby="lumbini-heading"
        className="bg-secondary py-16 md:py-20"
      >
        <div className={wideColumn}>
          <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
            <PropertyPhotograph
              subjectKey="lumbini"
              alt={t('photographOf', { name: t('properties.lumbini') })}
              aspect="4 / 3"
              sizes="(max-width: 768px) 100vw, 45vw"
            />
            <div>
              <Eyebrow>{t('typeCultural')}</Eyebrow>
              <h2
                id="lumbini-heading"
                className="mt-2 font-serif text-3xl leading-tight text-balance sm:text-4xl"
              >
                {t('properties.lumbini')}
              </h2>
              <p className="mt-3 font-mono text-sm text-muted-foreground">
                {t('inscribedYear', { year: LUMBINI.yearInscribed })}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild>
                  <Link href={museumHref('lumbini')}>
                    {t('openInMuseum')}
                    <IconArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <ScopeStatement />
      <GraphBoundaryNote />
      <ProvenanceFooter />
    </div>
  );
}
