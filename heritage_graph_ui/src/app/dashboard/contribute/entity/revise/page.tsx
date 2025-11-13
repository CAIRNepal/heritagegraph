'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

// --- TYPES ---
type Category = 'monument' | 'festival' | 'ritual' | 'tradition' | 'artifact' | 'other';

// --- INITIAL STATE ---
const INITIAL_FORM_STATE = {
  name: '',
  description: '',
  category: 'monument' as Category,
  form_data: {} as Record<string, any>,
};

interface EntityData {
  entity_id: string;
  name: string;
  description: string;
  category: Category;
  current_revision: any;
  status?: string;
}

type FormMode = 'new' | 'revise' | 'edit';

export default function CulturalEntityContributionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const isSignedIn = status === 'authenticated';

  // --- FORM STATE ---
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [originalEntity, setOriginalEntity] = useState<EntityData | null>(null);
  const [formMode, setFormMode] = useState<FormMode>('new');

  const categoryOptions: Category[] = ['monument', 'festival', 'ritual', 'tradition', 'artifact', 'other'];

  // Load entity data from URL parameters
  useEffect(() => {
    const entityParam = searchParams.get('entity');
    const modeParam = searchParams.get('mode') as FormMode;
    
    console.log('URL Parameters:', { entityParam, modeParam });
    
    if (entityParam) {
      try {
        // Decode the URL parameter and parse JSON
        const decodedEntityParam = decodeURIComponent(entityParam);
        console.log('Decoded entity param:', decodedEntityParam);
        
        const entityData: EntityData = JSON.parse(decodedEntityParam);
        console.log('Parsed entity data:', entityData);
        
        setOriginalEntity(entityData);
        setFormMode(modeParam || 'revise'); // Default to revise if mode not specified
        
        // Pre-fill form with existing entity data
        setFormData({
          name: entityData.name || '',
          description: entityData.description || '',
          category: entityData.category || 'monument',
          form_data: entityData.current_revision?.data ? JSON.parse(entityData.current_revision.data) : {}
        });

        toast.success(`Entity data loaded for ${modeParam === 'edit' ? 'editing' : 'revision'}`);
      } catch (err) {
        console.error('Error parsing entity data:', err);
        console.error('Raw entity param:', entityParam);
        toast.error('Failed to load entity data. Please try again.');
      }
    }
  }, [searchParams]);

  // --- FORM HANDLERS ---
  const updateFormField = useCallback((field: keyof typeof INITIAL_FORM_STATE, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const clearForm = useCallback(() => {
    setFormData(INITIAL_FORM_STATE);
    setOriginalEntity(null);
    setFormMode('new');
    toast.info('Form cleared');
  }, []);

  // --- VALIDATION ---
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

  // --- SUBMIT REVISION ---
  const handleSubmitRevision = async () => {
    if (!validateForm()) return;
    if (!isSignedIn) {
      toast.error('Please sign in to submit revisions.');
      return;
    }
    if (!originalEntity) {
      toast.error('Original entity data not found.');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = (session as any)?.accessToken;

      const res = await fetch(`http://0.0.0.0:8000/data/api/cultural-entities/${originalEntity.entity_id}/create_revision/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          category: formData.category,
          data: formData.form_data,
        }),
      });

      if (res.ok) {
        const responseData = await res.json();
        toast.success(`Revision for "${formData.name}" submitted successfully!`);
        setTimeout(() => router.push('/dashboard/knowledge/entity'), 1200);
      } else {
        const errorData = await res.json().catch(() => null);
        console.error('Revision submission error details:', errorData);
        toast.error(errorData?.error || errorData?.detail || errorData?.message || 'Revision submission failed. Please try again.');
      }
    } catch (err) {
      console.error('Revision submission error:', err);
      toast.error('Network error. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- SUBMIT EDIT ---
  const handleSubmitEdit = async () => {
    if (!validateForm()) return;
    if (!isSignedIn) {
      toast.error('Please sign in to edit entities.');
      return;
    }
    if (!originalEntity) {
      toast.error('Original entity data not found.');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = (session as any)?.accessToken;

      const res = await fetch(`http://0.0.0.0:8000/data/api/cultural-entities/${originalEntity.entity_id}/`, {
        method: 'PATCH',
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
        const responseData = await res.json();
        toast.success(`"${formData.name}" updated successfully!`);
        setTimeout(() => router.push('/dashboard/knowledge/entity'), 1200);
      } else {
        const errorData = await res.json().catch(() => null);
        console.error('Edit submission error details:', errorData);
        toast.error(errorData?.error || errorData?.detail || errorData?.message || 'Update failed. Please try again.');
      }
    } catch (err) {
      console.error('Edit submission error:', err);
      toast.error('Network error. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- SUBMIT NEW ENTITY ---
  const handleSubmitNewEntity = async () => {
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
        const responseData = await res.json();
        toast.success(`"${formData.name}" submitted successfully!`);
        setTimeout(() => router.push('/dashboard/knowledge/entity'), 1200);
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

  // Determine which submit handler to use
  const handleSubmit = () => {
    switch (formMode) {
      case 'revise':
        return handleSubmitRevision();
      case 'edit':
        return handleSubmitEdit();
      case 'new':
      default:
        return handleSubmitNewEntity();
    }
  };

  const getModeTitle = () => {
    switch (formMode) {
      case 'revise':
        return 'Revise Cultural Entity';
      case 'edit':
        return 'Edit Cultural Entity';
      case 'new':
      default:
        return 'Contribute Cultural Entity';
    }
  };

  const getModeDescription = () => {
    switch (formMode) {
      case 'revise':
        return `Revising: ${originalEntity?.name}`;
      case 'edit':
        return `Editing: ${originalEntity?.name}`;
      case 'new':
      default:
        return 'Share information about monuments, festivals, rituals, traditions, and artifacts.';
    }
  };

  const getModeBadgeVariant = () => {
    switch (formMode) {
      case 'revise':
        return 'secondary';
      case 'edit':
        return 'default';
      case 'new':
      default:
        return 'outline';
    }
  };

  const getSubmitButtonText = () => {
    if (!isSignedIn) return 'Sign In to Submit';
    if (isSubmitting) {
      switch (formMode) {
        case 'revise':
          return 'Revising...';
        case 'edit':
          return 'Updating...';
        case 'new':
        default:
          return 'Submitting...';
      }
    }
    switch (formMode) {
      case 'revise':
        return 'Submit Revision';
      case 'edit':
        return 'Update Entity';
      case 'new':
      default:
        return 'Submit Entity';
    }
  };

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="container max-w-2xl mx-auto space-y-6 px-4 lg:px-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold">
            {getModeTitle()}
          </h1>
          <p className="text-muted-foreground mt-2">
            {getModeDescription()}
          </p>
          {formMode !== 'new' && (
            <div className="mt-2">
              <Badge variant={getModeBadgeVariant()} className="text-sm">
                {formMode === 'revise' ? 'Revision Mode' : 'Edit Mode'}
              </Badge>
            </div>
          )}
        </div>

        {/* Main Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>
              {formMode === 'revise' ? 'Revise Entity Information' : 
               formMode === 'edit' ? 'Edit Entity Information' : 'Cultural Entity Information'}
            </CardTitle>
            <CardDescription>
              {isSignedIn 
                ? formMode === 'revise' 
                  ? "Update the information for this cultural entity. Your changes will create a new revision."
                  : formMode === 'edit'
                  ? "Update the information for this cultural entity. Your changes will be saved directly."
                  : "Provide basic information about the cultural entity."
                : "Please sign in to submit contributions."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateFormField('name', e.target.value)}
                placeholder="E.g., Pashupatinath Temple, Dashain Festival, Malla Period Artifact"
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
                placeholder="Provide a comprehensive description of the cultural entity, its historical significance, cultural importance, and any relevant details..."
                disabled={!isSignedIn}
              />
            </div>

            {/* Show original values in revise/edit mode */}
            {(formMode === 'revise' || formMode === 'edit') && originalEntity && (
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-sm">Original Values</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div>
                    <span className="font-medium">Original Name:</span> {originalEntity.name}
                  </div>
                  <div>
                    <span className="font-medium">Original Category:</span> {originalEntity.category}
                  </div>
                  {originalEntity.description && (
                    <div>
                      <span className="font-medium">Original Description:</span> 
                      <p className="text-muted-foreground mt-1">{originalEntity.description}</p>
                    </div>
                  )}
                  {originalEntity.status && (
                    <div>
                      <span className="font-medium">Status:</span> {originalEntity.status}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-between gap-3">
          <Button 
            variant="outline" 
            onClick={() => router.back()}
          >
            Cancel
          </Button>

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={clearForm} 
              disabled={!isSignedIn}
            >
              Clear Form
            </Button>

            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting || !isSignedIn} 
              size="lg"
              className="min-w-32"
            >
              {isSubmitting ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  {getSubmitButtonText()}
                </>
              ) : (
                getSubmitButtonText()
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}