/**
 * User-facing copy for NextAuth flows, URL ?error= params, and session.token errors.
 * Used by the login page, /auth/error, and the global session monitor.
 */

/** Query param values set from `signIn` when the Django handshake fails */
export type HeritageAuthErrorCode =
  | 'BACKEND_REJECTED'
  | 'BACKEND_UNAVAILABLE'
  | 'BACKEND_UNREACHABLE'
  | 'BACKEND_SYNC';

const HERITAGE_AUTH_MESSAGES: Record<HeritageAuthErrorCode, string> = {
  BACKEND_REJECTED:
    'The server could not verify your Google or GitHub token. In production, use the same OAuth client ID on the frontend and backend, set DJANGO_ENV=production on Django, and ensure the Google ID you use is allowed.',
  BACKEND_UNAVAILABLE:
    'The HeritageGraph API returned an error while signing you in. Please try again in a few minutes.',
  BACKEND_UNREACHABLE:
    'The app could not reach the HeritageGraph API during sign-in. If you use Docker, check INTERNAL_BACKEND_URL. Locally, ensure Django is running and reachable from the Next.js server.',
  BACKEND_SYNC:
    'Sign-in with the provider worked, but the server rejected the follow-up request. Check API logs and OAuth configuration.',
};

/** NextAuth `error` query values documented at https://next-auth.js.org/configuration/pages */
const NEXTAUTH_ERROR_MESSAGES: Record<string, string> = {
  Configuration:
    'Authentication is misconfigured. Verify NEXTAUTH_URL, NEXTAUTH_SECRET, OAuth client ID and secret, and callback URLs in the provider console.',
  AccessDenied: 'Access was denied or you cancelled sign-in.',
  Verification: 'The sign-in link is no longer valid or has expired.',
  OAuthSignin: 'Could not start sign-in with the provider. Try again in a moment.',
  OAuthCallback:
    'The provider rejected the redirect. Confirm the callback URL in Google/GitHub matches NEXTAUTH_URL (e.g. http://localhost:3000/api/auth/callback/google).',
  OAuthCreateAccount: 'Could not create an account from this provider sign-in.',
  EmailCreateAccount: 'Could not create an account from email sign-in.',
  Callback: 'Something went wrong during the sign-in callback.',
  OAuthAccountNotLinked: 'This account is linked to a different sign-in method already.',
  SessionRequired: 'You need to sign in to continue.',
  Default: 'Sign-in did not complete. Please try again.',
};

export function heritageAuthErrorMessage(code: string): string | null {
  if (code in HERITAGE_AUTH_MESSAGES) {
    return HERITAGE_AUTH_MESSAGES[code as HeritageAuthErrorCode];
  }
  return null;
}

export function nextAuthErrorMessage(code: string): string | null {
  return NEXTAUTH_ERROR_MESSAGES[code] ?? null;
}

/** Map any `error` search param on `/auth/login` or `/auth/error` to UI copy */
export function describeAuthUrlError(code: string | null | undefined): string | null {
  if (!code?.trim()) return null;
  return (
    heritageAuthErrorMessage(code) ?? nextAuthErrorMessage(code) ?? NEXTAUTH_ERROR_MESSAGES.Default
  );
}

/** Session / JWT `error` field surfaced to the client */
export function describeSessionAuthError(code: string): string {
  switch (code) {
    case 'RefreshAccessTokenError':
      return 'Your session could not be renewed. Please sign in again.';
    case 'AccessTokenExpiredError':
      return 'Your session expired. Please sign in again.';
    default:
      return 'Your session is no longer valid. Please sign in again.';
  }
}
