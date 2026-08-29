'use client';

import { getPublicApiUrl } from '@/lib/api-base';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertTriangle, ArrowLeft, Calendar, CheckCircle, Clock, Edit, FileText,
  Flag, History, Scale, Shield, ShieldAlert, User, XCircle, ArrowUpRight, Loader2,
  GitFork, GitMerge, ArrowUpFromLine,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { IconSparkles } from '@tabler/icons-react';
import { fadeInUp, staggerContainer, glassCard } from '@/lib/design';
import { useUserRoles } from '@/hooks/use-user-roles';
import { AccessDenied } from '@/components/access-denied';
import { apiFetch, apiFetchJson, getApiErrorMessage } from '@/lib/api-client';
import { ConfirmActionDialog } from '@/components/confirm-action-dialog';

interface UserInfo { id: number; username: string; email: string; first_name: string; last_name: string; }
interface Revision { revision_id: string; revision_number: number; data: Record<string, unknown>; created_by: UserInfo; created_at: string; }
interface ActivityItem { activity_id: string; user: UserInfo; activity_type: string; comment: string | null; created_at: string; }
interface ReviewDecisionItem {
  id: string; reviewer: UserInfo; revision_reviewed: Revision | null; verdict: string;
  conflict_handling: string; confidence_override: string | null; verification_method: string | null;
  feedback: string; reconciliation_note: string; internal_note: string; created_at: string;
}
interface ReviewFlagItem { id: string; flag_type: string; flagged_by: UserInfo; reason: string; is_resolved: boolean; created_at: string; }
interface ContributorStats { total_contributions: number; accepted_contributions: number; acceptance_rate: number; }
interface ParentComment {
  id: number; comment: string; user: UserInfo; created_at: string;
  replies?: ParentComment[];
}
interface ForkContext {
  fork_id: string; parent_entity_id: string; parent_entity_name: string;
  parent_entity_status: string; fork_reason_tag: string; fork_reason_tag_display: string;
  fork_status: string; fork_status_display: string; reason: string;
  diff_summary: Record<string, { old: any; new: any }>; diff_field_count: number;
  forked_by: string; forked_from_revision_number: number | null;
  parent_current_revision: Revision | null; parent_comments?: ParentComment[];
  created_at: string;
}
interface TriageBreakdown {
  age_norm: number;
  flags_norm: number;
  conflict_boost: number;
  source_penalty: number;
  weights: Record<string, number>;
  days_in_review: number;
  unresolved_flag_count: number;
  has_contradiction: boolean;
  worst_tier_label: string;
  worst_source_type: string | null;
}

interface ReviewWorkspaceData {
  entity_id: string; name: string; description: string; category: string; status: string;
  contributor: UserInfo; current_revision: Revision | null; created_at: string; updated_at: string;
  revisions: Revision[]; activities: ActivityItem[]; review_decisions: ReviewDecisionItem[];
  flags: ReviewFlagItem[]; contributor_stats: ContributorStats;
  is_fork?: boolean; fork_context?: ForkContext | null;
  root_entity?: string | null; parent_entity?: string | null; fork_depth?: number;
  triage_priority?: number;
  triage_breakdown?: TriageBreakdown;
  worst_source_tier?: string;
  worst_source_type?: string | null;
}

type Verdict = 'accept' | 'accept_with_edits' | 'request_changes' | 'reject' | 'escalate';
type ConflictHandling = 'not_applicable' | 'supersedes' | 'coexist' | 'existing_stands' | 'refines' | 'disputed';
type Confidence = '' | 'certain' | 'likely' | 'uncertain' | 'speculative';
type VerificationMethod = '' | 'source_crosscheck' | 'expert_knowledge' | 'field_verification' | 'community_consensus';

const VERDICT_SUBMIT_LABEL: Record<Verdict, string> = {
  accept: 'Accept — publish this assertion',
  accept_with_edits: 'Accept with edits — modify before publishing',
  request_changes: 'Request changes — send back to contributor',
  reject: 'Reject — do not publish',
  escalate: 'Escalate to expert — beyond my domain',
};

const API_BASE = getPublicApiUrl();

export default function ReviewWorkspacePage() {
  const { data: session } = useSession();
  const { isReviewer, isLoading: rolesLoading } = useUserRoles();
  const router = useRouter();
  const params = useParams();
  const entityId = params.id as string;

  const [workspace, setWorkspace] = useState<ReviewWorkspaceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<Verdict | ''>('');
  const [conflictHandling, setConflictHandling] = useState<ConflictHandling>('not_applicable');
  const [confidenceOverride, setConfidenceOverride] = useState<Confidence>('');
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>('');
  const [feedback, setFeedback] = useState('');
  const [reconciliationNote, setReconciliationNote] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [decisionConfirmOpen, setDecisionConfirmOpen] = useState(false);

  const getHeaders = useCallback(() => {
    const token = (session as unknown as Record<string, unknown>)?.accessToken as string | undefined;
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }, [session]);

  const fetchWorkspace = useCallback(async () => {
    try {
      setIsLoading(true); setError(null);
      const data = await apiFetchJson<ReviewWorkspaceData>(
        `${API_BASE}/data/api/review-workspace/${entityId}/`,
        { headers: getHeaders() }
      );
      setWorkspace(data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load this review workspace.'));
    }
    finally { setIsLoading(false); }
  }, [entityId, getHeaders]);

  useEffect(() => {
    if (!session || !entityId || !isReviewer) return;
    fetchWorkspace();
  }, [session, entityId, isReviewer, fetchWorkspace]);

  const openSubmitDecisionConfirm = () => {
    if (!verdict) {
      toast.error('Please select a verdict');
      return;
    }
    if (verdict === 'reject' && !feedback.trim()) {
      toast.error('Feedback is required when rejecting');
      return;
    }
    setDecisionConfirmOpen(true);
  };

  const submitDecision = async () => {
    if (!verdict) return;
    setIsSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        verdict,
        conflict_handling: conflictHandling,
        feedback,
        reconciliation_note: reconciliationNote,
        internal_note: internalNote,
      };
      if (confidenceOverride) body.confidence_override = confidenceOverride;
      if (verificationMethod) body.verification_method = verificationMethod;
      await apiFetchJson(`${API_BASE}/data/api/review-workspace/${entityId}/decide/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(body),
      });
      toast.success('Review decision submitted successfully');
      await fetchWorkspace();
      setDecisionConfirmOpen(false);
      setVerdict('');
      setConflictHandling('not_applicable');
      setConfidenceOverride('');
      setVerificationMethod('');
      setFeedback('');
      setReconciliationNote('');
      setInternalNote('');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not submit this review decision.'));
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  if (rolesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-primary dark:text-primary">Checking reviewer access…</p>
        </div>
      </div>
    );
  }

  if (!isReviewer) {
    return <AccessDenied requiredRole="reviewer" userEmail={session?.user?.email} />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-primary dark:text-primary">Loading review workspace...</p>
        </div>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-primary dark:text-primary mb-4">{error || 'Entity not found'}</p>
          <Button onClick={() => router.back()} className="bg-gradient-to-r from-hero-from to-hero-to text-white">Go Back</Button>
        </div>
      </div>
    );
  }

  const hasConflicts = workspace.flags.some(f => f.flag_type === 'contradiction');
  const latestRevision = workspace.revisions[0];
  const revisionData = latestRevision?.data || {};

  return (
    <>
      <ConfirmActionDialog
        open={decisionConfirmOpen}
        onOpenChange={setDecisionConfirmOpen}
        title="Submit this review decision?"
        description={
          verdict ? (
            <>
              <p>
                <span className="font-medium text-foreground">{workspace.name}</span>
                {' — '}
                {VERDICT_SUBMIT_LABEL[verdict]}
              </p>
              <p className="mt-2">This will be logged and may change the entity&apos;s workflow state.</p>
            </>
          ) : (
            <span>This will be logged and may change the entity&apos;s workflow state.</span>
          )
        }
        confirmLabel="Submit decision"
        confirmVariant={verdict === 'reject' ? 'destructive' : 'default'}
        onConfirm={submitDecision}
        isPending={isSubmitting}
      />

      <div className="space-y-4">
        {/* Header */}
        <motion.div initial="hidden" animate="show" variants={staggerContainer} className={`relative overflow-hidden ${glassCard} p-6`}>
          <div className="absolute inset-0 bg-gradient-to-br from-hero-from via-hero-to to-hero-to opacity-95 rounded-2xl" />
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <motion.div variants={fadeInUp} className="relative z-10 flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-white hover:bg-white/20">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-xs font-medium text-white mb-1">
                <IconSparkles className="w-3 h-3" /> Review Workspace
              </div>
              <h1 className="text-2xl font-black text-white">{workspace.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-white/20 text-white border-white/30">{workspace.category}</Badge>
                <Badge className={`border-white/30 text-white ${workspace.status === 'pending_review' ? 'bg-amber-500/50' : 'bg-white/20'}`}>
                  {workspace.status.replace(/_/g, ' ')}
                </Badge>
                {hasConflicts && <Badge className="bg-red-500/50 text-white border-red-300/30"><AlertTriangle className="h-3 w-3 mr-1" /> Conflicts</Badge>}
                {workspace.is_fork && workspace.fork_context && (
                  <Badge className="bg-primary/50 text-white border-primary/30">
                    <GitFork className="h-3 w-3 mr-1" /> Fork — {workspace.fork_context.fork_reason_tag_display}
                  </Badge>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>

        {workspace.triage_breakdown != null && (
          <motion.div variants={fadeInUp} initial="hidden" animate="show" className={glassCard}>
            <div className="p-4 border-b border-primary/30 dark:border-gray-700 flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold flex items-center gap-2 text-primary dark:text-primary">
                <Scale className="h-4 w-4 text-primary" /> Queue triage
              </h3>
              <Badge variant="secondary" className="font-mono text-xs">
                priority {typeof workspace.triage_priority === 'number'
                  ? workspace.triage_priority.toFixed(3)
                  : workspace.triage_priority ?? '—'}
              </Badge>
              {workspace.worst_source_tier && (
                <Badge variant="outline" className="text-xs">worst tier: {workspace.worst_source_tier}</Badge>
              )}
              {workspace.worst_source_type != null && workspace.worst_source_type !== '' && (
                <Badge variant="outline" className="text-xs">source: {workspace.worst_source_type}</Badge>
              )}
            </div>
            <div className="p-4 text-xs text-primary dark:text-primary">
              <details className="group">
                <summary className="cursor-pointer font-medium text-primary dark:text-primary list-none flex items-center gap-1">
                  <span className="group-open:rotate-90 transition-transform inline-block">▸</span>
                  Score breakdown (same logic as review queue)
                </summary>
                <dl className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 border-t border-primary/30 dark:border-gray-700 pt-3">
                  <div><dt className="text-muted-foreground">Age (norm)</dt><dd className="font-mono">{workspace.triage_breakdown.age_norm?.toFixed?.(3)}</dd></div>
                  <div><dt className="text-muted-foreground">Flags (norm)</dt><dd className="font-mono">{workspace.triage_breakdown.flags_norm?.toFixed?.(3)}</dd></div>
                  <div><dt className="text-muted-foreground">Conflict</dt><dd className="font-mono">{workspace.triage_breakdown.conflict_boost?.toFixed?.(3)}</dd></div>
                  <div><dt className="text-muted-foreground">Source penalty</dt><dd className="font-mono">{workspace.triage_breakdown.source_penalty?.toFixed?.(3)}</dd></div>
                  <div><dt className="text-muted-foreground">Days in review</dt><dd>{workspace.triage_breakdown.days_in_review}</dd></div>
                  <div><dt className="text-muted-foreground">Open flags</dt><dd>{workspace.triage_breakdown.unresolved_flag_count}</dd></div>
                </dl>
              </details>
            </div>
          </motion.div>
        )}

        {/* Three-Panel Layout */}
        <motion.div initial="hidden" animate="show" variants={staggerContainer} className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <motion.div variants={fadeInUp} className="lg:col-span-3"><ContextPanel workspace={workspace} /></motion.div>
          <motion.div variants={fadeInUp} className="lg:col-span-5"><SubmissionPanel workspace={workspace} revisionData={revisionData} latestRevision={latestRevision} /></motion.div>
          <motion.div variants={fadeInUp} className="lg:col-span-4">
            <DecisionPanel workspace={workspace} hasConflicts={hasConflicts}
              verdict={verdict} setVerdict={setVerdict} conflictHandling={conflictHandling} setConflictHandling={setConflictHandling}
              confidenceOverride={confidenceOverride} setConfidenceOverride={setConfidenceOverride}
              verificationMethod={verificationMethod} setVerificationMethod={setVerificationMethod}
              feedback={feedback} setFeedback={setFeedback} reconciliationNote={reconciliationNote} setReconciliationNote={setReconciliationNote}
              internalNote={internalNote} setInternalNote={setInternalNote} isSubmitting={isSubmitting} onSubmit={openSubmitDecisionConfirm}
            />
          </motion.div>
        </motion.div>
      </div>
    </>
  );
}

// =====================================================================
// LEFT PANEL — Context
// =====================================================================
function ContextPanel({ workspace }: { workspace: ReviewWorkspaceData }) {
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  return (
    <ScrollArea className="h-[calc(100vh-280px)]">
      <div className="space-y-4 pr-2">
        <div className={glassCard}>
          <div className="p-4 border-b border-primary/30 dark:border-gray-700">
            <h3 className="text-sm font-bold flex items-center gap-2 text-primary dark:text-primary"><FileText className="h-4 w-4 text-primary" /> Current State</h3>
          </div>
          <div className="p-4 space-y-2 text-sm text-primary dark:text-primary">
            <div><span className="font-medium text-primary dark:text-primary">Category:</span> {workspace.category}</div>
            <div><span className="font-medium text-primary dark:text-primary">Status:</span> {workspace.status.replace(/_/g, ' ')}</div>
            <div><span className="font-medium text-primary dark:text-primary">Created:</span> {formatDate(workspace.created_at)}</div>
            <div><span className="font-medium text-primary dark:text-primary">Updated:</span> {formatDate(workspace.updated_at)}</div>
            {workspace.current_revision && <div><span className="font-medium text-primary dark:text-primary">Current Rev:</span> #{workspace.current_revision.revision_number}</div>}
          </div>
        </div>

        {workspace.is_fork && workspace.fork_context && (
          <div className={`${glassCard} border-primary/30 dark:border-primary/30`}>
            <div className="p-4 border-b border-primary/30 dark:border-primary/30">
              <h3 className="text-sm font-bold flex items-center gap-2 text-primary dark:text-primary">
                <GitFork className="h-4 w-4" /> Fork Context
              </h3>
            </div>
            <div className="p-4 space-y-2 text-sm">
              <div>
                <span className="font-medium text-primary dark:text-primary">Parent Entity:</span>{' '}
                <a href={`/knowledge/entity/view/${workspace.fork_context.parent_entity_id}`}
                  className="text-primary hover:underline inline-flex items-center gap-1">
                  {workspace.fork_context.parent_entity_name}
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              </div>
              <div>
                <span className="font-medium text-primary dark:text-primary">Reason:</span>{' '}
                <Badge variant="outline" className="text-[10px] border-primary/30">
                  {workspace.fork_context.fork_reason_tag_display}
                </Badge>
              </div>
              {workspace.fork_context.reason && (
                <div className="text-primary dark:text-primary text-xs italic">
                  &ldquo;{workspace.fork_context.reason}&rdquo;
                </div>
              )}
              <div>
                <span className="font-medium text-primary dark:text-primary">Changes:</span>{' '}
                <span className="text-primary dark:text-primary">
                  {workspace.fork_context.diff_field_count} field(s) modified
                </span>
              </div>
              {workspace.fork_context.diff_summary && Object.keys(workspace.fork_context.diff_summary).length > 0 && (
                <div className="text-xs text-primary dark:text-primary">
                  Fields: {Object.keys(workspace.fork_context.diff_summary).join(', ')}
                </div>
              )}
              <div className="text-xs text-primary dark:text-primary">
                Forked from revision #{workspace.fork_context.forked_from_revision_number || '?'}
                {' · '}{new Date(workspace.fork_context.created_at).toLocaleDateString()}
              </div>
              <div className="pt-1">
                <a href={`/curation/forks?entity=${workspace.entity_id}`}
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                  View full lineage tree <ArrowUpRight className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {workspace.is_fork && workspace.fork_context?.parent_comments && workspace.fork_context.parent_comments.length > 0 && (
          <div className={`${glassCard} border-primary/30 dark:border-primary/30`}>
            <div className="p-4 border-b border-primary/30 dark:border-primary/30">
              <h3 className="text-sm font-bold flex items-center gap-2 text-primary dark:text-primary">
                <History className="h-4 w-4" /> Parent Discussion ({workspace.fork_context.parent_comments.length})
              </h3>
              <p className="text-[11px] text-primary dark:text-primary">
                Comments from &ldquo;{workspace.fork_context.parent_entity_name}&rdquo;
              </p>
            </div>
            <div className="p-4 space-y-2">
              {workspace.fork_context.parent_comments.slice(0, 5).map((c) => (
                <div key={c.id} className="text-xs border-l-2 border-l-violet-300 dark:border-l-violet-600 pl-2 py-1">
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-primary dark:text-primary">@{c.user.username}</span>
                    <span className="text-primary dark:text-primary">{new Date(c.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-primary dark:text-primary mt-0.5 line-clamp-3">{c.comment}</p>
                  {c.replies && c.replies.length > 0 && (
                    <p className="text-[10px] text-primary mt-0.5">{c.replies.length} repl{c.replies.length === 1 ? 'y' : 'ies'}</p>
                  )}
                </div>
              ))}
              {workspace.fork_context.parent_comments.length > 5 && (
                <a href={`/knowledge/entity/view/${workspace.fork_context.parent_entity_id}`}
                  className="text-xs text-primary hover:underline">
                  View all comments on parent entity...
                </a>
              )}
            </div>
          </div>
        )}

        <div className={glassCard}>
          <div className="p-4 border-b border-primary/30 dark:border-gray-700">
            <h3 className="text-sm font-bold flex items-center gap-2 text-primary dark:text-primary"><User className="h-4 w-4 text-primary" /> Contributor</h3>
          </div>
          <div className="p-4 space-y-2 text-sm">
            <div className="font-medium text-primary dark:text-primary">{workspace.contributor.first_name} {workspace.contributor.last_name}</div>
            <div className="text-primary dark:text-primary">@{workspace.contributor.username}</div>
            <Separator className="bg-primary/10 dark:bg-gray-700" />
            <div className="grid grid-cols-2 gap-2">
              <div><div className="text-xs text-primary dark:text-primary">Contributions</div><div className="font-semibold text-primary dark:text-primary">{workspace.contributor_stats.total_contributions}</div></div>
              <div><div className="text-xs text-primary dark:text-primary">Accepted</div><div className="font-semibold text-primary dark:text-primary">{workspace.contributor_stats.accepted_contributions}</div></div>
              <div className="col-span-2"><div className="text-xs text-primary dark:text-primary">Acceptance Rate</div><div className="font-semibold text-primary dark:text-primary">{workspace.contributor_stats.acceptance_rate}%</div></div>
            </div>
          </div>
        </div>

        {workspace.flags.length > 0 && (
          <div className={`${glassCard} border-amber-300 dark:border-amber-700`}>
            <div className="p-4 border-b border-amber-200 dark:border-amber-700">
              <h3 className="text-sm font-bold flex items-center gap-2 text-amber-600"><Flag className="h-4 w-4" /> Flags ({workspace.flags.length})</h3>
            </div>
            <div className="p-4 space-y-2">
              {workspace.flags.map(flag => (
                <div key={flag.id} className="text-xs border-l-2 border-l-amber-400 pl-2 py-1">
                  <Badge variant="outline" className="text-[10px] mb-1 border-amber-300">{flag.flag_type.replace(/_/g, ' ')}</Badge>
                  {flag.reason && <p className="text-primary dark:text-primary">{flag.reason}</p>}
                  <p className="text-primary dark:text-primary mt-1">by @{flag.flagged_by.username} · {new Date(flag.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={glassCard}>
          <div className="p-4 border-b border-primary/30 dark:border-gray-700">
            <h3 className="text-sm font-bold flex items-center gap-2 text-primary dark:text-primary"><History className="h-4 w-4 text-primary" /> Activity</h3>
          </div>
          <div className="p-4 space-y-2">
            {workspace.activities.slice(0, 10).map(activity => (
              <div key={activity.activity_id} className="text-xs border-l-2 border-l-blue-300 dark:border-l-blue-600 pl-2 py-1">
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-[10px] bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary">{activity.activity_type}</Badge>
                  <span className="text-primary dark:text-primary">by @{activity.user.username}</span>
                </div>
                {activity.comment && <p className="text-primary dark:text-primary mt-0.5 line-clamp-2">{activity.comment}</p>}
                <p className="text-primary dark:text-primary mt-0.5">{new Date(activity.created_at).toLocaleDateString()}</p>
              </div>
            ))}
            {workspace.activities.length === 0 && <p className="text-xs text-primary dark:text-primary">No activity yet</p>}
          </div>
        </div>

        {workspace.review_decisions.length > 0 && (
          <div className={glassCard}>
            <div className="p-4 border-b border-primary/30 dark:border-gray-700">
              <h3 className="text-sm font-bold flex items-center gap-2 text-primary dark:text-primary"><Shield className="h-4 w-4 text-primary" /> Previous Reviews</h3>
            </div>
            <div className="p-4 space-y-2">
              {workspace.review_decisions.map(decision => (
                <div key={decision.id} className="text-xs border-l-2 border-l-blue-500 pl-2 py-1">
                  <div className="flex items-center gap-1"><VerdictBadge verdict={decision.verdict} /><span className="text-primary dark:text-primary">by @{decision.reviewer.username}</span></div>
                  {decision.feedback && <p className="text-primary dark:text-primary mt-0.5">{decision.feedback}</p>}
                  <p className="text-primary dark:text-primary mt-0.5">{new Date(decision.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

// =====================================================================
// MIDDLE PANEL — Submission
// =====================================================================
function SubmissionPanel({ workspace, revisionData, latestRevision }: {
  workspace: ReviewWorkspaceData; revisionData: Record<string, unknown>; latestRevision: Revision | undefined;
}) {
  return (
    <ScrollArea className="h-[calc(100vh-280px)]">
      <div className="space-y-4 pr-2">
        <div className={glassCard}>
          <div className="p-5 border-b border-primary/30 dark:border-gray-700">
            <h3 className="font-bold flex items-center gap-2 text-primary dark:text-primary"><FileText className="h-5 w-5 text-primary" /> Submission Under Review</h3>
            <p className="text-sm text-primary dark:text-primary mt-1">
              {latestRevision ? `Revision ${latestRevision.revision_number} — by @${latestRevision.created_by.username} on ${new Date(latestRevision.created_at).toLocaleDateString()}` : 'No revision data'}
            </p>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-3">
              <div><Label className="text-xs text-primary dark:text-primary">Entity Name</Label><p className="font-medium text-primary dark:text-primary">{workspace.name}</p></div>
              <div><Label className="text-xs text-primary dark:text-primary">Description</Label><p className="text-sm text-primary dark:text-primary">{workspace.description || '—'}</p></div>
              <div><Label className="text-xs text-primary dark:text-primary">Category</Label><p className="text-sm capitalize text-primary dark:text-primary">{workspace.category}</p></div>
            </div>
            <Separator className="bg-primary/10 dark:bg-gray-700" />
            <div>
              <Label className="text-xs text-primary dark:text-primary mb-2 block">Form Data (Revision #{latestRevision?.revision_number || '—'})</Label>
              {Object.keys(revisionData).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(revisionData).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-3 gap-2 py-1 border-b border-primary/30 dark:border-gray-700/50 last:border-0">
                      <span className="text-xs font-medium text-primary dark:text-primary col-span-1 break-words">{key.replace(/_/g, ' ')}</span>
                      <span className="text-sm col-span-2 break-words text-primary dark:text-primary">{typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value || '—')}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-primary dark:text-primary">No form data available</p>}
            </div>
            <Separator className="bg-primary/10 dark:bg-gray-700" />
            <div className="bg-primary/10 dark:bg-primary/10 rounded-xl p-3 space-y-2 border border-primary/30 dark:border-gray-700">
              <Label className="text-xs text-primary dark:text-primary">Submitted by</Label>
              <div className="flex items-center gap-2"><User className="h-4 w-4 text-primary" /><span className="font-medium text-primary dark:text-primary">{workspace.contributor.first_name} {workspace.contributor.last_name}</span><span className="text-sm text-primary dark:text-primary">@{workspace.contributor.username}</span></div>
              <div className="flex items-center gap-4 text-xs text-primary dark:text-primary">
                <span>{workspace.contributor_stats.total_contributions} contributions</span>
                <span>{workspace.contributor_stats.accepted_contributions} verified</span>
                <span>{workspace.contributor_stats.acceptance_rate}% acceptance</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-primary dark:text-primary">
                <Calendar className="h-3 w-3" /> Submitted: {new Date(workspace.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
          </div>
        </div>
        {workspace.revisions.length > 1 && (
          <div className={glassCard}>
            <div className="p-4 border-b border-primary/30 dark:border-gray-700"><h3 className="text-sm font-bold text-primary dark:text-primary">Revision History</h3></div>
            <div className="p-4 space-y-2">
              {workspace.revisions.map(rev => (
                <div key={rev.revision_id} className={`text-xs border-l-2 pl-2 py-1 ${rev.revision_id === latestRevision?.revision_id ? 'border-l-blue-500' : 'border-l-blue-200 dark:border-l-gray-600'}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-primary dark:text-primary">Rev. {rev.revision_number}</span>
                    {rev.revision_id === latestRevision?.revision_id && <Badge className="text-[10px] h-4 bg-gradient-to-r from-hero-from to-hero-to text-white">Latest</Badge>}
                  </div>
                  <p className="text-primary dark:text-primary">by @{rev.created_by.username} · {new Date(rev.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

// =====================================================================
// RIGHT PANEL — Decision
// =====================================================================
function DecisionPanel({ workspace, hasConflicts, verdict, setVerdict, conflictHandling, setConflictHandling, confidenceOverride, setConfidenceOverride, verificationMethod, setVerificationMethod, feedback, setFeedback, reconciliationNote, setReconciliationNote, internalNote, setInternalNote, isSubmitting, onSubmit }: {
  workspace: ReviewWorkspaceData; hasConflicts: boolean; verdict: Verdict | ''; setVerdict: (v: Verdict | '') => void;
  conflictHandling: ConflictHandling; setConflictHandling: (v: ConflictHandling) => void;
  confidenceOverride: Confidence; setConfidenceOverride: (v: Confidence) => void;
  verificationMethod: VerificationMethod; setVerificationMethod: (v: VerificationMethod) => void;
  feedback: string; setFeedback: (v: string) => void; reconciliationNote: string; setReconciliationNote: (v: string) => void;
  internalNote: string; setInternalNote: (v: string) => void; isSubmitting: boolean; onSubmit: () => void;
}) {
  const isAlreadyReviewed = workspace.status === 'accepted' || workspace.status === 'rejected';

  return (
    <ScrollArea className="h-[calc(100vh-280px)]">
      <div className="space-y-4 pr-2">
        <div className={glassCard}>
          <div className="p-5 border-b border-primary/30 dark:border-gray-700">
            <h3 className="font-bold flex items-center gap-2 text-primary dark:text-primary"><Shield className="h-5 w-5 text-primary" /> Your Decision</h3>
            {isAlreadyReviewed && <p className="text-sm text-amber-600 mt-1">This entity has already been {workspace.status}. You can still submit a new review.</p>}
          </div>
          <div className="p-5 space-y-5">
            {/* Verdict */}
            <div className="space-y-2">
              <Label className="font-medium text-primary dark:text-primary">Verdict</Label>
              <div className="space-y-2">
                {([
                  { value: 'accept', label: 'Accept — publish this assertion', icon: CheckCircle, color: 'text-green-600' },
                  { value: 'accept_with_edits', label: 'Accept with edits — modify before publishing', icon: Edit, color: 'text-primary' },
                  { value: 'request_changes', label: 'Request changes — send back to contributor', icon: ArrowUpRight, color: 'text-amber-600' },
                  { value: 'reject', label: 'Reject — do not publish', icon: XCircle, color: 'text-red-600' },
                  { value: 'escalate', label: 'Escalate to expert — beyond my domain', icon: ShieldAlert, color: 'text-primary' },
                ] as const).map(({ value, label, icon: Icon, color }) => (
                  <label key={value} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all duration-300 ${
                    verdict === value ? 'border-primary/30 bg-primary/10 dark:bg-primary/10 shadow-md' : 'border-primary/30 dark:border-gray-700 hover:bg-primary/10 dark:hover:bg-gray-800/30'
                  }`}>
                    <input type="radio" name="verdict" value={value} checked={verdict === value} onChange={() => setVerdict(value)} className="sr-only" />
                    <Icon className={`h-4 w-4 ${color}`} /><span className="text-sm text-primary dark:text-primary">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <Separator className="bg-primary/10 dark:bg-gray-700" />

            {hasConflicts && (
              <div className="space-y-2">
                <Label className="font-medium flex items-center gap-2 text-primary dark:text-primary"><Scale className="h-4 w-4 text-amber-600" /> Conflict Handling <span className="text-red-500">*</span></Label>
                <Select value={conflictHandling} onValueChange={(v) => setConflictHandling(v as ConflictHandling)}>
                  <SelectTrigger className="border-primary/30 dark:border-gray-600"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="refines">New claim refines existing</SelectItem>
                    <SelectItem value="coexist">Both claims coexist</SelectItem>
                    <SelectItem value="supersedes">New claim supersedes existing</SelectItem>
                    <SelectItem value="existing_stands">Existing claim stands</SelectItem>
                    <SelectItem value="disputed">Genuinely contradictory</SelectItem>
                    <SelectItem value="not_applicable">Not applicable</SelectItem>
                  </SelectContent>
                </Select>
                {conflictHandling !== 'not_applicable' && (
                  <div className="space-y-2">
                    <Label className="text-xs text-primary dark:text-primary">Reconciliation Note</Label>
                    <Textarea placeholder="Explain the conflict resolution rationale..." value={reconciliationNote} onChange={(e) => setReconciliationNote(e.target.value)} rows={2} className="border-primary/30 dark:border-gray-600" />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm text-primary dark:text-primary">Adjust Confidence Score</Label>
              <Select value={confidenceOverride || 'none'} onValueChange={(v) => setConfidenceOverride(v === 'none' ? '' : v as Confidence)}>
                <SelectTrigger className="border-primary/30 dark:border-gray-600"><SelectValue placeholder="Keep contributor's assessment" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keep contributor&apos;s assessment</SelectItem>
                  <SelectItem value="certain">Certain</SelectItem>
                  <SelectItem value="likely">Likely</SelectItem>
                  <SelectItem value="uncertain">Uncertain</SelectItem>
                  <SelectItem value="speculative">Speculative</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(verdict === 'accept' || verdict === 'accept_with_edits') && (
              <div className="space-y-2">
                <Label className="text-sm text-primary dark:text-primary">Verification Method</Label>
                <Select value={verificationMethod || 'none'} onValueChange={(v) => setVerificationMethod(v === 'none' ? '' : v as VerificationMethod)}>
                  <SelectTrigger className="border-primary/30 dark:border-gray-600"><SelectValue placeholder="Select method" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    <SelectItem value="source_crosscheck">Source cross-checked</SelectItem>
                    <SelectItem value="expert_knowledge">Expert knowledge</SelectItem>
                    <SelectItem value="field_verification">Field verification</SelectItem>
                    <SelectItem value="community_consensus">Community consensus</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Separator className="bg-primary/10 dark:bg-gray-700" />

            <div className="space-y-2">
              <Label className="text-sm text-primary dark:text-primary">Feedback to Contributor{verdict === 'reject' && <span className="text-red-500 ml-1">*</span>}</Label>
              <Textarea placeholder="Shown to contributor; logged permanently..." value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} className="border-primary/30 dark:border-gray-600" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-primary dark:text-primary">Internal Note (visible only to reviewers)</Label>
              <Textarea placeholder="Private notes for the review team..." value={internalNote} onChange={(e) => setInternalNote(e.target.value)} rows={2} className="border-primary/30 dark:border-gray-600" />
            </div>

            <Button onClick={onSubmit} disabled={!verdict || isSubmitting} className="w-full bg-gradient-to-r from-hero-from to-hero-to text-white hover:from-hero-from hover:to-hero-to" size="lg">
              {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</> : 'Submit Decision'}
            </Button>
          </div>
        </div>

        {workspace.is_fork && workspace.fork_context && workspace.fork_context.fork_status === 'active' && (
          <ForkActionsCard workspace={workspace} />
        )}
      </div>
    </ScrollArea>
  );
}

function ForkActionsCard({ workspace }: { workspace: ReviewWorkspaceData }) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const router = useRouter();

  const API_BASE = getPublicApiUrl();

  const getHeaders = useCallback(() => {
    const token = (session as any)?.accessToken;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [session]);

  const handleForkAction = async (action: 'merge' | 'promote' | 'reject') => {
    const forkId = workspace.fork_context?.fork_id;
    if (!forkId) return;

    if (action === 'reject' && !rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setLoading(action);
    try {
      const body = action === 'reject' ? JSON.stringify({ reason: rejectReason }) : undefined;
      await apiFetch(`${API_BASE}/data/api/forks/${forkId}/${action}/`, {
        method: 'POST',
        headers: getHeaders(),
        body,
      });
      toast.success(`Fork ${action}d successfully`);
      router.refresh();
    } catch (err) {
      toast.error(
        getApiErrorMessage(err, `Could not ${action} this fork. Please try again.`)
      );
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={`${glassCard} border-primary/30 dark:border-primary/30`}>
      <div className="p-5 border-b border-primary/30 dark:border-primary/30">
        <h3 className="font-bold flex items-center gap-2 text-primary dark:text-primary">
          <GitFork className="h-5 w-5" /> Fork Actions
        </h3>
        <p className="text-xs text-primary dark:text-primary mt-1">
          Curate this fork: merge changes into parent, promote as canonical, or reject.
        </p>
      </div>
      <div className="p-5 space-y-3">
        <Button
          onClick={() => handleForkAction('merge')}
          disabled={loading !== null}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-500 text-white hover:from-green-700 hover:to-emerald-600"
        >
          {loading === 'merge' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <GitMerge className="h-4 w-4 mr-2" />}
          Merge into Parent
        </Button>
        <p className="text-[11px] text-muted-foreground">Creates a new revision on the parent entity with this fork&apos;s changes.</p>

        <Button
          onClick={() => handleForkAction('promote')}
          disabled={loading !== null}
          variant="outline"
          className="w-full border-primary/30 text-primary hover:bg-primary/10 dark:border-primary/30 dark:text-primary dark:hover:bg-primary/10"
        >
          {loading === 'promote' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowUpFromLine className="h-4 w-4 mr-2" />}
          Promote as Canonical
        </Button>
        <p className="text-[11px] text-muted-foreground">This fork becomes the canonical entity. The original will be marked as superseded.</p>

        <Separator />

        <div className="space-y-2">
          <Textarea
            placeholder="Reason for rejection (required)..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[60px] resize-none text-sm"
          />
          <Button
            onClick={() => handleForkAction('reject')}
            disabled={loading !== null || !rejectReason.trim()}
            variant="destructive"
            className="w-full"
          >
            {loading === 'reject' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
            Reject Fork
          </Button>
        </div>
      </div>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const config: Record<string, { label: string; className: string }> = {
    accept: { label: '✓ Accepted', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    accept_with_edits: { label: '✓ Accepted (edited)', className: 'bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary' },
    request_changes: { label: '↻ Changes Requested', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
    reject: { label: '✗ Rejected', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
    escalate: { label: '⬆ Escalated', className: 'bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary' },
  };
  const c = config[verdict] || { label: verdict, className: '' };
  return <Badge variant="secondary" className={`text-[10px] ${c.className}`}>{c.label}</Badge>;
}
