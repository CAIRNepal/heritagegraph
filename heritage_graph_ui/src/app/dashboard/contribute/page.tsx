"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ─────────────────────────────────────────────────────────
// Intent-based contribution types
// ─────────────────────────────────────────────────────────

interface ContributionIntent {
  key: string;
  label: string;
  description: string;
  icon: string;
  category: string;
  route: string;
  difficulty: "beginner" | "intermediate" | "advanced";
}

const contributionIntents: ContributionIntent[] = [
  {
    key: "structure",
    label: "Record a Structure",
    description:
      "Temples, stupas, rest houses, water spouts, and other architectural heritage. Includes location, condition, and construction details.",
    icon: "🏛️",
    category: "Tangible Heritage",
    route: "/dashboard/contribute/structure",
    difficulty: "beginner",
  },
  {
    key: "ritual",
    label: "Document a Ritual or Festival",
    description:
      "Puja ceremonies, Jatra processions, masked dances, and other ritual activities. Includes timing, performers, and procession routes.",
    icon: "🔥",
    category: "Events & Rituals",
    route: "/dashboard/contribute/ritual",
    difficulty: "intermediate",
  },
  {
    key: "deity",
    label: "Add a Deity",
    description:
      "Hindu, Buddhist, or syncretic divine entities with their traditions, alternate names, and iconographic descriptions.",
    icon: "✨",
    category: "Conceptual Entities",
    route: "/dashboard/contribute/deity",
    difficulty: "beginner",
  },
  {
    key: "guthi",
    label: "Register a Guthi Organization",
    description:
      "Endowed trust organizations managing temples, rituals, and land. Includes type, membership, and managed structures.",
    icon: "🏘️",
    category: "Social Organizations",
    route: "/dashboard/contribute/guthi",
    difficulty: "intermediate",
  },
  {
    key: "field-survey",
    label: "Submit a Field Survey",
    description:
      "On-the-ground condition reports with observations, photos, and GPS coordinates. Ideal for mobile contributors.",
    icon: "📋",
    category: "Documentation",
    route: "/dashboard/contribute/structure",
    difficulty: "beginner",
  },
  {
    key: "source",
    label: "Add a Source / Document",
    description:
      "Books, archival records, oral histories, inscriptions, and other reference materials that support heritage claims.",
    icon: "📚",
    category: "Sources & Provenance",
    route: "/dashboard/contribute/source",
    difficulty: "beginner",
  },
  {
    key: "person",
    label: "Record a Historical Person",
    description:
      "Kings, artisans, priests, scholars, and other individuals who shaped cultural heritage through their activities.",
    icon: "👤",
    category: "Social Organizations",
    route: "/dashboard/contribute/person",
    difficulty: "beginner",
  },
  {
    key: "location",
    label: "Add a Place / Location",
    description:
      "Geographic locations where heritage structures exist and events occur. Includes coordinates and place type.",
    icon: "🗺️",
    category: "Spaces & Time",
    route: "/dashboard/contribute/location",
    difficulty: "beginner",
  },
];

const difficultyColors: Record<string, string> = {
  beginner: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  intermediate:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  advanced: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

// Group intents by category
function groupByCategory(intents: ContributionIntent[]) {
  const grouped: Record<string, ContributionIntent[]> = {};
  for (const intent of intents) {
    if (!grouped[intent.category]) grouped[intent.category] = [];
    grouped[intent.category].push(intent);
  }
  return grouped;
}

export default function ContributeDashboard() {
  const router = useRouter();
  const grouped = groupByCategory(contributionIntents);

  return (
    <div className="container mx-auto px-4 py-6 space-y-8 max-w-5xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">Contribute Knowledge</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
          Help preserve Nepal&apos;s cultural heritage by contributing
          structured data. Every contribution is tracked with provenance —
          cite your sources, and reviewers will verify the information.
        </p>
      </div>

      {/* Quick-start callout */}
      <div className="rounded-lg border bg-primary/5 border-primary/20 p-4 flex items-start gap-3">
        <span className="text-xl">💡</span>
        <div>
          <p className="text-sm font-medium">New to contributing?</p>
          <p className="text-sm text-muted-foreground">
            Start by recording a <strong>Structure</strong> or adding a{" "}
            <strong>Source</strong> — these are the simplest forms and help
            build the foundation for more complex entries.
          </p>
        </div>
      </div>

      {/* Contribution intent cards grouped by category */}
      {Object.entries(grouped).map(([category, intents]) => (
        <div key={category}>
          <h2 className="text-lg font-semibold mb-3 text-muted-foreground">
            {category}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {intents.map((intent) => (
              <Card
                key={intent.key}
                className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all group"
                onClick={() => router.push(intent.route)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="text-2xl">{intent.icon}</span>
                      {intent.label}
                    </CardTitle>
                    <Badge
                      variant="secondary"
                      className={difficultyColors[intent.difficulty]}
                    >
                      {intent.difficulty}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    {intent.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
