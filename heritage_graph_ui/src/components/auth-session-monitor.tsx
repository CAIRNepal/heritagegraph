'use client';

import { useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmActionDialog } from '@/components/confirm-action-dialog';

/**
 * When the JWT/session carries `error` (Google refresh failure or expired token),
 * show a blocking banner and let the user sign in again.
 */
export function AuthSessionMonitor() {
  const { data: session, status } = useSession();
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);

  if (status !== 'authenticated' || !session?.error) {
    return null;
  }

  const message =
    session.errorDescription ||
    'Your session is no longer valid. Please sign in again.';

  return (
    <>
      <ConfirmActionDialog
        open={signOutConfirmOpen}
        onOpenChange={setSignOutConfirmOpen}
        title="Sign out and continue?"
        description="You will be signed out on this device, then redirected to the sign-in page."
        confirmLabel="Continue"
        confirmVariant="destructive"
        onConfirm={async () => {
          setSignOutConfirmOpen(false);
          await signOut({ callbackUrl: '/auth/login' });
        }}
      />
      <div className="fixed top-0 left-0 right-0 z-[100] flex justify-center p-4 pointer-events-none">
        <Alert variant="destructive" className="max-w-lg pointer-events-auto shadow-lg">
          <AlertTitle>Session needs attention</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <p>{message}</p>
            <Button
              size="sm"
              variant="secondary"
              className="w-fit"
              onClick={() => setSignOutConfirmOpen(true)}
            >
              Sign in again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    </>
  );
}
