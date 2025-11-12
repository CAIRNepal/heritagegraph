'use client';

import React, { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
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
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, X, Search, Info, Calendar, MapPin, Users } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// --- TYPES ---
type EventType = 'Festival' | 'Ritual' | 'Historical Event' | 'Religious Ceremony' | 'Cultural Performance' | 'Other';
type Recurrence = 'Annual' | 'One-time' | 'Seasonal' | 'Monthly' | 'Weekly' | 'Unknown';
type UploadedFile = { file: File; dataUrl: string; id: string };

// --- CONSTANTS ---
const MOCK_DATA = {
  locations: [
    'Kathmandu Durbar Square',
    'Patan Durbar Square', 
    'Bhaktapur Durbar Square',
    'Pashupatinath Temple',
    'Swayambhunath Stupa',
    'Boudhanath Stupa',
    'Lumbini',
    'Pokhara',
    'Janakpur'
  ],
  persons: [
    'King Pratap Malla',
    'King Prithvi Narayan Shah',
    'Araniko',
    'Sita',
    'Ram',
    'Yogmaya',
  ],
  artifacts: [
    'Golden Gate Bhaktapur',
    'Taleju Bell',
    'Stone Inscriptions',
    'Ancient Manuscripts',
    'Vajra',
    'Prayer Wheels',
  ],
  sources: [
    'Gopal Raja Bansawali',
    'Bhasa Bansawali',
    'National Archives',
    'Kaiser Library',
    'Asa Archives',
  ],
} as const;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// --- INITIAL STATE ---
const INITIAL_FORM_STATE = {
  // Contact Info
  contributorName: '',
  email: '',
  phone: '',
  
  // Event Basic Info
  eventName: '',
  eventType: 'Festival' as EventType,
  otherEventType: '',
  description: '',
  
  // Dates & Recurrence
  startDate: '',
  endDate: '',
  recurrence: 'Annual' as Recurrence,
  historicalDate: '',
  
  // Location
  location: '',
  customLocation: '',
  
  // Relationships
  involvedPersons: [] as string[],
  associatedArtifacts: [] as string[],
  documentedSources: [] as string[],
  
  // Additional Info
  significance: '',
  rituals: '',
  participants: '',
  
  // Media
  uploads: [] as UploadedFile[],
  
  // Form Mode
  modeFieldBased: true,
};

export default function EventContributionPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isSignedIn = status === 'authenticated';

  // --- FORM STATE ---
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Search states
  const [locationQuery, setLocationQuery] = useState('');
  const [personQuery, setPersonQuery] = useState('');
  const [artifactQuery, setArtifactQuery] = useState('');
  const [sourceQuery, setSourceQuery] = useState('');
  
  const [locationResults, setLocationResults] = useState<string[]>([]);
  const [personResults, setPersonResults] = useState<string[]>([]);
  const [artifactResults, setArtifactResults] = useState<string[]>([]);
  const [sourceResults, setSourceResults] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Event type options
  const eventTypeOptions: EventType[] = ['Festival', 'Ritual', 'Historical Event', 'Religious Ceremony', 'Cultural Performance', 'Other'];
  const recurrenceOptions: Recurrence[] = ['Annual', 'One-time', 'Seasonal', 'Monthly', 'Weekly', 'Unknown'];

  // --- FORM HANDLERS ---
  const updateFormField = useCallback((field: keyof typeof INITIAL_FORM_STATE, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const clearForm = useCallback(() => {
    setFormData(INITIAL_FORM_STATE);
    setLocationQuery('');
    setPersonQuery('');
    setArtifactQuery('');
    setSourceQuery('');
    toast.info('Form cleared');
  }, []);

  // --- SEARCH HANDLERS ---
  const handleSearch = useCallback((query: string, type: 'location' | 'person' | 'artifact' | 'source') => {
    if (!query.trim()) {
      switch (type) {
        case 'location': setLocationResults([]); break;
        case 'person': setPersonResults([]); break;
        case 'artifact': setArtifactResults([]); break;
        case 'source': setSourceResults([]); break;
      }
      return;
    }

    const q = query.toLowerCase();
    let results: string[] = [];

    switch (type) {
      case 'location':
        results = MOCK_DATA.locations.filter(item => item.toLowerCase().includes(q));
        setLocationResults(results);
        break;
      case 'person':
        results = MOCK_DATA.persons.filter(item => item.toLowerCase().includes(q));
        setPersonResults(results);
        break;
      case 'artifact':
        results = MOCK_DATA.artifacts.filter(item => item.toLowerCase().includes(q));
        setArtifactResults(results);
        break;
      case 'source':
        results = MOCK_DATA.sources.filter(item => item.toLowerCase().includes(q));
        setSourceResults(results);
        break;
    }
  }, []);

  // --- RELATIONSHIP HANDLERS ---
  const addRelationship = useCallback((item: string, field: 'involvedPersons' | 'associatedArtifacts' | 'documentedSources') => {
    if (!formData[field].includes(item)) {
      updateFormField(field, [...formData[field], item]);
    }
    // Clear search
    switch (field) {
      case 'involvedPersons': setPersonQuery(''); break;
      case 'associatedArtifacts': setArtifactQuery(''); break;
      case 'documentedSources': setSourceQuery(''); break;
    }
  }, [formData, updateFormField]);

  const removeRelationship = useCallback((item: string, field: 'involvedPersons' | 'associatedArtifacts' | 'documentedSources') => {
    updateFormField(field, formData[field].filter(i => i !== item));
  }, [formData, updateFormField]);

  // --- FILE HANDLING ---
  const validateFile = (file: File): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File "${file.name}" exceeds 10MB limit`);
      return false;
    }
    return true;
  };

  const processFile = (file: File): Promise<UploadedFile> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          file,
          dataUrl: String(reader.result || ''),
          id: Math.random().toString(36).substring(2, 9),
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;

    const validFiles = Array.from(files).filter(validateFile);
    if (validFiles.length === 0) return;

    try {
      const uploadPromises = validFiles.map(processFile);
      const newUploads = await Promise.all(uploadPromises);
      
      updateFormField('uploads', [...formData.uploads, ...newUploads]);
    } catch (error) {
      toast.error('Error processing files');
    }
  }, [formData.uploads, updateFormField]);

  const removeUpload = useCallback((id: string) => {
    updateFormField('uploads', formData.uploads.filter(u => u.id !== id));
  }, [formData.uploads, updateFormField]);

  // --- DRAG & DROP ---
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  // --- VALIDATION ---
  const validateForm = useCallback((): boolean => {
    if (!formData.contributorName.trim()) {
      toast.error('Please enter your name.');
      return false;
    }
    if (!formData.email.trim() && !formData.phone.trim()) {
      toast.error('Provide at least an email or phone for contact.');
      return false;
    }
    if (formData.email.trim() && !/^\S+@\S+\.\S+$/.test(formData.email.trim())) {
      toast.error('Please enter a valid email address.');
      return false;
    }
    if (!formData.eventName.trim()) {
      toast.error('Please provide an Event Name.');
      return false;
    }
    if (!formData.description.trim()) {
      toast.error('Please provide an Event Description.');
      return false;
    }
    return true;
  }, [formData]);

  // --- SUBMIT ---
  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!isSignedIn) {
      toast.error('Please sign in to submit contributions.');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      // Contact Info
      contributorName: formData.contributorName.trim(),
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null,

      // Event Data
      eventName: formData.eventName.trim(),
      eventType: formData.eventType === 'Other' ? formData.otherEventType || 'Other' : formData.eventType,
      description: formData.description.trim(),
      
      // Dates
      startDate: formData.startDate.trim(),
      endDate: formData.endDate.trim(),
      recurrence: formData.recurrence,
      historicalDate: formData.historicalDate.trim(),
      
      // Location
      location: formData.location || formData.customLocation,
      
      // Relationships
      relationships: {
        occurs_at: [formData.location || formData.customLocation].filter(Boolean),
        involves: formData.involvedPersons,
        associated_artifact: formData.associatedArtifacts,
        documented_in: formData.documentedSources,
      },
      
      // Additional Info
      significance: formData.significance.trim(),
      rituals: formData.rituals.trim(),
      participants: formData.participants.trim(),
      
      // Media
      uploads: formData.uploads.map(u => ({ 
        name: u.file.name, 
        dataUrl: u.dataUrl,
        type: u.file.type,
        size: u.file.size,
      })),
      
      submittedAt: new Date().toISOString(),
    };

    try {
      const token = (session as any)?.accessToken;
      const res = await fetch('http://127.0.0.1:8000/data/event-submit/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(`Event "${formData.eventName}" submitted successfully!`);
        setTimeout(() => router.push('/dashboard/knowledge/events'), 1200);
      } else {
        const errorData = await res.json().catch(() => null);
        toast.error(errorData?.message || 'Submission failed. Try again.');
      }
    } catch (err) {
      console.error('Submission error:', err);
      toast.error('Network error. Try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- SEARCH COMPONENT ---
  const SearchableSelect = ({
    label,
    query,
    onQueryChange,
    results,
    onAddItem,
    selectedItems,
    onRemoveItem,
    placeholder,
    type,
    icon: Icon,
  }: {
    label: string;
    query: string;
    onQueryChange: (value: string) => void;
    results: string[];
    onAddItem: (item: string) => void;
    selectedItems: string[];
    onRemoveItem: (item: string) => void;
    placeholder: string;
    type: 'location' | 'person' | 'artifact' | 'source';
    icon: React.ComponentType<any>;
  }) => (
    <div>
      <Label htmlFor={type} className="flex items-center gap-1 mb-2">
        <Icon className="h-4 w-4" />
        {label}
      </Label>
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          id={type}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
            handleSearch(e.target.value, type);
          }}
          className="pl-8"
        />
      </div>

      {query && results.length > 0 && (
        <div className="mt-2 border rounded-md bg-background max-h-48 overflow-y-auto">
          {results.map((result) => (
            <div
              key={result}
              className="p-2 hover:bg-muted cursor-pointer transition-colors"
              onClick={() => onAddItem(result)}
            >
              {result}
            </div>
          ))}
        </div>
      )}

      {selectedItems.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedItems.map((item) => (
            <Badge
              key={item}
              variant="secondary"
              className="cursor-pointer px-2 py-1"
              onClick={() => onRemoveItem(item)}
            >
              {item}
              <X className="ml-1 h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <Toaster position="top-right" richColors />
      <div className="container max-w-4xl mx-auto space-y-6 px-4 lg:px-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold">Contribute Cultural Event</h1>
          <p className="text-muted-foreground mt-2">
            Share information about festivals, rituals, historical events, and cultural ceremonies.
          </p>
        </div>

        {/* Contact & Event Type Card */}
        <Card>
          <CardHeader>
            <CardTitle>Contact & Event Information</CardTitle>
            <CardDescription>
              Provide your contact details and basic event classification.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="contributorName">Your Name *</Label>
                <Input
                  id="contributorName"
                  value={formData.contributorName}
                  onChange={(e) => updateFormField('contributorName', e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Contact Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateFormField('email', e.target.value)}
                    placeholder="name@example.com"
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => updateFormField('phone', e.target.value)}
                    placeholder="+977-98XXXXXXXX"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="eventType">Event Type</Label>
                  <Select
                    value={formData.eventType}
                    onValueChange={(value) => updateFormField('eventType', value as EventType)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select event type" />
                    </SelectTrigger>
                    <SelectContent>
                      {eventTypeOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.eventType === 'Other' && (
                  <div>
                    <Label htmlFor="otherEventType">Specify Event Type</Label>
                    <Input
                      id="otherEventType"
                      value={formData.otherEventType}
                      onChange={(e) => updateFormField('otherEventType', e.target.value)}
                      placeholder="Enter custom event type"
                    />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Event Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
            <CardDescription>Provide comprehensive information about the event.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="eventName">Event Name *</Label>
              <Input
                id="eventName"
                value={formData.eventName}
                onChange={(e) => updateFormField('eventName', e.target.value)}
                placeholder="E.g. Indra Jatra, Dashain Festival, Coronation Ceremony"
              />
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => updateFormField('description', e.target.value)}
                rows={4}
                placeholder="Detailed description of the event, its purpose, and activities..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => updateFormField('startDate', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => updateFormField('endDate', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="historicalDate">Historical Date / Era</Label>
                <Input
                  id="historicalDate"
                  value={formData.historicalDate}
                  onChange={(e) => updateFormField('historicalDate', e.target.value)}
                  placeholder="E.g. 17th century, Malla Period, 1746 AD"
                />
              </div>
              <div>
                <Label htmlFor="recurrence">Recurrence Pattern</Label>
                <Select
                  value={formData.recurrence}
                  onValueChange={(value) => updateFormField('recurrence', value as Recurrence)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select recurrence" />
                  </SelectTrigger>
                  <SelectContent>
                    {recurrenceOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="location" className="flex items-center gap-1 mb-2">
                <MapPin className="h-4 w-4" />
                Location
              </Label>
              <Select
                value={formData.location}
                onValueChange={(value) => updateFormField('location', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a location" />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_DATA.locations.map((location) => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!formData.location && (
                <Input
                  className="mt-2"
                  value={formData.customLocation}
                  onChange={(e) => updateFormField('customLocation', e.target.value)}
                  placeholder="Or enter custom location..."
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Relationships Card */}
        <Card>
          <CardHeader>
            <CardTitle>Event Relationships</CardTitle>
            <CardDescription>Connect this event to related people, artifacts, and sources.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <SearchableSelect
              label="Involved Persons"
              query={personQuery}
              onQueryChange={setPersonQuery}
              results={personResults}
              onAddItem={(item) => addRelationship(item, 'involvedPersons')}
              selectedItems={formData.involvedPersons}
              onRemoveItem={(item) => removeRelationship(item, 'involvedPersons')}
              placeholder="Search for historical figures, participants..."
              type="person"
              icon={Users}
            />

            <SearchableSelect
              label="Associated Artifacts"
              query={artifactQuery}
              onQueryChange={setArtifactQuery}
              results={artifactResults}
              onAddItem={(item) => addRelationship(item, 'associatedArtifacts')}
              selectedItems={formData.associatedArtifacts}
              onRemoveItem={(item) => removeRelationship(item, 'associatedArtifacts')}
              placeholder="Search for related artifacts, objects..."
              type="artifact"
              icon={Info}
            />

            <SearchableSelect
              label="Documented In Sources"
              query={sourceQuery}
              onQueryChange={setSourceQuery}
              results={sourceResults}
              onAddItem={(item) => addRelationship(item, 'documentedSources')}
              selectedItems={formData.documentedSources}
              onRemoveItem={(item) => removeRelationship(item, 'documentedSources')}
              placeholder="Search for historical documents, archives..."
              type="source"
              icon={Info}
            />
          </CardContent>
        </Card>

        {/* Additional Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
            <CardDescription>Provide cultural context and significance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="significance">Cultural Significance</Label>
              <Textarea
                id="significance"
                value={formData.significance}
                onChange={(e) => updateFormField('significance', e.target.value)}
                rows={3}
                placeholder="Historical and cultural importance of the event..."
              />
            </div>

            <div>
              <Label htmlFor="rituals">Rituals & Ceremonies</Label>
              <Textarea
                id="rituals"
                value={formData.rituals}
                onChange={(e) => updateFormField('rituals', e.target.value)}
                rows={3}
                placeholder="Specific rituals, ceremonies, or activities performed..."
              />
            </div>

            <div>
              <Label htmlFor="participants">Participants & Community</Label>
              <Textarea
                id="participants"
                value={formData.participants}
                onChange={(e) => updateFormField('participants', e.target.value)}
                rows={2}
                placeholder="Who participates? Which communities are involved?"
              />
            </div>
          </CardContent>
        </Card>

        {/* Media Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle>Media & Documentation</CardTitle>
            <CardDescription>Upload images, videos, or documents related to the event.</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragging ? 'border-primary bg-primary/10' : 'border-muted-foreground/25'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">
                Drag & drop files here or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Maximum file size: 10MB each (images, videos, documents)
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,.pdf,.doc,.docx"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />

            {formData.uploads.length > 0 && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {formData.uploads.map((upload) => (
                  <div key={upload.id} className="relative border rounded-md overflow-hidden group">
                    <div className="aspect-video bg-muted flex items-center justify-center">
                      {upload.file.type.startsWith('image/') ? (
                        <Image 
                          src={upload.dataUrl} 
                          alt={upload.file.name} 
                          width={400} 
                          height={250} 
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="p-4 text-center">
                          <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                          <p className="text-xs mt-1 truncate">{upload.file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(upload.file.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                      )}
                    </div>
                    <button 
                      type="button" 
                      className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity" 
                      onClick={() => removeUpload(upload.id)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={clearForm}>
            Clear Form
          </Button>

          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting} 
            size="lg"
            className="min-w-32"
          >
            {isSubmitting ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                Submitting...
              </>
            ) : (
              'Submit Event'
            )}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}