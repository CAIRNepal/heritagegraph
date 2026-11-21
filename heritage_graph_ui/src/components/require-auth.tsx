'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

import { Button } from '@/components/ui/button';
import { StatePanel } from '@/components/state-panel';

interface RequireAuthProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  callbackUrl?: string;
}

export function RequireAuth({
  children,
  title = 'Sign in required',
  description = 'Please sign in to continue.',
  callbackUrl,
}: RequireAuthProps) {
  const { status } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const effectiveCallbackUrl =
    callbackUrl ??
    `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ''}`;

  if (status === 'loading') {
    return <StatePanel variant="loading" title="Checking session…" />;
  }

  if (status !== 'authenticated') {
    return (
      <div className="mx-auto max-w-2xl">
        <StatePanel variant="empty" title={title} description={description} />
        <div className="mt-4">
          <Button asChild>
            <Link
              href={`/auth/login?callbackUrl=${encodeURIComponent(effectiveCallbackUrl)}`}
            >
              Sign in
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

