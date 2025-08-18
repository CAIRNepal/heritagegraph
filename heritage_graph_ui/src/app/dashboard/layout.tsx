import { type Metadata } from 'next';
import { ReactNode } from 'react';

import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs';

import { Geist, Geist_Mono } from 'next/font/google';
import { AppSidebar } from '@/app/dashboard/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { ThemeProvider } from 'next-themes';
import { ThemeToggle } from '@/components/theme-toggle';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Heritage Graph Dashboard',
  description: 'Collaborative moderation, submission, and curation interface.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
        <body className="antialiased min-h-screen bg-background text-foreground">
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
            <SidebarProvider
              style={
                {
                  '--sidebar-width': 'calc(var(--spacing) * 72)',
                  '--header-height': 'calc(var(--spacing) * 12)',
                } as React.CSSProperties
              }
            >
              <AppSidebar variant="inset" />

              <SidebarInset>
                <header
                  className="flex items-center justify-between px-4 h-16 border-b border-border"
                  role="banner"
                  aria-label="Site Header"
                >
                  <SiteHeader />

                  <div className="ml-auto flex items-center gap-4">
                    <ThemeToggle />

                    <SignedOut>
                      <SignInButton />
                      <SignUpButton>
                        <button className="bg-primary text-white rounded-full font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 transition hover:bg-primary/90">
                          Sign Up
                        </button>
                      </SignUpButton>
                    </SignedOut>

                    <SignedIn>
                      <UserButton afterSignOutUrl="/" />
                    </SignedIn>
                  </div>
                </header>

                <main
                  role="main"
                  className="flex flex-col flex-1 @container/main gap-4 py-6 px-4 md:px-6"
                >
                  {children}
                </main>
              </SidebarInset>
            </SidebarProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
