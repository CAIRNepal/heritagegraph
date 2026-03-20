'use client';

import { Shield, ShieldAlert, ArrowLeft, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/design';

interface AccessDeniedProps {
  requiredRole: 'moderator' | 'reviewer';
  userEmail?: string | null;
}

const roleConfig = {
  moderator: {
    title: 'Moderator Access Required',
    description:
      'This section is reserved for moderators who oversee the review process and manage curation workflows.',
    howTo: [
      'Be an active reviewer with a strong track record',
      'Request moderator access from a platform administrator',
      'Contact the admin team at CAIR-Nepal for assistance',
    ],
    icon: Shield,
    accentColor: 'purple',
  },
  reviewer: {
    title: 'Reviewer Access Required',
    description:
      'This section is available to reviewers and moderators who help verify and curate cultural heritage contributions.',
    howTo: [
      'Contribute quality entries to build your reputation',
      'Request a reviewer role from an existing Expert Curator',
      'Contact the admin team at CAIR-Nepal for assistance',
    ],
    icon: Lock,
    accentColor: 'blue',
  },
};

const colorClasses = {
  purple: {
    border: 'border-purple-200 dark:border-purple-800',
    bg: 'bg-gradient-to-b from-purple-50/50 to-white dark:from-purple-950/20 dark:to-gray-950',
    iconBg: 'bg-purple-100 dark:bg-purple-900/40',
    iconText: 'text-purple-600 dark:text-purple-400',
    infoBorder: 'border-purple-200 dark:border-purple-800',
    infoBg: 'bg-purple-50/50 dark:bg-purple-950/30',
    infoTitle: 'text-purple-700 dark:text-purple-300',
    dot: 'bg-purple-400',
  },
  blue: {
    border: 'border-blue-200 dark:border-blue-800',
    bg: 'bg-gradient-to-b from-blue-50/50 to-white dark:from-blue-950/20 dark:to-gray-950',
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    iconText: 'text-blue-600 dark:text-blue-400',
    infoBorder: 'border-blue-200 dark:border-blue-800',
    infoBg: 'bg-blue-50/50 dark:bg-blue-950/30',
    infoTitle: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-400',
  },
};

export function AccessDenied({ requiredRole, userEmail }: AccessDeniedProps) {
  const config = roleConfig[requiredRole];
  const colors = colorClasses[config.accentColor as keyof typeof colorClasses];
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <motion.div {...fadeInUp}>
        <Card className={`max-w-lg w-full ${colors.border} ${colors.bg}`}>
          <CardContent className="flex flex-col items-center gap-6 py-12 px-8 text-center">
            <div className="relative">
              <div className={`rounded-full ${colors.iconBg} p-5`}>
                <Icon className={`h-10 w-10 ${colors.iconText}`} />
              </div>
              <div className="absolute -bottom-1 -right-1 rounded-full bg-amber-100 dark:bg-amber-900/50 p-1.5">
                <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-semibold tracking-tight">
                {config.title}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                {config.description}
              </p>
            </div>

            <div className={`w-full rounded-lg border ${colors.infoBorder} ${colors.infoBg} p-4 text-left`}>
              <p className={`text-xs font-medium ${colors.infoTitle} mb-2`}>
                How to get access:
              </p>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                {config.howTo.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${colors.dot} shrink-0`} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" asChild>
                <Link href="/" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Dashboard
                </Link>
              </Button>
              <Button asChild>
                <Link href="/contribute">
                  Start Contributing
                </Link>
              </Button>
            </div>

            {userEmail && (
              <p className="text-[11px] text-muted-foreground/60">
                Signed in as {userEmail}
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
