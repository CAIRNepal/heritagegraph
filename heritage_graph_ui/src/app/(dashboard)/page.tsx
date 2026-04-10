'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import {
  ProgressionWidgetFull,
  LeaderboardPreview,
  MotivationCard,
} from '@/components/progression-widgets';
import { SectionCards } from '@/app/(dashboard)/components/section-cards';
import {
  IconPlus,
  IconArrowRight,
  IconSparkles,
  IconGraph,
} from '@tabler/icons-react';
import { fadeInUp, staggerContainer, scaleIn, glassCard } from '@/lib/design';
import {
  dashboardBrowseCategories,
  dashboardCurationShortcuts,
  dashboardQuickActions,
} from '@/config/dashboard-links';
import { ShortcutGrid } from '@/components/dashboard/shortcut-grid';

export default function Page() {
  const { data: session } = useSession();
  const [greeting, setGreeting] = useState('Welcome');
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting('Good morning');
    else if (h < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const userName = session?.user?.name?.split(' ')[0] || 'there';

  return (
    <div className="space-y-8">
      {/* ── Hero Welcome (glassmorphic + gradient, matches landing hero) ── */}
      <motion.div
        initial={reduceMotion ? false : 'hidden'}
        animate={reduceMotion ? false : 'show'}
        variants={staggerContainer}
        className={`relative overflow-hidden ${glassCard} p-8 md:p-10`}
      >
        {/* Gradient overlay like landing page sections */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-500 opacity-95 rounded-2xl" />
        {/* Decorative orb (keep subtle; avoid visual noise) */}
        <div className="absolute -top-12 -right-14 w-56 h-56 bg-white/10 rounded-full blur-3xl" />

        <motion.div variants={fadeInUp} className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-sm font-medium text-white">
            <IconSparkles className="w-4 h-4" />
            Heritage Graph Dashboard
          </div>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight text-white">
            {greeting},{' '}
            <span className="bg-gradient-to-r from-white via-blue-100 to-sky-100 bg-clip-text text-transparent">
              {userName}!
            </span>
          </h1>
          <p className="text-blue-100 max-w-2xl text-base md:text-lg leading-relaxed">
            Your workspace for contributing, reviewing, and exploring cultural heritage data.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/contribute">
              <Button
                size="lg"
                className="bg-white text-blue-700 hover:bg-blue-50 rounded-full font-semibold shadow-lg transition-colors duration-200"
              >
                <IconPlus className="w-4 h-4 mr-2" />
                New Contribution
              </Button>
            </Link>
            <Link href="/graphview">
              <Button
                variant="outline"
                size="lg"
                className="bg-white/10 border-white/40 text-white hover:bg-white/20 hover:text-white rounded-full font-semibold transition-all duration-300"
              >
                <IconGraph className="w-4 h-4 mr-2" />
                Explore Knowledge Graph
                <IconArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </motion.div>

      {/* ── Operational overview (state > navigation) ── */}
      <motion.div
        initial={reduceMotion ? false : 'hidden'}
        whileInView={reduceMotion ? undefined : 'show'}
        viewport={reduceMotion ? undefined : { once: true, amount: 0.2 }}
        variants={staggerContainer}
      >
        <motion.h2
          variants={fadeInUp}
          className="text-2xl font-bold mb-6 text-blue-900 dark:text-blue-100"
        >
          Your{' '}
          <span className="text-transparent bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text">
            Overview
          </span>
        </motion.h2>
        <SectionCards />
      </motion.div>

      {/* ── Quick Actions (glassmorphic cards with gradient icons, like landing "Preserve" cards) ── */}
      <motion.div
        initial={reduceMotion ? false : 'hidden'}
        animate={reduceMotion ? false : 'show'}
        variants={staggerContainer}
      >
        <motion.h2
          variants={fadeInUp}
          className="text-2xl font-bold mb-6 text-blue-900 dark:text-blue-100"
        >
          Quick{' '}
          <span className="text-transparent bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text">
            Actions
          </span>
        </motion.h2>
        <ShortcutGrid items={dashboardQuickActions} variant="detailed" />
      </motion.div>

      {/* ── Your Progress & Leaderboard (side by side on desktop) ── */}
      <motion.div
        initial={reduceMotion ? false : 'hidden'}
        whileInView={reduceMotion ? undefined : 'show'}
        viewport={reduceMotion ? undefined : { once: true, amount: 0.2 }}
        variants={staggerContainer}
      >
        <motion.h2
          variants={fadeInUp}
          className="text-2xl font-bold mb-6 text-blue-900 dark:text-blue-100"
        >
          Your{' '}
          <span className="text-transparent bg-gradient-to-r from-amber-500 to-yellow-500 bg-clip-text">
            Progress
          </span>
        </motion.h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div variants={scaleIn} className="lg:col-span-2">
            <ProgressionWidgetFull />
          </motion.div>
          <motion.div variants={scaleIn} className="space-y-6">
            <LeaderboardPreview />
            <MotivationCard />
          </motion.div>
        </div>
      </motion.div>

      {/* ── Browse by Category (glassmorphic grid with gradient icons) ── */}
      <motion.div
        initial={reduceMotion ? false : 'hidden'}
        whileInView={reduceMotion ? undefined : 'show'}
        viewport={reduceMotion ? undefined : { once: true, amount: 0.3 }}
        variants={staggerContainer}
      >
        <motion.h2
          variants={fadeInUp}
          className="text-2xl font-bold mb-6 text-blue-900 dark:text-blue-100"
        >
          Browse by{' '}
          <span className="text-transparent bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text">
            Category
          </span>
        </motion.h2>
        <ShortcutGrid
          items={dashboardBrowseCategories}
          variant="compact"
          columns={{
            base: "grid-cols-2",
            sm: "sm:grid-cols-3",
            lg: "lg:grid-cols-5",
          }}
        />
        <div className="mt-3">
          <Link
            href="/knowledge/entity"
            className="text-sm font-medium text-blue-700/80 hover:text-blue-800 dark:text-blue-200/70 dark:hover:text-blue-200 underline underline-offset-4"
          >
            View all categories in the sidebar
          </Link>
        </div>
      </motion.div>

      {/* ── Curation Shortcuts (glassmorphic, matches landing About/Team cards) ── */}
      <motion.div
        initial={reduceMotion ? false : 'hidden'}
        whileInView={reduceMotion ? undefined : 'show'}
        viewport={reduceMotion ? undefined : { once: true, amount: 0.3 }}
        variants={staggerContainer}
      >
        <motion.h2
          variants={fadeInUp}
          className="text-2xl font-bold mb-6 text-blue-900 dark:text-blue-100"
        >
          Curation &{' '}
          <span className="text-transparent bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text">
            Review
          </span>
        </motion.h2>
        <ShortcutGrid
          items={dashboardCurationShortcuts}
          variant="detailed"
          columns={{ base: "grid-cols-1", md: "md:grid-cols-3" }}
        />
      </motion.div>

      {/* ── Heritage Data Table (glassmorphic container) ── */}
      {/* <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.1 }}
        variants={fadeInUp}
      >
        <h2 className="text-2xl font-bold mb-6 text-blue-900 dark:text-blue-100">
          Heritage{' '}
          <span className="text-transparent bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text">
            Entries
          </span>
        </h2>
        <div className={`${glassCard} p-6`}>
          <GenericDataTable
            config={{
              ...personTableConfig,
              showTabs: false,
              enableDragDrop: false,
              showHeader: false,
            }}
          />
        </div>
      </motion.div> */}
    </div>
  );
}
