'use client';

import { useReviewerRole } from '@/hooks/use-reviewer-role';
import { useSession } from 'next-auth/react';
import { Shield, ShieldAlert, ArrowLeft, Loader2, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/design';

export default function CurationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status: sessionStatus } = useSession();
  const { role, isLoading, hasAccess, error } = useReviewerRole();

  // Still loading auth or role
  if (sessionStatus === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Checking access...</p>
        </div>
      </div>
    );
  }

  // Not signed in
  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <motion.div {...fadeInUp}>
          <Card className="max-w-lg w-full border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="flex flex-col items-center gap-6 py-12 px-8 text-center">
              <div className="rounded-full bg-amber-100 dark:bg-amber-900/40 p-4">
                <LogIn className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight">
                  Sign in Required
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                  You need to sign in to access the curation tools.
                </p>
              </div>
              <Button asChild>
                <Link href="/api/auth/signin">Sign In</Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Signed in but no reviewer role
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <motion.div {...fadeInUp}>
          <Card className="max-w-lg w-full border-blue-200 dark:border-blue-800 bg-gradient-to-b from-blue-50/50 to-white dark:from-blue-950/20 dark:to-gray-950">
            <CardContent className="flex flex-col items-center gap-6 py-12 px-8 text-center">
              {/* Icon */}
              <div className="relative">
                <div className="rounded-full bg-blue-100 dark:bg-blue-900/40 p-5">
                  <Shield className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="absolute -bottom-1 -right-1 rounded-full bg-amber-100 dark:bg-amber-900/50 p-1.5">
                  <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
              </div>

              {/* Title and message */}
              <div className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">
                  Moderator Access Required
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                  The Curation section is reserved for reviewers and moderators
                  who help verify and curate cultural heritage contributions.
                </p>
              </div>

              {/* Info box */}
              <div className="w-full rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 p-4 text-left">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">
                  How to get access:
                </p>
                <ul className="text-xs text-muted-foreground space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                    Contribute quality entries to build your reputation
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                    Request a reviewer role from an existing Expert Curator
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                    Contact the admin team at CAIR-Nepal for assistance
                  </li>
                </ul>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <Button variant="outline" asChild>
                  <Link href="/dashboard" className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Dashboard
                  </Link>
                </Button>
                <Button asChild>
                  <Link href="/dashboard/contribute">
                    Start Contributing
                  </Link>
                </Button>
              </div>

              {/* Current user info */}
              <p className="text-[11px] text-muted-foreground/60">
                Signed in as {session.user?.email}
                {error && <span className="text-amber-500"> · {error}</span>}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Has access — render the curation page
  return <>{children}</>;
}
