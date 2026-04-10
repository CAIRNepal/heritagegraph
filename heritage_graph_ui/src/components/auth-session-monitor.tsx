'use client';

import { signOut, useSession } from 'next-auth/react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

/**
 * When the JWT/session carries `error` (Google refresh failure or expired token),
 * show a blocking banner and let the user sign in again.
 */
export function AuthSessionMonitor() {
  const { data: session, status } = useSession();

  if (status !== 'authenticated' || !session?.error) {
    return null;
  }

  const message =
    session.errorDescription ||
    'Your session is no longer valid. Please sign in again.';

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex justify-center p-4 pointer-events-none">
      <Alert variant="destructive" className="max-w-lg pointer-events-auto shadow-lg">
        <AlertTitle>Session needs attention</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <p>{message}</p>
          <Button
            size="sm"
            variant="secondary"
            className="w-fit"
            onClick={() => signOut({ callbackUrl: '/auth/login' })}
          >
            Sign in again
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
