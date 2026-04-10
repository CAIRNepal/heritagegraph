'use client';

import { AlertCircle } from 'lucide-react';

import { isPublicApiUrlConfigured } from '@/lib/api-base';

/**
 * Shown when the app is built for production but `NEXT_PUBLIC_API_URL` was not set.
 */
export function ApiBaseWarning() {
  if (typeof window === 'undefined') return null;
  if (process.env.NODE_ENV !== 'production') return null;
  if (isPublicApiUrlConfigured()) return null;

  return (
    <div
      role="alert"
      className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100"
    >
      <div className="mx-auto flex max-w-5xl items-start gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          <strong className="font-semibold">API not configured.</strong>{' '}
          Set <code className="rounded bg-black/5 px-1 dark:bg-white/10">NEXT_PUBLIC_API_URL</code>{' '}
          to your Django API origin and redeploy (see repository <code className="rounded bg-black/5 px-1 dark:bg-white/10">.env.example</code>).
        </p>
      </div>
    </div>
  );
}
