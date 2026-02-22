'use client';

import { motion } from 'framer-motion';
import { DataTable } from '@/components/data-table';
// import { SectionCards } from '@/app/dashboard/components/section-cards';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Leaderboard } from './components/leaderboard-card';
import { Button } from '@/components/ui/button';
import { BookOpen, Users, Globe, Star } from 'lucide-react';
import data from './data.json';

// Shared glassmorphic card class
const glassCard =
  'bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-blue-200 dark:border-gray-700 rounded-2xl shadow-lg';

// Animation variants (matching landing page)
const fadeInUp = {
  hidden: { opacity: 0, y: 60 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.42, 0, 0.58, 1] },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.3 },
  },
};

const scaleIn = {
  hidden: { scale: 0.8, opacity: 0 },
  show: {
    scale: 1,
    opacity: 1,
    transition: { duration: 0.6, ease: [0.6, -0.05, 0.01, 0.99] },
  },
};

const quickLinks = [
  {
    icon: BookOpen,
    title: 'Documentation',
    description: 'Learn how the platform works.',
    gradient: 'from-blue-500 to-sky-600',
    buttonLabel: 'Read Docs',
  },
  {
    icon: Users,
    title: 'Contribute',
    description: 'Help preserve cultural heritage.',
    gradient: 'from-blue-400 to-sky-500',
    buttonLabel: 'Get Involved',
  },
  {
    icon: Globe,
    title: 'Participate',
    description: 'Join activities and initiatives.',
    gradient: 'from-sky-400 to-blue-500',
    buttonLabel: 'Join Now',
  },
];

export default function Page() {
  return (
    <div className="px-4 lg:px-6 space-y-6">
      {/* Hero / Welcome Card */}
      <motion.div initial="hidden" animate="show" variants={fadeInUp}>
        <div className={`relative p-6 ${glassCard} overflow-hidden`}>
          {/* Subtle gradient orb */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-300/20 to-sky-400/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative space-y-3">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-blue-200 dark:border-gray-600 rounded-full text-sm text-blue-700 dark:text-blue-400">
              <Star className="w-4 h-4 text-blue-500" />
              Preserving Cultural Heritage Through AI
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">
              Welcome to HeritageGraph
            </h1>

            {/* Description */}
            <p className="text-base text-blue-700 dark:text-blue-300">
              Explore, preserve, and contribute to the rich cultural heritage through our
              knowledge graph platform.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Quick-link cards */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={staggerContainer}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {quickLinks.map((link) => (
          <motion.div key={link.title} variants={scaleIn} className="group relative">
            <div className={`relative flex flex-col gap-3 p-5 ${glassCard} hover:shadow-xl transition-all duration-500 hover:scale-[1.02] overflow-hidden`}>
              {/* Gradient overlay on hover */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${link.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`}
              />

              {/* Gradient icon container */}
              <div
                className={`inline-flex p-3 rounded-2xl bg-gradient-to-br ${link.gradient} shadow-lg w-fit`}
              >
                <link.icon className="w-6 h-6 text-white" />
              </div>

              {/* Text */}
              <div>
                <span className="block font-semibold text-blue-900 dark:text-blue-100 group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-sky-500 group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300">
                  {link.title}
                </span>
                <span className="block text-sm text-blue-700 dark:text-blue-400 mt-0.5">
                  {link.description}
                </span>
              </div>

              <Button
                size="sm"
                className="w-full bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white rounded-full transition-all duration-300"
              >
                {link.buttonLabel}
              </Button>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* SectionCards & Leaderboard */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* <SectionCards /> */}
        {/* <Leaderboard /> */}
      </div>

      {/* DataTable section */}
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.1 }}
        variants={fadeInUp}
        className="space-y-3"
      >
        <h2 className="text-lg font-semibold bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">
          Heritage Entries
        </h2>
        <div className={`${glassCard} overflow-hidden`}>
          <DataTable data={data} />
        </div>
      </motion.div>
    </div>
  );
}
