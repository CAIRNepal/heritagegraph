'use client';

/**
 * The entry experience at `/`.
 *
 * ORDER OF THE PAGE
 * The seven monument zones come first, immediately under the photograph,
 * because they are what a visitor came to see. An earlier version opened with
 * a paragraph about Nepal having four World Heritage properties — accurate,
 * but it made the reader work through a list before reaching anything worth
 * looking at, and it read as preamble.
 *
 * The framing that has to be right — that these are seven components of one
 * property, not seven sites — is carried by two things that need no paragraph:
 * one short caution line, and the official UNESCO reference on every card
 * (121bis-001 … 121bis-007). The full register of all four properties, the
 * scope note on the two natural ones, and the graph boundary all follow lower
 * down, where a reader who wants the whole picture will find them.
 *
 * Depth order: photograph → the zones → sourced facts → the wider record →
 * into the graph.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'framer-motion';
import { IconArrowRight } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import {
  editorialStagger,
  imageReveal,
  revealOnScroll,
  revealProps,
  wideColumn,
} from '@/lib/design';
import {
  KATHMANDU_VALLEY,
  LUMBINI,
  NEPAL_WORLD_HERITAGE,
} from '@/lib/unesco/ground-truth';
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
import { ImageCreditsList, SourcedFacts } from './SourcedFacts';

const CREDITED_SUBJECTS = [
  ...(KATHMANDU_VALLEY.monumentZones ?? []).map((z) => z.key),
  'lumbini',
] as const;

export function UnescoEntry() {
  const t = useTranslations('unescoEntry');
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col gap-20 pb-24 md:gap-28">
      {/* ── 1. The photograph ── */}
      <section aria-labelledby="entry-title" className="relative">
        <motion.div variants={imageReveal} initial={reduceMotion ? false : 'hidden'} animate="show">
          <PropertyPhotograph
            subjectKey="bhaktapur-durbar-square"
            alt={t('photographOf', { name: t('zones.bhaktapur-durbar-square') })}
            aspect="16 / 9"
            sizes="100vw"
            priority
            className="rounded-none"
          >
            {/* Neutral black scrim: it darkens the photograph, which is the
                same in both themes, so it must not come from a theme token. */}
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10"
              aria-hidden="true"
            />
            <div className="absolute inset-0 flex items-end">
              <div className={`${wideColumn} pb-8 md:pb-14`}>
                <Eyebrow className="text-white/75">{t('eyebrow')}</Eyebrow>
                <h1
                  id="entry-title"
                  className="mt-3 max-w-[16ch] font-serif text-[2rem] leading-[1.05] text-balance text-white sm:text-5xl lg:text-6xl"
                >
                  {t('directionA.title')}
                </h1>
                <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-white/85 sm:text-lg">
                  {t('zonesLede')}
                </p>
              </div>
            </div>
          </PropertyPhotograph>
        </motion.div>
      </section>

      {/* ── 2. The seven zones, straight away ── */}
      <section aria-labelledby="zones-heading">
        <motion.div
          {...revealProps(reduceMotion)}
          variants={revealOnScroll}
          className={`${wideColumn} mb-8`}
        >
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <div>
              <Eyebrow>{t('inscribedYear', { year: KATHMANDU_VALLEY.yearInscribed })}</Eyebrow>
              <h2
                id="zones-heading"
                className="mt-2 font-serif text-3xl leading-tight text-balance sm:text-4xl"
              >
                {t('zonesHeading')}
              </h2>
            </div>
            <Link
              href="#valley-heading"
              className="text-sm text-primary underline-offset-4 hover:underline focus-visible:underline"
            >
              {t('aboutTheProperty')} ↓
            </Link>
          </div>
          <SerialPropertyCaution className="mt-6 max-w-[68ch]" />
        </motion.div>

        <div className={wideColumn}>
          <ZoneCollection layout="grid" headingLevel={3} />
        </div>
      </section>

      {/* ── 3. The property itself, with sourced facts ── */}
      <motion.section
        {...revealProps(reduceMotion)}
        variants={revealOnScroll}
        aria-labelledby="valley-heading"
        className={`${wideColumn} scroll-mt-20`}
      >
        <div className="grid gap-8 md:grid-cols-[1.3fr_1fr] md:gap-14">
          <div>
            <Eyebrow>{t('culturalHeading')}</Eyebrow>
            <h2
              id="valley-heading"
              className="mt-2 font-serif text-3xl leading-tight text-balance sm:text-4xl"
            >
              {t('properties.kathmandu-valley')}
            </h2>
            <p className="mt-4 max-w-[58ch] leading-relaxed text-muted-foreground">
              {t('serialNote')}
            </p>
            <ValleyFacts className="mt-6 max-w-[34rem]" />
          </div>
          <SourcedFacts subjectKey="kathmandu-valley" className="md:pt-9" />
        </div>
      </motion.section>

      {/* ── 4. Lumbini ── */}
      <section aria-labelledby="lumbini-heading">
        <motion.div {...revealProps(reduceMotion)} variants={revealOnScroll}>
          <PropertyPhotograph
            subjectKey="lumbini"
            alt={t('photographOf', { name: t('properties.lumbini') })}
            aspect="21 / 9"
            sizes="100vw"
            className="rounded-none"
          />
        </motion.div>
        <motion.div
          {...revealProps(reduceMotion)}
          variants={revealOnScroll}
          className={`${wideColumn} mt-10`}
        >
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

      {/* ── 5. The full register, below the heritage rather than ahead of it ── */}
      <section aria-labelledby="register-heading" className={wideColumn}>
        <motion.div
          variants={editorialStagger}
          {...revealProps(reduceMotion)}
          className="mx-auto max-w-4xl"
        >
          <motion.div variants={revealOnScroll}>
            <Eyebrow>{t('directionB.registerHeading')}</Eyebrow>
            <h2
              id="register-heading"
              className="mt-2 max-w-[26ch] font-serif text-2xl leading-tight text-balance sm:text-3xl"
            >
              {t('listSummary')}
            </h2>
          </motion.div>

          {/* Ordered by inscription year — the order carries information, so an
              ordered list is the honest element. */}
          <motion.ol variants={revealOnScroll} className="mt-8 border-t border-border">
            {[...NEPAL_WORLD_HERITAGE]
              .sort((a, b) => a.yearInscribed - b.yearInscribed)
              .map((p) => (
                <li
                  key={p.key}
                  className="grid grid-cols-[3.5rem_1fr] items-baseline gap-x-4 border-b border-border py-4 sm:grid-cols-[6rem_1fr_7rem]"
                >
                  <span className="font-mono text-sm tabular-nums text-muted-foreground">
                    {p.yearInscribed}
                  </span>
                  <span className="min-w-0 font-serif text-base leading-snug text-balance sm:text-lg">
                    {t(`properties.${p.key}`)}
                    {p.serial ? (
                      <span className="ml-2 align-middle font-sans text-[0.7rem] font-medium uppercase tracking-wider text-primary">
                        {t('zonesHeading')}
                      </span>
                    ) : null}
                  </span>
                  <span className="col-span-2 mt-1 font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground sm:col-span-1 sm:mt-0 sm:text-right">
                    {p.type === 'cultural' ? t('typeCultural') : t('typeNatural')}
                  </span>
                </li>
              ))}
          </motion.ol>
        </motion.div>
      </section>

      {/* ── 6. Scope, boundary, provenance ── */}
      <ScopeStatement />
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
