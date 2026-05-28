'use client';

import { signIn, useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  describeAuthUrlError,
  missingGoogleOAuthConfigMessage,
} from '@/lib/auth-errors';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LoginRedirectPageClientProps {
  googleOAuthConfigured: boolean;
  devAuthEnabled: boolean;
}

/** Same-origin path only; avoid open redirects and loops back to this page. */
function safeCallbackUrl(raw: string | null): string {
  if (!raw) return '/';
  const path = raw.trim();
  if (!path.startsWith('/')) return '/';
  if (path === '/auth/login' || path.startsWith('/auth/login?')) return '/';
  return path;
}

/**
 * Google sign-in (primary) with optional DEBUG-gated dev email login.
 */
export default function LoginRedirectPageClient({
  googleOAuthConfigured,
  devAuthEnabled,
}: LoginRedirectPageClientProps) {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [localError, setLocalError] = useState<string | null>(null);
  const [devEmail, setDevEmail] = useState('dev@heritagegraph.local');
  const [devSubmitting, setDevSubmitting] = useState(false);
  const postAuthRedirectDone = useRef(false);

  const callbackUrl = safeCallbackUrl(searchParams.get('callbackUrl'));
  const errorParam = searchParams.get('error');
  const urlMessage = describeAuthUrlError(errorParam);

  useEffect(() => {
    if (status === 'unauthenticated') {
      postAuthRedirectDone.current = false;
    }
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (postAuthRedirectDone.current) return;
    postAuthRedirectDone.current = true;
    router.replace(callbackUrl);
  }, [status, router, callbackUrl]);

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

  const configMessage =
    !googleOAuthConfigured && !devAuthEnabled ? missingGoogleOAuthConfigMessage : null;
  const displayError = configMessage || urlMessage || localError;
  const canSignIn = googleOAuthConfigured || devAuthEnabled;

  function continueWithGoogle() {
    setLocalError(null);
    void signIn('google', { callbackUrl }).catch((e) => {
      setLocalError(
        e instanceof Error ? e.message : 'Sign-in could not start. Try again.',
      );
    });
  }

  async function continueWithDevEmail() {
    setLocalError(null);
    const email = devEmail.trim().toLowerCase();
    if (!email) {
      setLocalError('Enter a dev email address.');
      return;
    }

    setDevSubmitting(true);
    try {
      const result = await signIn('dev-credentials', {
        email,
        callbackUrl,
        redirect: false,
      });
      if (result?.error) {
        setLocalError(
          'Dev sign-in failed. Ensure DEBUG=True and HERITAGEGRAPH_DEV_AUTH=true on the backend.',
        );
        return;
      }
      if (result?.url) {
        router.replace(result.url);
      } else {
        router.replace(callbackUrl);
      }
    } catch (e) {
      setLocalError(
        e instanceof Error ? e.message : 'Dev sign-in could not start. Try again.',
      );
    } finally {
      setDevSubmitting(false);
    }
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

        <div className="space-y-3">
          {googleOAuthConfigured ? (
            <>
              <Button className="w-full" type="button" onClick={continueWithGoogle}>
                {displayError ? 'Try again with Google' : 'Continue with Google'}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Use the same Google account you intend to contribute with.
              </p>
            </>
          ) : null}

          {devAuthEnabled ? (
            <div className="space-y-3 rounded-lg border border-dashed p-4 text-left">
              <p className="text-sm font-medium">Dev sign-in</p>
              <p className="text-xs text-muted-foreground">
                Development only — no password. Run{' '}
                <code className="text-xs">python manage.py seed_dev_users</code> first.
              </p>
              <div className="space-y-2">
                <Label htmlFor="dev-email">Email</Label>
                <Input
                  id="dev-email"
                  type="email"
                  autoComplete="email"
                  value={devEmail}
                  onChange={(e) => setDevEmail(e.target.value)}
                  placeholder="dev@heritagegraph.local"
                />
              </div>
              <Button
                className="w-full"
                type="button"
                variant="secondary"
                disabled={devSubmitting}
                onClick={() => void continueWithDevEmail()}
              >
                {devSubmitting ? 'Signing in…' : 'Continue with dev email'}
              </Button>
            </div>
          ) : null}

          {!canSignIn ? (
            <Button className="w-full" type="button" variant="outline" asChild>
              <a href="/">Back to home</a>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
