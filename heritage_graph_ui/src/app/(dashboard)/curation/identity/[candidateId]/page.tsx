'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUserRoles } from '@/hooks/use-user-roles';
import { AccessDenied } from '@/components/access-denied';
import { apiFetchJson, getApiErrorMessage } from '@/lib/api-client';
import { getPublicApiUrl } from '@/lib/api-base';
import { toast } from 'sonner';
import type { IdentitySummaryPayload } from '@/components/knowledge/competing-identities-panel';
import { IdentityClusterControls } from '@/components/curation/identity-cluster-controls';

type CandidateDetail = {
  id: string;
  status: string;
  notes: string;
  signal_scores: Record<string, unknown>;
  left: { entity_type: string; entity_id: number; title: string };
  right: { entity_type: string; entity_id: number; title: string };
};

type ClusterDetail = {
  id: string;
  canonical_label: string;
  locked: boolean;
  version: number;
};

export default function IdentityCandidateWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const candidateId = params.candidateId as string;
  const { data: session } = useSession();
  const { isReviewer, isLoading, reviewerRole, isStaff } = useUserRoles();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const isExpertCurator = Boolean(isStaff || reviewerRole?.role === 'expert_curator');

  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [leftSum, setLeftSum] = useState<IdentitySummaryPayload | null>(null);
  const [rightSum, setRightSum] = useState<IdentitySummaryPayload | null>(null);
  const [clusters, setClusters] = useState<Record<string, ClusterDetail>>({});
  const [targetClusterId, setTargetClusterId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const base = getPublicApiUrl();

  const fetchClusterMeta = useCallback(
    async (cid: string) => {
      if (!token) return;
      try {
        const row = await apiFetchJson<ClusterDetail>(
          `${base}/api/v1/cidoc/entity-clusters/${encodeURIComponent(cid)}/`,
          { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
        );
        setClusters((prev) => (prev[cid] ? prev : { ...prev, [cid]: row }));
      } catch {
        /* optional */
      }
    },
    [base, token]
  );

  const load = useCallback(async () => {
    if (!token || !candidateId) return;
    setLoading(true);
    setClusters({});
    try {
      const c = await apiFetchJson<CandidateDetail>(
        `${base}/api/v1/cidoc/identity-candidates/${encodeURIComponent(candidateId)}/`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
      );
      setCandidate(c);
      const [ls, rs] = await Promise.all([
        apiFetchJson<IdentitySummaryPayload>(
          `${base}/api/v1/cidoc/identity-summary/?entity_type=${encodeURIComponent(c.left.entity_type)}&entity_id=${c.left.entity_id}`,
          { headers: { Accept: 'application/json' } }
        ),
        apiFetchJson<IdentitySummaryPayload>(
          `${base}/api/v1/cidoc/identity-summary/?entity_type=${encodeURIComponent(c.right.entity_type)}&entity_id=${c.right.entity_id}`,
          { headers: { Accept: 'application/json' } }
        ),
      ]);
      setLeftSum(ls);
      setRightSum(rs);
      const ids = new Set<string>();
      if (ls.primary_cluster_id) ids.add(ls.primary_cluster_id);
      if (rs.primary_cluster_id) ids.add(rs.primary_cluster_id);
      await Promise.all([...ids].map((id) => fetchClusterMeta(id)));
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not load candidate.'));
      setCandidate(null);
    } finally {
      setLoading(false);
    }
  }, [base, candidateId, token, fetchClusterMeta]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (resolution: 'accept' | 'reject' | 'defer') => {
    if (!token) return;
    setSubmitting(true);
    try {
      await apiFetchJson(
        `${base}/api/v1/cidoc/identity-candidates/${encodeURIComponent(candidateId)}/resolve/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            resolution,
            notes,
            target_cluster_id:
              resolution === 'accept' && targetClusterId.trim()
                ? targetClusterId.trim()
                : undefined,
          }),
        }
      );
      toast.success('Resolution recorded.');
      router.push('/curation/identity');
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Resolution failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
      </div>
    );
  }

  if (!isReviewer) {
    return <AccessDenied requiredRole="reviewer" userEmail={session?.user?.email} />;
  }

  if (loading || !candidate) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
      </div>
    );
  }

  const clusterIds = Array.from(
    new Set(
      [leftSum?.primary_cluster_id, rightSum?.primary_cluster_id].filter(Boolean) as string[]
    )
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/curation/identity">
            <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
            Queue
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">Identity workspace</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Left entity</CardTitle>
            <CardDescription>
              {candidate.left.entity_type} #{candidate.left.entity_id}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{candidate.left.title}</p>
            {leftSum?.canonical_label ? (
              <p className="text-xs text-muted-foreground">
                Canonical cluster label: {leftSum.canonical_label}
              </p>
            ) : null}
            {leftSum?.competing ? (
              <p className="text-xs text-amber-800 dark:text-amber-200">
                Competing identities on this side — pick a target cluster explicitly.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Signals</CardTitle>
            <CardDescription>Heuristic scores from refresh job</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[220px] rounded border bg-muted/30 p-2 text-xs font-mono">
              <pre className="whitespace-pre-wrap break-all">
                {JSON.stringify(candidate.signal_scores || {}, null, 2)}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Right entity</CardTitle>
            <CardDescription>
              {candidate.right.entity_type} #{candidate.right.entity_id}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{candidate.right.title}</p>
            {rightSum?.canonical_label ? (
              <p className="text-xs text-muted-foreground">
                Canonical cluster label: {rightSum.canonical_label}
              </p>
            ) : null}
            {rightSum?.competing ? (
              <p className="text-xs text-amber-800 dark:text-amber-200">
                Competing identities on this side — pick a target cluster explicitly.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Decision</CardTitle>
            <CardDescription>Status: {candidate.status}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="target">Target cluster UUID (accept)</Label>
              <Input
                id="target"
                value={targetClusterId}
                onChange={(e) => setTargetClusterId(e.target.value)}
                placeholder="Existing cluster to attach both entities"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={submitting || candidate.status !== 'open'}
                onClick={() => void resolve('accept')}
              >
                Accept
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={submitting || candidate.status !== 'open'}
                onClick={() => void resolve('defer')}
              >
                Defer
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={submitting || candidate.status !== 'open'}
                onClick={() => void resolve('reject')}
              >
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>

        {isExpertCurator ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Expert cluster tools</h3>
            {clusterIds.map((cid) =>
              clusters[cid] ? (
                <IdentityClusterControls
                  key={cid}
                  cluster={clusters[cid]}
                  token={token}
                  onUpdated={() => void load()}
                />
              ) : null
            )}
            {!clusterIds.length ? (
              <p className="text-xs text-muted-foreground">
                No primary cluster on file for these entities yet — create or bootstrap clusters
                first.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
