'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Leaderboard } from '../../components/leaderboard-card';
import { motion } from 'framer-motion';
import { IconSparkles } from '@tabler/icons-react';
import { fadeInUp, staggerContainer, glassCard } from '@/lib/design';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  GitFork,
  CheckCircle,
  FileText,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

import { apiFetchJson, getApiErrorMessage } from '@/lib/api-client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Contributor {
  user_id: number;
  username: string;
  full_name: string;
  profile_image: string;
  avatar_url: string;
  contributions_count: number;
  accepted_count: number;
  forks_count: number;
  merged_forks_count: number;
  reviews_count: number;
  revisions_count: number;
  score: number;
  rank: number;
  date_joined: string;
}

export default function ContributorsPage() {
  const { data: session } = useSession();
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const getHeaders = useCallback(() => {
    const token = (session as any)?.accessToken;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [session]);

  const fetchContributors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: '20',
      });
      if (search) params.set('search', search);

      const data = await apiFetchJson<{
        results?: Contributor[];
        total_pages?: number;
        count?: number;
      }>(`${API_BASE}/data/api/contributors/?${params}`, { headers: getHeaders() });
      setContributors(data.results || []);
      setTotalPages(data.total_pages || 1);
      setTotalCount(data.count || 0);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not load contributors.'));
    } finally {
      setLoading(false);
    }
  }, [page, search, getHeaders]);

  useEffect(() => {
    fetchContributors();
  }, [fetchContributors]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <motion.div initial="hidden" animate="show" variants={staggerContainer} className={`relative overflow-hidden ${glassCard} p-8`}>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-500 opacity-95 rounded-2xl" />
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <motion.div variants={fadeInUp} className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-sm font-medium text-white">
            <IconSparkles className="w-4 h-4" /> Community
          </div>
          <h1 className="text-3xl font-black text-white">
            Our <span className="bg-gradient-to-r from-white via-blue-100 to-sky-100 bg-clip-text text-transparent">Contributors</span>
          </h1>
          <p className="text-blue-100 max-w-lg">
            HeritageGraph depends on its community to explore, preserve, and contribute to cultural knowledge.
            {totalCount > 0 && <span className="font-medium text-white"> {totalCount} contributors</span>}
            {' '}and counting.
          </p>
        </motion.div>
      </motion.div>

      {/* Leaderboards */}
      <motion.div initial="hidden" animate="show" variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div variants={fadeInUp}><Leaderboard type="Curation" /></motion.div>
        <motion.div variants={fadeInUp}><Leaderboard type="Revisions" /></motion.div>
        <motion.div variants={fadeInUp}><Leaderboard type="Moderation" /></motion.div>
        <motion.div variants={fadeInUp}><Leaderboard type="Forks" /></motion.div>
      </motion.div>

      {/* Contributors Table */}
      <motion.div initial="hidden" animate="show" variants={fadeInUp}>
        <div className={`${glassCard} overflow-hidden`}>
          <div className="p-6 border-b border-blue-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">
              All Contributors
            </h2>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contributors..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : contributors.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No contributors found.
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">Rank</TableHead>
                      <TableHead>Contributor</TableHead>
                      <TableHead className="text-center">
                        <span className="flex items-center justify-center gap-1">
                          <FileText className="h-3.5 w-3.5" /> Contributions
                        </span>
                      </TableHead>
                      <TableHead className="text-center">
                        <span className="flex items-center justify-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5" /> Accepted
                        </span>
                      </TableHead>
                      <TableHead className="text-center">
                        <span className="flex items-center justify-center gap-1">
                          <GitFork className="h-3.5 w-3.5" /> Forks
                        </span>
                      </TableHead>
                      <TableHead className="text-center">Reviews</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead className="text-right">Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contributors.map((c) => (
                      <TableRow key={c.user_id}>
                        <TableCell className="font-semibold text-muted-foreground">
                          #{c.rank}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={c.profile_image || c.avatar_url} alt={c.username} />
                              <AvatarFallback className="text-xs">
                                {c.username.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{c.username}</div>
                              {c.full_name && (
                                <div className="text-xs text-muted-foreground">{c.full_name}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono">{c.contributions_count}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={c.accepted_count > 0 ? 'default' : 'secondary'} className="font-mono">
                            {c.accepted_count}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className="font-mono">{c.forks_count}</span>
                            {c.merged_forks_count > 0 && (
                              <Badge variant="outline" className="text-[10px] ml-1">
                                {c.merged_forks_count} merged
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono">{c.reviews_count}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{c.score}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(c.date_joined), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                      Page {page} of {totalPages} ({totalCount} total)
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => setPage(page + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
