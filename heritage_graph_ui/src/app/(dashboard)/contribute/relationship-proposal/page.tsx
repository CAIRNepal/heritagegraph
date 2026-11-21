'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

import {
  CidocEntityPicker,
  DataSourceAddPicker,
  DataSourcePicker,
} from '@/components/cidoc/cidoc-proposal-pickers';
import { Badge } from '@/components/ui/badge';
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
import {
  buildPatternCompletionUrl,
  parseSemanticWorkflowParams,
} from '@/lib/semantic-workflow-params';
import { getCidocListSegment, TYPE_SCOPES, unwrapCidocList } from '@/lib/cidoc-type-scope';
import {
  coerceFkPk,
  fetchCidocEntityRowLabel,
  fetchDataSourcePickerLabel,
  normalizeUuidList,
} from '@/lib/kg-proposal-hydrate';

type PredicateRow = { id: string; code: string; label: string };

type RelationshipProposalDetail = {
  id: string;
  status: string;
  predicate: unknown;
  subject_entity_type: unknown;
  subject_entity_id: unknown;
  object_entity_type: unknown;
  object_entity_id: unknown;
  primary_source: unknown;
  supporting_source_ids: unknown;
  temporal_scope_edtf: string;
  confidence: string;
  interpretation_note: string;
};

function normalizeEntityTypeScope(raw: unknown): string {
  const s = typeof raw === 'string' && raw.trim() ? raw.trim() : TYPE_SCOPES[0];
  return (TYPE_SCOPES as readonly string[]).includes(s) ? s : TYPE_SCOPES[0];
}

function toPositiveInt(raw: unknown): number | null {
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? Number.parseInt(raw, 10)
        : NaN;
  return Number.isFinite(n) && Number.isInteger(n) && n >= 1 ? n : null;
}

export default function RelationshipProposalContributePage() {
  const { data: session, status } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftIdParam = searchParams.get('id');
  const base = getPublicApiUrl();
  const seededFromQuery = useRef(false);
  const predicateHintApplied = useRef(false);

  const [predicates, setPredicates] = useState<PredicateRow[]>([]);
  const [predicateId, setPredicateId] = useState('');
  const [subjectType, setSubjectType] = useState<string>(TYPE_SCOPES[0]);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [subjectLabel, setSubjectLabel] = useState<string | null>(null);
  const [objectType, setObjectType] = useState<string>(TYPE_SCOPES[0]);
  const [objectId, setObjectId] = useState<number | null>(null);
  const [objectLabel, setObjectLabel] = useState<string | null>(null);
  const [primarySourceId, setPrimarySourceId] = useState('');
  const [primarySourceLabel, setPrimarySourceLabel] = useState<string | null>(null);
  const [supportingSources, setSupportingSources] = useState<
    { id: string; label: string }[]
  >([]);
  const [temporal, setTemporal] = useState('');
  const [confidence, setConfidence] = useState('likely');
  const [note, setNote] = useState('');
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draftHydrating, setDraftHydrating] = useState(false);
  const [proposalEditable, setProposalEditable] = useState(true);

  const subjectSegment = getCidocListSegment(subjectType);
  const objectSegment = getCidocListSegment(objectType);

  const supportingExcludeIds = useMemo(() => {
    const s = new Set<string>();
    if (primarySourceId.trim()) s.add(primarySourceId.trim());
    supportingSources.forEach((x) => s.add(x.id));
    return s;
  }, [primarySourceId, supportingSources]);

  const loadPredicates = useCallback(async () => {
    try {
      const data = await apiFetchJson<unknown>(
        `${base}/api/v1/cidoc/relationship-predicates/`,
        { headers: { Accept: 'application/json' } }
      );
      const list = unwrapCidocList<PredicateRow>(data);
      setPredicates(list);
      setPredicateId((prev) => prev || list[0]?.id || '');
    } catch {
      toast.error('Could not load predicates.');
    }
  }, [base]);

  useEffect(() => {
    void loadPredicates();
  }, [loadPredicates]);

  useEffect(() => {
    if (draftIdParam || seededFromQuery.current) return;

    const subt = searchParams.get('subjectType');
    const objt = searchParams.get('objectType');
    if (subt) setSubjectType(normalizeEntityTypeScope(subt));
    if (objt) setObjectType(normalizeEntityTypeScope(objt));

    const sid = toPositiveInt(searchParams.get('subjectId'));
    const oid = toPositiveInt(searchParams.get('objectId'));
    if (sid !== null) setSubjectId(sid);
    if (oid !== null) setObjectId(oid);

    const temporalHint = searchParams.get('temporal');
    if (typeof temporalHint === 'string' && temporalHint.trim()) {
      setTemporal(temporalHint.trim());
    }

    seededFromQuery.current = true;
  }, [draftIdParam, searchParams]);

  useEffect(() => {
    if (draftIdParam || !token) return;

    let cancelled = false;
    (async () => {
      if (
        subjectId !== null &&
        subjectLabel === null &&
        getCidocListSegment(subjectType)
      ) {
        const lab = await fetchCidocEntityRowLabel(token, base, subjectType, subjectId);
        if (!cancelled) setSubjectLabel(lab ?? `#${subjectId}`);
      }
      if (
        objectId !== null &&
        objectLabel === null &&
        getCidocListSegment(objectType)
      ) {
        const lab = await fetchCidocEntityRowLabel(token, base, objectType, objectId);
        if (!cancelled) setObjectLabel(lab ?? `#${objectId}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    base,
    draftIdParam,
    token,
    subjectId,
    objectId,
    subjectType,
    objectType,
    subjectLabel,
    objectLabel,
  ]);

  useEffect(() => {
    if (
      draftIdParam ||
      predicates.length === 0 ||
      predicateHintApplied.current
    )
      return;
    const code = searchParams.get('predicateCode');
    if (!code?.trim()) return;
    const want = code.trim().toLowerCase();
    const row = predicates.find(
      (p) =>
        p.code.toLowerCase() === want ||
        p.label.toLowerCase() === want ||
        p.label.toLowerCase().includes(want)
    );
    if (row) {
      setPredicateId(row.id);
      predicateHintApplied.current = true;
    }
  }, [draftIdParam, predicates, searchParams]);

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
        const row = await apiFetchJson<RelationshipProposalDetail>(
          `${base}/api/v1/data/relationship-proposals/${draftIdParam}/`,
          { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
        );
        if (cancelled) return;

        if (row.status !== 'draft') {
          setProposalEditable(false);
          toast.message(`This proposal is ${row.status}; it cannot be edited.`);
        }

        setProposalId(row.id);

        const predPk = coerceFkPk(row.predicate);
        if (predPk) setPredicateId(predPk);

        const subTsRaw = normalizeEntityTypeScope(row.subject_entity_type);
        const objTsRaw = normalizeEntityTypeScope(row.object_entity_type);
        if (
          typeof row.subject_entity_type === 'string' &&
          row.subject_entity_type &&
          subTsRaw !== row.subject_entity_type
        ) {
          toast.message(`Unknown subject type "${row.subject_entity_type}"; using "${subTsRaw}".`);
        }
        if (
          typeof row.object_entity_type === 'string' &&
          row.object_entity_type &&
          objTsRaw !== row.object_entity_type
        ) {
          toast.message(`Unknown object type "${row.object_entity_type}"; using "${objTsRaw}".`);
        }

        setSubjectType(subTsRaw);
        setObjectType(objTsRaw);

        const sid = toPositiveInt(row.subject_entity_id);
        const oid = toPositiveInt(row.object_entity_id);
        if (sid !== null) {
          setSubjectId(sid);
          const lab = await fetchCidocEntityRowLabel(token, base, subTsRaw, sid);
          if (!cancelled) setSubjectLabel(lab ?? `#${sid}`);
        } else {
          setSubjectId(null);
          setSubjectLabel(null);
        }
        if (oid !== null) {
          setObjectId(oid);
          const lab = await fetchCidocEntityRowLabel(token, base, objTsRaw, oid);
          if (!cancelled) setObjectLabel(lab ?? `#${oid}`);
        } else {
          setObjectId(null);
          setObjectLabel(null);
        }

        const srcPk = coerceFkPk(row.primary_source);
        if (srcPk) {
          setPrimarySourceId(srcPk);
          const lab = await fetchDataSourcePickerLabel(token, base, srcPk);
          if (!cancelled) setPrimarySourceLabel(lab);
        } else {
          setPrimarySourceId('');
          setPrimarySourceLabel(null);
        }

        const supIds = normalizeUuidList(row.supporting_source_ids);
        const supRows = await Promise.all(
          supIds.map(async (id) => ({
            id,
            label: await fetchDataSourcePickerLabel(token, base, id),
          }))
        );
        if (!cancelled) setSupportingSources(supRows);

        setTemporal(typeof row.temporal_scope_edtf === 'string' ? row.temporal_scope_edtf : '');
        const conf =
          typeof row.confidence === 'string' && row.confidence
            ? row.confidence
            : 'likely';
        setConfidence(
          ['certain', 'likely', 'uncertain', 'speculative'].includes(conf) ? conf : 'likely'
        );
        setNote(
          typeof row.interpretation_note === 'string' ? row.interpretation_note : ''
        );
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

  const buildPayload = () => ({
    predicate: predicateId,
    subject_entity_type: subjectType,
    subject_entity_id: subjectId ?? 0,
    object_entity_type: objectType,
    object_entity_id: objectId ?? 0,
    primary_source: primarySourceId.trim(),
    supporting_source_ids: supportingSources.map((s) => s.id),
    temporal_scope_edtf: temporal.trim(),
    confidence,
    interpretation_note: note.trim(),
  });

  const saveDraft = async () => {
    if (!token) return;
    if (!proposalEditable) {
      toast.error('This proposal cannot be edited.');
      return;
    }
    if (subjectId === null || objectId === null) {
      toast.error('Choose the From and To records from the lists.');
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
        router.replace(`/contribute/relationship-proposal?id=${created.id}`, { scroll: false });
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
    if (subjectId === null || objectId === null) {
      toast.error('Choose the From and To records from the lists.');
      return;
    }
    if (!primarySourceId.trim()) {
      toast.error('Main evidence is required.');
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
        router.replace(`/contribute/relationship-proposal?id=${id}`, { scroll: false });
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
      toast.success('Submitted for review. Track it under My contributions.');
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
          Sign in with Google to propose a connection between two records.
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
        <h1 className="text-2xl font-semibold tracking-tight">Propose a relationship</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect two existing records (for example a temple and a deity) and attach the evidence
          that supports the link. A reviewer will check your proposal before it is published.
          To edit a saved draft, open it from My contributions or add{" "}
          <code className="rounded bg-muted px-1 text-xs">?id=</code> with the draft id in the URL.
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
              href="/contribute/relationship-proposal"
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

      <Card>
        <CardHeader>
          <CardTitle>What connects to what?</CardTitle>
        </CardHeader>
        <CardContent>
          <fieldset
            disabled={draftHydrating || !proposalEditable}
            className="min-w-0 space-y-4 border-0 p-0 disabled:pointer-events-none disabled:opacity-60"
          >
          <div className="space-y-2">
            <Label>How they connect</Label>
            <Select value={predicateId} onValueChange={setPredicateId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose how they relate" />
              </SelectTrigger>
              <SelectContent>
                {predicates.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>From (type)</Label>
              <Select value={subjectType} onValueChange={(v) => {
                setSubjectType(v);
                setSubjectId(null);
                setSubjectLabel(null);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_SCOPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {subjectSegment ? (
                <CidocEntityPicker
                  token={token}
                  apiSegment={subjectSegment}
                  placeholder={`Choose from (${subjectType})…`}
                  selectionSummary={
                    subjectId !== null && subjectLabel
                      ? `${subjectLabel} (#${subjectId})`
                      : subjectId !== null
                        ? `#${subjectId}`
                        : null
                  }
                  onSelect={(id, label) => {
                    setSubjectId(id);
                    setSubjectLabel(label);
                  }}
                />
              ) : (
                <p className="text-sm text-destructive">Unknown type — pick another From type.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>To (type)</Label>
              <Select value={objectType} onValueChange={(v) => {
                setObjectType(v);
                setObjectId(null);
                setObjectLabel(null);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_SCOPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {objectSegment ? (
                <CidocEntityPicker
                  token={token}
                  apiSegment={objectSegment}
                  placeholder={`Choose to (${objectType})…`}
                  selectionSummary={
                    objectId !== null && objectLabel
                      ? `${objectLabel} (#${objectId})`
                      : objectId !== null
                        ? `#${objectId}`
                        : null
                  }
                  onSelect={(id, label) => {
                    setObjectId(id);
                    setObjectLabel(label);
                  }}
                />
              ) : (
                <p className="text-sm text-destructive">Unknown type — pick another To type.</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ps">Main evidence</Label>
            <DataSourcePicker
              token={token}
              placeholder="Required — the source that supports this link"
              selectionSummary={primarySourceLabel}
              allowClear
              onSelect={(uuid, label) => {
                setPrimarySourceId(uuid);
                setPrimarySourceLabel(label);
                setSupportingSources((prev) => prev.filter((s) => s.id !== uuid));
              }}
              onClear={() => {
                setPrimarySourceId('');
                setPrimarySourceLabel(null);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>Extra evidence (optional)</Label>
            <DataSourceAddPicker
              token={token}
              excludeIds={supportingExcludeIds}
              onAdd={(id, label) =>
                setSupportingSources((prev) =>
                  prev.some((s) => s.id === id) ? prev : [...prev, { id, label }]
                )
              }
            />
            {supportingSources.length ? (
              <div className="flex flex-wrap gap-2">
                {supportingSources.map((s) => (
                  <Badge key={s.id} variant="secondary" className="gap-1 py-1 pr-1 font-normal">
                    <span className="max-w-[200px] truncate">{s.label}</span>
                    <button
                      type="button"
                      className="hover:bg-muted rounded-sm p-0.5"
                      aria-label={`Remove ${s.id}`}
                      onClick={() =>
                        setSupportingSources((prev) => prev.filter((x) => x.id !== s.id))
                      }
                    >
                      <X className="size-3.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ts">When (optional)</Label>
            <Input
              id="ts"
              value={temporal}
              onChange={(e) => setTemporal(e.target.value)}
              placeholder="e.g. 1647, 17th century, or a date range"
            />
          </div>

          <div className="space-y-2">
            <Label>How sure are you?</Label>
            <Select value={confidence} onValueChange={setConfidence}>
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="certain">Certain</SelectItem>
                <SelectItem value="likely">Likely</SelectItem>
                <SelectItem value="uncertain">Uncertain</SelectItem>
                <SelectItem value="speculative">Speculative</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note for reviewers (optional)</Label>
            <Textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
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
