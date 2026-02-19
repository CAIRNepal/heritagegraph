import NextAuth, { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    /** Google ID token, sent as Bearer token to Django backend */
    accessToken?: string;
    user?: {
      username?: string | null;
    } & DefaultSession['user'];
  }

  interface User {
    username?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    /** Google ID token, sent as Bearer token to Django backend */
    accessToken?: string;
    username?: string | null;
  }
}
