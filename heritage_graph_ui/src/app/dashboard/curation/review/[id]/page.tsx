'use client';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  Edit,
  FileText,
  Flag,
  History,
  Scale,
  Shield,
  ShieldAlert,
  User,
  XCircle,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';
import { toast, Toaster } from 'sonner';

// --- Types ---
interface UserInfo {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface Revision {
  revision_id: string;
  revision_number: number;
  data: Record<string, unknown>;
  created_by: UserInfo;
  created_at: string;
}

interface ActivityItem {
  activity_id: string;
  user: UserInfo;
  activity_type: string;
  comment: string | null;
  created_at: string;
}

interface ReviewDecisionItem {
  id: string;
  reviewer: UserInfo;
  revision_reviewed: Revision | null;
  verdict: string;
  conflict_handling: string;
  confidence_override: string | null;
  verification_method: string | null;
  feedback: string;
  reconciliation_note: string;
  internal_note: string;
  created_at: string;
}

interface ReviewFlagItem {
  id: string;
  flag_type: string;
  flagged_by: UserInfo;
  reason: string;
  is_resolved: boolean;
  created_at: string;
}

interface ContributorStats {
  total_contributions: number;
  accepted_contributions: number;
  acceptance_rate: number;
}

interface ReviewWorkspaceData {
  entity_id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  contributor: UserInfo;
  current_revision: Revision | null;
  created_at: string;
  updated_at: string;
  revisions: Revision[];
  activities: ActivityItem[];
  review_decisions: ReviewDecisionItem[];
  flags: ReviewFlagItem[];
  contributor_stats: ContributorStats;
}

type Verdict = 'accept' | 'accept_with_edits' | 'request_changes' | 'reject' | 'escalate';
type ConflictHandling = 'not_applicable' | 'supersedes' | 'coexist' | 'existing_stands' | 'refines' | 'disputed';
type Confidence = '' | 'certain' | 'likely' | 'uncertain' | 'speculative';
type VerificationMethod = '' | 'source_crosscheck' | 'expert_knowledge' | 'field_verification' | 'community_consensus';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function ReviewWorkspacePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const entityId = params.id as string;

  const [workspace, setWorkspace] = useState<ReviewWorkspaceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Decision form state
  const [verdict, setVerdict] = useState<Verdict | ''>('');
  const [conflictHandling, setConflictHandling] = useState<ConflictHandling>('not_applicable');
  const [confidenceOverride, setConfidenceOverride] = useState<Confidence>('');
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>('');
  const [feedback, setFeedback] = useState('');
  const [reconciliationNote, setReconciliationNote] = useState('');
  const [internalNote, setInternalNote] = useState('');

  const getHeaders = useCallback(() => {
    const token = (session as Record<string, unknown>)?.accessToken as string | undefined;
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }, [session]);

  const fetchWorkspace = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(
        `${API_BASE}/data/api/review-workspace/${entityId}/`,
        { headers: getHeaders() }
      );
      if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
      const data: ReviewWorkspaceData = await res.json();
      setWorkspace(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load review workspace');
    } finally {
      setIsLoading(false);
    }
  }, [entityId, getHeaders]);

  useEffect(() => {
    if (session && entityId) fetchWorkspace();
  }, [session, entityId, fetchWorkspace]);

  const submitDecision = async () => {
    if (!verdict) {
      toast.error('Please select a verdict');
      return;
    }
    if (verdict === 'reject' && !feedback.trim()) {
      toast.error('Feedback is required when rejecting');
      return;
    }

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

      const res = await fetch(
        `${API_BASE}/data/api/review-workspace/${entityId}/decide/`,
        {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(errData) || `Error: ${res.status}`);
      }

      toast.success('Review decision submitted successfully');
      // Refresh workspace
      await fetchWorkspace();
      // Reset form
      setVerdict('');
      setConflictHandling('not_applicable');
      setConfidenceOverride('');
      setVerificationMethod('');
      setFeedback('');
      setReconciliationNote('');
      setInternalNote('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit decision');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading review workspace...</p>
        </div>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">{error || 'Entity not found'}</p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  const hasConflicts = workspace.flags.some(f => f.flag_type === 'contradiction');
  const latestRevision = workspace.revisions[0];
  const revisionData = latestRevision?.data || {};

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Queue
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{workspace.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">{workspace.category}</Badge>
              <Badge variant={workspace.status === 'pending_review' ? 'default' : 'secondary'}>
                {workspace.status.replace(/_/g, ' ')}
              </Badge>
              {hasConflicts && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Has Conflicts
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Three-Panel Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT PANEL — Context */}
          <div className="lg:col-span-3">
            <ContextPanel workspace={workspace} />
          </div>

          {/* MIDDLE PANEL — Submission Under Review */}
          <div className="lg:col-span-5">
            <SubmissionPanel
              workspace={workspace}
              revisionData={revisionData}
              latestRevision={latestRevision}
            />
          </div>

          {/* RIGHT PANEL — Decision */}
          <div className="lg:col-span-4">
            <DecisionPanel
              workspace={workspace}
              hasConflicts={hasConflicts}
              verdict={verdict}
              setVerdict={setVerdict}
              conflictHandling={conflictHandling}
              setConflictHandling={setConflictHandling}
              confidenceOverride={confidenceOverride}
              setConfidenceOverride={setConfidenceOverride}
              verificationMethod={verificationMethod}
              setVerificationMethod={setVerificationMethod}
              feedback={feedback}
              setFeedback={setFeedback}
              reconciliationNote={reconciliationNote}
              setReconciliationNote={setReconciliationNote}
              internalNote={internalNote}
              setInternalNote={setInternalNote}
              isSubmitting={isSubmitting}
              onSubmit={submitDecision}
            />
          </div>
        </div>
      </div>
    </>
  );
}

// =====================================================================
// LEFT PANEL — Context
// =====================================================================
function ContextPanel({ workspace }: { workspace: ReviewWorkspaceData }) {
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <ScrollArea className="h-[calc(100vh-200px)]">
      <div className="space-y-4 pr-2">
        {/* Current Record State */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" /> Current Record State
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="font-medium">Category:</span> {workspace.category}</div>
            <div><span className="font-medium">Status:</span> {workspace.status.replace(/_/g, ' ')}</div>
            <div><span className="font-medium">Created:</span> {formatDate(workspace.created_at)}</div>
            <div><span className="font-medium">Updated:</span> {formatDate(workspace.updated_at)}</div>
            {workspace.current_revision && (
              <div>
                <span className="font-medium">Current Rev:</span>{' '}
                #{workspace.current_revision.revision_number}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contributor Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4" /> Contributor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="font-medium">
              {workspace.contributor.first_name} {workspace.contributor.last_name}
            </div>
            <div className="text-muted-foreground">@{workspace.contributor.username}</div>
            <Separator />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-muted-foreground">Contributions</div>
                <div className="font-semibold">{workspace.contributor_stats.total_contributions}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Accepted</div>
                <div className="font-semibold">{workspace.contributor_stats.accepted_contributions}</div>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground">Acceptance Rate</div>
                <div className="font-semibold">{workspace.contributor_stats.acceptance_rate}%</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Flags */}
        {workspace.flags.length > 0 && (
          <Card className="border-amber-300 dark:border-amber-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
                <Flag className="h-4 w-4" /> Active Flags ({workspace.flags.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {workspace.flags.map((flag) => (
                <div key={flag.id} className="text-xs border-l-2 border-l-amber-400 pl-2 py-1">
                  <Badge variant="outline" className="text-[10px] mb-1">
                    {flag.flag_type.replace(/_/g, ' ')}
                  </Badge>
                  {flag.reason && <p className="text-muted-foreground">{flag.reason}</p>}
                  <p className="text-muted-foreground mt-1">
                    by @{flag.flagged_by.username} · {new Date(flag.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Activity History */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4" /> Activity History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {workspace.activities.slice(0, 10).map((activity) => (
                <div key={activity.activity_id} className="text-xs border-l-2 border-l-muted pl-2 py-1">
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {activity.activity_type}
                    </Badge>
                    <span className="text-muted-foreground">by @{activity.user.username}</span>
                  </div>
                  {activity.comment && (
                    <p className="text-muted-foreground mt-0.5 line-clamp-2">{activity.comment}</p>
                  )}
                  <p className="text-muted-foreground mt-0.5">
                    {new Date(activity.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
              {workspace.activities.length === 0 && (
                <p className="text-xs text-muted-foreground">No activity yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Previous Review Decisions */}
        {workspace.review_decisions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" /> Previous Reviews
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {workspace.review_decisions.map((decision) => (
                <div key={decision.id} className="text-xs border-l-2 border-l-primary pl-2 py-1">
                  <div className="flex items-center gap-1">
                    <VerdictBadge verdict={decision.verdict} />
                    <span className="text-muted-foreground">
                      by @{decision.reviewer.username}
                    </span>
                  </div>
                  {decision.feedback && (
                    <p className="text-muted-foreground mt-0.5">{decision.feedback}</p>
                  )}
                  <p className="text-muted-foreground mt-0.5">
                    {new Date(decision.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}

// =====================================================================
// MIDDLE PANEL — Submission Detail
// =====================================================================
function SubmissionPanel({
  workspace,
  revisionData,
  latestRevision,
}: {
  workspace: ReviewWorkspaceData;
  revisionData: Record<string, unknown>;
  latestRevision: Revision | undefined;
}) {
  return (
    <ScrollArea className="h-[calc(100vh-200px)]">
      <div className="space-y-4 pr-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Submission Under Review
            </CardTitle>
            <CardDescription>
              {latestRevision
                ? `Revision ${latestRevision.revision_number} — by @${latestRevision.created_by.username} on ${new Date(latestRevision.created_at).toLocaleDateString()}`
                : 'No revision data'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Entity metadata */}
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Entity Name</Label>
                <p className="font-medium">{workspace.name}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <p className="text-sm">{workspace.description || '—'}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Category</Label>
                <p className="text-sm capitalize">{workspace.category}</p>
              </div>
            </div>

            <Separator />

            {/* Revision data fields */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">
                Form Data (Revision #{latestRevision?.revision_number || '—'})
              </Label>
              {Object.keys(revisionData).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(revisionData).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-3 gap-2 py-1 border-b border-border/50 last:border-0">
                      <span className="text-xs font-medium text-muted-foreground col-span-1 break-words">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm col-span-2 break-words">
                        {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value || '—')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No form data available</p>
              )}
            </div>

            <Separator />

            {/* Contributor info */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <Label className="text-xs text-muted-foreground">Submitted by</Label>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {workspace.contributor.first_name} {workspace.contributor.last_name}
                </span>
                <span className="text-sm text-muted-foreground">
                  @{workspace.contributor.username}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{workspace.contributor_stats.total_contributions} contributions</span>
                <span>{workspace.contributor_stats.accepted_contributions} verified</span>
                <span>{workspace.contributor_stats.acceptance_rate}% acceptance</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Submitted: {new Date(workspace.created_at).toLocaleDateString('en-US', {
                  year: 'numeric', month: 'long', day: 'numeric'
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revision History */}
        {workspace.revisions.length > 1 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Revision History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {workspace.revisions.map((rev) => (
                  <div
                    key={rev.revision_id}
                    className={`text-xs border-l-2 pl-2 py-1 ${
                      rev.revision_id === latestRevision?.revision_id
                        ? 'border-l-primary'
                        : 'border-l-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Rev. {rev.revision_number}</span>
                      {rev.revision_id === latestRevision?.revision_id && (
                        <Badge variant="default" className="text-[10px] h-4">Latest</Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground">
                      by @{rev.created_by.username} · {new Date(rev.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}

// =====================================================================
// RIGHT PANEL — Decision
// =====================================================================
function DecisionPanel({
  workspace,
  hasConflicts,
  verdict,
  setVerdict,
  conflictHandling,
  setConflictHandling,
  confidenceOverride,
  setConfidenceOverride,
  verificationMethod,
  setVerificationMethod,
  feedback,
  setFeedback,
  reconciliationNote,
  setReconciliationNote,
  internalNote,
  setInternalNote,
  isSubmitting,
  onSubmit,
}: {
  workspace: ReviewWorkspaceData;
  hasConflicts: boolean;
  verdict: Verdict | '';
  setVerdict: (v: Verdict | '') => void;
  conflictHandling: ConflictHandling;
  setConflictHandling: (v: ConflictHandling) => void;
  confidenceOverride: Confidence;
  setConfidenceOverride: (v: Confidence) => void;
  verificationMethod: VerificationMethod;
  setVerificationMethod: (v: VerificationMethod) => void;
  feedback: string;
  setFeedback: (v: string) => void;
  reconciliationNote: string;
  setReconciliationNote: (v: string) => void;
  internalNote: string;
  setInternalNote: (v: string) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
}) {
  const isAlreadyReviewed = workspace.status === 'accepted' || workspace.status === 'rejected';

  return (
    <ScrollArea className="h-[calc(100vh-200px)]">
      <div className="space-y-4 pr-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" /> Your Decision
            </CardTitle>
            {isAlreadyReviewed && (
              <CardDescription className="text-amber-600">
                This entity has already been {workspace.status}. You can still submit a new review.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Verdict */}
            <div className="space-y-2">
              <Label className="font-medium">Verdict</Label>
              <div className="space-y-2">
                {([
                  { value: 'accept', label: 'Accept — publish this assertion', icon: CheckCircle, color: 'text-green-600' },
                  { value: 'accept_with_edits', label: 'Accept with edits — modify before publishing', icon: Edit, color: 'text-blue-600' },
                  { value: 'request_changes', label: 'Request changes — send back to contributor', icon: ArrowUpRight, color: 'text-amber-600' },
                  { value: 'reject', label: 'Reject — do not publish', icon: XCircle, color: 'text-red-600' },
                  { value: 'escalate', label: 'Escalate to expert — beyond my domain', icon: ShieldAlert, color: 'text-purple-600' },
                ] as const).map(({ value, label, icon: Icon, color }) => (
                  <label
                    key={value}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      verdict === value
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-accent/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="verdict"
                      value={value}
                      checked={verdict === value}
                      onChange={() => setVerdict(value)}
                      className="sr-only"
                    />
                    <Icon className={`h-4 w-4 ${color}`} />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <Separator />

            {/* Conflict Handling — required if conflicts exist */}
            {hasConflicts && (
              <div className="space-y-2">
                <Label className="font-medium flex items-center gap-2">
                  <Scale className="h-4 w-4 text-amber-600" />
                  Conflict Handling <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={conflictHandling}
                  onValueChange={(v) => setConflictHandling(v as ConflictHandling)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="refines">New claim refines existing (more precise)</SelectItem>
                    <SelectItem value="coexist">Both claims coexist (conflicting sources)</SelectItem>
                    <SelectItem value="supersedes">New claim supersedes existing</SelectItem>
                    <SelectItem value="existing_stands">Existing claim stands; reject new</SelectItem>
                    <SelectItem value="disputed">Genuinely contradictory — requires expert</SelectItem>
                    <SelectItem value="not_applicable">Not applicable</SelectItem>
                  </SelectContent>
                </Select>
                {conflictHandling !== 'not_applicable' && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Reconciliation Note (public — becomes part of provenance)
                    </Label>
                    <Textarea
                      placeholder="Explain the conflict resolution rationale..."
                      value={reconciliationNote}
                      onChange={(e) => setReconciliationNote(e.target.value)}
                      rows={2}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Confidence Override */}
            <div className="space-y-2">
              <Label className="text-sm">Adjust Confidence Score</Label>
              <Select
                value={confidenceOverride || 'none'}
                onValueChange={(v) => setConfidenceOverride(v === 'none' ? '' : v as Confidence)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Keep contributor's assessment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keep contributor&apos;s assessment</SelectItem>
                  <SelectItem value="certain">Certain</SelectItem>
                  <SelectItem value="likely">Likely</SelectItem>
                  <SelectItem value="uncertain">Uncertain</SelectItem>
                  <SelectItem value="speculative">Speculative</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Verification Method */}
            {(verdict === 'accept' || verdict === 'accept_with_edits') && (
              <div className="space-y-2">
                <Label className="text-sm">Verification Method</Label>
                <Select
                  value={verificationMethod || 'none'}
                  onValueChange={(v) => setVerificationMethod(v === 'none' ? '' : v as VerificationMethod)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
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

            <Separator />

            {/* Feedback to Contributor */}
            <div className="space-y-2">
              <Label className="text-sm">
                Feedback to Contributor
                {verdict === 'reject' && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Textarea
                placeholder="Shown to contributor; logged permanently..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
              />
            </div>

            {/* Internal Note */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Internal Note (visible only to reviewers)
              </Label>
              <Textarea
                placeholder="Private notes for the review team..."
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                rows={2}
              />
            </div>

            {/* Submit */}
            <Button
              onClick={onSubmit}
              disabled={!verdict || isSubmitting}
              className="w-full"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Decision'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

// =====================================================================
// Verdict Badge helper
// =====================================================================
function VerdictBadge({ verdict }: { verdict: string }) {
  const config: Record<string, { label: string; className: string }> = {
    accept: { label: '✓ Accepted', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    accept_with_edits: { label: '✓ Accepted (edited)', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    request_changes: { label: '↻ Changes Requested', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
    reject: { label: '✗ Rejected', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
    escalate: { label: '⬆ Escalated', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  };
  const c = config[verdict] || { label: verdict, className: '' };
  return <Badge variant="secondary" className={`text-[10px] ${c.className}`}>{c.label}</Badge>;
}
