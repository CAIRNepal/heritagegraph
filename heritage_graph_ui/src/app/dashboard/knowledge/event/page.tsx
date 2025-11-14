'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast, Toaster } from 'sonner';
import { useSession } from 'next-auth/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  User, 
  Calendar,
  Plus,
  Eye,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  MapPin,
} from 'lucide-react';

// --- TYPES ---
type Category = 'monument' | 'festival' | 'ritual' | 'tradition' | 'artifact' | 'other';
type Status = 'pending_review' | 'approved' | 'rejected';

interface Contributor {
  id?: number;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}

// CIDOC Event type (from your API)
interface CidocEvent {
  id: number;
  name: string;
  type: string;
  description: string;
  start_date: string;
  end_date: string;
  recurrence: string;
  location: any;
  historical_period: any;
  participants: number[];
  documentation_sources: any[];
}

interface CidocEventResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: CidocEvent[];
}

// Display wrapper (to reuse UI pattern)
interface DisplayEvent {
  entity_id: string;
  name: string;
  description?: string;
  category: Category;
  status: Status | string;
  contributor: Contributor;
  created_at: string;
  current_revision?: any;
  raw: CidocEvent;
}

// --- INITIAL STATE ---
const INITIAL_FORM_STATE = {
  name: '',
  description: '',
  category: 'artifact' as Category,
  form_data: {} as Record<string, any>,
};

// --- PAGINATION COMPONENT ---
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function Pagination({ currentPage, totalPages, onPageChange, className }: PaginationProps) {
  const pages = [];
  const maxVisiblePages = 5;

  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className={`flex items-center justify-between px-2 ${className}`}>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        
        <div className="flex items-center space-x-1">
          {startPage > 1 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(1)}
                className="h-8 w-8 p-0"
              >
                1
              </Button>
              {startPage > 2 && <MoreHorizontal className="h-4 w-4 text-muted-foreground" />}
            </>
          )}
          
          {pages.map(page => (
            <Button
              key={page}
              variant={currentPage === page ? "default" : "ghost"}
              size="sm"
              onClick={() => onPageChange(page)}
              className="h-8 w-8 p-0"
            >
              {page}
            </Button>
          ))}
          
          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <MoreHorizontal className="h-4 w-4 text-muted-foreground" />}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(totalPages)}
                className="h-8 w-8 p-0"
              >
                {totalPages}
              </Button>
            </>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </div>
    </div>
  );
}

// --- HOVER CARD COMPONENT (for events) ---
interface EntityHoverCardProps {
  entity: DisplayEvent;
  children: React.ReactNode;
  currentUserSession: any;
}


function EntityHoverCard({ entity, children }: EntityHoverCardProps) {
  const router = useRouter();
  const event = entity.raw;

  const dateRange = `${event.start_date || 'Unknown'} → ${event.end_date || 'Unknown'}`;

  const handleViewProfile = () => {
    // Replace 'entity' with the dynamic type if needed
    router.push(`/dashboard/knowledge/person/view/${entity.entity_id}`);
  };

  const handleViewEvent = () => {
    router.push(`/dashboard/knowledge/event/view/${entity.entity_id}`);
  };

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-96" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">{event.name}</h4>
            <Badge variant="outline" className="ml-2">
              {event.type}
            </Badge>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p>{event.description || 'No description available.'}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{dateRange}</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <Clock className="h-3 w-3" />
                <span>Recurrence: {event.recurrence || '—'}</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span>{event.location || 'Location unknown'}</span>
              </div>
              <div className="mt-1">
                Period: {event.historical_period || '—'}
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground pt-1">
            Participants: {event.participants?.length ?? 0}
          </div>

          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 text-xs"
              onClick={handleViewProfile}
            >
              View Profile
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              className="flex-1 text-xs"
              onClick={handleViewEvent}
            >
              View Event
            </Button>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}


export default function EventsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isSignedIn = status === 'authenticated';

  // --- FORM STATE (still here if you want to reuse later) ---
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // --- EVENTS STATE ---
  const [events, setEvents] = useState<DisplayEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  const categoryOptions: Category[] = ['monument', 'festival', 'ritual', 'tradition', 'artifact', 'other'];

  const updateFormField = useCallback((field: keyof typeof INITIAL_FORM_STATE, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const clearForm = useCallback(() => {
    setFormData(INITIAL_FORM_STATE);
    toast.info('Form cleared');
  }, []);

  // --- FETCH EVENTS (CIDOC API) ---
  const fetchEvents = useCallback(async (page: number = 1) => {
    setIsLoading(true);

    try {
      const offset = (page - 1) * pageSize;
      const url = `http://0.0.0.0:8000/cidoc/events/?limit=${pageSize}&offset=${offset}`;

      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        console.error('Failed to fetch events', res.statusText);
        toast.error('Failed to load events');
        setEvents([]);
        setTotalCount(0);
        setTotalPages(1);
        return;
      }

      const data: CidocEventResponse = await res.json();

      const normalized: DisplayEvent[] = data.results.map((ev) => ({
        entity_id: String(ev.id),
        name: ev.name,
        description: ev.description,
        category: 'artifact', // keep something to satisfy type, not really used
        status: 'approved',
        contributor: { username: 'system' },
        created_at: ev.start_date || new Date().toISOString(),
        current_revision: null,
        raw: ev,
      }));

      setEvents(normalized);
      setTotalCount(data.count || normalized.length);
      setTotalPages(Math.max(1, Math.ceil((data.count || normalized.length) / pageSize)));
      setCurrentPage(page);
    } catch (err) {
      console.error('Error fetching events:', err);
      toast.error('Network error while loading events');
      setEvents([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    fetchEvents(1);
  }, [fetchEvents]);

  const handlePageChange = (page: number) => {
    fetchEvents(page);
  };

  const validateForm = useCallback((): boolean => {
    if (!formData.name.trim()) {
      toast.error('Please provide a Name.');
      return false;
    }
    if (!formData.description.trim()) {
      toast.error('Please provide a Description.');
      return false;
    }
    if (!formData.category) {
      toast.error('Please select a Category.');
      return false;
    }
    return true;
  }, [formData]);

  const handleSubmit = async () => {
    // still wired to cultural-entities backend, like your template;
    // if you want event POST -> CIDOC/events, we can change that later.
    if (!validateForm()) return;
    if (!isSignedIn) {
      toast.error('Please sign in to submit contributions.');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = (session as any)?.accessToken;

      const res = await fetch('http://0.0.0.0:8000/data/api/cultural-entities/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          category: formData.category,
          form_data: formData.form_data,
        }),
      });

      if (res.ok) {
        await res.json();
        toast.success(`"${formData.name}" submitted successfully!`);
        fetchEvents(currentPage);
        setIsDialogOpen(false);
        clearForm();
      } else {
        const errorData = await res.json().catch(() => null);
        console.error('Submission error details:', errorData);
        toast.error(errorData?.detail || errorData?.message || 'Submission failed. Please try again.');
      }
    } catch (err) {
      console.error('Submission error:', err);
      toast.error('Network error. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: Status | string) => {
    const statusConfig: Record<string, { label: string; icon: any; variant: any }> = {
      pending_review: { label: 'Pending Review', icon: Clock, variant: 'secondary' },
      approved: { label: 'Approved', icon: CheckCircle, variant: 'default' },
      rejected: { label: 'Rejected', icon: XCircle, variant: 'destructive' },
    };
    
    const key = (status as string) in statusConfig ? (status as string) : 'approved';
    const config = statusConfig[key];
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant as any} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="px-4 lg:px-6 space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Events (CIDOC)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 flex flex-col md:flex-row gap-6 items-start">
            <div className="flex-1">
              <CardDescription className="text-base">
                This view displays events from the CIDOC API. Events represent cultural,
                religious, or historical occurrences like festivals, rituals, and
                turning points in history.
              </CardDescription>
            </div>

            <div className="flex flex-col gap-3 md:w-48">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Cultural Entity
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add New Cultural Entity</DialogTitle>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => updateFormField('name', e.target.value)}
                        placeholder="E.g., Kot Parva"
                        disabled={!isSignedIn}
                      />
                    </div>

                    <div>
                      <Label htmlFor="category">Category *</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) => updateFormField('category', value as Category)}
                        disabled={!isSignedIn}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categoryOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option.charAt(0).toUpperCase() + option.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="description">Description *</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => updateFormField('description', e.target.value)}
                        rows={6}
                        placeholder="Provide a description..."
                        disabled={!isSignedIn}
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setIsDialogOpen(false);
                          clearForm();
                        }}
                        disabled={!isSignedIn}
                      >
                        Cancel
                      </Button>

                      <Button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting || !isSignedIn} 
                        className="min-w-32"
                      >
                        {!isSignedIn ? (
                          'Sign In to Submit'
                        ) : isSubmitting ? (
                          <>
                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                            Submitting...
                          </>
                        ) : (
                          'Submit Entity'
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Button asChild variant="outline" size="sm">
                <a
                  href="https://example.com/source-model"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Event Model Docs
                </a>
              </Button>

              <Button asChild variant="outline" size="sm">
                <a
                  href="https://example.com/source-curation"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Event Curation Docs
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Events Section */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Events</CardTitle>
                <CardDescription>
                  Events from CIDOC. Total: {totalCount}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                <p className="text-muted-foreground mt-2">Loading events...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">No events found</h3>
                <p className="text-muted-foreground">
                  There are no events to show.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Date Range</TableHead>
                        <TableHead>Recurrence</TableHead>
                        <TableHead>Participants</TableHead>
                        <TableHead className="w-20">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((entity) => (
                        <EntityHoverCard 
                          key={entity.entity_id} 
                          entity={entity}
                          currentUserSession={session}
                        >
                          <TableRow className="cursor-pointer">
                            <TableCell className="font-medium">{entity.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {entity.raw.type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {entity.raw.start_date || '—'} &rarr; {entity.raw.end_date || '—'}
                            </TableCell>
                            <TableCell>
                              {entity.raw.recurrence || '—'}
                            </TableCell>
                            <TableCell>
                              {entity.raw.participants?.length ?? 0}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        </EntityHoverCard>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                {totalPages > 1 && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                    className="mt-4"
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </>
  );
}
