"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast, Toaster } from "sonner";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import type { OntologyClass, OntologyField } from "@/lib/ontology/types";

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://backend.localhost";

// ---------------------------------------------------------------------------
// FIELD RENDERER — maps OntologyField definitions to shadcn inputs
// ---------------------------------------------------------------------------
function FieldRenderer({
  field,
  value,
  onChange,
  disabled,
}: {
  field: OntologyField;
  value: any;
  onChange: (key: string, value: any) => void;
  disabled: boolean;
}) {
  const id = `field-${field.key}`;

  switch (field.type) {
    case "textarea":
      return (
        <div>
          <Label htmlFor={id}>
            {field.label}
            {field.required && " *"}
          </Label>
          {field.description && (
            <p className="text-xs text-muted-foreground mb-1">
              {field.description}
            </p>
          )}
          <Textarea
            id={id}
            value={value || ""}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={4}
            disabled={disabled}
          />
        </div>
      );

    case "select":
      return (
        <div>
          <Label htmlFor={id}>
            {field.label}
            {field.required && " *"}
          </Label>
          {field.description && (
            <p className="text-xs text-muted-foreground mb-1">
              {field.description}
            </p>
          )}
          <Select
            value={value || ""}
            onValueChange={(v) => onChange(field.key, v)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {(field.options || []).map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    case "number":
      return (
        <div>
          <Label htmlFor={id}>
            {field.label}
            {field.required && " *"}
          </Label>
          {field.description && (
            <p className="text-xs text-muted-foreground mb-1">
              {field.description}
            </p>
          )}
          <Input
            id={id}
            type="number"
            value={value ?? ""}
            onChange={(e) =>
              onChange(
                field.key,
                e.target.value === "" ? null : Number(e.target.value)
              )
            }
            placeholder={field.placeholder}
            disabled={disabled}
          />
        </div>
      );

    case "url":
      return (
        <div>
          <Label htmlFor={id}>
            {field.label}
            {field.required && " *"}
          </Label>
          {field.description && (
            <p className="text-xs text-muted-foreground mb-1">
              {field.description}
            </p>
          )}
          <Input
            id={id}
            type="url"
            value={value || ""}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder || "https://..."}
            disabled={disabled}
          />
        </div>
      );

    case "coordinates":
      return (
        <div>
          <Label htmlFor={id}>
            {field.label}
            {field.required && " *"}
          </Label>
          {field.description && (
            <p className="text-xs text-muted-foreground mb-1">
              {field.description}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Input
              id={`${id}-lat`}
              type="text"
              value={value?.lat ?? ""}
              onChange={(e) =>
                onChange(field.key, { ...value, lat: e.target.value })
              }
              placeholder="Latitude"
              disabled={disabled}
            />
            <Input
              id={`${id}-lng`}
              type="text"
              value={value?.lng ?? ""}
              onChange={(e) =>
                onChange(field.key, { ...value, lng: e.target.value })
              }
              placeholder="Longitude"
              disabled={disabled}
            />
          </div>
        </div>
      );

    // text, date, relation — all render as text input
    default:
      return (
        <div>
          <Label htmlFor={id}>
            {field.label}
            {field.required && " *"}
          </Label>
          {field.description && (
            <p className="text-xs text-muted-foreground mb-1">
              {field.description}
            </p>
          )}
          <Input
            id={id}
            value={value || ""}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
          />
        </div>
      );
  }
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT — OntologyForm
// ---------------------------------------------------------------------------
export interface OntologyFormProps {
  /** The ontology class definition to render */
  ontologyClass: OntologyClass;
  /** Optional redirect path after submission (default: /dashboard/knowledge/{key}) */
  redirectTo?: string;
  /** Override API base URL */
  apiBaseUrl?: string;
  /** Title override */
  title?: string;
  /** Description override */
  description?: string;
}

export default function OntologyForm({
  ontologyClass,
  redirectTo,
  apiBaseUrl,
  title,
  description,
}: OntologyFormProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isSignedIn = status === "authenticated";
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const baseUrl = apiBaseUrl || API_BASE_URL;
  const endpoint = `${baseUrl}${ontologyClass.apiEndpoint}`;
  const postSubmitPath =
    redirectTo || `/dashboard/knowledge/${ontologyClass.key}`;

  // Sort fields by order within each section
  const sortedFields = [...ontologyClass.fields].sort(
    (a, b) => (a.order ?? 99) - (b.order ?? 99)
  );

  // Group fields by section
  const sections = ontologyClass.sections || [
    { key: "basic", label: "Information" },
  ];
  const fieldsBySection: Record<string, OntologyField[]> = {};
  for (const section of sections) {
    fieldsBySection[section.key] = sortedFields.filter(
      (f) => (f.section || "basic") === section.key
    );
  }

  // --- HANDLERS ---
  const updateField = useCallback((key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearForm = useCallback(() => {
    setFormData({});
    toast.info("Form cleared");
  }, []);

  const validate = useCallback((): boolean => {
    const requiredFields = ontologyClass.fields.filter((f) => f.required);
    for (const field of requiredFields) {
      const val = formData[field.key];
      if (val === undefined || val === null || val === "") {
        toast.error(`Please fill in "${field.label}".`);
        return false;
      }
    }
    return true;
  }, [formData, ontologyClass.fields]);

  const handleSubmit = async () => {
    if (!validate()) return;
    if (!isSignedIn) {
      toast.error("Please sign in to submit contributions.");
      return;
    }

    setIsSubmitting(true);

    try {
      const token = (session as any)?.accessToken;

      // Build the payload — flatten coordinates into a string if present
      const payload: Record<string, any> = {};
      for (const field of ontologyClass.fields) {
        const val = formData[field.key];
        if (val === undefined || val === null || val === "") continue;

        if (field.type === "coordinates" && typeof val === "object") {
          payload[field.key] = `${val.lat}, ${val.lng}`;
        } else {
          payload[field.key] = val;
        }
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(
          `"${formData.name || formData.title || "Entry"}" submitted successfully!`
        );
        setTimeout(() => router.push(postSubmitPath), 1200);
      } else {
        const errorData = await res.json().catch(() => null);
        console.error("Submission error:", errorData);

        // Handle DRF field-level errors
        if (errorData && typeof errorData === "object" && !errorData.detail) {
          const messages = Object.entries(errorData)
            .map(
              ([key, val]) =>
                `${key}: ${Array.isArray(val) ? val.join(", ") : val}`
            )
            .join("\n");
          toast.error(messages || "Submission failed.");
        } else {
          toast.error(
            errorData?.detail || errorData?.message || "Submission failed."
          );
        }
      }
    } catch (err) {
      console.error("Submission error:", err);
      toast.error("Network error. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- RENDER ---
  const hasSections = sections.length > 1;

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="container max-w-2xl mx-auto space-y-6 px-4 lg:px-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold">
            {title || `Contribute ${ontologyClass.label}`}
          </h1>
          <p className="text-muted-foreground mt-2">
            {description ||
              ontologyClass.description ||
              `Add a new ${ontologyClass.label.toLowerCase()} to the knowledge base.`}
          </p>
        </div>

        {/* Form content */}
        {hasSections ? (
          // ---- Multi-section layout with Accordion ----
          <Accordion
            type="multiple"
            defaultValue={sections.map((s) => s.key)}
            className="space-y-4"
          >
            {sections.map((section) => {
              const sectionFields = fieldsBySection[section.key];
              if (!sectionFields || sectionFields.length === 0) return null;

              return (
                <AccordionItem
                  key={section.key}
                  value={section.key}
                  className="border rounded-lg px-4"
                >
                  <AccordionTrigger className="text-lg font-semibold">
                    {section.label}
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pb-4">
                    {sectionFields.map((field) => (
                      <FieldRenderer
                        key={field.key}
                        field={field}
                        value={formData[field.key]}
                        onChange={updateField}
                        disabled={!isSignedIn}
                      />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        ) : (
          // ---- Single-section layout with Card ----
          <Card>
            <CardHeader>
              <CardTitle>{ontologyClass.label} Information</CardTitle>
              <CardDescription>
                {isSignedIn
                  ? `Provide details about this ${ontologyClass.label.toLowerCase()}.`
                  : "Please sign in to submit contributions."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sortedFields.map((field) => (
                <FieldRenderer
                  key={field.key}
                  field={field}
                  value={formData[field.key]}
                  onChange={updateField}
                  disabled={!isSignedIn}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
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
            {!isSignedIn ? (
              "Sign In to Submit"
            ) : isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Submitting…
              </span>
            ) : (
              "Submit"
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
