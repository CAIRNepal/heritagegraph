'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  User, Calendar, FileText, RefreshCw, Search, Eye, CheckCircle,
  XCircle, AlertTriangle, Clock, Flag, Scale,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { IconSparkles } from '@tabler/icons-react';
import { fadeInUp, staggerContainer, scaleIn, glassCard } from '@/lib/design';
import { useUserRoles } from '@/hooks/use-user-roles';
import { AccessDenied } from '@/components/access-denied';
import { apiFetchJson, getApiErrorMessage } from '@/lib/api-client';
import { getPublicApiUrl } from '@/lib/api-base';

interface UserInfo { id: number; username: string; email: string; first_name: string; last_name: string; }
interface Revision { revision_id: string; revision_number: number; data: Record<string, unknown>; created_by: UserInfo; created_at: string; }
interface TriageBreakdown {
  age_norm: number;
  flags_norm: number;
  conflict_boost: number;
  source_penalty: number;
  weights: Record<string, number>;
  days_in_review: number;
  unresolved_flag_count: number;
  has_contradiction: boolean;
  worst_tier_label: string;
  worst_source_type: string | null;
}

interface Contribution {
  entity_id: string; name: string; description: string; category: string;
  status: 'draft' | 'pending_review' | 'accepted' | 'rejected' | 'pending_revision';
  contributor: UserInfo; created_at: string; current_revision: Revision | null;
  latest_revision: Revision | null; activity_count: number; flag_count: number;
  has_conflicts: boolean; days_in_review: number;
  triage_priority?: number;
  triage_breakdown?: TriageBreakdown;
  worst_source_tier?: string;
  worst_source_type?: string | null;
}
interface ContributionsResponse { count: number; next: string | null; previous: string | null; results: Contribution[]; }
interface QueueCounts { new_claims: number; conflicts: number; flagged: number; expiring: number; total: number; }
type QueueTab = 'all' | 'new_claims' | 'conflicts' | 'flagged' | 'expiring';
type CategoryType = 'all' | 'monument' | 'artifact' | 'ritual' | 'festival' | 'tradition' | 'document' | 'other';

export default function ReviewQueuePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading queue…</div>}>
      <ReviewQueuePageInner />
    </Suspense>
  );
}

function ReviewQueuePageInner() {
  const { data: session } = useSession();
  const { isReviewer, isModerator, isLoading: rolesLoading } = useUserRoles();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const API_BASE = useMemo(() => getPublicApiUrl(), []);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [activeTab, setActiveTab] = useState<QueueTab>('all');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [queueCounts, setQueueCounts] = useState<QueueCounts>({ new_claims: 0, conflicts: 0, flagged: 0, expiring: 0, total: 0 });
  const pageSize = 10;

  const [ordering, setOrdering] = useState('-triage_priority');
  const [staleDays, setStaleDays] = useState('');
  const [contradictionsOnly, setContradictionsOnly] = useState(false);
  const [minWorstSourceRank, setMinWorstSourceRank] = useState('');
  const [myDomainOnly, setMyDomainOnly] = useState(false);

  const pushQuery = useCallback(
    (next: Record<string, string | undefined>) => {
      const q = new URLSearchParams(searchParams.toString());
      Object.entries(next).forEach(([k, v]) => {
        if (v === undefined || v === '') q.delete(k);
        else q.set(k, v);
      });
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  // Hooks must run unconditionally — gate rendering after all hooks below.
  useEffect(() => {
    const qt = (searchParams.get('queue_type') || 'all') as QueueTab;
    if (['all', 'new_claims', 'conflicts', 'flagged', 'expiring'].includes(qt)) setActiveTab(qt);
    setOrdering(searchParams.get('ordering') || '-triage_priority');
    setStaleDays(searchParams.get('stale_days') || '');
    setContradictionsOnly(searchParams.get('contradictions_only') === 'true');
    setMinWorstSourceRank(searchParams.get('min_worst_source_rank') || '');
    setMyDomainOnly(searchParams.get('my_domain') === 'true');
    const p = parseInt(searchParams.get('page') || '1', 10);
    if (!Number.isNaN(p) && p >= 1) setCurrentPage(p);
  }, [searchParams]);

  const categoryOptions: { value: CategoryType; label: string }[] = [
    { value: 'all', label: 'All Categories' }, { value: 'monument', label: 'Monument' },
    { value: 'artifact', label: 'Artifact' }, { value: 'ritual', label: 'Ritual' },
    { value: 'festival', label: 'Festival' }, { value: 'tradition', label: 'Tradition' },
    { value: 'document', label: 'Document' }, { value: 'other', label: 'Other' },
  ];

  const getHeaders = useCallback(() => {
    const token = (session as unknown as Record<string, unknown>)?.accessToken as string | undefined;
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }, [session]);

  const fetchQueueCounts = useCallback(async () => {
    try {
      const counts = await apiFetchJson<QueueCounts>(
        `${API_BASE}/data/api/review-queue/queue_counts/`,
        { headers: getHeaders() }
      );
      setQueueCounts(counts);
    } catch {
      /* counts are supplementary */
    }
  }, [getHeaders]);

  const fetchContributions = useCallback(async (
    page = 1,
    queueType: QueueTab = 'all',
    category: CategoryType = 'all',
    search = '',
    opts?: {
      ordering?: string;
      staleDays?: string;
      contradictionsOnly?: boolean;
      minWorstSourceRank?: string;
      myDomain?: boolean;
    },
  ) => {
    try {
      setIsLoading(true); setError(null);
      if (!API_BASE) {
        setError('API URL is not configured (NEXT_PUBLIC_API_URL).');
        return;
      }
      const o = opts ?? {};
      let url = `${API_BASE}/data/api/review-queue/?page=${page}&limit=${pageSize}`;
      if (queueType !== 'all') url += `&queue_type=${queueType}`;
      if (category !== 'all') url += `&category=${category}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      const ord = o.ordering ?? ordering;
      url += `&ordering=${encodeURIComponent(ord)}`;
      if (o.staleDays ?? staleDays) url += `&stale_days=${encodeURIComponent((o.staleDays ?? staleDays).trim())}`;
      if ((o.contradictionsOnly ?? contradictionsOnly)) url += '&contradictions_only=true';
      const m = (o.minWorstSourceRank ?? minWorstSourceRank).trim();
      if (m) url += `&min_worst_source_rank=${encodeURIComponent(m)}`;
      if ((o.myDomain ?? myDomainOnly)) url += '&my_domain=true';
      const data = await apiFetchJson<ContributionsResponse>(url, { headers: getHeaders() });
      setContributions(data.results); setTotalCount(data.count);
      setTotalPages(Math.max(1, Math.ceil(data.count / pageSize))); setCurrentPage(page);
    } catch (err) {
      const message = getApiErrorMessage(err, 'Could not load the review queue.');
      setError(message); toast.error(message);
    } finally { setIsLoading(false); }
  }, [API_BASE, contradictionsOnly, getHeaders, minWorstSourceRank, myDomainOnly, ordering, staleDays]);

  useEffect(() => {
    if (!session || !isReviewer) return;
    fetchContributions(currentPage, activeTab, selectedCategory, appliedSearch);
    fetchQueueCounts();
  }, [session, isReviewer, currentPage, activeTab, selectedCategory, appliedSearch, ordering, staleDays, contradictionsOnly, minWorstSourceRank, myDomainOnly, fetchContributions, fetchQueueCounts]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as QueueTab); setCurrentPage(1);
    pushQuery({ queue_type: tab === 'all' ? undefined : tab, page: '1' });
  };
  const handleCategoryChange = (value: CategoryType) => { setSelectedCategory(value); setCurrentPage(1); };
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(searchQuery);
    setCurrentPage(1);
  };
  const handleRefresh = () => {
    fetchContributions(currentPage, activeTab, selectedCategory, appliedSearch);
    fetchQueueCounts();
  };
  const handleOpenReview = (c: Contribution) => { router.push(`/curation/review/${c.entity_id}`); };
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    pushQuery({ page: String(page) });
  };

  const copyShareLink = () => {
    if (appliedSearch.trim()) {
      toast.message('Search is active — share link omits search text for privacy. Copy anyway?', {
        action: {
          label: 'Copy',
          onClick: () => {
            const q = new URLSearchParams();
            q.set('queue_type', activeTab);
            q.set('ordering', ordering);
            if (staleDays) q.set('stale_days', staleDays);
            if (contradictionsOnly) q.set('contradictions_only', 'true');
            if (minWorstSourceRank) q.set('min_worst_source_rank', minWorstSourceRank);
            if (myDomainOnly) q.set('my_domain', 'true');
            void navigator.clipboard.writeText(`${window.location.origin}${pathname}?${q.toString()}`);
            toast.success('Link copied');
          },
        },
      });
      return;
    }
    const q = new URLSearchParams(searchParams.toString());
    q.delete('search');
    void navigator.clipboard.writeText(`${window.location.origin}${pathname}?${q.toString()}`);
    toast.success('Share link copied');
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      monument: 'bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary',
      artifact: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      ritual: 'bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary',
      festival: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      tradition: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      document: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      other: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    };
    return <Badge variant="secondary" className={colors[category] || colors.other}>{category.charAt(0).toUpperCase() + category.slice(1)}</Badge>;
  };
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const formatUserName = (u: UserInfo) => `${u.first_name} ${u.last_name}`.trim() || u.username;
  const getRevisionInfo = (c: Contribution) => c.latest_revision ? `Rev. ${c.latest_revision.revision_number}` : '—';

  if (rolesLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">Checking reviewer access…</div>
    );
  }
  if (!isReviewer) {
    return <AccessDenied requiredRole="reviewer" userEmail={session?.user?.email} />;
  }

  return (
    <TooltipProvider>

      <div className="space-y-6">
        {/* ── Hero Header ── */}
        <motion.div initial="hidden" animate="show" variants={staggerContainer} className={`relative overflow-hidden ${glassCard} p-8`}>
          <div className="absolute inset-0 bg-gradient-to-br from-hero-from via-hero-to to-hero-to opacity-95 rounded-2xl" />
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <motion.div variants={fadeInUp} className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-sm font-medium text-white">
                <IconSparkles className="w-4 h-4" /> Epistemic Review
              </div>
              <h1 className="text-3xl font-black text-white">
                Review <span className="text-white/90">Queue</span>
              </h1>
              <p className="text-hero-foreground/90 max-w-lg">
                Evaluate claims, resolve conflicts, maintain provenance. Prefer this queue for
                source-tier triage — use{" "}
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-white"
                  onClick={() => router.push("/curation/contributions")}
                >
                  Curation Queues
                </button>{" "}
                only for quick bulk accept/reject.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => router.push('/curation/dashboard')} variant="outline" className="border-white/30 text-white hover:bg-white/20">Dashboard</Button>
              {(isModerator || isReviewer) && (
                <Button onClick={() => router.push('/curation/schema-extensions')} variant="outline" className="border-white/30 text-white hover:bg-white/20">
                  Schema extensions
                </Button>
              )}
              <Button onClick={handleRefresh} variant="outline" className="border-white/30 text-white hover:bg-white/20 gap-2"><RefreshCw className="h-4 w-4" /> Refresh</Button>
            </div>
          </motion.div>
        </motion.div>

        {/* Queue Triage Tabs */}
        <motion.div initial="hidden" animate="show" variants={fadeInUp}>
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-5 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm border border-primary/30 dark:border-gray-700 rounded-xl p-1">
              <TabsTrigger value="all" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-hero-from data-[state=active]:to-hero-to data-[state=active]:text-white rounded-lg">
                <FileText className="h-4 w-4" /> All ({queueCounts.total})
              </TabsTrigger>
              <TabsTrigger value="new_claims" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-hero-from data-[state=active]:to-hero-to data-[state=active]:text-white rounded-lg">
                <CheckCircle className="h-4 w-4" /> New ({queueCounts.new_claims})
              </TabsTrigger>
              <TabsTrigger value="conflicts" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white rounded-lg">
                <Scale className="h-4 w-4" /> Conflicts ({queueCounts.conflicts})
              </TabsTrigger>
              <TabsTrigger value="flagged" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-rose-500 data-[state=active]:to-red-500 data-[state=active]:text-white rounded-lg">
                <Flag className="h-4 w-4" /> Flagged ({queueCounts.flagged})
              </TabsTrigger>
              <TabsTrigger value="expiring" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white rounded-lg">
                <Clock className="h-4 w-4" /> Expiring ({queueCounts.expiring})
              </TabsTrigger>
            </TabsList>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <div className="flex-1">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary h-4 w-4" />
                    <Input placeholder="Search entities, contributors..." value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 border-primary/30 dark:border-gray-600" />
                  </div>
                  <Button type="submit" className="bg-gradient-to-r from-hero-from to-hero-to text-white hover:from-hero-from hover:to-hero-to">Search</Button>
                </form>
              </div>
              <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                <SelectTrigger className="w-48 border-primary/30 dark:border-gray-600"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>{categoryOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-3 mt-4 p-4 rounded-xl border border-primary/30 dark:border-gray-700 bg-white/40 dark:bg-gray-900/40">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Sort</Label>
                  <Select
                    value={ordering}
                    onValueChange={(v) => {
                      setOrdering(v);
                      setCurrentPage(1);
                      pushQuery({ ordering: v, page: '1' });
                    }}
                  >
                    <SelectTrigger className="w-[200px] border-primary/30 dark:border-gray-600"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-triage_priority">Triage priority (high first)</SelectItem>
                      <SelectItem value="triage_priority">Triage priority (low first)</SelectItem>
                      <SelectItem value="-created_at">Newest first</SelectItem>
                      <SelectItem value="created_at">Oldest first</SelectItem>
                      <SelectItem value="-updated_at">Recently updated</SelectItem>
                      <SelectItem value="updated_at">Least recently updated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Stale (days in review ≥)</Label>
                  <Input
                    className="w-28 border-primary/30 dark:border-gray-600"
                    inputMode="numeric"
                    placeholder="e.g. 7"
                    value={staleDays}
                    onChange={(e) => setStaleDays(e.target.value.replace(/\D/g, ''))}
                    onBlur={() => {
                      pushQuery({ stale_days: staleDays || undefined, page: '1' });
                      setCurrentPage(1);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Min worst source rank</Label>
                  <Input
                    className="w-28 border-primary/30 dark:border-gray-600"
                    inputMode="numeric"
                    placeholder="0–6"
                    value={minWorstSourceRank}
                    onChange={(e) => setMinWorstSourceRank(e.target.value.replace(/\D/g, ''))}
                    onBlur={() => {
                      pushQuery({ min_worst_source_rank: minWorstSourceRank || undefined, page: '1' });
                      setCurrentPage(1);
                    }}
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    id="contradictions-only"
                    checked={contradictionsOnly}
                    onCheckedChange={(c) => {
                      setContradictionsOnly(c);
                      setCurrentPage(1);
                      pushQuery({ contradictions_only: c ? 'true' : undefined, page: '1' });
                    }}
                  />
                  <Label htmlFor="contradictions-only" className="text-sm cursor-pointer">Contradictions only</Label>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    id="my-domain"
                    checked={myDomainOnly}
                    onCheckedChange={(c) => {
                      setMyDomainOnly(c);
                      setCurrentPage(1);
                      pushQuery({ my_domain: c ? 'true' : undefined, page: '1' });
                    }}
                  />
                  <Label htmlFor="my-domain" className="text-sm cursor-pointer">My domain only</Label>
                </div>
                <Button type="button" variant="outline" className="mt-5 border-primary/30" onClick={copyShareLink}>
                  Copy share link
                </Button>
              </div>
              {myDomainOnly && (
                <p className="text-xs text-muted-foreground">
                  &quot;My domain&quot; uses your reviewer profile expertise areas — each reviewer sees their own domain when opening a shared link.
                </p>
              )}
            </div>

            {['all', 'new_claims', 'conflicts', 'flagged', 'expiring'].map((tab) => (
              <TabsContent key={tab} value={tab}>
                <div className={`${glassCard} overflow-hidden`}>
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-primary dark:text-primary mb-1">
                      {tab === 'all' && 'All Pending Items'}
                      {tab === 'new_claims' && 'New Claims — Awaiting First Review'}
                      {tab === 'conflicts' && 'Conflicts — Contradicting Existing Assertions'}
                      {tab === 'flagged' && 'Flagged — Community-Reported Issues'}
                      {tab === 'expiring' && 'Expiring — Stale Reviews (14+ Days)'}
                    </h3>
                    <p className="text-sm text-primary dark:text-primary mb-4">
                      {tab === 'conflicts' && 'Highest priority — assertions where reconciliation_status is unresolved.'}
                      {tab === 'flagged' && 'Questionable source, suspected duplicate, sensitive content.'}
                      {tab === 'expiring' && 'Items approaching review timeout — act before they stall.'}
                    </p>
                  </div>
                  <div className="px-6 pb-6">
                    {isLoading ? (
                      <div className="text-center py-12">
                        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-r-transparent" />
                        <p className="mt-2 text-primary dark:text-primary">Loading review queue...</p>
                      </div>
                    ) : error ? (
                      <div className="text-center py-12">
                        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                        <p className="text-primary dark:text-primary mb-4">{error}</p>
                        <Button onClick={handleRefresh} className="bg-gradient-to-r from-hero-from to-hero-to text-white">Try Again</Button>
                      </div>
                    ) : contributions.length === 0 ? (
                      <div className="text-center py-12">
                        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                        <h3 className="font-semibold text-lg mb-2 text-primary dark:text-primary">Queue is clear!</h3>
                        <p className="text-primary dark:text-primary">No items need review in this category.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {contributions.map((c) => (
                          <QueueRow key={c.entity_id} contribution={c} onReview={handleOpenReview}
                            getCategoryBadge={getCategoryBadge} formatDate={formatDate}
                            formatUserName={formatUserName} getRevisionInfo={getRevisionInfo} />
                        ))}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between mt-6">
                            <p className="text-sm text-primary dark:text-primary">
                              Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalCount)} of {totalCount}
                            </p>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}
                                className="border-primary/30 dark:border-gray-600 text-primary dark:text-primary">Previous</Button>
                              <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}
                                className="border-primary/30 dark:border-gray-600 text-primary dark:text-primary">Next</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </motion.div>
      </div>
    </TooltipProvider>
  );
}

function QueueRow({ contribution, onReview, getCategoryBadge, formatDate, formatUserName, getRevisionInfo }: {
  contribution: Contribution; onReview: (c: Contribution) => void;
  getCategoryBadge: (cat: string) => React.ReactNode; formatDate: (d: string) => string;
  formatUserName: (u: UserInfo) => string; getRevisionInfo: (c: Contribution) => string;
}) {
  return (
    <div className={`border border-primary/30 dark:border-gray-700 rounded-xl p-4 hover:bg-primary/10 dark:hover:bg-gray-800/50 transition-all duration-300 cursor-pointer group hover:shadow-md hover:scale-[1.01] ${
      contribution.has_conflicts ? 'border-l-4 border-l-amber-500' : ''
    } ${contribution.days_in_review > 14 ? 'border-l-4 border-l-red-500' : ''}`}
      onClick={() => onReview(contribution)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {getCategoryBadge(contribution.category)}
            <span className="font-semibold text-base truncate text-primary dark:text-primary group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-hero-from group-hover:to-hero-to group-hover:bg-clip-text transition-all duration-300">{contribution.name}</span>
            {contribution.has_conflicts && (
              <Tooltip><TooltipTrigger>
                <Badge variant="destructive" className="flex items-center gap-1 text-xs"><AlertTriangle className="h-3 w-3" /> Conflict</Badge>
              </TooltipTrigger><TooltipContent>Contradicts an existing accepted claim</TooltipContent></Tooltip>
            )}
            {contribution.flag_count > 0 && !contribution.has_conflicts && (
              <Badge variant="outline" className="flex items-center gap-1 text-xs text-amber-600 border-amber-300">
                <Flag className="h-3 w-3" /> {contribution.flag_count} flag{contribution.flag_count > 1 ? 's' : ''}
              </Badge>
            )}
            {contribution.days_in_review > 14 && (
              <Badge variant="outline" className="flex items-center gap-1 text-xs text-red-600 border-red-300">
                <Clock className="h-3 w-3" /> {contribution.days_in_review}d in review
              </Badge>
            )}
            {typeof contribution.triage_priority === 'number' && (
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="secondary" className="text-xs">Triage {contribution.triage_priority}</Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  {contribution.worst_source_tier && (
                    <span>Source tier: {contribution.worst_source_tier}</span>
                  )}
                  {contribution.triage_breakdown && (
                    <pre className="mt-1 whitespace-pre-wrap text-[10px] opacity-90">
                      {JSON.stringify(contribution.triage_breakdown.weights, null, 0)}
                    </pre>
                  )}
                </TooltipContent>
              </Tooltip>
            )}
            {contribution.worst_source_tier && (
              <Badge variant="outline" className="text-xs capitalize">{contribution.worst_source_tier}</Badge>
            )}
          </div>
          {contribution.description && <p className="text-sm text-primary dark:text-primary line-clamp-1">{contribution.description}</p>}
          <div className="flex items-center gap-4 text-xs text-primary dark:text-primary flex-wrap">
            <span className="flex items-center gap-1"><User className="h-3 w-3" />{formatUserName(contribution.contributor)} (@{contribution.contributor.username})</span>
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(contribution.created_at)}</span>
            <span>{getRevisionInfo(contribution)}</span>
            <span>{contribution.activity_count} activities</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" onClick={(e) => { e.stopPropagation(); onReview(contribution); }}
            className="bg-gradient-to-r from-hero-from to-hero-to text-white hover:from-hero-from hover:to-hero-to gap-1">
            <Eye className="h-4 w-4" /> Review
          </Button>
        </div>
      </div>
    </div>
  );
}
