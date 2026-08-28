'use client';

/**
 * The entry experience at `/`.
 *
 * A hybrid of the two directions built in Phase 2, both still viewable at
 * /preview/entry-a and /preview/entry-b:
 *
 *  - From B ("The Register"): the four properties stated as a record before
 *    anything argues for one of them, and the seven zones nested visibly
 *    *inside* the Kathmandu Valley entry. This is what makes "seven monument
 *    zones of one property" hard to misread, which is the point the brief
 *    cares about most.
 *  - From A ("The Serial Property"): a full-bleed establishing photograph as
 *    the first thing on screen. B's weakness was a text-only first screen;
 *    this fixes it without diluting the register.
 *
 * Depth order: photograph → identity → the record → sourced facts → zones →
 * into the graph. The force graph is reached by following a thread.
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
import { LUMBINI, NEPAL_WORLD_HERITAGE } from '@/lib/unesco/ground-truth';
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

export function UnescoEntry() {
  const t = useTranslations('unescoEntry');
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col gap-20 pb-24 md:gap-28">
      {/* ── 1. Establishing photograph ── the first thing on screen ── */}
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
                  {t('directionB.title')}
                </h1>
                <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-white/85 sm:text-lg">
                  {t('directionB.lede')}
                </p>
              </div>
            </div>
          </PropertyPhotograph>
        </motion.div>
      </section>

      {/* ── 2. The register ── the list, before any of it is argued for ── */}
      <section aria-labelledby="register-heading" className={wideColumn}>
        <motion.div variants={editorialStagger} {...revealProps(reduceMotion)} className="mx-auto max-w-4xl">
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
                  <span className="font-serif text-base leading-snug text-balance sm:text-lg">
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

          <motion.div variants={revealOnScroll}>
            <SerialPropertyCaution className="mt-7" />
          </motion.div>
        </motion.div>
      </section>

      {/* ── 3. Kathmandu Valley ── identity and sourced facts ── */}
      <section aria-labelledby="valley-heading">
        <motion.div {...revealProps(reduceMotion)} variants={revealOnScroll} className={wideColumn}>
          <div className="grid gap-8 md:grid-cols-[1.4fr_1fr] md:gap-14">
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
            </div>
            <ValleyFacts className="md:pt-8" />
          </div>
        </motion.div>

        {/* Zones nested inside the property entry — indented onto a recessed
            ground so the containment is structural, not merely captioned. */}
        <div className="mt-10 border-l-2 border-primary/40 bg-secondary/60 py-12 md:py-16">
          <div className={`${wideColumn} mb-8`}>
            <h3 className="font-serif text-2xl leading-tight text-balance">{t('zonesHeading')}</h3>
          </div>
          <div className={wideColumn}>
            <ZoneCollection layout="grid" />
          </div>
        </div>
      </section>

      {/* ── 4. Lumbini ── equal standing, same treatment ── */}
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
        </motion.div>
      </section>

      {/* ── 5. Scope, boundary, provenance ── */}
      <ScopeStatement />
      <GraphBoundaryNote />
      <ProvenanceFooter />
    </div>
  );
}
