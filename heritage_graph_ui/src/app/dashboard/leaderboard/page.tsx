'use client';

import {
  Table, TableHead, TableHeader, TableBody, TableRow, TableCell,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination';
import { cn } from '@/lib/utils';
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { IconTrophy, IconSparkles } from '@tabler/icons-react';

const fadeInUp = { hidden: { opacity: 0, y: 60 }, show: { opacity: 1, y: 0, transition: { duration: 0.8 } } };
const staggerContainer = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.3 } } };
const glassCard = 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-blue-200 dark:border-gray-700 rounded-2xl shadow-lg';

const ITEMS_PER_PAGE = 20;

interface LeaderboardEntry {
  rank: number;
  username: string;
  institution?: string;
  country?: string;
  total_submission: number;
  avatar?: string;
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [query, setQuery] = useState('');
  const [institutionFilter, setInstitutionFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const res = await fetch(`http://127.0.0.1:8000/data/leaderboard/`, {
          method: 'GET', headers: { Accept: '*/*' },
        });
        if (!res.ok) throw new Error('Failed to fetch leaderboard data');
        const json: LeaderboardEntry[] = await res.json();
        setData(
          json.map((entry, i) => ({
            rank: entry.rank || i + 1,
            username: entry.username || 'Unknown',
            institution: entry.institution && entry.institution !== 'N/A' ? entry.institution : '',
            country: entry.country && entry.country !== 'N/A' ? entry.country : '',
            total_submission: entry.total_submission || 0,
            avatar: `/avatars/${(entry.username || 'user').toLowerCase()}.png`,
          })),
        );
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  const filteredData = useMemo(() => {
    return data.filter((entry) => {
      const matchesQuery = entry.username.toLowerCase().includes(query.toLowerCase());
      const matchesInstitution = institutionFilter === 'all' || institutionFilter === '' ? true : entry.institution === institutionFilter;
      return matchesQuery && matchesInstitution;
    });
  }, [data, query, institutionFilter]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredData, page]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* ── Hero Header ── */}
      <motion.div initial="hidden" animate="show" variants={staggerContainer} className={`relative overflow-hidden ${glassCard} p-8 md:p-10`}>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-500 opacity-95 rounded-2xl" />
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <motion.div variants={fadeInUp} className="relative z-10 flex items-center justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-sm font-medium text-white">
              <IconTrophy className="w-4 h-4" /> Top Contributors
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white">
              Leader<span className="bg-gradient-to-r from-white via-blue-100 to-sky-100 bg-clip-text text-transparent">board</span>
            </h1>
            <p className="text-blue-100 max-w-lg text-base">
              Recognizing the community members who drive heritage preservation forward.
            </p>
          </div>
          <div className="hidden md:block">
            <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/30">
              <IconTrophy className="w-12 h-12 text-yellow-300" />
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* ── Filters ── */}
      <motion.div initial="hidden" animate="show" variants={fadeInUp} className={`${glassCard} p-4`}>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <Input placeholder="Search by name..." value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            className="max-w-xs border-blue-200 dark:border-gray-600 focus:border-blue-400" />
          <Select value={institutionFilter} onValueChange={(value) => { setInstitutionFilter(value); setPage(1); }}>
            <SelectTrigger className="w-[200px] border-blue-200 dark:border-gray-600">
              <SelectValue placeholder="Filter by Institution" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Institutions</SelectItem>
              {[...new Set(data.map((d) => d.institution).filter(Boolean))].map((inst) => (
                <SelectItem key={inst} value={inst!}>{inst}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* ── Table ── */}
      <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeInUp} className={glassCard}>
        <div className="p-6">
          <h2 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-4">
            Top <span className="text-transparent bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text">Contributors</span>
          </h2>
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-r-transparent" />
              <p className="mt-3 text-blue-700 dark:text-blue-300">Loading leaderboard...</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-blue-200 dark:border-gray-700">
                    <TableHead className="w-[60px] text-blue-800 dark:text-blue-200">Rank</TableHead>
                    <TableHead className="text-blue-800 dark:text-blue-200">Name</TableHead>
                    <TableHead className="hidden md:table-cell text-blue-800 dark:text-blue-200">Institution</TableHead>
                    <TableHead className="hidden sm:table-cell text-center text-blue-800 dark:text-blue-200">Country</TableHead>
                    <TableHead className="text-right text-blue-800 dark:text-blue-200">Total Submissions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center p-4 text-blue-700 dark:text-blue-300">No contributors found.</TableCell>
                    </TableRow>
                  ) : (
                    paginatedData.map((entry) => (
                      <TableRow key={entry.rank} className={cn(
                        'hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors border-blue-100 dark:border-gray-800',
                        entry.rank === 1 && 'bg-yellow-100/60 dark:bg-yellow-900/20',
                        entry.rank === 2 && 'bg-gray-100/60 dark:bg-gray-800/20',
                        entry.rank === 3 && 'bg-amber-50/60 dark:bg-amber-900/20',
                      )}>
                        <TableCell className="font-semibold text-blue-600 dark:text-blue-400">#{entry.rank}</TableCell>
                        <TableCell className="flex items-center gap-3">
                          <Avatar className="border-2 border-blue-200 dark:border-gray-600">
                            <AvatarImage src={entry.avatar} alt={entry.username} />
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-sky-500 text-white text-xs">
                              {entry.username.split(' ').map((w) => w[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-blue-900 dark:text-blue-100">{entry.username}</span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-blue-700 dark:text-blue-300">{entry.institution || '-'}</TableCell>
                        <TableCell className="hidden sm:table-cell text-center text-xl">{entry.country || '-'}</TableCell>
                        <TableCell className="text-right font-semibold text-blue-900 dark:text-blue-100">{entry.total_submission}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              <div className="mt-4 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious onClick={() => setPage((prev) => Math.max(prev - 1, 1))} aria-disabled={page === 1} />
                    </PaginationItem>
                    <PaginationItem>
                      <span className="text-sm text-blue-700 dark:text-blue-300 px-3">Page {page} of {totalPages}</span>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))} aria-disabled={page === totalPages} />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
