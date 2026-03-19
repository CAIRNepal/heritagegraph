'use client';

import {
  Table, TableHead, TableHeader, TableBody, TableRow, TableCell,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination';
import { SimpleRankAvatar, type TierType } from '@/components/rank-avatar';
import { cn } from '@/lib/utils';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  IconTrophy, IconMedal, IconStar, IconSearch, IconFileText,
  IconChecks, IconEye, IconGitBranch, IconUsers,
} from '@tabler/icons-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
};

const ITEMS_PER_PAGE = 20;

interface LeaderboardEntry {
  rank: number;
  user_id: number;
  username: string;
  full_name: string;
  institution: string;
  country: string;
  profile_image: string;
  score: number;
  entities: number;
  accepted_entities: number;
  reviews: number;
  revisions: number;
  submissions: number;
  accepted_submissions: number;
}

function rankIcon(rank: number) {
  if (rank === 1) return <IconTrophy className="w-5 h-5 text-yellow-500" />;
  if (rank === 2) return <IconMedal className="w-5 h-5 text-gray-400" />;
  if (rank === 3) return <IconMedal className="w-5 h-5 text-amber-600" />;
  return null;
}

function rankBadge(rank: number) {
  if (rank === 1) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-300';
  if (rank === 2) return 'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300 border-gray-300';
  if (rank === 3) return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300';
  return 'bg-muted text-muted-foreground border-border';
}

/* ── Determine tier based on score ── */
function getTierFromScore(score: number): TierType {
  if (score >= 4000) return 'grandkeeper';
  if (score >= 2500) return 'archivist';
  if (score >= 1000) return 'curator';
  if (score >= 300) return 'scholar';
  return 'apprentice';
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [query, setQuery] = useState('');
  const [institutionFilter, setInstitutionFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/data/leaderboard/`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const json: LeaderboardEntry[] = await res.json();
      setData(json);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load leaderboard';
      setError(message);
      console.error('Leaderboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  /* ── Derived data ── */
  const institutions = useMemo(
    () => [...new Set(data.map((d) => d.institution).filter(Boolean))].sort(),
    [data],
  );

  const filteredData = useMemo(() => {
    return data.filter((entry) => {
      const matchName =
        !query ||
        entry.username.toLowerCase().includes(query.toLowerCase()) ||
        entry.full_name.toLowerCase().includes(query.toLowerCase());
      const matchInst =
        institutionFilter === 'all' || entry.institution === institutionFilter;
      return matchName && matchInst;
    });
  }, [data, query, institutionFilter]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredData, page]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / ITEMS_PER_PAGE));

  /* ── Summary stats ── */
  const totalContributors = data.length;
  const totalScore = data.reduce((s, e) => s + e.score, 0);
  const totalEntities = data.reduce((s, e) => s + e.entities, 0);
  const totalReviews = data.reduce((s, e) => s + e.reviews, 0);

  return (
    <TooltipProvider>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* ── Hero Header ── */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={staggerContainer}
          className="relative overflow-hidden rounded-2xl border bg-card shadow-sm"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-500 opacity-95" />
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <motion.div
            variants={fadeInUp}
            className="relative z-10 flex items-center justify-between p-8 md:p-10"
          >
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-sm font-medium text-white">
                <IconTrophy className="w-4 h-4" /> Top Contributors
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-white">
                Leader
                <span className="bg-gradient-to-r from-white via-blue-100 to-sky-100 bg-clip-text text-transparent">
                  board
                </span>
              </h1>
              <p className="text-blue-100 max-w-lg text-sm">
                Recognizing the community members who drive heritage preservation
                forward.
              </p>
            </div>
            <div className="hidden md:block">
              <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/30">
                <IconTrophy className="w-12 h-12 text-yellow-300" />
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* ── Summary Cards ── */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={staggerContainer}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {[
            { label: 'Contributors', value: totalContributors, icon: IconUsers, color: 'text-blue-600' },
            { label: 'Total Points', value: totalScore, icon: IconStar, color: 'text-yellow-500' },
            { label: 'Entities', value: totalEntities, icon: IconFileText, color: 'text-green-600' },
            { label: 'Reviews', value: totalReviews, icon: IconEye, color: 'text-purple-600' },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              variants={fadeInUp}
              className="rounded-xl border bg-card p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className={cn('p-2 rounded-lg bg-muted', stat.color)}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Filters ── */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={fadeInUp}
          className="rounded-xl border bg-card p-4 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:max-w-xs">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={institutionFilter}
              onValueChange={(v) => {
                setInstitutionFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Filter by Institution" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Institutions</SelectItem>
                {institutions.map((inst) => (
                  <SelectItem key={inst} value={inst}>
                    {inst}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto text-sm text-muted-foreground hidden sm:block">
              {filteredData.length} contributor{filteredData.length !== 1 ? 's' : ''}
            </div>
          </div>
        </motion.div>

        {/* ── Table ── */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={fadeInUp}
          className="rounded-xl border bg-card shadow-sm"
        >
          <div className="p-6">
            {loading ? (
              <div className="text-center py-16">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
                <p className="mt-3 text-muted-foreground">Loading leaderboard…</p>
              </div>
            ) : error ? (
              <div className="text-center py-16 space-y-3">
                <p className="text-destructive font-medium">{error}</p>
                <button
                  onClick={fetchLeaderboard}
                  className="text-sm text-primary underline underline-offset-4 hover:text-primary/80"
                >
                  Try again
                </button>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[70px]">Rank</TableHead>
                      <TableHead>Contributor</TableHead>
                      <TableHead className="hidden lg:table-cell">Institution</TableHead>
                      <TableHead className="hidden md:table-cell text-center">Breakdown</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                          No contributors found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedData.map((entry) => (
                        <TableRow
                          key={entry.user_id}
                          className={cn(
                            'transition-colors',
                            entry.rank === 1 &&
                              'bg-yellow-50/60 dark:bg-yellow-950/10',
                            entry.rank === 2 &&
                              'bg-gray-50/60 dark:bg-gray-900/10',
                            entry.rank === 3 &&
                              'bg-amber-50/40 dark:bg-amber-950/10',
                          )}
                        >
                          {/* Rank */}
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {rankIcon(entry.rank)}
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-xs font-bold tabular-nums',
                                  rankBadge(entry.rank),
                                )}
                              >
                                #{entry.rank}
                              </Badge>
                            </div>
                          </TableCell>

                          {/* Contributor */}
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <SimpleRankAvatar
                                src={entry.profile_image}
                                name={entry.full_name || entry.username}
                                tier={getTierFromScore(entry.score)}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <p className="font-medium truncate">
                                  {entry.full_name || entry.username}
                                </p>
                                {entry.full_name && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    @{entry.username}
                                  </p>
                                )}
                                {entry.country && (
                                  <p className="text-xs text-muted-foreground lg:hidden">
                                    {entry.country}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          {/* Institution */}
                          <TableCell className="hidden lg:table-cell">
                            <div className="min-w-0">
                              <p className="text-sm truncate">
                                {entry.institution || '—'}
                              </p>
                              {entry.country && (
                                <p className="text-xs text-muted-foreground">
                                  {entry.country}
                                </p>
                              )}
                            </div>
                          </TableCell>

                          {/* Breakdown */}
                          <TableCell className="hidden md:table-cell">
                            <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center gap-1">
                                    <IconFileText className="w-3.5 h-3.5" />
                                    {entry.entities}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {entry.entities} entities ({entry.accepted_entities} accepted)
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center gap-1">
                                    <IconEye className="w-3.5 h-3.5" />
                                    {entry.reviews}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {entry.reviews} reviews
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center gap-1">
                                    <IconGitBranch className="w-3.5 h-3.5" />
                                    {entry.revisions}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {entry.revisions} revisions
                                </TooltipContent>
                              </Tooltip>
                              {entry.submissions > 0 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1">
                                      <IconChecks className="w-3.5 h-3.5" />
                                      {entry.submissions}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {entry.submissions} legacy submissions ({entry.accepted_submissions} accepted)
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TableCell>

                          {/* Score */}
                          <TableCell className="text-right">
                            <span className="text-lg font-bold tabular-nums">
                              {entry.score}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">pts</span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-4 flex justify-center">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setPage((p) => Math.max(p - 1, 1))}
                            aria-disabled={page === 1}
                            className={cn(page === 1 && 'pointer-events-none opacity-50')}
                          />
                        </PaginationItem>
                        <PaginationItem>
                          <span className="text-sm text-muted-foreground px-3">
                            Page {page} of {totalPages}
                          </span>
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                            aria-disabled={page === totalPages}
                            className={cn(page === totalPages && 'pointer-events-none opacity-50')}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>

        {/* ── Scoring Legend ── */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={fadeInUp}
          className="rounded-xl border bg-card p-5 shadow-sm"
        >
          <h3 className="text-sm font-semibold mb-3">How Scoring Works</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">+10</Badge>
              Accepted entity
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">+5</Badge>
              Review decision
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">+3</Badge>
              Submitted entity
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">+2</Badge>
              Revision authored
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">+10</Badge>
              Accepted submission (legacy)
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">+3</Badge>
              Submitted (legacy)
            </div>
          </div>
        </motion.div>
      </div>
    </TooltipProvider>
  );
}
