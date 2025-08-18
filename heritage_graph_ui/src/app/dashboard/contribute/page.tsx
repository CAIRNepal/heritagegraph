'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast, Toaster } from 'sonner';

type FieldConfig = {
  name: string;
  label: string;
  type?: 'text' | 'textarea';
  placeholder?: string;
};

// Define sections (pages) with relevant fields
const steps: { title: string; fields: FieldConfig[] }[] = [
  {
    title: 'Basic Info',
    fields: [
      {
        name: 'title',
        label: 'Title',
        placeholder: 'E.g. Bhaktapur Durbar Square',
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        placeholder: 'Provide detailed description...',
      },
      { name: 'Alternative_name_s', label: 'Alternative Name(s)' },
      { name: 'Anglicized_name', label: 'Anglicized Name' },
      { name: 'Name_in_Devanagari', label: 'Name in Devanagari' },
    ],
  },
  {
    title: 'Location & Identification',
    fields: [
      { name: 'City_quarter_tola', label: 'City Quarter (Tola)' },
      { name: 'District', label: 'District' },
      {
        name: 'Municipality_village_council',
        label: 'Municipality / Village Council',
      },
      { name: 'Province_number', label: 'Province Number' },
      { name: 'Object_location', label: 'Object Location' },
      { name: 'Object_ID_number', label: 'Object ID Number' },
    ],
  },
  {
    title: 'Physical Characteristics',
    fields: [
      { name: 'Base_plinth_depth', label: 'Base Plinth Depth' },
      { name: 'Base_plinth_height', label: 'Base Plinth Height' },
      { name: 'Base_plinth_width', label: 'Base Plinth Width' },
      { name: 'Cakula_depth', label: 'Cakulā Depth' },
      { name: 'Cakula_height', label: 'Cakulā Height' },
      { name: 'Cakula_width', label: 'Cakulā Width' },
      { name: 'Capital_depth', label: 'Capital Depth' },
      { name: 'Capital_height', label: 'Capital Height' },
      { name: 'Capital_width', label: 'Capital Width' },
      { name: 'Height', label: 'Height' },
      { name: 'Width', label: 'Width' },
    ],
  },
  {
    title: 'Additional Details',
    fields: [
      { name: 'Monument_name', label: 'Monument Name' },
      { name: 'Monument_type', label: 'Monument Type' },
      { name: 'Monument_shape', label: 'Monument Shape' },
      {
        name: 'Monument_height_approximate',
        label: 'Monument Height (Approx.)',
      },
      { name: 'Monument_length', label: 'Monument Length' },
      { name: 'Monument_depth', label: 'Monument Depth' },
      { name: 'Monument_diameter', label: 'Monument Diameter' },
      { name: 'Main_deity_in_the_sanctum', label: 'Main Deity in the Sanctum' },
      { name: 'Religion', label: 'Religion' },
    ],
  },
  {
    title: 'References & Metadata',
    fields: [
      { name: 'Reference_source', label: 'Reference Source' },
      { name: 'Sources', label: 'Sources' },
      { name: 'Year_SS_NS_VS', label: 'Year (ŚS/NS/VS)' },
      { name: 'Date_BCE_CE', label: 'Date (BCE/CE)' },
      { name: 'Date_VS_NS', label: 'Date (VS/NS)' },
    ],
  },
];

export default function ContributePage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { getToken, isSignedIn } = useAuth();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleNext = () =>
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  const handlePrev = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const handleSubmit = async () => {
    if (!isSignedIn) {
      toast.error('You must be signed in to submit.');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch('http://localhost:8000/data/form-submit/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (res.status === 201 || res.status === 200) {
        toast(`Thank you for your contribution!`, {
          description: `Your entry "${formData.title}" has been submitted successfully.`,
          action: {
            label: 'Go to Dashboard',
            onClick: () => router.push('/dashboard'),
          },
        });
      } else {
        const err = await res.json();
        toast.error('Submission failed: ' + (err?.detail || 'Check your inputs.'));
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to submit. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Toaster richColors position="top-right" />
      <section className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">
            Submit a Cultural Heritage Entry
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Share a site, object, ritual, or tradition worth preserving.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{steps[currentStep].title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {steps[currentStep].fields.map((field) => {
              const Component = field.type === 'textarea' ? Textarea : Input;
              return (
                <div key={field.name} className="space-y-1">
                  <Label htmlFor={field.name}>{field.label}</Label>
                  <Component
                    id={field.name}
                    name={field.name}
                    placeholder={field.placeholder || ''}
                    value={formData[field.name] || ''}
                    onChange={handleChange}
                  />
                </div>
              );
            })}
          </CardContent>

          <div className="flex justify-between mt-4 px-4">
            <Button variant="outline" onClick={handlePrev} disabled={currentStep === 0}>
              Previous
            </Button>
            {currentStep < steps.length - 1 ? (
              <Button onClick={handleNext}>Next</Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Contribution'}
              </Button>
            )}
          </div>
        </Card>
      </section>
    </>
  );
}
