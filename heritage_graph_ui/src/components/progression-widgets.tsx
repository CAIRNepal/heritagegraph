'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RankAvatar, getTierFromName, tierConfig, type TierType } from '@/components/rank-avatar';
import { cn } from '@/lib/utils';
import {
  IconTrophy,
  IconMedal,
  IconFlame,
  IconArrowRight,
  IconSparkles,
  IconStar,
  IconArchive,
  IconPencil,
  IconSearch,
  IconPhoto,
  IconChevronRight,
  IconTarget,
} from '@tabler/icons-react';

/* ── Track data (matches progression page) ── */
const trackInfo = {
  curation: { name: 'Curation', icon: IconArchive, gradient: 'from-amber-500 to-orange-600', color: 'text-amber-600' },
  annotation: { name: 'Annotation', icon: IconPencil, gradient: 'from-emerald-500 to-teal-600', color: 'text-emerald-600' },
  verification: { name: 'Verification', icon: IconSearch, gradient: 'from-orange-600 to-red-600', color: 'text-orange-600' },
  exhibition: { name: 'Exhibition', icon: IconPhoto, gradient: 'from-violet-500 to-purple-600', color: 'text-violet-600' },
};

/* ── Tier display info ── */
const tierDisplay = {
  apprentice: { name: 'Apprentice', icon: '🕯️', next: 'Scholar', gradient: 'from-gray-400 to-gray-500' },
  scholar: { name: 'Scholar', icon: '📚', next: 'Curator', gradient: 'from-emerald-500 to-green-600' },
  curator: { name: 'Curator', icon: '🏛️', next: 'Archivist', gradient: 'from-amber-500 to-yellow-600' },
  archivist: { name: 'Archivist', icon: '📦', next: 'Grand Keeper', gradient: 'from-violet-500 to-purple-600' },
  grandkeeper: { name: 'Grand Keeper', icon: '👑', next: null, gradient: 'from-yellow-400 to-amber-500' },
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

/* ── Mock user progress (would come from API) ── */
function useUserProgress(): UserProgressData | null {
  const { data: session } = useSession();
  const [progress, setProgress] = useState<UserProgressData | null>(null);

  useEffect(() => {
    if (session) {
      // Mock data - replace with actual API call
      setProgress({
        tier: 'scholar',
        rank: 6,
        totalPoints: 1420,
        pointsToNextTier: 580,
        progressPercent: 71,
        medals: { gold: 0, silver: 2, bronze: 4 },
        recentActivity: [
          { type: 'submission', points: 15, label: 'Heritage entry submitted' },
          { type: 'review', points: 10, label: 'Peer review completed' },
          { type: 'annotation', points: 5, label: 'Added provenance note' },
        ],
        streak: 7,
      });
    }
  }, [session]);

  return progress;
}

/* ── Compact Progress Badge (for headers/nav) ── */
export function UserProgressBadge({ className }: { className?: string }) {
  const { data: session } = useSession();
  const progress = useUserProgress();

  if (!session || !progress) return null;

  const tierInfo = tierDisplay[progress.tier];
  const config = tierConfig[progress.tier];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href="/dashboard/progression">
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all hover:scale-105',
              'bg-gradient-to-r bg-opacity-10 cursor-pointer',
              config.ringClass.replace('ring-', 'border-'),
              className
            )}>
              <span className="text-lg">{tierInfo.icon}</span>
              <div className="hidden sm:block">
                <span className={cn('font-semibold text-sm', config.ringClass.replace('ring-', 'text-').replace('dark:ring-', 'dark:text-'))}>
                  {progress.totalPoints.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground ml-1">pts</span>
              </div>
              <IconChevronRight className="w-3 h-3 text-muted-foreground" />
            </div>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="p-3">
          <div className="text-center">
            <div className="font-semibold">{tierInfo.name}</div>
            <div className="text-xs text-muted-foreground">Rank #{progress.rank} • {progress.totalPoints} pts</div>
            <div className="text-xs text-emerald-600 mt-1">{progress.pointsToNextTier} pts to {tierInfo.next || 'max'}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ── Minimal Widget (for sidebar or small spaces) ── */
export function ProgressionWidgetMini({ className }: { className?: string }) {
  const { data: session } = useSession();
  const progress = useUserProgress();

  if (!session || !progress) return null;

  const tierInfo = tierDisplay[progress.tier];

  return (
    <Link href="/dashboard/progression">
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
  const progress = useUserProgress();

  if (!session || !progress) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <div className="bg-gradient-to-br from-amber-100 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 p-6">
          <div className="flex items-center gap-3 mb-4">
            <IconTrophy className="w-8 h-8 text-amber-500" />
            <div>
              <h3 className="font-bold text-lg">Start Your Journey</h3>
              <p className="text-sm text-muted-foreground">Sign in to track your contributions</p>
            </div>
          </div>
          <Button asChild className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600">
            <Link href="/api/auth/signin">Sign In to Begin</Link>
          </Button>
        </div>
      </Card>
    );
  }

  const tierInfo = tierDisplay[progress.tier];

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Header with gradient */}
      <div className={cn('bg-gradient-to-r p-5', tierInfo.gradient)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <RankAvatar
              src={session.user?.image}
              name={session.user?.name || 'User'}
              tier={progress.tier}
              size="lg"
              showGlow={false}
            />
            <div className="text-white">
              <h3 className="font-bold text-lg">{session.user?.name?.split(' ')[0]}</h3>
              <div className="flex items-center gap-2">
                <span className="text-xl">{tierInfo.icon}</span>
                <span className="font-medium opacity-90">{tierInfo.name}</span>
              </div>
            </div>
          </div>
          <div className="text-right text-white">
            <div className="text-2xl font-bold">{progress.totalPoints.toLocaleString()}</div>
            <div className="text-sm opacity-80">Total Points</div>
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
              <span className="font-semibold text-emerald-600">{progress.pointsToNextTier}</span> more points needed
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
                      type === 'gold' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
                      type === 'silver' && 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
                      type === 'bronze' && 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
                      count === 0 && 'opacity-40'
                    )}>
                      <span className={cn(
                        'w-2 h-2 rounded-full',
                        type === 'gold' && 'bg-gradient-to-br from-yellow-400 to-amber-500',
                        type === 'silver' && 'bg-gradient-to-br from-gray-300 to-gray-400',
                        type === 'bronze' && 'bg-gradient-to-br from-orange-400 to-amber-600',
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
          <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
            <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full">
              <IconFlame className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <span className="font-semibold text-orange-700 dark:text-orange-300">{progress.streak} day streak!</span>
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
                  <span className="font-semibold text-emerald-600">+{activity.points} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="flex gap-2 pt-2">
          <Button asChild variant="outline" className="flex-1">
            <Link href="/dashboard/progression">
              View Details
              <IconArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
          <Button asChild className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600">
            <Link href="/dashboard/contribute">
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
  const progress = useUserProgress();

  const topContributors = [
    { name: 'Dr. Elif Şahin', tier: 'grandkeeper', points: 4820 },
    { name: 'James Okafor', tier: 'archivist', points: 4105 },
    { name: 'María Castellanos', tier: 'archivist', points: 3760 },
  ];

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <IconTrophy className="w-5 h-5 text-yellow-500" />
            Hall of Record
          </CardTitle>
          <Link href="/dashboard/leaderboard" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
            See all <IconChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {topContributors.map((user, i) => {
          const tierInfo = tierDisplay[user.tier as TierType];
          return (
            <div key={i} className="flex items-center gap-3">
              <span className={cn(
                'w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold',
                i === 0 && 'bg-yellow-100 text-yellow-700',
                i === 1 && 'bg-gray-100 text-gray-600',
                i === 2 && 'bg-orange-100 text-orange-700',
              )}>
                {i + 1}
              </span>
              <span className="text-lg">{tierInfo.icon}</span>
              <span className="flex-1 font-medium truncate text-sm">{user.name}</span>
              <span className="text-sm text-amber-600 font-semibold">{user.points.toLocaleString()}</span>
            </div>
          );
        })}

        {session && progress && (
          <>
            <div className="border-t pt-3 mt-3">
              <div className="flex items-center gap-3 bg-amber-50/50 dark:bg-amber-950/20 p-2 rounded-lg">
                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                  {progress.rank}
                </span>
                <span className="text-lg">{tierDisplay[progress.tier].icon}</span>
                <span className="flex-1 font-medium truncate text-sm">You</span>
                <span className="text-sm text-amber-600 font-semibold">{progress.totalPoints.toLocaleString()}</span>
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
      className="flex items-center gap-4 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/50 dark:to-yellow-950/50 border border-amber-200 dark:border-amber-800 rounded-xl shadow-lg"
    >
      <div className="text-3xl">{icon}</div>
      <div className="flex-1">
        <h4 className="font-bold text-amber-900 dark:text-amber-100">{title}</h4>
        <p className="text-sm text-amber-700 dark:text-amber-300">{description}</p>
      </div>
      {points && (
        <div className="text-right">
          <span className="text-lg font-bold text-emerald-600">+{points}</span>
          <span className="text-xs block text-muted-foreground">points</span>
        </div>
      )}
    </motion.div>
  );
}

/* ── Motivation Quote Card ── */
export function MotivationCard({ className }: { className?: string }) {
  const quotes = [
    { text: "Every artifact tells a story. Every story you preserve connects the past to the future.", icon: "📜" },
    { text: "Heritage is not owned—it is borrowed from future generations. Thank you for being a steward.", icon: "🌱" },
    { text: "One entry may seem small, but together we're building an infinite library of human memory.", icon: "📚" },
    { text: "The best time to preserve heritage was 100 years ago. The second best time is now.", icon: "⏳" },
  ];
  
  // Use first quote for SSR, then randomize on client mount to prevent hydration mismatch
  const [quote, setQuote] = useState(quotes[0]);
  
  useEffect(() => {
    setQuote(quotes[Math.floor(Math.random() * quotes.length)]);
  }, []);

  return (
    <Card className={cn('bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/30 border-blue-200 dark:border-blue-800', className)}>
      <CardContent className="p-5 flex items-start gap-4">
        <span className="text-3xl">{quote.icon}</span>
        <div>
          <p className="text-blue-800 dark:text-blue-200 italic leading-relaxed">&ldquo;{quote.text}&rdquo;</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 font-medium">— HeritageGraph Community</p>
        </div>
      </CardContent>
    </Card>
  );
}
