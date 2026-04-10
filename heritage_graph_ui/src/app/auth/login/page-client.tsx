'use client';

import { signIn, useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  describeAuthUrlError,
  missingGoogleOAuthConfigMessage,
} from '@/lib/auth-errors';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface LoginRedirectPageClientProps {
  googleOAuthConfigured: boolean;
}

/**
 * Google-only sign-in. Preserves `callbackUrl`. Surfaces ?error= from NextAuth or
 * HeritageGraph backend handshake without silent failures.
 */
export default function LoginRedirectPageClient({
  googleOAuthConfigured,
}: LoginRedirectPageClientProps) {
  const { status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [localError, setLocalError] = useState<string | null>(null);
  const autoSignInStarted = useRef(false);

  const callbackUrlRaw = searchParams.get('callbackUrl') || '/';
  const callbackUrl = callbackUrlRaw.startsWith('/') ? callbackUrlRaw : '/';
  const errorParam = searchParams.get('error');
  const urlMessage = describeAuthUrlError(errorParam);

  useEffect(() => {
    if (status !== 'authenticated') return;
    router.replace(callbackUrl);
  }, [status, router, callbackUrl]);

  useEffect(() => {
    if (!googleOAuthConfigured) return;
    if (status !== 'unauthenticated') return;
    if (errorParam) return;
    if (autoSignInStarted.current) return;
    autoSignInStarted.current = true;

    let cancelled = false;

    (async () => {
      try {
        const res = await signIn('google', { callbackUrl, redirect: false });
        if (cancelled) return;

        if (!res?.ok && res?.error) {
          setLocalError(
            describeAuthUrlError(res.error) ??
              'Sign-in could not start. Use the button below.',
          );
          return;
        }

        if (res?.url) {
          window.location.href = res.url;
          return;
        }

        setLocalError(
          'Sign-in did not return a redirect URL. Check NextAuth and Google OAuth configuration.',
        );
      } catch (e) {
        if (!cancelled) {
          setLocalError(
            e instanceof Error
              ? e.message
              : 'Sign-in failed to start. Check your network connection.',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, callbackUrl, errorParam, googleOAuthConfigured]);

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

  const configMessage = !googleOAuthConfigured ? missingGoogleOAuthConfigMessage : null;
  const displayError = configMessage || urlMessage || localError;
  const showBusySpinner =
    googleOAuthConfigured && !displayError && !errorParam;

  function tryGoogleAgain() {
    setLocalError(null);
    signIn('google', { callbackUrl });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        {displayError && (
          <Alert variant="destructive" className="text-left">
            <AlertTitle>Sign-in issue</AlertTitle>
            <AlertDescription>{displayError}</AlertDescription>
          </Alert>
        )}

        {showBusySpinner && (
          <div className="space-y-4">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
            <p className="text-sm text-muted-foreground">Redirecting to Google…</p>
          </div>
        )}

        <div className="space-y-3">
          {googleOAuthConfigured && !showBusySpinner ? (
            <>
              <Button className="w-full" type="button" onClick={tryGoogleAgain}>
                {displayError ? 'Try again with Google' : 'Continue with Google'}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Use the same Google account you intend to contribute with. You can retry if something
                went wrong.
              </p>
            </>
          ) : !googleOAuthConfigured ? (
            <Button className="w-full" type="button" variant="outline" asChild>
              <a href="/">Back to home</a>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
