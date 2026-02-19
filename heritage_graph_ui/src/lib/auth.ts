// src/lib/auth.ts
import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        // Store Google's id_token — this is what Django will verify
        token.accessToken = account.id_token;
        token.username = token.email || null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.username = token.username as string | null;
      }
      // Expose the Google id_token as accessToken for backend API calls
      session.accessToken = token.accessToken as string | undefined;
      return session;
    },
  },
};
