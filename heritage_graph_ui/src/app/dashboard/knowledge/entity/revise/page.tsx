'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Save, FileText, Edit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast, Toaster } from 'sonner';

export default function ReviseEntityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    status: 'draft'
  });

  // Get entity data and mode from URL parameters
  const entityParam = searchParams.get('entity');
  const mode = searchParams.get('mode') || 'revise'; // 'revise' or 'edit'

  useEffect(() => {
    if (!session) {
      toast.error('You must be logged in to access this page');
      router.push('/dashboard/knowledge/entity');
      return;
    }

    if (!entityParam) {
      toast.error('No entity data provided');
      router.push('/dashboard/knowledge/entity');
      return;
    }

    try {
      const entityData = JSON.parse(decodeURIComponent(entityParam));
      
      // Set form data with existing entity data
      setFormData({
        name: entityData.name || '',
        description: entityData.description || '',
        category: entityData.category || '',
        status: entityData.status || 'draft',
        entity_id: entityData.entity_id,
        current_revision: entityData.current_revision
      });
    } catch (error) {
      console.error('Error parsing entity data:', error);
      toast.error('Invalid entity data');
      router.push('/dashboard/knowledge/entity');
    }
  }, [entityParam, session, router]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!session) {
      toast.error('You must be logged in to submit');
      return;
    }

    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setIsLoading(true);

    try {
      // Determine the API endpoint and method based on mode
      const isEdit = mode === 'edit';
      const url = isEdit 
        ? `http://0.0.0.0:8000/cidoc/artifacts/${formData.entity_id}/`
        : 'http://0.0.0.0:8000/cidoc/artifacts/';
      
      const method = isEdit ? 'PUT' : 'POST';

      // Prepare the submission data
      const submissionData = {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        status: formData.status,
        // Add other required fields for your API
        contributor: session.user?.id, // Assuming user ID is available
        // Include revision data if in revise mode
        ...(mode === 'revise' && formData.current_revision && {
          previous_revision: formData.current_revision.revision_number,
          revision_notes: `Revised from revision ${formData.current_revision.revision_number}`
        })
      };

      const headers = {
        'Content-Type': 'application/json',
        // 'Authorization': `Bearer ${session.accessToken}` // Add when auth is implemented
      };

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(submissionData)
      });

      if (!response.ok) {
        throw new Error(`Failed to ${isEdit ? 'update' : 'create'} entity`);
      }

      const result = await response.json();
      
      toast.success(`Entity ${isEdit ? 'updated' : 'revised'} successfully`);
      
      // Redirect back to the entity view
      setTimeout(() => {
        if (isEdit) {
          router.push(`/dashboard/knowledge/entity/view/${formData.entity_id}`);
        } else {
          // For revise, we might want to go to the new entity or the original
          router.push('/dashboard/knowledge/entity');
        }
      }, 1500);

    } catch (error) {
      console.error('Submission error:', error);
      toast.error(`Failed to ${mode} entity: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (formData.entity_id) {
      router.push(`/dashboard/knowledge/entity/view/${formData.entity_id}`);
    } else {
      router.push('/dashboard/knowledge/entity');
    }
  };

  // Show loading while parsing URL parameters
  if (!formData.name && entityParam) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <p>Loading entity data...</p>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" richColors />
      
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={handleCancel}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                {mode === 'edit' ? 'Edit Entity' : 'Revise Entity'}
              </h1>
              <p className="text-muted-foreground">
                {mode === 'edit' 
                  ? 'Make changes to the existing entity' 
                  : 'Create a new revision of this entity'
                }
              </p>
            </div>
          </div>

          <Badge variant={mode === 'edit' ? 'default' : 'secondary'}>
            {mode === 'edit' ? 'Editing' : 'Revising'}
          </Badge>
        </div>

        {/* Revision Info Card - Only show for revise mode */}
        {mode === 'revise' && formData.current_revision && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Revision Information
              </CardTitle>
              <CardDescription>
                You are creating a new revision based on revision #{formData.current_revision.revision_number}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Edit Info Card - Only show for edit mode */}
        {mode === 'edit' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Editing Mode
              </CardTitle>
              <CardDescription>
                You are editing the current version of this entity. Changes will update the existing record.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Main Form */}
        <Card>
          <CardHeader>
            <CardTitle>Entity Information</CardTitle>
            <CardDescription>
              {mode === 'edit' 
                ? 'Update the entity details below'
                : 'Modify the entity details to create a new revision'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name Field */}
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter entity name"
                  required
                />
              </div>

              {/* Description Field */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Enter entity description"
                  rows={4}
                />
              </div>

              {/* Category Field */}
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => handleInputChange('category', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="artifact">Artifact</SelectItem>
                    <SelectItem value="monument">Monument</SelectItem>
                    <SelectItem value="document">Document</SelectItem>
                    <SelectItem value="artwork">Artwork</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Field */}
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleInputChange('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending_review">Pending Review</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="on_display">On Display</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Additional fields can be added here based on your API requirements */}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || !formData.name.trim()}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {isLoading 
                    ? (mode === 'edit' ? 'Updating...' : 'Creating Revision...')
                    : (mode === 'edit' ? 'Update Entity' : 'Create Revision')
                  }
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Preview Card */}
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>How your entity will appear</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <strong>Name:</strong> {formData.name || 'Not set'}
              </div>
              <div>
                <strong>Description:</strong> {formData.description || 'Not set'}
              </div>
              <div>
                <strong>Category:</strong> {formData.category || 'Not set'}
              </div>
              <div>
                <strong>Status:</strong> {formData.status || 'Not set'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}