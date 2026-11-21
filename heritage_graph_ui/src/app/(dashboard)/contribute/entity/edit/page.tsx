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
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { apiFetchJson, getApiErrorMessage } from '@/lib/api-client';
import { ConfirmActionDialog } from '@/components/confirm-action-dialog';
import { getPublicApiUrl } from "@/lib/api-base";
import { HeritageDocumentUpload } from "@/components/ocr/heritage-document-upload";
import type { OcrFieldSuggestion } from "@/hooks/use-heritage-ocr-suggestions";

// --- TYPES ---
type Category = 'monument' | 'festival' | 'ritual' | 'tradition' | 'artifact' | 'other';

const CATEGORY_OPTIONS: Category[] = [
  'monument',
  'festival',
  'ritual',
  'tradition',
  'artifact',
  'other',
];

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
  contributor?: string;
}

type FormMode = 'new' | 'revise' | 'edit';

// Custom hook to safely get search params
function useSafeSearchParams() {
  const [searchParams, setSearchParams] = useState<URLSearchParams | null>(null);
  
  useEffect(() => {
    // This runs only on client side
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setSearchParams(params);
    }
  }, []);

  return searchParams;
}

export default function CulturalEntityContributionPage() {
  const router = useRouter();
  const searchParams = useSafeSearchParams();
  const { data: session, status } = useSession();
  const isSignedIn = status === 'authenticated';
  const API_BASE = getPublicApiUrl();

  // --- FORM STATE ---
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [originalEntity, setOriginalEntity] = useState<EntityData | null>(null);
  const [formMode, setFormMode] = useState<FormMode>('new');
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  // Load entity data from URL parameters
  useEffect(() => {
    if (!searchParams) return;

    const entityParam = searchParams.get('entity');
    const modeParam = searchParams.get('mode') as FormMode;

    if (entityParam) {
      try {
        // Decode the URL parameter and parse JSON
        const decodedEntityParam = decodeURIComponent(entityParam);

        const entityData: EntityData = JSON.parse(decodedEntityParam);

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
      } catch {
        toast.error('Failed to load entity data. Please try again.');
      }
    }
  }, [searchParams]);

  // --- FORM HANDLERS ---
  const updateFormField = useCallback((field: keyof typeof INITIAL_FORM_STATE, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const performClearForm = useCallback(() => {
    setFormData(INITIAL_FORM_STATE);
    setOriginalEntity(null);
    setFormMode('new');
    toast.info('Form cleared');
    setClearConfirmOpen(false);
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
    if (!originalEntity) {
      toast.error('Original entity data not found.');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = (session as any)?.accessToken;

      await apiFetchJson(
        `${API_BASE}/data/api/cultural-entities/${originalEntity.entity_id}/create_revision/`,
        {
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
        }
      );

      setSubmitConfirmOpen(false);
      toast.success(`Revision for "${formData.name}" submitted successfully!`);
      setTimeout(() => router.push('/knowledge/entity'), 1200);
    } catch (err) {
      toast.error(
        getApiErrorMessage(err, 'Could not submit this revision. Please try again.')
      );
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- SUBMIT EDIT ---
  const handleSubmitEdit = async () => {
    if (!originalEntity) {
      toast.error('Original entity data not found.');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = (session as any)?.accessToken;

      await apiFetchJson(`${API_BASE}/data/api/cultural-entities/${originalEntity.entity_id}/`, {
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

      setSubmitConfirmOpen(false);
      toast.success(`"${formData.name}" updated successfully!`);
      setTimeout(() => router.push('/knowledge/entity'), 1200);
    } catch (err) {
      toast.error(
        getApiErrorMessage(err, 'Could not update this entity. Please try again.')
      );
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- SUBMIT NEW ENTITY ---
  const handleSubmitNewEntity = async () => {
    setIsSubmitting(true);

    try {
      const token = (session as any)?.accessToken;

      await apiFetchJson(`${API_BASE}/data/api/cultural-entities/`, {
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

      setSubmitConfirmOpen(false);
      toast.success(`"${formData.name}" submitted successfully!`);
      setTimeout(() => router.push('/knowledge/entity'), 1200);
    } catch (err) {
      toast.error(
        getApiErrorMessage(err, 'Could not submit this entity. Please try again.')
      );
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const prepareSubmit = () => {
    if (!validateForm()) return;
    if (!isSignedIn) {
      toast.error('Please sign in to submit.');
      return;
    }
    if ((formMode === 'revise' || formMode === 'edit') && !originalEntity) {
      toast.error('Original entity data not found.');
      return;
    }
    setSubmitConfirmOpen(true);
  };

  const executeSubmit = async () => {
    switch (formMode) {
      case 'revise':
        await handleSubmitRevision();
        break;
      case 'edit':
        await handleSubmitEdit();
        break;
      case 'new':
      default:
        await handleSubmitNewEntity();
        break;
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

  const applyOcrSuggestions = useCallback(
    (suggestions: Record<string, OcrFieldSuggestion>) => {
      const topLevelKeys = new Set(["name", "description", "category"]);
      setFormData((prev) => {
        const next = { ...prev, form_data: { ...prev.form_data } };

        for (const [k, s] of Object.entries(suggestions)) {
          if (!k) continue;
          const v = s.value;
          if (topLevelKeys.has(k)) {
            const cur = (next as any)[k];
            const empty =
              cur === undefined ||
              cur === null ||
              (typeof cur === "string" && cur.trim() === "");
            if (!empty) continue;
            if (k === "category") {
              const val = String(v) as Category;
              if (CATEGORY_OPTIONS.includes(val)) (next as any).category = val;
            } else {
              (next as any)[k] = v;
            }
            continue;
          }

          const cur = (next.form_data as any)[k];
          const empty =
            cur === undefined ||
            cur === null ||
            (typeof cur === "string" && cur.trim() === "");
          if (!empty) continue;
          (next.form_data as any)[k] = v;
        }

        return next;
      });
      toast.message("Applied OCR suggestions to empty fields where possible.");
    },
    []
  );

  // Show loading state while search params are being initialized
  if (!searchParams) {
    return (
      <div className="container max-w-2xl mx-auto space-y-6 px-4 lg:px-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Loading...</h1>
        </div>
      </div>
    );
  }

  const submitConfirmTitle =
    formMode === 'revise'
      ? 'Submit this revision?'
      : formMode === 'edit'
        ? 'Save changes to this entity?'
        : 'Submit this cultural entity?';

  const submitConfirmDescription =
    formMode === 'revise' ? (
      <>
        A new revision will be created for{' '}
        <span className="font-medium text-foreground">{formData.name || 'this entity'}</span>.
      </>
    ) : formMode === 'edit' ? (
      <>
        Updates to{' '}
        <span className="font-medium text-foreground">{formData.name || 'this entity'}</span> will be saved to the server.
      </>
    ) : (
      <>
        <span className="font-medium text-foreground">{formData.name || 'This entity'}</span> will be submitted to the contribution queue.
      </>
    );

  const submitConfirmLabel =
    formMode === 'revise'
      ? 'Submit revision'
      : formMode === 'edit'
        ? 'Update entity'
        : 'Submit entity';

  return (
    <>
      <ConfirmActionDialog
        open={submitConfirmOpen}
        onOpenChange={setSubmitConfirmOpen}
        title={submitConfirmTitle}
        description={submitConfirmDescription}
        confirmLabel={submitConfirmLabel}
        onConfirm={executeSubmit}
        isPending={isSubmitting}
      />
      <ConfirmActionDialog
        open={clearConfirmOpen}
        onOpenChange={setClearConfirmOpen}
        title="Clear this form?"
        description="All entered data will be removed and revision/edit context will be reset."
        confirmLabel="Clear form"
        confirmVariant="destructive"
        onConfirm={async () => {
          performClearForm();
        }}
      />

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

        {/* Non-editable profile / original contributor info */}
        <div className="container max-w-2xl mx-auto px-4 lg:px-6">
          <div className="mb-4">
            {formMode === 'new' ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Your profile (non-editable)</CardTitle>
                  <CardDescription className="text-xs">These values will be associated with the submission.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-muted-foreground text-xs">Name</div>
                      <div className="font-medium">{(session?.user as any)?.name || (session?.user as any)?.username || 'Not signed in'}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">Email</div>
                      <div className="font-medium">{(session?.user as any)?.email || 'Not provided'}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              originalEntity && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Original contributor (non-editable)</CardTitle>
                    <CardDescription className="text-xs">The contribution owner and original metadata.</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-muted-foreground text-xs">Name</div>
                        <div className="font-medium">{originalEntity?.current_revision?.data?.contributor || originalEntity?.contributor || 'Unknown'}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Status</div>
                        <div className="font-medium">{originalEntity?.status || 'Unknown'}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            )}
          </div>
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
            {originalEntity ? (
              <HeritageDocumentUpload
                className="border-dashed"
                culturalEntityId={originalEntity.entity_id}
                onApply={applyOcrSuggestions}
              />
            ) : null}
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
                  {CATEGORY_OPTIONS.map((option) => (
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
              onClick={() => setClearConfirmOpen(true)} 
              disabled={!isSignedIn}
            >
              Clear Form
            </Button>

            <Button 
              onClick={prepareSubmit} 
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