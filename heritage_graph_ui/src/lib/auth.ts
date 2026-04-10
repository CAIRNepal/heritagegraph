// src/lib/auth.ts
import { NextAuthOptions } from 'next-auth';
import { JWT } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { formatErrorBody } from '@/lib/api-client';
import { describeSessionAuthError } from '@/lib/auth-errors';

// -------------------------------------------------------------------
// OAuth Providers:
//   - Google:  Primary auth provider (production by default; opt-in in dev)
//   - GitHub:  Secondary provider (enabled when GITHUB_ID is set)
// -------------------------------------------------------------------

const isGoogleAuthEnabled = (() => {
  const hasCreds =
    !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

  // In development, make Google explicit opt-in so a stale/invalid client
  // doesn't break local startup (dev auth uses username/password instead).
  if (process.env.NODE_ENV !== 'production') {
    return (
      hasCreds &&
      (process.env.ENABLE_GOOGLE_AUTH === 'true' ||
        process.env.HG_AUTH_PROVIDER === 'google')
    );
  }

  // In production, if creds exist, enable Google.
  return hasCreds;
})();

const isGitHubAuthEnabled =
  !!process.env.GITHUB_ID && !!process.env.GITHUB_SECRET;

const providers: NextAuthOptions['providers'] = [
];

function jwtExpMs(jwt: string | undefined | null): number | null {
  if (!jwt) return null;
  const parts = jwt.split('.');
  if (parts.length < 2) return null;
  try {
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

if (isGoogleAuthEnabled) {
  // Google OAuth — primary provider
  // Request offline access to get a refresh_token for auto-renewal
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          access_type: 'offline',
          prompt: 'consent',
          scope: 'openid email profile',
        },
      },
    })
  );
}

// Credentials (username/password) — dev default when Google isn't enabled.
// Uses Django SimpleJWT: POST /api/token/ -> { access, refresh }.
if (!isGoogleAuthEnabled) {
  providers.push(
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const username = credentials?.username?.trim();
        const password = credentials?.password;

        if (!username || !password) return null;

        const backendBase = (
          process.env.INTERNAL_BACKEND_URL || 'http://backend:8000'
        ).replace(/\/$/, '');

        const tokenUrl = `${backendBase}/api/token/`;

        try {
          const resp = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ username, password }),
          });

          const bodyText = await resp.text();
          if (!resp.ok) {
            console.error('[auth] credentials authorize failed', resp.status, bodyText?.slice(0, 400));
            return null;
          }

          const data = JSON.parse(bodyText) as { access?: string; refresh?: string };
          if (!data?.access) return null;

          // NextAuth expects a "user" object. We also stash tokens on it so the
          // jwt() callback can copy them into the JWT cookie.
          const user = {
            id: username,
            name: username,
            email: null,
            image: null,
            username,
            accessToken: data.access,
            refreshToken: data.refresh,
          } as any;

          return user;
        } catch (e) {
          console.error('[auth] credentials authorize threw', e);
          return null;
        }
      },
    })
  );
}

// GitHub OAuth — secondary provider (enabled when env vars are set)
if (isGitHubAuthEnabled) {
  providers.push(
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    })
  );
}

// -------------------------------------------------------------------
// Token refresh: Google access tokens expire after ~1 hour.
// Use the refresh_token to get a new access_token automatically.
// -------------------------------------------------------------------
async function refreshGoogleAccessToken(token: JWT): Promise<JWT> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken as string,
      }),
    });

    const refreshed = await response.json();

    if (!response.ok) {
      console.error('[auth] Google token refresh failed', {
        status: response.status,
        error: refreshed?.error,
        error_description: refreshed?.error_description,
      });
      return {
        ...token,
        error: 'RefreshAccessTokenError',
        errorDescription: describeSessionAuthError('RefreshAccessTokenError'),
      };
    }

    const { error: _e, errorDescription: _d, ...rest } = token;
    return {
      ...rest,
      accessToken: refreshed.access_token,
      accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
      // Google may or may not return a new refresh_token
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error('[auth] Google token refresh threw', error);
    return {
      ...token,
      error: 'RefreshAccessTokenError',
      errorDescription: describeSessionAuthError('RefreshAccessTokenError'),
    };
  }
}

export const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: 'jwt' },
  pages: {
    error: '/auth/error',
  },

  callbacks: {
    /**
     * After OAuth succeeds, verify the token against Django so user provisioning runs
     * before we issue a session. On failure, redirect to login with a specific ?error= code.
     */
    async signIn({ account, user }) {
      if (account?.provider === 'credentials') {
        // Credentials auth already validated against Django via /api/token/.
        return true;
      }
      if (account?.provider !== 'google' && account?.provider !== 'github') {
        return true;
      }

      // Django production auth typically verifies an OIDC ID token.
      // Prefer `id_token` when present (Google), otherwise fall back to access_token.
      const token = (account as { id_token?: string; access_token?: string })?.id_token || account.access_token;
      if (!token) {
        console.error('[auth] signIn: provider returned no access_token', account.provider);
        return '/auth/login?error=Configuration';
      }

      const backendBase = (
        process.env.INTERNAL_BACKEND_URL || 'http://backend:8000'
      ).replace(/\/$/, '');
      const testUrl = `${backendBase}/data/api/testme/`;

      try {
        const response = await fetch(testUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
        const bodyText = await response.text();

        if (!response.ok) {
          let parsed: unknown = bodyText;
          if (
            bodyText &&
            (response.headers.get('content-type') || '').includes('application/json')
          ) {
            try {
              parsed = JSON.parse(bodyText);
            } catch {
              parsed = bodyText;
            }
          }
          const friendly =
            formatErrorBody(typeof parsed === 'object' ? parsed : bodyText) ||
            `HTTP ${response.status}`;

          console.error(
            `[auth] signIn: ${account.provider} backend check failed`,
            response.status,
            friendly
          );

          if (response.status === 401 || response.status === 403) {
            return '/auth/login?error=BACKEND_REJECTED';
          }
          if (response.status >= 500) {
            return '/auth/login?error=BACKEND_UNAVAILABLE';
          }
          return '/auth/login?error=BACKEND_SYNC';
        }

        try {
          const meResp = await fetch(`${backendBase}/data/api/user/me/`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
          });
          if (meResp.ok) {
            const meData = await meResp.json();
            if (meData.user_id) {
              (user as { id?: string }).id = meData.user_id;
            }
            if (meData.username) {
              (user as { username?: string }).username = meData.username;
            }
            if (meData.slug) {
              (user as { slug?: string }).slug = meData.slug;
            }
          } else {
            const meBody = await meResp.text();
            console.warn(
              '[auth] signIn: GET /data/api/user/me/ non-fatal failure',
              meResp.status,
              meBody?.slice(0, 400)
            );
          }
        } catch (meErr) {
          console.warn('[auth] signIn: profile fetch threw (non-fatal)', meErr);
        }
      } catch (err) {
        console.error('[auth] signIn: backend unreachable', testUrl, err);
        return '/auth/login?error=BACKEND_UNREACHABLE';
      }

      return true;
    },

    async jwt({ token, account, user }) {
      // Initial sign-in: store tokens and expiry
      if (account && user) {
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
        token.id = (user as any).id || token.id || null;
        token.username = (user as any).username || user.email || null;
        token.slug = (user as any).slug || null;
        if (account.provider === 'credentials') {
          token.accessToken = (user as any).accessToken;
          token.refreshToken = (user as any).refreshToken;
          token.accessTokenExpires = jwtExpMs((user as any).accessToken) ?? (Date.now() + 55 * 60 * 1000);
        } else {
          token.accessToken = account.access_token;
          token.refreshToken = account.refresh_token;
          token.accessTokenExpires = account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 3600 * 1000;
        }
        token.authProvider = account.provider;
        return token;
      }

      // Return previous token if the access token has not expired
      if (Date.now() < (token.accessTokenExpires ?? 0)) {
        return token;
      }

      // Access token expired — refresh (Google) or surface a session error
      if (token.authProvider === 'google' && token.refreshToken) {
        return refreshGoogleAccessToken(token);
      }

      if (token.accessTokenExpires != null && Date.now() >= token.accessTokenExpires) {
        return {
          ...token,
          error: 'AccessTokenExpiredError',
          errorDescription: describeSessionAuthError('AccessTokenExpiredError'),
        };
      }

      return token;
    },

    async session({ session, token }) {
      session.user = session.user || {};
      session.user.id = token.id as string | undefined;
      session.user.email = token.email as string;
      session.user.name = token.name as string;
      session.user.image = token.picture as string | undefined;
      session.user.username = token.username as string | null;
      session.user.slug = token.slug as string | null;
      session.accessToken = token.accessToken as string | undefined;

      if (token.error) {
        session.error = token.error as string;
        session.errorDescription =
          (token.errorDescription as string | undefined) ||
          describeSessionAuthError(token.error as string);
      } else {
        delete session.error;
        delete session.errorDescription;
      }

      return session;
    },
  },

  debug: process.env.NEXTAUTH_DEBUG === 'true',
};
