// src/lib/auth.ts
import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';

// -------------------------------------------------------------------
// Provider selection: Google OAuth (prod) vs Credentials (dev)
// -------------------------------------------------------------------
const isGoogleAuthEnabled =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

const providers: NextAuthOptions['providers'] = [];

if (isGoogleAuthEnabled) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  );
} else {
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
  ...(isGoogleAuthEnabled ? {} : { pages: { signIn: '/auth/login' } }),
  callbacks: {
    async jwt({ token, account, user }) {
      if (user) {
        token.username = user.email || null;
      }
      if (account?.provider === 'google') {
        token.accessToken = account.id_token;
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
