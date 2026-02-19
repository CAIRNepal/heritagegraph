'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { IconDotsVertical, IconLogout, IconUserCircle } from '@tabler/icons-react';
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

/**
 * Standalone auth component — works anywhere (landing page, dashboard header,
 * etc.) without requiring SidebarProvider.
 */
export default function AuthSection() {
  const { data: session, status } = useSession();

  // Initialize user in backend when logged in
  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken) {
      const initUser = async () => {
        try {
          await fetch('http://localhost:8000/data/testthelogin', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.accessToken}`,
            },
            body: JSON.stringify({
              name: session.user?.name,
              email: session.user?.email,
            }),
          });
        } catch (err) {
          console.error('Error initializing user:', err);
        }
      };
      initUser();
    }
  }, [status, session]);

  if (!session) {
    return (
      <Button size="sm" onClick={() => signIn('google')}>
        Sign In with Google
      </Button>
    );
  }

  const userName = session.user?.name || 'User';
  const userEmail = session.user?.email || '';
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 px-2">
          <Avatar className="h-7 w-7 rounded-lg grayscale">
            <AvatarImage src="/avatars/shadcn.jpg" alt={userName} />
            <AvatarFallback className="rounded-lg text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline truncate max-w-[120px] text-sm font-medium">
            {userName}
          </span>
          <IconDotsVertical className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 rounded-lg" align="end" sideOffset={4}>
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-2 py-1.5 text-left text-sm">
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage src="/avatars/shadcn.jpg" alt={userName} />
              <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{userName}</span>
              <span className="text-muted-foreground truncate text-xs">{userEmail}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/dashboard" className="flex items-center gap-2">
              <IconUserCircle className="h-4 w-4" />
              Dashboard
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href={`/dashboard/users/${session.user?.username || 'me'}`}
              className="flex items-center gap-2"
            >
              <IconUserCircle className="h-4 w-4" />
              View Profile
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
  );
}
