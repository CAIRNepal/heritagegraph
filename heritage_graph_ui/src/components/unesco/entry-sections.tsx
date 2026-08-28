'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'framer-motion';
import {
  IconAlertHexagon,
  IconArrowRight,
  IconCircleDot,
  IconMap2,
  IconTopologyStar3,
} from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import {
  editorialStagger,
  revealOnScroll,
  wideColumn,
} from '@/lib/design';
import {
  KATHMANDU_VALLEY,
  NATURAL_PROPERTIES,
  type MonumentZone,
} from '@/lib/unesco/ground-truth';
import { IMAGERY_PROVENANCE } from '@/lib/unesco/imagery';
import { museumHref } from '@/lib/unesco/graph-bindings';
import { useReveal } from '@/lib/use-reveal';
import { cn } from '@/lib/utils';

import { PropertyPhotograph } from './PropertyPhotograph';
import { WorldHeritageRef } from './SourcedFacts';
import { TiltCard } from './depth';

/* ── Small shared bits ─────────────────────────────────────────────────── */

/** Uppercase micro-label. Structural, used for real category labels only. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted-foreground',
        className,
      )}
    >
      {children}
    </p>
  );
}

/**
 * A fact with its label. Renders an explicit "not recorded" state rather than
 * hiding an unknown, so a gap reads as a gap.
 */
export function FactRow({ label, value }: { label: string; value: string | null }) {
  const t = useTranslations('unescoEntry');
  return (
    <div className="flex flex-col gap-0.5 border-t border-border py-2.5">
      <dt className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className={cn('text-sm', value ? 'text-foreground' : 'italic text-muted-foreground')}>
        {value ?? t('notRecorded')}
      </dd>
    </div>
  );
}

/* ── Monument zone card ────────────────────────────────────────────────── */

export function ZoneCard({
  zone,
  index,
  layout = 'grid',
  headingLevel = 3,
}: {
  zone: MonumentZone;
  index: number;
  layout?: 'grid' | 'band';
  /** Depth of the card's title, so the document outline stays ordered under
   *  whatever heading the surrounding section used. */
  headingLevel?: 3 | 4;
}) {
  const Heading = (headingLevel === 4 ? 'h4' : 'h3') as 'h3' | 'h4';
  const t = useTranslations('unescoEntry');
  const name = t(`zones.${zone.key}`);

  return (
    <motion.article
      variants={revealOnScroll}
      className={cn(
        'group flex flex-col gap-3',
        layout === 'band' && 'w-[78vw] shrink-0 snap-start sm:w-[52vw] lg:w-[30rem]',
      )}
    >
      {/* The photograph is a link; its credit is NOT inside that link. The
          credit carries licence and file-description anchors, and nesting an
          <a> inside an <a> is invalid HTML — React fails hydration on it and
          regenerates the whole tree on the client. */}
      <TiltCard className="rounded-xl shadow-sm transition-shadow duration-500 group-hover:shadow-xl">
        <Link
          href={museumHref(zone.key)}
          aria-label={name}
          className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <PropertyPhotograph
            subjectKey={zone.key}
            alt={t('photographOf', { name })}
            aspect="4 / 3"
            creditPlacement="none"
            sizes="(max-width: 640px) 78vw, (max-width: 1024px) 52vw, 30rem"
            imageClassName="transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        </Link>
      </TiltCard>

      <div className="flex flex-col gap-1.5">
        <WorldHeritageRef subjectKey={zone.key} className="w-fit" />
        <div className="flex items-baseline gap-2">
          {/* Numbering is real information here: these are the seven zones of
              one serial nomination, and the count is the point. */}
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {String(index + 1).padStart(2, '0')}
          </span>
          <Heading className="font-serif text-xl leading-tight text-balance">{name}</Heading>
        </div>
        {zone.descriptor ? (
          <p className="max-w-[46ch] text-sm leading-relaxed text-muted-foreground">
            {t(`descriptors.${zone.descriptor}`)}
          </p>
        ) : null}
        <Link
          href={museumHref(zone.key)}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {t('openInMuseum')}
          <IconArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </motion.article>
  );
}

/* ── The caution that keeps the framing correct ────────────────────────── */

export function SerialPropertyCaution({ className }: { className?: string }) {
  const t = useTranslations('unescoEntry');
  return (
    <p
      className={cn(
        'flex items-start gap-2.5 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm leading-relaxed text-foreground',
        className,
      )}
    >
      <IconCircleDot className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <span>
        <strong className="font-semibold">{t('zonesCaution')}</strong>{' '}
        <span className="text-muted-foreground">{t('boundaryConfirmed')}</span>
      </span>
    </p>
  );
}

/* ── Scope: the two natural properties, stated rather than dropped ─────── */

export function ScopeStatement() {
  const t = useTranslations('unescoEntry');
  const reduceMotion = useReducedMotion();
  const reveal = useReveal();

  return (
    <motion.section
      variants={revealOnScroll}
      {...reveal}
      aria-labelledby="unesco-scope-heading"
      className={wideColumn}
    >
      <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-6 sm:p-8">
        <Eyebrow className="mb-3">{t('alsoInscribed')}</Eyebrow>
        <h2 id="unesco-scope-heading" className="font-serif text-2xl leading-tight text-balance">
          {t('scopeHeading')}
        </h2>
        <p className="mt-3 max-w-[62ch] leading-relaxed text-muted-foreground">{t('scopeBody')}</p>
        <ul className="mt-5 flex flex-col gap-2">
          {NATURAL_PROPERTIES.map((p) => (
            <li key={p.key} className="flex items-baseline gap-2.5 text-sm">
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {p.yearInscribed}
              </span>
              <span className="text-foreground">{t(`properties.${p.key}`)}</span>
              <span className="text-muted-foreground">· {t('typeNatural')}</span>
            </li>
          ))}
        </ul>
      </div>
    </motion.section>
  );
}

/* ── The boundary between "UNESCO-inscribed" and "in our graph" ────────── */

export function GraphBoundaryNote() {
  const t = useTranslations('unescoEntry');
  const reduceMotion = useReducedMotion();
  const reveal = useReveal();

  return (
    <motion.section
      variants={revealOnScroll}
      {...reveal}
      aria-labelledby="graph-boundary-heading"
      className={wideColumn}
    >
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start gap-3">
          <IconAlertHexagon className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h2
              id="graph-boundary-heading"
              className="font-serif text-2xl leading-tight text-balance"
            >
              {t('graphBoundaryHeading')}
            </h2>
            <p className="mt-3 max-w-[62ch] leading-relaxed text-muted-foreground">
              {t('graphBoundaryBody')}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild variant="default">
                <Link href="/heritage-museum">
                  <IconTopologyStar3 className="size-4" aria-hidden="true" />
                  {t('exploreGraph')}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/atlas">
                  <IconMap2 className="size-4" aria-hidden="true" />
                  {t('openInAtlas')}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

/* ── Where the facts on this page come from ────────────────────────────── */

export function ProvenanceFooter() {
  const t = useTranslations('unescoEntry');
  return (
    <div className={wideColumn}>
      <div className="mx-auto max-w-3xl border-t border-border pt-6">
        <p className="text-xs leading-relaxed text-muted-foreground">{t('factsSourceNote')}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {t('provenanceNote', { date: IMAGERY_PROVENANCE.retrieved })}
        </p>
        <Link
          href="/methods"
          className="mt-3 inline-block text-xs text-primary underline-offset-4 hover:underline focus-visible:underline"
        >
          {t('browseKnowledge')} →
        </Link>
      </div>
    </div>
  );
}

/* ── Kathmandu Valley identity block, shared by both directions ────────── */

export function ValleyFacts({ className }: { className?: string }) {
  const t = useTranslations('unescoEntry');
  return (
    <dl className={cn('flex flex-col', className)}>
      <FactRow
        label={t('criteriaLabel')}
        value={KATHMANDU_VALLEY.criteria ? t('criteriaValue') : null}
      />
      <FactRow label={t('typeCultural')} value={t('inscribedYear', { year: KATHMANDU_VALLEY.yearInscribed })} />
      <FactRow
        label={t('zonesHeading')}
        value={String(KATHMANDU_VALLEY.monumentZones?.length ?? 0)}
      />
      <div className="border-t border-border py-2.5">
        <p className="text-sm leading-relaxed text-muted-foreground">{t('dangerListing')}</p>
      </div>
    </dl>
  );
}

/** Zone grid / band, shared. */
export function ZoneCollection({
  layout,
  headingLevel = 3,
}: {
  layout: 'grid' | 'band';
  headingLevel?: 3 | 4;
}) {
  const reduceMotion = useReducedMotion();
  const reveal = useReveal();
  const zones = KATHMANDU_VALLEY.monumentZones ?? [];

  if (layout === 'band') {
    return (
      <motion.div
        variants={editorialStagger}
        {...reveal}
        className="flex snap-x snap-mandatory gap-6 overflow-x-auto px-5 pb-4 sm:px-6 lg:px-8"
      >
        {zones.map((zone, i) => (
          <ZoneCard key={zone.key} zone={zone} index={i} layout="band" headingLevel={headingLevel} />
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={editorialStagger}
      {...reveal}
      className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3"
    >
      {zones.map((zone, i) => (
        <ZoneCard key={zone.key} zone={zone} index={i} layout="grid" headingLevel={headingLevel} />
      ))}
    </motion.div>
  );
}

export { PropertyPhotograph };
