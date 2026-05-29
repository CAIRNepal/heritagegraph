'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Shield, Loader2, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/api-client';
import {
  fetchMyReviewerApplication,
  submitReviewerApplication,
  withdrawMyReviewerApplication,
  type ReviewerApplication,
} from '@/lib/reviewer-applications-api';

interface ReviewerAccessRequestPanelProps {
  className?: string;
}

export function ReviewerAccessRequestPanel({ className }: ReviewerAccessRequestPanelProps) {
  const { data: session, status } = useSession();
  const [application, setApplication] = useState<ReviewerApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const token = (session as { accessToken?: string } | null)?.accessToken;

  const load = useCallback(async () => {
    if (status !== 'authenticated' || !token) {
      setApplication(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const app = await fetchMyReviewerApplication(token);
      setApplication(app?.id ? app : null);
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not load your reviewer application.'));
    } finally {
      setLoading(false);
    }
  }, [status, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasPending = application?.status === 'pending';

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error('Sign in to request reviewer access');
      return;
    }
    setSubmitting(true);
    try {
      const created = await submitReviewerApplication(token, message);
      setApplication(created);
      toast.success('Your application was submitted. Staff will review it soon.');
      setMessage('');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not submit your application.'));
    } finally {
      setSubmitting(false);
    }
  };

  const onWithdraw = async () => {
    if (!application?.id || !token) return;
    setSubmitting(true);
    try {
      await withdrawMyReviewerApplication(token);
      setApplication(null);
      toast.success('Application withdrawn — you can submit again when ready.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not withdraw this application.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <Card className={cn('rounded-xl border-0 shadow-sm', className)}>
        <CardContent className="flex items-center gap-2 py-8 text-blue-700 dark:text-blue-300">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </CardContent>
      </Card>
    );
  }

  if (status !== 'authenticated' || !token) {
    return (
      <Card className={cn('rounded-xl border-0 shadow-sm', className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5" /> Reviewer access
          </CardTitle>
          <CardDescription>Sign in to request reviewer privileges.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={cn('rounded-xl border-0 shadow-sm', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5" />
          Request reviewer access
        </CardTitle>
        <CardDescription>
          Tell the HeritageGraph team about your background. Staff approve applications in the
          admin console; approved users receive a reviewer role for the curation queue.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {application?.id ? (
          <div className="rounded-lg border border-blue-100 dark:border-gray-700 bg-blue-50/50 dark:bg-gray-900/40 p-4 text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">Your application</p>
            <div className="flex flex-wrap items-center gap-2 text-blue-800 dark:text-blue-200">
              {application.status === 'pending' && (
                <>
                  <Clock className="h-4 w-4 shrink-0" />
                  Pending review
                </>
              )}
              {application.status === 'approved' && (
                <>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                  Approved — refresh the page if your access has not updated yet
                </>
              )}
              {application.status === 'rejected' && (
                <>
                  <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                  Not approved — you may submit a new application below
                </>
              )}
            </div>
            {application.created_at ? (
              <p className="text-xs text-muted-foreground mt-2">
                Submitted {new Date(application.created_at).toLocaleString()}
              </p>
            ) : null}
            {application.status === 'pending' ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={submitting}
                onClick={() => void onWithdraw()}
              >
                Withdraw application
              </Button>
            ) : null}
          </div>
        ) : null}

        {hasPending ? (
          <p className="text-sm text-blue-700 dark:text-blue-300">
            You already have a pending application.
          </p>
        ) : application?.status === 'approved' ? null : (
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="message">Message (optional)</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Experience with heritage documentation, languages, or subject areas…"
                className="min-h-[100px]"
              />
            </div>
            <Button type="submit" disabled={submitting} className="gap-2">
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
              Submit application
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
