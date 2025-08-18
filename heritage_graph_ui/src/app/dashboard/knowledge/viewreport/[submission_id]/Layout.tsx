'use client';

import { ReactNode, useMemo, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
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
import Link from 'next/link';

interface SubmissionLayoutProps {
  submissionId: string;
  submission: Submission;
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

interface Comment {
  id: string;
  content: string;
  author: string;
}

export default function SubmissionLayout({
  submissionId,
  commentsCount = 0,
  children,
}: SubmissionLayoutProps) {
  const pathname = usePathname();
  const [submission, setSubmission] = useState<Submission | null>(null);

  // Determine current tab based on URL
  const currentTab = useMemo(() => {
    if (pathname?.endsWith('/comments')) return 'comments';
    if (pathname?.endsWith('/revisions')) return 'revisions';
    if (pathname?.endsWith('/flags')) return 'flags';
    if (pathname?.endsWith('/activity')) return 'activity';
    return 'outline'; // default
  }, [pathname]);

  // Fetch submission data
  useEffect(() => {
    fetch(`http://localhost:8000/data/submissions/${submissionId}/`)
      .then((res) => res.json())
      .then(setSubmission)
      .catch(console.error);
  }, [submissionId]);

  if (!submission) return <p>Loading submission...</p>;

  return (
    <div className="space-y-6">
      {/* Header Card */}
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

      {/* View Selector */}
      <Select defaultValue="outline">
        <SelectTrigger className="flex w-fit @4xl/main:hidden" id="view-selector">
          <SelectValue placeholder="Select a view" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="outline">Outline</SelectItem>
          <SelectItem value="past-performance">Under Review</SelectItem>
          <SelectItem value="key-personnel">Reviewed</SelectItem>
          <SelectItem value="focus-documents">Accepted</SelectItem>
        </SelectContent>
      </Select>

      {/* Tabs */}
      <Tabs value={currentTab}>
        <TabsList>
          <TabsTrigger value="outline">
            <Link href={`/dashboard/knowledge/viewreport/${submissionId}`}>
              Summary
            </Link>
          </TabsTrigger>
          <TabsTrigger value="comments">
            <Link href={`/dashboard/knowledge/viewreport/${submissionId}/comments`}>
              Comments <Badge variant="secondary">{commentsCount}</Badge>
            </Link>
          </TabsTrigger>
          <TabsTrigger value="revisions">
            <Link href={`/dashboard/knowledge/viewreport/${submissionId}/revisions`}>
              Revisions
            </Link>
          </TabsTrigger>
          <TabsTrigger value="flags">
            <Link href={`/dashboard/knowledge/viewreport/${submissionId}/flags`}>
              Flags
            </Link>
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Link href={`/dashboard/knowledge/viewreport/${submissionId}/activity`}>
              Activity
            </Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Page Content */}
      <div>{children}</div>
    </div>
  );
}
