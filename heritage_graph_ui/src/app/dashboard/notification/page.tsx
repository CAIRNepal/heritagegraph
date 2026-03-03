'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BellIcon, CheckCheck, Trash2 } from 'lucide-react';
import {
  Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination';
import { motion } from 'framer-motion';
import { useNotifications, type Notification } from '@/hooks/use-notifications';
import { formatDistanceToNow } from 'date-fns';

// Animation variants - use transforms only to avoid visibility issues
const fadeInUp = { 
  initial: { opacity: 1, y: 10 }, 
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } } 
};
const staggerContainer = { 
  initial: { opacity: 1 }, 
  animate: { opacity: 1, transition: { staggerChildren: 0.05 } } 
};
const scaleIn = { 
  initial: { scale: 0.98, opacity: 1 }, 
  animate: { scale: 1, opacity: 1, transition: { duration: 0.2 } } 
};
const glassCard = 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-blue-200 dark:border-gray-700 rounded-2xl shadow-lg';

const PAGE_SIZE = 10;

const typeBadgeColors: Record<string, string> = {
  submission_update: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  comment: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  moderation: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  review_decision: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  revision: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  reaction: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
  fork: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  general: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  suggestion_review: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
};

const typeLabels: Record<string, string> = {
  submission_update: 'Submission',
  comment: 'Comment',
  moderation: 'Moderation',
  review_decision: 'Decision',
  revision: 'Revision',
  reaction: 'Reaction',
  fork: 'Fork',
  general: 'General',
  suggestion_review: 'Suggestion',
};

export default function NotificationPage() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all'
    ? notifications
    : filter === 'unread'
      ? notifications.filter((n) => !n.is_read)
      : notifications.filter((n) => n.notification_type === filter);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const start = (page - 1) * PAGE_SIZE;
  const currentPageItems = filtered.slice(start, start + PAGE_SIZE);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead([notification.notification_id]);
    }
    if (notification.link) {
      router.push(notification.link);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* ── Hero Header ── */}
      <motion.div initial="initial" animate="animate" variants={staggerContainer} className={`relative overflow-hidden ${glassCard} p-8 md:p-10`}>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-500 opacity-95 rounded-2xl" />
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <motion.div variants={fadeInUp} className="relative z-10 flex items-center justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-sm font-medium text-white">
              <BellIcon className="w-4 h-4" /> {unreadCount} unread
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

      {/* ── Filter & Actions ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {['all', 'unread', 'submission_update', 'comment', 'review_decision', 'reaction', 'fork'].map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setFilter(f); setPage(1); }}
              className="capitalize text-xs"
            >
              {f === 'all' ? 'All' : f === 'unread' ? 'Unread' : typeLabels[f] || f}
            </Button>
          ))}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllAsRead()} className="gap-1.5">
            <CheckCheck className="w-3.5 h-3.5" /> Mark all read
          </Button>
        )}
      </div>

      {/* ── Notifications List ── */}
      <motion.div initial="initial" animate="animate" variants={staggerContainer} className={`${glassCard} p-6`}>
        <h2 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-4">
          Recent <span className="text-transparent bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text">Notifications</span>
          <span className="text-sm font-normal text-muted-foreground ml-2">
            ({filtered.length} total{filter !== 'all' ? `, filtered by ${filter === 'unread' ? 'unread' : typeLabels[filter] || filter}` : ''})
          </span>
        </h2>

        {loading && notifications.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">Loading notifications...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <BellIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No notifications yet</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[600px]">
            <ul className="space-y-3">
              {currentPageItems.map((n) => {
                const badgeClass = typeBadgeColors[n.notification_type] || typeBadgeColors.general;
                const label = typeLabels[n.notification_type] || n.notification_type;
                const timeAgo = formatDistanceToNow(new Date(n.created_at), { addSuffix: true });

                return (
                  <motion.li key={n.notification_id} variants={scaleIn}
                    onClick={() => handleNotificationClick(n)}
                    className={`flex gap-4 items-start border-b last:border-0 border-blue-100 dark:border-gray-700 pb-4 group rounded-xl p-3 -m-1 transition-all duration-300 cursor-pointer ${
                      n.is_read ? 'opacity-60 hover:opacity-80' : 'bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100/50 dark:hover:bg-blue-900/30'
                    }`}
                  >
                    <Avatar className="mt-1 border-2 border-blue-200 dark:border-gray-600">
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-sky-500 text-white">
                        <BellIcon className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium leading-tight text-blue-900 dark:text-blue-100 line-clamp-2">
                          {n.message}
                        </p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!n.is_read && (
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                          )}
                          <span className="text-xs text-blue-500 dark:text-blue-400 whitespace-nowrap">{timeAgo}</span>
                        </div>
                      </div>
                      {n.entity_name && (
                        <p className="text-xs text-muted-foreground mt-0.5">{n.entity_name}</p>
                      )}
                      <Badge variant="secondary" className={`mt-2 text-xs ${badgeClass}`}>{label}</Badge>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          </ScrollArea>
        )}

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
