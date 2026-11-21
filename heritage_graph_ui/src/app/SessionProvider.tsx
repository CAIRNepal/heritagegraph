'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { MotionConfig } from 'framer-motion';
import { ReactNode } from 'react';
import { AuthSessionMonitor } from '@/components/auth-session-monitor';

export default function NextAuthSessionProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {/*
        reducedMotion="user" makes every Framer animation in the app honour the
        OS setting, rather than relying on each component to remember. Transform
        and layout animations are disabled; opacity still cross-fades, which is
        the documented accessible behaviour.

        This is a safety net, not a substitute for `revealProps()`: a component
        that gates its own `whileInView` on reduced motion can still leave the
        SSR-rendered `hidden` variant on screen forever, and no global config
        can rescue that.
      */}
      <MotionConfig reducedMotion="user">
        <SessionProvider>
          <AuthSessionMonitor />
          {children}
        </SessionProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
