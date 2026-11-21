import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { locales, defaultLocale, LOCALE_COOKIE, type Locale } from '@/i18n/routing';

/**
 * Routes that must have a NextAuth session (admin, personal account, reviewer tools).
 * Everything else is browsable without login; APIs still enforce permissions.
 */
function pathRequiresLogin(pathname: string): boolean {
  if (pathname.startsWith('/auth')) return false;

  const protectedPrefixes = [
    '/curation',
    '/platform-admin',
    '/moderate',
    '/account',
    '/progression',
    '/community/reviewer-request',
    // /contribute is gated in (dashboard)/contribute/layout.tsx (RequireAuth) so Edge
    // middleware getToken() cannot fight the client session after OAuth.
  ];

  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Dev only: NextAuth stores its OAuth state/PKCE cookies on whatever host the
 * browser used, but Google always returns to NEXTAUTH_URL. Opening the app on
 * 127.0.0.1 or the LAN address therefore fails with "State cookie was missing".
 * Send page requests to the NEXTAUTH_URL origin so both legs share cookies.
 * Skipped in production, where the proxy's Host may differ from the app's.
 */
function canonicalDevRedirect(request: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== 'development') return null;
  const raw = process.env.NEXTAUTH_URL?.trim();
  if (!raw) return null;

  let canonical: URL;
  try {
    canonical = new URL(raw);
  } catch {
    return null;
  }

  const host = request.headers.get('host');
  if (!host || host === canonical.host) return null;

  // Refresh, not Location: Next's middleware adapter rebuilds Location from the
  // request Host and treats localhost/127.0.0.1 as the same, so a 307 loops.
  const target = `${canonical.origin}${request.nextUrl.pathname}${request.nextUrl.search}`;
  return new NextResponse(`Redirecting to ${target}`, {
    headers: { Refresh: `0; url=${target}`, 'Content-Type': 'text/plain' },
  });
}

/**
 * Locale cookie for next-intl, plus session gate for authenticated app surfaces.
 */
export async function middleware(request: NextRequest) {
  const canonicalRedirect = canonicalDevRedirect(request);
  if (canonicalRedirect) return canonicalRedirect;

  const { pathname } = request.nextUrl;

  if (pathRequiresLogin(pathname)) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (
      token?.error === 'RefreshAccessTokenError' ||
      token?.error === 'AccessTokenExpiredError'
    ) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('error', String(token.error));
      loginUrl.searchParams.set(
        'callbackUrl',
        `${pathname}${request.nextUrl.search || ''}`,
      );
      return NextResponse.redirect(loginUrl);
    }

    if (!token) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set(
        'callbackUrl',
        `${pathname}${request.nextUrl.search || ''}`
      );
      return NextResponse.redirect(loginUrl);
    }
  }

  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value as Locale | undefined;
  const locale =
    cookieLocale && locales.includes(cookieLocale) ? cookieLocale : defaultLocale;

  const response = NextResponse.next();

  if (!cookieLocale) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
};
