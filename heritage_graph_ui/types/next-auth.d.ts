import NextAuth, { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    /** OAuth access token sent as Bearer token to Django backend */
    accessToken?: string;
    /** Set to 'RefreshAccessTokenError' if token refresh failed */
    error?: string;
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
    /** OAuth access token sent as Bearer token to Django backend */
    accessToken?: string;
    /** OAuth refresh token for auto-renewal */
    refreshToken?: string;
    /** Timestamp (ms) when the access token expires */
    accessTokenExpires?: number;
    /** Which OAuth provider was used: 'google' | 'github' */
    authProvider?: string;
    username?: string | null;
    /** Set to 'RefreshAccessTokenError' if token refresh failed */
    error?: string;
  }
}
