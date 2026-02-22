'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowLeft, Scale, Eye, RefreshCw, Loader2 } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { motion } from 'framer-motion';
import { IconSparkles } from '@tabler/icons-react';

const fadeInUp = { hidden: { opacity: 0, y: 60 }, show: { opacity: 1, y: 0, transition: { duration: 0.8 } } };
const staggerContainer = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.3 } } };
const scaleIn = { hidden: { scale: 0.8, opacity: 0 }, show: { scale: 1, opacity: 1, transition: { duration: 0.6 } } };
const glassCard = 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-blue-200 dark:border-gray-700 rounded-2xl shadow-lg';

interface UserInfo { id: number; username: string; email: string; first_name: string; last_name: string; }
interface Contribution {
  entity_id: string; name: string; description: string; category: string; status: string;
  contributor: UserInfo; created_at: string; has_conflicts: boolean; flag_count: number; days_in_review: number;
}
interface ContributionsResponse { count: number; results: Contribution[]; }

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function ConflictsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [conflicts, setConflicts] = useState<Contribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getHeaders = useCallback(() => {
    const token = (session as Record<string, unknown>)?.accessToken as string | undefined;
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }, [session]);

  const fetchConflicts = useCallback(async () => {
    try {
      setIsLoading(true); setError(null);
      const res = await fetch(`${API_BASE}/data/api/review-queue/?queue_type=conflicts`, { headers: getHeaders() });
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const data: ContributionsResponse = await res.json();
      setConflicts(data.results);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load conflicts'); }
    finally { setIsLoading(false); }
  }, [getHeaders]);

  useEffect(() => { if (session) fetchConflicts(); }, [session, fetchConflicts]);

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="space-y-6">
        {/* ── Hero Header ── */}
        <motion.div initial="hidden" animate="show" variants={staggerContainer} className={`relative overflow-hidden ${glassCard} p-8`}>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-500 opacity-95 rounded-2xl" />
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <motion.div variants={fadeInUp} className="relative z-10">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/curation/review')} className="text-white/80 hover:text-white hover:bg-white/20">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to Queue
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-sm font-medium text-white">
                <Scale className="w-4 h-4" /> Highest Priority
              </div>
              <h1 className="text-3xl font-black text-white">
                Conflict <span className="bg-gradient-to-r from-white via-blue-100 to-sky-100 bg-clip-text text-transparent">Resolution</span>
              </h1>
              <p className="text-blue-100 max-w-2xl">
                Assertions that contradict existing accepted claims — highest priority for review.
              </p>
            </div>
            <div className="mt-4">
              <Button onClick={fetchConflicts} variant="outline" className="border-white/30 text-white hover:bg-white/20 gap-2">
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
            </div>
          </motion.div>
        </motion.div>

        {/* Conflict explanation card */}
        <motion.div initial="hidden" animate="show" variants={fadeInUp} className={`${glassCard} border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-950/20`}>
          <div className="p-6">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-medium text-amber-900 dark:text-amber-100">What are conflicts?</p>
                <p className="text-amber-800 dark:text-amber-300">
                  A conflict occurs when a new submission asserts a value for a property that contradicts an existing accepted assertion. For example, two different construction dates for the same temple. These require careful epistemic judgment — the reviewer must decide whether the new claim refines, supersedes, or genuinely contradicts the existing record.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Conflicts list */}
        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
            <p className="text-blue-700 dark:text-blue-300">Loading conflicts...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-blue-700 dark:text-blue-300 mb-4">{error}</p>
            <Button onClick={fetchConflicts} className="bg-gradient-to-r from-blue-600 to-sky-500 text-white">Try Again</Button>
          </div>
        ) : conflicts.length === 0 ? (
          <motion.div initial="hidden" animate="show" variants={scaleIn} className={`${glassCard} py-12 px-6 text-center`}>
            <Scale className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2 text-blue-900 dark:text-blue-100">No Unresolved Conflicts</h3>
            <p className="text-blue-700 dark:text-blue-300">All assertion conflicts have been resolved. Great work!</p>
          </motion.div>
        ) : (
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={staggerContainer} className="space-y-4">
            {conflicts.map((conflict) => (
              <motion.div key={conflict.entity_id} variants={scaleIn} className="group">
                <div className={`${glassCard} border-l-4 border-l-amber-500 hover:bg-white dark:hover:bg-gray-900 transition-all duration-500 transform hover:scale-[1.01] cursor-pointer overflow-hidden hover:shadow-xl`}
                  onClick={() => router.push(`/dashboard/curation/review/${conflict.entity_id}`)}>
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-orange-500 opacity-0 group-hover:opacity-5 transition-opacity duration-500 rounded-2xl" />
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <Badge variant="secondary" className="capitalize bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">{conflict.category}</Badge>
                          <span className="font-semibold text-lg text-blue-900 dark:text-blue-100">{conflict.name}</span>
                        </div>
                        {conflict.description && <p className="text-sm text-blue-700 dark:text-blue-300 line-clamp-2">{conflict.description}</p>}
                        <div className="flex items-center gap-4 text-xs text-blue-600 dark:text-blue-400">
                          <span>Submitted by @{conflict.contributor.username}</span>
                          <span>{new Date(conflict.created_at).toLocaleDateString()}</span>
                          <span>{conflict.days_in_review} days in review</span>
                          <Badge variant="destructive" className="text-[10px]">Conflict</Badge>
                        </div>
                      </div>
                      <Button size="sm" onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/curation/review/${conflict.entity_id}`); }}
                        className="bg-gradient-to-r from-blue-600 to-sky-500 text-white hover:from-blue-700 hover:to-sky-600 gap-1">
                        <Eye className="h-4 w-4" /> Resolve
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </>
  );
}
