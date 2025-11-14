'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

import {
  User,
  CheckCircle,
  Calendar,
  ArrowLeft,
  Tag,
  Clock,
  XCircle,
  Edit,
  FileText,
} from 'lucide-react';

import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast, Toaster } from 'sonner';

function SubmissionLayout({
  entity,
  commentsCount = 0,
  children,
  currentTab,
  onTabChange,
  onRevise,
  onEdit
}) {
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
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">

      <Button
        variant="ghost"
        onClick={() => router.push('/dashboard/knowledge/person')}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Persons
      </Button>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between gap-4">

            <div className="space-y-3">
              <CardTitle className="text-2xl md:text-3xl">{entity.name}</CardTitle>

              <div className="flex gap-2">
                <Badge variant={getStatusVariant('accepted')} className="flex items-center gap-1">
                  {getStatusIcon('accepted')}
                  accepted
                </Badge>

                <Badge variant="outline" className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  Person
                </Badge>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span>system</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Loaded from API</span>
                </div>
              </div>
            </div>

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

        {entity.biography && (
          <CardContent className="pt-0">
            <CardDescription className="text-base leading-relaxed">
              {entity.biography}
            </CardDescription>
          </CardContent>
        )}
      </Card>

      <div className="@4xl/main:hidden">
        <Select value={currentTab} onValueChange={onTabChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="details">Details</SelectItem>
            <SelectItem value="comments">Comments</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={currentTab} onValueChange={onTabChange} className="hidden @4xl/main:block">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
        </TabsList>
      </Tabs>

      <div>{children}</div>
    </div>
  );
}

export default function PersonPage() {
  const params = useParams();
  const personId = params?.id;

  const [entity, setEntity] = useState(null);
  const [comments, setComments] = useState([]);
  const [currentTab, setCurrentTab] = useState('details');
  const [isLoading, setIsLoading] = useState(true);

  const { data: session } = useSession();
  const router = useRouter();

  const API_BASE = "http://0.0.0.0:8000/cidoc/persons";

  useEffect(() => {
    if (!personId) return;

    const fetchPerson = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`${API_BASE}/${personId}/`);

        if (!res.ok) throw new Error("Failed to load person");

        const data = await res.json();
        setEntity(data);
      } catch {
        toast.error("Failed to load person");
      } finally {
        setIsLoading(false);
      }
    };

    const loadComments = () => {
      setComments([
        { id: 1, author: "reviewer", content: "Accurate details.", timestamp: new Date(), votes: 3 }
      ]);
    };

    fetchPerson();
    loadComments();
  }, [personId]);

  const handleRevise = () => {
    if (!entity) return toast.error('Person data not loaded');
    if (!session) return toast.error('You must be logged in to revise persons');

    const personData = encodeURIComponent(JSON.stringify({
      id: entity.id,
      name: entity.name,
      aliases: entity.aliases || '',
      birth_date: entity.birth_date || '',
      death_date: entity.death_date || '',
      occupation: entity.occupation || '',
      biography: entity.biography || '',
      historical_period: entity.historical_period || '',
      // Add other person-specific fields as needed
      entity_type: 'person'
    }));

    router.push(`/dashboard/knowledge/person/revise?person=${personData}&mode=revise`);
  };

  const handleEdit = () => {
    if (!entity) return toast.error('Person data not loaded');
    if (!session) return toast.error('You must be logged in to edit persons');

    // Since your API doesn't have contributor info, we'll allow editing for now
    // You can add proper permission checks when you have user authentication
    const canEdit = true; // Temporary - replace with actual permission check

    if (!canEdit) {
      return toast.error('You do not have permission to edit this person');
    }

    const personData = encodeURIComponent(JSON.stringify({
      id: entity.id,
      name: entity.name,
      aliases: entity.aliases || '',
      birth_date: entity.birth_date || '',
      death_date: entity.death_date || '',
      occupation: entity.occupation || '',
      biography: entity.biography || '',
      historical_period: entity.historical_period || '',
      // Add other person-specific fields as needed
      entity_type: 'person'
    }));

    router.push(`/dashboard/knowledge/person/revise?person=${personData}&mode=edit`);
  };

  const renderDetails = () => {
    if (!entity) return null;

    const fields = {
      "Name": entity.name,
      "Aliases": entity.aliases,
      "Birth Date": entity.birth_date,
      "Death Date": entity.death_date,
      "Occupation": entity.occupation,
      "Biography": entity.biography,
      "Historical Period": entity.historical_period
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle>Person Details</CardTitle>
          <CardDescription>Basic information</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              {Object.entries(fields).map(([k, v]) => (
                <TableRow key={k}>
                  <TableCell className="font-medium w-1/3">{k}</TableCell>
                  <TableCell>{v || "—"}</TableCell>
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
        <CardTitle>Comments</CardTitle>
      </CardHeader>

      <CardContent>
        {comments.length ? comments.map(c => (
          <div key={c.id} className="border rounded-lg p-4 mb-4">
            <div className="flex justify-between">
              <div className="font-semibold">{c.author}</div>
              <div className="text-sm">{new Date(c.timestamp).toLocaleString()}</div>
            </div>
            <p className="text-sm mt-2">{c.content}</p>
          </div>
        )) : <p>No comments yet.</p>}
      </CardContent>
    </Card>
  );

  if (isLoading) return <div className="p-10">Loading person…</div>;
  if (!entity) return <div className="text-red-500 p-10">Person not found</div>;

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
        {currentTab === "details" ? renderDetails() : renderComments()}
      </SubmissionLayout>
    </>
  );
}