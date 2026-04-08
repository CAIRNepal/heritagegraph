import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { locales, defaultLocale, LOCALE_COOKIE, type Locale } from '@/i18n/routing';

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith('/auth')) return true;
  if (pathname.startsWith('/contribute/scan')) return true;
  if (pathname === '/services' || pathname.startsWith('/services/')) return true;
  return false;
}

/**
 * Locale cookie for next-intl, plus session gate for authenticated app surfaces.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isPublicPath(pathname)) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
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
