'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User, KeyRound, MonitorSmartphone } from 'lucide-react';

import { glassCard } from '@/lib/design';
import { ConfirmActionDialog } from '@/components/confirm-action-dialog';

export default function MyAccount() {
  const { data: session, status } = useSession();
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (status !== 'authenticated' || !session?.user) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-4 md:p-6">
        <div className={`${glassCard} p-6`}>
          <h1 className="text-xl font-semibold text-primary dark:text-primary">
            Account
          </h1>
          <p className="mt-2 text-sm text-primary dark:text-primary">
            Sign in to see your profile and session details.
          </p>
          <Button asChild className="mt-4">
            <Link href="/auth/login?callbackUrl=/account">Sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  const email = session.user.email ?? '';
  const name = session.user.name ?? '—';
  const image = session.user.image;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary dark:text-primary">
          Account
        </h1>
        <p className="mt-1 text-sm text-primary dark:text-primary">
          Profile information comes from your sign-in provider. HeritageGraph does not store a separate shadow password for Google accounts.
        </p>
      </div>

      <Card className={glassCard}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="size-5" aria-hidden />
            Profile
          </CardTitle>
          <CardDescription>Shown to curators and on public surfaces where you contribute.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {image ? (
              <Image
                src={image}
                alt=""
                width={64}
                height={64}
                unoptimized
                className="size-16 rounded-full border border-primary/30 object-cover dark:border-gray-600"
              />
            ) : null}
            <dl className="space-y-1 text-sm">
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium text-foreground">{name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-medium text-foreground">{email || '—'}</dd>
              </div>
            </dl>
          </div>
          <p className="text-xs text-muted-foreground">
            To change your Google name or photo, update them in your Google Account, then sign out and back in here.
          </p>
        </CardContent>
      </Card>

      <Card className={glassCard}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="size-5" aria-hidden />
            Signing in
          </CardTitle>
          <CardDescription>How authentication works in this app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Production typically uses Google OAuth via NextAuth. Development may use username/password against Django when configured—see{' '}
            <Link href="/auth/login" className="text-primary underline underline-offset-2">
              Sign in
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <Card className={glassCard}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MonitorSmartphone className="size-5" aria-hidden />
            Sessions and devices
          </CardTitle>
          <CardDescription>Per-device session lists are not available in this UI.</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription className="text-sm">
              Session management is handled by your browser and sign-in provider. Use <strong>Sign out</strong> below to end this app session on this device.
            </AlertDescription>
          </Alert>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setSignOutConfirmOpen(true)}
          >
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
