'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export type TierType = 'apprentice' | 'scholar' | 'curator' | 'archivist' | 'grandkeeper';

/* ── Tier configuration with ring colors ── */
export const tierConfig: Record<TierType, {
  name: string;
  icon: string;
  ringClass: string;
  gradientFrom: string;
  gradientTo: string;
  glowClass: string;
}> = {
  apprentice: {
    name: 'Apprentice',
    icon: '🕯️',
    ringClass: 'ring-gray-400 dark:ring-gray-500',
    gradientFrom: 'from-gray-400',
    gradientTo: 'to-gray-500',
    glowClass: '',
  },
  scholar: {
    name: 'Scholar',
    icon: '📚',
    ringClass: 'ring-emerald-500 dark:ring-emerald-400',
    gradientFrom: 'from-emerald-500',
    gradientTo: 'to-green-600',
    glowClass: 'shadow-emerald-500/30',
  },
  curator: {
    name: 'Curator',
    icon: '🏛️',
    ringClass: 'ring-amber-500 dark:ring-amber-400',
    gradientFrom: 'from-amber-500',
    gradientTo: 'to-yellow-600',
    glowClass: 'shadow-amber-500/30',
  },
  archivist: {
    name: 'Archivist',
    icon: '📦',
    ringClass: 'ring-violet-500 dark:ring-violet-400',
    gradientFrom: 'from-violet-500',
    gradientTo: 'to-purple-600',
    glowClass: 'shadow-violet-500/30',
  },
  grandkeeper: {
    name: 'Grand Keeper',
    icon: '👑',
    ringClass: 'ring-yellow-500 dark:ring-yellow-400',
    gradientFrom: 'from-yellow-400',
    gradientTo: 'to-amber-500',
    glowClass: 'shadow-yellow-500/40 shadow-lg',
  },
};

/* ── Helper to get tier from icon ── */
export function getTierFromIcon(icon: string): TierType {
  switch (icon) {
    case '👑': return 'grandkeeper';
    case '📦': return 'archivist';
    case '🏛️': return 'curator';
    case '📚': return 'scholar';
    default: return 'apprentice';
  }
}

/* ── Helper to get tier from name ── */
export function getTierFromName(name: string): TierType {
  const normalized = name.toLowerCase().replace(/\s+/g, '');
  if (normalized.includes('grandkeeper') || normalized.includes('keeper')) return 'grandkeeper';
  if (normalized.includes('archivist')) return 'archivist';
  if (normalized.includes('curator')) return 'curator';
  if (normalized.includes('scholar')) return 'scholar';
  return 'apprentice';
}

interface RankAvatarProps {
  src?: string | null;
  name?: string;
  tier: TierType;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showGlow?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
  xl: 'h-20 w-20',
};

const ringWidthClasses = {
  sm: 'ring-2',
  md: 'ring-2',
  lg: 'ring-[3px]',
  xl: 'ring-4',
};

const textSizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-lg',
  xl: 'text-2xl',
};

export function RankAvatar({ 
  src, 
  name = '', 
  tier, 
  size = 'md',
  showGlow = true,
  className 
}: RankAvatarProps) {
  const config = tierConfig[tier];
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  return (
    <div className={cn(
      'relative rounded-full',
      showGlow && tier !== 'apprentice' && config.glowClass,
      className
    )}>
      {/* Gradient ring for higher tiers */}
      {tier !== 'apprentice' && (
        <div className={cn(
          'absolute inset-0 rounded-full bg-gradient-to-br opacity-90',
          config.gradientFrom,
          config.gradientTo,
          size === 'sm' && '-m-0.5 blur-[1px]',
          size === 'md' && '-m-0.5 blur-[1px]',
          size === 'lg' && '-m-1 blur-[2px]',
          size === 'xl' && '-m-1 blur-[2px]',
        )} />
      )}
      <Avatar className={cn(
        sizeClasses[size],
        ringWidthClasses[size],
        'ring-offset-2 ring-offset-background',
        config.ringClass,
        'relative z-10',
      )}>
        {src && <AvatarImage src={src} alt={name} />}
        <AvatarFallback className={cn(
          'bg-gradient-to-br text-white font-bold',
          config.gradientFrom,
          config.gradientTo,
          textSizeClasses[size],
        )}>
          {initials}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}

/* ── Simpler version without gradient background, just colored ring ── */
interface SimpleRankAvatarProps {
  src?: string | null;
  name?: string;
  tier: TierType;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function SimpleRankAvatar({ 
  src, 
  name = '', 
  tier, 
  size = 'md',
  className 
}: SimpleRankAvatarProps) {
  const config = tierConfig[tier];
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  // For grand keeper, use a special animated ring
  const isGrandKeeper = tier === 'grandkeeper';

  return (
    <div className={cn('relative', className)}>
      {/* Animated gradient ring for Grand Keeper */}
      {isGrandKeeper && (
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 animate-pulse opacity-50 blur-sm" 
          style={{ 
            margin: size === 'xl' ? '-4px' : size === 'lg' ? '-3px' : '-2px',
          }} 
        />
      )}
      <Avatar className={cn(
        sizeClasses[size],
        ringWidthClasses[size],
        'ring-offset-1 ring-offset-background',
        config.ringClass,
        isGrandKeeper && 'ring-yellow-500 dark:ring-yellow-400',
      )}>
        {src && <AvatarImage src={src} alt={name} className="object-cover" />}
        <AvatarFallback className={cn(
          'bg-gradient-to-br text-white font-bold',
          config.gradientFrom,
          config.gradientTo,
          textSizeClasses[size],
        )}>
          {initials}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}
