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
import { ConfirmActionDialog } from '@/components/confirm-action-dialog';
import { SimpleRankAvatar, tierConfig, TierType } from '@/components/rank-avatar';
import { apiFetch, apiFetchJson, getApiErrorMessage } from '@/lib/api-client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getPublicApiUrl } from '@/lib/api-base';

const API_BASE = getPublicApiUrl();

/**
 * Standalone auth component — works anywhere (landing page, dashboard header,
 * etc.) without requiring SidebarProvider.
 */
export default function AuthSection() {
  const { data: session, status } = useSession();
  const [userSlug, setUserSlug] = useState<string | null>(null);
  const [backendInitError, setBackendInitError] = useState<string | null>(null);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);

  // Eagerly fetch slug if it's not in the session
  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken && !session?.user?.slug) {
      const fetchSlug = async () => {
        try {
          if (!API_BASE) {
            setBackendInitError('API is not configured. Set NEXT_PUBLIC_API_URL.');
            return;
          }
          const data = await apiFetchJson<{ slug?: string }>(`${API_BASE}/data/api/user/me/`, {
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
              Accept: 'application/json',
            },
          });
          if (data.slug) setUserSlug(data.slug);
        } catch (err) {
          setBackendInitError(getApiErrorMessage(err));
        }
      };
      fetchSlug();
    } else if (session?.user?.slug) {
      setUserSlug(session.user.slug);
    }
  }, [status, session]);

  const [userTier, setUserTier] = useState<TierType>('apprentice');

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken || !API_BASE) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetchJson<{ user_progress?: { tierId?: string } }>(
          `${API_BASE}/data/api/progression/`,
          {
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        );
        if (cancelled) return;
        const id = data.user_progress?.tierId as TierType | undefined;
        if (id && id in tierConfig) {
          setUserTier(id);
        }
      } catch {
        /* keep default apprentice */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, session?.accessToken]);

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
      <ConfirmActionDialog
        open={signOutConfirmOpen}
        onOpenChange={setSignOutConfirmOpen}
        title="Sign out?"
        description="You will be signed out of HeritageGraph on this device and need to sign in again to access your dashboard."
        confirmLabel="Sign out"
        confirmVariant="destructive"
        onConfirm={async () => {
          setSignOutConfirmOpen(false);
          await signOut({ callbackUrl: '/' });
        }}
      />
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
        <DropdownMenuItem
          className="flex cursor-pointer items-center gap-2"
          onSelect={(e) => {
            e.preventDefault();
            setSignOutConfirmOpen(true);
          }}
        >
          <IconLogout className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </div>
  );
}
