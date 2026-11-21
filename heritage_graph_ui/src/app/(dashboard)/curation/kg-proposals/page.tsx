'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { AccessDenied } from '@/components/access-denied';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiFetchJson, getApiErrorMessage } from '@/lib/api-client';
import { getPublicApiUrl } from '@/lib/api-base';
import { useUserRoles } from '@/hooks/use-user-roles';

type EntityProposalRow = {
  id: string;
  status: string;
  canonical_label: string;
  type_scope: string;
  author_username?: string;
};

type RelationshipProposalRow = {
  id: string;
  status: string;
  predicate_label?: string;
  predicate_code?: string;
  subject_entity_type: string;
  subject_entity_id: number;
  object_entity_type: string;
  object_entity_id: number;
  author_username?: string;
};

export default function KgProposalsModerationPage() {
  const { data: session } = useSession();
  const { isModerator, isLoading: rolesLoading } = useUserRoles();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const base = getPublicApiUrl();

  const [tab, setTab] = useState('entity');
  const [entities, setEntities] = useState<EntityProposalRow[]>([]);
  const [relations, setRelations] = useState<RelationshipProposalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectComment, setRejectComment] = useState('');

  const load = useCallback(async () => {
    if (!token || !isModerator) return;
    setLoading(true);
    try {
      const [eList, rList] = await Promise.all([
        apiFetchJson<EntityProposalRow[]>(`${base}/api/v1/data/entity-proposals/`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        }),
        apiFetchJson<RelationshipProposalRow[]>(`${base}/api/v1/data/relationship-proposals/`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        }),
      ]);
      setEntities((Array.isArray(eList) ? eList : []).filter((x) => x.status === 'submitted'));
      setRelations((Array.isArray(rList) ? rList : []).filter((x) => x.status === 'submitted'));
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not load proposals.'));
      setEntities([]);
      setRelations([]);
    } finally {
      setLoading(false);
    }
  }, [base, isModerator, token]);

  useEffect(() => {
    if (token && isModerator) void load();
  }, [load, token, isModerator]);

  const approveEntity = async (id: string) => {
    if (!token) return;
    try {
      await apiFetchJson(`${base}/api/v1/data/entity-proposals/${id}/approve/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ comment: '' }),
      });
      toast.success('Entity proposal approved.');
      void load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Approve failed.'));
    }
  };

  const rejectEntity = async (id: string) => {
    if (!token || !rejectComment.trim()) {
      toast.error('Enter a moderator comment for rejection.');
      return;
    }
    try {
      await apiFetchJson(`${base}/api/v1/data/entity-proposals/${id}/reject/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ comment: rejectComment.trim() }),
      });
      toast.success('Rejected.');
      setRejectComment('');
      void load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Reject failed.'));
    }
  };

  const approveRel = async (id: string) => {
    if (!token) return;
    try {
      await apiFetchJson(`${base}/api/v1/data/relationship-proposals/${id}/approve/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ comment: '' }),
      });
      toast.success('Relationship proposal approved.');
      void load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Approve failed.'));
    }
  };

  const rejectRel = async (id: string) => {
    if (!token || !rejectComment.trim()) {
      toast.error('Enter a moderator comment for rejection.');
      return;
    }
    try {
      await apiFetchJson(`${base}/api/v1/data/relationship-proposals/${id}/reject/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ comment: rejectComment.trim() }),
      });
      toast.success('Rejected.');
      setRejectComment('');
      void load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Reject failed.'));
    }
  };

  if (rolesLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
      </div>
    );
  }

  if (!isModerator) {
    return <AccessDenied requiredRole="moderator" userEmail={session?.user?.email} />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Knowledge graph proposals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Moderator queue for entity clusters and binary relationship assertions (spec 007 —
          Entity &amp; Relationship Contribution Framework).
        </p>
      </div>

      <div className="space-y-2">
        <LabelledRow label="Reject comment (shared)" htmlFor="rej">
          <Input
            id="rej"
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            placeholder="Required when rejecting"
          />
        </LabelledRow>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="entity">Entity ({entities.length})</TabsTrigger>
          <TabsTrigger value="relationship">Relationship ({relations.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="entity" className="mt-4 space-y-3">
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : !entities.length ? (
            <p className="text-sm text-muted-foreground">No submitted entity proposals.</p>
          ) : (
            entities.map((r) => (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{r.canonical_label}</CardTitle>
                  <CardDescription>
                    {r.type_scope} · @{r.author_username ?? '—'} · {r.id.slice(0, 8)}…
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void approveEntity(r.id)}>
                    Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => void rejectEntity(r.id)}>
                    Reject
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
        <TabsContent value="relationship" className="mt-4 space-y-3">
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : !relations.length ? (
            <p className="text-sm text-muted-foreground">No submitted relationship proposals.</p>
          ) : (
            relations.map((r) => (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {r.predicate_label ?? r.predicate_code ?? 'relationship'}
                  </CardTitle>
                  <CardDescription>
                    {r.subject_entity_type}#{r.subject_entity_id} → {r.object_entity_type}#
                    {r.object_entity_id} · @{r.author_username ?? '—'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void approveRel(r.id)}>
                    Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => void rejectRel(r.id)}>
                    Reject
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Button variant="outline" asChild>
        <Link href="/curation/identity">Back to identity hub</Link>
      </Button>
    </div>
  );
}

function LabelledRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}
