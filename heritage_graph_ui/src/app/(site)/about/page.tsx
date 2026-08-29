'use client';

/**
 * What HeritageGraph is, and how a record gets into it.
 *
 * WHY THIS WAS REBUILT
 * The content was right; the page looked like it belonged to a different
 * product. A visitor followed "How the record is built" from the entry page and
 * landed on gradient hero cards, pill buttons and a grid of icon tiles — a
 * different typographic voice, a different sense of space, a different idea of
 * what a heading is. Arriving here felt like arriving at another site.
 *
 * So this uses the entry page's own vocabulary and nothing else: the same
 * continuous tinted ground, the same drifting backdrop, `Eyebrow` labels over
 * serif headings, the same reveal motion, and the same connected `TiltCard`
 * panels — wrapped in `CardWeb`, so what the platform offers is strung together
 * by the same living filaments as the seven places and the three steps. No
 * shadcn Card shells, no icon tiles, no gradient panels.
 *
 * Every fact, translation key, external link and the graph embed are carried
 * over unchanged. This is a change of voice, not of substance.
 */

import dynamicImport from 'next/dynamic';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { IconArrowRight, IconExternalLink } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { ImageCreditsList } from '@/components/unesco/SourcedFacts';
import { ProvenanceFooter } from '@/components/unesco/entry-sections';
import { KATHMANDU_VALLEY } from '@/lib/unesco/ground-truth';
import { Eyebrow, OpeningGround } from '@/components/editorial';
import { CardWeb } from '@/components/unesco/CardWeb';
import { LiveBackdrop, TiltCard } from '@/components/unesco/depth';
import { editorialStagger, revealOnScroll, wideColumn } from '@/lib/design';
import { useReveal } from '@/lib/use-reveal';
import { cn } from '@/lib/utils';

/** Cytoscape is heavy, so it loads only when this page is opened. */
const GraphViewEmbed = dynamicImport(
  () => import('@/app/(dashboard)/graphview/graphview-client').then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">…</div>
    ),
  },
);

const REPOSITORY_URL = 'https://github.com/CAIRNepal/heritagegraph';

/**
 * The eight subjects whose photographs the entry page shows.
 *
 * Their credits used to sit at the bottom of that page — eight rows of author
 * and licence, the last thing a first-time visitor read. They belong here with
 * the rest of the reference material; the entry page links to this section,
 * which is attribution "in a reasonable manner based on the medium" as CC
 * BY-SA allows.
 */
const CREDITED_SUBJECTS = [
  ...(KATHMANDU_VALLEY.monumentZones ?? []).map((z) => z.key),
  'lumbini',
] as const;

/** The four things the platform does, each with somewhere to go and see it. */
const CORE_FEATURES = [
  { key: 'knowledgeGraph', href: '/graphview' },
  { key: 'linkedOpenData', href: '/knowledge/entity' },
  { key: 'communityCuration', href: '/community/contributors' },
  // Links to the public Methods page rather than the login-gated review queue:
  // the review model must be inspectable without an account.
  { key: 'epistemicReview', href: '/methods' },
] as const;

/** Standards and vocabularies a reviewer needs named explicitly. */
const STANDARDS = ['cidoc', 'crminf', 'linkml', 'shacl', 'skos', 'voidDcat'] as const;

/** The terms that decide whether the data can be reused. */
const DATA_TERMS = ['provenance', 'access', 'licensing', 'identifiers'] as const;

/** An outbound link, styled as text rather than as a button. */
function TextLink({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  const cls =
    'group inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring';
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
        <IconExternalLink className="size-3.5" aria-hidden="true" />
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
      <IconArrowRight
        className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
        aria-hidden="true"
      />
    </Link>
  );
}

/**
 * A section heading, in two tones.
 *
 * `prefix` and `highlight` are the two halves of one phrase — "Core" +
 * "features", "Data," + "provenance and reuse" — so they have to be set as a
 * single sentence. Putting the prefix in an eyebrow, which is what this page
 * did at first, splits the phrase across two type sizes and reads as a mistake.
 * The second half sits back in weight and colour instead, the same compound
 * treatment the wordmark and the page title use.
 */
function Heading({
  id,
  prefix,
  highlight,
  className,
}: {
  id?: string;
  prefix: string;
  highlight: string;
  className?: string;
}) {
  return (
    <h2
      id={id}
      className={cn('font-serif text-3xl leading-tight text-balance sm:text-4xl', className)}
    >
      {prefix} <span className="font-light text-muted-foreground">{highlight}</span>
    </h2>
  );
}

/**
 * A term and its definition, as a ruled row.
 *
 * Same shape the entry page uses for recorded facts, so a reader who has seen
 * one recognises the other.
 */
function RuledRow({ term, definition }: { term: string; definition: string }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-t border-border py-3 @xl/main:grid-cols-[minmax(9rem,14rem)_minmax(0,1fr)] @xl/main:gap-6">
      <dt className="text-sm font-medium text-foreground">{term}</dt>
      <dd className="text-sm leading-relaxed text-muted-foreground">{definition}</dd>
    </div>
  );
}

export default function AboutPage() {
  const t = useTranslations('about');
  const reveal = useReveal();

  return (
    <div className="relative flex flex-col gap-20 pb-24 md:gap-28">
      <LiveBackdrop />

      {/* ── The opening ──
          One group with a single continuous ground, exactly as the entry page
          opens, so the two pages share a first impression. */}
      <div className="relative isolate flex flex-col">
        <OpeningGround />
        <section aria-labelledby="about-title" className={`${wideColumn} pt-10 md:pt-16`}>
          <motion.div initial="hidden" animate="show" variants={editorialStagger}>
            <motion.div variants={revealOnScroll}>
              <Eyebrow>{t('eyebrow')}</Eyebrow>
            </motion.div>
            <motion.h1
              variants={revealOnScroll}
              id="about-title"
              className="mt-3 max-w-[24ch] font-serif text-4xl leading-[1.05] text-balance sm:text-5xl lg:text-6xl"
            >
              {t('hero.titlePrefix')}{' '}
              {/* The second half sits back rather than turning a colour: the
                  same two-tone compound the wordmark uses. */}
              <span className="font-light text-muted-foreground">{t('hero.titleHighlight')}</span>
            </motion.h1>
            <motion.p
              variants={revealOnScroll}
              className="mt-6 max-w-[62ch] text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              {t('hero.description')}
            </motion.p>
            <motion.div
              variants={revealOnScroll}
              className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3"
            >
              <Button asChild>
                <Link href="/contribute">
                  {t('hero.startContributing')}
                  <IconArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <TextLink href="/methods">{t('hero.methods')}</TextLink>
            </motion.div>
          </motion.div>
        </section>

        {/* ── Mission ── */}
        <motion.section
          {...reveal}
          variants={revealOnScroll}
          aria-labelledby="mission-heading"
          className={`${wideColumn} pt-16 md:pt-24`}
        >
          <div className="max-w-3xl">
            {/* No eyebrow: it would repeat the page's own, two blocks apart. */}
            <h2
              id="mission-heading"
              className="font-serif text-3xl leading-tight text-balance sm:text-4xl"
            >
              {t('mission.title')}
            </h2>
            <div className="mt-5 flex flex-col gap-4 leading-relaxed text-muted-foreground">
              <p>{t('mission.paragraph1')}</p>
              <p>
                <strong className="font-semibold text-foreground">{t('mission.appName')}</strong>{' '}
                {t('mission.paragraph2')}
              </p>
            </div>
          </div>
        </motion.section>
      </div>

      {/* ── What it does ── connected panels, as on the entry page ── */}
      <section aria-labelledby="features-heading">
        <motion.div {...reveal} variants={revealOnScroll} className={`${wideColumn} mb-8`}>
          <Heading
            id="features-heading"
            prefix={t('sections.coreFeatures.prefix')}
            highlight={t('sections.coreFeatures.highlight')}
          />
        </motion.div>
        <div className={wideColumn}>
          <CardWeb>
            <motion.ul
              {...reveal}
              variants={editorialStagger}
              className="grid grid-cols-1 gap-x-12 gap-y-10 @xl/main:grid-cols-2"
            >
              {CORE_FEATURES.map(({ key, href }, i) => (
                <motion.li key={key} data-web-node variants={revealOnScroll} className="group">
                  <TiltCard
                    max={1.4}
                    className="h-full rounded-xl border border-border bg-card/70 shadow-sm backdrop-blur-[2px] transition-shadow duration-500 group-hover:shadow-xl"
                  >
                    <Link
                      href={href}
                      className="flex h-full flex-col rounded-xl p-6 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                    >
                      <span
                        className="font-mono text-xs tabular-nums text-muted-foreground"
                        aria-hidden="true"
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <h3 className="mt-2 font-serif text-xl leading-tight text-balance">
                        {t(`features.${key}.title`)}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {t(`features.${key}.desc`)}
                      </p>
                    </Link>
                  </TiltCard>
                </motion.li>
              ))}
            </motion.ul>
          </CardWeb>
        </div>
      </section>

      {/* ── The graph itself ──
          It used to sit behind a sidebar link called "Graph Visualization",
          which told a reader nothing about why they would click it. Shown here
          instead, in the one place where someone is already asking what this
          platform is. */}
      <motion.section
        {...reveal}
        variants={revealOnScroll}
        aria-labelledby="graph-heading"
        className={wideColumn}
      >
        <Heading
          id="graph-heading"
          prefix={t('graph.prefix')}
          highlight={t('graph.highlight')}
        />
        <p className="mt-4 max-w-[64ch] leading-relaxed text-muted-foreground">
          {t('graph.description')}
        </p>
        {/* The tool, given room and stripped of its own title.
            At 34rem in a boxed panel, with its page header repeating the heading
            directly above it, 151 classes read as a hairball inside a second
            website. Taller, quieter framing, and `embedded` so there is one
            title on this page instead of two. */}
        <div className="relative mt-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-y-6 inset-x-0 -z-10 rounded-[2rem] bg-primary/[0.06] blur-2xl @2xl/main:-inset-x-6"
          />
          <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
            <div className="h-[42rem] min-h-0">
              <GraphViewEmbed embedded />
            </div>
          </div>
        </div>
        <div className="mt-5">
          <TextLink href="/graphview">{t('graph.cta')}</TextLink>
        </div>
      </motion.section>

      {/* ── Data, provenance and reuse — the section a reviewer reads first ── */}
      <motion.section
        {...reveal}
        variants={revealOnScroll}
        aria-labelledby="data-heading"
        className={wideColumn}
      >
        <div className="max-w-3xl">
          <Heading
            id="data-heading"
            prefix={t('sections.data.prefix')}
            highlight={t('sections.data.highlight')}
          />
          <p className="mt-4 leading-relaxed text-muted-foreground">{t('data.description')}</p>
          <dl className="mt-8 flex flex-col">
            {DATA_TERMS.map((key) => (
              <RuledRow
                key={key}
                term={t(`data.${key}.term`)}
                definition={t(`data.${key}.definition`)}
              />
            ))}
          </dl>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <TextLink href="/methods">{t('data.methodsCta')}</TextLink>
            <TextLink href={`${REPOSITORY_URL}/blob/main/LICENSE-DATA`} external>
              {t('data.licenseCta')}
            </TextLink>
          </div>
        </div>
      </motion.section>

      {/* ── Standards ── */}
      <motion.section
        {...reveal}
        variants={revealOnScroll}
        aria-labelledby="standards-heading"
        className={wideColumn}
      >
        <div className="max-w-3xl">
          <Heading
            id="standards-heading"
            prefix={t('sections.standards.prefix')}
            highlight={t('sections.standards.highlight')}
          />
          <p className="mt-4 leading-relaxed text-muted-foreground">{t('standards.description')}</p>
          <dl className="mt-8 flex flex-col">
            {STANDARDS.map((key) => (
              <RuledRow
                key={key}
                term={t(`standards.${key}.name`)}
                definition={t(`standards.${key}.role`)}
              />
            ))}
          </dl>
        </div>
      </motion.section>

      {/* ── Who makes it ── */}
      <motion.section
        {...reveal}
        variants={revealOnScroll}
        aria-labelledby="cair-heading"
        className={wideColumn}
      >
        <div className="grid items-center gap-10 @3xl/main:grid-cols-[minmax(0,1fr)_1.4fr] @3xl/main:gap-16">
          <div className="flex flex-col items-start gap-3">
            <Image
              src="/cair-logo/fulllogo_nobuffer.png"
              alt="CAIR-Nepal"
              width={180}
              height={72}
              className="h-auto w-40 opacity-90 dark:invert"
              sizes="160px"
            />
            <p className="text-sm text-muted-foreground">{t('cair.subtitle')}</p>
          </div>
          <div>
            <h2 id="cair-heading" className="font-serif text-3xl leading-tight text-balance">
              {t('cair.title')}
            </h2>
            <p className="mt-4 max-w-[58ch] leading-relaxed text-muted-foreground">
              {t('cair.description')}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <TextLink href="https://www.cair-nepal.org/" external>
                {t('cair.website')}
              </TextLink>
              <TextLink href="https://github.com/CAIRNepal" external>
                GitHub
              </TextLink>
              <TextLink href="mailto:info@cair-nepal.org">{t('cair.contact')}</TextLink>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── Two doors out, the same pair the entry page offers ── */}
      <section aria-labelledby="about-cta-heading" className={wideColumn}>
        <motion.div {...reveal} variants={revealOnScroll} className="max-w-3xl">
          <h2
            id="about-cta-heading"
            className="font-serif text-3xl leading-tight text-balance sm:text-4xl"
          >
            {t('cta.title')}
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">{t('cta.description')}</p>
        </motion.div>
        <motion.div
          {...reveal}
          variants={editorialStagger}
          className="mt-8 grid gap-5 @2xl/main:grid-cols-2"
        >
          {[
            { href: '/contribute', label: t('cta.contribute') },
            { href: '/knowledge/entity', label: t('cta.browse') },
          ].map(({ href, label }) => (
            <motion.div key={href} variants={revealOnScroll} className="group">
              <TiltCard
                max={1.4}
                className="h-full rounded-xl border border-border bg-card/70 shadow-sm transition-shadow duration-500 group-hover:shadow-xl"
              >
                <Link
                  href={href}
                  className="flex items-center justify-between gap-4 rounded-xl p-6 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                >
                  <span className="font-serif text-xl leading-tight">{label}</span>
                  <IconArrowRight
                    className="size-5 shrink-0 text-primary transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                    aria-hidden="true"
                  />
                </Link>
              </TiltCard>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Photograph credits ── moved off the entry page ── */}
      <motion.section
        {...reveal}
        variants={revealOnScroll}
        aria-labelledby="image-credits"
        className={wideColumn}
        // The entry page links straight to this section.
        id="image-credits"
      >
        <div className="mx-auto max-w-3xl">
          <ImageCreditsList subjectKeys={CREDITED_SUBJECTS} />
        </div>
      </motion.section>

      {/* ── Where the facts on the entry page come from ── */}
      <motion.div {...reveal} variants={revealOnScroll}>
        <ProvenanceFooter />
      </motion.div>

      {/* ── Source and citation ── the quiet footer register the entry uses ── */}
      <motion.section
        {...reveal}
        variants={revealOnScroll}
        aria-label={t('openSource.title')}
        className={wideColumn}
      >
        <div
          className={cn(
            'mx-auto flex max-w-3xl flex-col gap-3 border-t border-border pt-8',
            'text-xs leading-relaxed text-muted-foreground',
          )}
        >
          <p>
            <span className="text-foreground">{t('openSource.title')}</span>{' '}
            {t('openSource.description')}
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <TextLink href={REPOSITORY_URL} external>
              {t('openSource.viewSource')}
            </TextLink>
            <TextLink href={`${REPOSITORY_URL}/blob/main/CITATION.cff`} external>
              {t('openSource.howToCite')}
            </TextLink>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
