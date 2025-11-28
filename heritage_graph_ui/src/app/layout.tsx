import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import NextAuthSessionProvider from './SessionProvider';
import React from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
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
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <SidebarProvider
          style={{
            '--sidebar-width': 'calc(var(--spacing) * 72)',
            '--header-height': 'calc(var(--spacing) * 12)',
          } as React.CSSProperties}
        >
          <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
        </SidebarProvider>
      </body>
    </html>
  );
}
