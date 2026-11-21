import { Suspense } from 'react';
import AuthErrorPageClient from './page-client';

function ErrorFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<ErrorFallback />}>
      <AuthErrorPageClient />
    </Suspense>
  );
}
