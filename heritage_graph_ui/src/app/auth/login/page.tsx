import { Suspense } from 'react';
import LoginRedirectPageClient from './page-client';

function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="space-y-4 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}

export default function LoginRedirectPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginRedirectPageClient />
    </Suspense>
  );
}
