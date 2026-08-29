'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  QrCode, Search, Eye, CheckCircle, XCircle, RefreshCw, 
  MapPin, User, Mail, Phone, BookOpen, History, Heart, Camera, Sparkles, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { fadeInUp, staggerContainer, glassCard } from '@/lib/design';
import { apiFetchJson, getApiErrorMessage } from '@/lib/api-client';
import { getPublicApiUrl } from '@/lib/api-base';
import { RequireAuth } from '@/components/require-auth';

const API = getPublicApiUrl();

interface PublicContribution {
  id: string;
  entity: string | null;
  entity_reference_id: string;
  entity_name: string;
  entity_name_display: string;
  contribution_type: string;
  contribution_type_display: string;
  content: string;
  contributor_name: string;
  contributor_email: string | null;
  source_description: string;
  submitted_via: string;
  latitude: string | null;
  longitude: string | null;
  status: string;
  status_display: string;
  reviewed_by: string | null;
  reviewed_by_username: string | null;
  reviewed_at: string | null;
  review_notes: string;
  promoted_entity: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * CIDOC types a QR note can be promoted into (review `target_type`).
 * Must be Django model names accepted by the backend promotion service
 * (apps/heritage_data/qr_promotion.py).
 */
const PROMOTION_TARGETS: { value: string; label: string }[] = [
  { value: 'Monument', label: 'Monument' },
  { value: 'ArchitecturalStructure', label: 'Architectural structure' },
  { value: 'Location', label: 'Location / site' },
  { value: 'Person', label: 'Person' },
  { value: 'Deity', label: 'Deity' },
  { value: 'Event', label: 'Historical event' },
  { value: 'Festival', label: 'Festival' },
  { value: 'RitualEvent', label: 'Ritual' },
  { value: 'Tradition', label: 'Tradition' },
  { value: 'Guthi', label: 'Guthi' },
  { value: 'IconographicObject', label: 'Iconographic object' },
  { value: 'CasteGroup', label: 'Caste group' },
];

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'incorporated';
type TypeFilter = 'all' | 'history' | 'story' | 'tradition' | 'memory' | 'photo' | 'correction' | 'other';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  history: <History className="h-4 w-4" />,
  story: <BookOpen className="h-4 w-4" />,
  tradition: <Users className="h-4 w-4" />,
  memory: <Heart className="h-4 w-4" />,
  photo: <Camera className="h-4 w-4" />,
  other: <Sparkles className="h-4 w-4" />,
  correction: <RefreshCw className="h-4 w-4" />,
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  incorporated: 'bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary',
};

const TYPE_STYLES: Record<string, string> = {
  history: 'bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary',
  story: 'bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary',
  tradition: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  memory: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  photo: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  correction: 'bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

function relDate(d: string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function QRContributionsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [contributions, setContributions] = useState<PublicContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, incorporated: 0 });
  
  // Review dialog state
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedContribution, setSelectedContribution] = useState<PublicContribution | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected' | 'incorporated'>('approved');
  const [targetType, setTargetType] = useState<string>('none');
  const [submittingReview, setSubmittingReview] = useState(false);

  const headers = useCallback(() => {
    const h: HeadersInit = { 'Content-Type': 'application/json' };
    const t = (session as any)?.accessToken;
    if (t) h['Authorization'] = `Bearer ${t}`;
    return h;
  }, [session]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiFetchJson<{
        total: number;
        pending: number;
        approved: number;
        rejected: number;
        incorporated: number;
      }>(`${API}/data/api/public-contributions/stats/`, { headers: headers() });
      setStats(data);
    } catch (err) {
      // Avoid console noise; stats will remain stale.
    }
  }, [headers]);

  const fetchContributions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('contribution_type', typeFilter);
      if (searchQuery) params.set('search', searchQuery);
      
      const data = await apiFetchJson<{ results?: PublicContribution[] } | PublicContribution[]>(
        `${API}/data/api/public-contributions/?${params}`,
        { headers: headers() }
      );
      setContributions(
        Array.isArray(data) ? data : data.results || []
      );
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, 'Could not load public contributions.');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [headers, statusFilter, typeFilter, searchQuery]);

  useEffect(() => {
    if (session?.accessToken) {
      fetchContributions();
      fetchStats();
    }
  }, [session, fetchContributions, fetchStats]);

  const openReviewDialog = (contribution: PublicContribution) => {
    setSelectedContribution(contribution);
    setReviewNotes('');
    setReviewAction('approved');
    setTargetType('none');
    setReviewDialogOpen(true);
  };

  /**
   * Submit a review decision. Pass `contribution`/`action` explicitly for the
   * quick-action buttons (state set in the same click is not yet committed);
   * the dialog path falls back to the dialog state.
   */
  const handleReview = async (
    contribution?: PublicContribution,
    action?: 'approved' | 'rejected' | 'incorporated'
  ) => {
    const target = contribution ?? selectedContribution;
    const decision = action ?? reviewAction;
    if (!target) return;

    const promoteAs =
      !contribution && decision !== 'rejected' && targetType !== 'none'
        ? targetType
        : null;

    setSubmittingReview(true);
    try {
      const result = await apiFetchJson<{ promoted_entity_id?: string | null }>(
        `${API}/data/api/public-contributions/${target.id}/review/`,
        {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            status: decision,
            review_notes: contribution ? '' : reviewNotes,
            ...(promoteAs ? { target_type: promoteAs } : {}),
          }),
        }
      );

      const promotedId = result?.promoted_entity_id;
      if (promotedId) {
        toast.success(`Contribution ${decision} and promoted to ${promoteAs}`, {
          description:
            'A structured record is now in the review queue with provenance back to this QR note.',
          duration: 8000,
          action: {
            label: 'Open in review queue',
            onClick: () => router.push(`/curation/review/${promotedId}`),
          },
        });
      } else {
        toast.success(`Contribution ${decision}`);
      }
      setReviewDialogOpen(false);
      fetchContributions();
      fetchStats();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Could not submit this review.'));
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <RequireAuth
      title="Sign in to review QR contributions"
      description="QR submissions may include contact details. Sign-in is required for moderation tools."
    >
      <motion.div 
        initial="hidden" 
        animate="show" 
        variants={staggerContainer} 
        className="space-y-6"
      >
      {/* Header */}
      <motion.div variants={fadeInUp} className={glassCard}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-hero-from to-hero-to shadow-lg">
              <QrCode className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">QR Code Contributions</CardTitle>
              <CardDescription>
                Review contributions from visitors who scanned QR codes at heritage sites
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'from-gray-400 to-gray-500' },
          { label: 'Pending', value: stats.pending, color: 'from-amber-400 to-amber-500' },
          { label: 'Approved', value: stats.approved, color: 'from-green-400 to-green-500' },
          { label: 'Rejected', value: stats.rejected, color: 'from-red-400 to-red-500' },
          { label: 'Incorporated', value: stats.incorporated, color: 'from-hero-from to-hero-to' },
        ].map((stat) => (
          <Card key={stat.label} className={glassCard}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.color}`}>
                  <span className="text-white font-bold text-lg">{stat.value}</span>
                </div>
                <span className="text-sm text-muted-foreground">{stat.label}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div variants={fadeInUp} className={`${glassCard} p-4`}>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by entity name or content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchContributions()}
                className="pl-10"
              />
            </div>
          </div>
          
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="history">Historical</SelectItem>
              <SelectItem value="story">Story/Legend</SelectItem>
              <SelectItem value="tradition">Tradition</SelectItem>
              <SelectItem value="memory">Memory</SelectItem>
              <SelectItem value="photo">Photo</SelectItem>
              <SelectItem value="correction">Correction</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={fetchContributions}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div variants={fadeInUp} className={`${glassCard} overflow-hidden`}>
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-muted-foreground mt-2">Loading contributions...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : contributions.length === 0 ? (
          <div className="p-8 text-center">
            <QrCode className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No contributions found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Contributor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contributions.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">{c.entity_name_display || c.entity_name}</div>
                    {c.latitude && c.longitude && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        GPS: {Number(c.latitude).toFixed(4)}, {Number(c.longitude).toFixed(4)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={TYPE_STYLES[c.contribution_type] || TYPE_STYLES.other}>
                      <span className="flex items-center gap-1">
                        {TYPE_ICONS[c.contribution_type]}
                        {c.contribution_type_display}
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate" title={c.content}>
                      {c.content.length > 80 ? c.content.slice(0, 80) + '...' : c.content}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{c.contributor_name}</span>
                    </div>
                    {c.contributor_email && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Mail className="h-3 w-3" />
                        {c.contributor_email}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_STYLES[c.status] || STATUS_STYLES.pending}>
                      {c.status_display}
                    </Badge>
                    {c.promoted_entity && (
                      <Badge
                        variant="outline"
                        className="ml-1 cursor-pointer"
                        title="Promoted into the structured review pipeline"
                        onClick={() => router.push(`/curation/review/${c.promoted_entity}`)}
                      >
                        Promoted
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{relDate(c.created_at)}</div>
                    <div className="text-xs text-muted-foreground">
                      via {c.submitted_via.replace('_', ' ')}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openReviewDialog(c)}
                        title="View & Review"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {c.status === 'pending' && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleReview(c, 'approved')}
                            title="Approve"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleReview(c, 'rejected')}
                            title="Reject"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </motion.div>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Contribution</DialogTitle>
            <DialogDescription>
              Review the details and decide whether to approve, reject, or incorporate this contribution
            </DialogDescription>
          </DialogHeader>
          
          {selectedContribution && (
            <div className="space-y-4">
              {/* Entity Info */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-semibold mb-2">Entity: {selectedContribution.entity_name_display || selectedContribution.entity_name}</h4>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <Badge className={TYPE_STYLES[selectedContribution.contribution_type] || TYPE_STYLES.other}>
                    {TYPE_ICONS[selectedContribution.contribution_type]}
                    {selectedContribution.contribution_type_display}
                  </Badge>
                  <span>Submitted: {relDate(selectedContribution.created_at)}</span>
                </div>
              </div>
              
              {/* Content */}
              <div>
                <Label>Contribution Content</Label>
                <div className="mt-1 p-3 bg-muted/30 rounded-lg text-sm whitespace-pre-wrap">
                  {selectedContribution.content}
                </div>
              </div>
              
              {/* Source */}
              {selectedContribution.source_description && (
                <div>
                  <Label>Source / How they know this</Label>
                  <div className="mt-1 p-3 bg-muted/30 rounded-lg text-sm">
                    {selectedContribution.source_description}
                  </div>
                </div>
              )}
              
              {/* Contributor Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Contributor</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {selectedContribution.contributor_name}
                  </div>
                </div>
                {selectedContribution.contributor_email && (
                  <div>
                    <Label>Email</Label>
                    <div className="mt-1 flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {selectedContribution.contributor_email}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Review Action */}
              <div>
                <Label>Decision</Label>
                <Select value={reviewAction} onValueChange={(v) => setReviewAction(v as typeof reviewAction)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approve - Valid contribution</SelectItem>
                    <SelectItem value="rejected">Reject - Invalid or inappropriate</SelectItem>
                    <SelectItem value="incorporated">Incorporated - Added to entity</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Promote into the structured pipeline (Path A) */}
              {reviewAction !== 'rejected' && (
                <div>
                  <Label>Promote to structured record (optional)</Label>
                  <Select value={targetType} onValueChange={setTargetType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Don&apos;t promote</SelectItem>
                      {PROMOTION_TARGETS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Creates a pre-filled record of this type in the review queue, with
                    provenance back to this QR note — no manual re-entry needed.
                  </p>
                </div>
              )}

              {/* Review Notes */}
              <div>
                <Label>Review Notes (optional)</Label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add notes about your decision..."
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => handleReview()} 
              disabled={submittingReview}
              className={
                reviewAction === 'approved' ? 'bg-green-600 hover:bg-green-700' :
                reviewAction === 'rejected' ? 'bg-red-600 hover:bg-red-700' :
                'bg-primary hover:bg-primary/90'
              }
            >
              {submittingReview ? 'Submitting...' : `Submit: ${reviewAction.charAt(0).toUpperCase() + reviewAction.slice(1)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </motion.div>
    </RequireAuth>
  );
}
