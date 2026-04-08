"use client";

import { signIn } from "next-auth/react";
import { useEffect } from "react";

/**
 * Redirects to OAuth sign-in. Optional `callbackUrl` query param is honored
 * (e.g. from middleware when redirecting unauthenticated users).
 */
export default function LoginRedirectPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const callbackUrl = params.get("callbackUrl") || "/";
    signIn("google", { callbackUrl });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="space-y-4 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
        <p className="text-sm text-muted-foreground">
          Redirecting to Google sign-in...
        </p>
      </div>
    </div>
  );
}