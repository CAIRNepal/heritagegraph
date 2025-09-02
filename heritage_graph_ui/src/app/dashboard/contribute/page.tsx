'use client';

import React, { useState, useRef, useEffect } from 'react';
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
import { Upload, X, Search, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type EntityType =
  | 'Historical Figure'
  | 'Temple'
  | 'Artifact'
  | 'Festival'
  | 'Music/Dance'
  | 'Monument'
  | 'Other';

type UploadedFile = {
  file: File;
  dataUrl: string;
  id: string;
};

export default function ContributePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isSignedIn = status === 'authenticated';

  // Step 0: Basic contact + entity selection
  const [contributorName, setContributorName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [entityType, setEntityType] = useState<EntityType>('Temple');
  const [otherEntityType, setOtherEntityType] = useState('');
  const [modeFieldBased, setModeFieldBased] = useState(true);

  // Field-based fields (dynamic)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateOrEra, setDateOrEra] = useState('');
  const [locationRegion, setLocationRegion] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Paragraph-based
  const [paragraphText, setParagraphText] = useState('');

  // Media uploads
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Related entities autocomplete (mock data)
  const mockEntities = [
    'Bhaktapur Durbar Square',
    'Patan Durbar Square',
    'Swayambhunath',
    'Pashupatinath',
    'Lumbini',
    'Kathmandu Valley',
    'Gurkha',
    'Newari Culture',
    'Kumari',
  ];
  const [relatedQuery, setRelatedQuery] = useState('');
  const [relatedResults, setRelatedResults] = useState<string[]>([]);
  const [relatedSelected, setRelatedSelected] = useState<string[]>([]);

  // Form state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Entity options
  const entityOptions: EntityType[] = [
    'Historical Figure',
    'Temple',
    'Artifact',
    'Festival',
    'Music/Dance',
    'Monument',
    'Other',
  ];

  // Filter related entities based on query
  useEffect(() => {
    if (!relatedQuery.trim()) {
      setRelatedResults([]);
      return;
    }

    const q = relatedQuery.trim().toLowerCase();
    const filtered = mockEntities.filter((s) => s.toLowerCase().includes(q));
    setRelatedResults(filtered);
  }, [relatedQuery]);

  // Handle file uploads
  const handleFiles = (files: FileList | null) => {
    if (!files) return;

    const newUploads: UploadedFile[] = [];

    Array.from(files).forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File ${file.name} is too large (max 10MB)`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        const newUpload = {
          file,
          dataUrl,
          id: Math.random().toString(36).substring(2, 9),
        };
        setUploads((prev) => [...prev, newUpload]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeUpload = (id: string) => {
    setUploads((prev) => prev.filter((upload) => upload.id !== id));
  };

  // Handle drag and drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  // Multi-select related entities
  const addRelated = (label: string) => {
    if (!relatedSelected.includes(label)) {
      setRelatedSelected((prev) => [...prev, label]);
    }
    setRelatedQuery('');
  };

  const removeRelated = (label: string) => {
    setRelatedSelected((prev) => prev.filter((s) => s !== label));
  };

  // Form validation
  const validate = () => {
    if (!contributorName.trim()) {
      toast.error('Please enter your name.');
      return false;
    }

    if (!email.trim() && !phone.trim()) {
      toast.error('Provide at least an email or phone for contact.');
      return false;
    }

    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast.error('Please enter a valid email address.');
      return false;
    }

    if (modeFieldBased) {
      if (!title.trim()) {
        toast.error('Please provide the Name/Title for the field-based contribution.');
        return false;
      }
      if (!description.trim()) {
        toast.error('Please provide a Description for the field-based contribution.');
        return false;
      }
    } else {
      if (!paragraphText.trim() || paragraphText.trim().length < 20) {
        toast.error(
          'Please provide a substantial paragraph-based contribution (20+ chars).',
        );
        return false;
      }
    }

    return true;
  };

  const buildPayload = async () => {
    const payload: Record<string, any> = {
      contributorName: contributorName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      entityType: entityType === 'Other' ? otherEntityType || 'Other' : entityType,
      mode: modeFieldBased ? 'field' : 'paragraph',
      relatedEntities: relatedSelected,
      uploads: uploads.map((u) => ({ name: u.file.name, dataUrl: u.dataUrl })),
      submittedAt: new Date().toISOString(),
    };

    if (modeFieldBased) {
      payload.title = title.trim();
      payload.description = description.trim();
      payload.dateOrEra = dateOrEra.trim();
      payload.locationRegion = locationRegion.trim();
      payload.additionalNotes = additionalNotes.trim();
    } else {
      payload.paragraph = paragraphText.trim();
    }

    return payload;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (!isSignedIn) {
      toast.error('Please sign in to submit contributions.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = await buildPayload();

      // @ts-ignore
      const token = (session as any)?.accessToken;

      const res = await fetch('http://127.0.0.1:8000/data/form-submit/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success('Submission received — thank you!', {
          description: `Saved "${payload.title || payload.paragraph?.slice(0, 50) || 'Contribution'}"`,
        });
        setTimeout(() => router.push('/dashboard'), 1500);
      } else {
        const err = await res.json().catch(() => null);
        toast.error('Submission failed: ' + (err?.detail || 'Server error.'));
      }
    } catch (error) {
      console.error(error);
      toast.error('Network or server error. Try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render field-based form section
  const renderFieldBased = () => {
    return (
      <div className="grid grid-cols-1 gap-6">
        <div>
          <Label htmlFor="title">Name / Title *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="E.g. Bhaktapur Durbar Square"
          />
        </div>

        <div>
          <Label htmlFor="description">Description *</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Provide a detailed description..."
            rows={4}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="dateOrEra">Date / Era</Label>
            <Input
              id="dateOrEra"
              value={dateOrEra}
              onChange={(e) => setDateOrEra(e.target.value)}
              placeholder="E.g. 17th century or c. 1600s"
            />
          </div>
          <div>
            <Label htmlFor="locationRegion">Location / Region</Label>
            <Input
              id="locationRegion"
              value={locationRegion}
              onChange={(e) => setLocationRegion(e.target.value)}
              placeholder="City / District / Region"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="media">Images / Media</Label>
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
              Maximum file size: 10MB each
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="mediaInput"
          />

          {uploads.length > 0 && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {uploads.map((upload) => (
                <div
                  key={upload.id}
                  className="relative border rounded-md overflow-hidden group"
                >
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    {upload.file.type.startsWith('image/') ? (
                      <img
                        src={upload.dataUrl}
                        alt={upload.file.name}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="p-4 text-center">
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                        <p className="text-xs mt-1 truncate">{upload.file.name}</p>
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
        </div>

        <div>
          <Label htmlFor="related">Related Entities</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="related"
              placeholder="Search related entities..."
              value={relatedQuery}
              onChange={(e) => setRelatedQuery(e.target.value)}
              className="pl-8"
            />
          </div>

          {relatedQuery && relatedResults.length > 0 && (
            <div className="mt-2 border rounded-md bg-background max-h-48 overflow-y-auto">
              {relatedResults.map((result) => (
                <div
                  key={result}
                  className="p-2 hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => addRelated(result)}
                >
                  {result}
                </div>
              ))}
            </div>
          )}

          {relatedSelected.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {relatedSelected.map((item) => (
                <Badge
                  key={item}
                  variant="secondary"
                  className="cursor-pointer px-2 py-1"
                  onClick={() => removeRelated(item)}
                >
                  {item}
                  <X className="ml-1 h-3 w-3" />
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="additionalNotes">
            Additional Notes / Cultural Significance
          </Label>
          <Textarea
            id="additionalNotes"
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="Any extra contextual information..."
            rows={3}
          />
        </div>
      </div>
    );
  };

  return (
    <>
      <Toaster richColors position="top-right" />
      <div className="min-h-screen bg-muted/20 py-8">
        <div className="container max-w-4xl mx-auto px-4">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight">
              Cultural Heritage Contribution Form
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              Help preserve cultural heritage by sharing your knowledge and resources
            </p>
          </div>

          <div className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Contact & Contribution Type</CardTitle>
                <CardDescription>
                  Provide your contact information and select what type of heritage item
                  you're contributing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="contributorName">Your Name *</Label>
                    <Input
                      id="contributorName"
                      value={contributorName}
                      onChange={(e) => setContributorName(e.target.value)}
                      placeholder='E.g. "Ram Kaji Shrestha"'
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">Contact Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Required for notifications and follow-up (or provide phone)
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+977-98XXXXXXXX"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="entityType" className="flex items-center gap-1">
                        Entity You Are Contributing
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                Select the type of heritage item you are contributing
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <Select
                        value={entityType}
                        onValueChange={(value) => setEntityType(value as EntityType)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select entity type" />
                        </SelectTrigger>
                        <SelectContent>
                          {entityOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {entityType === 'Other' && (
                      <div>
                        <Label htmlFor="otherEntity">Specify Entity Type</Label>
                        <Input
                          id="otherEntity"
                          value={otherEntityType}
                          onChange={(e) => setOtherEntityType(e.target.value)}
                          placeholder="Enter custom entity type"
                        />
                      </div>
                    )}

                    <div className="flex flex-col justify-end">
                      <Label className="mb-2">Contribution Format</Label>
                      <Tabs
                        value={modeFieldBased ? 'field' : 'paragraph'}
                        onValueChange={(value) => setModeFieldBased(value === 'field')}
                        className="w-full"
                      >
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="field">Field-based</TabsTrigger>
                          <TabsTrigger value="paragraph">Paragraph-based</TabsTrigger>
                        </TabsList>
                      </Tabs>
                      <p className="text-xs text-muted-foreground mt-2">
                        {modeFieldBased
                          ? 'Structured details with specific fields'
                          : 'Freeform description in paragraph format'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">
                  {modeFieldBased
                    ? 'Field-based Contribution'
                    : 'Paragraph-based Contribution'}
                </CardTitle>
                <CardDescription>
                  {modeFieldBased
                    ? 'Provide structured information about the cultural heritage item'
                    : 'Write a comprehensive description of the cultural heritage item'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {modeFieldBased ? (
                  renderFieldBased()
                ) : (
                  <div>
                    <Label htmlFor="paragraphText">Full Contribution Text *</Label>
                    <Textarea
                      id="paragraphText"
                      value={paragraphText}
                      onChange={(e) => setParagraphText(e.target.value)}
                      placeholder="Provide all information in one continuous text, including descriptions, dates, locations, and relationships..."
                      rows={12}
                      className="resize-y min-h-[200px]"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Provide all information in one continuous text, including
                      descriptions, dates, locations, and relationships. This may be
                      extracted with an agent or manual process.
                    </p>
                  </div>
                )}
              </CardContent>

              <div className="flex flex-col sm:flex-row justify-between gap-3 p-6 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setTitle('');
                    setDescription('');
                    setDateOrEra('');
                    setLocationRegion('');
                    setAdditionalNotes('');
                    setParagraphText('');
                    setUploads([]);
                    setRelatedSelected([]);
                    toast.info('Form fields cleared');
                  }}
                  className="sm:w-auto"
                >
                  Clear Form
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="sm:w-auto"
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Contribution'
                  )}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
