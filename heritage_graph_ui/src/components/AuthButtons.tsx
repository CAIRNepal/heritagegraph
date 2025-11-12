'use client';

import { SidebarFooter } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useSession, signIn } from 'next-auth/react';
import { NavUser } from '@/components/nav-user';

export default function AuthSection() {
  const { data: session } = useSession();

  return (
    <SidebarFooter>
      {session ? (
        <div className="flex flex-row">
          {/* User Info */}
          <NavUser
            user={{
              name: session.user?.name || 'User',
              // email: session.user?.email || '',
              avatar: '/avatars/shadcn.jpg', 
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 w-full">
          <Button className="w-full" onClick={() => signIn('keycloak')}>
            Sign In
          </Button>
        </div>
      )}
    </SidebarFooter>
  );
}
