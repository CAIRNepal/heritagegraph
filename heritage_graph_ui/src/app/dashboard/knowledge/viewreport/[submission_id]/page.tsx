'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect, ReactNode } from 'react';
import { User, CheckCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
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
// import CommentSection from '@/components/heritage-commenting';

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
  submission: Submission;
  commentsCount?: number;
  children: ReactNode;
  currentTab: string;
  onTabChange: (tab: string) => void;
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
  submission,
  commentsCount = 0,
  children,
  currentTab,
  onTabChange,
}: SubmissionLayoutProps) {
  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      console.log('Tab reordered from', active.id, 'to', over.id);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle>{submission.title}</CardTitle>
          <p>
            <Badge>
              <User size={14} className="inline mr-1" />
              {submission.contributor_username}
            </Badge>{' '}
            <CheckCircle size={14} className="inline mr-1" /> {submission.status}
          </p>
        </CardHeader>
        <CardContent>
          <p>{submission.description}</p>
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

export default function SubmissionPage() {
  const params = useParams<{ submission_id: string }>();
  const submissionId = params?.submission_id;
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [currentTab, setCurrentTab] = useState('outline');

  const API_BASE =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/data/submissions';

  useEffect(() => {
    if (!submissionId) return;

    const fetchSubmission = async () => {
      try {
        const res = await fetch(`${API_BASE}/${submissionId}/`);
        if (!res.ok) throw new Error(`Failed to fetch submission: ${res.status}`);
        const data = await res.json();
        setSubmission(data);
      } catch (err) {
        console.error(err);
      }
    };

    const fetchComments = async () => {
      try {
        const res = await fetch(`${API_BASE}/${submissionId}/comments/`);
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
  }, [submissionId, API_BASE]);

  if (!submission) {
    return <div className="p-6 text-center text-gray-500">Loading submission...</div>;
  }

  const remainingFields = Object.entries(submission).filter(
    ([key, value]) => !SHOWN_KEYS.includes(key) && value && value !== 'N/A',
  );

  const renderTabContent = () => {
    switch (currentTab) {
      case 'outline':
        return (
          <>
            {remainingFields.length > 0 && (
              <div className="flex flex-col md:flex-row gap-4">
                <Card className="flex-1 md:w-3/4">
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
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
                <Card className="flex-1">
                  <CardContent>
                    {/* <CommentSection comments={comments} setComments={setComments} /> */}
                  </CardContent>
                </Card>
              </div>
            )}
            <Separator /> <Separator />
          </>
        );
      case 'comments':
        return (
          <Card>
            <CardContent>
              {/* <CommentSection comments={comments} setComments={setComments} /> */}
            </CardContent>
          </Card>
        );
      case 'revisions':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Revisions</CardTitle>
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
              <CardTitle>Flags</CardTitle>
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
              <CardTitle>Activity</CardTitle>
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
      submission={submission}
      commentsCount={comments.length}
      currentTab={currentTab}
      onTabChange={setCurrentTab}
    >
      {renderTabContent()}
    </SubmissionLayout>
  );
}
