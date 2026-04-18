"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

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
import { cn } from "@/lib/utils";

import type { OntologyClass, OntologyField } from "@/lib/ontology/types";
import { apiFetchJson, getApiErrorMessage } from "@/lib/api-client";
import { EntitySearch, type SearchResult } from "@/components/contribute/entity-search";
import { getPublicApiUrl } from "@/lib/api-base";
import {
  buildOntologyFormPayload,
  mapCidocRecordToFormData,
} from "@/lib/ontology/ontology-edit-helpers";

function FieldRenderer({
  field,
  value,
  onChange,
  disabled,
  hasError,
}: {
  field: OntologyField;
  value: any;
  onChange: (key: string, value: any) => void;
  disabled: boolean;
  hasError?: boolean;
}) {
  const id = `field-${field.key}`;
  const errorRing = hasError
    ? "ring-2 ring-red-400/50 border-red-300 dark:border-red-700"
    : "";

  const labelEl = (
    <Label htmlFor={id} className={cn(hasError && "text-red-600 dark:text-red-400")}>
      {field.label}
      {field.required && (
        <span className="text-red-500 ml-0.5">*</span>
      )}
    </Label>
  );

  const descEl = field.description ? (
    <p className="text-xs text-muted-foreground mb-1.5">{field.description}</p>
  ) : null;

  switch (field.type) {
    case "textarea":
      return (
        <div className="space-y-1">
          {labelEl}
          {descEl}
          <Textarea
            id={id}
            value={value || ""}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            disabled={disabled}
            className={errorRing}
          />
        </div>
      );

    case "select":
      return (
        <div className="space-y-1">
          {labelEl}
          {descEl}
          <Select
            value={value || ""}
            onValueChange={(v) => onChange(field.key, v)}
            disabled={disabled}
          >
            <SelectTrigger className={errorRing}>
              <SelectValue
                placeholder={`Select ${field.label.toLowerCase()}`}
              />
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
    case "float":
      return (
        <div className="space-y-1">
          {labelEl}
          {descEl}
          <Input
            id={id}
            type="number"
            step={field.type === "float" ? "0.01" : undefined}
            value={value ?? ""}
            onChange={(e) =>
              onChange(
                field.key,
                e.target.value === "" ? null : Number(e.target.value)
              )
            }
            placeholder={field.placeholder}
            disabled={disabled}
            className={errorRing}
          />
        </div>
      );

    case "url":
      return (
        <div className="space-y-1">
          {labelEl}
          {descEl}
          <Input
            id={id}
            type="url"
            value={value || ""}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder || "https://..."}
            disabled={disabled}
            className={errorRing}
          />
        </div>
      );

    case "coordinates":
      return (
        <div className="space-y-1">
          {labelEl}
          {descEl}
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
              className={errorRing}
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
              className={errorRing}
            />
          </div>
        </div>
      );

    case "relation": {
      if (field.multivalued) {
        const items: string[] = value
          ? (typeof value === "string" ? value.split(", ").filter(Boolean) : Array.isArray(value) ? value : [])
          : [];

        const handleAdd = (entity: SearchResult | null) => {
          if (!entity) return;
          const updated = [...items];
          if (!updated.includes(entity.name)) updated.push(entity.name);
          onChange(field.key, updated.join(", "));
        };

        const handleRemove = (name: string) => {
          const updated = items.filter((n) => n !== name);
          onChange(field.key, updated.length > 0 ? updated.join(", ") : "");
        };

        return (
          <div className="space-y-1">
            {labelEl}
            {descEl}
            {items.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {items.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-sm"
                  >
                    {name}
                    {!disabled && (
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground text-xs ml-0.5"
                        onClick={() => handleRemove(name)}
                      >
                        ✕
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
            <EntitySearch
              label=""
              endpoint={field.relationEndpoint || ""}
              value={null}
              onSelect={handleAdd}
              placeholder={`Search ${field.label?.toLowerCase() || "entities"}...`}
              allowCreate
              disabled={disabled}
              hasError={hasError}
            />
          </div>
        );
      }

      const selectedEntity: SearchResult | null = value
        ? { id: 0, name: typeof value === "string" ? value : String(value) }
        : null;

      return (
        <div className="space-y-1">
          {labelEl}
          {descEl}
          <EntitySearch
            label=""
            endpoint={field.relationEndpoint || ""}
            value={selectedEntity}
            onSelect={(entity) => onChange(field.key, entity?.name || "")}
            placeholder={`Search ${field.label?.toLowerCase() || "entities"}...`}
            allowCreate
            disabled={disabled}
            hasError={hasError}
          />
        </div>
      );
    }

    default:
      return (
        <div className="space-y-1">
          {labelEl}
          {descEl}
          <Input
            id={id}
            value={value || ""}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
            className={errorRing}
          />
        </div>
      );
  }
}

function StepNav({
  sections,
  currentStep,
  onStepClick,
  sectionProgress,
}: {
  sections: { key: string; label: string }[];
  currentStep: number;
  onStepClick: (idx: number) => void;
  sectionProgress: Record<string, { filled: number; total: number; requiredOk: boolean }>;
}) {
  return (
    <nav className="flex items-center gap-1 overflow-x-auto pb-2">
      {sections.map((section, idx) => {
        const progress = sectionProgress[section.key];
        const isCurrent = idx === currentStep;
        const isComplete = progress?.filled === progress?.total && progress?.total > 0;
        const hasRequiredMissing = !progress?.requiredOk;

        return (
          <button
            key={section.key}
            onClick={() => onStepClick(idx)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
              isCurrent
                ? "bg-blue-600 text-white shadow-sm"
                : isComplete
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            <span
              className={cn(
                "flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0",
                isCurrent
                  ? "bg-white/20 text-white"
                  : isComplete
                    ? "bg-emerald-500 text-white"
                    : hasRequiredMissing
                      ? "bg-muted-foreground/20 text-muted-foreground"
                      : "bg-muted-foreground/20 text-muted-foreground"
              )}
            >
              {isComplete ? "✓" : idx + 1}
            </span>
            <span className="hidden sm:inline">{section.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ProgressBar({ filled, total }: { filled: number; total: number }) {
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={cn(
            "h-full rounded-full",
            pct === 100
              ? "bg-emerald-500"
              : pct > 50
                ? "bg-blue-500"
                : "bg-blue-400"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {filled}/{total} fields
      </span>
    </div>
  );
}

export interface OntologyFormProps {
  ontologyClass: OntologyClass;
  redirectTo?: string;
  apiBaseUrl?: string;
  title?: string;
  description?: string;
  onFormControl?: (api: OntologyFormControlApi) => void;
}

export type OntologyFormControlApi = {
  mergeValues: (patch: Record<string, any>, opts?: { onlyIfEmpty?: boolean }) => void;
  getValues: () => Record<string, any>;
};

export default function OntologyForm({
  ontologyClass,
  redirectTo,
  apiBaseUrl,
  title,
  description,
  onFormControl,
}: OntologyFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const recordId = searchParams.get("id")?.trim() || null;
  const isEditMode = Boolean(recordId);
  const { data: session, status } = useSession();
  const isSignedIn = status === "authenticated";
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [editLoad, setEditLoad] = useState<"ok" | "loading" | "error">(
    isEditMode ? "loading" : "ok"
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recordMeta, setRecordMeta] = useState<{
    id: string;
    status?: string;
    contributor?: string;
  } | null>(null);

  const baseUrl = useMemo(
    () => apiBaseUrl || getPublicApiUrl(),
    [apiBaseUrl]
  );
  const endpoint = `${baseUrl}${ontologyClass.apiEndpoint}`;

  useEffect(() => {
    if (!recordId) {
      setFormData({});
      setEditLoad("ok");
      setLoadError(null);
      setRecordMeta(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setEditLoad("loading");
      setLoadError(null);
      try {
        const url = `${baseUrl}${ontologyClass.apiEndpoint}${encodeURIComponent(recordId)}/`;
        const token = (session as { accessToken?: string } | null)
          ?.accessToken;
        const data = await apiFetchJson<Record<string, unknown>>(url, {
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (cancelled) return;
        setFormData(mapCidocRecordToFormData(ontologyClass, data));
        setRecordMeta({
          id: String(recordId),
          status: typeof data.status === "string" ? data.status : undefined,
          contributor:
            typeof data.contributor === "string" ? data.contributor : undefined,
        });
        setCurrentStep(0);
        setEditLoad("ok");
      } catch (e) {
        if (cancelled) return;
        setLoadError(
          getApiErrorMessage(e, "Could not load this record for editing.")
        );
        setFormData({});
        setRecordMeta(null);
        setEditLoad("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [baseUrl, ontologyClass, recordId, session]);
  const postSubmitPath =
    redirectTo || `/knowledge/${ontologyClass.key}`;

  const sortedFields = useMemo(
    () =>
      [...ontologyClass.fields].sort(
        (a, b) => (a.order ?? 99) - (b.order ?? 99)
      ),
    [ontologyClass.fields]
  );

  const sections = ontologyClass.sections || [
    { key: "basic", label: "Information" },
  ];

  const fieldsBySection = useMemo(() => {
    const grouped: Record<string, OntologyField[]> = {};
    for (const section of sections) {
      grouped[section.key] = sortedFields.filter(
        (f) => (f.section || "basic") === section.key
      );
    }
    return grouped;
  }, [sortedFields, sections]);

  const hasSections = sections.length > 1;

  const isFieldFilled = useCallback(
    (field: OntologyField) => {
      const val = formData[field.key];
      if (val === undefined || val === null || val === "") return false;
      if (field.type === "coordinates" && typeof val === "object") {
        return !!(val.lat || val.lng);
      }
      return true;
    },
    [formData]
  );

  const sectionProgress = useMemo(() => {
    const progress: Record<
      string,
      { filled: number; total: number; requiredOk: boolean }
    > = {};
    for (const section of sections) {
      const fields = fieldsBySection[section.key] || [];
      const filled = fields.filter(isFieldFilled).length;
      const requiredFields = fields.filter((f) => f.required);
      const requiredOk = requiredFields.every(isFieldFilled);
      progress[section.key] = { filled, total: fields.length, requiredOk };
    }
    return progress;
  }, [sections, fieldsBySection, isFieldFilled]);

  const totalProgress = useMemo(() => {
    const all = Object.values(sectionProgress);
    return {
      filled: all.reduce((s, p) => s + p.filled, 0),
      total: all.reduce((s, p) => s + p.total, 0),
    };
  }, [sectionProgress]);

  const updateField = useCallback((key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setTouchedFields((prev) => new Set(prev).add(key));
  }, []);

  const mergeValues = useCallback(
    (patch: Record<string, any>, opts?: { onlyIfEmpty?: boolean }) => {
      const onlyIfEmpty = opts?.onlyIfEmpty !== false;
      setFormData((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(patch)) {
          if (onlyIfEmpty) {
            const cur = (next as any)[k];
            const empty =
              cur === undefined ||
              cur === null ||
              (typeof cur === "string" && cur.trim() === "");
            if (!empty) continue;
          }
          (next as any)[k] = v;
        }
        return next;
      });
    },
    []
  );

  const getValues = useCallback(() => formData, [formData]);

  useEffect(() => {
    if (!onFormControl) return;
    onFormControl({ mergeValues, getValues });
  }, [onFormControl, mergeValues, getValues]);

  const clearForm = useCallback(() => {
    if (isEditMode) {
      return;
    }
    setFormData({});
    setTouchedFields(new Set());
    setSubmitAttempted(false);
    setCurrentStep(0);
    toast.info("Form cleared");
  }, [isEditMode]);

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
    setSubmitAttempted(true);
    if (!validate()) return;
    if (!isSignedIn) {
      toast.error("Please sign in to submit contributions.");
      return;
    }

    setIsSubmitting(true);

    try {
      const token = (session as { accessToken?: string } | null)
        ?.accessToken;
      const payload = buildOntologyFormPayload(ontologyClass.fields, formData);

      if (isEditMode && recordId) {
        const detailUrl = `${baseUrl}${ontologyClass.apiEndpoint}${encodeURIComponent(recordId)}/`;
        await apiFetchJson(detailUrl, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });
        toast.success(
          `"${(formData.name as string) || (formData.title as string) || "Entry"}" updated successfully!`,
          { duration: 4000 }
        );
        setTimeout(
          () =>
            router.push(
              `/knowledge/${ontologyClass.key}/view/${encodeURIComponent(recordId)}`
            ),
          1200
        );
        return;
      }

      await apiFetchJson(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      toast.success(
        `"${(formData.name as string) || (formData.title as string) || "Entry"}" submitted successfully!`,
        {
          description:
            "Your contribution is now in the review queue. You'll be notified when a reviewer comments or makes a decision.",
          duration: 5000,
        }
      );
      setTimeout(() => router.push(postSubmitPath), 1500);
    } catch (err) {
      toast.error(
        getApiErrorMessage(
          err,
          isEditMode
            ? "Could not save changes. Please try again."
            : "Could not submit this form. Please try again."
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const shouldShowError = (field: OntologyField) => {
    if (!field.required) return false;
    const val = formData[field.key];
    const isEmpty = val === undefined || val === null || val === "";
    return isEmpty && (submitAttempted || touchedFields.has(field.key));
  };

  const currentSectionFields = fieldsBySection[sections[currentStep]?.key] || [];

  const goNext = () => {
    if (currentStep < sections.length - 1) setCurrentStep((s) => s + 1);
  };
  const goPrev = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };
  const isLastStep = currentStep === sections.length - 1;

  if (isEditMode && editLoad === "loading") {
    return (
      <div className="container mx-auto max-w-2xl py-16 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
        <p className="mt-4 text-muted-foreground">Loading current values…</p>
      </div>
    );
  }

  if (isEditMode && editLoad === "error" && loadError) {
    return (
      <div className="container mx-auto max-w-2xl space-y-4 px-4 py-12">
        <h2 className="text-xl font-semibold">Could not open editor</h2>
        <p className="text-muted-foreground">{loadError}</p>
        <Button
          variant="outline"
          onClick={() => router.push(`/knowledge/${ontologyClass.key}`)}
        >
          Back to {ontologyClass.labelPlural}
        </Button>
      </div>
    );
  }

  const mainTitle = isEditMode
    ? `Edit ${ontologyClass.label}`
    : title || `Contribute ${ontologyClass.label}`;
  const mainDescription = isEditMode
    ? `You are editing record ${
        recordMeta?.id ?? recordId
      }${recordMeta?.status ? `. Status: ${String(recordMeta.status).replace(/_/g, " ")}` : ""}${
        recordMeta?.contributor
          ? `. Contributor: @${recordMeta.contributor}`
          : ""
      }.`
    : description ||
      ontologyClass.description ||
      `Add a new ${ontologyClass.label.toLowerCase()} to the knowledge base.`;

  if (!hasSections) {
    return (
      <div className="container max-w-2xl mx-auto space-y-6 px-4 lg:px-6">
        <div>
          <button
            onClick={() => router.push("/contribute")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 inline-flex items-center gap-1"
          >
            ← Back to contribute
          </button>
          <h1 className="text-2xl font-bold">
            {mainTitle}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {mainDescription}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {isEditMode
                ? `${ontologyClass.label} (editing)`
                : `${ontologyClass.label} information`}
            </CardTitle>
            <CardDescription>
              {isSignedIn
                ? isEditMode
                  ? "Change the fields you need, then save."
                  : `Provide details about this ${ontologyClass.label.toLowerCase()}.`
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
                hasError={shouldShowError(field)}
              />
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={clearForm}
            disabled={!isSignedIn || isEditMode}
            title={isEditMode ? "Clear is disabled while editing" : undefined}
          >
            Clear
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !isSignedIn}
            className="min-w-28"
          >
            {!isSignedIn ? (
              "Sign In to Submit"
            ) : isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {isEditMode ? "Saving…" : "Submitting…"}
              </span>
            ) : isEditMode ? (
              "Save changes"
            ) : (
              "Submit"
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto space-y-5 px-4 lg:px-6">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push("/contribute")}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 inline-flex items-center gap-1"
        >
          ← Back to contribute
        </button>
        <h1 className="text-2xl font-bold">
          {mainTitle}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {mainDescription}
        </p>
      </div>

      {/* Progress bar */}
      <ProgressBar filled={totalProgress.filled} total={totalProgress.total} />

      {/* Step navigation */}
      <StepNav
        sections={sections}
        currentStep={currentStep}
        onStepClick={setCurrentStep}
        sectionProgress={sectionProgress}
      />

      {/* Current section fields */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">
                {sections[currentStep].label}
              </CardTitle>
              <CardDescription>
                {isSignedIn ? (
                  <>
                    Step {currentStep + 1} of {sections.length}
                    {" — "}
                    {sectionProgress[sections[currentStep].key]?.filled || 0} of{" "}
                    {sectionProgress[sections[currentStep].key]?.total || 0}{" "}
                    fields filled
                  </>
                ) : (
                  "Please sign in to submit contributions."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {currentSectionFields.map((field) => (
                <FieldRenderer
                  key={field.key}
                  field={field}
                  value={formData[field.key]}
                  onChange={updateField}
                  disabled={!isSignedIn}
                  hasError={shouldShowError(field)}
                />
              ))}
              {currentSectionFields.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No fields in this section.
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Navigation + submit buttons */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={goPrev}
            disabled={currentStep === 0}
            size="sm"
          >
            ← Previous
          </Button>
          {!isLastStep && (
            <Button variant="outline" onClick={goNext} size="sm">
              Next →
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={clearForm}
            disabled={!isSignedIn || isEditMode}
            size="sm"
            title={isEditMode ? "Clear is disabled while editing" : undefined}
          >
            Clear
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !isSignedIn}
            className="min-w-28"
          >
            {!isSignedIn ? (
              "Sign In to Submit"
            ) : isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {isEditMode ? "Saving…" : "Submitting…"}
              </span>
            ) : isEditMode ? (
              "Save changes"
            ) : (
              "Submit contribution"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
