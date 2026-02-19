'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Flag,
  Loader2,
  RefreshCw,
  Scale,
  Shield,
  ShieldCheck,
  TrendingUp,
  User,
  XCircle,
} from 'lucide-react';
import { toast, Toaster } from 'sonner';

interface ReviewerRoleData {
  id: string;
  user: { id: number; username: string; email: string; first_name: string; last_name: string };
  role: string;
  expertise_areas: string[];
  is_active: boolean;
  can_override_confidence: boolean;
  can_resolve_conflicts: boolean;
  can_manage_roles: boolean;
}

interface DomainActivityItem {
  entity_name: string;
  entity_id: string;
  activity_type: string;
  user: string;
  created_at: string;
  comment: string;
}

interface DashboardData {
  queue_count: number;
  conflicts_count: number;
  flagged_count: number;
  expiring_count: number;
  resolved_this_week: number;
  accepted_this_week: number;
  rejected_this_week: number;
  total_reviewed: number;
  acceptance_rate: number;
  conflicts_resolved: number;
  reviewer_role: ReviewerRoleData | null;
  recent_domain_activity: DomainActivityItem[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://0.0.0.0:8000';

const ROLE_LABELS: Record<string, string> = {
  community_reviewer: 'Community Reviewer',
  domain_expert: 'Domain Expert',
  expert_curator: 'Expert Curator',
};

export default function ReviewerDashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getHeaders = useCallback(() => {
    const token = (session as Record<string, unknown>)?.accessToken as string | undefined;
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }, [session]);

  const fetchDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(
        `${API_BASE}/data/api/reviewer-dashboard/`,
        { headers: getHeaders() }
      );
      if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
      const data: DashboardData = await res.json();
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    if (session) fetchDashboard();
  }, [session, fetchDashboard]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading reviewer dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">{error || 'Failed to load dashboard'}</p>
          <Button onClick={fetchDashboard}>Try Again</Button>
        </div>
      </div>
    );
  }

  const userName = dashboard.reviewer_role
    ? `${dashboard.reviewer_role.user.first_name || dashboard.reviewer_role.user.username}`
    : 'Reviewer';

  const roleName = dashboard.reviewer_role
    ? ROLE_LABELS[dashboard.reviewer_role.role] || dashboard.reviewer_role.role
    : 'Not assigned';

  const expertiseAreas = dashboard.reviewer_role?.expertise_areas || [];

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              Welcome, {userName}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Shield className="h-3 w-3" /> {roleName}
              </Badge>
              {expertiseAreas.map((area) => (
                <Badge key={area} variant="outline" className="capitalize text-xs">
                  {area.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          </div>
          <Button
            onClick={() => router.push('/dashboard/curation/review')}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Open Review Queue
          </Button>
        </div>

        {/* Queue Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* In My Queue */}
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => router.push('/dashboard/curation/review')}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">In My Queue</p>
                  <p className="text-4xl font-bold mt-1">{dashboard.queue_count}</p>
                  <div className="mt-2 space-y-1 text-sm">
                    {dashboard.conflicts_count > 0 && (
                      <div className="flex items-center gap-1 text-amber-600">
                        <Scale className="h-3 w-3" />
                        {dashboard.conflicts_count} conflicts
                      </div>
                    )}
                    {dashboard.flagged_count > 0 && (
                      <div className="flex items-center gap-1 text-orange-600">
                        <Flag className="h-3 w-3" />
                        {dashboard.flagged_count} flagged
                      </div>
                    )}
                    {dashboard.expiring_count > 0 && (
                      <div className="flex items-center gap-1 text-red-600">
                        <Clock className="h-3 w-3" />
                        {dashboard.expiring_count} expiring
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-3 bg-primary/10 rounded-lg">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resolved This Week */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Resolved This Week</p>
                  <p className="text-4xl font-bold mt-1">{dashboard.resolved_this_week}</p>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-3 w-3" />
                      {dashboard.accepted_this_week} accepted
                    </div>
                    <div className="flex items-center gap-1 text-red-600">
                      <XCircle className="h-3 w-3" />
                      {dashboard.rejected_this_week} rejected
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <ShieldCheck className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* My Impact */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">My Impact</p>
                  <p className="text-4xl font-bold mt-1">{dashboard.total_reviewed}</p>
                  <p className="text-xs text-muted-foreground">claims reviewed</p>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-primary" />
                      {dashboard.acceptance_rate}% acceptance rate
                    </div>
                    <div className="flex items-center gap-1">
                      <Scale className="h-3 w-3 text-amber-600" />
                      {dashboard.conflicts_resolved} conflicts resolved
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Domain Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity in Your Domain
            </CardTitle>
            <CardDescription>
              Latest submissions, reviews, and updates across heritage entities
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard.recent_domain_activity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No recent activity in your domain
              </p>
            ) : (
              <div className="space-y-3">
                {dashboard.recent_domain_activity.map((activity, idx) => (
                  <div
                    key={`${activity.entity_id}-${idx}`}
                    className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0 cursor-pointer hover:bg-accent/30 rounded px-2 -mx-2 transition-colors"
                    onClick={() => router.push(`/dashboard/curation/review/${activity.entity_id}`)}
                  >
                    <ActivityIcon type={activity.activity_type} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">
                          {activity.entity_name}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {activity.activity_type.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      {activity.comment && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {activity.comment}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>by @{activity.user}</span>
                        <span>·</span>
                        <span>{new Date(activity.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Navigation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickLink
            title="Review Queue"
            description="Review pending submissions"
            icon={FileText}
            onClick={() => router.push('/dashboard/curation/review')}
          />
          <QuickLink
            title="Conflicts"
            description="Resolve contradicting assertions"
            icon={Scale}
            onClick={() => router.push('/dashboard/curation/conflicts')}
            highlight={dashboard.conflicts_count > 0}
          />
          <QuickLink
            title="Contributions"
            description="Full contributions queue"
            icon={CheckCircle}
            onClick={() => router.push('/dashboard/curation/contributions')}
          />
          <QuickLink
            title="Activity Log"
            description="Track all platform activity"
            icon={Clock}
            onClick={() => router.push('/dashboard/curation/activity')}
          />
        </div>
      </div>
    </>
  );
}

function ActivityIcon({ type }: { type: string }) {
  const iconMap: Record<string, { icon: typeof FileText; color: string }> = {
    submitted: { icon: FileText, color: 'text-blue-500' },
    accepted: { icon: CheckCircle, color: 'text-green-500' },
    rejected: { icon: XCircle, color: 'text-red-500' },
    revised: { icon: RefreshCw, color: 'text-purple-500' },
    escalated: { icon: AlertTriangle, color: 'text-amber-500' },
    changes_requested: { icon: ArrowRight, color: 'text-orange-500' },
    flagged: { icon: Flag, color: 'text-red-500' },
    conflict_resolved: { icon: Scale, color: 'text-green-600' },
    commented: { icon: User, color: 'text-gray-500' },
  };
  const config = iconMap[type] || iconMap.commented;
  const Icon = config.icon;
  return <Icon className={`h-4 w-4 ${config.color} shrink-0 mt-0.5`} />;
}

function QuickLink({
  title,
  description,
  icon: Icon,
  onClick,
  highlight = false,
}: {
  title: string;
  description: string;
  icon: typeof FileText;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <Card
      className={`cursor-pointer hover:bg-accent/50 transition-colors ${
        highlight ? 'border-amber-300 dark:border-amber-700' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="pt-6 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${highlight ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-muted'}`}>
          <Icon className={`h-5 w-5 ${highlight ? 'text-amber-600' : 'text-muted-foreground'}`} />
        </div>
        <div>
          <p className="font-medium text-sm">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
