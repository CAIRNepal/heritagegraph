'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BellIcon, CheckCheck } from 'lucide-react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { motion } from 'framer-motion';
import { useNotifications, type Notification } from '@/hooks/use-notifications';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

/** Max notifications per page (must match `limit` sent in `useNotifications.fetchPage`). */
const PAGE_SIZE = 10;

/** Page numbers (and ellipses) for compact numbered pagination controls. */
function visiblePageItems(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 1) return [];
  const range: number[] = [];
  const delta = 1;
  let last: number | undefined;
  const items: (number | 'ellipsis')[] = [];

  for (let i = 1; i <= total; i++) {
    if (
      i === 1 ||
      i === total ||
      (i >= current - delta && i <= current + delta)
    ) {
      range.push(i);
    }
  }

  for (const i of range) {
    if (last !== undefined) {
      if (i - last === 2) {
        items.push(last + 1);
      } else if (i - last > 1) {
        items.push('ellipsis');
      }
    }
    items.push(i);
    last = i;
  }
  return items;
}

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

const actorGradients: Record<string, string> = {
  submission_update: 'from-blue-500 to-sky-500',
  comment: 'from-purple-500 to-violet-500',
  moderation: 'from-amber-500 to-yellow-500',
  review_decision: 'from-green-500 to-emerald-500',
  revision: 'from-cyan-500 to-teal-500',
  reaction: 'from-pink-500 to-rose-500',
  fork: 'from-orange-500 to-amber-500',
  general: 'from-gray-500 to-slate-500',
  suggestion_review: 'from-teal-500 to-cyan-500',
};

function resolveNotificationLink(n: Notification): string {
  if (n.link && n.link.startsWith('/')) return n.link;
  if (n.entity_id) return `/knowledge/entity/view/${n.entity_id}`;
  return '';
}

function getActorInitials(n: Notification): string {
  if (n.actor_display_name) {
    const parts = n.actor_display_name.split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0]?.slice(0, 2).toUpperCase() || '?';
  }
  if (n.actor_username) return n.actor_username.slice(0, 2).toUpperCase();
  return '?';
}

function getApiFilters(filter: string): Record<string, string> {
  if (filter === 'unread') return { is_read: 'false' };
  if (filter !== 'all') return { notification_type: filter };
  return {};
}

export default function NotificationPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const {
    notifications,
    unreadCount,
    totalCount,
    loading,
    fetchPage,
    markAsRead,
    markAllAsRead,
  } = useNotifications({ pageSize: PAGE_SIZE, autoFetch: false });

  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<string>('all');

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pageItems = useMemo(
    () => visiblePageItems(page, pageCount),
    [page, pageCount],
  );

  useEffect(() => {
    if (!session) return;
    void fetchPage(page, getApiFilters(filter));
  }, [session, page, filter, fetchPage]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const handleFilterChange = (f: string) => {
    setFilter(f);
    setPage(1);
  };

  const handleNotificationClick = (n: Notification) => {
    if (!n.is_read) markAsRead([n.notification_id]);
    const link = resolveNotificationLink(n);
    if (link) router.push(link);
  };

  const handleActorClick = (e: React.MouseEvent, n: Notification) => {
    e.stopPropagation();
    if (n.actor_username) router.push(`/users/${n.actor_username}`);
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    fetchPage(page, getApiFilters(filter));
  };

  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Hero Header */}
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
              Notifi<span className="text-white/90">cations</span>
            </h1>
            <p className="text-blue-100 max-w-lg text-base">Stay updated with submissions, reviews, and platform activity.</p>
          </div>
          <div className="hidden md:block">
            <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/30">
              <BellIcon className="w-10 h-10 text-white" />
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Filter & Actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {['all', 'unread', 'submission_update', 'comment', 'review_decision', 'reaction', 'fork'].map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilterChange(f)}
              className="capitalize text-xs"
            >
              {f === 'all' ? 'All' : f === 'unread' ? 'Unread' : typeLabels[f] || f}
            </Button>
          ))}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="gap-1.5">
            <CheckCheck className="w-3.5 h-3.5" /> Mark all read
          </Button>
        )}
      </div>

      {/* Notifications List */}
      <motion.div initial="initial" animate="animate" variants={staggerContainer} className={`${glassCard} p-6`}>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-xl font-bold text-blue-900 dark:text-blue-100">
            Recent <span className="text-foreground">Notifications</span>
          </h2>
          <span className="text-sm text-muted-foreground">
            {totalCount > 0 ? `${start}–${end} of ${totalCount}` : `${totalCount} total`}
            {filter !== 'all' && `, filtered by ${filter === 'unread' ? 'unread' : typeLabels[filter] || filter}`}
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <BellIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No notifications found</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {notifications.map((n) => {
              const badgeClass = typeBadgeColors[n.notification_type] || typeBadgeColors.general;
              const label = typeLabels[n.notification_type] || n.notification_type;
              const timeAgo = formatDistanceToNow(new Date(n.created_at), { addSuffix: true });
              const gradient = actorGradients[n.notification_type] || actorGradients.general;
              const hasActor = !!n.actor_username;

              return (
                <motion.li key={n.notification_id} variants={scaleIn}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    'flex gap-4 items-start border-b last:border-0 border-blue-100 dark:border-gray-700 pb-4 group rounded-xl p-3 -m-1 transition-all duration-300 cursor-pointer',
                    n.is_read ? 'opacity-60 hover:opacity-80' : 'bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100/50 dark:hover:bg-blue-900/30',
                  )}
                >
                  <button
                    onClick={(e) => handleActorClick(e, n)}
                    className={cn('mt-0.5 flex-shrink-0', hasActor && 'hover:ring-2 hover:ring-blue-400 rounded-full transition-all')}
                    disabled={!hasActor}
                    title={hasActor ? `View ${n.actor_display_name || n.actor_username}'s profile` : undefined}
                  >
                    <Avatar className="border-2 border-blue-200 dark:border-gray-600 h-10 w-10">
                      <AvatarFallback className={`bg-gradient-to-br ${gradient} text-white text-xs font-bold`}>
                        {hasActor ? getActorInitials(n) : <BellIcon className="w-4 h-4" />}
                      </AvatarFallback>
                    </Avatar>
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {hasActor && (
                        <button
                          onClick={(e) => handleActorClick(e, n)}
                          className="text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline truncate"
                        >
                          {n.actor_display_name || n.actor_username}
                        </button>
                      )}
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-auto flex-shrink-0">{timeAgo}</span>
                      {!n.is_read && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                    </div>

                    <p className="text-sm font-medium leading-snug text-blue-900 dark:text-blue-100 line-clamp-2">
                      {n.message}
                    </p>

                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge variant="secondary" className={`text-[10px] ${badgeClass}`}>{label}</Badge>
                      {n.entity_name && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={n.entity_name}>
                          {n.entity_name}
                        </span>
                      )}
                      {n.entity_category && (
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {n.entity_category}
                        </Badge>
                      )}
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        )}

        {pageCount > 1 && (
          <Pagination className="mt-6 flex flex-wrap justify-center gap-y-2">
            <PaginationContent className="flex-wrap justify-center">
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setPage((p) => Math.max(1, p - 1));
                  }}
                  aria-disabled={page === 1}
                  className={cn(page === 1 && 'pointer-events-none opacity-50')}
                />
              </PaginationItem>
              {pageItems.map((item, idx) =>
                item === 'ellipsis' ? (
                  <PaginationItem key={`e-${idx}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={item}>
                    <PaginationLink
                      href="#"
                      size="icon"
                      isActive={page === item}
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(item);
                      }}
                    >
                      {item}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setPage((p) => Math.min(pageCount, p + 1));
                  }}
                  aria-disabled={page === pageCount}
                  className={cn(page === pageCount && 'pointer-events-none opacity-50')}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </motion.div>
    </div>
  );
}
