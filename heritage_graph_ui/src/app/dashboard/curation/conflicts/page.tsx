'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle,
  ArrowLeft,
  Scale,
  Eye,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { toast, Toaster } from 'sonner';

interface UserInfo {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface Contribution {
  entity_id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  contributor: UserInfo;
  created_at: string;
  has_conflicts: boolean;
  flag_count: number;
  days_in_review: number;
}

interface ContributionsResponse {
  count: number;
  results: Contribution[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function ConflictsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [conflicts, setConflicts] = useState<Contribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getHeaders = useCallback(() => {
    const token = (session as Record<string, unknown>)?.accessToken as string | undefined;
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }, [session]);

  const fetchConflicts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(
        `${API_BASE}/data/api/review-queue/?queue_type=conflicts`,
        { headers: getHeaders() }
      );
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const data: ContributionsResponse = await res.json();
      setConflicts(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conflicts');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    if (session) fetchConflicts();
  }, [session, fetchConflicts]);

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/curation/review')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Queue
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Scale className="h-7 w-7 text-amber-600" />
              Conflict Resolution
            </h1>
            <p className="text-muted-foreground mt-1">
              Assertions that contradict existing accepted claims — highest priority for review
            </p>
          </div>
          <Button onClick={fetchConflicts} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>

        {/* Conflict explanation card */}
        <Card className="border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-medium">What are conflicts?</p>
                <p className="text-muted-foreground">
                  A conflict occurs when a new submission asserts a value for a property that
                  contradicts an existing accepted assertion. For example, two different construction
                  dates for the same temple. These require careful epistemic judgment — the reviewer
                  must decide whether the new claim refines, supersedes, or genuinely contradicts the
                  existing record.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Conflicts list */}
        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-muted-foreground">Loading conflicts...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchConflicts}>Try Again</Button>
          </div>
        ) : conflicts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Scale className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">No Unresolved Conflicts</h3>
              <p className="text-muted-foreground">
                All assertion conflicts have been resolved. Great work!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {conflicts.map((conflict) => (
              <Card
                key={conflict.entity_id}
                className="border-l-4 border-l-amber-500 hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => router.push(`/dashboard/curation/review/${conflict.entity_id}`)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <Badge variant="secondary" className="capitalize">
                          {conflict.category}
                        </Badge>
                        <span className="font-semibold text-lg">{conflict.name}</span>
                      </div>

                      {conflict.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {conflict.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Submitted by @{conflict.contributor.username}</span>
                        <span>{new Date(conflict.created_at).toLocaleDateString()}</span>
                        <span>{conflict.days_in_review} days in review</span>
                        <Badge variant="destructive" className="text-[10px]">
                          Conflict
                        </Badge>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/dashboard/curation/review/${conflict.entity_id}`);
                      }}
                      className="flex items-center gap-1"
                    >
                      <Eye className="h-4 w-4" />
                      Resolve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
