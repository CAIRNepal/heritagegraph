'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { ReactNode } from 'react';
import { AuthSessionMonitor } from '@/components/auth-session-monitor';

export default function NextAuthSessionProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SessionProvider>
        <AuthSessionMonitor />
        {children}
      </SessionProvider>
    </ThemeProvider>
  );
}
