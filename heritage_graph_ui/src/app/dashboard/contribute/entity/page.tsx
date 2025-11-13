'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
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

// --- TYPES ---
type Category = 'monument' | 'festival' | 'ritual' | 'tradition' | 'artifact' | 'other';

// --- INITIAL STATE ---
const INITIAL_FORM_STATE = {
  name: '',
  description: '',
  category: 'monument' as Category,
  form_data: {} as Record<string, any>,
};

export default function CulturalEntityContributionPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isSignedIn = status === 'authenticated';

  // --- FORM STATE ---
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categoryOptions: Category[] = ['monument', 'festival', 'ritual', 'tradition', 'artifact', 'other'];

  // --- FORM HANDLERS ---
  const updateFormField = useCallback((field: keyof typeof INITIAL_FORM_STATE, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const clearForm = useCallback(() => {
    setFormData(INITIAL_FORM_STATE);
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

  // --- SUBMIT ---
  const handleSubmit = async () => {
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
          form_data: formData.form_data, // Empty object as shown in your API example
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

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="container max-w-2xl mx-auto space-y-6 px-4 lg:px-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold">Contribute Cultural Entity</h1>
          <p className="text-muted-foreground mt-2">
            Share information about monuments, festivals, rituals, traditions, and artifacts.
          </p>
        </div>

        {/* Main Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>Cultural Entity Information</CardTitle>
            <CardDescription>
              {isSignedIn 
                ? "Provide basic information about the cultural entity."
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
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={clearForm} disabled={!isSignedIn}>
            Clear Form
          </Button>

          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !isSignedIn} 
            size="lg"
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
    </>
  );
}