'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { User, Calendar, ArrowLeft, FileText, ExternalLink, BookOpen, Archive, Globe } from 'lucide-react';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast, Toaster } from 'sonner';

function SourceLayout({ source, commentsCount = 0, children, currentTab, onTabChange }) {
  const router = useRouter();

  const getTypeVariant = (type) => {
    switch (type?.toLowerCase()) {
      case 'journal': return 'default';
      case 'book': return 'secondary';
      case 'archive': return 'outline';
      case 'digital': return 'destructive';
      default: return 'outline';
    }
  };

  const getTypeIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'journal': return <FileText className="h-4 w-4" />;
      case 'book': return <BookOpen className="h-4 w-4" />;
      case 'archive': return <Archive className="h-4 w-4" />;
      case 'digital': return <Globe className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => router.push('/dashboard/knowledge/source')}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Sources
      </Button>

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-3 flex-1">
              <CardTitle className="text-2xl md:text-3xl">{source.title}</CardTitle>

              <div className="flex flex-wrap gap-2">
                <Badge variant={getTypeVariant(source.type)} className="flex items-center gap-1">
                  {getTypeIcon(source.type)}
                  {source.type}
                </Badge>

                <Badge variant="outline" className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {source.publication_year}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span>By {source.authors}</span>
                </div>
                {source.digital_link && (
                  <div className="flex items-center gap-1">
                    <ExternalLink className="h-4 w-4" />
                    <a 
                      href={source.digital_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      Digital Source
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                className="flex items-center gap-2"
                onClick={() => window.open(source.digital_link, '_blank')}
                disabled={!source.digital_link}
              >
                <ExternalLink className="h-4 w-4" /> View Source
              </Button>
            </div>
          </div>
        </CardHeader>

        {source.archive_location && (
          <CardContent className="pt-0">
            <CardDescription className="text-base leading-relaxed">
              <strong>Archive Location:</strong> {source.archive_location}
            </CardDescription>
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
            <SelectItem value="details">Source Details</SelectItem>
            <SelectItem value="metadata">Metadata</SelectItem>
            <SelectItem value="comments">Comments</SelectItem>
            <SelectItem value="related">Related Content</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={currentTab} onValueChange={onTabChange} className="hidden @4xl/main:block">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="details">Source Details</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          <TabsTrigger value="comments">
            Comments <Badge variant="secondary" className="ml-2">{commentsCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="related">Related Content</TabsTrigger>
        </TabsList>
      </Tabs>

      <div>{children}</div>
    </div>
  );
}

export default function SourceDetailPage() {
  const params = useParams();
  const sourceId = params?.id;
  const [source, setSource] = useState(null);
  const [comments, setComments] = useState([]);
  const [relatedContent, setRelatedContent] = useState([]);
  const [currentTab, setCurrentTab] = useState('details');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { data: session } = useSession();
  const router = useRouter();
  
  const API_BASE = "http://0.0.0.0:8000/cidoc/sources";

  useEffect(() => {
    if (!sourceId) return;

    const fetchSource = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const headers = { 
          'Content-Type': 'application/json',
          'accept': 'application/json'
        };

        const res = await fetch(`${API_BASE}/${sourceId}/`, { headers });
        if (!res.ok) throw new Error(`Failed to fetch source: ${res.status} ${res.statusText}`);
        const data = await res.json();
        setSource(data);
      } catch (err) {
        setError(err.message || 'Failed to load source');
        console.error('Error fetching source:', err);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchComments = async () => {
      try {
        // Mock comments for now - replace with actual API call when available
        const mockComments = [
          { id: 1, author: 'researcher1', content: 'Very comprehensive study on Nepalese history.', timestamp: new Date().toISOString(), votes: 3 },
          { id: 2, author: 'historian', content: 'Excellent primary source material.', timestamp: new Date().toISOString(), votes: 5 }
        ];
        setComments(mockComments);
      } catch (err) {
        console.error('Error fetching comments:', err);
      }
    };

    const fetchRelatedContent = async () => {
      try {
        // Mock related content - replace with actual API call when available
        const mockRelated = [
          { id: 1, title: 'Nepal Unification History', type: 'book', relation: 'similar_topic' },
          { id: 2, title: 'Shah Dynasty Archives', type: 'archive', relation: 'historical_context' }
        ];
        setRelatedContent(mockRelated);
      } catch (err) {
        console.error('Error fetching related content:', err);
      }
    };

    fetchSource();
    fetchComments();
    fetchRelatedContent();
  }, [sourceId]);

  const formatFieldName = (key) => {
    return key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const formatArrayValue = (value) => {
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : 'None';
    }
    return value || 'Not specified';
  };

  const renderSourceDetails = () => {
    if (!source) return null;

    const basicFields = {
      'Source ID': source.id || '',
      'Title': source.title || '',
      'Authors': source.authors || '',
      'Publication Year': source.publication_year || '',
      'Type': source.type || '',
      'Digital Link': source.digital_link || '',
      'Archive Location': source.archive_location || '',
      'Documented Persons': formatArrayValue(source.documented_persons)
    };

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Source Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {Object.entries(basicFields).map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell className="font-medium w-1/3">{formatFieldName(key)}</TableCell>
                    <TableCell className="whitespace-pre-wrap">
                      {key === 'Digital Link' && value !== 'Not specified' ? (
                        <a 
                          href={value} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Access Digital Source
                        </a>
                      ) : (
                        value
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {source.description && (
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">{source.description}</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderMetadata = () => {
    if (!source) return null;

    const metadataFields = {
      'ID': source.id,
      'Created Date': source.created_date || 'Not available',
      'Last Modified': source.last_modified || 'Not available',
      'Citation Format': source.citation_format || 'Not specified',
      'Language': source.language || 'Not specified',
      'Pages': source.pages || 'Not specified',
      'ISBN/ISSN': source.isbn_issn || 'Not specified',
      'Publisher': source.publisher || 'Not specified'
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle>Technical Metadata</CardTitle>
          <CardDescription>Detailed technical information about this source</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              {Object.entries(metadataFields).map(([key, value]) => (
                <TableRow key={key}>
                  <TableCell className="font-medium w-1/3">{key}</TableCell>
                  <TableCell className="whitespace-pre-wrap">{value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  const renderComments = () => (
    <Card>
      <CardHeader>
        <CardTitle>Comments & Discussion</CardTitle>
        <CardDescription>Academic discussions and notes about this source</CardDescription>
      </CardHeader>
      <CardContent>
        {comments.length > 0 ? comments.map(comment => (
          <div key={comment.id} className="border rounded-lg p-4 mb-4">
            <div className="flex justify-between items-start mb-2">
              <div className="font-semibold">{comment.author || 'Anonymous'}</div>
              <div className="text-sm text-muted-foreground">
                {new Date(comment.timestamp).toLocaleString()}
              </div>
            </div>
            <p className="text-sm mb-2">{comment.content || ''}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{comment.votes || 0} helpful votes</span>
            </div>
          </div>
        )) : <p className="text-muted-foreground">No comments yet. Be the first to discuss this source.</p>}
      </CardContent>
    </Card>
  );

  const renderRelatedContent = () => (
    <Card>
      <CardHeader>
        <CardTitle>Related Content</CardTitle>
        <CardDescription>Other sources and materials related to this work</CardDescription>
      </CardHeader>
      <CardContent>
        {relatedContent.length > 0 ? (
          <div className="space-y-3">
            {relatedContent.map(item => (
              <div key={item.id} className="border rounded-lg p-3 hover:bg-muted/50 transition">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">{item.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{item.type}</Badge>
                      <span className="text-xs text-muted-foreground">{item.relation}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">View</Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No related content found.</p>
        )}
      </CardContent>
    </Card>
  );

  const renderTabContent = () => {
    switch (currentTab) {
      case 'details': return renderSourceDetails();
      case 'metadata': return renderMetadata();
      case 'comments': return renderComments();
      case 'related': return renderRelatedContent();
      default: return renderSourceDetails();
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-96">
      <p>Loading source details...</p>
    </div>
  );

  if (error) return (
    <div className="text-destructive p-4 text-center">
      <p>Error: {error}</p>
      <Button 
        variant="outline" 
        className="mt-2"
        onClick={() => router.push('/dashboard/knowledge/source')}
      >
        Back to Sources
      </Button>
    </div>
  );

  if (!source) return (
    <div className="text-center p-8">
      <p>Source not found.</p>
      <Button 
        variant="outline" 
        className="mt-2"
        onClick={() => router.push('/dashboard/knowledge/source')}
      >
        Back to Sources
      </Button>
    </div>
  );

  return (
    <>
      <Toaster position="top-right" richColors />
      <SourceLayout
        source={source}
        commentsCount={comments.length}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
      >
        {renderTabContent()}
      </SourceLayout>
    </>
  );
}