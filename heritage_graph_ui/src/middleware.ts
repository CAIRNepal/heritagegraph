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
    '/notification',
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
 * Locale cookie for next-intl, plus session gate for authenticated app surfaces.
 */
export async function middleware(request: NextRequest) {
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
