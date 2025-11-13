'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { User, CheckCircle, Calendar, ArrowLeft, MapPin, Tag, Clock, XCircle, Edit, FileText } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast, Toaster } from 'sonner';

// --- TYPES ---
type Category = 'monument' | 'festival' | 'ritual' | 'tradition' | 'artifact' | 'document' | 'other';
type Status = 'draft' | 'pending_review' | 'accepted' | 'rejected' | 'pending_revision';

interface Contributor {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface Revision {
  revision_id: string;
  revision_number: number;
  data: string;
  created_by: {
    email: string;
    id: number;
  };
  created_at: string;
}

interface CulturalEntity {
  entity_id: string;
  name: string;
  category: Category;
  status: Status;
  contributor: Contributor;
  created_at: string;
  current_revision: Revision | null;
  description?: string;
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
  entity: CulturalEntity;
  commentsCount?: number;
  children: ReactNode;
  currentTab: string;
  onTabChange: (tab: string) => void;
  onRevise: () => void;
  onEdit: () => void;
}

const CATEGORY_OPTIONS = ['monument', 'festival', 'ritual', 'tradition', 'artifact', 'document', 'other'] as const;

function SubmissionLayout({
  entity,
  commentsCount = 0,
  children,
  currentTab,
  onTabChange,
  onRevise,
  onEdit,
}: SubmissionLayoutProps) {
  const router = useRouter();
  const { data: session } = useSession();

  const getStatusVariant = (status: Status) => {
    switch (status) {
      case 'accepted': return 'default';
      case 'pending_review': return 'secondary';
      case 'pending_revision': return 'outline';
      case 'rejected': return 'destructive';
      case 'draft': return 'secondary';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: Status) => {
    switch (status) {
      case 'accepted': return <CheckCircle className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      case 'pending_review': return <Clock className="h-4 w-4" />;
      case 'pending_revision': return <Clock className="h-4 w-4" />;
      case 'draft': return <Clock className="h-4 w-4" />;
      default: return <CheckCircle className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
                  {entity.category}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span>By {entity.contributor.username}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Submitted {formatDate(entity.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons - Always Visible */}
            <div className="flex flex-wrap gap-2">
              {/* Revise Button - Always visible */}
              <Button 
                onClick={onRevise}
                variant="outline"
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Revise
              </Button>
              
              {/* Edit Button - Always visible */}
              <Button 
                onClick={onEdit}
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {entity.description && (
          <CardContent className="pt-0">
            <CardDescription className="text-base leading-relaxed">
              {entity.description}
            </CardDescription>
          </CardContent>
        )}
      </Card>

      {/* Mobile View Selector */}
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

      {/* Tabs */}
      <Tabs value={currentTab} onValueChange={onTabChange} className="hidden @4xl/main:block">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="details">Entity Details</TabsTrigger>
          <TabsTrigger value="revisions">
            Revisions {entity.current_revision && `(${entity.current_revision.revision_number})`}
          </TabsTrigger>
          <TabsTrigger value="comments">
            Comments <Badge variant="secondary" className="ml-2">{commentsCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Page Content */}
      <div>{children}</div>
    </div>
  );
}

export default function CulturalEntityPage() {
  // Use submission_id to match your folder structure
  const params = useParams<{ submission_id: string }>();
  const submissionId = params?.submission_id;
  const [entity, setEntity] = useState<CulturalEntity | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [currentTab, setCurrentTab] = useState('details');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { data: session } = useSession();
  const router = useRouter();

  const API_BASE = "http://0.0.0.0:8000/data/api/cultural-entities";
  
  useEffect(() => {
    if (!submissionId) return;

    const fetchEntity = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log('Fetching entity with ID:', submissionId);
        
        const token = (session as any)?.accessToken;
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const res = await fetch(`${API_BASE}/${submissionId}/`, {
          headers
        });
        
        if (!res.ok) {
          throw new Error(`Failed to fetch entity: ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        
        console.log('Fetched entity data:', data);
        setEntity(data);
      } catch (err) {
        console.error('Error fetching entity:', err);
        setError(err instanceof Error ? err.message : 'Failed to load entity');
      } finally {
        setIsLoading(false);
      }
    };

    const fetchComments = async () => {
      // TODO: Replace with actual comments API endpoint when available
      try {
        // Mock comments for now
        const mockComments: Comment[] = [
          {
            id: 1,
            author: 'reviewer1',
            content: 'This submission looks good, but could use more historical context.',
            timestamp: new Date().toISOString(),
            votes: 2,
          },
          {
            id: 2,
            author: 'expert_user',
            content: 'The geographical information appears to be accurate based on my knowledge.',
            timestamp: new Date().toISOString(),
            votes: 5,
          }
        ];
        setComments(mockComments);
      } catch (err) {
        console.error('Error fetching comments:', err);
      }
    };

    fetchEntity();
    fetchComments();
  }, [submissionId, API_BASE, session]);

  // Handle Revise action - Redirect to revise page with entity data
  const handleRevise = () => {
    if (!entity) {
      toast.error('Entity data not loaded');
      return;
    }

    if (!session) {
      toast.error('You must be logged in to revise entities');
      return;
    }

    // Encode entity data as URL parameter for revise mode
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

  // Handle Edit action - Redirect to edit page with entity data
  const handleEdit = () => {
    if (!entity) {
      toast.error('Entity data not loaded');
      return;
    }

    if (!session) {
      toast.error('You must be logged in to edit entities');
      return;
    }

    // Check if current user is the contributor
    const currentUserEmail = session?.user?.email;
    if (currentUserEmail !== entity.contributor.email) {
      toast.error('You can only edit your own submissions');
      return;
    }

    // Check if entity status allows editing
    if (entity.status !== 'draft' && entity.status !== 'pending_revision') {
      toast.error(`Cannot edit entity with status: ${entity.status}. Only draft and pending_revision entities can be edited.`);
      return;
    }

    // Encode entity data as URL parameter for edit mode
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
    
    try {
      return JSON.parse(entity.current_revision.data);
    } catch (err) {
      console.error('Error parsing revision data:', err);
      return {};
    }
  };

  const formatFieldName = (key: string): string => {
    return key.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const renderEntityDetails = () => {
    if (!entity) return null;

    const revisionData = getRevisionData();
    const basicFields = {
      'Entity ID': entity.entity_id,
      'Category': entity.category,
      'Status': entity.status,
      'Contributor': entity.contributor.username,
      'Email': entity.contributor.email,
      'Full Name': `${entity.contributor.first_name} ${entity.contributor.last_name}`,
      'Submitted': new Date(entity.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      'Description': entity.description || revisionData.description || 'No description provided'
    };

    return (
      <div className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {Object.entries(basicFields).map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell className="font-medium w-1/3">
                      {formatFieldName(key)}
                    </TableCell>
                    <TableCell className="whitespace-pre-wrap">
                      {value?.toString() || 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Additional Data from Revision */}
        {revisionData && Object.keys(revisionData).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
              <CardDescription>
                Data from the current revision
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableBody>
                    {Object.entries(revisionData)
                      .filter(([key]) => !['description'].includes(key)) // Skip already shown fields
                      .map(([key, value]) => (
                        <TableRow key={key}>
                          <TableCell className="font-medium w-1/3">
                            {formatFieldName(key)}
                          </TableCell>
                          <TableCell className="whitespace-pre-wrap">
                            {typeof value === 'object' && value !== null
                              ? JSON.stringify(value, null, 2)
                              : value?.toString() || 'N/A'
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {(!revisionData || Object.keys(revisionData).length === 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">No additional revision data available.</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderRevisions = () => {
    if (!entity) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle>Revision History</CardTitle>
        </CardHeader>
        <CardContent>
          {entity.current_revision ? (
            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold">Revision {entity.current_revision.revision_number}</h4>
                    <p className="text-sm text-muted-foreground">
                      Created by {entity.current_revision.created_by.email}
                    </p>
                  </div>
                  <Badge variant="default">Current</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {new Date(entity.current_revision.created_at).toLocaleString()}
                </p>
                <div className="text-sm bg-muted p-3 rounded-md">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(getRevisionData(), null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No revisions available.</p>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderComments = () => {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Comments & Discussion</CardTitle>
          <CardDescription>
            Feedback and discussions about this cultural entity
          </CardDescription>
        </CardHeader>
        <CardContent>
          {comments.length > 0 ? (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-semibold">{comment.author}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(comment.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <p className="text-sm mb-2">{comment.content}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{comment.votes} votes</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No comments yet.</p>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderActivity = () => {
    if (!entity) return null;

    const activities = [
      {
        action: 'Created',
        by: entity.contributor.username,
        timestamp: entity.created_at,
        description: 'Cultural entity was created'
      },
      ...(entity.current_revision ? [{
        action: 'Revised',
        by: entity.current_revision.created_by.email,
        timestamp: entity.current_revision.created_at,
        description: `Revision ${entity.current_revision.revision_number} was created`
      }] : [])
    ];

    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activities.map((activity, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  {index < activities.length - 1 && (
                    <div className="w-0.5 h-full bg-border"></div>
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex justify-between items-start">
                    <div className="font-semibold">{activity.action}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(activity.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{activity.description}</p>
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
      case 'details':
        return renderEntityDetails();
      case 'revisions':
        return renderRevisions();
      case 'comments':
        return renderComments();
      case 'activity':
        return renderActivity();
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-2 text-muted-foreground">Loading cultural entity...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="text-destructive text-lg mb-2">Error</div>
          <p className="text-muted-foreground">{error}</p>
          <div className="mt-4 space-x-2">
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.history.back()}
            >
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="text-lg mb-2">Cultural Entity Not Found</div>
          <p className="text-muted-foreground">The requested cultural entity could not be found.</p>
          <Button 
            onClick={() => window.history.back()}
            className="mt-4"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" richColors />
      <SubmissionLayout
        entity={entity}
        commentsCount={comments.length}
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