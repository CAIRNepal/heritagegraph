'use client';

import { useEffect, useState } from 'react';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Submission {
  [key: string]: any;
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

  useEffect(() => {
    fetch(`http://localhost:8000/data/submissions/${params.submission_id}/`)
      .then((res) => res.json())
      .then(setSubmission)
      .catch(console.error);
  }, [params.submission_id]);

  if (!submission) return <p>Loading...</p>;

  const remainingFields = Object.entries(submission).filter(
    ([key, value]) =>
      !SHOWN_KEYS.includes(key) &&
      value !== null &&
      value !== undefined &&
      value !== 'N/A' &&
      value !== '',
  );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Main card */}
      <Card>
        <CardHeader>
          <CardTitle>{submission.title}</CardTitle>
          <CardDescription>
            Submission ID: {submission.submission_id} | Contributor:{' '}
            {submission.contributor_username} | Status: {submission.status}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{submission.description}</p>
          {submission.Monument_name && (
            <div>
              <h3 className="font-medium">Monument Name</h3>
              <p>{submission.Monument_name}</p>
            </div>
          )}
          {submission.Activity && (
            <div>
              <h3 className="font-medium">Activity</h3>
              <p>{submission.Activity}</p>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline">Edit / View More</Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Remaining fields in table format */}
      {remainingFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Other Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {remainingFields.map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell className="font-medium">
                      {key.replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell>{value.toString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
