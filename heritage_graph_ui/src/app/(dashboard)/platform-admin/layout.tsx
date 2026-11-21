'use client';

import { useSession } from 'next-auth/react';
import { Loader2, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { AccessDenied } from '@/components/access-denied';
import { UserRolesContext, useUserRolesProvider } from '@/hooks/use-user-roles';

export default function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status: sessionStatus } = useSession();
  const roles = useUserRolesProvider();

  if (sessionStatus === 'loading' || roles.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Checking access…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <Card className="max-w-lg w-full border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="flex flex-col items-center gap-6 py-12 px-8 text-center">
            <div className="rounded-full bg-amber-100 dark:bg-amber-900/40 p-4">
              <LogIn className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">Sign in required</h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                Sign in to access platform administration.
              </p>
            </div>
            <Button asChild>
              <Link href="/api/auth/signin">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canAccess =
    roles.isStaff ||
    (!!roles.reviewerRole?.is_active && !!roles.reviewerRole?.can_manage_roles);

  if (!canAccess) {
    return (
      <AccessDenied requiredRole="staff" userEmail={session.user?.email ?? null} />
    );
  }

  return (
    <UserRolesContext.Provider value={roles}>
      {children}
    </UserRolesContext.Provider>
  );
}
