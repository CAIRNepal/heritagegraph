'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  ProgressionWidgetFull,
  LeaderboardPreview,
} from '@/components/progression-widgets';
import { SectionCards } from '@/app/(dashboard)/components/section-cards';
import { CorpusSummary } from '@/components/dashboard/corpus-summary';
import { IconPlus, IconArrowRight, IconGraph, IconFlask } from '@tabler/icons-react';
import {
  fadeInUp,
  heroForeground,
  heroForegroundMuted,
  heroGradient,
  motionInitialWhenEnabled,
  scaleIn,
  staggerContainer,
  surfaceCard,
} from '@/lib/design';
import { cn } from '@/lib/utils';
import { dashboardBrowseCategories } from '@/config/dashboard-links';
import { ShortcutGrid } from '@/components/dashboard/shortcut-grid';

export default function Page() {
  const { data: session, status } = useSession();
  const t = useTranslations('dashboard');
  const tContribute = useTranslations('contribute');
  const [greeting, setGreeting] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

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

  return (
    <div className="space-y-8">
      {/* ── Hero ── */}
      <motion.div
        initial={motionInitialWhenEnabled(reduceMotion)}
        animate={reduceMotion ? false : 'show'}
        variants={staggerContainer}
        className={cn('relative overflow-hidden', surfaceCard, 'p-8 md:p-10')}
      >
        <div className={cn('absolute inset-0', heroGradient)} />

        <motion.div variants={fadeInUp} className="relative z-10 space-y-3">
          <h1
            className={cn(
              'font-serif text-3xl font-bold leading-tight md:text-4xl',
              heroForeground,
            )}
          >
            {heading}
          </h1>
          <p
            className={cn(
              'max-w-2xl text-base leading-relaxed md:text-lg',
              heroForegroundMuted,
            )}
          >
            {isAuthenticated ? t('heroSubtitle') : t('heroSubtitleAnonymous')}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              size="lg"
              asChild
              className="rounded-full bg-hero-foreground font-semibold text-hero-from shadow-sm hover:bg-hero-foreground/90"
            >
              <Link href="/contribute">
                <IconPlus className="mr-2 size-4" />
                {tContribute('newContribution')}
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              asChild
              className="rounded-full border-hero-foreground/40 bg-hero-foreground/10 font-semibold text-hero-foreground hover:bg-hero-foreground/20 hover:text-hero-foreground"
            >
              <Link href="/graphview">
                <IconGraph className="mr-2 size-4" />
                {t('exploreGraph')}
                <IconArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              asChild
              className="rounded-full border-hero-foreground/40 bg-hero-foreground/10 font-semibold text-hero-foreground hover:bg-hero-foreground/20 hover:text-hero-foreground"
            >
              <Link href="/methods">
                <IconFlask className="mr-2 size-4" />
                {t('methodsAndData')}
              </Link>
            </Button>
          </div>
        </motion.div>
      </motion.div>

      {/* ── Corpus state ── what is actually in the graph right now. Public,
           so a signed-out reader (or a reviewer without an account) sees real
           figures rather than a wall of navigation tiles. ── */}
      <motion.section
        initial={motionInitialWhenEnabled(reduceMotion)}
        whileInView={reduceMotion ? undefined : 'show'}
        viewport={reduceMotion ? undefined : { once: true, amount: 0.2 }}
        variants={staggerContainer}
      >
        <motion.h2
          variants={fadeInUp}
          className="mb-6 font-serif text-2xl font-semibold text-foreground"
        >
          {t('corpusOverview')}
        </motion.h2>
        <CorpusSummary />
      </motion.section>

      {/* ── Personal state ── only rendered when there is a person. Rendering
           the heading with an empty body below it (the previous behaviour for
           signed-out visitors) reads as a broken page. ── */}
      {isAuthenticated ?
        <>
          <motion.section
            initial={motionInitialWhenEnabled(reduceMotion)}
            whileInView={reduceMotion ? undefined : 'show'}
            viewport={reduceMotion ? undefined : { once: true, amount: 0.2 }}
            variants={staggerContainer}
          >
            <motion.h2
              variants={fadeInUp}
              className="mb-6 font-serif text-2xl font-semibold text-foreground"
            >
              {t('yourOverview')}
            </motion.h2>
            <SectionCards />
          </motion.section>

          <motion.section
            initial={motionInitialWhenEnabled(reduceMotion)}
            whileInView={reduceMotion ? undefined : 'show'}
            viewport={reduceMotion ? undefined : { once: true, amount: 0.2 }}
            variants={staggerContainer}
          >
            <motion.h2
              variants={fadeInUp}
              className="mb-6 font-serif text-2xl font-semibold text-foreground"
            >
              {t('yourProgress')}
            </motion.h2>
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
        initial={motionInitialWhenEnabled(reduceMotion)}
        whileInView={reduceMotion ? undefined : 'show'}
        viewport={reduceMotion ? undefined : { once: true, amount: 0.3 }}
        variants={staggerContainer}
      >
        <motion.h2
          variants={fadeInUp}
          className="mb-6 font-serif text-2xl font-semibold text-foreground"
        >
          {t('browseByCategory')}
        </motion.h2>
        <ShortcutGrid
          items={dashboardBrowseCategories}
          variant="compact"
          columns={{
            base: 'grid-cols-2',
            sm: 'sm:grid-cols-3',
            lg: 'lg:grid-cols-5',
          }}
        />
        <div className="mt-3">
          <Link
            href="/knowledge/entity"
            className="text-sm font-medium text-primary underline underline-offset-4 hover:no-underline"
          >
            {t('viewAllCategories')}
          </Link>
        </div>
      </motion.section>
    </div>
  );
}
