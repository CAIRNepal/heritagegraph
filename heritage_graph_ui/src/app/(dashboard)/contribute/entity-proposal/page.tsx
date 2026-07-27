'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

import {
  CidocEntityPicker,
  DataSourceAddPicker,
  EntityClusterPicker,
} from '@/components/cidoc/cidoc-proposal-pickers';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import {
  buildPatternCompletionUrl,
  parseSemanticWorkflowParams,
} from '@/lib/semantic-workflow-params';
import { getCidocListSegment, TYPE_SCOPES } from '@/lib/cidoc-type-scope';
import {
  coerceFkPk,
  fetchCidocEntityRowLabel,
  fetchDataSourcePickerLabel,
  fetchEntityClusterPickerLabel,
  normalizeAnchorRecords,
  normalizeUuidList,
} from '@/lib/kg-proposal-hydrate';

type DuplicateHit = {
  id: string;
  canonical_label: string;
  type_scope: string;
};

type EntityProposalDetail = {
  id: string;
  status: string;
  canonical_label: string;
  type_scope: string;
  aliases: unknown;
  anchor_records: unknown;
  supporting_source_ids: unknown;
  contributor_note: string;
  external_identifiers: unknown;
  resolution_mode: string;
  existing_cluster: unknown;
};

export default function EntityProposalContributePage() {
  const { data: session, status } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftIdParam = searchParams.get('id');

  const [canonicalLabel, setCanonicalLabel] = useState('');
  const [typeScope, setTypeScope] = useState<string>(TYPE_SCOPES[0]);
  const [aliasesText, setAliasesText] = useState('');
  const [anchors, setAnchors] = useState<
    { entity_type: string; entity_id: number; label?: string }[]
  >([]);
  const [supportingSources, setSupportingSources] = useState<
    { id: string; label: string }[]
  >([]);
  const [contributorNote, setContributorNote] = useState('');
  const [externalIdsJson, setExternalIdsJson] = useState('{}');
  const [resolutionMode, setResolutionMode] = useState<'new_cluster' | 'link_existing'>(
    'new_cluster'
  );
  const [existingClusterId, setExistingClusterId] = useState('');
  const [existingClusterLabel, setExistingClusterLabel] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateHit[]>([]);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draftHydrating, setDraftHydrating] = useState(false);
  const [proposalEditable, setProposalEditable] = useState(true);

  const base = getPublicApiUrl();

  const cidocSegment = getCidocListSegment(typeScope);

  const aliasList = useMemo(
    () =>
      aliasesText
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    [aliasesText]
  );

  const supportingIdSet = useMemo(
    () => new Set(supportingSources.map((s) => s.id)),
    [supportingSources]
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

  useEffect(() => {
    if (!token || !draftIdParam) {
      if (!draftIdParam) {
        setDraftHydrating(false);
        setProposalId(null);
        setProposalEditable(true);
      }
      return;
    }

    let cancelled = false;
    setDraftHydrating(true);
    setProposalEditable(true);

    (async () => {
      try {
        const row = await apiFetchJson<EntityProposalDetail>(
          `${base}/api/v1/data/entity-proposals/${draftIdParam}/`,
          { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
        );
        if (cancelled) return;

        if (row.status !== 'draft') {
          setProposalEditable(false);
          toast.message(`This proposal is ${row.status}; it cannot be edited.`);
        }

        setProposalId(row.id);
        setCanonicalLabel(row.canonical_label ?? '');

        const tsRaw =
          typeof row.type_scope === 'string' && row.type_scope
            ? row.type_scope
            : TYPE_SCOPES[0];
        const ts = (TYPE_SCOPES as readonly string[]).includes(tsRaw) ? tsRaw : TYPE_SCOPES[0];
        if (ts !== tsRaw) {
          toast.message(`Unknown type scope "${tsRaw}"; using "${ts}".`);
        }
        setTypeScope(ts);

        const aliasArr = Array.isArray(row.aliases)
          ? row.aliases.filter((x): x is string => typeof x === 'string')
          : [];
        setAliasesText(aliasArr.join('\n'));

        setContributorNote(typeof row.contributor_note === 'string' ? row.contributor_note : '');

        try {
          const ext =
            row.external_identifiers &&
            typeof row.external_identifiers === 'object' &&
            row.external_identifiers !== null
              ? row.external_identifiers
              : {};
          setExternalIdsJson(JSON.stringify(ext, null, 2));
        } catch {
          setExternalIdsJson('{}');
        }

        const res =
          row.resolution_mode === 'link_existing' || row.resolution_mode === 'new_cluster'
            ? row.resolution_mode
            : 'new_cluster';
        setResolutionMode(res);

        const clusterPk = coerceFkPk(row.existing_cluster);
        if (clusterPk) {
          setExistingClusterId(clusterPk);
          const lab = await fetchEntityClusterPickerLabel(token, base, clusterPk);
          if (!cancelled) setExistingClusterLabel(lab);
        } else {
          setExistingClusterId('');
          setExistingClusterLabel(null);
        }

        const anchorsRaw = normalizeAnchorRecords(row.anchor_records);
        const anchorRows = await Promise.all(
          anchorsRaw.map(async (a) => ({
            entity_type: a.entity_type,
            entity_id: a.entity_id,
            label: await fetchCidocEntityRowLabel(token, base, a.entity_type, a.entity_id),
          }))
        );
        if (!cancelled) setAnchors(anchorRows);

        const supIds = normalizeUuidList(row.supporting_source_ids);
        const supRows = await Promise.all(
          supIds.map(async (id) => ({
            id,
            label: await fetchDataSourcePickerLabel(token, base, id),
          }))
        );
        if (!cancelled) setSupportingSources(supRows);
      } catch (e) {
        if (!cancelled) toast.error(getApiErrorMessage(e, 'Could not load proposal draft.'));
      } finally {
        if (!cancelled) setDraftHydrating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [base, draftIdParam, token]);

  const buildPayload = () => {
    let external_identifiers: Record<string, string> = {};
    try {
      const parsed = JSON.parse(externalIdsJson || '{}');
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('not object');
      }
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (!k.trim()) {
          throw new Error('External identifiers: empty key is not allowed.');
        }
        if (typeof v !== 'string' || !v.trim()) {
          throw new Error(
            `External identifiers: value for "${k}" must be a non-empty string (use http/https IRIs when applicable).`
          );
        }
        out[k.trim()] = v.trim();
      }
      external_identifiers = out;
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error('External identifiers must be valid JSON object.');
      }
      throw e instanceof Error ? e : new Error('Invalid external identifiers.');
    }
    return {
      canonical_label: canonicalLabel.trim(),
      type_scope: typeScope,
      aliases: aliasList,
      anchor_records: anchors.map((a) => ({
        entity_type: a.entity_type,
        entity_id: a.entity_id,
      })),
      supporting_source_ids: supportingSources.map((s) => s.id),
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
    if (!proposalEditable) {
      toast.error('This proposal cannot be edited.');
      return;
    }
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
        router.replace(`/contribute/entity-proposal?id=${created.id}`, { scroll: false });
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
    if (!proposalEditable) {
      toast.error('This proposal cannot be edited.');
      return;
    }
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
        router.replace(`/contribute/entity-proposal?id=${id}`, { scroll: false });
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
      const wfCtx = parseSemanticWorkflowParams(searchParams);
      if (wfCtx) {
        router.replace(buildPatternCompletionUrl(wfCtx.patternKey, wfCtx.stepOrder));
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Submit failed.'));
    } finally {
      setBusy(false);
    }
  };

  const addAnchor = (entity_id: number, label: string) => {
    const dup = anchors.some((a) => a.entity_type === typeScope && a.entity_id === entity_id);
    if (dup) {
      toast.message('That row is already an anchor.');
      return;
    }
    setAnchors([...anchors, { entity_type: typeScope, entity_id, label }]);
  };

  const removeAnchor = (index: number) => {
    setAnchors(anchors.filter((_, i) => i !== index));
  };

  const removeSupporting = (id: string) => {
    setSupportingSources((prev) => prev.filter((s) => s.id !== id));
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
        <h1 className="text-2xl font-semibold tracking-tight">Link duplicate records</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Propose that two or more existing records refer to the same real place, person, or thing.
          Reviewers check your evidence before the records are linked. To edit a saved draft, open it
          from My contributions or add <code className="rounded bg-muted px-1 text-xs">?id=</code>{" "}
          with the draft id in the URL.
        </p>
        {draftHydrating ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading draft…
          </p>
        ) : null}
        {draftIdParam && proposalEditable ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Editing draft{' '}
            <code className="rounded bg-muted px-1 text-xs">{draftIdParam.slice(0, 8)}…</code>
            {' · '}
            <Link
              href="/contribute/entity-proposal"
              className="text-primary underline-offset-4 hover:underline"
            >
              New proposal
            </Link>
          </p>
        ) : null}
        {!proposalEditable ? (
          <p className="mt-2 text-sm text-destructive">This proposal is no longer editable.</p>
        ) : null}
      </div>

      <Alert>
        <AlertTitle>Same real-world identity</AlertTitle>
        <AlertDescription className="text-sm leading-relaxed">
          Pick the records that should be treated as the same thing, and attach at least one{" "}
          <Link className="text-primary underline-offset-4 hover:underline" href="/contribute/data-source">
            evidence source
          </Link>{" "}
          before you submit. After approval, reviewers link them under one identity. Optional
          external links (for example Wikidata URLs) help connect this identity to the wider web.
        </AlertDescription>
      </Alert>

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
        <CardContent>
          <fieldset
            disabled={draftHydrating || !proposalEditable}
            className="min-w-0 space-y-4 border-0 p-0 disabled:pointer-events-none disabled:opacity-60"
          >
          <div className="space-y-2">
            <Label htmlFor="canonical_label">Preferred name</Label>
            <Input
              id="canonical_label"
              value={canonicalLabel}
              onChange={(e) => setCanonicalLabel(e.target.value)}
              placeholder="e.g. Prithvi Narayan Shah"
            />
          </div>

          <div className="space-y-2">
            <Label>What kind of thing?</Label>
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
            <Label htmlFor="aliases">Other names (optional)</Label>
            <Textarea
              id="aliases"
              value={aliasesText}
              onChange={(e) => setAliasesText(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Records to link</Label>
            {cidocSegment ? (
              <div className="flex flex-wrap items-center gap-2">
                <CidocEntityPicker
                  token={token}
                  apiSegment={cidocSegment}
                  placeholder={`Add ${typeScope}…`}
                  onSelect={(id, label) => addAnchor(id, label)}
                />
              </div>
            ) : (
              <p className="text-sm text-destructive">Unknown type — pick another kind.</p>
            )}
            {anchors.length ? (
              <ul className="flex flex-col gap-2 text-sm">
                {anchors.map((a, i) => (
                  <li
                    key={`${a.entity_type}-${a.entity_id}-${i}`}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                  >
                    <span className="text-muted-foreground">
                      <span className="text-foreground">{a.label ?? `#${a.entity_id}`}</span>
                      <span className="text-xs"> · {a.entity_type} #{a.entity_id}</span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      aria-label="Remove anchor"
                      onClick={() => removeAnchor(i)}
                    >
                      <X className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">At least one anchor required to submit.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Supporting evidence</Label>
            <div className="flex flex-wrap items-center gap-2">
              <DataSourceAddPicker
                token={token}
                excludeIds={supportingIdSet}
                onAdd={(id, label) =>
                  setSupportingSources((prev) =>
                    prev.some((s) => s.id === id) ? prev : [...prev, { id, label }]
                  )
                }
              />
            </div>
            {supportingSources.length ? (
              <div className="flex flex-wrap gap-2">
                {supportingSources.map((s) => (
                  <Badge key={s.id} variant="secondary" className="gap-1 py-1 pr-1 font-normal">
                    <span className="max-w-[200px] truncate">{s.label}</span>
                    <button
                      type="button"
                      className="hover:bg-muted rounded-sm p-0.5"
                      aria-label={`Remove ${s.id}`}
                      onClick={() => removeSupporting(s.id)}
                    >
                      <X className="size-3.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Optional evidence rows (recommended before submit).
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note for reviewers</Label>
            <Textarea
              id="note"
              value={contributorNote}
              onChange={(e) => setContributorNote(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ext">
              External identifiers (JSON object, string IRIs recommended)
            </Label>
            <p className="text-xs text-muted-foreground">
              Example:{' '}
              <code className="rounded bg-muted px-1 text-[11px]">
                {`{"wikidata": "https://www.wikidata.org/entity/Q42"}`}
              </code>
            </p>
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
              <EntityClusterPicker
                token={token}
                typeScope={typeScope}
                placeholder="Select EntityCluster…"
                selectionSummary={existingClusterLabel}
                onSelect={(id, label) => {
                  setExistingClusterId(id);
                  setExistingClusterLabel(label);
                }}
              />
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              disabled={busy || draftHydrating || !proposalEditable}
              onClick={() => void saveDraft()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save draft'}
            </Button>
            <Button
              type="button"
              variant="default"
              disabled={busy || draftHydrating || !proposalEditable}
              onClick={() => void submitForReview()}
            >
              Submit for review
            </Button>
            <Button variant="outline" asChild>
              <Link href="/contribute">Back</Link>
            </Button>
          </div>
          </fieldset>
        </CardContent>
      </Card>
    </div>
  );
}
