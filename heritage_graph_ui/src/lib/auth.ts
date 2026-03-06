// src/lib/auth.ts
import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';

// -------------------------------------------------------------------
// Provider selection:
//   - Dev:  Credentials (username/password → SimpleJWT)
//   - Prod: Google OAuth + GitHub OAuth (auto-detected via env vars)
// -------------------------------------------------------------------
const isGoogleAuthEnabled =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

const isGitHubAuthEnabled =
  !!process.env.GITHUB_ID && !!process.env.GITHUB_SECRET;

const hasOAuthProvider = isGoogleAuthEnabled || isGitHubAuthEnabled;

const providers: NextAuthOptions['providers'] = [];

if (isGoogleAuthEnabled) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  );
}

if (isGitHubAuthEnabled) {
  providers.push(
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    })
  );
}

if (!hasOAuthProvider) {
  providers.push(
    CredentialsProvider({
      name: 'Django Login',
      credentials: {
        username: { label: 'Username', type: 'text', placeholder: 'admin' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        try {
          const backendUrl =
            process.env.INTERNAL_BACKEND_URL || 'http://localhost:8000';
          const res = await fetch(`${backendUrl}/api/token/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: credentials.username,
              password: credentials.password,
            }),
          });

          if (!res.ok) return null;

          const data = await res.json();
          return {
            id: credentials.username,
            email: credentials.username,
            name: credentials.username,
            accessToken: data.access,
            refreshToken: data.refresh,
          };
        } catch {
          return null;
        }
      },
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: 'jwt' },
  ...(!hasOAuthProvider ? { pages: { signIn: '/auth/login' } } : {}),
  callbacks: {
    async jwt({ token, account, user }) {
      if (user) {
        token.username = user.email || null;
      }
      if (account?.provider === 'google') {
        token.accessToken = account.id_token;
      } else if (account?.provider === 'github') {
        token.accessToken = account.access_token;
      } else if (user && 'accessToken' in user) {
        token.accessToken = (user as any).accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.username = token.username as string | null;
      }
      session.accessToken = token.accessToken as string | undefined;
      return session;
    },
  },
};
