'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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

const TYPE_SCOPES = [
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
  'ritualevent',
  'festival',
  'castegroup',
] as const;

type DuplicateHit = {
  id: string;
  canonical_label: string;
  type_scope: string;
};

export default function EntityProposalContributePage() {
  const { data: session, status } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [canonicalLabel, setCanonicalLabel] = useState('');
  const [typeScope, setTypeScope] = useState<string>(TYPE_SCOPES[0]);
  const [aliasesText, setAliasesText] = useState('');
  const [anchorEntityId, setAnchorEntityId] = useState('');
  const [anchors, setAnchors] = useState<{ entity_type: string; entity_id: number }[]>([]);
  const [sourcesText, setSourcesText] = useState('');
  const [contributorNote, setContributorNote] = useState('');
  const [externalIdsJson, setExternalIdsJson] = useState('{}');
  const [resolutionMode, setResolutionMode] = useState<'new_cluster' | 'link_existing'>(
    'new_cluster'
  );
  const [existingClusterId, setExistingClusterId] = useState('');
  const [duplicates, setDuplicates] = useState<DuplicateHit[]>([]);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const base = getPublicApiUrl();

  const aliasList = useMemo(
    () =>
      aliasesText
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    [aliasesText]
  );

  const sourceIdList = useMemo(
    () =>
      sourcesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    [sourcesText]
  );

  const fetchDuplicates = useCallback(async () => {
    if (!token || !canonicalLabel.trim() || canonicalLabel.trim().length < 2) {
      setDuplicates([]);
      return;
    }
    try {
      const q = encodeURIComponent(canonicalLabel.trim());
      const ts = encodeURIComponent(typeScope);
      const data = await apiFetchJson<{ results: DuplicateHit[] }>(
        `${base}/api/v1/cidoc/entity-clusters/suggest-duplicates/?q=${q}&type_scope=${ts}`,
        {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        }
      );
      setDuplicates(data.results ?? []);
    } catch {
      setDuplicates([]);
    }
  }, [base, canonicalLabel, token, typeScope]);

  useEffect(() => {
    const t = setTimeout(() => void fetchDuplicates(), 350);
    return () => clearTimeout(t);
  }, [fetchDuplicates]);

  const buildPayload = () => {
    let external_identifiers: Record<string, string> = {};
    try {
      external_identifiers = JSON.parse(externalIdsJson || '{}');
      if (typeof external_identifiers !== 'object' || external_identifiers === null) {
        throw new Error('not object');
      }
    } catch {
      throw new Error('External identifiers must be valid JSON object.');
    }
    return {
      canonical_label: canonicalLabel.trim(),
      type_scope: typeScope,
      aliases: aliasList,
      anchor_records: anchors.map((a) => ({
        entity_type: a.entity_type,
        entity_id: a.entity_id,
      })),
      supporting_source_ids: sourceIdList,
      contributor_note: contributorNote.trim(),
      external_identifiers,
      resolution_mode: resolutionMode,
      existing_cluster:
        resolutionMode === 'link_existing' && existingClusterId.trim()
          ? existingClusterId.trim()
          : null,
    };
  };

  const saveDraft = async () => {
    if (!token) return;
    setBusy(true);
    try {
      let payload;
      try {
        payload = buildPayload();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Invalid form.');
        setBusy(false);
        return;
      }
      if (proposalId) {
        await apiFetchJson(`${base}/api/v1/data/entity-proposals/${proposalId}/`, {
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
          `${base}/api/v1/data/entity-proposals/`,
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
    setBusy(true);
    try {
      let payload;
      try {
        payload = buildPayload();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Invalid form.');
        setBusy(false);
        return;
      }
      let id = proposalId;
      if (!id) {
        const created = await apiFetchJson<{ id: string }>(
          `${base}/api/v1/data/entity-proposals/`,
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
        await apiFetchJson(`${base}/api/v1/data/entity-proposals/${id}/`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });
      }
      await apiFetchJson(`${base}/api/v1/data/entity-proposals/${id}/submit/`, {
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

  const addAnchor = () => {
    const n = parseInt(anchorEntityId, 10);
    if (!Number.isFinite(n)) {
      toast.error('Anchor entity ID must be a number.');
      return;
    }
    setAnchors([...anchors, { entity_type: typeScope, entity_id: n }]);
    setAnchorEntityId('');
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
        <p className="text-muted-foreground">Sign in with Google to submit entity proposals.</p>
        <Button asChild>
          <Link href="/auth/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Entity proposal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Propose a canonical identity cluster anchored on existing CIDOC rows. Moderators approve
          materialization into{' '}
          <code className="rounded bg-muted px-1 text-xs">EntityCluster</code> + membership
          assertions.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Duplicate hints</CardTitle>
          <CardDescription>
            Matches on cluster canonical label (not fuzzy). Refine the label to explore collisions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!duplicates.length ? (
            <p className="text-muted-foreground">No hits yet — try a longer label query.</p>
          ) : (
            <ul className="list-inside list-disc space-y-1">
              {duplicates.map((d) => (
                <li key={d.id}>
                  <span className="font-medium">{d.canonical_label}</span>{' '}
                  <span className="text-muted-foreground">
                    ({d.type_scope}) · {d.id.slice(0, 8)}…
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Proposal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="canonical_label">Canonical label</Label>
            <Input
              id="canonical_label"
              value={canonicalLabel}
              onChange={(e) => setCanonicalLabel(e.target.value)}
              placeholder="e.g. Prithvi Narayan Shah"
            />
          </div>

          <div className="space-y-2">
            <Label>Type scope</Label>
            <Select value={typeScope} onValueChange={setTypeScope}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose entity class" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_SCOPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="aliases">Aliases (comma or newline separated)</Label>
            <Textarea
              id="aliases"
              value={aliasesText}
              onChange={(e) => setAliasesText(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Anchors (CIDOC rows)</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                className="max-w-[200px]"
                placeholder={`${typeScope} numeric ID`}
                value={anchorEntityId}
                onChange={(e) => setAnchorEntityId(e.target.value)}
              />
              <Button type="button" variant="secondary" onClick={addAnchor}>
                Add anchor
              </Button>
            </div>
            {anchors.length ? (
              <ul className="text-sm text-muted-foreground">
                {anchors.map((a, i) => (
                  <li key={`${a.entity_type}-${a.entity_id}-${i}`}>
                    {a.entity_type}#{a.entity_id}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">At least one anchor required to submit.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sources">Supporting DataSource UUIDs (one per line)</Label>
            <Textarea
              id="sources"
              value={sourcesText}
              onChange={(e) => setSourcesText(e.target.value)}
              rows={3}
              placeholder="Paste UUID(s) from Data Source records"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Contributor note</Label>
            <Textarea
              id="note"
              value={contributorNote}
              onChange={(e) => setContributorNote(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ext">External identifiers (JSON object)</Label>
            <Textarea
              id="ext"
              value={externalIdsJson}
              onChange={(e) => setExternalIdsJson(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-3">
            <Label>Resolution</Label>
            <RadioGroup
              value={resolutionMode}
              onValueChange={(v) => setResolutionMode(v as 'new_cluster' | 'link_existing')}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="new_cluster" id="r-new" />
                <Label htmlFor="r-new" className="font-normal">
                  Create new cluster
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="link_existing" id="r-link" />
                <Label htmlFor="r-link" className="font-normal">
                  Link anchors to existing cluster
                </Label>
              </div>
            </RadioGroup>
            {resolutionMode === 'link_existing' ? (
              <Input
                placeholder="Existing EntityCluster UUID"
                value={existingClusterId}
                onChange={(e) => setExistingClusterId(e.target.value)}
              />
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" disabled={busy} onClick={() => void saveDraft()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save draft'}
            </Button>
            <Button type="button" variant="default" disabled={busy} onClick={() => void submitForReview()}>
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
