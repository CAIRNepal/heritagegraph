'use client';

import { useState, useEffect } from 'react';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CommentSection from '@/components/heritage-commenting';
import SubmissionLayout from './Layout';

interface Submission {
  [key: string]: any;
}

interface Comment {
  id: number;
  author: string;
  content: string;
  timestamp: string;
  votes: number;
  replies?: Comment[];
}

const SHOWN_KEYS = [
  'submission_id',
  'title',
  'description',
  'contributor_username',
  'status',
  'created_at',
  'Activity',
  'Monument_name',
  'Monument_type',
  'Province_number',
];

export default function SubmissionPage({
  params,
}: {
  params: { submission_id: string };
}) {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);

  useEffect(() => {
    fetch(`http://localhost:8000/data/submissions/${params.submission_id}/`)
      .then((res) => res.json())
      .then(setSubmission)
      .catch(console.error);

    fetch(`http://localhost:8000/data/submissions/${params.submission_id}/comments/`)
      .then((res) => res.json())
      .then((data) => {
        const transformedComments = data.map((comment: any) => ({
          id: comment.id,
          author: comment.author || 'Anonymous',
          content: comment.text,
          timestamp: comment.timestamp || new Date().toLocaleString(),
          votes: comment.votes || 0,
          replies: comment.replies || [],
        }));
        setComments(transformedComments);
      })
      .catch(console.error);
  }, [params.submission_id]);

  if (!submission)
    return <div className="p-6 text-center text-gray-500">Loading submission...</div>;

  const remainingFields = Object.entries(submission).filter(
    ([key, value]) => !SHOWN_KEYS.includes(key) && value && value !== 'N/A',
  );

  return (
    <SubmissionLayout
      submissionId={params.submission_id}
      commentsCount={comments.length}
    >
      {/* Header Card */}
      {/* <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900">{submission.title}</CardTitle>
          <p className="text-sm text-gray-500">
            <span className="font-medium">ID:</span> {submission.submission_id} |{" "}
            <span className="font-medium">Contributor:</span> {submission.contributor_username} |{" "}
            <span className="font-medium">Status:</span> {submission.status}
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700">{submission.description}</p>
        </CardContent>
      </Card> */}

      {/* Metadata Table */}
      {remainingFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Additional Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3">Field</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {remainingFields.map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell className="font-medium capitalize">
                        {key.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell>{value.toString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Comments Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Comments</CardTitle>
        </CardHeader>
        <CardContent>
          <CommentSection comments={comments} setComments={setComments} />
        </CardContent>
      </Card>
    </SubmissionLayout>
  );
}
