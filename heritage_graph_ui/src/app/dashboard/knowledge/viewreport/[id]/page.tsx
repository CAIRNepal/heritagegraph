'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { User, CheckCircle, Calendar, ArrowLeft, MapPin, Tag, Clock, XCircle, Edit, FileText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast, Toaster } from 'sonner';

function SubmissionLayout({ entity, commentsCount = 0, children, currentTab, onTabChange, onRevise, onEdit }) {
  const router = useRouter();

  const getStatusVariant = (status) => {
    switch (status) {
      case 'accepted': return 'default';
      case 'pending_review': return 'secondary';
      case 'pending_revision': return 'outline';
      case 'rejected': return 'destructive';
      case 'draft': return 'secondary';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'accepted': return <CheckCircle className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      case 'pending_review': return <Clock className="h-4 w-4" />;
      case 'pending_revision': return <Clock className="h-4 w-4" />;
      case 'draft': return <Clock className="h-4 w-4" />;
      default: return <CheckCircle className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getContributorDisplay = (contributor) => {
    if (!contributor) return '';
    const fullName = [contributor.first_name, contributor.last_name].filter(Boolean).join(' ');
    const username = contributor.username || '';
    const email = contributor.email ? ` (${contributor.email})` : '';
    return `${username} ${fullName}${email}`.trim();
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => router.push('/dashboard/knowledge/entity')}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Cultural Entities
      </Button>

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-3 flex-1">
              <CardTitle className="text-2xl md:text-3xl">{entity.name}</CardTitle>

              <div className="flex flex-wrap gap-2">
                <Badge variant={getStatusVariant(entity.status)} className="flex items-center gap-1">
                  {getStatusIcon(entity.status)}
                  {entity.status.replace('_', ' ')}
                </Badge>

                <Badge variant="outline" className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {entity.category || ''}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span>{getContributorDisplay(entity.contributor)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Submitted {formatDate(entity.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={onRevise} variant="outline" className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> Revise
              </Button>
              <Button onClick={onEdit} className="flex items-center gap-2">
                <Edit className="h-4 w-4" /> Edit
              </Button>
            </div>
          </div>
        </CardHeader>

        {entity.description && (
          <CardContent className="pt-0">
            <CardDescription className="text-base leading-relaxed">{entity.description}</CardDescription>
          </CardContent>
        )}
      </Card>

      {/* Tabs / Mobile Select */}
      <div className="@4xl/main:hidden">
        <Select value={currentTab} onValueChange={onTabChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="details">Entity Details</SelectItem>
            <SelectItem value="revisions">Revisions</SelectItem>
            <SelectItem value="comments">Comments</SelectItem>
            <SelectItem value="activity">Activity</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={currentTab} onValueChange={onTabChange} className="hidden @4xl/main:block">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="details">Entity Details</TabsTrigger>
          <TabsTrigger value="revisions">
            Revisions {entity.current_revision ? `(${entity.current_revision.revision_number})` : ''}
          </TabsTrigger>
          <TabsTrigger value="comments">
            Comments <Badge variant="secondary" className="ml-2">{entity.commentsCount || 0}</Badge>
          </TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
      </Tabs>

      <div>{children}</div>
    </div>
  );
}

export default function CulturalEntityPage() {
  const params = useParams();
  const submissionId = params?.id;
  const [entity, setEntity] = useState(null);
  const [comments, setComments] = useState([]);
  const [currentTab, setCurrentTab] = useState('details');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { data: session } = useSession();
  const router = useRouter();
  const API_BASE = "http://0.0.0.0:8000/cidoc/artifacts";

  useEffect(() => {
    if (!submissionId) return;

    const fetchEntity = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const headers = { 'Content-Type': 'application/json' };
        // if (session?.accessToken) headers['Authorization'] = `Bearer ${session.accessToken}`;

        const res = await fetch(`${API_BASE}/1/`, { headers });
        if (!res.ok) throw new Error(`Failed to fetch entity: ${res.statusText}`);
        const data = await res.json();
        setEntity(data);
      } catch (err) {
        setError(err.message || 'Failed to load entity');
      } finally {
        setIsLoading(false);
      }
    };

    const fetchComments = async () => {
      try {
        const mockComments = [
          { id: 1, author: 'reviewer1', content: 'Good submission.', timestamp: new Date().toISOString(), votes: 2 },
          { id: 2, author: 'expert_user', content: 'Geography seems accurate.', timestamp: new Date().toISOString(), votes: 5 }
        ];
        setComments(mockComments);
      } catch {}
    };

    fetchEntity();
    fetchComments();
  }, [submissionId, session]);

  const handleRevise = () => {
    if (!entity) return toast.error('Entity data not loaded');
    if (!session) return toast.error('You must be logged in to revise entities');

    const entityData = encodeURIComponent(JSON.stringify({
      entity_id: entity.entity_id,
      name: entity.name,
      description: entity.description || '',
      category: entity.category,
      current_revision: entity.current_revision,
      status: entity.status
    }));

    router.push(`/dashboard/contribute/entity/revise?entity=${entityData}&mode=revise`);
  };

  const handleEdit = () => {
    if (!entity) return toast.error('Entity data not loaded');
    if (!session) return toast.error('You must be logged in to edit entities');

    const currentUserEmail = session?.user?.email;
    if (currentUserEmail !== entity.contributor?.email) return toast.error('You can only edit your own submissions');
    if (!['draft', 'pending_revision'].includes(entity.status)) {
      return toast.error(`Cannot edit entity with status: ${entity.status}`);
    }

    const entityData = encodeURIComponent(JSON.stringify({
      entity_id: entity.entity_id,
      name: entity.name,
      description: entity.description || '',
      category: entity.category,
      current_revision: entity.current_revision,
      status: entity.status
    }));

    router.push(`/dashboard/contribute/entity/revise?entity=${entityData}&mode=edit`);
  };

  const getRevisionData = () => {
    if (!entity?.current_revision?.data) return {};
    try { return JSON.parse(entity.current_revision.data); } catch { return {}; }
  };

  const formatFieldName = (key) => key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const getFullName = (contributor) => {
    if (!contributor) return '';
    return [contributor.first_name, contributor.last_name].filter(Boolean).join(' ');
  };

  const renderEntityDetails = () => {
    if (!entity) return null;

    const revisionData = getRevisionData();
    const basicFields = {
      'Entity ID': entity.entity_id || '',
      'Category': entity.category || '',
      'Status': entity.status || '',
      'Username': entity.contributor?.username || '',
      'Full Name': getFullName(entity.contributor),
      'Email': entity.contributor?.email || '',
      'Submitted': entity.created_at ? new Date(entity.created_at).toLocaleString() : '',
      'Description': entity.description || revisionData.description || ''
    };

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" /> Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {Object.entries(basicFields).map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell className="font-medium w-1/3">{formatFieldName(key)}</TableCell>
                    <TableCell className="whitespace-pre-wrap">{value || ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {revisionData && Object.keys(revisionData).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
              <CardDescription>Data from the current revision</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableBody>
                    {Object.entries(revisionData)
                      .filter(([key]) => !['description'].includes(key))
                      .map(([key, value]) => (
                        <TableRow key={key}>
                          <TableCell className="font-medium w-1/3">{formatFieldName(key)}</TableCell>
                          <TableCell className="whitespace-pre-wrap">
                            {value ? (typeof value === 'object' ? JSON.stringify(value, null, 2) : value) : ''}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderRevisions = () => {
    if (!entity) return null;
    if (!entity.current_revision) return <p className="text-muted-foreground">No revisions available.</p>;

    const rev = entity.current_revision;
    return (
      <Card>
        <CardHeader><CardTitle>Revision History</CardTitle></CardHeader>
        <CardContent>
          <div className="border rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="font-semibold">Revision {rev.revision_number}</h4>
                <p className="text-sm text-muted-foreground">
                  Created by {rev.created_by?.email || ''}
                </p>
              </div>
              <Badge variant="default">Current</Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-2">{new Date(rev.created_at).toLocaleString()}</p>
            <div className="text-sm bg-muted p-3 rounded-md">
              <pre className="whitespace-pre-wrap">{JSON.stringify(getRevisionData(), null, 2)}</pre>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderComments = () => (
    <Card>
      <CardHeader>
        <CardTitle>Comments & Discussion</CardTitle>
        <CardDescription>Feedback and discussions about this cultural entity</CardDescription>
      </CardHeader>
      <CardContent>
        {comments.length ? comments.map(c => (
          <div key={c.id} className="border rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="font-semibold">{c.author || ''}</div>
              <div className="text-sm text-muted-foreground">{new Date(c.timestamp).toLocaleString()}</div>
            </div>
            <p className="text-sm mb-2">{c.content || ''}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{c.votes || 0} votes</span>
            </div>
          </div>
        )) : <p className="text-muted-foreground">No comments yet.</p>}
      </CardContent>
    </Card>
  );

  const renderActivity = () => {
    if (!entity) return null;

    const activities = [
      { action: 'Created', by: entity.contributor?.username || '', timestamp: entity.created_at, description: 'Cultural entity was created' },
      ...(entity.current_revision ? [{ action: 'Revised', by: entity.current_revision.created_by?.email || '', timestamp: entity.current_revision.created_at, description: `Revision ${entity.current_revision.revision_number} was created` }] : [])
    ];

    return (
      <Card>
        <CardHeader><CardTitle>Activity Log</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activities.map((activity, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  {i < activities.length - 1 && <div className="w-0.5 h-full bg-border"></div>}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex justify-between items-start">
                    <div className="font-semibold">{activity.action}</div>
                    <div className="text-sm text-muted-foreground">{activity.timestamp ? new Date(activity.timestamp).toLocaleString() : ''}</div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{activity.description || ''}</p>
                  <p className="text-sm">By: {activity.by}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderTabContent = () => {
    switch (currentTab) {
      case 'details': return renderEntityDetails();
      case 'revisions': return renderRevisions();
      case 'comments': return renderComments();
      case 'activity': return renderActivity();
      default: return null;
    }
  };

  if (isLoading) return <div className="flex items-center justify-center min-h-96"><p>Loading cultural entity...</p></div>;
  if (error) return <div className="text-destructive">{error}</div>;
  if (!entity) return <div>Cultural Entity Not Found</div>;

  return (
    <>
      <Toaster position="top-right" richColors />
      <SubmissionLayout
        entity={{ ...entity, commentsCount: comments.length }}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        onRevise={handleRevise}
        onEdit={handleEdit}
      >
        {renderTabContent()}
      </SubmissionLayout>
    </>
  );
}
