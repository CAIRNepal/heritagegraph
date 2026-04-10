import NextAuth, { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    /** OAuth access token sent as Bearer token to Django backend */
    accessToken?: string;
    /** Machine-readable code, e.g. `RefreshAccessTokenError` */
    error?: string;
    /** Human-readable explanation for `error` (safe to show in UI) */
    errorDescription?: string;
    user?: {
      id?: string;
      username?: string | null;
      slug?: string | null;
    } & DefaultSession['user'];
  }

  interface User {
    id?: string;
    username?: string | null;
    slug?: string | null;
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
    /** Always `google` for this app */
    authProvider?: string;
    id?: string;
    username?: string | null;
    slug?: string | null;
    error?: string;
    errorDescription?: string;
  }
}
