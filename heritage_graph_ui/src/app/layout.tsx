import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import NextAuthSessionProvider from './SessionProvider';
import React from 'react';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  // variable: '--font-geist-mono',
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-poppins',

});

export const metadata: Metadata = {
  title:
    'HeritageGraph: Preserving Cultural Heritage and Identity Through Knowledge Graphs',
  description:
    'HeritageGraph is a research initiative by CAIR-Nepal that uses AI and Knowledge Graphs to digitally preserve cultural heritage, history, art, and traditions—safeguarding shared identity for future generations.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
      </body>
    </html>
  );
}
