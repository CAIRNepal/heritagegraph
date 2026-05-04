'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiFetchJson, getApiErrorMessage } from '@/lib/api-client';
import { getPublicApiUrl } from '@/lib/api-base';

const ENTITY_TYPES = [
  'person',
  'location',
  'event',
  'source',
  'guthi',
  'deity',
  'monument',
  'tradition',
  'historicalperiod',
  'architecturalstructure',
] as const;

type PredicateRow = { id: string; code: string; label: string };

export default function RelationshipProposalContributePage() {
  const { data: session, status } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const base = getPublicApiUrl();

  const [predicates, setPredicates] = useState<PredicateRow[]>([]);
  const [predicateId, setPredicateId] = useState('');
  const [subjectType, setSubjectType] = useState<string>(ENTITY_TYPES[0]);
  const [subjectId, setSubjectId] = useState('');
  const [objectType, setObjectType] = useState<string>(ENTITY_TYPES[0]);
  const [objectId, setObjectId] = useState('');
  const [primarySourceId, setPrimarySourceId] = useState('');
  const [supportingLines, setSupportingLines] = useState('');
  const [temporal, setTemporal] = useState('');
  const [confidence, setConfidence] = useState('likely');
  const [note, setNote] = useState('');
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadPredicates = useCallback(async () => {
    try {
      const rows = await apiFetchJson<PredicateRow[]>(
        `${base}/api/v1/cidoc/relationship-predicates/`,
        { headers: { Accept: 'application/json' } }
      );
      const list = Array.isArray(rows) ? rows : [];
      setPredicates(list);
      setPredicateId((prev) => prev || list[0]?.id || '');
    } catch {
      toast.error('Could not load predicates.');
    }
  }, [base]);

  useEffect(() => {
    void loadPredicates();
  }, [loadPredicates]);

  const buildPayload = () => ({
    predicate: predicateId,
    subject_entity_type: subjectType,
    subject_entity_id: parseInt(subjectId, 10),
    object_entity_type: objectType,
    object_entity_id: parseInt(objectId, 10),
    primary_source: primarySourceId.trim(),
    supporting_source_ids: supportingLines
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    temporal_scope_edtf: temporal.trim(),
    confidence,
    interpretation_note: note.trim(),
  });

  const saveDraft = async () => {
    if (!token) return;
    const sid = parseInt(subjectId, 10);
    const oid = parseInt(objectId, 10);
    if (!Number.isFinite(sid) || !Number.isFinite(oid)) {
      toast.error('Subject and object IDs must be integers.');
      return;
    }
    setBusy(true);
    try {
      const payload = buildPayload();
      if (proposalId) {
        await apiFetchJson(`${base}/api/v1/data/relationship-proposals/${proposalId}/`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });
        toast.success('Draft updated.');
      } else {
        const created = await apiFetchJson<{ id: string }>(
          `${base}/api/v1/data/relationship-proposals/`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(payload),
          }
        );
        setProposalId(created.id);
        toast.success('Draft saved.');
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not save draft.'));
    } finally {
      setBusy(false);
    }
  };

  const submitForReview = async () => {
    if (!token) return;
    const sid = parseInt(subjectId, 10);
    const oid = parseInt(objectId, 10);
    if (!Number.isFinite(sid) || !Number.isFinite(oid)) {
      toast.error('Subject and object IDs must be integers.');
      return;
    }
    if (!primarySourceId.trim()) {
      toast.error('Primary DataSource UUID is required.');
      return;
    }
    setBusy(true);
    try {
      const payload = buildPayload();
      let id = proposalId;
      if (!id) {
        const created = await apiFetchJson<{ id: string }>(
          `${base}/api/v1/data/relationship-proposals/`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(payload),
          }
        );
        id = created.id;
        setProposalId(id);
      } else {
        await apiFetchJson(`${base}/api/v1/data/relationship-proposals/${id}/`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });
      }
      await apiFetchJson(`${base}/api/v1/data/relationship-proposals/${id}/submit/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      toast.success('Submitted for moderator review.');
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Submit failed.'));
    } finally {
      setBusy(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <p className="text-muted-foreground">
          Sign in with Google to propose asserted relationships.
        </p>
        <Button asChild>
          <Link href="/auth/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Relationship proposal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Binary claims between CIDOC rows with mandatory primary DataSource. Approved rows become{' '}
          <code className="rounded bg-muted px-1 text-xs">HeritageAssertion</code> with{' '}
          <code className="rounded bg-muted px-1 text-xs">relationship.*</code> predicates.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Claim</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Predicate</Label>
            <Select value={predicateId} onValueChange={setPredicateId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose predicate" />
              </SelectTrigger>
              <SelectContent>
                {predicates.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label} ({p.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Subject type</Label>
              <Select value={subjectType} onValueChange={setSubjectType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Subject numeric ID"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Object type</Label>
              <Select value={objectType} onValueChange={setObjectType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Object numeric ID"
                value={objectId}
                onChange={(e) => setObjectId(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ps">Primary DataSource UUID</Label>
            <Input
              id="ps"
              value={primarySourceId}
              onChange={(e) => setPrimarySourceId(e.target.value)}
              placeholder="Required — evidences the claim"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sup">Supporting DataSource UUIDs (optional, one per line)</Label>
            <Textarea
              id="sup"
              rows={2}
              value={supportingLines}
              onChange={(e) => setSupportingLines(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ts">Temporal scope (EDTF or text)</Label>
            <Input id="ts" value={temporal} onChange={(e) => setTemporal(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Confidence</Label>
            <Select value={confidence} onValueChange={setConfidence}>
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="certain">Certain (Established)</SelectItem>
                <SelectItem value="likely">Likely (Probable)</SelectItem>
                <SelectItem value="uncertain">Uncertain</SelectItem>
                <SelectItem value="speculative">Speculative</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Interpretation note</Label>
            <Textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" disabled={busy} onClick={() => void saveDraft()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save draft'}
            </Button>
            <Button type="button" disabled={busy} onClick={() => void submitForReview()}>
              Submit for review
            </Button>
            <Button variant="outline" asChild>
              <Link href="/contribute">Back</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
