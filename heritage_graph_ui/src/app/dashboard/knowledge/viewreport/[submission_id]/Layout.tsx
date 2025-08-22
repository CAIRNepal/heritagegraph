'use client';

import { ReactNode, useMemo, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ----------------------
// Types
// ----------------------
interface SubmissionLayoutProps {
  submissionId: string;
  commentsCount?: number;
  children: ReactNode;
}

interface Submission {
  submission_id: string;
  title: string;
  description: string;
  contributor_username: string;
  status: string;
}

// ----------------------
// Component
// ----------------------
export default function SubmissionLayout({
  submissionId,
  commentsCount = 0,
  children,
}: SubmissionLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine current tab from path
  const currentTab = useMemo(() => {
    if (pathname?.endsWith('/comments')) return 'comments';
    if (pathname?.endsWith('/revisions')) return 'revisions';
    if (pathname?.endsWith('/flags')) return 'flags';
    if (pathname?.endsWith('/activity')) return 'activity';
    return 'outline';
  }, [pathname]);

  // Fetch submission data once
  useEffect(() => {
    const controller = new AbortController();
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

    async function fetchSubmission() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/data/submissions/${submissionId}/`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Failed to fetch submission: ${res.statusText}`);
        const data: Submission = await res.json();
        setSubmission(data);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message);
          console.error(err);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchSubmission();
    return () => controller.abort();
  }, [submissionId]);

  // Handlers for smooth tab navigation
  const handleTabChange = (tab: string) => {
    router.push(
      `/dashboard/knowledge/viewreport/${submissionId}${tab === 'outline' ? '' : `/${tab}`}`,
    );
  };

  // ----------------------
  // Loading & Error States
  // ----------------------
  if (loading) {
    return <p className="text-gray-500 animate-pulse">Loading submission...</p>;
  }

  if (error) {
    return (
      <Card className="border-red-500 bg-red-50 text-red-800">
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error}</p>
          <button
            onClick={() => router.refresh()}
            className="mt-2 rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
          >
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  if (!submission) return null;

  // ----------------------
  // Render
  // ----------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900">
            {submission.title}
          </CardTitle>
          <p className="text-sm text-gray-500">
            <span className="font-medium">ID:</span> {submission.submission_id} |{' '}
            <span className="font-medium">Contributor:</span>{' '}
            {submission.contributor_username} |{' '}
            <span className="font-medium">Status:</span> {submission.status}
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700">{submission.description}</p>
        </CardContent>
      </Card>

      {/* Mobile View Selector */}
      <Select defaultValue={currentTab} onValueChange={handleTabChange}>
        <SelectTrigger className="flex w-fit @4xl/main:hidden" id="view-selector">
          <SelectValue placeholder="Select a view" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="outline">Outline</SelectItem>
          <SelectItem value="comments">Comments</SelectItem>
          <SelectItem value="revisions">Revisions</SelectItem>
          <SelectItem value="flags">Flags</SelectItem>
          <SelectItem value="activity">Activity</SelectItem>
        </SelectContent>
      </Select>

      {/* Tabs */}
      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="outline">Summary</TabsTrigger>
          <TabsTrigger value="comments">
            Comments <Badge variant="secondary">{commentsCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="revisions">Revisions</TabsTrigger>
          <TabsTrigger value="flags">Flags</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Page Content */}
      <div>{children}</div>
    </div>
  );
}
