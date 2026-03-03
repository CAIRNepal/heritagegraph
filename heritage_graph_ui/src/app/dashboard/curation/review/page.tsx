'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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

interface UserInfo { id: number; username: string; email: string; first_name: string; last_name: string; }
interface Revision { revision_id: string; revision_number: number; data: Record<string, unknown>; created_by: UserInfo; created_at: string; }
interface Contribution {
  entity_id: string; name: string; description: string; category: string;
  status: 'draft' | 'pending_review' | 'accepted' | 'rejected' | 'pending_revision';
  contributor: UserInfo; created_at: string; current_revision: Revision | null;
  latest_revision: Revision | null; activity_count: number; flag_count: number;
  has_conflicts: boolean; days_in_review: number;
}
interface ContributionsResponse { count: number; next: string | null; previous: string | null; results: Contribution[]; }
interface QueueCounts { new_claims: number; conflicts: number; flagged: number; expiring: number; total: number; }
type QueueTab = 'all' | 'new_claims' | 'conflicts' | 'flagged' | 'expiring';
type CategoryType = 'all' | 'monument' | 'artifact' | 'ritual' | 'festival' | 'tradition' | 'document' | 'other';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function ReviewQueuePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [activeTab, setActiveTab] = useState<QueueTab>('all');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [queueCounts, setQueueCounts] = useState<QueueCounts>({ new_claims: 0, conflicts: 0, flagged: 0, expiring: 0, total: 0 });
  const pageSize = 10;

  const categoryOptions: { value: CategoryType; label: string }[] = [
    { value: 'all', label: 'All Categories' }, { value: 'monument', label: 'Monument' },
    { value: 'artifact', label: 'Artifact' }, { value: 'ritual', label: 'Ritual' },
    { value: 'festival', label: 'Festival' }, { value: 'tradition', label: 'Tradition' },
    { value: 'document', label: 'Document' }, { value: 'other', label: 'Other' },
  ];

  const getHeaders = useCallback(() => {
    const token = (session as Record<string, unknown>)?.accessToken as string | undefined;
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }, [session]);

  const fetchQueueCounts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/data/api/review-queue/queue_counts/`, { headers: getHeaders() });
      if (res.ok) setQueueCounts(await res.json());
    } catch { /* silent */ }
  }, [getHeaders]);

  const fetchContributions = useCallback(async (page = 1, queueType: QueueTab = 'all', category: CategoryType = 'all', search = '') => {
    try {
      setIsLoading(true); setError(null);
      let url = `${API_BASE}/data/api/review-queue/?page=${page}&limit=${pageSize}`;
      if (queueType !== 'all') url += `&queue_type=${queueType}`;
      if (category !== 'all') url += `&category=${category}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const data: ContributionsResponse = await res.json();
      setContributions(data.results); setTotalCount(data.count);
      setTotalPages(Math.ceil(data.count / pageSize)); setCurrentPage(page);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load review queue';
      setError(message); toast.error(message);
    } finally { setIsLoading(false); }
  }, [getHeaders]);

  useEffect(() => {
    if (session) { fetchContributions(1, activeTab, selectedCategory, searchQuery); fetchQueueCounts(); }
  }, [session, activeTab, selectedCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (tab: string) => { setActiveTab(tab as QueueTab); setCurrentPage(1); fetchContributions(1, tab as QueueTab, selectedCategory, searchQuery); };
  const handleCategoryChange = (value: CategoryType) => { setSelectedCategory(value); setCurrentPage(1); fetchContributions(1, activeTab, value, searchQuery); };
  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setCurrentPage(1); fetchContributions(1, activeTab, selectedCategory, searchQuery); };
  const handleRefresh = () => { fetchContributions(currentPage, activeTab, selectedCategory, searchQuery); fetchQueueCounts(); };
  const handleOpenReview = (c: Contribution) => { router.push(`/dashboard/curation/review/${c.entity_id}`); };
  const handlePageChange = (page: number) => { fetchContributions(page, activeTab, selectedCategory, searchQuery); };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      monument: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      artifact: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      ritual: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
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

  return (
    <TooltipProvider>

      <div className="space-y-6">
        {/* ── Hero Header ── */}
        <motion.div initial="hidden" animate="show" variants={staggerContainer} className={`relative overflow-hidden ${glassCard} p-8`}>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-500 opacity-95 rounded-2xl" />
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <motion.div variants={fadeInUp} className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-sm font-medium text-white">
                <IconSparkles className="w-4 h-4" /> Epistemic Review
              </div>
              <h1 className="text-3xl font-black text-white">
                Review <span className="bg-gradient-to-r from-white via-blue-100 to-sky-100 bg-clip-text text-transparent">Queue</span>
              </h1>
              <p className="text-blue-100 max-w-lg">Evaluate claims, resolve conflicts, maintain provenance</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => router.push('/dashboard/curation/dashboard')} variant="outline" className="border-white/30 text-white hover:bg-white/20">Dashboard</Button>
              <Button onClick={handleRefresh} variant="outline" className="border-white/30 text-white hover:bg-white/20 gap-2"><RefreshCw className="h-4 w-4" /> Refresh</Button>
            </div>
          </motion.div>
        </motion.div>

        {/* Queue Triage Tabs */}
        <motion.div initial="hidden" animate="show" variants={fadeInUp}>
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-5 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm border border-blue-200 dark:border-gray-700 rounded-xl p-1">
              <TabsTrigger value="all" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-sky-500 data-[state=active]:text-white rounded-lg">
                <FileText className="h-4 w-4" /> All ({queueCounts.total})
              </TabsTrigger>
              <TabsTrigger value="new_claims" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-500 data-[state=active]:to-blue-500 data-[state=active]:text-white rounded-lg">
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
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-400 h-4 w-4" />
                    <Input placeholder="Search entities, contributors..." value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 border-blue-200 dark:border-gray-600" />
                  </div>
                  <Button type="submit" className="bg-gradient-to-r from-blue-600 to-sky-500 text-white hover:from-blue-700 hover:to-sky-600">Search</Button>
                </form>
              </div>
              <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                <SelectTrigger className="w-48 border-blue-200 dark:border-gray-600"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>{categoryOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {['all', 'new_claims', 'conflicts', 'flagged', 'expiring'].map((tab) => (
              <TabsContent key={tab} value={tab}>
                <div className={`${glassCard} overflow-hidden`}>
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-1">
                      {tab === 'all' && 'All Pending Items'}
                      {tab === 'new_claims' && 'New Claims — Awaiting First Review'}
                      {tab === 'conflicts' && 'Conflicts — Contradicting Existing Assertions'}
                      {tab === 'flagged' && 'Flagged — Community-Reported Issues'}
                      {tab === 'expiring' && 'Expiring — Stale Reviews (14+ Days)'}
                    </h3>
                    <p className="text-sm text-blue-600 dark:text-blue-400 mb-4">
                      {tab === 'conflicts' && 'Highest priority — assertions where reconciliation_status is unresolved.'}
                      {tab === 'flagged' && 'Questionable source, suspected duplicate, sensitive content.'}
                      {tab === 'expiring' && 'Items approaching review timeout — act before they stall.'}
                    </p>
                  </div>
                  <div className="px-6 pb-6">
                    {isLoading ? (
                      <div className="text-center py-12">
                        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-r-transparent" />
                        <p className="mt-2 text-blue-700 dark:text-blue-300">Loading review queue...</p>
                      </div>
                    ) : error ? (
                      <div className="text-center py-12">
                        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                        <p className="text-blue-700 dark:text-blue-300 mb-4">{error}</p>
                        <Button onClick={handleRefresh} className="bg-gradient-to-r from-blue-600 to-sky-500 text-white">Try Again</Button>
                      </div>
                    ) : contributions.length === 0 ? (
                      <div className="text-center py-12">
                        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                        <h3 className="font-semibold text-lg mb-2 text-blue-900 dark:text-blue-100">Queue is clear!</h3>
                        <p className="text-blue-700 dark:text-blue-300">No items need review in this category.</p>
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
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                              Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalCount)} of {totalCount}
                            </p>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}
                                className="border-blue-200 dark:border-gray-600 text-blue-700 dark:text-blue-300">Previous</Button>
                              <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}
                                className="border-blue-200 dark:border-gray-600 text-blue-700 dark:text-blue-300">Next</Button>
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
    <div className={`border border-blue-200 dark:border-gray-700 rounded-xl p-4 hover:bg-blue-50/50 dark:hover:bg-gray-800/50 transition-all duration-300 cursor-pointer group hover:shadow-md hover:scale-[1.01] ${
      contribution.has_conflicts ? 'border-l-4 border-l-amber-500' : ''
    } ${contribution.days_in_review > 14 ? 'border-l-4 border-l-red-500' : ''}`}
      onClick={() => onReview(contribution)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {getCategoryBadge(contribution.category)}
            <span className="font-semibold text-base truncate text-blue-900 dark:text-blue-100 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-sky-500 group-hover:bg-clip-text transition-all duration-300">{contribution.name}</span>
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
          </div>
          {contribution.description && <p className="text-sm text-blue-700 dark:text-blue-300 line-clamp-1">{contribution.description}</p>}
          <div className="flex items-center gap-4 text-xs text-blue-600 dark:text-blue-400 flex-wrap">
            <span className="flex items-center gap-1"><User className="h-3 w-3" />{formatUserName(contribution.contributor)} (@{contribution.contributor.username})</span>
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(contribution.created_at)}</span>
            <span>{getRevisionInfo(contribution)}</span>
            <span>{contribution.activity_count} activities</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" onClick={(e) => { e.stopPropagation(); onReview(contribution); }}
            className="bg-gradient-to-r from-blue-600 to-sky-500 text-white hover:from-blue-700 hover:to-sky-600 gap-1">
            <Eye className="h-4 w-4" /> Review
          </Button>
        </div>
      </div>
    </div>
  );
}
