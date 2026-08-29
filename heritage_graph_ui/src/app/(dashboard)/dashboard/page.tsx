'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  ProgressionWidgetFull,
  LeaderboardPreview,
} from '@/components/progression-widgets';
import { SectionCards } from '@/app/(dashboard)/components/section-cards';
import { CorpusSummary } from '@/components/dashboard/corpus-summary';
import { IconArrowRight } from '@tabler/icons-react';
import { Eyebrow, OpeningGround } from '@/components/editorial';
import { LiveBackdrop, TiltCard } from '@/components/unesco/depth';
import { editorialStagger, revealOnScroll, scaleIn } from '@/lib/design';
import { useReveal } from '@/lib/use-reveal';
import { dashboardBrowseCategories } from '@/config/dashboard-links';

/**
 * The dashboard.
 *
 * Same visual language as the entry and About pages, deliberately: a reader who
 * follows "Open the dashboard" from the home page should not feel they have
 * changed site. The gradient hero panel and pill buttons that used to open this
 * page were the loudest signal that they had.
 *
 * Every data widget below — CorpusSummary, SectionCards, the progression
 * widgets — is untouched. This is a change of frame, not of function.
 */
function SectionHeading({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-6 font-serif text-2xl leading-tight text-balance sm:text-3xl">
      {children}
    </h2>
  );
}

export default function Page() {
  const { data: session, status } = useSession();
  const t = useTranslations('dashboard');
  const tContribute = useTranslations('contribute');
  const tShortcuts = useTranslations('dashboard.shortcuts');
  const [greeting, setGreeting] = useState<string | null>(null);
  const reveal = useReveal();

  const isAuthenticated = status === 'authenticated';

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting(t('greetingMorning'));
    else if (h < 18) setGreeting(t('greetingAfternoon'));
    else setGreeting(t('greetingEvening'));
  }, [t]);

  const firstName = session?.user?.name?.split(' ')[0];

  // A signed-out visitor is not "back" and has no first name. Greeting them by a
  // placeholder ("Good morning, there!") reads as a broken template, so the
  // hero states what the platform is instead.
  const heading =
    isAuthenticated && firstName ?
      `${greeting ?? t('greetingFallback')}, ${firstName}`
    : t('heroTitleAnonymous');

  const linkCls =
    'group inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring';

  return (
    <div className="relative space-y-16 pb-8 md:space-y-20">
      <LiveBackdrop />

      {/* ── The opening ── the same ground the entry and About pages open on ── */}
      <section aria-labelledby="dashboard-title" className="relative isolate -mx-4 px-4 pt-4 md:-mx-6 md:px-6">
        <OpeningGround />
        <motion.div initial="hidden" animate="show" variants={editorialStagger}>
          <motion.div variants={revealOnScroll}>
            <Eyebrow>{t('eyebrow')}</Eyebrow>
          </motion.div>
          <motion.h1
            variants={revealOnScroll}
            id="dashboard-title"
            className="mt-3 max-w-[26ch] font-serif text-4xl leading-[1.05] text-balance sm:text-5xl"
          >
            {heading}
          </motion.h1>
          <motion.p
            variants={revealOnScroll}
            className="mt-5 max-w-[58ch] text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            {isAuthenticated ? t('heroSubtitle') : t('heroSubtitleAnonymous')}
          </motion.p>
          <motion.div
            variants={revealOnScroll}
            className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3"
          >
            <Button asChild>
              <Link href="/contribute">
                {tContribute('newContribution')}
                <IconArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Link href="/graphview" className={linkCls}>
              {t('exploreGraph')}
              <IconArrowRight
                className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                aria-hidden="true"
              />
            </Link>
            <Link href="/methods" className={linkCls}>
              {t('methodsAndData')}
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Corpus state ── what is actually in the graph right now. Public,
           so a signed-out reader (or a reviewer without an account) sees real
           figures rather than a wall of navigation tiles. ── */}
      <motion.section
        {...reveal}
        variants={editorialStagger}
      >
        <SectionHeading>{t('corpusOverview')}</SectionHeading>
        <CorpusSummary />
      </motion.section>

      {/* ── Personal state ── only rendered when there is a person. Rendering
           the heading with an empty body below it (the previous behaviour for
           signed-out visitors) reads as a broken page. ── */}
      {isAuthenticated ?
        <>
          <motion.section
            {...reveal}
            variants={editorialStagger}
          >
            <SectionHeading>{t('yourOverview')}</SectionHeading>
            <SectionCards />
          </motion.section>

          <motion.section
            {...reveal}
            variants={editorialStagger}
          >
            <SectionHeading>{t('yourProgress')}</SectionHeading>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <motion.div variants={scaleIn} className="lg:col-span-2">
                <ProgressionWidgetFull />
              </motion.div>
              <motion.div variants={scaleIn}>
                <LeaderboardPreview />
              </motion.div>
            </div>
          </motion.section>
        </>
      : null}

      {/* ── Browse ── the sidebar already lists every domain, so this stays a
           single compact row rather than three redundant link grids. ── */}
      <motion.section
        {...reveal}
        variants={editorialStagger}
      >
        <SectionHeading>{t('browseByCategory')}</SectionHeading>
        {/* Panels rather than a row of icon tiles, so the dashboard uses the
            same shape for "here are some things" as the entry and About pages
            do. Titles come from the same `dashboard.shortcuts` namespace the
            grid widget read.

            Not wrapped in `CardWeb` like the other panel groups: the filaments
            and their terminals need a gutter taller than they are wide, and at
            five columns of a single-line label they collapsed into blobs
            between the cards. The pattern is worth reusing, the decoration is
            not worth forcing. */}
          <motion.ul
            {...reveal}
            variants={editorialStagger}
            className="grid grid-cols-1 gap-x-10 gap-y-8 @xl/main:grid-cols-3 @4xl/main:grid-cols-5"
          >
            {dashboardBrowseCategories.map(({ titleKey, href }) => (
              <motion.li key={titleKey} data-web-node variants={revealOnScroll} className="group">
                <TiltCard
                  max={1.4}
                  className="h-full rounded-xl border border-border bg-card/70 shadow-sm backdrop-blur-[2px] transition-shadow duration-500 group-hover:shadow-lg"
                >
                  <Link
                    href={href}
                    className="flex h-full items-center rounded-xl p-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  >
                    <span className="font-serif text-base leading-tight text-balance">
                      {tShortcuts(titleKey)}
                    </span>
                  </Link>
                </TiltCard>
              </motion.li>
            ))}
          </motion.ul>
        <div className="mt-6">
          <Link href="/knowledge/entity" className={linkCls}>
            {t('viewAllCategories')}
            <IconArrowRight
              className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
              aria-hidden="true"
            />
          </Link>
        </div>
      </motion.section>
    </div>
  );
}
