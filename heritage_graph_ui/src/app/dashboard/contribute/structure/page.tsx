"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

import { StepWizard } from "@/components/contribute/step-wizard";
import { TypePicker } from "@/components/contribute/type-picker";
import { EntitySearch, type SearchResult } from "@/components/contribute/entity-search";
import {
  AssertionWrapper,
  defaultAssertionData,
  type AssertionData,
} from "@/components/contribute/assertion-wrapper";
import { ontologyEnums } from "@/lib/ontology";

// ─────────────────────────────────────────────────────────
// Form state
// ─────────────────────────────────────────────────────────

interface StructureFormData {
  // Step 1: Type
  structure_type: string;
  // Step 2: Identity
  name: string;
  description: string;
  existence_status: string;
  // Step 3: Location
  location_name: string;
  coordinates: string;
  // Step 4: Construction (Production event)
  construction_date: string;
  date_precision: string;
  calendar_system: string;
  commissioned_by: string;
  // Step 5: Condition
  condition: string;
  architectural_style: string;
  // Step 6: Relationships
  linked_deity: SearchResult | null;
  linked_guthi: SearchResult | null;
  note: string;
  // Assertion
  assertion: AssertionData;
}

const initialFormData: StructureFormData = {
  structure_type: "",
  name: "",
  description: "",
  existence_status: "Extant",
  location_name: "",
  coordinates: "",
  construction_date: "",
  date_precision: "Circa",
  calendar_system: "Gregorian",
  commissioned_by: "",
  condition: "",
  architectural_style: "",
  linked_deity: null,
  linked_guthi: null,
  note: "",
  assertion: defaultAssertionData,
};

// ─────────────────────────────────────────────────────────
// Structure types with icons
// ─────────────────────────────────────────────────────────

const structureTypes = [
  {
    value: "Temple",
    label: "Temple",
    description: "Sacred structure with deity enshrinement",
    icon: "🛕",
  },
  {
    value: "Stupa",
    label: "Stupa",
    description: "Buddhist dome-shaped reliquary shrine",
    icon: "☸️",
  },
  {
    value: "Chaitya",
    label: "Chaitya",
    description: "Buddhist votive shrine or prayer hall",
    icon: "🙏",
  },
  {
    value: "Pati",
    label: "Pati",
    description: "Open-air pavilion for resting travelers",
    icon: "🏚️",
  },
  {
    value: "Sattal",
    label: "Sattal",
    description: "Multi-story rest house (3-5 floors)",
    icon: "🏠",
  },
  {
    value: "Dharmashala",
    label: "Dharmashala",
    description: "Pilgrim lodge operated by a Guthi",
    icon: "🏨",
  },
  {
    value: "DhungeDhara",
    label: "Dhunge Dhara",
    description: "Stone water spout with carved imagery",
    icon: "⛲",
  },
  {
    value: "Pokhari",
    label: "Pokhari",
    description: "Pond or tank for ritual bathing",
    icon: "🌊",
  },
  {
    value: "Other",
    label: "Other",
    description: "Other architectural structure",
    icon: "🏗️",
  },
];

// ─────────────────────────────────────────────────────────
// Steps definition
// ─────────────────────────────────────────────────────────

const steps = [
  {
    id: "type",
    label: "Type",
    description: "What kind of structure is this?",
  },
  {
    id: "identity",
    label: "Identity",
    description: "Name and basic identification",
  },
  {
    id: "location",
    label: "Location",
    description: "Where is this structure located?",
  },
  {
    id: "construction",
    label: "Construction",
    description: "When and how was it built?",
  },
  {
    id: "condition",
    label: "Condition",
    description: "Current state and architectural style",
  },
  {
    id: "provenance",
    label: "Source",
    description: "Cite your sources for this information",
  },
];

// ─────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────

export default function ContributeStructurePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [form, setForm] = useState<StructureFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = <K extends keyof StructureFormData>(
    key: K,
    value: StructureFormData[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validateStep = (stepIndex: number): boolean => {
    switch (stepIndex) {
      case 0: // Type
        if (!form.structure_type) {
          toast.error("Please select a structure type");
          return false;
        }
        return true;
      case 1: // Identity
        if (!form.name.trim()) {
          toast.error("Name is required");
          return false;
        }
        return true;
      case 2: // Location
        if (!form.location_name.trim()) {
          toast.error("Location is required");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    // Validate assertion
    if (!form.assertion.source_citation.trim()) {
      toast.error("Please provide a source citation");
      return;
    }

    setIsSubmitting(true);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://backend.localhost";

      const payload = {
        name: form.name,
        description: form.description,
        structure_type: form.structure_type,
        architectural_style: form.architectural_style,
        construction_date: form.construction_date,
        location_name: form.location_name,
        coordinates: form.coordinates,
        existence_status: form.existence_status,
        condition: form.condition,
        note: form.note,
        assertion: {
          source_type: form.assertion.source_type,
          source_citation: form.assertion.source_citation,
          source_url: form.assertion.source_url,
          confidence: form.assertion.confidence,
          data_quality_note: form.assertion.data_quality_note,
        },
      };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Add auth token if available
      if (session?.accessToken) {
        headers.Authorization = `Bearer ${session.accessToken}`;
      }

      const res = await fetch(`${backendUrl}/cidoc/contribute/structures/`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Structure record submitted successfully!");
        router.push("/dashboard/knowledge/structure");
      } else {
        const errorData = await res.json().catch(() => null);
        toast.error(
          `Submission failed: ${
            errorData
              ? JSON.stringify(errorData)
              : res.statusText
          }`
        );
      }
    } catch (err) {
      toast.error("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl">
      <StepWizard
        steps={steps}
        onComplete={handleSubmit}
        onCancel={() => router.push("/dashboard/contribute")}
        isSubmitting={isSubmitting}
        validateStep={validateStep}
        title="Record a Structure"
        description="Document an architectural heritage structure with provenance tracking."
      >
        {/* ── Step 1: Type ── */}
        <TypePicker
          options={structureTypes}
          value={form.structure_type}
          onChange={(v) => updateField("structure_type", v)}
          label="Select the type of structure"
          columns={3}
        />

        {/* ── Step 2: Identity ── */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Structure Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="e.g., Pashupatinath Temple"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Brief description of the structure..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="existence_status">Existence Status</Label>
            <Select
              value={form.existence_status}
              onValueChange={(v) => updateField("existence_status", v)}
            >
              <SelectTrigger id="existence_status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {ontologyEnums.ExistenceStatusEnum.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                    {opt.description && (
                      <span className="text-xs text-muted-foreground ml-2">
                        — {opt.description}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Step 3: Location ── */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="location_name">
              Location / Place Name{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="location_name"
              value={form.location_name}
              onChange={(e) => updateField("location_name", e.target.value)}
              placeholder="e.g., Kathmandu Durbar Square, Ward 5"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="coordinates">
              GPS Coordinates (optional)
            </Label>
            <Input
              id="coordinates"
              value={form.coordinates}
              onChange={(e) => updateField("coordinates", e.target.value)}
              placeholder="e.g., 27.7104, 85.3488"
            />
            <p className="text-xs text-muted-foreground">
              Latitude, Longitude format. You can get this from Google Maps
              by right-clicking a location.
            </p>
          </div>

          {(form.existence_status === "Destroyed" ||
            form.existence_status === "Lost") && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-900/10 p-3">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                ⚠️ This structure is marked as{" "}
                <strong>{form.existence_status}</strong>. The location above
                represents its last known or hypothesized position.
              </p>
            </div>
          )}
        </div>

        {/* ── Step 4: Construction ── */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="construction_date">
              Construction Date / Period
            </Label>
            <Input
              id="construction_date"
              value={form.construction_date}
              onChange={(e) => updateField("construction_date", e.target.value)}
              placeholder="e.g., c. 1637 CE, 15th century, NS 758"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date_precision">Precision</Label>
              <Select
                value={form.date_precision}
                onValueChange={(v) => updateField("date_precision", v)}
              >
                <SelectTrigger id="date_precision">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ontologyEnums.DatePrecisionEnum.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calendar_system">Calendar System</Label>
              <Select
                value={form.calendar_system}
                onValueChange={(v) => updateField("calendar_system", v)}
              >
                <SelectTrigger id="calendar_system">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Gregorian">Gregorian (CE)</SelectItem>
                  <SelectItem value="NepalSambat">
                    Nepal Sambat (NS)
                  </SelectItem>
                  <SelectItem value="VikramSambat">
                    Vikram Sambat (VS/BS)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="commissioned_by">
              Commissioned / Built By (optional)
            </Label>
            <Input
              id="commissioned_by"
              value={form.commissioned_by}
              onChange={(e) => updateField("commissioned_by", e.target.value)}
              placeholder="e.g., King Pratap Malla"
            />
          </div>
        </div>

        {/* ── Step 5: Condition & Style ── */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="architectural_style">Architectural Style</Label>
            <Select
              value={form.architectural_style}
              onValueChange={(v) => updateField("architectural_style", v)}
            >
              <SelectTrigger id="architectural_style">
                <SelectValue placeholder="Select style" />
              </SelectTrigger>
              <SelectContent>
                {ontologyEnums.ArchitecturalStyleEnum.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                    {opt.description && (
                      <span className="text-xs text-muted-foreground ml-2">
                        — {opt.description}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="condition">Current Condition</Label>
            <Select
              value={form.condition}
              onValueChange={(v) => updateField("condition", v)}
            >
              <SelectTrigger id="condition">
                <SelectValue placeholder="Select condition" />
              </SelectTrigger>
              <SelectContent>
                {ontologyEnums.ConditionTypeEnum.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                    {opt.description && (
                      <span className="text-xs text-muted-foreground ml-2">
                        — {opt.description}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Relationships section */}
          <div className="pt-4 border-t space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Relationships (optional)
            </h3>

            <EntitySearch
              label="Associated Deity"
              endpoint="/cidoc/deities/"
              value={form.linked_deity}
              onSelect={(v) => updateField("linked_deity", v)}
              placeholder="Search for a deity..."
              allowCreate
            />

            <EntitySearch
              label="Managing Guthi"
              endpoint="/cidoc/guthis/"
              value={form.linked_guthi}
              onSelect={(v) => updateField("linked_guthi", v)}
              placeholder="Search for a Guthi..."
              allowCreate
            />

            <div className="space-y-2">
              <Label htmlFor="note">Additional Notes</Label>
              <Textarea
                id="note"
                value={form.note}
                onChange={(e) => updateField("note", e.target.value)}
                placeholder="Any additional context about this structure..."
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* ── Step 6: Provenance / Assertion ── */}
        <div className="space-y-4">
          <div className="rounded-lg border bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/30 p-4">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              📖 Every contribution to HeritageGraph is a{" "}
              <strong>provenance-tracked assertion</strong>. Please cite the
              source for the information you&apos;ve provided above. This
              enables scholarly verification and conflict resolution.
            </p>
          </div>

          <AssertionWrapper
            value={form.assertion}
            onChange={(v) => updateField("assertion", v)}
          />
        </div>
      </StepWizard>
    </div>
  );
}
