// src/lib/auth.ts
import { NextAuthOptions } from 'next-auth';
import { JWT } from 'next-auth/jwt';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';

// -------------------------------------------------------------------
// OAuth Providers:
//   - Google:  Primary auth provider (always enabled)
//   - GitHub:  Secondary provider (enabled when GITHUB_ID is set)
// -------------------------------------------------------------------

const isGitHubAuthEnabled =
  !!process.env.GITHUB_ID && !!process.env.GITHUB_SECRET;

const providers: NextAuthOptions['providers'] = [
  // Google OAuth — primary provider (always enabled)
  // Request offline access to get a refresh_token for auto-renewal
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
];

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
      console.error('Google token refresh failed:', refreshed);
      return { ...token, error: 'RefreshAccessTokenError' };
    }

    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
      // Google may or may not return a new refresh_token
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error('Error refreshing Google access token:', error);
    return { ...token, error: 'RefreshAccessTokenError' };
  }
}

export const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: 'jwt' },

  callbacks: {
    // Ping the backend on first OAuth sign-in to auto-create the Django user
    async signIn({ account }) {
      if (account?.provider === 'google' || account?.provider === 'github') {
        try {
          const token = account.access_token;
          if (token) {
            const backendUrl =
              process.env.INTERNAL_BACKEND_URL || 'http://backend:8000';
            const response = await fetch(`${backendUrl}/data/testme/`, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
              },
            });
            if (!response.ok) {
              console.error(
                `Django sync call failed for ${account.provider}:`,
                await response.text()
              );
            }
          }
        } catch (err) {
          console.error('Error during signIn callback:', err);
        }
      }
      return true;
    },

    async jwt({ token, account, user }) {
      // Initial sign-in: store tokens and expiry
      if (account && user) {
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
        token.username = user.email || null;
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 3600 * 1000;
        token.authProvider = account.provider;
        return token;
      }

      // Return previous token if the access token has not expired
      if (Date.now() < (token.accessTokenExpires as number ?? 0)) {
        return token;
      }

      // Access token expired — refresh it
      if (token.authProvider === 'google' && token.refreshToken) {
        return refreshGoogleAccessToken(token);
      }

      // For other providers or if no refresh token, return as-is
      return token;
    },

    async session({ session, token }) {
      session.user = session.user || {};
      session.user.email = token.email as string;
      session.user.name = token.name as string;
      session.user.image = token.picture as string | undefined;
      session.user.username = token.username as string | null;
      session.accessToken = token.accessToken as string | undefined;

      // Expose token error so the frontend can force re-login if needed
      if (token.error) {
        session.error = token.error as string;
      }

      return session;
    },
  },

  debug: process.env.NODE_ENV === 'development',
};
