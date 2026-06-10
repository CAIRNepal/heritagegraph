import type { Metadata } from 'next';
import { Poppins, Fraunces, Geist_Mono } from 'next/font/google';
import './globals.css';
import NextAuthSessionProvider from './SessionProvider';
import React from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

// Align the loaded fonts with the design tokens in globals.css
// (--font-sans: Poppins, --font-serif: Fraunces). Previously the app loaded Geist,
// so the intended typography never rendered.
const poppins = Poppins({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const fraunces = Fraunces({
  variable: '--font-serif',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title:
    'HeritageGraph: Preserving Cultural Heritage and Identity Through Knowledge Graphs',
  description:
    'HeritageGraph is a research initiative by CAIR-Nepal that uses AI and Knowledge Graphs to digitally preserve cultural heritage, history, art, and traditions—safeguarding shared identity for future generations.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'HeritageGraph',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${poppins.variable} ${fraunces.variable} ${geistMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
