'use client';

import { signIn, useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { describeAuthUrlError } from '@/lib/auth-errors';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * OAuth sign-in entry. Preserves `callbackUrl`. When `?error=` is present (NextAuth
 * or our HeritageGraph codes), shows a clear message instead of failing silently.
 */
export default function LoginRedirectPageClient() {
  const { status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [localError, setLocalError] = useState<string | null>(null);
  const autoSignInStarted = useRef(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const callbackUrlRaw = searchParams.get('callbackUrl') || '/';
  const callbackUrl = callbackUrlRaw.startsWith('/') ? callbackUrlRaw : '/';
  const errorParam = searchParams.get('error');
  const urlMessage = describeAuthUrlError(errorParam);

  useEffect(() => {
    if (status !== 'authenticated') return;
    router.replace(callbackUrl);
  }, [status, router, callbackUrl]);

  useEffect(() => {
    if (status !== 'unauthenticated') return;
    if (errorParam) return;
    if (autoSignInStarted.current) return;
    autoSignInStarted.current = true;

    let cancelled = false;

    (async () => {
      try {
        // Do not force Google here — in dev we often use Credentials auth.
        // If Google is configured, the user can still click the button below.
        const res = await signIn(undefined, { callbackUrl, redirect: false });
        if (cancelled) return;

        if (!res?.ok && res?.error) {
          setLocalError(
            describeAuthUrlError(res.error) ?? 'Sign-in could not start. Use the button below.',
          );
          return;
        }

        if (res?.url) {
          window.location.href = res.url;
          return;
        }

        setLocalError('Sign-in did not return a redirect URL. Check NextAuth and OAuth configuration.');
      } catch (e) {
        if (!cancelled) {
          setLocalError(
            e instanceof Error ? e.message : 'Sign-in failed to start. Check your network connection.',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, callbackUrl, errorParam]);

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
          <p className="text-sm text-muted-foreground">
            {status === 'authenticated' ? 'Finishing sign-in…' : 'Checking session…'}
          </p>
        </div>
      </div>
    );
  }

  const displayError = urlMessage || localError;
  const showManualRetry = Boolean(displayError || errorParam);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        {displayError && (
          <Alert variant="destructive" className="text-left">
            <AlertTitle>Sign-in issue</AlertTitle>
            <AlertDescription>{displayError}</AlertDescription>
          </Alert>
        )}

        {!displayError && !errorParam && (
          <div className="space-y-4">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
            <p className="text-sm text-muted-foreground">Preparing sign-in…</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4 text-left">
            <p className="mb-3 text-sm font-medium">Sign in with username/password (dev)</p>
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSubmitting(true);
                setLocalError(null);
                try {
                  const res = await signIn('credentials', {
                    username,
                    password,
                    callbackUrl,
                    redirect: false,
                  });

                  if (res?.error) {
                    setLocalError(describeAuthUrlError(res.error) ?? 'Invalid username or password.');
                    return;
                  }

                  if (res?.url) {
                    window.location.href = res.url;
                    return;
                  }

                  // If NextAuth decides to redirect internally, the session effect will handle it.
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                autoComplete="username"
              />
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                type="password"
                autoComplete="current-password"
              />
              <Button className="w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </div>

          {showManualRetry && (
            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                setLocalError(null);
                signIn('google', { callbackUrl });
              }}
            >
              Try Google sign-in
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
