"use client";

import { signIn } from "next-auth/react";
import { useEffect } from "react";

/**
 * Legacy dev login page — now redirects to OAuth sign-in.
 * Google Auth is the primary authentication method.
 * This page exists only to catch old bookmarks / redirects.
 */
export default function LoginRedirectPage() {
  useEffect(() => {
    // Redirect to the NextAuth sign-in page (Google OAuth)
    signIn("google", { callbackUrl: "/dashboard" });
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