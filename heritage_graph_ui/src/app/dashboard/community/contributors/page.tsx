'use client';

import { DataTable } from '@/components/heritage-table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Leaderboard } from '../../components/leaderboard-card';
import { motion } from 'framer-motion';
import { IconSparkles } from '@tabler/icons-react';

const fadeInUp = { hidden: { opacity: 0, y: 60 }, show: { opacity: 1, y: 0, transition: { duration: 0.8 } } };
const staggerContainer = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.3 } } };
const glassCard = 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-blue-200 dark:border-gray-700 rounded-2xl shadow-lg';

export default function ContributorsPage() {
  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <motion.div initial="hidden" animate="show" variants={staggerContainer} className={`relative overflow-hidden ${glassCard} p-8`}>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-500 opacity-95 rounded-2xl" />
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <motion.div variants={fadeInUp} className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-sm font-medium text-white">
            <IconSparkles className="w-4 h-4" /> Community
          </div>
          <h1 className="text-3xl font-black text-white">
            Our <span className="bg-gradient-to-r from-white via-blue-100 to-sky-100 bg-clip-text text-transparent">Contributors</span>
          </h1>
          <p className="text-blue-100 max-w-lg">
            HeritageGraph depends on its community to explore, preserve, and contribute to cultural knowledge. Anyone can join and start contributing.
          </p>
        </motion.div>
      </motion.div>

      {/* Leaderboards */}
      <motion.div initial="hidden" animate="show" variants={staggerContainer} className="flex flex-col md:flex-row gap-4">
        <motion.div variants={fadeInUp} className="flex-1"><Leaderboard type="Curation" /></motion.div>
        <motion.div variants={fadeInUp} className="flex-1"><Leaderboard type="Revisions" /></motion.div>
        <motion.div variants={fadeInUp} className="flex-1"><Leaderboard type="Moderation" /></motion.div>
      </motion.div>

      {/* Data Table */}
      <motion.div initial="hidden" animate="show" variants={fadeInUp}>
        <div className={`${glassCard} overflow-hidden`}>
          <div className="p-6 border-b border-blue-200 dark:border-gray-700">
            <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">
              All Contributors
            </h2>
          </div>
          <div className="p-6">
            <DataTable />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
