'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Calendar, FileText, RefreshCw, Search, Eye, CheckCircle,
  XCircle, ExternalLink, Flag, AlertTriangle, Inbox, Timer, ArrowUpDown,
  GitFork, UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { IconSparkles } from '@tabler/icons-react';
import { fadeInUp, staggerContainer, glassCard } from '@/lib/design';
import { apiFetch, apiFetchJson, getApiErrorMessage } from '@/lib/api-client';
import { dataApiPath } from '@/lib/api-paths';
import { limitOffsetSearchParams, totalPages, type PaginatedResponse } from '@/lib/drf-pagination';
import { submitReviewerApplication as postReviewerApplication } from '@/lib/reviewer-applications-api';
import { useUserRoles } from '@/hooks/use-user-roles';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmActionDialog } from '@/components/confirm-action-dialog';

interface UserInfo { id: number; username: string; email: string; first_name: string; last_name: string; }
interface Revision { revision_id: string; revision_number: number; data: Record<string, unknown>; created_by: UserInfo; created_at: string; }
interface ForkInfoInline {
  fork_id: string; original_entity_id: string; original_entity_name: string;
  fork_reason_tag: string; fork_reason_tag_display: string;
  fork_status: string; diff_field_count: number; reason: string; forked_by: string;
}
interface Contribution {
  entity_id: string; name: string; description: string; category: string; status: string;
  contributor: UserInfo; created_at: string; current_revision: Revision | null;
  latest_revision: Revision | null; activity_count: number; flag_count: number;
  has_conflicts: boolean; days_in_review: number;
  is_fork?: boolean; fork_info?: ForkInfoInline | null;
  root_entity?: string | null; parent_entity?: string | null; fork_depth?: number;
}
type QueueTab = 'all' | 'new_claims' | 'conflicts' | 'flagged' | 'expiring' | 'forks';
type CategoryType = 'all' | 'monument' | 'artifact' | 'ritual' | 'festival' | 'tradition' | 'document' | 'other';
type SortField = 'created_at' | 'name';

const CAT: Record<string, { label: string; cls: string }> = {
  monument:  { label: 'Monument',  cls: 'bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary' },
  artifact:  { label: 'Artifact',  cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  ritual:    { label: 'Ritual',    cls: 'bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary' },
  festival:  { label: 'Festival',  cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
  tradition: { label: 'Tradition', cls: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300' },
  document:  { label: 'Document',  cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  other:     { label: 'Other',     cls: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
};

const STAT: Record<string, { label: string; cls: string }> = {
  draft:            { label: 'Draft',    cls: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  pending_review:   { label: 'New',      cls: 'bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary' },
  accepted:         { label: 'Accepted', cls: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  rejected:         { label: 'Rejected', cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  pending_revision: { label: 'Revision', cls: 'bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary' },
};

function relDate(d: string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function initials(u: UserInfo) { return (u.first_name?.[0] || u.username[0]).toUpperCase(); }
function fullName(u: UserInfo) { return `${u.first_name} ${u.last_name}`.trim() || u.username; }

export default function ContributionQueuePage() {
  const { data: session } = useSession();
  const { isStaff, isReviewer, reviewerApplication, isLoading: rolesLoading, refetch: refetchRoles } =
    useUserRoles();
  const router = useRouter();
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyMessage, setApplyMessage] = useState('');
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [moderateConfirm, setModerateConfirm] = useState<{
    contribution: Contribution;
    action: 'accept' | 'reject';
  } | null>(null);
  const [items, setItems] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ all: 0, new_claims: 0, conflicts: 0, flagged: 0, expiring: 0, forks: 0 });
  const [tab, setTab] = useState<QueueTab>('all');
  const [cat, setCat] = useState<CategoryType>('all');
  const [q, setQ] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const perPage = 20;
  const pages = totalPages(total, perPage);

  const showApplyCta =
    !rolesLoading &&
    !isStaff &&
    !isReviewer &&
    (reviewerApplication == null || reviewerApplication.status === 'rejected');
  const showPendingCta =
    !rolesLoading && !isStaff && !isReviewer && reviewerApplication?.status === 'pending';

  const headers = useCallback(() => {
    const h: HeadersInit = { 'Content-Type': 'application/json' };
    const t = (session as any)?.accessToken;
    if (t) h['Authorization'] = `Bearer ${t}`;
    return h;
  }, [session]);

  const handleSubmitReviewerApplication = async () => {
    if (!session || applySubmitting) return;
    setApplySubmitting(true);
    try {
      const t = (session as unknown as Record<string, unknown>)?.accessToken as
        | string
        | undefined;
      if (!t) return;
      await postReviewerApplication(t, applyMessage);
      toast.success('Application submitted. We will follow up if your request is approved.');
      setApplyOpen(false);
      setApplyMessage('');
      await refetchRoles();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not submit your application.'));
    } finally {
      setApplySubmitting(false);
    }
  };

  const loadCounts = useCallback(async () => {
    try {
      const countsData = await apiFetchJson<{
        all: number;
        new_claims: number;
        conflicts: number;
        flagged: number;
        expiring: number;
        forks: number;
      }>(dataApiPath('contribution-queue', 'queue-counts'), { headers: headers() });
      setCounts({
        all: countsData.all,
        new_claims: countsData.new_claims,
        conflicts: countsData.conflicts,
        flagged: countsData.flagged,
        expiring: countsData.expiring,
        forks: countsData.forks,
      });
    } catch {
      /* tab counts are best-effort */
    }
  }, [headers]);

  const load = useCallback(async (p = 1) => {
    setLoading(true); setError(null);
    try {
      const sp = limitOffsetSearchParams(p, perPage, {
        ordering: `${sortAsc ? '' : '-'}${sortField}`,
        ...(cat !== 'all' ? { category: cat } : {}),
        ...(q ? { search: q } : {}),
        ...(tab !== 'all' ? { queue_tab: tab } : {}),
      });
      const data = await apiFetchJson<PaginatedResponse<Contribution>>(
        `${dataApiPath('contribution-queue')}?${sp}`,
        { headers: headers() },
      );
      void loadCounts();
      setItems(data.results);
      setTotal(data.count);
      setPage(p);
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Could not load the contribution queue.');
      setError(msg);
      toast.error(msg);
    }
    finally { setLoading(false); }
  }, [headers, tab, cat, q, sortField, sortAsc, perPage, loadCounts]);

  useEffect(() => { load(1); }, [session, tab, cat, sortField, sortAsc]);

  const moderate = async (c: Contribution, action: 'accept' | 'reject') => {
    try {
      await apiFetch(dataApiPath('contribution-queue', c.entity_id, 'moderate'), {
        method: 'POST', headers: headers(), body: JSON.stringify({ action }),
      });
      toast.success(`${action === 'accept' ? 'Accepted' : 'Rejected'}: ${c.name}`);
      load(page);
    } catch (err) {
      toast.error(
        getApiErrorMessage(
          err,
          `Could not ${action === 'accept' ? 'accept' : 'reject'} this item.`
        )
      );
      throw err;
    }
  };

  return (
    <>
      <ConfirmActionDialog
        open={moderateConfirm !== null}
        onOpenChange={(open) => !open && setModerateConfirm(null)}
        title={
          moderateConfirm?.action === 'accept'
            ? 'Accept this contribution?'
            : 'Reject this contribution?'
        }
        description={
          moderateConfirm ? (
            <span className="space-y-2 block">
              <span className="block">
                <span className="font-medium text-foreground">{moderateConfirm.contribution.name}</span>
                {moderateConfirm.action === 'reject' ? (
                  <span>
                    {' '}
                    will be marked rejected and removed from the pending queue.
                  </span>
                ) : (
                  <span>
                    {' '}
                    will be published immediately without the full triage workspace.
                  </span>
                )}
              </span>
              {moderateConfirm.action === 'accept' && (
                <span className="block text-sm text-muted-foreground">
                  Prefer{' '}
                  <button
                    type="button"
                    className="underline text-foreground"
                    onClick={() => {
                      const id = moderateConfirm.contribution.entity_id;
                      setModerateConfirm(null);
                      router.push(`/curation/review/${id}`);
                    }}
                  >
                    Open full review
                  </button>{' '}
                  when sources, conflicts, or confidence need a recorded decision.
                </span>
              )}
            </span>
          ) : undefined
        }
        confirmLabel={moderateConfirm?.action === 'accept' ? 'Quick accept' : 'Reject'}
        confirmVariant={moderateConfirm?.action === 'reject' ? 'destructive' : 'default'}
        onConfirm={async () => {
          if (!moderateConfirm) return;
          await moderate(moderateConfirm.contribution, moderateConfirm.action);
          setModerateConfirm(null);
        }}
      />

      <div className="space-y-6">
        {/* ── Hero Header ── */}
        <motion.div initial="hidden" animate="show" variants={staggerContainer} className={`relative overflow-hidden ${glassCard} p-8`}>
          <div className="absolute inset-0 bg-gradient-to-br from-hero-from via-hero-to to-hero-to opacity-95 rounded-2xl" />
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <motion.div variants={fadeInUp} className="relative z-10 space-y-2">
            <p className="text-sm text-hero-foreground/90">Curation / Queues</p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-sm font-medium text-white">
              <IconSparkles className="w-4 h-4" /> Curation Queues
            </div>
            <h1 className="text-3xl font-black text-white">
              Curation <span className="text-white/90">Queues</span>
            </h1>
            <p className="text-hero-foreground/90 max-w-2xl">
              Fast accept/reject for straightforward submissions. For source-tier triage,
              conflicts, and provenance notes, open the{" "}
              <button
                type="button"
                className="underline underline-offset-2 font-medium text-white hover:text-hero-foreground/90"
                onClick={() => router.push('/curation/review')}
              >
                Epistemic Review Queue
              </button>{" "}
              (or the eye icon on a row) before publishing.
            </p>
            {showPendingCta && (
              <p className="text-sm text-amber-200 border border-amber-400/40 bg-amber-500/20 rounded-lg px-4 py-2 max-w-2xl">
                Your request to become a reviewer is <strong>pending</strong>. Staff will review it in the admin panel. You can still use this list to look at submissions, but accept/reject remains limited to staff.
              </p>
            )}
            {showApplyCta && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 max-w-2xl">
                <p className="text-sm text-white/90">
                  Want to help curate? Apply to be a community reviewer. If approved, you will be added to the Reviewers group (accept on this page still requires a staff account).
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0 bg-white/95 text-primary hover:bg-white"
                  onClick={() => setApplyOpen(true)}
                >
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  Apply to be a reviewer
                </Button>
              </div>
            )}
          </motion.div>
        </motion.div>

        <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Apply to be a reviewer</DialogTitle>
              <DialogDescription>
                Optional: share a short note about your background, languages, or areas of interest. Staff can approve or decline in the Django admin (Heritage data → Reviewer applications).
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={applyMessage}
              onChange={e => setApplyMessage(e.target.value)}
              placeholder="Why you would like to help review (optional)…"
              className="min-h-[100px] border-primary/30 dark:border-gray-600"
              maxLength={4000}
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setApplyOpen(false)} disabled={applySubmitting}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-gradient-to-r from-hero-from to-hero-to"
                onClick={handleSubmitReviewerApplication}
                disabled={applySubmitting}
              >
                {applySubmitting ? 'Submitting…' : 'Submit application'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Queue tabs */}
        <motion.div initial="hidden" animate="show" variants={fadeInUp}>
          <Tabs value={tab} onValueChange={(v) => { setTab(v as QueueTab); setPage(1); }}>
            <TabsList className="h-auto p-1 gap-1 flex-wrap bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm border border-primary/30 dark:border-gray-700 rounded-xl">
              <TabsTrigger value="all" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-hero-from data-[state=active]:to-hero-to data-[state=active]:text-white rounded-lg">
                <Inbox className="h-4 w-4" /> All Queue <Badge variant="secondary" className="ml-1 text-xs">{counts.all}</Badge>
              </TabsTrigger>
              <TabsTrigger value="new_claims" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-hero-from data-[state=active]:to-hero-to data-[state=active]:text-white rounded-lg">
                <FileText className="h-4 w-4" /> New Claims <Badge variant="secondary" className="ml-1 text-xs">{counts.new_claims}</Badge>
              </TabsTrigger>
              <TabsTrigger value="conflicts" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white rounded-lg">
                <AlertTriangle className="h-4 w-4" /> Conflicts <Badge variant="secondary" className="ml-1 text-xs">{counts.conflicts}</Badge>
              </TabsTrigger>
              <TabsTrigger value="flagged" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-rose-500 data-[state=active]:to-red-500 data-[state=active]:text-white rounded-lg">
                <Flag className="h-4 w-4" /> Flagged <Badge variant="secondary" className="ml-1 text-xs">{counts.flagged}</Badge>
              </TabsTrigger>
              <TabsTrigger value="expiring" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white rounded-lg">
                <Timer className="h-4 w-4" /> Expiring <Badge variant="secondary" className="ml-1 text-xs">{counts.expiring}</Badge>
              </TabsTrigger>
              <TabsTrigger value="forks" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-hero-from data-[state=active]:to-hero-to data-[state=active]:text-white rounded-lg">
                <GitFork className="h-4 w-4" /> Forks <Badge variant="secondary" className="ml-1 text-xs">{counts.forks}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </motion.div>

        {/* Search & filter bar */}
        <motion.div initial="hidden" animate="show" variants={fadeInUp}>
          <div className={`${glassCard} p-4`}>
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <form onSubmit={(e) => { e.preventDefault(); load(1); }} className="flex-1 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-primary h-4 w-4" />
                  <Input placeholder="Search entities…" value={q} onChange={e => setQ(e.target.value)} className="pl-10 border-primary/30 dark:border-gray-600" />
                </div>
                <Button type="submit" size="sm" className="bg-gradient-to-r from-hero-from to-hero-to text-white hover:from-hero-from hover:to-hero-to">Search</Button>
              </form>
              <Select value={cat} onValueChange={(v) => { setCat(v as CategoryType); setPage(1); }}>
                <SelectTrigger className="w-44 border-primary/30 dark:border-gray-600"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Object.entries(CAT).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-9 w-9 border-primary/30 dark:border-gray-600 text-primary dark:text-primary" onClick={() => load(page)}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Count summary */}
        <p className="text-sm text-primary dark:text-primary">
          {total > 0 ? `${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} of ${total} displayed` : 'No items in queue'}
        </p>

        {/* Table */}
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeInUp}>
          <div className={glassCard}>
            <div className="p-0">
              {loading ? (
                <div className="text-center py-20">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-r-transparent" />
                  <p className="mt-3 text-primary dark:text-primary">Loading queue…</p>
                </div>
              ) : error ? (
                <div className="text-center py-20">
                  <p className="text-red-600 mb-2">{error}</p>
                  <Button onClick={() => load(1)} className="bg-gradient-to-r from-hero-from to-hero-to text-white">Retry</Button>
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-20">
                  <Inbox className="h-12 w-12 mx-auto mb-3 text-primary" />
                  <h3 className="font-semibold mb-1 text-primary dark:text-primary">Queue empty</h3>
                  <p className="text-sm text-primary dark:text-primary">No contributions match your filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-primary/10 dark:bg-gray-800/50 border-primary/30 dark:border-gray-700">
                        <TableHead className="w-20 text-primary dark:text-primary">Status</TableHead>
                        <TableHead className="text-primary dark:text-primary">
                          <button onClick={() => { if (sortField === 'name') setSortAsc(!sortAsc); else { setSortField('name'); setSortAsc(true); } }} className="flex items-center gap-1 hover:text-primary">
                            Entity <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </TableHead>
                        <TableHead className="text-primary dark:text-primary">Contributor</TableHead>
                        <TableHead className="text-primary dark:text-primary">Category</TableHead>
                        <TableHead className="text-center text-primary dark:text-primary">Rev</TableHead>
                        <TableHead className="text-center text-primary dark:text-primary">Flags</TableHead>
                        <TableHead className="text-primary dark:text-primary">
                          <button onClick={() => { if (sortField === 'created_at') setSortAsc(!sortAsc); else { setSortField('created_at'); setSortAsc(false); } }} className="flex items-center gap-1 hover:text-primary">
                            Submitted <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </TableHead>
                        <TableHead className="text-right text-primary dark:text-primary">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(c => {
                        const s = STAT[c.status] || { label: c.status, cls: '' };
                        const ct = CAT[c.category] || { label: c.category, cls: '' };
                        return (
                          <TableRow key={c.entity_id} className="group cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/10 transition-colors border-primary/30 dark:border-gray-800"
                            onClick={() => router.push(`/curation/review/${c.entity_id}`)}>
                            <TableCell><Badge variant="secondary" className={`text-[11px] px-2 ${s.cls}`}>{s.label}</Badge></TableCell>
                            <TableCell>
                              <p className="font-medium truncate max-w-[260px] text-primary dark:text-primary group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-hero-from group-hover:to-hero-to group-hover:bg-clip-text flex items-center gap-1 transition-all duration-300">
                                {c.is_fork && <GitFork className="h-3 w-3 shrink-0 text-primary" />}
                                {c.name} <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </p>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-primary dark:text-primary font-mono">{c.entity_id.slice(0, 8)}…</span>
                                {c.fork_info && (
                                  <span className="text-[10px] text-muted-foreground">
                                    fork of {c.fork_info.original_entity_name}
                                    {c.fork_info.fork_reason_tag !== 'other' && ` (${c.fork_info.fork_reason_tag_display})`}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <button onClick={e => { e.stopPropagation(); router.push(`/users/${c.contributor.username}`); }}
                                className="flex items-center gap-2 hover:text-primary transition-colors">
                                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-hero-from to-hero-to flex items-center justify-center text-xs font-medium text-white">
                                  {initials(c.contributor)}
                                </div>
                                <div className="text-left">
                                  <p className="text-sm font-medium leading-none text-primary dark:text-primary">{fullName(c.contributor)}</p>
                                  <p className="text-xs text-primary dark:text-primary">@{c.contributor.username}</p>
                                </div>
                              </button>
                            </TableCell>
                            <TableCell><Badge variant="outline" className={`text-[11px] ${ct.cls}`}>{ct.label}</Badge></TableCell>
                            <TableCell className="text-center text-sm text-primary dark:text-primary">
                              {c.latest_revision ? `#${c.latest_revision.revision_number}` : '—'}
                            </TableCell>
                            <TableCell className="text-center">
                              {c.flag_count > 0 ? <Badge variant="destructive" className="text-[10px] px-1.5">{c.flag_count}</Badge> : <span className="text-primary">—</span>}
                            </TableCell>
                            <TableCell>
                              <span className="flex items-center gap-1.5 text-sm text-primary dark:text-primary">
                                <Calendar className="h-3.5 w-3.5" /> {relDate(c.created_at)}
                                {c.days_in_review > 14 && <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-300">{c.days_in_review}d</Badge>}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/10"
                                  onClick={() => router.push(`/curation/review/${c.entity_id}`)} title="Full epistemic review"><Eye className="h-4 w-4" /></Button>
                                {c.status === 'pending_review' && (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                      onClick={() => setModerateConfirm({ contribution: c, action: 'accept' })} title="Quick accept (no triage workspace)"><CheckCircle className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => setModerateConfirm({ contribution: c, action: 'reject' })} title="Reject"><XCircle className="h-4 w-4" /></Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-primary dark:text-primary">Page {page} of {pages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => load(page - 1)}
                className="border-primary/30 dark:border-gray-600 text-primary dark:text-primary">Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => load(page + 1)}
                className="border-primary/30 dark:border-gray-600 text-primary dark:text-primary">Next</Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
