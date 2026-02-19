'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Calendar,
  FileText,
  RefreshCw,
  Search,
  Eye,
  CheckCircle,
  XCircle,
  ExternalLink,
  Flag,
  AlertTriangle,
  Inbox,
  Timer,
  ArrowUpDown,
} from 'lucide-react';
import { toast, Toaster } from 'sonner';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface UserInfo {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface Revision {
  revision_id: string;
  revision_number: number;
  data: Record<string, unknown>;
  created_by: UserInfo;
  created_at: string;
}

interface Contribution {
  entity_id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  contributor: UserInfo;
  created_at: string;
  current_revision: Revision | null;
  latest_revision: Revision | null;
  activity_count: number;
  flag_count: number;
  has_conflicts: boolean;
  days_in_review: number;
}

interface APIResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Contribution[];
}

type QueueTab = 'all' | 'new_claims' | 'conflicts' | 'flagged' | 'expiring';
type CategoryType = 'all' | 'monument' | 'artifact' | 'ritual' | 'festival' | 'tradition' | 'document' | 'other';
type SortField = 'created_at' | 'name';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const CAT: Record<string, { label: string; cls: string }> = {
  monument:  { label: 'Monument',  cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  artifact:  { label: 'Artifact',  cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  ritual:    { label: 'Ritual',    cls: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
  festival:  { label: 'Festival',  cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
  tradition: { label: 'Tradition', cls: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300' },
  document:  { label: 'Document',  cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  other:     { label: 'Other',     cls: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
};

const STAT: Record<string, { label: string; cls: string }> = {
  draft:            { label: 'Draft',    cls: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  pending_review:   { label: 'New',      cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300' },
  accepted:         { label: 'Accepted', cls: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  rejected:         { label: 'Rejected', cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  pending_revision: { label: 'Revision', cls: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300' },
};

function relDate(d: string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function initials(u: UserInfo) {
  return (u.first_name?.[0] || u.username[0]).toUpperCase();
}

function fullName(u: UserInfo) {
  return `${u.first_name} ${u.last_name}`.trim() || u.username;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function ContributionQueuePage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [items, setItems] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ all: 0, new_claims: 0, conflicts: 0, flagged: 0, expiring: 0 });
  const [tab, setTab] = useState<QueueTab>('all');
  const [cat, setCat] = useState<CategoryType>('all');
  const [q, setQ] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortAsc, setSortAsc] = useState(false);

  const perPage = 20;
  const pages = Math.ceil(total / perPage);

  const headers = useCallback(() => {
    const h: HeadersInit = { 'Content-Type': 'application/json' };
    const t = (session as any)?.accessToken;
    if (t) h['Authorization'] = `Bearer ${t}`;
    return h;
  }, [session]);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      sp.set('page', String(p));
      if (cat !== 'all') sp.set('category', cat);
      if (q) sp.set('search', q);
      sp.set('ordering', `${sortAsc ? '' : '-'}${sortField}`);

      const res = await fetch(`${API}/data/api/contribution-queue/?${sp}`, { headers: headers() });
      if (!res.ok) throw new Error(`${res.status}`);
      const data: APIResponse = await res.json();

      let all = data.results;
      // Compute tab counts from the full batch
      const nc = all.filter(c => c.status === 'pending_review' && c.activity_count <= 1).length;
      const co = all.filter(c => c.has_conflicts).length;
      const fl = all.filter(c => c.flag_count > 0 && !c.has_conflicts).length;
      const ex = all.filter(c => c.days_in_review > 14).length;
      setCounts({ all: data.count, new_claims: nc, conflicts: co, flagged: fl, expiring: ex });

      // Tab filter
      if (tab === 'new_claims') all = all.filter(c => c.status === 'pending_review' && c.activity_count <= 1);
      else if (tab === 'conflicts') all = all.filter(c => c.has_conflicts);
      else if (tab === 'flagged') all = all.filter(c => c.flag_count > 0 && !c.has_conflicts);
      else if (tab === 'expiring') all = all.filter(c => c.days_in_review > 14);

      setItems(all);
      setTotal(tab === 'all' ? data.count : all.length);
      setPage(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
      toast.error('Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, [headers, tab, cat, q, sortField, sortAsc]);

  useEffect(() => { load(1); }, [session, tab, cat, sortField, sortAsc]);

  const moderate = async (c: Contribution, action: 'accept' | 'reject') => {
    try {
      const res = await fetch(`${API}/data/api/contribution-queue/${c.entity_id}/moderate/`, {
        method: 'POST', headers: headers(), body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${action === 'accept' ? 'Accepted' : 'Rejected'}: ${c.name}`);
      load(page);
    } catch { toast.error(`Failed to ${action}`); }
  };

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="space-y-5">
        {/* Breadcrumb + header */}
        <div>
          <p className="text-sm text-muted-foreground mb-1">Curation / Queues</p>
          <h1 className="text-3xl font-bold tracking-tight">Curation Queues</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            New submitted entities and contributions must be accepted by an editor.
            These queues list items in need of moderation.
          </p>
        </div>

        {/* Queue tabs */}
        <Tabs value={tab} onValueChange={(v) => { setTab(v as QueueTab); setPage(1); }}>
          <TabsList className="h-auto p-1 gap-1 flex-wrap">
            <TabsTrigger value="all" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Inbox className="h-4 w-4" /> All Queue
              <Badge variant="secondary" className="ml-1 text-xs">{counts.all}</Badge>
            </TabsTrigger>
            <TabsTrigger value="new_claims" className="gap-2 data-[state=active]:bg-sky-600 data-[state=active]:text-white">
              <FileText className="h-4 w-4" /> New Claims
              <Badge variant="secondary" className="ml-1 text-xs">{counts.new_claims}</Badge>
            </TabsTrigger>
            <TabsTrigger value="conflicts" className="gap-2 data-[state=active]:bg-amber-600 data-[state=active]:text-white">
              <AlertTriangle className="h-4 w-4" /> Conflicts
              <Badge variant="secondary" className="ml-1 text-xs">{counts.conflicts}</Badge>
            </TabsTrigger>
            <TabsTrigger value="flagged" className="gap-2 data-[state=active]:bg-rose-600 data-[state=active]:text-white">
              <Flag className="h-4 w-4" /> Flagged
              <Badge variant="secondary" className="ml-1 text-xs">{counts.flagged}</Badge>
            </TabsTrigger>
            <TabsTrigger value="expiring" className="gap-2 data-[state=active]:bg-orange-600 data-[state=active]:text-white">
              <Timer className="h-4 w-4" /> Expiring
              <Badge variant="secondary" className="ml-1 text-xs">{counts.expiring}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search & filter bar */}
        <Card>
          <CardContent className="py-3">
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <form onSubmit={(e) => { e.preventDefault(); load(1); }} className="flex-1 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input placeholder="Search entities…" value={q} onChange={e => setQ(e.target.value)} className="pl-10" />
                </div>
                <Button type="submit" size="sm">Search</Button>
              </form>
              <Select value={cat} onValueChange={(v) => { setCat(v as CategoryType); setPage(1); }}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Object.entries(CAT).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => load(page)}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Count summary */}
        <p className="text-sm text-muted-foreground">
          {total > 0
            ? `${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} of ${total} displayed`
            : 'No items in queue'}
        </p>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-20">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
                <p className="mt-3 text-muted-foreground">Loading queue…</p>
              </div>
            ) : error ? (
              <div className="text-center py-20">
                <p className="text-destructive mb-2">{error}</p>
                <Button onClick={() => load(1)}>Retry</Button>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-20">
                <Inbox className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <h3 className="font-semibold mb-1">Queue empty</h3>
                <p className="text-sm text-muted-foreground">No contributions match your filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-20">Status</TableHead>
                      <TableHead>
                        <button onClick={() => { if (sortField === 'name') setSortAsc(!sortAsc); else { setSortField('name'); setSortAsc(true); } }} className="flex items-center gap-1 hover:text-foreground">
                          Entity <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                      <TableHead>Contributor</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-center">Rev</TableHead>
                      <TableHead className="text-center">Flags</TableHead>
                      <TableHead>
                        <button onClick={() => { if (sortField === 'created_at') setSortAsc(!sortAsc); else { setSortField('created_at'); setSortAsc(false); } }} className="flex items-center gap-1 hover:text-foreground">
                          Submitted <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map(c => {
                      const s = STAT[c.status] || { label: c.status, cls: '' };
                      const ct = CAT[c.category] || { label: c.category, cls: '' };
                      return (
                        <TableRow key={c.entity_id} className="group cursor-pointer hover:bg-muted/40"
                          onClick={() => router.push(`/dashboard/curation/review/${c.entity_id}`)}>
                          <TableCell>
                            <Badge variant="secondary" className={`text-[11px] px-2 ${s.cls}`}>{s.label}</Badge>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium truncate max-w-[260px] group-hover:text-primary flex items-center gap-1">
                              {c.name}
                              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">{c.entity_id.slice(0, 8)}…</p>
                          </TableCell>
                          <TableCell>
                            <button onClick={e => { e.stopPropagation(); router.push(`/dashboard/users/${c.contributor.username}`); }}
                              className="flex items-center gap-2 hover:text-primary">
                              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                {initials(c.contributor)}
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-medium leading-none">{fullName(c.contributor)}</p>
                                <p className="text-xs text-muted-foreground">@{c.contributor.username}</p>
                              </div>
                            </button>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[11px] ${ct.cls}`}>{ct.label}</Badge>
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {c.latest_revision ? `#${c.latest_revision.revision_number}` : '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            {c.flag_count > 0
                              ? <Badge variant="destructive" className="text-[10px] px-1.5">{c.flag_count}</Badge>
                              : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                              {relDate(c.created_at)}
                              {c.days_in_review > 14 && (
                                <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-300">{c.days_in_review}d</Badge>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8"
                                onClick={() => router.push(`/dashboard/curation/review/${c.entity_id}`)} title="Review">
                                <Eye className="h-4 w-4" />
                              </Button>
                              {c.status === 'pending_review' && (
                                <>
                                  <Button variant="ghost" size="icon"
                                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => moderate(c, 'accept')} title="Accept">
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon"
                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => moderate(c, 'reject')} title="Reject">
                                    <XCircle className="h-4 w-4" />
                                  </Button>
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
          </CardContent>
        </Card>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Page {page} of {pages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1}
                onClick={() => load(page - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= pages}
                onClick={() => load(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
