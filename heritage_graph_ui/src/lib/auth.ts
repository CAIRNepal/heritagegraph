// src/lib/auth.ts
import { NextAuthOptions } from 'next-auth';
import { JWT } from 'next-auth/jwt';
import GoogleProvider from 'next-auth/providers/google';
import { describeSessionAuthError } from '@/lib/auth-errors';

/** True when NextAuth can register the Google provider (both env vars set). */
export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
}

const providers: NextAuthOptions['providers'] = [];

if (isGoogleOAuthConfigured()) {
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
    }),
  );
}

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
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
    };
  } catch {
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
     * After Google OAuth succeeds, verify the token against Django so user provisioning runs
     * before we issue a session. On failure, redirect to login with a specific ?error= code.
     */
    async signIn({ account, user }) {
      if (account?.provider !== 'google') {
        return true;
      }

      const accessToken = account.access_token;
      const idToken = (account as { id_token?: string }).id_token;
      if (!accessToken && !idToken) {
        return '/auth/login?error=Configuration';
      }

      const backendBase = (
        process.env.INTERNAL_BACKEND_URL || 'http://backend:8000'
      ).replace(/\/$/, '');
      const testUrl = `${backendBase}/data/api/testme/`;

      /** Try access token first, then ID token — Django accepts both. */
      async function backendGet(url: string): Promise<Response> {
        const tryTokens = [accessToken, idToken].filter(
          (t, i, arr): t is string => Boolean(t) && arr.indexOf(t) === i,
        );
        let last = new Response(null, { status: 401 });
        for (const bearer of tryTokens) {
          last = await fetch(url, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${bearer}`,
              Accept: 'application/json',
            },
          });
          if (last.ok) return last;
          if (last.status !== 401 && last.status !== 403) return last;
        }
        return last;
      }

      try {
        const response = await backendGet(testUrl);
        await response.text();

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            return '/auth/login?error=BACKEND_REJECTED';
          }
          if (response.status >= 500) {
            return '/auth/login?error=BACKEND_UNAVAILABLE';
          }
          return '/auth/login?error=BACKEND_SYNC';
        }

        try {
          const meResp = await backendGet(`${backendBase}/data/api/user/me/`);
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
          }
        } catch {
          /* profile enrichment is best-effort */
        }
      } catch {
        return '/auth/login?error=BACKEND_UNREACHABLE';
      }

      return true;
    },

    async jwt({ token, account, user }) {
      if (account && user) {
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
        token.id = (user as { id?: string }).id || token.id || undefined;
        token.username =
          (user as { username?: string }).username || user.email || undefined;
        token.slug = (user as { slug?: string }).slug ?? undefined;
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : jwtExpMs(account.access_token) ?? Date.now() + 3600 * 1000;
        token.authProvider = 'google';
        return token;
      }

      if (Date.now() < (token.accessTokenExpires ?? 0)) {
        return token;
      }

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
