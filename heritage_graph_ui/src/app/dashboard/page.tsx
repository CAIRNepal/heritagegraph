'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import {
  GenericDataTable,
  personTableConfig,
} from '@/components/generic-data-table';
import {
  ProgressionWidgetFull,
  LeaderboardPreview,
  MotivationCard,
} from '@/components/progression-widgets';
import {
  IconPlus,
  IconBuildingCommunity,
  IconUser,
  IconMapPin,
  IconCalendarEvent,
  IconFlame,
  IconChartBar,
  IconShield,
  IconFileDescription,
  IconTrophy,
  IconArrowRight,
  IconSparkles,
  IconBooks,
  IconUsers,
  IconGraph,
  IconMedal,
} from '@tabler/icons-react';

/* ── animation variants (identical to landing page) ── */
const fadeInUp = {
  hidden: { opacity: 0, y: 60 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.3 } },
};

const scaleIn = {
  hidden: { scale: 0.8, opacity: 0 },
  show: { scale: 1, opacity: 1, transition: { duration: 0.6 } },
};

/* ── shared glassmorphic card style (matches landing page cards) ── */
const glassCard =
  'bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-blue-200 dark:border-gray-700 rounded-2xl shadow-lg';

/* ── quick-action data ── */
const quickActions = [
  {
    title: 'Knowledge Graph',
    desc: 'Explore the ontology graph visualization.',
    icon: IconGraph,
    href: '/dashboard/graphview',
    gradient: 'from-violet-500 to-blue-500',
  },
  {
    title: 'New Contribution',
    desc: 'Submit a cultural heritage entry.',
    icon: IconPlus,
    href: '/dashboard/contribute',
    gradient: 'from-blue-500 to-sky-500',
  },
  {
    title: 'Knowledge Base',
    desc: 'Browse cultural entities & records.',
    icon: IconBooks,
    href: '/dashboard/knowledge/entity',
    gradient: 'from-blue-600 to-cyan-500',
  },
  {
    title: 'Progression',
    desc: 'Track your ranks, seals & achievements.',
    icon: IconMedal,
    href: '/dashboard/progression',
    gradient: 'from-amber-500 to-yellow-500',
  },
];

/* ── knowledgebase shortcuts ── */
const kbShortcuts = [
  { title: 'Cultural Entity', icon: IconBuildingCommunity, href: '/dashboard/knowledge/entity', gradient: 'from-blue-400 to-sky-500' },
  { title: 'Person', icon: IconUser, href: '/dashboard/knowledge/person', gradient: 'from-blue-500 to-cyan-500' },
  { title: 'Location', icon: IconMapPin, href: '/dashboard/knowledge/location', gradient: 'from-sky-400 to-blue-500' },
  { title: 'Event', icon: IconCalendarEvent, href: '/dashboard/knowledge/event', gradient: 'from-blue-600 to-sky-600' },
  { title: 'Tradition', icon: IconFlame, href: '/dashboard/knowledge/tradition', gradient: 'from-blue-400 to-cyan-500' },
  { title: 'Contributors', icon: IconUsers, href: '/dashboard/community/contributors', gradient: 'from-sky-500 to-blue-600' },
];

export default function Page() {
  const { data: session } = useSession();
  const [greeting, setGreeting] = useState('Welcome');

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting('Good morning');
    else if (h < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  useEffect(() => {
    if (!session?.accessToken) return;

    const fetchBackend = async () => {
      try {
        const res = await fetch('http://localhost:8000/data/testthelogin/', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            Accept: 'application/json',
          },
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.detail || 'Failed to fetch data');
        }
        const data = await res.json();
        console.log('Data: ', data);
      } catch (_err: any) {
        console.error('Error fetching backend data:', _err.message);
      }
    };
    fetchBackend();
  }, [session]);

  const userName = session?.user?.name?.split(' ')[0] || 'there';

  return (
    <div className="space-y-8">
      {/* ── Hero Welcome (glassmorphic + gradient, matches landing hero) ── */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={staggerContainer}
        className={`relative overflow-hidden ${glassCard} p-8 md:p-10`}
      >
        {/* Gradient overlay like landing page sections */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-500 opacity-95 rounded-2xl" />
        {/* Decorative orbs (like landing GradientOrbs) */}
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-sky-300/20 rounded-full blur-2xl animate-pulse" />

        <motion.div variants={fadeInUp} className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-sm font-medium text-white">
            <IconSparkles className="w-4 h-4" />
            Heritage Graph Dashboard
          </div>
          <h1 className="text-3xl md:text-4xl font-black leading-tight text-white">
            {greeting},{' '}
            <span className="bg-gradient-to-r from-white via-blue-100 to-sky-100 bg-clip-text text-transparent">
              {userName}!
            </span>
          </h1>
          <p className="text-blue-100 max-w-xl text-base md:text-lg leading-relaxed">
            Preserving cultural heritage through AI and Knowledge Graphs — contribute,
            curate, and explore Nepal&apos;s rich heritage.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/dashboard/contribute">
              <Button
                size="lg"
                className="bg-white text-blue-700 hover:bg-blue-50 rounded-full font-semibold shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                <IconPlus className="w-4 h-4 mr-2" />
                New Contribution
              </Button>
            </Link>
            <Link href="/dashboard/graphview">
              <Button
                variant="outline"
                size="lg"
                className="border-white/40 text-white hover:bg-white/20 rounded-full font-semibold transition-all duration-300"
              >
                <IconGraph className="w-4 h-4 mr-2" />
                Explore Knowledge Graph
                <IconArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </motion.div>

      {/* ── Quick Actions (glassmorphic cards with gradient icons, like landing "Preserve" cards) ── */}
      <motion.div
        initial="hidden"
        animate="show"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickActions.map((action) => (
            <motion.div key={action.title} variants={scaleIn} className="group relative">
              <Link href={action.href}>
                <div className={`relative p-6 ${glassCard} hover:bg-white dark:hover:bg-gray-900 transition-all duration-500 transform hover:scale-[1.02] overflow-hidden hover:shadow-xl cursor-pointer`}>
                  {/* Gradient overlay on hover (same as landing cards) */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-2xl`}
                  />
                  <div
                    className={`inline-flex p-3 rounded-2xl bg-gradient-to-br ${action.gradient} mb-4 shadow-lg`}
                  >
                    <action.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold mb-2 text-blue-900 dark:text-blue-100 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-sky-500 group-hover:bg-clip-text transition-all duration-300">
                    {action.title}
                  </h3>
                  <p className="text-blue-700 dark:text-blue-300 text-sm leading-relaxed">{action.desc}</p>
                  <IconArrowRight className="w-4 h-4 text-blue-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all duration-300 mt-3" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Your Progress & Leaderboard (side by side on desktop) ── */}
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
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
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {kbShortcuts.map((item) => (
            <motion.div key={item.title} variants={scaleIn} className="group relative">
              <Link href={item.href}>
                <div className={`relative text-center p-5 ${glassCard} hover:bg-white dark:hover:bg-gray-900 transition-all duration-500 transform hover:scale-[1.03] overflow-hidden hover:shadow-xl cursor-pointer`}>
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-2xl`}
                  />
                  <div
                    className={`inline-flex p-3 rounded-2xl bg-gradient-to-br ${item.gradient} mb-3 shadow-md mx-auto`}
                  >
                    <item.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="block text-xs font-semibold text-blue-800 dark:text-blue-200 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-sky-500 group-hover:bg-clip-text transition-all duration-300">
                    {item.title}
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Curation Shortcuts (glassmorphic, matches landing About/Team cards) ── */}
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: 'Contributions Queue',
              desc: 'Pending community submissions awaiting review.',
              icon: IconFileDescription,
              href: '/dashboard/curation/contributions',
              gradient: 'from-blue-400 to-sky-500',
            },
            {
              title: 'Activity Log',
              desc: 'Track recent changes and platform activity.',
              icon: IconChartBar,
              href: '/dashboard/curation/activity',
              gradient: 'from-blue-500 to-cyan-500',
            },
            {
              title: 'Reviewer Dashboard',
              desc: 'Your review stats, decisions, and metrics.',
              icon: IconShield,
              href: '/dashboard/curation/dashboard',
              gradient: 'from-sky-500 to-blue-600',
            },
          ].map((item) => (
            <motion.div key={item.title} variants={scaleIn} className="group relative">
              <Link href={item.href}>
                <div className={`relative p-6 ${glassCard} hover:bg-white dark:hover:bg-gray-900 transition-all duration-500 transform hover:scale-[1.02] overflow-hidden hover:shadow-xl cursor-pointer h-full`}>
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-2xl`}
                  />
                  <div className="flex items-start gap-4">
                    <div
                      className={`inline-flex p-3 rounded-2xl bg-gradient-to-br ${item.gradient} shadow-lg shrink-0`}
                    >
                      <item.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <h3 className="font-bold text-blue-900 dark:text-blue-100 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-sky-500 group-hover:bg-clip-text transition-all duration-300">
                        {item.title}
                      </h3>
                      <p className="text-blue-700 dark:text-blue-300 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Heritage Data Table (glassmorphic container) ── */}
      <motion.div
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
      </motion.div>
    </div>
  );
}
