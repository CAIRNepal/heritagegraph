'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { describeAuthUrlError } from '@/lib/auth-errors';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

/**
 * NextAuth `pages.error` target — shows `?error=` from the OAuth flow with a readable message.
 */
export default function AuthErrorPageClient() {
  const searchParams = useSearchParams();
  const code = searchParams.get('error');
  const message = describeAuthUrlError(code) ?? 'Something went wrong during sign-in.';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <Alert variant="destructive">
          <AlertTitle>Authentication error</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild variant="default">
            <Link href="/auth/login">Back to sign in</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
