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
import { SourcePrompt } from "@/components/contribute/source-prompt";

import type { OntologyClass, OntologyField } from "@/lib/ontology/types";
import { apiFetchJson, getApiErrorMessage } from "@/lib/api-client";
import { EntitySearch, type SearchResult } from "@/components/contribute/entity-search";
import { DuplicateContributionAlert } from "@/components/contribute/duplicate-contribution-alert";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { getPublicApiUrl } from "@/lib/api-base";
import {
  appendResumePickParams,
  decodeResumeTarget,
  encodeResumeTarget,
  stripContributeFlowKeys,
  stripResumePickKeys,
} from "@/lib/contribute-resume";
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
import {
  deriveFormGraph,
  formGraphToJsonLd,
  inferRootLabel,
} from "@/lib/ontology/form-graph";
import { OntologyFormGraphPreview } from "@/components/ontology-form/form-graph-preview";
import { OntologyFormPreviewCard } from "@/components/ontology-form/preview-card";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Sparkles } from "lucide-react";
import { FieldHelpHint } from "@/components/ontology/FieldHelpHint";
import { getDateQuickPicks, DATE_FORMAT_LEGEND } from "@/lib/ontology/date-format";
import { HeritageDocumentUpload } from "@/components/ocr/heritage-document-upload";
import { OcrSuggestionBadge } from "@/components/ocr/ocr-suggestion-badge";
import { GeoPointField } from "@/components/ontology-form/geo-point-field";
import Link from "next/link";
import { getContributePathForRegistryKey } from "@/lib/ontology/contribute-intent-routes";
import {
  INGESTION_HANDOFF_STORAGE_KEY,
  type IngestionHandoffPayload,
} from "@/lib/ingestion-api";
import type { OcrFieldSuggestion } from "@/hooks/use-heritage-ocr-suggestions";
import { withContributePlainCopy, plainContributeClassLabel } from "@/lib/ontology/contribute-plain-copy";

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

/** Human-readable constraint hint ("3–200 characters", "Between 0 and 1") from
 *  the registry field's length/range bounds, so laymen know what's accepted. */
function buildFieldConstraintHint(field: OntologyField): string | null {
  if (field.type === "number" || field.type === "float") {
    const { minimum: lo, maximum: hi } = field;
    if (lo != null && hi != null) return `Between ${lo} and ${hi}`;
    if (lo != null) return `Minimum ${lo}`;
    if (hi != null) return `Maximum ${hi}`;
    return null;
  }
  if (field.type === "text" || field.type === "textarea") {
    const { minLength: lo, maxLength: hi } = field;
    if (lo != null && hi != null) return `${lo}–${hi} characters`;
    if (hi != null) return `Up to ${hi} characters`;
    if (lo != null) return `At least ${lo} characters`;
  }
  return null;
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
  showOntologyHint = false,
  getRelatedOntologyClass,
  getFullFormRelationHref,
  apiBaseUrl,
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
  showOntologyHint?: boolean;
  getRelatedOntologyClass?: (f: OntologyField) => OntologyClass | undefined;
  /** When inline authoring is on: URL to open the full contribute form for the related type (with resume). */
  getFullFormRelationHref?: (f: OntologyField) => string | null;
  apiBaseUrl?: string;
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
        <FieldHelpHint
          help={field.help}
          slotUri={showOntologyHint ? field.slot_uri : undefined}
          label={field.label}
        />
      </div>
    </div>
  );

  const helpText = field.description;
  const constraintHint = buildFieldConstraintHint(field);

  const descEl =
    helpText || field.example || constraintHint ? (
      <div className="mb-1.5 space-y-0.5">
        {helpText ? (
          <p className="text-xs text-muted-foreground">{helpText}</p>
        ) : null}
        {field.example ? (
          <p className="text-xs italic text-muted-foreground/90">
            Example: {field.example}
          </p>
        ) : null}
        {constraintHint ? (
          <p className="text-xs text-muted-foreground/80">{constraintHint}</p>
        ) : null}
      </div>
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

    case "date":
    case "edtf_date": {
      const dateChips = getDateQuickPicks();
      return (
        <div className="space-y-1">
          {labelEl}
          {descEl}
          <div className="flex flex-wrap gap-1.5 pb-1">
            {dateChips.map((c) => (
              <Button
                key={c.value}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={disabled}
                onClick={() => onChange(field.key, c.value)}
              >
                {c.label}
              </Button>
            ))}
          </div>
          <Input
            id={id}
            value={value || ""}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder || "e.g. 1857, 1200/1300, or 1975-05-01"}
            disabled={disabled}
            className={errorRing}
          />
          <p className="text-xs text-muted-foreground">{DATE_FORMAT_LEGEND}</p>
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
      const childClass = getRelatedOntologyClass?.(field);
      const showNested =
        Boolean(field.inlineAuthoring) &&
        Boolean(apiBaseUrl) &&
        childClass != null &&
        Boolean(field.relationEndpoint);
      const fullFormHref = getFullFormRelationHref?.(field) ?? null;

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
              disabled={disabled}
              hasError={hasError}
              createHref={fullFormHref ?? undefined}
              createLabel={childClass?.label}
              searchHint={
                showNested
                  ? "No match? Use the full form below to add a record, then return here."
                  : undefined
              }
            />
            {showNested ? (
              <div className="pt-2 space-y-2 border-t border-dashed border-border">
                {fullFormHref ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Or add a new {childClass?.label ?? "record"} with the full contribution form (your draft
                      here is kept in this browser).
                    </p>
                    {disabled ? (
                      <Button type="button" variant="outline" size="sm" disabled>
                        Add new {childClass?.label ?? "record"} (full form)
                      </Button>
                    ) : (
                      <Button type="button" variant="outline" size="sm" asChild>
                        <Link href={fullFormHref}>
                          Add new {childClass?.label ?? "record"} (full form)
                        </Link>
                      </Button>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Search and select existing records for this link.
                  </p>
                )}
              </div>
            ) : null}
            {errorFooter}
          </div>
        );
      }

      let selectedEntity: SearchResult | null = null;
      if (value && typeof value === "object" && value !== null && "id" in value) {
        const o = value as { id: unknown; name?: unknown };
        selectedEntity = {
          id: o.id as string | number,
          name:
            o.name != null && String(o.name).trim() !== ""
              ? String(o.name)
              : `Record ${String(o.id)}`,
        };
      } else if (value !== undefined && value !== null && value !== "") {
        const idRaw =
          typeof value === "number"
            ? value
            : /^\d+$/.test(String(value))
              ? Number(value)
              : value;
        selectedEntity = {
          id: idRaw as string | number,
          name: `Record ${String(idRaw)}`,
        };
      }

      const entitySearchEl = (
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
          disabled={disabled}
          hasError={hasError}
          createHref={fullFormHref ?? undefined}
          createLabel={childClass?.label}
          searchHint={
            showNested
              ? "No match? Use the full form below to add a record, then return here."
              : undefined
          }
        />
      );

      if (!showNested) {
        return (
          <div className="space-y-1">
            {labelEl}
            {descEl}
            {entitySearchEl}
            {errorFooter}
          </div>
        );
      }

      return (
        <div className="space-y-1">
          {labelEl}
          {descEl}
          <div className="space-y-3">
            {entitySearchEl}
            <div className="space-y-2 border-t border-dashed border-border pt-3">
              {fullFormHref ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Or add a new {childClass?.label ?? "record"} with the full contribution form (your draft
                    here is kept in this browser).
                  </p>
                  {disabled ? (
                    <Button type="button" variant="outline" size="sm" disabled>
                      Add new {childClass?.label ?? "record"} (full form)
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" size="sm" asChild>
                      <Link href={fullFormHref}>
                        Add new {childClass?.label ?? "record"} (full form)
                      </Link>
                    </Button>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Search and select an existing record for this link.
                </p>
              )}
            </div>
          </div>
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
  /** URL-encoded internal path (see `encodeResumeTarget`); after successful create, redirect with pick params */
  resumeEncoded?: string | null;
  resumePickRole?: "primary" | "supporting";
  apiBaseUrl?: string;
  title?: string;
  description?: string;
  onFormControl?: (api: OntologyFormControlApi) => void;
  /** When set, shows OCR upload that applies suggestions to empty fields (requires signed-in user). */
  ocrCulturalEntityId?: string | null;
  /** Pre-selected OCR document from a project asset (applies stored field hints on load). */
  ocrUploadedDocumentId?: string | null;
  /**
   * When true, ignores URL `?id=` so embedding under pages that reuse `id` (e.g. proposal drafts)
   * never enters edit mode for this ontology endpoint.
   */
  embeddedCreateOnly?: boolean;
  /** After successful POST: invoked instead of client navigation (modal flows). */
  onContributionCreated?: (result: { id: string }) => void;
}

export type OntologyFormControlApi = {
  mergeValues: (patch: Record<string, any>, opts?: { onlyIfEmpty?: boolean }) => void;
  getValues: () => Record<string, any>;
};

export default function OntologyForm({
  ontologyClass,
  redirectTo,
  resumeEncoded,
  resumePickRole,
  apiBaseUrl,
  title,
  description,
  onFormControl,
  ocrCulturalEntityId,
  ocrUploadedDocumentId,
  embeddedCreateOnly = false,
  onContributionCreated,
}: OntologyFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const recordId = embeddedCreateOnly
    ? null
    : (searchParams.get("id")?.trim() || null);
  const isEditMode = Boolean(recordId);
  const { data: session, status } = useSession();
  const { registry, schemaVersion, getOntologyClass } = useOntology();
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
  /** Prevents double draft hydration (e.g. React StrictMode) for the same storage key. */
  const draftAppliedForKey = useRef<string | null>(null);
  const ingestionHandoffAppliedRef = useRef(false);
  /** After IndexedDB draft load for new entries, so resume pick runs after draft merge. */
  const [draftHydrated, setDraftHydrated] = useState(isEditMode);

  const showFormGraphPreview =
    (typeof process.env.NEXT_PUBLIC_SHOW_FORM_GRAPH === "string" &&
      process.env.NEXT_PUBLIC_SHOW_FORM_GRAPH === "true") ||
    searchParams.get("expert") === "1";
  const showExpertFields = searchParams.get("expert") === "1";
  const [formGraphDraftId] = useState(() =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `draft-${typeof Date !== "undefined" ? Date.now() : "0"}`
  );

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

  const resolveRelatedOntologyClass = useCallback(
    (f: OntologyField) =>
      f.relationRegistryKey
        ? getOntologyClass(f.relationRegistryKey)
        : undefined,
    [getOntologyClass]
  );

  const baseUrl = useMemo(
    () => apiBaseUrl || getPublicApiUrl(),
    [apiBaseUrl]
  );
  const endpoint = `${baseUrl}${ontologyClass.apiEndpoint}`;

  const semanticFormGraphBundle = useMemo(() => {
    if (!showFormGraphPreview) return null;
    const rootLabel = inferRootLabel(ontologyClass, formData);
    const graph = deriveFormGraph({
      ontologyClass,
      formData,
      recordId,
      draftLocalId: formGraphDraftId,
      rootLabel,
    });
    const jsonLd = formGraphToJsonLd(graph, ontologyClass);
    return { graph, jsonLd };
  }, [
    showFormGraphPreview,
    ontologyClass,
    formData,
    recordId,
    formGraphDraftId,
  ]);

  const formGraphPanel =
    semanticFormGraphBundle !== null ? (
      <OntologyFormGraphPreview
        graph={semanticFormGraphBundle.graph}
        jsonLd={semanticFormGraphBundle.jsonLd}
      />
    ) : null;

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
      [...ontologyClass.fields]
        .map((f) => withContributePlainCopy(f, { showExpertFields }) ?? null)
        .filter((f): f is NonNullable<typeof f> => f != null)
        .sort((a, b) => (a.order ?? 99) - (b.order ?? 99)),
    [ontologyClass.fields, showExpertFields]
  );

  const visibleSortedFields = sortedFields;

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
    if (draftAppliedForKey.current === draftStorageKey) {
      setDraftHydrated(true);
      return;
    }
    setDraftHydrated(false);
    draftAppliedForKey.current = draftStorageKey;
    let cancelled = false;
    void (async () => {
      try {
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
      } finally {
        if (!cancelled) setDraftHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draftStorageKey, isEditMode]);

  useEffect(() => {
    if (isEditMode) {
      setDraftHydrated(true);
    }
  }, [isEditMode, draftStorageKey]);

  /** When the most-recent draft autosave landed; null until the first save fires. */
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (isEditMode) return;
    const handle = window.setTimeout(() => {
      void saveOntologyFormDraft(draftStorageKey, {
        formData: formData as Record<string, unknown>,
        schemaVersion: schemaVersion ?? registry.schema_version ?? null,
        savedAt: new Date().toISOString(),
      }).then(() => setDraftSavedAt(Date.now()));
    }, 700);
    return () => window.clearTimeout(handle);
  }, [
    formData,
    draftStorageKey,
    isEditMode,
    schemaVersion,
    registry.schema_version,
  ]);

  /** Human-friendly "saved Xs ago" string, refreshed once a minute. */
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!draftSavedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [draftSavedAt]);
  const draftSavedLabel = useMemo(() => {
    if (!draftSavedAt) return null;
    const seconds = Math.max(0, Math.round((now - draftSavedAt) / 1000));
    if (seconds < 5) return "Draft saved · just now";
    if (seconds < 60) return `Draft saved · ${seconds}s ago`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `Draft saved · ${minutes}m ago`;
    return "Draft saved";
  }, [draftSavedAt, now]);

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

  const getFullFormRelationHref = useCallback(
    (field: OntologyField) => {
      if (!pathname || !field.relationRegistryKey) return null;
      const route = getContributePathForRegistryKey(
        registry,
        field.relationRegistryKey
      );
      if (!route) return null;
      const cleaned = stripContributeFlowKeys(
        new URLSearchParams(searchParams.toString())
      );
      cleaned.set("pickField", field.key);
      const qs = cleaned.toString();
      const target = qs ? `${pathname}?${qs}` : pathname;
      const enc = encodeResumeTarget(target);
      if (!enc) return null;
      return `${route}?resume=${enc}`;
    },
    [pathname, registry, searchParams]
  );

  useEffect(() => {
    if (!isEditMode && !draftHydrated) return;
    if (isEditMode && editLoad === "loading") return;

    const pickField = searchParams.get("pickField")?.trim();
    const pickedOntology = searchParams.get("pickedOntology")?.trim();
    const pickedId = searchParams.get("pickedId")?.trim();
    if (!pickField || !pickedOntology || !pickedId || !pathname) return;

    const relField = ontologyClass.fields.find((f) => f.key === pickField);
    if (
      !relField ||
      relField.type !== "relation" ||
      relField.relationRegistryKey !== pickedOntology
    ) {
      const next = stripResumePickKeys(
        new URLSearchParams(searchParams.toString())
      );
      const q = next.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const ep = relField.relationEndpoint;
        if (!ep) throw new Error("missing endpoint");
        const token = (session as { accessToken?: string } | null)?.accessToken;
        const detailUrl = `${baseUrl}${ep}${encodeURIComponent(pickedId)}/`;
        const data = await apiFetchJson<Record<string, unknown>>(detailUrl, {
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (cancelled) return;
        const rawName =
          (typeof data.name === "string" && data.name.trim()) ||
          (typeof data.title === "string" && data.title.trim()) ||
          "";
        const name = rawName || `Record ${pickedId}`;
        const entry = { id: pickedId, name };

        if (relField.multivalued) {
          setFormData((prev) => {
            const cur = prev[pickField];
            const items: SearchResult[] = Array.isArray(cur)
              ? [...(cur as SearchResult[])]
              : [];
            if (!items.some((x) => String(x.id) === String(pickedId))) {
              items.push(entry);
            }
            return { ...prev, [pickField]: items };
          });
        } else {
          mergeValues({ [pickField]: entry } as Record<string, any>, {
            onlyIfEmpty: false,
          });
        }

        toast.success(`Linked ${relField.label}: ${name}`);
        const next = stripResumePickKeys(
          new URLSearchParams(searchParams.toString())
        );
        const q = next.toString();
        router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
      } catch {
        if (cancelled) return;
        toast.error("Could not load the created record to link.");
        const next = stripResumePickKeys(
          new URLSearchParams(searchParams.toString())
        );
        const q = next.toString();
        router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    baseUrl,
    draftHydrated,
    editLoad,
    isEditMode,
    mergeValues,
    ontologyClass,
    pathname,
    router,
    searchParams,
    session,
  ]);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (searchParams.get("ingestionHandoff") !== "1") return;
    if (ingestionHandoffAppliedRef.current) return;
    ingestionHandoffAppliedRef.current = true;
    try {
      const raw = sessionStorage.getItem(INGESTION_HANDOFF_STORAGE_KEY);
      if (!raw) {
        ingestionHandoffAppliedRef.current = false;
        return;
      }
      const parsed = JSON.parse(raw) as IngestionHandoffPayload;
      if (parsed.ontologyClassKey !== ontologyClass.key) {
        ingestionHandoffAppliedRef.current = false;
        return;
      }
      ocrApplyFromUpload(parsed.suggestions as Record<string, OcrFieldSuggestion>, {
        uploadedDocumentId: parsed.uploadedDocumentId,
      });
      sessionStorage.removeItem(INGESTION_HANDOFF_STORAGE_KEY);
      const p = new URLSearchParams(searchParams.toString());
      p.delete("ingestionHandoff");
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    } catch {
      ingestionHandoffAppliedRef.current = false;
    }
  }, [ontologyClass.key, pathname, router, searchParams, ocrApplyFromUpload]);

  useEffect(() => {
    if (!ocrUploadedDocumentId || isEditMode) return;
    const storageKey = `hg-project-ocr-apply-${ocrUploadedDocumentId}`;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const picked = JSON.parse(raw) as Record<string, OcrFieldSuggestion>;
      if (picked && typeof picked === "object" && Object.keys(picked).length > 0) {
        ocrApplyFromUpload(picked, { uploadedDocumentId: ocrUploadedDocumentId });
        sessionStorage.removeItem(storageKey);
      }
    } catch {
      /* ignore */
    }
  }, [ocrUploadedDocumentId, isEditMode, ocrApplyFromUpload]);

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

  const focusFirstErroredField = useCallback(
    (erroredKeys: string[]) => {
      if (erroredKeys.length === 0) return;
      const first = erroredKeys[0];
      // Resolve the section that owns the first errored field so we can jump there.
      let targetSectionKey: string | null = null;
      for (const section of sections) {
        if ((fieldsBySection[section.key] || []).some((f) => f.key === first)) {
          targetSectionKey = section.key;
          break;
        }
      }
      if (hasSections && targetSectionKey && pathname) {
        const raw = searchParams.get("step");
        if (raw !== targetSectionKey) {
          const p = new URLSearchParams(searchParams.toString());
          p.set("step", targetSectionKey);
          router.replace(`${pathname}?${p.toString()}`, { scroll: false });
        }
      }
      // Defer so the section render commits before we focus.
      window.setTimeout(() => {
        const el = document.querySelector<HTMLElement>(
          `[data-field-key="${first}"]`
        );
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        const focusable = el.querySelector<HTMLElement>(
          "input,textarea,select,[role='combobox'],[tabindex]:not([tabindex='-1'])"
        );
        focusable?.focus({ preventScroll: true });
      }, 60);
    },
    [
      sections,
      fieldsBySection,
      hasSections,
      pathname,
      searchParams,
      router,
    ]
  );

  const sectionLabelForField = useCallback(
    (fieldKey: string): string | null => {
      for (const section of sections) {
        if ((fieldsBySection[section.key] || []).some((f) => f.key === fieldKey)) {
          return section.label;
        }
      }
      return null;
    },
    [sections, fieldsBySection]
  );

  const validate = useCallback((): boolean => {
    const errors = validateRequiredFields(ontologyClass, formData);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const keys = Object.keys(errors);
      const where = sectionLabelForField(keys[0]);
      const more = keys.length - 1;
      toast.error(
        more > 0
          ? `${keys.length} required field${keys.length === 1 ? "" : "s"} missing${where ? ` (starts in ${where})` : ""}.`
          : `Required field missing${where ? ` in ${where}` : ""}.`
      );
      focusFirstErroredField(keys);
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
      focusFirstErroredField(Object.keys(perField));
      return false;
    }
    setFieldErrors({});
    return true;
  }, [
    formData,
    ontologyClass,
    registry.registry_jsonschema,
    focusFirstErroredField,
    sectionLabelForField,
  ]);

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

      // The CulturalEntity endpoint ("entity" class) is not a flat CIDOC resource:
      // its serializer expects {name, description, category, form_data}, where
      // form_data is the revision snapshot. Wrap accordingly; CIDOC endpoints stay flat.
      const isCulturalEntityEndpoint =
        ontologyClass.apiEndpoint.includes("cultural-entities");
      const body = isCulturalEntityEndpoint
        ? { ...payload, form_data: payload }
        : payload;

      if (isEditMode && recordId) {
        const detailUrl = `${baseUrl}${ontologyClass.apiEndpoint}${encodeURIComponent(recordId)}/`;
        // For a published record the backend stages the edit as a revision for
        // re-review and returns the proposed payload — the live record (and the
        // knowledge graph) keep the accepted content until a reviewer approves.
        await apiFetchJson<Record<string, unknown>>(detailUrl, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
        });
        const rawStatus = (recordMeta?.status ?? "").trim().toLowerCase();
        // CulturalEntity edits are applied in place by the backend (no staged
        // review), so the staged-review messaging only applies to CIDOC rows.
        const wasPublished =
          !isCulturalEntityEndpoint &&
          (rawStatus === "" ||
            rawStatus === "accepted" ||
            rawStatus === "merged" ||
            rawStatus === "published");
        const entryLabel =
          (formData.name as string) || (formData.title as string) || "Entry";
        setSubmitConfirmOpen(false);
        if (wasPublished) {
          toast.success(`"${entryLabel}" — edit submitted for review`, {
            description:
              "The published version stays live until a reviewer approves your changes. Track the review under My contributions.",
            duration: 7000,
            action: {
              label: "Track it",
              onClick: () => router.push("/contribute/my-contributions"),
            },
          });
        } else {
          toast.success(`"${entryLabel}" updated successfully!`, {
            duration: 4000,
          });
        }
        setTimeout(
          () =>
            router.push(
              `/knowledge/${ontologyClass.key}/view/${encodeURIComponent(recordId)}`
            ),
          1200
        );
        return;
      }

      const created = await apiFetchJson<Record<string, unknown>>(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      await clearOntologyFormDraft(draftStorageKey);

      setSubmitConfirmOpen(false);
      toast.success(
        `"${(formData.name as string) || (formData.title as string) || "Entry"}" submitted`,
        {
          description:
            "Reviewers will check it before publication. Track status and notes under My contributions.",
          duration: 7000,
          action: {
            label: "Track it",
            onClick: () => router.push("/contribute/my-contributions"),
          },
        }
      );

      const createdId =
        (created as { entity_id?: string; id?: string })?.entity_id ?? created?.id;
      if (onContributionCreated && createdId != null) {
        const idStr = String(createdId).trim();
        if (idStr !== "") {
          onContributionCreated({ id: idStr });
          return;
        }
      }

      const resumeRaw = resumeEncoded?.trim();
      const resumeDecoded =
        resumeRaw && resumeRaw.length > 0
          ? decodeResumeTarget(resumeRaw)
          : null;
      if (resumeDecoded && createdId != null) {
        const pickedId = String(createdId).trim();
        if (pickedId !== "") {
          const resumeDest = appendResumePickParams(resumeDecoded, {
            pickedOntology: ontologyClass.key,
            pickedId,
            ...(resumePickRole ? { pickedRole: resumePickRole } : {}),
          });
          setTimeout(() => router.replace(resumeDest), 1500);
          return;
        }
      }

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

  const plainClassLabel = plainContributeClassLabel(
    ontologyClass.key,
    ontologyClass.label
  );
  const mainTitle = isEditMode
    ? `Update ${plainClassLabel}`
    : title || `Add ${plainClassLabel}`;
  const mainDescription = isEditMode
    ? "Change only what you need. If this record is already published, your update goes to reviewers first — the live version stays until they approve."
    : description ||
      `Fill in what you know. Empty fields are fine — reviewers will check before publishing.`;

  const duplicateLabel = inferRootLabel(ontologyClass, formData);
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;
  const duplicateAlert = !isEditMode ? (
    <DuplicateContributionAlert
      label={duplicateLabel}
      registryKey={ontologyClass.key}
      accessToken={accessToken}
    />
  ) : null;

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
              Saving <span className="font-medium text-foreground">{entryDisplayName}</span> may send
              your changes for review. The published version stays live until a reviewer accepts the
              update. You can track progress under My contributions.
            </>
          ) : (
            <>
              You are about to submit{" "}
              <span className="font-medium text-foreground">{entryDisplayName}</span> as a new{" "}
              {plainClassLabel.toLowerCase()}. Reviewers will check it before it is published —
              you can follow status any time under My contributions.
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

  const previewProgressPercent =
    totalProgress.total > 0
      ? (totalProgress.filled / totalProgress.total) * 100
      : 0;
  const contributorDisplayName =
    (session?.user?.name as string | undefined) ||
    (session?.user?.email as string | undefined) ||
    null;
  const previewCard = (
    <OntologyFormPreviewCard
      ontologyClass={ontologyClass}
      formData={formData}
      contributorName={contributorDisplayName}
      progressPercent={previewProgressPercent}
    />
  );

  if (!hasSections) {
    return (
      <div className="container max-w-6xl mx-auto px-4 lg:px-6">
        {submitConfirmDialogs}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
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

        {duplicateAlert}

        <details className="rounded-2xl border border-blue-200/70 bg-blue-50/30 px-3 py-2 lg:hidden dark:border-gray-700 dark:bg-gray-900/40">
          <summary className="cursor-pointer text-xs font-semibold text-blue-700 dark:text-blue-300">
            See live preview
          </summary>
          <div className="pt-3">
            {previewCard}
          </div>
        </details>

        <CompletenessMeter ontologyClass={ontologyClass} values={formData} />

        {formGraphPanel}

        {ocrCulturalEntityId ? (
          <HeritageDocumentUpload
            culturalEntityId={ocrCulturalEntityId}
            onApply={ocrApplyFromUpload}
            className="max-w-2xl"
          />
        ) : null}
        {ocrCulturalEntityId && lastOcrDocumentId && showExpertFields ? (
          <details className="max-w-2xl rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">
              Document used for suggestions (expert)
            </summary>
            <p className="mt-2 break-all font-mono">{lastOcrDocumentId}</p>
            <p className="mt-1">
              Suggestions above are linked to this document for reviewer traceability.
            </p>
          </details>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>
              {isEditMode
                ? `Editing ${plainClassLabel}`
                : `About this ${plainClassLabel.toLowerCase()}`}
            </CardTitle>
            <CardDescription>
              {isSignedIn
                ? isEditMode
                  ? "Change the fields you need, then save."
                  : "Write in everyday language. Skip anything you don't know."
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
                showOntologyHint={showExpertFields}
                getRelatedOntologyClass={resolveRelatedOntologyClass}
                getFullFormRelationHref={getFullFormRelationHref}
                apiBaseUrl={baseUrl}
              />
            ))}
            {visibleSortedFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No fields are available for this form right now. Try refreshing the page.
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
          {/* ── Desktop preview column ─────────────────────────────── */}
          <aside className="hidden lg:block">
            <div className="lg:sticky lg:top-6">
              {previewCard}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 lg:px-6">
      {submitConfirmDialogs}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ── Form column ──────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-5">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push("/contribute")}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 inline-flex items-center gap-1"
        >
          ← Back to contribute
        </button>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-2xl font-bold">
            {mainTitle}
          </h1>
          {!isEditMode && draftSavedLabel ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              title="Drafts are saved in this browser. Nothing is shared until you submit."
            >
              <span
                className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                aria-hidden
              />
              {draftSavedLabel}
            </span>
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          {mainDescription}
        </p>
      </div>

      {duplicateAlert}

      {/* Mobile preview — sits at the top of the form, collapsible. */}
      <details className="rounded-2xl border border-blue-200/70 bg-blue-50/30 px-3 py-2 lg:hidden dark:border-gray-700 dark:bg-gray-900/40">
        <summary className="cursor-pointer text-xs font-semibold text-blue-700 dark:text-blue-300">
          See live preview
        </summary>
        <div className="pt-3">
          {previewCard}
        </div>
      </details>

      <CompletenessMeter ontologyClass={ontologyClass} values={formData} />

      {formGraphPanel}

      {ocrCulturalEntityId ? (
        <HeritageDocumentUpload
          culturalEntityId={ocrCulturalEntityId}
          onApply={ocrApplyFromUpload}
          className="max-w-2xl"
        />
      ) : null}
      {ocrCulturalEntityId && lastOcrDocumentId && showExpertFields ? (
        <details className="max-w-2xl rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">
            Document used for suggestions (expert)
          </summary>
          <p className="mt-2 break-all font-mono">{lastOcrDocumentId}</p>
          <p className="mt-1">
            Suggestions above are linked to this document for reviewer traceability.
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
                {!isSignedIn ? (
                  "Please sign in to submit contributions."
                ) : (() => {
                  const sp = sectionProgress[sections[currentSectionIndex].key];
                  const filled = sp?.filled || 0;
                  const total = sp?.total || 0;
                  const stepLabel = `Step ${currentSectionIndex + 1} of ${sections.length}`;
                  if (total === 0) {
                    return <>{stepLabel} — optional section. Add anything you can.</>;
                  }
                  if (sp?.requiredOk === false) {
                    return (
                      <span className="text-amber-700 dark:text-amber-300">
                        {stepLabel} — {filled}/{total} filled. Required fields are still missing in this step.
                      </span>
                    );
                  }
                  if (filled === total) {
                    return (
                      <span className="text-emerald-700 dark:text-emerald-300">
                        {stepLabel} — all {total} fields filled. ✨ Great progress!
                      </span>
                    );
                  }
                  return <>{stepLabel} — {filled} of {total} fields filled. Keep going.</>;
                })()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {currentSectionFields.map((field) => (
                <div
                  key={field.key}
                  data-field-key={field.key}
                  className="scroll-mt-24"
                >
                  <FieldRenderer
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
                    showOntologyHint={showExpertFields}
                    getRelatedOntologyClass={resolveRelatedOntologyClass}
                    getFullFormRelationHref={getFullFormRelationHref}
                    apiBaseUrl={baseUrl}
                  />
                </div>
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

        <SourcePrompt
          value={(formData.source_citation as string) ?? ""}
          onChange={(next) =>
            setFormData((prev) => ({ ...prev, source_citation: next }))
          }
          disabled={!isSignedIn}
        />

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
        {/* ── Desktop preview column ────────────────────────────────── */}
        <aside className="hidden lg:block">
          <div className="lg:sticky lg:top-6">
            {previewCard}
          </div>
        </aside>
      </div>
    </div>
  );
}
