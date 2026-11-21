import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { locales, defaultLocale, LOCALE_COOKIE, type Locale } from './routing';

export default getRequestConfig(async () => {
  // Read locale from cookie, fallback to default
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value as Locale | undefined;

  const locale: Locale =
    cookieLocale && locales.includes(cookieLocale) ? cookieLocale : defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Nepal timezone for all date formatting
    timeZone: 'Asia/Kathmandu',
    now: new Date(),
    formats: {
      dateTime: {
        short: {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        },
        long: {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
        },
      },
      number: {
        compact: {
          notation: 'compact',
        },
      },
    },
  };
});
