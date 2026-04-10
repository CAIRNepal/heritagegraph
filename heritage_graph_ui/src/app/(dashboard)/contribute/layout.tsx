'use client';

import type { ReactNode } from 'react';

import { RequireAuth } from '@/components/require-auth';

/**
 * Contribute flows need a signed-in user. Gated here instead of middleware so we
 * avoid Edge `getToken` / session-cookie mismatches that caused redirect loops with
 * `/auth/login` ("Checking session…" / "Finishing sign-in…"). APIs still enforce auth.
 *
 * Note: `app/contribute/scan/[id]` lives outside this tree and stays public for QR flows.
 */
export default function ContributeLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth
      title="Sign in to contribute"
      description="Contributions are tied to your account. Sign in with Google to continue."
    >
      {children}
    </RequireAuth>
  );
}
