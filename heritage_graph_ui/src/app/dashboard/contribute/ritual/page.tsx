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
import { Switch } from "@/components/ui/switch";
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

interface RitualFormData {
  // Step 1: Ritual type
  ritual_type: string;
  // Step 2: Identity
  name: string;
  description: string;
  // Step 3: Timing
  is_recurring: boolean;
  date: string;
  recurrence_pattern: string;
  lunar_date_tithi: string;
  calendar_system: string;
  // Step 4: Location & Route
  location_name: string;
  is_processional: boolean;
  start_place: string;
  end_place: string;
  route_description: string;
  // Step 5: Participants
  performed_by: string;
  linked_guthi: SearchResult | null;
  linked_deity: SearchResult | null;
  linked_structure: SearchResult | null;
  linked_festival: SearchResult | null;
  note: string;
  // Assertion
  assertion: AssertionData;
}

const initialFormData: RitualFormData = {
  ritual_type: "",
  name: "",
  description: "",
  is_recurring: true,
  date: "",
  recurrence_pattern: "",
  lunar_date_tithi: "",
  calendar_system: "Gregorian",
  location_name: "",
  is_processional: false,
  start_place: "",
  end_place: "",
  route_description: "",
  performed_by: "",
  linked_guthi: null,
  linked_deity: null,
  linked_structure: null,
  linked_festival: null,
  note: "",
  assertion: defaultAssertionData,
};

// ─────────────────────────────────────────────────────────
// Ritual types grouped by category
// ─────────────────────────────────────────────────────────

const ritualTypeGroups = [
  {
    label: "Daily Worship",
    types: [
      { value: "NityaPuja", label: "Nitya Puja", description: "Daily mandatory worship", icon: "🕯️" },
    ],
  },
  {
    label: "Festival & Occasional",
    types: [
      { value: "NaimittikaPuja", label: "Naimittika Puja", description: "Occasional/festival worship", icon: "🎊" },
      { value: "Jatra", label: "Jatra", description: "Festival procession ritual", icon: "🎉" },
      { value: "ChariotProcession", label: "Chariot Procession", description: "Ritual chariot pulling", icon: "🛕" },
      { value: "MaskedPerformance", label: "Masked Performance", description: "Ritual masked dance", icon: "🎭" },
    ],
  },
  {
    label: "Sacred Rituals",
    types: [
      { value: "Abhisheka", label: "Abhisheka", description: "Ritual bathing/anointing of deity", icon: "💧" },
      { value: "Homa", label: "Homa", description: "Fire offering ritual", icon: "🔥" },
      { value: "Yagna", label: "Yagna", description: "Vedic sacrifice ritual", icon: "🪔" },
      { value: "KamyaPuja", label: "Kamya Puja", description: "Desire-based optional worship", icon: "🙏" },
    ],
  },
  {
    label: "Lifecycle & Vows",
    types: [
      { value: "Vrata", label: "Vrata", description: "Vow observance ritual", icon: "📿" },
      { value: "Bhajan", label: "Bhajan", description: "Devotional singing ritual", icon: "🎵" },
    ],
  },
  {
    label: "Movement Rituals",
    types: [
      { value: "Circumambulation", label: "Circumambulation", description: "Circular movement around sacred site", icon: "🔄" },
      { value: "RelicTour", label: "Relic Tour", description: "Procession with sacred relics", icon: "📦" },
      { value: "ProcessionalMovement", label: "Processional Movement", description: "General ritual movement", icon: "🚶" },
    ],
  },
  {
    label: "Consecration & Installation",
    types: [
      { value: "RitualConsecration", label: "Consecration", description: "Consecration/activation ritual", icon: "✨" },
      { value: "InstallationRitual", label: "Installation", description: "Enshrinement ritual", icon: "🏗️" },
      { value: "DeinstallationRitual", label: "Deinstallation", description: "De-installation/conclusion", icon: "📤" },
      { value: "ReturningRitual", label: "Returning Ritual", description: "Return to normal state", icon: "🔙" },
    ],
  },
];

// Flatten for TypePicker
const allRitualTypes = ritualTypeGroups.flatMap((g) => g.types);

// Check if ritual type is processional
const processionalTypes = ["Jatra", "ChariotProcession", "Circumambulation", "RelicTour", "ProcessionalMovement", "ProcessionRitual"];

// ─────────────────────────────────────────────────────────
// Steps definition
// ─────────────────────────────────────────────────────────

const steps = [
  {
    id: "type",
    label: "Type",
    description: "What kind of ritual or ceremony?",
  },
  {
    id: "identity",
    label: "Identity",
    description: "Name and description of the ritual",
  },
  {
    id: "timing",
    label: "Timing",
    description: "When does this ritual occur?",
  },
  {
    id: "location",
    label: "Location",
    description: "Where does it take place?",
  },
  {
    id: "participants",
    label: "Participants",
    description: "Who performs it and what does it involve?",
  },
  {
    id: "provenance",
    label: "Source",
    description: "Cite your sources",
  },
];

// ─────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────

export default function ContributeRitualPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [form, setForm] = useState<RitualFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = <K extends keyof RitualFormData>(
    key: K,
    value: RitualFormData[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Auto-detect processional rituals
  const handleRitualTypeChange = (value: string) => {
    updateField("ritual_type", value);
    if (processionalTypes.includes(value)) {
      updateField("is_processional", true);
    }
  };

  const validateStep = (stepIndex: number): boolean => {
    switch (stepIndex) {
      case 0:
        if (!form.ritual_type) {
          toast.error("Please select a ritual type");
          return false;
        }
        return true;
      case 1:
        if (!form.name.trim()) {
          toast.error("Name is required");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
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
        ritual_type: form.ritual_type,
        date: form.date,
        recurrence_pattern: form.recurrence_pattern,
        lunar_date_tithi: form.lunar_date_tithi,
        performed_by: form.performed_by,
        location_name: form.location_name,
        route_description: form.route_description,
        start_place: form.start_place,
        end_place: form.end_place,
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

      if (session?.accessToken) {
        headers.Authorization = `Bearer ${session.accessToken}`;
      }

      const res = await fetch(`${backendUrl}/cidoc/contribute/rituals/`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Ritual event submitted successfully!");
        router.push("/dashboard/knowledge/ritual");
      } else {
        const errorData = await res.json().catch(() => null);
        toast.error(
          `Submission failed: ${
            errorData ? JSON.stringify(errorData) : res.statusText
          }`
        );
      }
    } catch {
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
        title="Document a Ritual or Festival"
        description="Record a ritual activity with timing, participants, and provenance."
      >
        {/* ── Step 1: Ritual Type ── */}
        <div className="space-y-4">
          {ritualTypeGroups.map((group) => (
            <div key={group.label}>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                {group.label}
              </h3>
              <TypePicker
                options={group.types}
                value={form.ritual_type}
                onChange={handleRitualTypeChange}
                columns={2}
              />
            </div>
          ))}
        </div>

        {/* ── Step 2: Identity ── */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Ritual Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="e.g., Rato Machhindranath Jatra"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Describe the ritual, its significance, and key activities..."
              rows={4}
            />
          </div>
        </div>

        {/* ── Step 3: Timing ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              id="is_recurring"
              checked={form.is_recurring}
              onCheckedChange={(v) => updateField("is_recurring", v)}
            />
            <Label htmlFor="is_recurring">
              This is a recurring ritual
            </Label>
          </div>

          {form.is_recurring ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="recurrence_pattern">
                  Recurrence Pattern
                </Label>
                <Input
                  id="recurrence_pattern"
                  value={form.recurrence_pattern}
                  onChange={(e) =>
                    updateField("recurrence_pattern", e.target.value)
                  }
                  placeholder="e.g., Annual, Every full moon, Monthly"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lunar_date_tithi">
                  Lunar Date / Tithi
                </Label>
                <Input
                  id="lunar_date_tithi"
                  value={form.lunar_date_tithi}
                  onChange={(e) =>
                    updateField("lunar_date_tithi", e.target.value)
                  }
                  placeholder="e.g., Chaitra Shukla Ashtami, Purnima"
                />
                <p className="text-xs text-muted-foreground">
                  The traditional lunar calendar date for this ritual.
                </p>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                value={form.date}
                onChange={(e) => updateField("date", e.target.value)}
                placeholder="e.g., 2024-04-15 or Baisakh 1, 2081 BS"
              />
            </div>
          )}

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
                <SelectItem value="NepalSambat">Nepal Sambat (NS)</SelectItem>
                <SelectItem value="VikramSambat">
                  Vikram Sambat (VS/BS)
                </SelectItem>
                <SelectItem value="Lunar">Lunar / Tithi</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Step 4: Location & Route ── */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="location_name">Primary Location</Label>
            <Input
              id="location_name"
              value={form.location_name}
              onChange={(e) => updateField("location_name", e.target.value)}
              placeholder="e.g., Patan Durbar Square"
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="is_processional"
              checked={form.is_processional}
              onCheckedChange={(v) => updateField("is_processional", v)}
            />
            <Label htmlFor="is_processional">
              This ritual involves a procession / route
            </Label>
          </div>

          {form.is_processional && (
            <div className="space-y-4 pl-4 border-l-2 border-primary/20">
              <p className="text-sm text-muted-foreground">
                Describe the procession route for this ritual.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_place">Starting Place</Label>
                  <Input
                    id="start_place"
                    value={form.start_place}
                    onChange={(e) =>
                      updateField("start_place", e.target.value)
                    }
                    placeholder="e.g., Pulchowk"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_place">Ending Place</Label>
                  <Input
                    id="end_place"
                    value={form.end_place}
                    onChange={(e) =>
                      updateField("end_place", e.target.value)
                    }
                    placeholder="e.g., Jawalakhel"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="route_description">
                  Route Description
                </Label>
                <Textarea
                  id="route_description"
                  value={form.route_description}
                  onChange={(e) =>
                    updateField("route_description", e.target.value)
                  }
                  placeholder="Describe the path: starting point → waypoints → destination..."
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Step 5: Participants ── */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="performed_by">
              Performed By (groups or individuals)
            </Label>
            <Input
              id="performed_by"
              value={form.performed_by}
              onChange={(e) => updateField("performed_by", e.target.value)}
              placeholder="e.g., Vajracharya priests, Jyapu community"
            />
          </div>

          <EntitySearch
            label="Managing Guthi"
            endpoint="/cidoc/guthis/"
            value={form.linked_guthi}
            onSelect={(v) => updateField("linked_guthi", v)}
            placeholder="Search for a Guthi organization..."
            allowCreate
          />

          <EntitySearch
            label="Deity Invoked"
            endpoint="/cidoc/deities/"
            value={form.linked_deity}
            onSelect={(v) => updateField("linked_deity", v)}
            placeholder="Search for a deity..."
            allowCreate
          />

          <EntitySearch
            label="Performed at Structure"
            endpoint="/cidoc/structures/"
            value={form.linked_structure}
            onSelect={(v) => updateField("linked_structure", v)}
            placeholder="Search for a structure..."
          />

          <EntitySearch
            label="Part of Larger Festival"
            endpoint="/cidoc/festivals/"
            value={form.linked_festival}
            onSelect={(v) => updateField("linked_festival", v)}
            placeholder="Search for a festival..."
          />

          <div className="space-y-2">
            <Label htmlFor="note">Additional Notes</Label>
            <Textarea
              id="note"
              value={form.note}
              onChange={(e) => updateField("note", e.target.value)}
              placeholder="Any additional context, observations, or details..."
              rows={2}
            />
          </div>
        </div>

        {/* ── Step 6: Provenance ── */}
        <div className="space-y-4">
          <div className="rounded-lg border bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/30 p-4">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              📖 Ritual practices may have multiple interpretations across
              communities. Please cite your source carefully —{" "}
              <strong>
                alternate accounts will be preserved, not overwritten.
              </strong>
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
