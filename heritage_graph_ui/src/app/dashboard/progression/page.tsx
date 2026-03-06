'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RankAvatar, getTierFromIcon, getTierFromName, type TierType } from '@/components/rank-avatar';
import { cn } from '@/lib/utils';
import {
  IconTrophy,
  IconMedal,
  IconFlame,
  IconStar,
  IconCrown,
  IconSparkles,
  IconArchive,
  IconPencil,
  IconSearch,
  IconPhoto,
  IconBooks,
  IconUsers,
  IconCertificate,
  IconChartBar,
  IconAlertCircle,
  IconCheck,
  IconClockHour4,
  IconLoader2,
} from '@tabler/icons-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/* ── Animation variants ── */
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

/* ── Track definitions ── */
const tracks = [
  {
    id: 'curation',
    name: 'Curation',
    icon: IconArchive,
    tagline: 'Digitize, classify & preserve artifacts',
    description: 'Earn recognition for submitting, digitizing, and classifying heritage objects into the archive.',
    gradient: 'from-amber-500 to-orange-600',
    bgGradient: 'from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30',
    borderColor: 'border-amber-300 dark:border-amber-700',
    textColor: 'text-amber-700 dark:text-amber-300',
  },
  {
    id: 'annotation',
    name: 'Annotation',
    icon: IconPencil,
    tagline: 'Add provenance, context & scholarly notes',
    description: 'Earn recognition for adding scholarly annotations, provenance records, and contextual metadata.',
    gradient: 'from-emerald-500 to-teal-600',
    bgGradient: 'from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30',
    borderColor: 'border-emerald-300 dark:border-emerald-700',
    textColor: 'text-emerald-700 dark:text-emerald-300',
  },
  {
    id: 'verification',
    name: 'Verification',
    icon: IconSearch,
    tagline: 'Authenticate records & cross-reference sources',
    description: 'Earn recognition for peer-reviewing submissions and verifying factual accuracy of records.',
    gradient: 'from-orange-600 to-red-600',
    bgGradient: 'from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30',
    borderColor: 'border-orange-300 dark:border-orange-700',
    textColor: 'text-orange-700 dark:text-orange-300',
  },
  {
    id: 'exhibition',
    name: 'Exhibition',
    icon: IconPhoto,
    tagline: 'Curate & publish public collections',
    description: 'Earn recognition for publishing themed exhibitions that are viewed and engaged with publicly.',
    gradient: 'from-violet-500 to-purple-600',
    bgGradient: 'from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30',
    borderColor: 'border-violet-300 dark:border-violet-700',
    textColor: 'text-violet-700 dark:text-violet-300',
  },
];

/* ── Medal/Seal rules ── */
const medalRules = [
  { medal: 'Bronze', seal: 'bronze', ranges: ['Top 40%', 'Top 40%', 'Top 100', 'Top 10%'] },
  { medal: 'Silver', seal: 'silver', ranges: ['Top 20%', 'Top 20%', 'Top 50', 'Top 5%'] },
  { medal: 'Gold', seal: 'gold', ranges: ['Top 10%', 'Top 10', 'Top 10 + scaling', 'Top 10 + scaling'] },
];

/* ── Tier definitions ── */
const tierData = [
  {
    id: 'apprentice',
    name: 'Apprentice',
    icon: '🕯️',
    requirements: ['No medals required', 'Begin contributing'],
    gradient: 'from-gray-400 to-gray-500',
  },
  {
    id: 'scholar',
    name: 'Scholar',
    icon: '📚',
    requirements: ['2 Bronze seals', 'in any track'],
    gradient: 'from-emerald-500 to-green-600',
  },
  {
    id: 'curator',
    name: 'Curator',
    icon: '🏛️',
    requirements: ['1 Gold + 2 Silver seals', 'across tracks'],
    gradient: 'from-amber-500 to-yellow-600',
  },
  {
    id: 'archivist',
    name: 'Archivist',
    icon: '📦',
    requirements: ['5 Gold seals', '1 solo Gold seal'],
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    id: 'grandkeeper',
    name: 'Grand Keeper',
    icon: '👑',
    requirements: ['15 Gold seals', '5 solo Gold seals', 'Community award'],
    gradient: 'from-yellow-500 to-amber-600',
  },
];

/* ── Types ── */
interface TrackProgress {
  id: string;
  tier: string;
  points: number;
  nextTierPoints: number;
  percentage: number;
}

interface RecentActivityItem {
  type: string;
  points: number;
  label: string;
  created_at: string;
}

interface UserProgress {
  tier: string;
  tierIcon: string;
  tierId: string;
  rank: number;
  totalPoints: number;
  tracks: TrackProgress[];
  medals: { gold: number; silver: number; bronze: number };
  nextMilestone: string;
  nextTierPoints: number;
  pointsToNextTier: number;
  progressPercent: number;
  streak: number;
  recentActivity: RecentActivityItem[];
  breakdown: {
    entities: number;
    acceptedEntities: number;
    revisions: number;
    reviews: number;
    submissions: number;
  };
  fullName: string;
  institution: string;
  profileImage: string;
}

interface LeaderboardEntry {
  user_id: number;
  username: string;
  full_name: string;
  institution: string;
  profile_image: string;
  score: number;
  tier_name: string;
  tier_icon: string;
  tier_id: string;
  rank: number;
  medals: { gold: number; silver: number; bronze: number };
}

/* ── Seal badge component ── */
function SealBadge({ type, count }: { type: 'gold' | 'silver' | 'bronze'; count?: number }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold shadow-sm',
      type === 'gold' && 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700',
      type === 'silver' && 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300 border border-gray-300 dark:border-gray-600',
      type === 'bronze' && 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-300 dark:border-orange-700',
    )}>
      <span className={cn(
        'w-2.5 h-2.5 rounded-full',
        type === 'gold' && 'bg-gradient-to-br from-yellow-400 to-amber-500 shadow-amber-200 dark:shadow-amber-900/50',
        type === 'silver' && 'bg-gradient-to-br from-gray-300 to-gray-400 shadow-gray-200 dark:shadow-gray-700/50',
        type === 'bronze' && 'bg-gradient-to-br from-orange-400 to-amber-600 shadow-orange-200 dark:shadow-orange-900/50',
      )} />
      {count !== undefined ? `×${count}` : type.charAt(0).toUpperCase() + type.slice(1)}
    </span>
  );
}

/* ── Progress bar component ── */
function ProgressBar({ value, max, gradient }: { value: number; max: number; gradient: string }) {
  const percentage = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className={cn('h-full rounded-full bg-gradient-to-r', gradient)}
      />
    </div>
  );
}

/* ── Rank icon component ── */
function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <IconTrophy className="w-5 h-5 text-yellow-500" />;
  if (rank === 2) return <IconMedal className="w-5 h-5 text-gray-400" />;
  if (rank === 3) return <IconMedal className="w-5 h-5 text-amber-600" />;
  return <span className="text-sm font-mono text-muted-foreground">{rank}</span>;
}

/* ── Loading skeleton ── */
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-40 bg-muted/30 rounded-2xl animate-pulse" />
      <div className="h-12 bg-muted/30 rounded-xl animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-36 bg-muted/30 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export default function ProgressionPage() {
  const { data: session } = useSession();
  const [selectedTrack, setSelectedTrack] = useState('curation');
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgression = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session?.accessToken) {
        headers['Authorization'] = `Bearer ${session.accessToken}`;
      }

      const res = await fetch(`${API_BASE_URL}/data/api/progression/`, { headers });

      if (!res.ok) {
        throw new Error(`Failed to fetch progression data (${res.status})`);
      }

      const data = await res.json();
      setUserProgress(data.user_progress);
      setLeaderboard(data.leaderboard || []);
    } catch (err) {
      console.error('Failed to fetch progression:', err);
      setError(err instanceof Error ? err.message : 'Failed to load progression data');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    fetchProgression();
  }, [fetchProgression]);

  const selectedTrackData = tracks.find(t => t.id === selectedTrack);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <IconAlertCircle className="w-12 h-12 text-destructive" />
        <p className="text-destructive font-medium">{error}</p>
        <button onClick={fetchProgression} className="text-sm text-blue-600 hover:underline">
          Try again
        </button>
      </div>
    );
  }

  // Fallback for unauthenticated users (userProgress will be null)
  const displayProgress: UserProgress = userProgress || {
    tier: 'Apprentice',
    tierIcon: '🕯️',
    tierId: 'apprentice',
    rank: 0,
    totalPoints: 0,
    tracks: tracks.map(t => ({ id: t.id, tier: 'Apprentice', points: 0, nextTierPoints: 15, percentage: 0 })),
    medals: { gold: 0, silver: 0, bronze: 0 },
    nextMilestone: 'Start contributing to begin your journey.',
    nextTierPoints: 100,
    pointsToNextTier: 100,
    progressPercent: 0,
    streak: 0,
    recentActivity: [],
    breakdown: { entities: 0, acceptedEntities: 0, revisions: 0, reviews: 0, submissions: 0 },
    fullName: '',
    institution: '',
    profileImage: '',
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* ── Page Header ── */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={staggerContainer}
          className="relative overflow-hidden bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-blue-200 dark:border-gray-700 rounded-2xl shadow-lg p-6 md:p-8"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-orange-500/10 rounded-2xl" />
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-300/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-amber-300/20 rounded-full blur-3xl" />

          <motion.div variants={fadeInUp} className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-full text-sm font-medium text-amber-700 dark:text-amber-300 mb-3">
                <IconTrophy className="w-4 h-4" />
                Heritage Progression System
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                Track Your Scholarly{' '}
                <span className="text-transparent bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text">
                  Contributions
                </span>
              </h1>
              <p className="text-muted-foreground mt-2 max-w-xl">
                Grow your standing in the living archive through curation, annotation, verification, and exhibition of cultural heritage.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-4xl">{displayProgress.tierIcon}</div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Current Rank</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{displayProgress.tier}</div>
                {displayProgress.rank > 0 && (
                  <div className="text-xs text-muted-foreground">#{displayProgress.rank} overall</div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* ── Tabs Navigation ── */}
        <Tabs defaultValue="tracks" className="w-full">
          <TabsList className="w-full justify-start bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-blue-200 dark:border-gray-700 rounded-xl p-1 gap-1">
            <TabsTrigger value="tracks" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-yellow-500 data-[state=active]:text-white">
              <IconFlame className="w-4 h-4 mr-2" />
              Tracks
            </TabsTrigger>
            <TabsTrigger value="medals" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-yellow-500 data-[state=active]:text-white">
              <IconMedal className="w-4 h-4 mr-2" />
              Seals & Medals
            </TabsTrigger>
            <TabsTrigger value="tiers" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-yellow-500 data-[state=active]:text-white">
              <IconCrown className="w-4 h-4 mr-2" />
              Ranks
            </TabsTrigger>
            <TabsTrigger value="progress" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-yellow-500 data-[state=active]:text-white">
              <IconChartBar className="w-4 h-4 mr-2" />
              Your Progress
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-yellow-500 data-[state=active]:text-white">
              <IconTrophy className="w-4 h-4 mr-2" />
              Hall of Record
            </TabsTrigger>
          </TabsList>

          {/* ── Tracks Tab ── */}
          <TabsContent value="tracks" className="mt-6">
            <motion.div initial="hidden" animate="show" variants={staggerContainer}>
              <motion.div variants={fadeInUp}>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Contribution Tracks</h2>
                <p className="text-muted-foreground mb-6">
                  The Heritage Progression System honours contributions across four scholarly disciplines.
                  Each track awards Seals and advances your standing independently.
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {tracks.map((track) => {
                  const Icon = track.icon;
                  const isSelected = selectedTrack === track.id;
                  const trackProg = displayProgress.tracks.find(t => t.id === track.id);
                  return (
                    <motion.div key={track.id} variants={fadeInUp}>
                      <Card
                        className={cn(
                          'cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 bg-gradient-to-br',
                          track.bgGradient,
                          isSelected ? `ring-2 ring-offset-2 ${track.borderColor}` : 'border-gray-200 dark:border-gray-700'
                        )}
                        onClick={() => setSelectedTrack(track.id)}
                      >
                        <CardHeader className="pb-2">
                          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br', track.gradient)}>
                            <Icon className="w-6 h-6 text-white" />
                          </div>
                        </CardHeader>
                        <CardContent>
                          <CardTitle className={cn('text-lg mb-1', track.textColor)}>{track.name}</CardTitle>
                          <CardDescription className="text-sm">{track.tagline}</CardDescription>
                          {trackProg && trackProg.points > 0 && (
                            <div className="mt-2">
                              <ProgressBar value={trackProg.points} max={trackProg.nextTierPoints} gradient={track.gradient} />
                              <span className="text-xs text-muted-foreground font-mono mt-1">{trackProg.points} pts</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>

              {selectedTrackData && (
                <motion.div variants={fadeInUp}>
                  <Card className={cn('bg-gradient-to-br border-l-4', selectedTrackData.bgGradient, selectedTrackData.borderColor)}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        <selectedTrackData.icon className={cn('w-6 h-6', selectedTrackData.textColor)} />
                        <CardTitle className={selectedTrackData.textColor}>{selectedTrackData.name} Track</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">{selectedTrackData.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              <motion.div variants={fadeInUp} className="mt-6">
                <Card className="bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/30 border-l-4 border-blue-400">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <IconClockHour4 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <CardTitle className="text-blue-700 dark:text-blue-300 text-base">On the Weathering of Points</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">
                      Like ancient parchment, contribution points weather gracefully over time. Points awarded
                      more than 180 days ago decay at a rate proportional to their age, encouraging continued
                      active stewardship of the archive. Recent contributions always carry full weight.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </TabsContent>

          {/* ── Medals Tab ── */}
          <TabsContent value="medals" className="mt-6">
            <motion.div initial="hidden" animate="show" variants={staggerContainer} className="space-y-6">
              <motion.div variants={fadeInUp}>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Seals of Recognition</h2>
                <p className="text-muted-foreground mb-6">
                  Wax seals are awarded for achieving top standings in verified contribution campaigns.
                  Each campaign states its eligibility for seal awards on its overview page.
                </p>
              </motion.div>

              <motion.div variants={fadeInUp}>
                <Card>
                  <CardContent className="p-0 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-800 hover:to-gray-900">
                          <TableHead className="text-white font-semibold">Seal</TableHead>
                          <TableHead className="text-white font-semibold">Small (&lt;100)</TableHead>
                          <TableHead className="text-white font-semibold">Medium (100–249)</TableHead>
                          <TableHead className="text-white font-semibold">Large (250–999)</TableHead>
                          <TableHead className="text-white font-semibold">Grand (1000+)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {medalRules.map((row, index) => (
                          <TableRow key={row.medal} className={index % 2 === 0 ? 'bg-muted/30' : ''}>
                            <TableCell>
                              <SealBadge type={row.seal as 'gold' | 'silver' | 'bronze'} />
                            </TableCell>
                            {row.ranges.map((range, i) => (
                              <TableCell key={i} className="text-muted-foreground font-mono text-sm">{range}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={fadeInUp}>
                <Card className="bg-gradient-to-r from-gray-800 to-gray-900 text-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-yellow-400 flex items-center gap-2">
                      <IconSparkles className="w-5 h-5" />
                      Gold Seal Scaling
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="font-mono text-sm space-y-2">
                    <p className="text-gray-300">For Grand campaigns (1000+ contributors):</p>
                    <p>Gold awarded to: <span className="text-yellow-400 font-bold">Top 10 + ⌊(n − 1000) / 500⌋</span> contributors</p>
                    <p className="text-gray-400 text-xs mt-3">
                      e.g. a campaign with 5,000 contributors awards gold to the top 18. Percentages are always rounded down.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={fadeInUp}>
                <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-l-4 border-amber-400">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <IconCertificate className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      <CardTitle className="text-amber-700 dark:text-amber-300 text-base">Seal Eligibility</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">
                      Seals are only awarded in formally designated campaigns. Collaborative community submissions,
                      exploratory uploads, and practice entries do not contribute toward seal tallies.
                      Each campaign clearly marks its seal eligibility in its brief.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </TabsContent>

          {/* ── Tiers Tab ── */}
          <TabsContent value="tiers" className="mt-6">
            <motion.div initial="hidden" animate="show" variants={staggerContainer} className="space-y-6">
              <motion.div variants={fadeInUp}>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Ranks of the Archive</h2>
                <p className="text-muted-foreground mb-6">
                  Your accumulated seals across all tracks determine your standing in the living archive.
                  Rank is a mark of sustained scholarly commitment, not a single achievement.
                </p>
              </motion.div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {tierData.map((tier) => (
                  <motion.div key={tier.id} variants={fadeInUp}>
                    <Card className={cn(
                      'text-center hover:shadow-lg transition-shadow h-full',
                      displayProgress.tierId === tier.id && 'ring-2 ring-amber-400 ring-offset-2'
                    )}>
                      <CardContent className="pt-6 flex flex-col items-center h-full">
                        <span className="text-4xl mb-3">{tier.icon}</span>
                        <h3 className={cn(
                          'font-bold text-lg mb-2 text-transparent bg-gradient-to-r bg-clip-text',
                          tier.gradient
                        )}>
                          {tier.name}
                        </h3>
                        <div className="text-xs text-muted-foreground space-y-1 flex-1">
                          {tier.requirements.map((req, i) => (
                            <p key={i}>{req}</p>
                          ))}
                        </div>
                        {displayProgress.tierId === tier.id && (
                          <Badge className="mt-2 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            Your Rank
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              <motion.div variants={fadeInUp}>
                <Card className="bg-gradient-to-r from-gray-800 to-gray-900 text-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-yellow-400 flex items-center gap-2">
                      <IconChartBar className="w-5 h-5" />
                      Points Formula
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="font-mono text-sm space-y-2">
                    <p>P(t) = <span className="text-yellow-400 font-bold">BaseScore × ContributionWeight × e<sup>−λt</sup></span></p>
                    <p className="text-gray-400 text-xs mt-3">
                      where <span className="text-yellow-400">t</span> = days since contribution,{' '}
                      <span className="text-yellow-400">λ</span> = 0.004 (decay constant),{' '}
                      <span className="text-yellow-400">ContributionWeight</span> = adjusted for campaign size &amp; solo/collaborative status
                    </p>
                    <p className="text-gray-400 text-xs mt-2">
                      Rankings are ordered by current live point totals (decay applied). Top 2,500 contributors appear in the public register.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </TabsContent>

          {/* ── Progress Tab ── */}
          <TabsContent value="progress" className="mt-6">
            <motion.div initial="hidden" animate="show" variants={staggerContainer} className="space-y-6">
              {/* Profile Header */}
              <motion.div variants={fadeInUp}>
                <Card className="bg-gradient-to-r from-gray-800 to-gray-900 text-white overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-5">
                      <RankAvatar
                        src={session?.user?.image}
                        name={session?.user?.name || 'User'}
                        tier={getTierFromName(displayProgress.tier)}
                        size="xl"
                        showGlow={true}
                      />
                      <div>
                        <h2 className="text-xl font-bold">{session?.user?.name || displayProgress.fullName || 'Independent Contributor'}</h2>
                        <Badge variant="outline" className="bg-yellow-500/20 text-yellow-300 border-yellow-500 mt-1">
                          {displayProgress.tierIcon} {displayProgress.tier}
                          {displayProgress.rank > 0 && ` — Rank #${displayProgress.rank} overall`}
                        </Badge>
                        {displayProgress.institution && (
                          <p className="text-sm text-gray-400 mt-1">{displayProgress.institution}</p>
                        )}
                      </div>
                      <div className="ml-auto text-right">
                        <div className="text-3xl font-bold text-yellow-400">{displayProgress.totalPoints.toLocaleString()}</div>
                        <div className="text-sm text-gray-400">Total Points</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Contribution Breakdown */}
              <motion.div variants={fadeInUp}>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Contribution Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: 'Entities', value: displayProgress.breakdown.entities, icon: IconArchive },
                    { label: 'Accepted', value: displayProgress.breakdown.acceptedEntities, icon: IconCheck },
                    { label: 'Revisions', value: displayProgress.breakdown.revisions, icon: IconPencil },
                    { label: 'Reviews', value: displayProgress.breakdown.reviews, icon: IconSearch },
                    { label: 'Submissions', value: displayProgress.breakdown.submissions, icon: IconBooks },
                  ].map(({ label, value, icon: Icon }) => (
                    <Card key={label}>
                      <CardContent className="p-4 text-center">
                        <Icon className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                        <div className="text-2xl font-bold">{value}</div>
                        <div className="text-xs text-muted-foreground">{label}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </motion.div>

              {/* Track Progress */}
              <motion.div variants={fadeInUp}>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Track Progress</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {displayProgress.tracks.map((progress) => {
                    const track = tracks.find(t => t.id === progress.id)!;
                    const Icon = track.icon;
                    return (
                      <Card key={progress.id} className={cn('bg-gradient-to-br border-l-4', track.bgGradient, track.borderColor)}>
                        <CardContent className="p-5">
                          <div className="flex items-center gap-3 mb-2">
                            <Icon className={cn('w-5 h-5', track.textColor)} />
                            <span className={cn('font-semibold', track.textColor)}>{track.name}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">Current rank: {progress.tier}</p>
                          <ProgressBar value={progress.points} max={progress.nextTierPoints} gradient={track.gradient} />
                          <div className="flex justify-between text-xs text-muted-foreground mt-2 font-mono">
                            <span>{progress.points} pts</span>
                            <span>{progress.nextTierPoints} pts to next rank</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </motion.div>

              {/* Medals */}
              <motion.div variants={fadeInUp}>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Your Seals</h3>
                <div className="flex flex-wrap gap-3">
                  <SealBadge type="gold" count={displayProgress.medals.gold} />
                  <SealBadge type="silver" count={displayProgress.medals.silver} />
                  <SealBadge type="bronze" count={displayProgress.medals.bronze} />
                </div>
              </motion.div>

              {/* Streak */}
              {displayProgress.streak > 0 && (
                <motion.div variants={fadeInUp}>
                  <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full">
                      <IconFlame className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <span className="font-semibold text-orange-700 dark:text-orange-300">{displayProgress.streak} day streak!</span>
                      <p className="text-xs text-muted-foreground">Keep contributing to maintain it</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Recent Activity */}
              {displayProgress.recentActivity.length > 0 && (
                <motion.div variants={fadeInUp}>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
                  <Card>
                    <CardContent className="p-0">
                      <div className="divide-y divide-border">
                        {displayProgress.recentActivity.map((activity, i) => (
                          <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                            <span className="text-sm text-muted-foreground">{activity.label}</span>
                            {activity.points > 0 && (
                              <span className="font-semibold text-emerald-600 text-sm">+{activity.points} pts</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Next Milestone */}
              <motion.div variants={fadeInUp}>
                <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-l-4 border-emerald-400">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <IconStar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      <CardTitle className="text-emerald-700 dark:text-emerald-300 text-base">Next Milestone</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">
                      {displayProgress.nextMilestone}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </TabsContent>

          {/* ── Leaderboard Tab ── */}
          <TabsContent value="leaderboard" className="mt-6">
            <motion.div initial="hidden" animate="show" variants={staggerContainer} className="space-y-6">
              <motion.div variants={fadeInUp}>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Hall of Record</h2>
                <p className="text-muted-foreground mb-6">
                  The living register of the archive&apos;s most distinguished contributors.
                  Rankings reflect current points after temporal weathering. Updated in real-time.
                </p>
              </motion.div>

              <motion.div variants={fadeInUp}>
                <Card className="overflow-hidden">
                  <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-5 py-3 flex justify-between items-center">
                    <span className="text-white font-semibold">Contributor</span>
                    <span className="text-white font-semibold">Live Points</span>
                  </div>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {leaderboard.length === 0 && (
                        <div className="px-5 py-8 text-center text-muted-foreground">
                          No contributors yet. Be the first to earn points!
                        </div>
                      )}
                      {leaderboard.map((row) => {
                        const isCurrentUser = session?.user && (
                          row.username === session.user.name ||
                          row.username === (session.user as Record<string, unknown>).username
                        );
                        return (
                          <div
                            key={row.user_id}
                            className={cn(
                              'grid grid-cols-[3rem_auto_1fr_auto_auto] items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors',
                              isCurrentUser && 'bg-amber-50/50 dark:bg-amber-950/20'
                            )}
                          >
                            <div className="flex items-center justify-center">
                              <RankIcon rank={row.rank} />
                            </div>
                            <RankAvatar
                              src={row.profile_image || null}
                              name={row.full_name || row.username}
                              tier={row.tier_id as TierType}
                              size="md"
                            />
                            <div>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {row.full_name || row.username}
                                {isCurrentUser && <span className="text-amber-600 ml-2">← you</span>}
                              </div>
                              {row.institution && (
                                <div className="text-sm text-muted-foreground">{row.institution}</div>
                              )}
                              <div className="flex gap-2 mt-1.5">
                                {row.medals.gold > 0 && <SealBadge type="gold" count={row.medals.gold} />}
                                {row.medals.silver > 0 && <SealBadge type="silver" count={row.medals.silver} />}
                                {row.medals.bronze > 0 && <SealBadge type="bronze" count={row.medals.bronze} />}
                              </div>
                            </div>
                            <div className="font-mono font-bold text-amber-600 dark:text-amber-400 text-right">
                              {row.score.toLocaleString()} pts
                            </div>
                            <div className="text-2xl">{row.tier_icon}</div>
                          </div>
                        );
                      })}

                      {/* Show current user if not in leaderboard */}
                      {userProgress && userProgress.rank > leaderboard.length && (
                        <div className="grid grid-cols-[3rem_auto_1fr_auto_auto] items-center gap-4 px-5 py-4 bg-amber-50/50 dark:bg-amber-950/20">
                          <div className="flex items-center justify-center">
                            <span className="text-sm font-mono text-muted-foreground">{userProgress.rank}</span>
                          </div>
                          <RankAvatar
                            src={session?.user?.image}
                            name={session?.user?.name || 'User'}
                            tier={getTierFromName(userProgress.tier)}
                            size="md"
                          />
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {session?.user?.name || 'You'} <span className="text-amber-600">← you</span>
                            </div>
                            {userProgress.institution && (
                              <div className="text-sm text-muted-foreground">{userProgress.institution}</div>
                            )}
                            <div className="flex gap-2 mt-1.5">
                              {userProgress.medals.bronze > 0 && <SealBadge type="bronze" count={userProgress.medals.bronze} />}
                              {userProgress.medals.silver > 0 && <SealBadge type="silver" count={userProgress.medals.silver} />}
                              {userProgress.medals.gold > 0 && <SealBadge type="gold" count={userProgress.medals.gold} />}
                            </div>
                          </div>
                          <div className="font-mono font-bold text-amber-600 dark:text-amber-400 text-right">
                            {userProgress.totalPoints.toLocaleString()} pts
                          </div>
                          <div className="text-2xl">{userProgress.tierIcon}</div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={fadeInUp}>
                <Card className="bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/30 border-l-4 border-blue-400">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <IconUsers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <CardTitle className="text-blue-700 dark:text-blue-300 text-base">On the Register</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">
                      The public Hall of Record lists the top 2,500 contributors globally.
                      Rankings are computed using live-decayed point totals.
                      Points awarded for solo contributions carry a <strong>1.25× weight multiplier</strong>.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
