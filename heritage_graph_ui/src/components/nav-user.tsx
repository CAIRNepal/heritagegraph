'use client';


import Link from 'next/link';
import { IconDotsVertical, IconLogout, IconUserCircle } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

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
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

import { signOut, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { ConfirmActionDialog } from '@/components/confirm-action-dialog';
import { apiFetchJson, getApiErrorMessage } from '@/lib/api-client';
import { dataApiPath } from '@/lib/api-paths';
import { getPublicApiUrl } from '@/lib/api-base';
import { getPublicApiUrl } from '@/lib/api-base';
import { toast } from 'sonner';

const API_BASE = getPublicApiUrl();

export function NavUser({
  user,
}: {
  user: {
    name: string;
    email: string;
    avatar: string;
    username: string;
  };
}) {
  // Safely attempt to read sidebar context. If the component is rendered
  // outside of a SidebarProvider (e.g., on the landing page), `useSidebar`
  // throws — catch that and fall back to reasonable defaults.
  let isMobile = false;
  try {
    // keep hook call unconditional to satisfy rules of hooks
    const _sidebar = useSidebar();
    isMobile = _sidebar.isMobile;
  } catch (err) {
    isMobile = false;
  }
  const { data: session, status } = useSession();
  const t = useTranslations('user');
  const [userSlug, setUserSlug] = useState<string | null>(null);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);

  // Eagerly fetch slug if it's not in the session (e.g., first login before JWT refresh)
  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken && !session?.user?.slug) {
      const fetchSlug = async () => {
        try {
          if (!API_BASE) {
            toast.error('API is not configured. Set NEXT_PUBLIC_API_URL and reload.');
            return;
          }
          const data = await apiFetchJson<{ slug?: string }>(dataApiPath('user', 'me'), {
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
              Accept: 'application/json',
            },
          });
          if (data.slug) setUserSlug(data.slug);
        } catch (err) {
          const msg = getApiErrorMessage(err);
          toast.error('Could not load your profile link.', { description: msg });
        }
      };
      fetchSlug();
    } else if (session?.user?.slug) {
      setUserSlug(session.user.slug);
    }
  }, [status, session]);

  return (
    <>
      <ConfirmActionDialog
        open={signOutConfirmOpen}
        onOpenChange={setSignOutConfirmOpen}
        title={t('signOut')}
        description="You will be signed out of HeritageGraph on this device and need to sign in again to access your dashboard."
        confirmLabel={t('signOut')}
        confirmVariant="destructive"
        onConfirm={async () => {
          setSignOutConfirmOpen(false);
          await signOut({ callbackUrl: '/' });
        }}
      />
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg grayscale">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">
                  {user.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {user.email}
                </span>
              </div>
              <IconDotsVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">
                    {user.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/" className="flex items-center gap-2">
                  <IconUserCircle />
                  {t('home')}
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link
                  href={userSlug ? `/users/${userSlug}` : '#'}
                  className="flex items-center gap-2"
                >
                  <IconUserCircle />
                  {t('viewProfile')}
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link href="/account" 
                className="flex items-center gap-2">
                  <IconUserCircle />
                  {t('accountSettings')}
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
              <IconLogout />
              {t('signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
    </>
  );
}
