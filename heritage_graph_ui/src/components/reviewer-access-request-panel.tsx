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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Shield, Loader2, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface ReviewerRoleRequest {
  id: string;
  requested_role: 'community_reviewer' | 'domain_expert';
  message: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ReviewerAccessRequestPanelProps {
  className?: string;
}

const ROLE_LABELS: Record<string, string> = {
  community_reviewer: 'Community reviewer',
  domain_expert: 'Domain expert',
};

export function ReviewerAccessRequestPanel({ className }: ReviewerAccessRequestPanelProps) {
  const { data: session, status } = useSession();
  const [requests, setRequests] = useState<ReviewerRoleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [role, setRole] = useState<string>('community_reviewer');
  const [message, setMessage] = useState('');

  const token = (session as Record<string, unknown> | null)?.accessToken as string | undefined;

  const buildHeaders = useCallback((): HeadersInit => {
    const h: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  const load = useCallback(async () => {
    if (status !== 'authenticated' || !token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/data/api/reviewer-role-requests/`, {
        headers: buildHeaders(),
      });
      if (!res.ok) throw new Error(`Failed to load requests (${res.status})`);
      const data: unknown = await res.json();
      const list = Array.isArray(data)
        ? data
        : (data as { results?: ReviewerRoleRequest[] }).results ?? [];
      setRequests(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load reviewer requests');
    } finally {
      setLoading(false);
    }
  }, [status, token, buildHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  const latest = requests[0];
  const hasPending = latest?.status === 'pending';

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error('Sign in to request reviewer access');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/data/api/reviewer-role-requests/`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ requested_role: role, message }),
      });
      const body: Record<string, unknown> = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errs = body.non_field_errors as string[] | undefined;
        const msg =
          (errs && errs[0]) ||
          (body.detail as string) ||
          `Request failed (${res.status})`;
        toast.error(typeof msg === 'string' ? msg : 'Request failed');
        return;
      }
      toast.success('Your request was submitted. Staff will review it soon.');
      setMessage('');
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const onWithdraw = async () => {
    if (!latest || !token) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `${API_BASE}/data/api/reviewer-role-requests/${latest.id}/withdraw/`,
        { method: 'POST', headers: buildHeaders() }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error((body as { detail?: string }).detail || 'Could not withdraw');
        return;
      }
      toast.success('Request withdrawn');
      await load();
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
          <CardDescription>Sign in to request moderator or reviewer privileges.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={cn('rounded-xl border-0 shadow-sm', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5" />
          Request reviewer / moderator access
        </CardTitle>
        <CardDescription>
          Ask the HeritageGraph team for permission to review contributions. Staff approve requests in the
          Django admin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {latest ? (
          <div className="rounded-lg border border-blue-100 dark:border-gray-700 bg-blue-50/50 dark:bg-gray-900/40 p-4 text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">Latest request</p>
            <div className="flex flex-wrap items-center gap-2 text-blue-800 dark:text-blue-200">
              {latest.status === 'pending' && (
                <>
                  <Clock className="h-4 w-4 shrink-0" />
                  Pending — requested {ROLE_LABELS[latest.requested_role] ?? latest.requested_role}
                </>
              )}
              {latest.status === 'approved' && (
                <>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                  Approved
                </>
              )}
              {latest.status === 'rejected' && (
                <>
                  <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                  Not approved — you may submit a new request later
                </>
              )}
              {latest.status === 'withdrawn' && (
                <>
                  <XCircle className="h-4 w-4 shrink-0 opacity-60" />
                  Withdrawn
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Submitted {new Date(latest.created_at).toLocaleString()}
            </p>
            {latest.status === 'pending' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={submitting}
                onClick={() => void onWithdraw()}
              >
                Withdraw request
              </Button>
            )}
          </div>
        ) : null}

        {hasPending ? (
          <p className="text-sm text-blue-700 dark:text-blue-300">You already have a pending request.</p>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="requested_role">Requested role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="requested_role" className="w-full max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="community_reviewer">
                    Community reviewer — first-line moderation
                  </SelectItem>
                  <SelectItem value="domain_expert">
                    Domain expert — verify claims and conflicts
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
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
              Submit request
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
