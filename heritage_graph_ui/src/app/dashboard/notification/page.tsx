'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { BellIcon } from 'lucide-react';
import {
  Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination';
import { motion } from 'framer-motion';
import { IconSparkles } from '@tabler/icons-react';

const fadeInUp = { hidden: { opacity: 0, y: 60 }, show: { opacity: 1, y: 0, transition: { duration: 0.8 } } };
const staggerContainer = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.3 } } };
const scaleIn = { hidden: { scale: 0.8, opacity: 0 }, show: { scale: 1, opacity: 1, transition: { duration: 0.6 } } };
const glassCard = 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-blue-200 dark:border-gray-700 rounded-2xl shadow-lg';

const PAGE_SIZE = 2;

const typeBadgeColors: Record<string, string> = {
  form: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  rank: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  system: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  approval: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

const notifications = [
  { id: 1, title: 'New submission received', message: 'Alice just submitted a form for review.', avatar: '/cair-logo/nabin.jpeg', time: '2m ago', type: 'form' },
  { id: 2, title: 'Leaderboard updated', message: 'Charlie moved up to #3 on the leaderboard.', avatar: '/cair-logo/niraj.jpeg', time: '15m ago', type: 'rank' },
  { id: 3, title: 'System update', message: 'Maintenance scheduled for this weekend.', avatar: '', time: '1h ago', type: 'system' },
  { id: 4, title: 'Message from moderator', message: 'Your submission was approved. Great job!', avatar: '/cair-logo/nabin.jpeg', time: '3h ago', type: 'approval' },
];

export default function NotificationPage() {
  const [page, setPage] = useState(1);
  const pageCount = Math.ceil(notifications.length / PAGE_SIZE);
  const start = (page - 1) * PAGE_SIZE;
  const currentPageItems = notifications.slice(start, start + PAGE_SIZE);

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* ── Hero Header ── */}
      <motion.div initial="hidden" animate="show" variants={staggerContainer} className={`relative overflow-hidden ${glassCard} p-8 md:p-10`}>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-500 opacity-95 rounded-2xl" />
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <motion.div variants={fadeInUp} className="relative z-10 flex items-center justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-sm font-medium text-white">
              <BellIcon className="w-4 h-4" /> Updates
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white">
              Notifi<span className="bg-gradient-to-r from-white via-blue-100 to-sky-100 bg-clip-text text-transparent">cations</span>
            </h1>
            <p className="text-blue-100 max-w-lg text-base">Stay updated with submissions, reviews, and platform news.</p>
          </div>
          <div className="hidden md:block">
            <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/30">
              <BellIcon className="w-10 h-10 text-white" />
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* ── Notifications List ── */}
      <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={staggerContainer} className={`${glassCard} p-6`}>
        <h2 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-4">
          Recent <span className="text-transparent bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text">Notifications</span>
        </h2>
        <ScrollArea className="max-h-[500px]">
          <ul className="space-y-4">
            {currentPageItems.map(({ id, title, message, avatar, time, type }, idx) => (
              <motion.li key={id} variants={scaleIn}
                className="flex gap-4 items-start border-b last:border-0 border-blue-100 dark:border-gray-700 pb-4 group hover:bg-blue-50/50 dark:hover:bg-gray-800/50 rounded-xl p-3 -m-3 transition-all duration-300">
                <Avatar className="mt-1 border-2 border-blue-200 dark:border-gray-600">
                  {avatar ? (
                    <AvatarImage src={avatar} alt={title} />
                  ) : (
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-sky-500 text-white">
                      <BellIcon className="w-4 h-4" />
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium leading-tight text-blue-900 dark:text-blue-100">{title}</h3>
                    <span className="text-xs text-blue-500 dark:text-blue-400">{time}</span>
                  </div>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">{message}</p>
                  <Badge variant="secondary" className={`mt-2 text-xs ${typeBadgeColors[type] || ''}`}>{type}</Badge>
                </div>
              </motion.li>
            ))}
          </ul>
        </ScrollArea>

        {pageCount > 1 && (
          <Pagination className="mt-4">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious onClick={() => setPage((p) => Math.max(1, p - 1))} aria-disabled={page === 1} />
              </PaginationItem>
              <PaginationItem>
                <span className="text-sm px-2 text-blue-700 dark:text-blue-300">Page {page} of {pageCount}</span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext onClick={() => setPage((p) => Math.min(pageCount, p + 1))} aria-disabled={page === pageCount} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </motion.div>
    </div>
  );
}
