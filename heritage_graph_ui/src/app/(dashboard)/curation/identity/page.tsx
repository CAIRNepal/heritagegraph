'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUserRoles } from '@/hooks/use-user-roles';
import { AccessDenied } from '@/components/access-denied';
import { apiFetchJson, getApiErrorMessage } from '@/lib/api-client';
import { getPublicApiUrl } from '@/lib/api-base';
import { toast } from 'sonner';

type CandidateRow = {
  id: string;
  status: string;
  left: { entity_type: string; entity_id: number; title: string };
  right: { entity_type: string; entity_id: number; title: string };
  created_at: string;
};

export default function IdentityQueuePage() {
  const { data: session } = useSession();
  const { isReviewer, isModerator, isLoading } = useUserRoles();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const [tab, setTab] = useState('open');
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    const base = getPublicApiUrl();
    setLoading(true);
    try {
      const data = await apiFetchJson<{ results?: CandidateRow[] } | CandidateRow[]>(
        `${base}/api/v1/cidoc/identity-candidates/?status=${encodeURIComponent(tab)}`,
        {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        }
      );
      const list = Array.isArray(data) ? data : data.results ?? [];
      setRows(list);
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not load identity candidates.'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab, token]);

  useEffect(() => {
    if (token) void load();
  }, [load, token]);

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

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Identity resolution</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Triage suggested merges. Accepting attaches both entities to the target cluster via
          membership assertions.
        </p>
      </div>

      {isModerator ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Knowledge graph proposals</CardTitle>
            <CardDescription>
              Moderate contributor-submitted entity clusters and relationship assertions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" variant="outline" asChild>
              <Link href="/curation/kg-proposals">Open KG proposal queue</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="deferred">Deferred</TabsTrigger>
          <TabsTrigger value="accepted">Accepted</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            </div>
          ) : !rows.length ? (
            <p className="text-sm text-muted-foreground">No candidates in this tab.</p>
          ) : (
            rows.map((r) => (
              <Card key={r.id}>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-base font-medium">
                      {r.left.title} ↔ {r.right.title}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {r.left.entity_type}#{r.left.entity_id} · {r.right.entity_type}#
                      {r.right.entity_id}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">{r.status}</Badge>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{r.created_at}</span>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/curation/identity/${r.id}`}>
                      Open workspace
                      <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
