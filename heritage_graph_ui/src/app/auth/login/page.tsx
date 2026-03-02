"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

function DevLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid username or password.");
    } else if (result?.ok) {
      router.push(callbackUrl);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, email }),
      });

      if (!res.ok) {
        const text = await res.text();
        setError(`Signup failed: ${text}`);
        setLoading(false);
        return;
      }

      // Auto sign-in after successful registration
      const signInResult = await signIn("credentials", {
        username,
        password,
        redirect: false,
        callbackUrl,
      });

      setLoading(false);

      if (signInResult?.error) {
        setError("Registered but automatic sign-in failed. Please sign in manually.");
      } else {
        router.push(callbackUrl);
      }
    } catch (err: any) {
      setError(err?.message || "Signup failed");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-8 shadow-lg">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            HeritageGraph Dev Login
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in with your Django username and password.
            <br />
            Create one with{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              make dev-superuser
            </code>
          </p>
        </div>

        <form onSubmit={showSignup ? handleSignup : handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="username"
              className="text-sm font-medium leading-none"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="admin"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-sm font-medium leading-none"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}

          {showSignup && (
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium leading-none">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="you@example.com"
              />

              <label htmlFor="confirmPassword" className="text-sm font-medium leading-none">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            {loading ? (showSignup ? "Creating..." : "Signing in...") : showSignup ? "Create account" : "Sign in"}
          </button>

          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setShowSignup(!showSignup)}
              className="text-sm text-primary underline"
            >
              {showSignup ? "Back to sign in" : "Create an account"}
            </button>
          </div>
        </form>

        <div className="rounded-md bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">
            <strong>Dev mode:</strong> Google OAuth is disabled. This login uses
            Django&apos;s built-in auth with SimpleJWT tokens.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DevLoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-r-transparent" />
      </div>
    }>
      <DevLoginForm />
    </Suspense>
  );
}