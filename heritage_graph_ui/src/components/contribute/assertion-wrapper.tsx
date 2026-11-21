"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AssertionData {
  source_type: string;
  source_citation: string;
  source_url: string;
  confidence: string;
  data_quality_note: string;
}

interface AssertionWrapperProps {
  value: AssertionData;
  onChange: (data: AssertionData) => void;
  className?: string;
}

const sourceTypes = [
  { value: "published", label: "Published Source" },
  { value: "archival", label: "Archival Record" },
  { value: "field_survey", label: "Field Survey" },
  { value: "oral_history", label: "Oral History" },
  { value: "inscription", label: "Inscription" },
  { value: "web", label: "Web Resource" },
];

const confidenceLevels = [
  {
    value: "certain",
    label: "Certain",
    description: "Based on primary evidence, well-documented",
  },
  {
    value: "likely",
    label: "Likely",
    description: "Supported by credible secondary sources",
  },
  {
    value: "uncertain",
    label: "Uncertain",
    description: "Limited evidence or conflicting sources",
  },
  {
    value: "speculative",
    label: "Speculative",
    description: "Hypothesis based on indirect evidence",
  },
];

export const defaultAssertionData: AssertionData = {
  source_type: "published",
  source_citation: "",
  source_url: "",
  confidence: "likely",
  data_quality_note: "",
};

export function AssertionWrapper({
  value,
  onChange,
  className,
}: AssertionWrapperProps) {
  const updateField = (field: keyof AssertionData, val: string) => {
    onChange({ ...value, [field]: val });
  };

  return (
    <div
      className={cn(
        "space-y-4 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-4",
        className
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <svg
          className="w-4 h-4 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h4 className="text-sm font-medium text-muted-foreground">
          Source & Provenance
        </h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Source Type */}
        <div className="space-y-2">
          <Label htmlFor="source_type">Source Type</Label>
          <Select
            value={value.source_type}
            onValueChange={(v) => updateField("source_type", v)}
          >
            <SelectTrigger id="source_type">
              <SelectValue placeholder="Select source type" />
            </SelectTrigger>
            <SelectContent>
              {sourceTypes.map((st) => (
                <SelectItem key={st.value} value={st.value}>
                  {st.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Confidence */}
        <div className="space-y-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Label htmlFor="confidence" className="cursor-help">
                  Confidence Level ⓘ
                </Label>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">
                  How confident are you in this information? This helps
                  reviewers prioritize verification.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Select
            value={value.confidence}
            onValueChange={(v) => updateField("confidence", v)}
          >
            <SelectTrigger id="confidence">
              <SelectValue placeholder="Select confidence" />
            </SelectTrigger>
            <SelectContent>
              {confidenceLevels.map((cl) => (
                <SelectItem key={cl.value} value={cl.value}>
                  <div>
                    <span>{cl.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      — {cl.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Citation */}
      <div className="space-y-2">
        <Label htmlFor="source_citation">Citation *</Label>
        <Input
          id="source_citation"
          value={value.source_citation}
          onChange={(e) => updateField("source_citation", e.target.value)}
          placeholder='e.g., "Slusser, Nepal Mandala, 1982, p. 45"'
        />
        <p className="text-xs text-muted-foreground">
          Cite your source — every assertion needs provenance.
        </p>
      </div>

      {/* Source URL */}
      <div className="space-y-2">
        <Label htmlFor="source_url">Source URL (optional)</Label>
        <Input
          id="source_url"
          type="url"
          value={value.source_url}
          onChange={(e) => updateField("source_url", e.target.value)}
          placeholder="https://..."
        />
      </div>

      {/* Data quality notes */}
      <div className="space-y-2">
        <Label htmlFor="data_quality_note">
          Notes on Data Quality (optional)
        </Label>
        <Textarea
          id="data_quality_note"
          value={value.data_quality_note}
          onChange={(e) => updateField("data_quality_note", e.target.value)}
          placeholder="Any caveats, limitations, or context about this data..."
          rows={2}
        />
      </div>
    </div>
  );
}

export type { AssertionData };
