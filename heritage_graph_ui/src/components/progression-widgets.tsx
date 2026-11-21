'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RankAvatar, getTierFromName, tierConfig, type TierType } from '@/components/rank-avatar';
import { cn } from '@/lib/utils';
import {
  IconTrophy,
  IconFlame,
  IconArrowRight,
  IconSparkles,
  IconChevronRight,
} from '@tabler/icons-react';

import { apiFetchJson } from '@/lib/api-client';
import { getPublicApiUrl } from '@/lib/api-base';

const API_BASE_URL = getPublicApiUrl();

/* ── Tier display info ── */
const tierDisplay: Record<string, { name: string; icon: string; next: string | null; accent: string }> = {
  apprentice: { name: 'Apprentice', icon: '🕯️', next: 'Scholar', accent: 'bg-chart-1' },
  scholar: { name: 'Scholar', icon: '📚', next: 'Curator', accent: 'bg-chart-3' },
  curator: { name: 'Curator', icon: '🏛️', next: 'Archivist', accent: 'bg-chart-2' },
  archivist: { name: 'Archivist', icon: '📦', next: 'Grand Keeper', accent: 'bg-chart-4' },
  grandkeeper: { name: 'Grand Keeper', icon: '👑', next: null, accent: 'bg-chart-5' },
};

interface UserProgressData {
  tier: TierType;
  rank: number;
  totalPoints: number;
  pointsToNextTier: number;
  progressPercent: number;
  medals: { gold: number; silver: number; bronze: number };
  recentActivity?: { type: string; points: number; label: string }[];
  streak?: number;
}

interface LeaderboardUser {
  user_id: number;
  username: string;
  full_name: string;
  score: number;
  tier_id: string;
  tier_icon: string;
}

/* ── Hook that fetches user progress from the backend ── */
function useUserProgress(): { progress: UserProgressData | null; leaderboard: LeaderboardUser[]; loading: boolean } {
  const { data: session } = useSession();
  const [progress, setProgress] = useState<UserProgressData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.accessToken) {
          headers['Authorization'] = `Bearer ${session.accessToken}`;
        }

        const data = await apiFetchJson<{
          leaderboard?: LeaderboardUser[];
          user_progress?: {
            tierId?: string;
            rank: number;
            totalPoints: number;
            pointsToNextTier: number;
            progressPercent: number;
            medals: { gold: number; silver: number; bronze: number };
            recentActivity?: { type: string; points: number; label: string }[];
            streak?: number;
          };
        }>(`${API_BASE_URL}/data/api/progression/`, { headers });
        setLeaderboard(data.leaderboard || []);

        if (data.user_progress) {
          const up = data.user_progress;
          setProgress({
            tier: (up.tierId || 'apprentice') as TierType,
            rank: up.rank,
            totalPoints: up.totalPoints,
            pointsToNextTier: up.pointsToNextTier,
            progressPercent: up.progressPercent,
            medals: up.medals,
            recentActivity: up.recentActivity?.slice(0, 3) || [],
            streak: up.streak,
          });
        }
      } catch (err) {
        // Widgets degrade to their empty state, but a failure here means the
        // contributor's progress is missing -- it must not vanish silently.
        console.error('Failed to load progression data', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [session?.accessToken]);

  return { progress, leaderboard, loading };
}

/* ── Compact Progress Badge (for headers/nav) ── */
export function UserProgressBadge({ className }: { className?: string }) {
  const { data: session } = useSession();
  const { progress } = useUserProgress();

  if (!session || !progress) return null;

  const tierInfo = tierDisplay[progress.tier] || tierDisplay.apprentice;
  const config = tierConfig[progress.tier] || tierConfig.apprentice;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href="/progression">
            <div
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 transition-all hover:scale-105',
                'bg-muted/60 dark:bg-muted/50',
                config.ringClass.replace('ring-', 'border-'),
                className,
              )}
            >
              <span className="text-lg">{tierInfo.icon}</span>
              <div className="hidden sm:block">
                <span className="text-sm font-semibold text-foreground">
                  {progress.totalPoints.toLocaleString()}
                </span>
                <span className="ml-1 text-xs text-muted-foreground">pts</span>
              </div>
              <IconChevronRight className="h-3 w-3 text-muted-foreground" />
            </div>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="p-3 text-popover-foreground">
          <div className="text-center">
            <div className="font-semibold">{tierInfo.name}</div>
            <div className="text-xs text-muted-foreground">Rank #{progress.rank} • {progress.totalPoints} pts</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {progress.pointsToNextTier} pts to {tierInfo.next || 'max'}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ── Minimal Widget (for sidebar or small spaces) ── */
export function ProgressionWidgetMini({ className }: { className?: string }) {
  const { data: session } = useSession();
  const { progress } = useUserProgress();

  if (!session || !progress) return null;

  const tierInfo = tierDisplay[progress.tier] || tierDisplay.apprentice;

  return (
    <Link href="/progression">
      <Card className={cn('hover:shadow-md transition-shadow cursor-pointer', className)}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <RankAvatar
              src={session.user?.image}
              name={session.user?.name || 'User'}
              tier={progress.tier}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg">{tierInfo.icon}</span>
                <span className="font-semibold text-sm truncate">{tierInfo.name}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Progress value={progress.progressPercent} className="h-1.5 flex-1" />
                <span className="text-xs text-muted-foreground">{progress.progressPercent}%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/* ── Full Dashboard Widget ── */
export function ProgressionWidgetFull({ className }: { className?: string }) {
  const { data: session } = useSession();
  const { progress, loading } = useUserProgress();

  if (!session || (!progress && !loading)) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <div className="bg-secondary p-6">
          <div className="flex items-center gap-3 mb-4">
            <IconTrophy className="h-8 w-8 text-medal-gold" />
            <div>
              <h3 className="font-bold text-lg">Start Your Journey</h3>
              <p className="text-sm text-muted-foreground">Sign in to track your contributions</p>
            </div>
          </div>
          <Button asChild className="">
            <Link href="/api/auth/signin">Sign In to Begin</Link>
          </Button>
        </div>
      </Card>
    );
  }

  if (loading || !progress) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <div className="p-6 space-y-4">
          <div className="h-20 bg-muted/30 rounded-lg animate-pulse" />
          <div className="h-4 bg-muted/30 rounded animate-pulse w-2/3" />
          <div className="h-3 bg-muted/30 rounded animate-pulse" />
        </div>
      </Card>
    );
  }

  const tierInfo = tierDisplay[progress.tier] || tierDisplay.apprentice;

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/*
        Tier header. The tier colour is a 3px rule, not the header background.
        Filling the header with the tier hue forced white text onto it, and the
        tier hues come from the chart ramp — which is light in dark mode, where
        white measured under 2:1. The rule carries identity as a second channel
        behind the tier's own name and icon; the text sits on a token surface
        that is legible in both themes.
      */}
      <div className="relative bg-secondary p-5">
        <div className={cn('absolute inset-x-0 top-0 h-[3px]', tierInfo.accent)} aria-hidden="true" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <RankAvatar
              src={session.user?.image}
              name={session.user?.name || 'User'}
              tier={progress.tier}
              size="lg"
              showGlow={false}
            />
            <div className="text-secondary-foreground">
              <h3 className="text-lg font-bold">{session.user?.name?.split(' ')[0]}</h3>
              <div className="flex items-center gap-2">
                <span className="text-xl">{tierInfo.icon}</span>
                <span className="font-medium">{tierInfo.name}</span>
              </div>
            </div>
          </div>
          <div className="text-right text-secondary-foreground">
            <div className="text-2xl font-bold tabular-nums">{progress.totalPoints.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Total Points</div>
          </div>
        </div>
      </div>

      <CardContent className="p-5 space-y-5">
        {/* Progress to next tier */}
        {tierInfo.next && (
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progress to {tierInfo.next}</span>
              <span className="font-semibold">{progress.progressPercent}%</span>
            </div>
            <div className="relative">
              <Progress value={progress.progressPercent} className="h-3" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 -translate-x-1">
                <span className="text-lg">{tierDisplay[getTierFromName(tierInfo.next) as TierType]?.icon}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              <span className="font-semibold text-success">{progress.pointsToNextTier}</span> more points needed
            </p>
          </div>
        )}

        {/* Medals */}
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
          <span className="text-sm font-medium">Your Seals</span>
          <div className="flex gap-3">
            <TooltipProvider>
              {[
                { type: 'gold', count: progress.medals.gold, label: 'Gold' },
                { type: 'silver', count: progress.medals.silver, label: 'Silver' },
                { type: 'bronze', count: progress.medals.bronze, label: 'Bronze' },
              ].map(({ type, count, label }) => (
                <Tooltip key={type}>
                  <TooltipTrigger>
                    <div className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold',
                      type === 'gold' && 'bg-medal-gold-soft text-medal-gold-on-soft',
                      type === 'silver' && 'bg-medal-silver-soft text-medal-silver-on-soft',
                      type === 'bronze' && 'bg-medal-bronze-soft text-medal-bronze-on-soft',
                      count === 0 && 'opacity-40'
                    )}>
                      <span className={cn(
                        'w-2 h-2 rounded-full',
                        type === 'gold' && 'bg-medal-gold',
                        type === 'silver' && 'bg-medal-silver',
                        type === 'bronze' && 'bg-medal-bronze',
                      )} />
                      {count}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{label} Seals</TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>
        </div>

        {/* Streak */}
        {progress.streak && progress.streak > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary p-3">
            <div className="rounded-full bg-primary p-2">
              <IconFlame className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <span className="font-semibold text-foreground">{progress.streak} day streak!</span>
              <p className="text-xs text-muted-foreground">Keep contributing to maintain it</p>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {progress.recentActivity && progress.recentActivity.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Recent Activity</h4>
            <div className="space-y-2">
              {progress.recentActivity.slice(0, 3).map((activity, i) => (
                <div key={i} className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-muted/30">
                  <span className="text-muted-foreground">{activity.label}</span>
                  <span className="font-semibold text-success">+{activity.points} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="flex gap-2 pt-2">
          <Button asChild variant="outline" className="flex-1">
            <Link href="/progression">
              View Details
              <IconArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
          <Button asChild className="flex-1">
            <Link href="/contribute">
              <IconSparkles className="w-4 h-4 mr-1" />
              Earn Points
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Leaderboard Preview Widget ── */
export function LeaderboardPreview({ className }: { className?: string }) {
  const { data: session } = useSession();
  const { progress, leaderboard, loading } = useUserProgress();

  const topContributors = leaderboard.slice(0, 3);

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <IconTrophy className="h-5 w-5 text-medal-gold" />
            Hall of Record
          </CardTitle>
          <Link href="/progression" className="flex items-center gap-1 text-sm text-primary hover:underline">
            See all <IconChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-8 bg-muted/30 rounded animate-pulse" />
            ))}
          </div>
        )}
        {!loading && topContributors.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No contributors yet</p>
        )}
        {!loading && topContributors.map((user, i) => {
          const tierInfo = tierDisplay[user.tier_id] || tierDisplay.apprentice;
          return (
            <div key={user.user_id} className="flex items-center gap-3">
              <span className={cn(
                'w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold',
                i === 0 && 'bg-medal-gold-soft text-medal-gold-on-soft',
                i === 1 && 'bg-medal-silver-soft text-medal-silver-on-soft',
                i === 2 && 'bg-medal-bronze-soft text-medal-bronze-on-soft',
              )}>
                {i + 1}
              </span>
              <span className="text-lg">{tierInfo.icon}</span>
              <span className="flex-1 font-medium truncate text-sm">{user.full_name || user.username}</span>
              <span className="text-sm font-semibold text-primary">{user.score.toLocaleString()}</span>
            </div>
          );
        })}

        {session && progress && (
          <>
            <div className="border-t pt-3 mt-3">
              <div className="flex items-center gap-3 rounded-lg bg-secondary p-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
                  {progress.rank}
                </span>
                <span className="text-lg">{(tierDisplay[progress.tier] || tierDisplay.apprentice).icon}</span>
                <span className="flex-1 font-medium truncate text-sm">You</span>
                <span className="text-sm font-semibold text-primary">{progress.totalPoints.toLocaleString()}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Achievement Celebration Toast ── */
export function AchievementToast({
  title,
  description,
  icon = '🎉',
  points
}: {
  title: string;
  description: string;
  icon?: string;
  points?: number;
}) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-lg"
    >
      <div className="text-3xl">{icon}</div>
      <div className="flex-1">
        <h4 className="font-bold text-foreground">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {points && (
        <div className="text-right">
          <span className="text-lg font-bold text-success">+{points}</span>
          <span className="text-xs block text-muted-foreground">points</span>
        </div>
      )}
    </motion.div>
  );
}

