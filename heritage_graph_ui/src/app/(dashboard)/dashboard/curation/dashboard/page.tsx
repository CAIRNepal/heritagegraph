'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle, ArrowRight, Calendar, CheckCircle, Clock, FileText,
  Flag, Loader2, RefreshCw, Scale, Shield, ShieldCheck, TrendingUp, User, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { IconSparkles, IconArrowRight } from '@tabler/icons-react';
import { fadeInUp, staggerContainer, scaleIn, glassCard } from '@/lib/design';

interface ReviewerRoleData {
  id: string;
  user: { id: number; username: string; email: string; first_name: string; last_name: string };
  role: string; expertise_areas: string[]; is_active: boolean;
  can_override_confidence: boolean; can_resolve_conflicts: boolean; can_manage_roles: boolean;
}
interface DomainActivityItem { entity_name: string; entity_id: string; activity_type: string; user: string; created_at: string; comment: string; }
interface DashboardData {
  queue_count: number; conflicts_count: number; flagged_count: number; expiring_count: number;
  resolved_this_week: number; accepted_this_week: number; rejected_this_week: number;
  total_reviewed: number; acceptance_rate: number; conflicts_resolved: number;
  reviewer_role: ReviewerRoleData | null; recent_domain_activity: DomainActivityItem[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const ROLE_LABELS: Record<string, string> = { community_reviewer: 'Community Reviewer', domain_expert: 'Domain Expert', expert_curator: 'Expert Curator' };

export default function ReviewerDashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getHeaders = useCallback(() => {
    const token = (session as Record<string, unknown>)?.accessToken as string | undefined;
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }, [session]);

  const fetchDashboard = useCallback(async () => {
    try { setIsLoading(true); setError(null);
      const res = await fetch(`${API_BASE}/data/api/reviewer-dashboard/`, { headers: getHeaders() });
      if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
      setDashboard(await res.json());
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load dashboard'); }
    finally { setIsLoading(false); }
  }, [getHeaders]);

  useEffect(() => { if (session) fetchDashboard(); }, [session, fetchDashboard]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
          <p className="text-blue-700 dark:text-blue-300">Loading reviewer dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-blue-700 dark:text-blue-300 mb-4">{error || 'Failed to load dashboard'}</p>
          <Button onClick={fetchDashboard} className="bg-gradient-to-r from-blue-600 to-sky-500 text-white">Try Again</Button>
        </div>
      </div>
    );
  }

  const userName = dashboard.reviewer_role ? `${dashboard.reviewer_role.user.first_name || dashboard.reviewer_role.user.username}` : 'Reviewer';
  const roleName = dashboard.reviewer_role ? ROLE_LABELS[dashboard.reviewer_role.role] || dashboard.reviewer_role.role : 'Not assigned';
  const expertiseAreas = dashboard.reviewer_role?.expertise_areas || [];

  return (
    <>

      <div className="space-y-6">
        {/* ── Hero Welcome ── */}
        <motion.div initial="hidden" animate="show" variants={staggerContainer} className={`relative overflow-hidden ${glassCard} p-8 md:p-10`}>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-500 opacity-95 rounded-2xl" />
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-sky-300/20 rounded-full blur-2xl animate-pulse" />
          <motion.div variants={fadeInUp} className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-sm font-medium text-white">
              <IconSparkles className="w-4 h-4" /> Reviewer Dashboard
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white">
              Welcome, <span className="bg-gradient-to-r from-white via-blue-100 to-sky-100 bg-clip-text text-transparent">{userName}</span>
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-white/20 text-white border-white/30 gap-1"><Shield className="h-3 w-3" /> {roleName}</Badge>
              {expertiseAreas.map((area) => (
                <Badge key={area} variant="outline" className="capitalize text-xs text-blue-100 border-white/30">{area.replace(/_/g, ' ')}</Badge>
              ))}
            </div>
            <div className="pt-2">
              <Button onClick={() => router.push('/dashboard/curation/review')}
                className="bg-white text-blue-700 hover:bg-blue-50 rounded-full font-semibold shadow-lg transition-all duration-300 transform hover:scale-105 gap-2">
                <FileText className="h-4 w-4" /> Open Review Queue
              </Button>
            </div>
          </motion.div>
        </motion.div>

        {/* ── Stats Row ── */}
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={staggerContainer}>
          <motion.h2 variants={fadeInUp} className="text-2xl font-bold mb-4 text-blue-900 dark:text-blue-100">
            Your <span className="text-transparent bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text">Stats</span>
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { title: 'In My Queue', value: dashboard.queue_count, icon: FileText, gradient: 'from-blue-500 to-sky-500',
                details: [
                  dashboard.conflicts_count > 0 && { icon: Scale, text: `${dashboard.conflicts_count} conflicts`, color: 'text-amber-600' },
                  dashboard.flagged_count > 0 && { icon: Flag, text: `${dashboard.flagged_count} flagged`, color: 'text-orange-600' },
                  dashboard.expiring_count > 0 && { icon: Clock, text: `${dashboard.expiring_count} expiring`, color: 'text-red-600' },
                ].filter(Boolean),
                onClick: () => router.push('/dashboard/curation/review'),
              },
              { title: 'Resolved This Week', value: dashboard.resolved_this_week, icon: ShieldCheck, gradient: 'from-green-500 to-emerald-500',
                details: [
                  { icon: CheckCircle, text: `${dashboard.accepted_this_week} accepted`, color: 'text-green-600' },
                  { icon: XCircle, text: `${dashboard.rejected_this_week} rejected`, color: 'text-red-600' },
                ],
              },
              { title: 'My Impact', value: dashboard.total_reviewed, icon: TrendingUp, gradient: 'from-blue-600 to-indigo-500',
                subtitle: 'claims reviewed',
                details: [
                  { icon: TrendingUp, text: `${dashboard.acceptance_rate}% acceptance rate`, color: 'text-blue-600' },
                  { icon: Scale, text: `${dashboard.conflicts_resolved} conflicts resolved`, color: 'text-amber-600' },
                ],
              },
            ].map((stat) => (
              <motion.div key={stat.title} variants={scaleIn} className="group relative">
                <div className={`relative p-6 ${glassCard} hover:bg-white dark:hover:bg-gray-900 transition-all duration-500 transform hover:scale-[1.02] overflow-hidden hover:shadow-xl ${stat.onClick ? 'cursor-pointer' : ''}`}
                  onClick={stat.onClick}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-2xl`} />
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-blue-600 dark:text-blue-400">{stat.title}</p>
                      <p className="text-4xl font-black mt-1 text-blue-900 dark:text-blue-100">{stat.value}</p>
                      {stat.subtitle && <p className="text-xs text-blue-600 dark:text-blue-400">{stat.subtitle}</p>}
                      <div className="mt-2 space-y-1 text-sm">
                        {stat.details.map((d: any, i: number) => d && (
                          <div key={i} className={`flex items-center gap-1 ${d.color}`}>
                            <d.icon className="h-3 w-3" /> {d.text}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className={`p-3 rounded-2xl bg-gradient-to-br ${stat.gradient} shadow-lg`}>
                      <stat.icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── Recent Domain Activity ── */}
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeInUp}>
          <div className={glassCard}>
            <div className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-5 w-5 text-blue-500" />
                <h2 className="text-xl font-bold text-blue-900 dark:text-blue-100">
                  Recent Activity in Your <span className="text-transparent bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text">Domain</span>
                </h2>
              </div>
              <p className="text-sm text-blue-600 dark:text-blue-400 mb-4">Latest submissions, reviews, and updates across heritage entities</p>
              {dashboard.recent_domain_activity.length === 0 ? (
                <p className="text-sm text-blue-600 dark:text-blue-400 text-center py-4">No recent activity in your domain</p>
              ) : (
                <div className="space-y-3">
                  {dashboard.recent_domain_activity.map((activity, idx) => (
                    <div key={`${activity.entity_id}-${idx}`}
                      className="flex items-start gap-3 py-2 border-b border-blue-100 dark:border-gray-800 last:border-0 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-gray-800/50 rounded-xl px-2 -mx-2 transition-all duration-300"
                      onClick={() => router.push(`/dashboard/curation/review/${activity.entity_id}`)}>
                      <ActivityIcon type={activity.activity_type} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate text-blue-900 dark:text-blue-100">{activity.entity_name}</span>
                          <Badge variant="secondary" className="text-[10px]">{activity.activity_type.replace(/_/g, ' ')}</Badge>
                        </div>
                        {activity.comment && <p className="text-xs text-blue-600 dark:text-blue-400 line-clamp-1 mt-0.5">{activity.comment}</p>}
                        <div className="flex items-center gap-2 text-xs text-blue-500 dark:text-blue-400 mt-0.5">
                          <span>by @{activity.user}</span><span>·</span>
                          <span>{new Date(activity.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-blue-400 shrink-0 mt-1" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Quick Navigation ── */}
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={staggerContainer}>
          <motion.h2 variants={fadeInUp} className="text-2xl font-bold mb-4 text-blue-900 dark:text-blue-100">
            Quick <span className="text-transparent bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text">Navigation</span>
          </motion.h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'Review Queue', desc: 'Review pending submissions', icon: FileText, onClick: () => router.push('/dashboard/curation/review'), gradient: 'from-blue-500 to-sky-500' },
              { title: 'Conflicts', desc: 'Resolve contradicting assertions', icon: Scale, onClick: () => router.push('/dashboard/curation/conflicts'), highlight: dashboard.conflicts_count > 0, gradient: 'from-amber-500 to-orange-500' },
              { title: 'Contributions', desc: 'Full contributions queue', icon: CheckCircle, onClick: () => router.push('/dashboard/curation/contributions'), gradient: 'from-blue-600 to-cyan-500' },
              { title: 'Activity Log', desc: 'Track all platform activity', icon: Clock, onClick: () => router.push('/dashboard/curation/activity'), gradient: 'from-sky-500 to-blue-600' },
            ].map((item) => (
              <motion.div key={item.title} variants={scaleIn} className="group relative">
                <div className={`relative p-5 ${glassCard} hover:bg-white dark:hover:bg-gray-900 transition-all duration-500 transform hover:scale-[1.02] overflow-hidden hover:shadow-xl cursor-pointer`}
                  onClick={item.onClick}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-2xl`} />
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl bg-gradient-to-br ${item.gradient} shadow-lg`}>
                      <item.icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-blue-900 dark:text-blue-100 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-sky-500 group-hover:bg-clip-text transition-all duration-300">{item.title}</p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">{item.desc}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </>
  );
}

function ActivityIcon({ type }: { type: string }) {
  const iconMap: Record<string, { icon: typeof FileText; color: string }> = {
    submitted: { icon: FileText, color: 'text-blue-500' }, accepted: { icon: CheckCircle, color: 'text-green-500' },
    rejected: { icon: XCircle, color: 'text-red-500' }, revised: { icon: RefreshCw, color: 'text-purple-500' },
    escalated: { icon: AlertTriangle, color: 'text-amber-500' }, changes_requested: { icon: ArrowRight, color: 'text-orange-500' },
    flagged: { icon: Flag, color: 'text-red-500' }, conflict_resolved: { icon: Scale, color: 'text-green-600' },
    commented: { icon: User, color: 'text-gray-500' },
  };
  const config = iconMap[type] || iconMap.commented;
  const Icon = config.icon;
  return <Icon className={`h-4 w-4 ${config.color} shrink-0 mt-0.5`} />;
}
