"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";

import { ProgressBar } from "@/components/ontology-form/progress-bar";
import { StepNav } from "@/components/ontology-form/step-nav";
import { CompletenessMeter } from "@/components/ontology-form/completeness-meter";

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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { getPublicApiUrl } from "@/lib/api-base";
import {
  buildOntologyFormPayload,
  mapCidocRecordToFormData,
} from "@/lib/ontology/ontology-edit-helpers";
import { useOntology } from "@/lib/ontology/OntologyProvider";
import { validatePayloadAgainstRegistrySchema } from "@/lib/ontology/validate-registry-payload";
import {
  validateRequiredFields,
  validateRequiredFieldsForFieldKeys,
} from "@/lib/ontology/useValidation";
import {
  buildOntologyFormDraftStorageKey,
  clearOntologyFormDraft,
  loadOntologyFormDraft,
  saveOntologyFormDraft,
} from "@/lib/ontology/form-drafts";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Sparkles } from "lucide-react";
import { CidocCrmHint } from "@/components/ontology/CidocCrmHint";
import { HeritageDocumentUpload } from "@/components/ocr/heritage-document-upload";
import { OcrSuggestionBadge } from "@/components/ocr/ocr-suggestion-badge";
import { GeoPointField } from "@/components/ontology-form/geo-point-field";
import type { OcrFieldSuggestion } from "@/hooks/use-heritage-ocr-suggestions";
import { ContributorModeToggle } from "@/components/contribute/contributor-mode-toggle";
import type { ContributorMode } from "@/hooks/use-contributor-mode";

/** Map `?step=` (section key or numeric index) to a valid section index and canonical URL key. */
function resolveOntologyFormStep(
  stepParam: string | null,
  sections: readonly { key: string }[]
): { index: number; canonicalKey: string } {
  if (!sections.length) return { index: 0, canonicalKey: "basic" };
  const raw = stepParam?.trim() ?? "";
  if (!raw) {
    return { index: 0, canonicalKey: sections[0].key };
  }
  const asIdx = Number.parseInt(raw, 10);
  if (
    !Number.isNaN(asIdx) &&
    Number.isFinite(asIdx) &&
    asIdx >= 0 &&
    asIdx < sections.length
  ) {
    return { index: asIdx, canonicalKey: sections[asIdx].key };
  }
  const byKey = sections.findIndex((s) => s.key === raw);
  if (byKey >= 0) {
    return { index: byKey, canonicalKey: sections[byKey].key };
  }
  return { index: 0, canonicalKey: sections[0].key };
}

function simplifyHelpTextForBasicMode(text?: string): string | undefined {
  if (!text) return text;
  // Remove technical ontology/RDF jargon that confuses non-experts
  const normalized = text
    .replace(/CIDOC-CRM|PROV-O|assertion|RDF|URI|namespace|predicate|ontology|triple|reification/gi, "")
    .replace(/\(E\d+.*?\)/g, "") // Remove CIDOC class codes like (E22)
    .replace(/\(P\d+.*?\)/g, "") // Remove CIDOC property codes like (P102)
    .replace(/\s+/g, " ")
    .trim();
    
  // Take only the first sentence for "Basic" mode to keep it readable
  const firstSentence = normalized.split(/(?<=[.!?])\s+/)[0]?.trim();
  if (!firstSentence) return undefined;
  
  return firstSentence.length > 150
    ? `${firstSentence.slice(0, 147)}...`
    : firstSentence;
}

function FieldRenderer({
  field,
  value,
  onChange,
  disabled = false,
  hasError,
  errorMessage,
  onAssistClick,
  assistPending,
  assistConfidence,
  basicMode = false,
  showOntologyHint = true,
}: {
  field: OntologyField;
  value: any;
  onChange: (key: string, value: any) => void;
  disabled?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  onAssistClick?: () => void;
  assistPending?: boolean;
  assistConfidence?: number;
  basicMode?: boolean;
  showOntologyHint?: boolean;
}) {
  const id = `field-${field.key}`;
  const errorRing = hasError
    ? "ring-2 ring-red-400/50 border-red-300 dark:border-red-700"
    : "";

  const labelEl = (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <Label
          htmlFor={id}
          className={cn(hasError && "text-red-600 dark:text-red-400")}
        >
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </Label>
        {assistConfidence != null && assistConfidence >= 0 ? (
          <OcrSuggestionBadge confidence={assistConfidence} className="shrink-0" />
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onAssistClick ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onAssistClick}
            disabled={Boolean(disabled) || assistPending}
            aria-label={`Suggest value for ${field.label}`}
            title="AI suggest (uses current form values)"
          >
            <Sparkles className="h-4 w-4" />
          </Button>
        ) : null}
        {showOntologyHint ? <CidocCrmHint slotUri={field.slot_uri} /> : null}
      </div>
    </div>
  );

  const helpText = basicMode
    ? simplifyHelpTextForBasicMode(field.description)
    : field.description;

  const descEl = helpText ? (
    <p className="text-xs text-muted-foreground mb-1.5">{helpText}</p>
  ) : null;

  const errorFooter = errorMessage ? (
    <p className="text-xs text-red-600 dark:text-red-400" role="alert">
      {errorMessage}
    </p>
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
          {errorFooter}
        </div>
      );

    case "select": {
      const opts = field.options || [];
      const noChoices = opts.length === 0;
      return (
        <div className="space-y-1">
          {labelEl}
          {descEl}
          {noChoices ? (
            <p className="text-xs text-amber-700 dark:text-amber-400/90 rounded-md border border-amber-200/80 bg-amber-50/60 px-2 py-1.5 dark:border-amber-900/40 dark:bg-amber-950/25">
              No choices were loaded for this dropdown (
              {field.enum_range ? (
                <>
                  enum <code className="font-mono">{field.enum_range}</code>
                </>
              ) : (
                "unknown enum"
              )}
              ). The schema snapshot may be incomplete, or the enum has no permissible values.
              Try refreshing; if it persists, the ontology needs to be regenerated (
              <code className="font-mono">make ontology</code>).
            </p>
          ) : null}
          <Select
            value={value || ""}
            onValueChange={(v) => onChange(field.key, v)}
            disabled={disabled || noChoices}
          >
            <SelectTrigger className={errorRing}>
              <SelectValue
                placeholder={
                  noChoices
                    ? "No options available"
                    : `Select ${field.label.toLowerCase()}`
                }
              />
            </SelectTrigger>
            <SelectContent>
              {opts.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errorFooter}
        </div>
      );
    }

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
          {errorFooter}
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
          {errorFooter}
        </div>
      );

    case "boolean":
      return (
        <div className="space-y-1">
          {labelEl}
          {descEl}
          <div className="flex items-center gap-2">
            <Switch
              id={id}
              checked={Boolean(value)}
              onCheckedChange={(v) => onChange(field.key, v)}
              disabled={disabled}
            />
            <span className="text-sm text-muted-foreground">
              {value ? "Yes" : "No"}
            </span>
          </div>
          {errorFooter}
        </div>
      );

    case "multiselect": {
      const opts = field.options || [];
      const selected: string[] = Array.isArray(value)
        ? (value as string[])
        : typeof value === "string" && value
          ? value.split(",").map((s) => s.trim()).filter(Boolean)
          : [];
      const toggle = (optVal: string) => {
        const set = new Set(selected);
        if (set.has(optVal)) set.delete(optVal);
        else set.add(optVal);
        onChange(field.key, [...set]);
      };
      return (
        <div className="space-y-2">
          {labelEl}
          {descEl}
          <div className="space-y-2 rounded-md border border-border p-3">
            {opts.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <Checkbox
                  checked={selected.includes(opt.value)}
                  onCheckedChange={() => toggle(opt.value)}
                  disabled={disabled}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
          {errorFooter}
        </div>
      );
    }

    case "edtf_date": {
      const edtfChips = [
        { label: "c. 1200 CE", v: "1200~" },
        { label: "13th c.", v: "1200/1300" },
        { label: "Malla period", v: "Malla period" },
        { label: "NS 1140", v: "NS1140" },
      ];
      return (
        <div className="space-y-1">
          {labelEl}
          {descEl}
          <div className="flex flex-wrap gap-1.5 pb-1">
            {edtfChips.map((c) => (
              <Button
                key={c.v}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={disabled}
                onClick={() => onChange(field.key, c.v)}
              >
                {c.label}
              </Button>
            ))}
          </div>
          <Input
            id={id}
            value={value || ""}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder || "e.g. 1200/1300 or 1975-05-01"}
            disabled={disabled}
            className={errorRing}
          />
          <p className="text-xs text-muted-foreground">
            {basicMode
              ? "Use an approximate date expression when exact dates are unknown."
              : "Use EDTF-style strings for imprecise heritage dates (ISO 8601-2). Quick picks set common patterns; refine in the field or use a NS↔BS converter in the docs."}
          </p>
          {errorFooter}
        </div>
      );
    }

    case "geo_point":
      return (
        <div className="space-y-1">
          {labelEl}
          {descEl}
          <GeoPointField
            idPrefix={id}
            value={value}
            onChange={(next) => onChange(field.key, next)}
            disabled={disabled}
            errorRing={errorRing}
          />
          {errorFooter}
        </div>
      );

    case "media":
      return (
        <div className="space-y-1">
          {labelEl}
          {descEl}
          <Input
            id={id}
            type="file"
            accept="image/*"
            capture="environment"
            multiple={Boolean(field.multivalued)}
            disabled={disabled}
            className={errorRing}
            onChange={async (e) => {
              const files = e.target.files;
              if (!files?.length) return;
              try {
                const exifr = await import("exifr");
                const previews: { name: string; previewUrl: string; exifLat?: number; exifLng?: number }[] = [];
                for (const file of Array.from(files)) {
                  const url = URL.createObjectURL(file);
                  let exifLat: number | undefined;
                  let exifLng: number | undefined;
                  try {
                    const gps = await exifr.gps(file);
                    if (gps?.latitude != null && gps?.longitude != null) {
                      exifLat = gps.latitude;
                      exifLng = gps.longitude;
                    }
                  } catch {
                    // ignore EXIF parse errors
                  }
                  previews.push({
                    name: file.name,
                    previewUrl: url,
                    exifLat,
                    exifLng,
                  });
                }
                onChange(field.key, previews);
                const first = previews.find((p) => p.exifLat != null && p.exifLng != null);
                if (first?.exifLat != null && first?.exifLng != null) {
                  toast.message("GPS from image metadata detected — check map fields if present.");
                }
              } catch {
                toast.error("Could not read image metadata.");
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            Fieldwork capture: photos are held client-side until you wire a Media API; EXIF GPS
            is parsed when available.
          </p>
          {errorFooter}
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
          {errorFooter}
        </div>
      );

    case "relation": {
      if (field.multivalued) {
        const items: SearchResult[] = Array.isArray(value)
          ? (value as SearchResult[])
          : typeof value === "string" && value.trim()
            ? value.split(",").map((s) => ({
                id: s.trim(),
                name: s.trim(),
              }))
            : [];

        const handleAdd = (entity: SearchResult | null) => {
          if (!entity) return;
          const updated = [...items];
          if (!updated.some((x) => String(x.id) === String(entity.id))) {
            updated.push({ id: entity.id, name: entity.name });
          }
          onChange(field.key, updated);
        };

        const handleRemove = (id: string | number) => {
          const updated = items.filter((x) => String(x.id) !== String(id));
          onChange(field.key, updated);
        };

        return (
          <div className="space-y-1">
            {labelEl}
            {descEl}
            {items.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {items.map((ent) => (
                  <span
                    key={String(ent.id)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-sm"
                  >
                    {ent.name}
                    {!disabled && (
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground text-xs ml-0.5"
                        onClick={() => handleRemove(ent.id)}
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
            {errorFooter}
          </div>
        );
      }

      const selectedEntity: SearchResult | null =
        value && typeof value === "object" && value !== null && "name" in value
          ? (value as SearchResult)
          : value
            ? {
                id: 0,
                name: typeof value === "string" ? value : String(value),
              }
            : null;

      return (
        <div className="space-y-1">
          {labelEl}
          {descEl}
          <EntitySearch
            label=""
            endpoint={field.relationEndpoint || ""}
            value={selectedEntity}
            onSelect={(entity) =>
              onChange(
                field.key,
                entity ? { id: entity.id, name: entity.name } : ""
              )
            }
            placeholder={`Search ${field.label?.toLowerCase() || "entities"}...`}
            allowCreate
            disabled={disabled}
            hasError={hasError}
          />
          {errorFooter}
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
          {errorFooter}
        </div>
      );
  }
}

export interface OntologyFormProps {
  ontologyClass: OntologyClass;
  redirectTo?: string;
  apiBaseUrl?: string;
  title?: string;
  description?: string;
  onFormControl?: (api: OntologyFormControlApi) => void;
  /** When set, shows OCR upload that applies suggestions to empty fields (requires signed-in user). */
  ocrCulturalEntityId?: string | null;
  contributorMode?: ContributorMode;
  onContributorModeChange?: (mode: ContributorMode) => void | Promise<boolean>;
  contributorModeLoading?: boolean;
  contributorModeSaving?: boolean;
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
  ocrCulturalEntityId,
  contributorMode = "basic",
  onContributorModeChange,
  contributorModeLoading = false,
  contributorModeSaving = false,
}: OntologyFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const recordId = searchParams.get("id")?.trim() || null;
  const isEditMode = Boolean(recordId);
  const { data: session, status } = useSession();
  const { registry, schemaVersion } = useOntology();
  const isSignedIn = status === "authenticated";
  const assistEnabled =
    Boolean((session as { accessToken?: string } | null)?.accessToken) &&
    ontologyClass.apiEndpoint.startsWith("/cidoc/");
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [suggestKey, setSuggestKey] = useState<string | null>(null);
  const [ocrFieldConfidence, setOcrFieldConfidence] = useState<Record<string, number>>({});
  const [lastOcrDocumentId, setLastOcrDocumentId] = useState<string | null>(null);
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  /** Prevents double draft hydration (e.g. React StrictMode) for the same storage key. */
  const draftAppliedForKey = useRef<string | null>(null);

  const userDraftKey = useMemo(() => {
    const u = session?.user as
      | { email?: string | null; name?: string | null }
      | undefined;
    return (u?.email || u?.name || "anon").trim() || "anon";
  }, [session]);

  const draftStorageKey = useMemo(
    () =>
      buildOntologyFormDraftStorageKey({
        userKey: userDraftKey,
        ontologyClassKey: ontologyClass.key,
        mode: isEditMode ? "edit" : "new",
        recordId,
      }),
    [userDraftKey, ontologyClass.key, isEditMode, recordId]
  );

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
        setEditLoad("ok");
        const loadedSections = ontologyClass.sections || [{ key: "basic" }];
        if (loadedSections.length > 1 && pathname) {
          const p = new URLSearchParams(searchParams.toString());
          p.set("step", loadedSections[0].key);
          router.replace(`${pathname}?${p.toString()}`, { scroll: false });
        }
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
  }, [
    baseUrl,
    ontologyClass,
    recordId,
    session,
    pathname,
    router,
    searchParams,
  ]);
  const postSubmitPath =
    redirectTo || `/knowledge/${ontologyClass.key}`;

  const sortedFields = useMemo(
    () =>
      [...ontologyClass.fields].sort(
        (a, b) => (a.order ?? 99) - (b.order ?? 99)
      ),
    [ontologyClass.fields]
  );

  const isBasicMode = contributorMode === "basic";

  const visibleSortedFields = useMemo(() => {
    if (!isBasicMode) return sortedFields;
    if (showOptionalDetails) return sortedFields;
    return sortedFields.filter((f) => Boolean(f.required));
  }, [isBasicMode, showOptionalDetails, sortedFields]);

  const sections = ontologyClass.sections || [
    { key: "basic", label: "Information" },
  ];

  const fieldsBySection = useMemo(() => {
    const grouped: Record<string, OntologyField[]> = {};
    for (const section of sections) {
      grouped[section.key] = visibleSortedFields.filter(
        (f) => (f.section || "basic") === section.key
      );
    }
    return grouped;
  }, [visibleSortedFields, sections]);

  const hasSections = sections.length > 1;

  const currentSectionIndex = useMemo(() => {
    if (!hasSections) return 0;
    return resolveOntologyFormStep(searchParams.get("step"), sections).index;
  }, [hasSections, searchParams, sections]);

  useEffect(() => {
    if (isBasicMode) {
      setShowOptionalDetails(false);
    }
  }, [isBasicMode, currentSectionIndex]);

  useEffect(() => {
    if (!hasSections || !pathname) return;
    const raw = searchParams.get("step");
    const { canonicalKey } = resolveOntologyFormStep(raw, sections);
    if (raw !== canonicalKey) {
      const p = new URLSearchParams(searchParams.toString());
      p.set("step", canonicalKey);
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    }
  }, [hasSections, pathname, router, searchParams, sections]);

  useEffect(() => {
    draftAppliedForKey.current = null;
  }, [ontologyClass.key, isEditMode, recordId]);

  useEffect(() => {
    if (isEditMode) return;
    if (draftAppliedForKey.current === draftStorageKey) return;
    draftAppliedForKey.current = draftStorageKey;
    let cancelled = false;
    void (async () => {
      const draft = await loadOntologyFormDraft(draftStorageKey);
      if (cancelled) return;
      if (draft?.formData && typeof draft.formData === "object") {
        const keys = Object.keys(draft.formData as object);
        if (keys.length > 0) {
          setFormData(draft.formData as Record<string, any>);
          toast.info("Restored your draft from this browser.", {
            id: `ontology-draft-${draftStorageKey}`,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draftStorageKey, isEditMode]);

  useEffect(() => {
    if (isEditMode) return;
    const handle = window.setTimeout(() => {
      void saveOntologyFormDraft(draftStorageKey, {
        formData: formData as Record<string, unknown>,
        schemaVersion: schemaVersion ?? registry.schema_version ?? null,
        savedAt: new Date().toISOString(),
      });
    }, 700);
    return () => window.clearTimeout(handle);
  }, [
    formData,
    draftStorageKey,
    isEditMode,
    schemaVersion,
    registry.schema_version,
  ]);

  const goNext = useCallback(() => {
    if (!hasSections || currentSectionIndex >= sections.length - 1 || !pathname)
      return;
    const sectionKey = sections[currentSectionIndex].key;
    const keys = (fieldsBySection[sectionKey] || []).map((f) => f.key);
    const errs = validateRequiredFieldsForFieldKeys(
      ontologyClass,
      keys,
      formData as Record<string, unknown>
    );
    if (Object.keys(errs).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...errs }));
      setTouchedFields((prev) => {
        const n = new Set(prev);
        for (const k of Object.keys(errs)) n.add(k);
        return n;
      });
      toast.error("Please complete required fields in this section.");
      return;
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      for (const k of keys) delete next[k];
      return next;
    });
    const nextIdx = currentSectionIndex + 1;
    const p = new URLSearchParams(searchParams.toString());
    p.set("step", sections[nextIdx].key);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }, [
    hasSections,
    currentSectionIndex,
    sections,
    fieldsBySection,
    ontologyClass,
    formData,
    searchParams,
    pathname,
    router,
  ]);

  const goPrev = useCallback(() => {
    if (!hasSections || currentSectionIndex <= 0 || !pathname) return;
    const prevIdx = currentSectionIndex - 1;
    const p = new URLSearchParams(searchParams.toString());
    p.set("step", sections[prevIdx].key);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }, [hasSections, currentSectionIndex, sections, searchParams, pathname, router]);

  const handleStepNavClick = useCallback(
    (idx: number) => {
      if (!hasSections || !pathname) return;
      if (idx === currentSectionIndex) return;
      if (idx > currentSectionIndex) {
        for (let i = currentSectionIndex; i < idx; i++) {
          const keys = (fieldsBySection[sections[i].key] || []).map((f) => f.key);
          const errs = validateRequiredFieldsForFieldKeys(
            ontologyClass,
            keys,
            formData as Record<string, unknown>
          );
          if (Object.keys(errs).length > 0) {
            setFieldErrors((prev) => ({ ...prev, ...errs }));
            setTouchedFields((prev) => {
              const n = new Set(prev);
              for (const k of Object.keys(errs)) n.add(k);
              return n;
            });
            toast.error(
              "Please complete required fields in earlier sections before skipping ahead."
            );
            return;
          }
          setFieldErrors((prev) => {
            const next = { ...prev };
            for (const k of keys) delete next[k];
            return next;
          });
        }
      }
      const p = new URLSearchParams(searchParams.toString());
      p.set("step", sections[idx].key);
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [
      hasSections,
      pathname,
      currentSectionIndex,
      sections,
      fieldsBySection,
      ontologyClass,
      formData,
      searchParams,
      router,
    ]
  );

  const isFieldFilled = useCallback(
    (field: OntologyField) => {
      const val = formData[field.key];
      if (val === undefined || val === null || val === "") return false;
      if (Array.isArray(val) && val.length === 0) return false;
      if (field.type === "multiselect") {
        return Array.isArray(val) && val.length > 0;
      }
      if (field.type === "relation" && field.multivalued) {
        return Array.isArray(val) && val.length > 0;
      }
      if (field.type === "relation" && !field.multivalued) {
        if (val && typeof val === "object" && "id" in (val as object)) {
          return true;
        }
        return typeof val === "string" && val.trim() !== "";
      }
      if (
        (field.type === "coordinates" || field.type === "geo_point") &&
        val &&
        typeof val === "object"
      ) {
        const o = val as { lat?: unknown; lng?: unknown };
        const lat = String(o.lat ?? "").trim();
        const lng = String(o.lng ?? "").trim();
        return Boolean(lat && lng);
      }
      if (field.type === "geo_point" && typeof val === "string") {
        return val.trim().length > 0;
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
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
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

  const onFieldSuggest = useCallback(
    async (field: OntologyField) => {
      const token = (session as { accessToken?: string } | null)?.accessToken;
      if (!token) {
        toast.error("Sign in to use field assist.");
        return;
      }
      setSuggestKey(field.key);
      try {
        const url = `${baseUrl}/api/v1/cidoc/assist/suggest-field/`;
        const data = await apiFetchJson<{
          suggestion?: string;
          confidence?: number;
        }>(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ontology_class: ontologyClass.key,
            field_key: field.key,
            partial_payload: formData,
          }),
        });
        const s = data.suggestion;
        if (s === undefined || s === null || String(s).trim() === "") {
          toast.message("No suggestion returned.");
          return;
        }
        updateField(field.key, s);
        if (typeof data.confidence === "number") {
          setOcrFieldConfidence((p) => ({ ...p, [field.key]: data.confidence! }));
        }
        toast.success("Suggestion applied.");
      } catch (e: unknown) {
        toast.error(getApiErrorMessage(e, "Assist failed."));
      } finally {
        setSuggestKey(null);
      }
    },
    [baseUrl, formData, ontologyClass.key, session, updateField]
  );

  const ocrApplyFromUpload = useCallback(
    (
      suggestions: Record<string, OcrFieldSuggestion>,
      meta?: { uploadedDocumentId?: string | null }
    ) => {
      const patch: Record<string, unknown> = {};
      const conf: Record<string, number> = {};
      for (const [k, s] of Object.entries(suggestions)) {
        if (!k || !s) continue;
        patch[k] = s.value;
        conf[k] = s.confidence;
      }
      mergeValues(patch as Record<string, any>, { onlyIfEmpty: true });
      setOcrFieldConfidence((prev) => ({ ...prev, ...conf }));
      if (meta?.uploadedDocumentId) {
        setLastOcrDocumentId(meta.uploadedDocumentId);
      }
      const n = Object.keys(patch).length;
      if (n === 0) {
        toast.message("No suggestions to merge.");
      } else {
        toast.success(`Merged up to ${n} OCR field hints (empty fields only).`);
      }
    },
    [mergeValues]
  );

  const getValues = useCallback(() => formData, [formData]);

  useEffect(() => {
    if (!onFormControl) return;
    onFormControl({ mergeValues, getValues });
  }, [onFormControl, mergeValues, getValues]);

  const performClearForm = useCallback(() => {
    if (isEditMode) {
      return;
    }
    void clearOntologyFormDraft(draftStorageKey);
    setFormData({});
    setTouchedFields(new Set());
    setSubmitAttempted(false);
    setFieldErrors({});
    if (hasSections && pathname) {
      const p = new URLSearchParams(searchParams.toString());
      p.set("step", sections[0].key);
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    }
    toast.info("Form cleared");
    setClearConfirmOpen(false);
  }, [
    isEditMode,
    draftStorageKey,
    hasSections,
    pathname,
    router,
    searchParams,
    sections,
  ]);

  const validate = useCallback((): boolean => {
    const errors = validateRequiredFields(ontologyClass, formData);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Please fix the highlighted fields.");
      return false;
    }
    const schemaErrors = validatePayloadAgainstRegistrySchema(
      registry.registry_jsonschema,
      ontologyClass.key,
      formData as Record<string, unknown>
    );
    const schemaKeys = Object.keys(schemaErrors);
    if (schemaKeys.length > 0) {
      const { __non_field__, ...perField } = schemaErrors;
      setFieldErrors((prev) => ({ ...prev, ...perField }));
      const firstMsg =
        __non_field__ ||
        Object.values(perField)[0] ||
        "Validation failed.";
      toast.error(firstMsg);
      return false;
    }
    setFieldErrors({});
    return true;
  }, [formData, ontologyClass, registry.registry_jsonschema]);

  const openSubmitConfirm = () => {
    setSubmitAttempted(true);
    if (!validate()) return;
    if (!isSignedIn) {
      toast.error("Please sign in to submit contributions.");
      return;
    }
    setSubmitConfirmOpen(true);
  };

  const handleSubmit = async () => {
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
        setSubmitConfirmOpen(false);
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

      await clearOntologyFormDraft(draftStorageKey);

      setSubmitConfirmOpen(false);
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
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const entryDisplayName =
    (formData.name as string) ||
    (formData.title as string) ||
    "this entry";

  const shouldShowError = (field: OntologyField) => {
    if (fieldErrors[field.key]) return true;
    if (!field.required) return false;
    const val = formData[field.key];
    let isEmpty =
      val === undefined ||
      val === null ||
      val === "" ||
      (Array.isArray(val) && val.length === 0);
    if (
      (field.type === "coordinates" || field.type === "geo_point") &&
      val &&
      typeof val === "object"
    ) {
      isEmpty =
        !String((val as { lat?: unknown }).lat ?? "").trim() &&
        !String((val as { lng?: unknown }).lng ?? "").trim();
    }
    if (field.type === "geo_point" && typeof val === "string") {
      isEmpty = val.trim() === "";
    }
    if (field.type === "relation" && !field.multivalued) {
      if (val && typeof val === "object" && val !== null && "id" in val) {
        isEmpty = false;
      } else if (typeof val === "string" && val.trim() !== "") {
        isEmpty = false;
      } else {
        isEmpty = true;
      }
    }
    return isEmpty && (submitAttempted || touchedFields.has(field.key));
  };

  const currentSectionFields =
    fieldsBySection[sections[currentSectionIndex]?.key] || [];

  const isLastStep = currentSectionIndex === sections.length - 1;

  const currentOptionalHiddenCount = useMemo(() => {
    if (!isBasicMode || showOptionalDetails) return 0;
    const sectionKey = sections[currentSectionIndex]?.key || "basic";
    return sortedFields.filter(
      (f) => (f.section || "basic") === sectionKey && !f.required
    ).length;
  }, [
    isBasicMode,
    showOptionalDetails,
    sections,
    currentSectionIndex,
    sortedFields,
  ]);

  const modeControls = (
    <div className="space-y-2">
      <ContributorModeToggle
        mode={contributorMode}
        isLoading={contributorModeLoading}
        isSaving={contributorModeSaving}
        onModeChange={(next) => {
          if (!onContributorModeChange) return;
          void onContributorModeChange(next);
        }}
      />
      {isBasicMode && currentOptionalHiddenCount > 0 ? (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-blue-100 bg-blue-50/30 px-4 py-2.5 text-[11px] text-blue-700 dark:border-blue-900/30 dark:bg-blue-950/10 dark:text-blue-400">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3 w-3 opacity-70" />
            <p className="font-medium">
              Summarized view: {currentOptionalHiddenCount} optional field
              {currentOptionalHiddenCount === 1 ? " is" : "s are"} hidden.
            </p>
          </div>
          <Button
            type="button"
            variant="link"
            className="h-auto px-0 py-0 text-[11px] font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            onClick={() => setShowOptionalDetails(true)}
          >
            Reveal all fields
          </Button>
        </div>
      ) : null}
      {isBasicMode && showOptionalDetails ? (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Optional details are visible for this step.
          <Button
            type="button"
            variant="link"
            className="ml-2 h-auto px-0 py-0 text-xs"
            onClick={() => setShowOptionalDetails(false)}
          >
            Hide again
          </Button>
        </div>
      ) : null}
    </div>
  );
  const showModeControls = Boolean(onContributorModeChange);

  if (sortedFields.length === 0) {
    return (
      <div className="container mx-auto max-w-2xl space-y-6 px-4 py-12">
        <Alert className="border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/30">
          <AlertCircle className="text-amber-700 dark:text-amber-400" />
          <AlertTitle className="text-amber-950 dark:text-amber-100">
            This form has no fields in the loaded schema
          </AlertTitle>
          <AlertDescription className="space-y-2 text-amber-950/90 dark:text-amber-100/90">
            <p>
              The registry entry for{" "}
              <strong className="text-foreground">{ontologyClass.label}</strong> (
              <code className="rounded bg-muted px-1 font-mono text-xs text-foreground">
                {ontologyClass.key}
              </code>
              ) exists, but its field list is empty. That usually means the LinkML class has
              no induced slots mapped for the UI, or generation failed partway through.
            </p>
            <p className="text-sm">
              <strong className="text-foreground">What you can do:</strong> try refreshing
              the page or signing in so the latest schema loads. If it persists, report it—
              maintainers should verify{" "}
              <code className="rounded bg-background px-1 font-mono text-xs">ontology/HeritageGraph.yaml</code>{" "}
              and{" "}
              <code className="rounded bg-background px-1 font-mono text-xs">tools/ui-classmap.yaml</code>
              , then run <code className="rounded bg-background px-1 font-mono text-xs">make ontology</code>.
            </p>
          </AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => router.push("/contribute")}>
          Back to Contribute
        </Button>
      </div>
    );
  }

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
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not open editor</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{loadError}</p>
            <p className="text-sm opacity-90">
              The form definition loaded, but the record could not be fetched. Common causes:
              the record was deleted, you do not have permission, the API is down, or your
              session expired. Try signing in again or open the list view and pick the item
              from there.
            </p>
          </AlertDescription>
        </Alert>
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

  const submitConfirmDialogs = (
    <>
      <ConfirmActionDialog
        open={submitConfirmOpen}
        onOpenChange={setSubmitConfirmOpen}
        title={
          isEditMode
            ? "Save changes to this record?"
            : "Submit this contribution?"
        }
        description={
          isEditMode ? (
            <>
              Updates to <span className="font-medium text-foreground">{entryDisplayName}</span> will
              be sent to the server and may enter the review workflow.
            </>
          ) : (
            <>
              You are about to submit <span className="font-medium text-foreground">{entryDisplayName}</span> as a new{" "}
              {ontologyClass.label.toLowerCase()}. It will enter the review queue.
            </>
          )
        }
        confirmLabel={isEditMode ? "Save changes" : "Submit"}
        onConfirm={handleSubmit}
        isPending={isSubmitting}
      />
      <ConfirmActionDialog
        open={clearConfirmOpen}
        onOpenChange={setClearConfirmOpen}
        title="Clear all fields?"
        description="All entered data on this form will be removed. This cannot be undone."
        confirmLabel="Clear form"
        confirmVariant="destructive"
        onConfirm={async () => {
          performClearForm();
        }}
      />
    </>
  );

  if (!hasSections) {
    return (
      <div className="container max-w-2xl mx-auto space-y-6 px-4 lg:px-6">
        {submitConfirmDialogs}
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

        <CompletenessMeter ontologyClass={ontologyClass} values={formData} />

        {showModeControls ? modeControls : null}

        {ocrCulturalEntityId ? (
          <HeritageDocumentUpload
            culturalEntityId={ocrCulturalEntityId}
            onApply={ocrApplyFromUpload}
            className="max-w-2xl"
          />
        ) : null}
        {ocrCulturalEntityId && lastOcrDocumentId ? (
          <details className="max-w-2xl rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">
              OCR job & provenance trace
            </summary>
            <p className="mt-2 break-all font-mono">{lastOcrDocumentId}</p>
            <p className="mt-1">
              Suggestions applied above are linked to this document id for reviewer traceability.
            </p>
          </details>
        ) : null}

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
            {visibleSortedFields.map((field) => (
              <FieldRenderer
                key={field.key}
                field={field}
                value={formData[field.key]}
                onChange={updateField}
                disabled={!isSignedIn}
                hasError={shouldShowError(field)}
                errorMessage={fieldErrors[field.key]}
                onAssistClick={
                  assistEnabled ? () => void onFieldSuggest(field) : undefined
                }
                assistPending={suggestKey === field.key}
                assistConfidence={ocrFieldConfidence[field.key]}
                basicMode={isBasicMode}
                showOntologyHint={!isBasicMode}
              />
            ))}
            {visibleSortedFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No required fields are visible in basic mode for this form.
                Use the optional-details toggle above or switch to advanced mode.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => setClearConfirmOpen(true)}
            disabled={!isSignedIn || isEditMode}
            title={isEditMode ? "Clear is disabled while editing" : undefined}
          >
            Clear
          </Button>
          <Button
            onClick={openSubmitConfirm}
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
      {submitConfirmDialogs}
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

      <CompletenessMeter ontologyClass={ontologyClass} values={formData} />

      {showModeControls ? modeControls : null}

      {ocrCulturalEntityId ? (
        <HeritageDocumentUpload
          culturalEntityId={ocrCulturalEntityId}
          onApply={ocrApplyFromUpload}
          className="max-w-2xl"
        />
      ) : null}
      {ocrCulturalEntityId && lastOcrDocumentId ? (
        <details className="max-w-2xl rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">
            OCR job & provenance trace
          </summary>
          <p className="mt-2 break-all font-mono">{lastOcrDocumentId}</p>
          <p className="mt-1">
            Suggestions applied above are linked to this document id for reviewer traceability.
          </p>
        </details>
      ) : null}

      {/* Progress bar */}
      <ProgressBar filled={totalProgress.filled} total={totalProgress.total} />

      {/* Step navigation */}
      <StepNav
        sections={sections}
        currentStep={currentSectionIndex}
        onStepClick={handleStepNavClick}
        sectionProgress={sectionProgress}
      />

      {/* Current section fields */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSectionIndex}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">
                {sections[currentSectionIndex].label}
              </CardTitle>
              <CardDescription>
                {isSignedIn ? (
                  <>
                    Step {currentSectionIndex + 1} of {sections.length}
                    {" — "}
                    {sectionProgress[sections[currentSectionIndex].key]?.filled || 0} of{" "}
                    {sectionProgress[sections[currentSectionIndex].key]?.total || 0}{" "}
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
                  errorMessage={fieldErrors[field.key]}
                  onAssistClick={
                    assistEnabled ? () => void onFieldSuggest(field) : undefined
                  }
                  assistPending={suggestKey === field.key}
                  assistConfidence={ocrFieldConfidence[field.key]}
                  basicMode={isBasicMode}
                  showOntologyHint={!isBasicMode}
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
            disabled={currentSectionIndex === 0}
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
            onClick={() => setClearConfirmOpen(true)}
            disabled={!isSignedIn || isEditMode}
            size="sm"
            title={isEditMode ? "Clear is disabled while editing" : undefined}
          >
            Clear
          </Button>
          <Button
            onClick={openSubmitConfirm}
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
