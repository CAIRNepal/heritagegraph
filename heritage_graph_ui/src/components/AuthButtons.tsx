'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconDotsVertical, IconLogout, IconUserCircle, IconMedal } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSession, signIn, signOut } from 'next-auth/react';
import { SimpleRankAvatar, tierConfig, TierType } from '@/components/rank-avatar';
import { apiFetch, apiFetchJson, getApiErrorMessage } from '@/lib/api-client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Standalone auth component — works anywhere (landing page, dashboard header,
 * etc.) without requiring SidebarProvider.
 */
export default function AuthSection() {
  const { data: session, status } = useSession();
  const [userSlug, setUserSlug] = useState<string | null>(null);
  const [backendInitError, setBackendInitError] = useState<string | null>(null);

  // Initialize user in backend when logged in
  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken) {
      const initUser = async () => {
        try {
          setBackendInitError(null);
          await apiFetch(`${API_BASE}/data/api/testthelogin`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
              Accept: 'application/json',
            },
          });
        } catch (err) {
          const msg = getApiErrorMessage(err);
          console.error('[AuthSection] backend user init failed:', msg);
          setBackendInitError(msg);
        }
      };
      initUser();
    }
  }, [status, session]);

  // Eagerly fetch slug if it's not in the session
  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken && !session?.user?.slug) {
      const fetchSlug = async () => {
        try {
          const data = await apiFetchJson<{ slug?: string }>(`${API_BASE}/data/api/user/me/`, {
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
              Accept: 'application/json',
            },
          });
          if (data.slug) setUserSlug(data.slug);
        } catch (err) {
          console.error('Error fetching user slug:', getApiErrorMessage(err));
        }
      };
      fetchSlug();
    } else if (session?.user?.slug) {
      setUserSlug(session.user.slug);
    }
  }, [status, session]);

  // Mock user tier - replace with API call to fetch actual tier
  const [userTier] = useState<TierType>('scholar');
  const tierInfo = tierConfig[userTier];

  if (!session) {
    return (
      <Button size="sm" onClick={() => signIn('google')}>
        Sign In with Google
      </Button>
    );
  }

  const userName = session.user?.name || 'User';
  const userEmail = session.user?.email || '';
  const userImage = session.user?.image || '';
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <div className="flex flex-col items-end gap-2">
      {backendInitError && (
        <Alert variant="destructive" className="max-w-xs py-2 text-left">
          <AlertTitle className="text-xs">Could not reach the server</AlertTitle>
          <AlertDescription className="text-xs">{backendInitError}</AlertDescription>
        </Alert>
      )}
      <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 px-2">
          <SimpleRankAvatar
            src={userImage}
            tier={userTier}
            size="sm"
          />
          <div className="hidden sm:flex flex-col items-start">
            <span className="truncate max-w-[120px] text-sm font-medium leading-tight">
              {userName}
            </span>
            <span className={`text-[10px] font-medium leading-tight ${tierInfo.ringClass.replace('ring-', 'text-').replace(' dark:ring-', ' dark:text-')}`}>
              {tierInfo.name}
            </span>
          </div>
          <IconDotsVertical className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 rounded-lg" align="end" sideOffset={4}>
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-2 py-1.5 text-left text-sm">
            <SimpleRankAvatar
              src={userImage}
              tier={userTier}
              size="md"
            />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{userName}</span>
              <span className="text-muted-foreground truncate text-xs">{userEmail}</span>
              <span className={`text-xs font-medium ${tierInfo.ringClass.replace('ring-', 'text-').replace(' dark:ring-', ' dark:text-')}`}>
                {tierInfo.name}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/" className="flex items-center gap-2">
              <IconUserCircle className="h-4 w-4" />
              Dashboard
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href={userSlug ? `/users/${userSlug}` : '#'}
              className="flex items-center gap-2"
            >
              <IconUserCircle className="h-4 w-4" />
              View Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/progression" className="flex items-center gap-2">
              <IconMedal className="h-4 w-4" />
              Progression
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => signOut({ callbackUrl: '/' })}
          >
            <IconLogout className="h-4 w-4" />
            Sign out
          </Button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </div>
  );
}
