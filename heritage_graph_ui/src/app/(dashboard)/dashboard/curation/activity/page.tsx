'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle, XCircle, Edit, Send, MessageSquare, ArrowUpRight,
  RotateCcw, Flag, Scale, RefreshCw, ChevronDown, Calendar, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { IconSparkles } from '@tabler/icons-react';
import { fadeInUp, staggerContainer, glassCard } from '@/lib/design';

interface UserInfo { id: number; username: string; email: string; first_name: string; last_name: string; }
interface ActivityItem {
  activity_id: string; user: UserInfo; activity_type: string; comment: string | null;
  created_at: string; entity_name?: string; entity_category?: string; entity_status?: string;
}
interface APIResponse { count: number; next: string | null; previous: string | null; results: ActivityItem[]; }

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const ACTIVITY_TYPES = [
  { value: 'all', label: 'All Types' }, { value: 'submitted', label: 'Submitted' },
  { value: 'accepted', label: 'Accepted' }, { value: 'rejected', label: 'Rejected' },
  { value: 'revised', label: 'Revised' }, { value: 'commented', label: 'Commented' },
  { value: 'escalated', label: 'Escalated' }, { value: 'changes_requested', label: 'Changes Requested' },
  { value: 'flagged', label: 'Flagged' }, { value: 'conflict_resolved', label: 'Conflict Resolved' },
];

const ICON_MAP: Record<string, { icon: typeof CheckCircle; cls: string; bg: string }> = {
  submitted:         { icon: Send,          cls: 'text-sky-600',    bg: 'bg-sky-100 dark:bg-sky-900/40' },
  accepted:          { icon: CheckCircle,   cls: 'text-green-600',  bg: 'bg-green-100 dark:bg-green-900/40' },
  rejected:          { icon: XCircle,       cls: 'text-red-600',    bg: 'bg-red-100 dark:bg-red-900/40' },
  revised:           { icon: Edit,          cls: 'text-violet-600', bg: 'bg-violet-100 dark:bg-violet-900/40' },
  commented:         { icon: MessageSquare, cls: 'text-amber-600',  bg: 'bg-amber-100 dark:bg-amber-900/40' },
  escalated:         { icon: ArrowUpRight,  cls: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/40' },
  changes_requested: { icon: RotateCcw,     cls: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/40' },
  flagged:           { icon: Flag,          cls: 'text-rose-600',   bg: 'bg-rose-100 dark:bg-rose-900/40' },
  conflict_resolved: { icon: Scale,         cls: 'text-teal-600',   bg: 'bg-teal-100 dark:bg-teal-900/40' },
};

function relativeTime(d: string) {
  const secs = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fullName(u: UserInfo) { return `${u.first_name} ${u.last_name}`.trim() || u.username; }
function actionVerb(type: string) {
  const map: Record<string, string> = {
    submitted: 'submitted', accepted: 'accepted', rejected: 'rejected', revised: 'suggested revisions to',
    commented: 'commented on', escalated: 'escalated', changes_requested: 'requested changes to',
    flagged: 'flagged', conflict_resolved: 'resolved conflicts on',
  };
  return map[type] || type;
}

export default function ActivityLogPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [actType, setActType] = useState('all');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const perPage = 50;

  const headers = useCallback(() => {
    const h: HeadersInit = { 'Content-Type': 'application/json' };
    const t = (session as any)?.accessToken;
    if (t) h['Authorization'] = `Bearer ${t}`;
    return h;
  }, [session]);

  const load = useCallback(async (p = 1, append = false) => {
    if (!append) setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      sp.set('page', String(p)); sp.set('page_size', String(perPage));
      sp.set('ordering', sortDir === 'desc' ? '-created_at' : 'created_at');
      if (actType !== 'all') sp.set('activity_type', actType);
      const res = await fetch(`${API}/data/api/activities/?${sp}`, { headers: headers() });
      if (!res.ok) throw new Error(`${res.status}`);
      const data: APIResponse = await res.json();
      if (append) setActivities(prev => [...prev, ...data.results]);
      else setActivities(data.results);
      setTotal(data.count); setHasMore(!!data.next); setPage(p);
    } catch (e) { setError(e instanceof Error ? e.message : 'Load failed'); toast.error('Failed to load activity'); }
    finally { setLoading(false); }
  }, [headers, actType, sortDir]);

  useEffect(() => { load(1); }, [session, actType, sortDir]);
  const loadMore = () => load(page + 1, true);

  const grouped = activities.reduce<Record<string, ActivityItem[]>>((acc, a) => {
    const day = new Date(a.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (!acc[day]) acc[day] = [];
    acc[day].push(a);
    return acc;
  }, {});

  return (
    <>

      <div className="space-y-6">
        {/* ── Hero Header ── */}
        <motion.div initial="hidden" animate="show" variants={staggerContainer} className={`relative overflow-hidden ${glassCard} p-8`}>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-500 opacity-95 rounded-2xl" />
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <motion.div variants={fadeInUp} className="relative z-10 space-y-2">
            <p className="text-sm text-blue-200">Curation / Activity</p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-sm font-medium text-white">
              <IconSparkles className="w-4 h-4" /> Event Timeline
            </div>
            <h1 className="text-3xl font-black text-white">
              Curation Event <span className="bg-gradient-to-r from-white via-blue-100 to-sky-100 bg-clip-text text-transparent">Timeline</span>
            </h1>
            <p className="text-blue-100 max-w-2xl">
              All curation activity is logged and publicly available, establishing provenance of assertions and acknowledging the work of collaborators.
            </p>
          </motion.div>
        </motion.div>

        {/* Filter panel */}
        <motion.div initial="hidden" animate="show" variants={fadeInUp} className={`${glassCard} p-4`}>
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 flex gap-2">
              <Select value={actType} onValueChange={v => { setActType(v); setPage(1); }}>
                <SelectTrigger className="w-52 border-blue-200 dark:border-gray-600"><SelectValue placeholder="Activity Type" /></SelectTrigger>
                <SelectContent>{ACTIVITY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={sortDir} onValueChange={v => setSortDir(v as 'desc' | 'asc')}>
                <SelectTrigger className="w-40 border-blue-200 dark:border-gray-600"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Newest first</SelectItem>
                  <SelectItem value="asc">Oldest first</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9 border-blue-200 dark:border-gray-600 text-blue-600 dark:text-blue-400" onClick={() => load(1)}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>

        {/* Count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-blue-700 dark:text-blue-300">{activities.length} of {total} loaded</p>
          <Badge variant="outline" className="gap-1 border-blue-200 dark:border-gray-600 text-blue-700 dark:text-blue-300">
            <Clock className="h-3 w-3" /> Timeline
          </Badge>
        </div>

        {/* Timeline */}
        {loading && activities.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-r-transparent" />
            <p className="mt-3 text-blue-700 dark:text-blue-300">Loading activity…</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-600 mb-2">{error}</p>
            <Button onClick={() => load(1)} className="bg-gradient-to-r from-blue-600 to-sky-500 text-white">Retry</Button>
          </div>
        ) : activities.length === 0 ? (
          <div className={`${glassCard} text-center py-20 px-6`}>
            <Clock className="h-12 w-12 mx-auto mb-3 text-blue-400" />
            <h3 className="font-semibold mb-1 text-blue-900 dark:text-blue-100">No activity yet</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">Activity will appear here as contributions are submitted and reviewed.</p>
          </div>
        ) : (
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={staggerContainer} className="space-y-6">
            {Object.entries(grouped).map(([day, items]) => (
              <motion.div key={day} variants={fadeInUp}>
                <div className="flex items-center gap-3 mb-3">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200">{day}</h3>
                  <div className="flex-1 h-px bg-blue-200 dark:bg-gray-700" />
                </div>
                <div className="relative ml-4 border-l-2 border-blue-200 dark:border-gray-700 pl-6 space-y-1">
                  {items.map((a) => {
                    const meta = ICON_MAP[a.activity_type] || { icon: Clock, cls: 'text-gray-500', bg: 'bg-gray-100' };
                    const Icon = meta.icon;
                    return (
                      <div key={a.activity_id} className="relative group">
                        <div className={`absolute -left-[33px] top-2 h-5 w-5 rounded-full ${meta.bg} flex items-center justify-center ring-2 ring-white dark:ring-gray-900`}>
                          <Icon className={`h-3 w-3 ${meta.cls}`} />
                        </div>
                        <div className="py-2 px-3 rounded-xl hover:bg-blue-50/50 dark:hover:bg-gray-800/50 transition-all duration-300">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm">
                                <button onClick={() => router.push(`/dashboard/users/${a.user.username}`)}
                                  className="font-semibold text-blue-900 dark:text-blue-100 hover:text-transparent hover:bg-gradient-to-r hover:from-blue-600 hover:to-sky-500 hover:bg-clip-text transition-all duration-300">
                                  {fullName(a.user)}
                                </button>
                                <span className="text-blue-600 dark:text-blue-400"> {actionVerb(a.activity_type)} </span>
                                {a.entity_name && <span className="font-medium text-blue-900 dark:text-blue-100">{a.entity_name}</span>}
                              </p>
                              {a.comment && <p className="text-sm text-blue-600 dark:text-blue-400 mt-0.5 line-clamp-2 italic">&ldquo;{a.comment}&rdquo;</p>}
                              {a.entity_category && (
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-[10px] border-blue-200 dark:border-gray-600">{a.entity_category}</Badge>
                                  {a.entity_status && <Badge variant="secondary" className="text-[10px]">{a.entity_status}</Badge>}
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-blue-500 dark:text-blue-400 whitespace-nowrap mt-0.5">{relativeTime(a.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
            {hasMore && (
              <div className="text-center pt-2">
                <Button variant="outline" onClick={loadMore} className="gap-2 border-blue-200 dark:border-gray-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-gray-800">
                  <ChevronDown className="h-4 w-4" /> Load more activity
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </>
  );
}
