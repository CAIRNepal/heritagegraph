'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

import {
  User, CheckCircle, Calendar, ArrowLeft, MapPin, Tag, Clock, XCircle, Edit, FileText
} from 'lucide-react';

import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { toast, Toaster } from 'sonner';

/* ===========================================================================
   Submission Layout
   =========================================================================== */

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

  return (
    <div className="space-y-6">

      <Button variant="ghost" onClick={() => router.push('/dashboard/knowledge/events')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Events
      </Button>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:justify-between gap-4">
            <div className="space-y-3 flex-1">

              <CardTitle className="text-2xl md:text-3xl">{entity.name}</CardTitle>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {entity.type}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Event ID: {entity.id}</span>
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

        {entity.description && (
          <CardContent className="pt-0">
            <CardDescription className="text-base leading-relaxed">
              {entity.description}
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
            <SelectItem value="details">Event Details</SelectItem>
            <SelectItem value="participants">Participants</SelectItem>
            <SelectItem value="sources">Sources</SelectItem>
            <SelectItem value="activity">Activity</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={currentTab} onValueChange={onTabChange} className="hidden @4xl/main:block">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="details">Event Details</TabsTrigger>
          <TabsTrigger value="participants">Participants</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
      </Tabs>

      <div>{children}</div>
    </div>
  );
}

/* ===========================================================================
   PAGE
   =========================================================================== */

export default function EventPage() {
  const params = useParams();
  const eventId = params?.id;

  const [entity, setEntity] = useState(null);
  const [currentTab, setCurrentTab] = useState('details');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const { data: session } = useSession();
  const router = useRouter();

  const API_BASE = "http://0.0.0.0:8000/cidoc/events";

  /* ===========================================================================
     Fetch Event
     =========================================================================== */

  useEffect(() => {
    if (!eventId) return;

    const fetchEvent = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE}/${eventId}/`);
        if (!res.ok) throw new Error("Failed to load event");

        const data = await res.json();
        setEntity(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  /* ===========================================================================
     Handlers
     =========================================================================== */

  const handleRevise = () => {
    toast.error("Revisions not implemented for Events yet");
  };

  const handleEdit = () => {
    toast.error("Editing not implemented for Events yet");
  };

  /* ===========================================================================
     Tab Renderers
     =========================================================================== */

  const renderDetails = () => {
    const fields = {
      "Name": entity.name,
      "Type": entity.type,
      "Description": entity.description,
      "Start Date": entity.start_date,
      "End Date": entity.end_date,
      "Recurrence": entity.recurrence,
      "Location": entity.location,
      "Historical Period": entity.historical_period
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
          <CardDescription>Complete metadata for this event</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              {Object.entries(fields).map(([label, value]) => (
                <TableRow key={label}>
                  <TableCell className="font-medium w-1/3">{label}</TableCell>
                  <TableCell>{value || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  const renderParticipants = () => (
    <Card>
      <CardHeader>
        <CardTitle>Participants</CardTitle>
        <CardDescription>List of linked participant IDs</CardDescription>
      </CardHeader>
      <CardContent>
        {entity.participants?.length ? (
          <ul className="list-disc ml-5 space-y-1">
            {entity.participants.map((p, i) => (
              <li key={i} className="cursor-pointer hover:underline">
                Participant ID: {p}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No participants recorded.</p>
        )}
      </CardContent>
    </Card>
  );

  const renderSources = () => (
    <Card>
      <CardHeader>
        <CardTitle>Documentation Sources</CardTitle>
        <CardDescription>References connected to this event</CardDescription>
      </CardHeader>
      <CardContent>
        {entity.documentation_sources?.length ? (
          <ul className="list-disc ml-5 space-y-1">
            {entity.documentation_sources.map((src, i) => (
              <li key={i}>{src}</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No sources linked.</p>
        )}
      </CardContent>
    </Card>
  );

  const renderActivity = () => (
    <Card>
      <CardHeader>
        <CardTitle>Activity Log</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">No activity tracking implemented.</p>
      </CardContent>
    </Card>
  );

  const renderTab = () => {
    switch (currentTab) {
      case 'details': return renderDetails();
      case 'participants': return renderParticipants();
      case 'sources': return renderSources();
      case 'activity': return renderActivity();
      default: return null;
    }
  };

  /* ===========================================================================
     UI States
     =========================================================================== */

  if (isLoading) return <div className="p-10">Loading event…</div>;
  if (error) return <div className="p-10 text-red-500">{error}</div>;
  if (!entity) return <div className="p-10">Event Not Found</div>;

  /* ===========================================================================
     Render
     =========================================================================== */

  return (
    <>
      <Toaster position="top-right" richColors />

      <SubmissionLayout
        entity={entity}
        commentsCount={0}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        onRevise={handleRevise}
        onEdit={handleEdit}
      >
        {renderTab()}
      </SubmissionLayout>
    </>
  );
}
