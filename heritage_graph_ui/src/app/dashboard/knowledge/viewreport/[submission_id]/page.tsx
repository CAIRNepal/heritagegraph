'use client';

import { useState, useEffect, useMemo, ReactNode } from 'react';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import CommentSection from '@/components/heritage-commenting';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

interface Submission {
  submission_id: string;
  title: string;
  description: string;
  contributor_username: string;
  status: string;
  created_at: string;
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

interface SubmissionLayoutProps {
  submissionId: string;
  submission: Submission;
  commentsCount?: number;
  children: ReactNode;
  currentTab: string;
  onTabChange: (tab: string) => void;
}

interface PageProps {
  params: {
    submission_id: string;
  };
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

function SubmissionLayout({
  submissionId,
  submission,
  commentsCount = 0,
  children,
  currentTab,
  onTabChange,
}: SubmissionLayoutProps) {
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {}),
  );

  // Drag end handler for reordering tabs
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      // Handle tab reordering logic here
      console.log('Tab reordered from', active.id, 'to', over.id);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">{submission.title}</CardTitle>
          <p className="text-sm text-gray-400">
            <span className="font-medium">ID:</span> {submission.submission_id} |{' '}
            <span className="font-medium">Contributor:</span>{' '}
            {submission.contributor_username} |{' '}
            <span className="font-medium">Status:</span> {submission.status}
          </p>
        </CardHeader>
        <CardContent>
          <p className="">{submission.description}</p>
        </CardContent>
      </Card>

      {/* Mobile View Selector */}
      <Select value={currentTab} onValueChange={onTabChange}>
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

      {/* Tabs with drag and drop */}
      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        sensors={sensors}
      >
        <Tabs value={currentTab} onValueChange={onTabChange}>
          <SortableContext
            items={['outline', 'comments', 'revisions', 'flags', 'activity']}
            strategy={verticalListSortingStrategy}
          >
            <TabsList>
              <TabsTrigger value="outline">Summary</TabsTrigger>
              <TabsTrigger value="comments">
                Comments <Badge variant="secondary">{commentsCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="revisions">Revisions</TabsTrigger>
              <TabsTrigger value="flags">Flags</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
          </SortableContext>
        </Tabs>
      </DndContext>

      {/* Page Content */}
      <div>{children}</div>
    </div>
  );
}

export default function SubmissionPage({ params }: PageProps) {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [currentTab, setCurrentTab] = useState('outline');
  const API_BASE =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/data/submissions';

  useEffect(() => {
    const fetchSubmission = async () => {
      try {
        const res = await fetch(`${API_BASE}/${params.submission_id}/`);
        if (!res.ok) throw new Error(`Failed to fetch submission: ${res.status}`);
        const data = await res.json();
        setSubmission(data);
      } catch (err) {
        console.error(err);
      }
    };

    const fetchComments = async () => {
      try {
        const res = await fetch(`${API_BASE}/${params.submission_id}/comments/`);
        if (!res.ok) throw new Error(`Failed to fetch comments: ${res.status}`);
        const data = await res.json();
        const transformed = data.map((comment: any) => ({
          id: comment.id,
          author: comment.author || 'Anonymous',
          content: comment.text,
          timestamp: comment.timestamp || new Date().toLocaleString(),
          votes: comment.votes || 0,
          replies: comment.replies || [],
        }));
        setComments(transformed);
      } catch (err) {
        console.error(err);
      }
    };

    fetchSubmission();
    fetchComments();
  }, [params.submission_id, API_BASE]);

  if (!submission) {
    return <div className="p-6 text-center text-gray-500">Loading submission...</div>;
  }

  const remainingFields = Object.entries(submission).filter(
    ([key, value]) => !SHOWN_KEYS.includes(key) && value && value !== 'N/A',
  );

  // Render different content based on the current tab
  const renderTabContent = () => {
    switch (currentTab) {
      case 'outline':
        return (
          <>
            {/* Metadata Table */}
            {remainingFields.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">
                    Additional Details
                  </CardTitle>
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
                            <TableCell>{value?.toString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
            <Separator />
          </>
        );
      case 'comments':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <CommentSection comments={comments} setComments={setComments} />
            </CardContent>
          </Card>
        );
      case 'revisions':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Revisions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">Revision history will be displayed here.</p>
            </CardContent>
          </Card>
        );
      case 'flags':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Flags</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">Flagged issues will be displayed here.</p>
            </CardContent>
          </Card>
        );
      case 'activity':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">Activity log will be displayed here.</p>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <SubmissionLayout
      submissionId={params.submission_id}
      submission={submission}
      commentsCount={comments.length}
      currentTab={currentTab}
      onTabChange={setCurrentTab}
    >
      {renderTabContent()}
    </SubmissionLayout>
  );
}
