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
    if (!dateString) return 'Unknown date';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getContributorDisplay = (contributor) => {
    if (!contributor) return 'System User';
    const fullName = [contributor.first_name, contributor.last_name].filter(Boolean).join(' ');
    const username = contributor.username || '';
    const email = contributor.email ? ` (${contributor.email})` : '';
    return `${username} ${fullName}${email}`.trim() || 'System User';
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
              <CardTitle className="text-2xl md:text-3xl">{entity.name || 'Unnamed Tradition'}</CardTitle>

              <div className="flex flex-wrap gap-2">
                <Badge variant={getStatusVariant(entity.status)} className="flex items-center gap-1">
                  {getStatusIcon(entity.status)}
                  {(entity.status || 'accepted').replace('_', ' ')}
                </Badge>

                <Badge variant="outline" className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {entity.type || 'Tradition'}
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
            <SelectItem value="details">Tradition Details</SelectItem>
            <SelectItem value="revisions">Revisions</SelectItem>
            <SelectItem value="comments">Comments</SelectItem>
            <SelectItem value="activity">Activity</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={currentTab} onValueChange={onTabChange} className="hidden @4xl/main:block">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="details">Tradition Details</TabsTrigger>
          <TabsTrigger value="revisions">
            Revisions
          </TabsTrigger>
          <TabsTrigger value="comments">
            Comments <Badge variant="secondary" className="ml-2">{commentsCount}</Badge>
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
  
  // Updated API endpoint for traditions
  const API_BASE = "http://0.0.0.0:8000/cidoc/traditions";

  useEffect(() => {
    if (!submissionId) return;

    const fetchEntity = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const headers = { 'Content-Type': 'application/json' };
        // if (session?.accessToken) headers['Authorization'] = `Bearer ${session.accessToken}`;

        const res = await fetch(`${API_BASE}/${submissionId}/`, { headers });
        if (!res.ok) throw new Error(`Failed to fetch tradition: ${res.statusText}`);
        const data = await res.json();
        
        // Transform API data to match expected frontend structure
        const transformedEntity = {
          ...data,
          entity_id: data.id,
          status: 'accepted', // Default status
          category: data.type || 'Tradition',
          created_at: new Date().toISOString(), // Default timestamp
          contributor: {
            username: 'system',
            first_name: 'System',
            last_name: 'User',
            email: 'system@example.com'
          }
        };
        
        setEntity(transformedEntity);
      } catch (err) {
        setError(err.message || 'Failed to load tradition');
        console.error('Error fetching tradition:', err);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchComments = async () => {
      try {
        const mockComments = [
          { id: 1, author: 'reviewer1', content: 'Important cultural tradition.', timestamp: new Date().toISOString(), votes: 2 },
          { id: 2, author: 'cultural_expert', content: 'Well documented historical practice.', timestamp: new Date().toISOString(), votes: 5 }
        ];
        setComments(mockComments);
      } catch (err) {
        console.error('Error fetching comments:', err);
      }
    };

    fetchEntity();
    fetchComments();
  }, [submissionId, session]);

  const handleRevise = () => {
    if (!entity) return toast.error('Tradition data not loaded');
    if (!session) return toast.error('You must be logged in to revise traditions');

    const entityData = encodeURIComponent(JSON.stringify({
      entity_id: entity.entity_id,
      name: entity.name,
      description: entity.description || '',
      type: entity.type,
      associated_materials: entity.associated_materials,
      practitioners: entity.practitioners,
      artifacts_used: entity.artifacts_used,
      associated_events: entity.associated_events,
      documentation_sources: entity.documentation_sources,
      status: entity.status
    }));

    router.push(`/dashboard/contribute/entity/revise?entity=${entityData}&mode=revise`);
  };

  const handleEdit = () => {
    if (!entity) return toast.error('Tradition data not loaded');
    if (!session) return toast.error('You must be logged in to edit traditions');

    // For now, allow editing any tradition since we don't have proper user matching
    const entityData = encodeURIComponent(JSON.stringify({
      entity_id: entity.entity_id,
      name: entity.name,
      description: entity.description || '',
      type: entity.type,
      associated_materials: entity.associated_materials,
      practitioners: entity.practitioners,
      artifacts_used: entity.artifacts_used,
      associated_events: entity.associated_events,
      documentation_sources: entity.documentation_sources,
      status: entity.status
    }));

    router.push(`/dashboard/contribute/entity/revise?entity=${entityData}&mode=edit`);
  };

  const formatFieldName = (key) => {
    return key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const formatArrayValue = (value) => {
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : 'None';
    }
    return value || 'Not specified';
  };

  const getFullName = (contributor) => {
    if (!contributor) return '';
    return [contributor.first_name, contributor.last_name].filter(Boolean).join(' ');
  };

  const renderEntityDetails = () => {
    if (!entity) return null;

    const basicFields = {
      'Tradition ID': entity.entity_id || '',
      'Type': entity.type || '',
      'Status': entity.status || '',
      'Description': entity.description || '',
      'Associated Materials': entity.associated_materials || '',
      'Practitioners': formatArrayValue(entity.practitioners),
      'Artifacts Used': formatArrayValue(entity.artifacts_used),
      'Associated Events': formatArrayValue(entity.associated_events),
      'Documentation Sources': formatArrayValue(entity.documentation_sources),
      'Username': entity.contributor?.username || '',
      'Full Name': getFullName(entity.contributor),
      'Email': entity.contributor?.email || '',
      'Submitted': entity.created_at ? new Date(entity.created_at).toLocaleString() : ''
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
                    <TableCell className="whitespace-pre-wrap">{formatArrayValue(value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderRevisions = () => {
    return (
      <Card>
        <CardHeader><CardTitle>Revision History</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No revision history available for this tradition.</p>
        </CardContent>
      </Card>
    );
  };

  const renderComments = () => (
    <Card>
      <CardHeader>
        <CardTitle>Comments & Discussion</CardTitle>
        <CardDescription>Feedback and discussions about this tradition</CardDescription>
      </CardHeader>
      <CardContent>
        {comments.length > 0 ? comments.map(c => (
          <div key={c.id} className="border rounded-lg p-4 mb-4">
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
      { action: 'Created', by: getFullName(entity.contributor) || 'System User', timestamp: entity.created_at, description: 'Tradition was created' }
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
                    <div className="text-sm text-muted-foreground">
                      {activity.timestamp ? new Date(activity.timestamp).toLocaleString() : 'Unknown date'}
                    </div>
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

  if (isLoading) return <div className="flex items-center justify-center min-h-96"><p>Loading tradition...</p></div>;
  if (error) return <div className="text-destructive p-4">Error: {error}</div>;
  if (!entity) return <div className="p-4">Tradition Not Found</div>;

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