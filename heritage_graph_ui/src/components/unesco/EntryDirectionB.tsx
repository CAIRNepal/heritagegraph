'use client';

/**
 * Direction B — "The Register".
 *
 * Thesis: open the way a museum opens, with wall text. The four properties are
 * stated as a record first — property, year, type — so the structure of the
 * list is understood before any photograph argues for one of them. Photography
 * then enters at full weight, one subject per screen.
 *
 * The grouping is explicit and hierarchical: the seven zones are visibly nested
 * *inside* the Kathmandu Valley entry rather than sitting beside it, which
 * makes "zones of one property" hard to misread even when skimming.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'framer-motion';
import { IconArrowRight } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import {
  editorialStagger,
  revealOnScroll,
  wideColumn,
} from '@/lib/design';
import { useReveal } from '@/lib/use-reveal';
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

export function EntryDirectionB() {
  const t = useTranslations('unescoEntry');
  const reduceMotion = useReducedMotion();
  const reveal = useReveal();

  return (
    <div className="flex flex-col gap-20 pb-24 md:gap-28">
      {/* ── Wall text ── the register, stated before anything is shown ── */}
      <section aria-labelledby="entry-b-title" className={`${wideColumn} pt-12 md:pt-20`}>
        <motion.div
          variants={editorialStagger}
          initial="hidden"
          animate="show"
          className="mx-auto max-w-4xl"
        >
          <motion.div variants={revealOnScroll}>
            <Eyebrow>{t('eyebrow')}</Eyebrow>
            <h1
              id="entry-b-title"
              className="mt-4 max-w-[16ch] font-serif text-4xl leading-[1.04] text-balance sm:text-5xl lg:text-6xl"
            >
              {t('directionB.title')}
            </h1>
            <p className="mt-5 max-w-[54ch] text-lg leading-relaxed text-muted-foreground">
              {t('directionB.lede')}
            </p>
          </motion.div>

          {/* The list as a record. Ordered by inscription year — the order is
              information, so an ordered list is the honest element. */}
          <motion.ol variants={revealOnScroll} className="mt-10 border-t border-border">
            {[...NEPAL_WORLD_HERITAGE]
              .sort((a, b) => a.yearInscribed - b.yearInscribed)
              .map((p) => (
                <li
                  key={p.key}
                  className="grid grid-cols-[4.5rem_1fr] items-baseline gap-x-4 border-b border-border py-4 sm:grid-cols-[6rem_1fr_7rem]"
                >
                  <span className="font-mono text-sm tabular-nums text-muted-foreground">
                    {p.yearInscribed}
                  </span>
                  <span className="min-w-0 font-serif text-lg leading-snug text-balance">
                    {t(`properties.${p.key}`)}
                    {p.serial ? (
                      <span className="ml-2 align-middle font-sans text-xs font-medium uppercase tracking-wider text-primary">
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
            <SerialPropertyCaution className="mt-8" />
          </motion.div>
        </motion.div>
      </section>

      {/* ── Kathmandu Valley: photograph at full weight ── */}
      <section aria-labelledby="b-valley-heading">
        <motion.div
          variants={revealOnScroll}
          {...reveal}
        >
          <PropertyPhotograph
            subjectKey="swayambhu"
            alt={t('photographOf', { name: t('zones.swayambhu') })}
            aspect="21 / 9"
            sizes="100vw"
            className="rounded-none"
          />
        </motion.div>

        <motion.div
          variants={revealOnScroll}
          {...reveal}
          className={`${wideColumn} mt-10`}
        >
          <div className="grid gap-8 md:grid-cols-[1.4fr_1fr] md:gap-14">
            <div>
              <Eyebrow>{t('culturalHeading')}</Eyebrow>
              <h2
                id="b-valley-heading"
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

        {/* Zones nested visually inside the property entry — indented and on a
            recessed ground, so the containment is structural, not captioned. */}
        <div className="mt-10 border-l-2 border-primary/40 bg-secondary/60 py-12">
          <div className={`${wideColumn} mb-7`}>
            <h3 className="font-serif text-2xl leading-tight text-balance">{t('zonesHeading')}</h3>
          </div>
          <div className={wideColumn}>
            <ZoneCollection layout="grid" headingLevel={4} />
          </div>
        </div>
      </section>

      {/* ── Lumbini, equal standing, same treatment ── */}
      <section aria-labelledby="b-lumbini-heading">
        <motion.div
          variants={revealOnScroll}
          {...reveal}
        >
          <PropertyPhotograph
            subjectKey="lumbini"
            alt={t('photographOf', { name: t('properties.lumbini') })}
            aspect="21 / 9"
            sizes="100vw"
            className="rounded-none"
          />
        </motion.div>
        <motion.div
          variants={revealOnScroll}
          {...reveal}
          className={`${wideColumn} mt-10`}
        >
          <Eyebrow>{t('culturalHeading')}</Eyebrow>
          <h2
            id="b-lumbini-heading"
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

      <ScopeStatement />
      <GraphBoundaryNote />
      <ProvenanceFooter />
    </div>
  );
}
