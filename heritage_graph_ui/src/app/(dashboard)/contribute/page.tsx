"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  IconSparkles,
  IconArrowRight,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { fadeInUp, staggerContainer, scaleIn, glassCard } from "@/lib/design";

interface ContributionIntent {
  key: string;
  label: string;
  description: string;
  shortDescription: string;
  icon: string;
  category: string;
  categoryKey: string;
  route: string;
  difficulty: "beginner" | "intermediate" | "advanced";
}

const categoryOrder = [
  "tangible",
  "events",
  "kumari",
  "conceptual",
  "social",
  "spacetime",
  "provenance",
] as const;

const categoryMeta: Record<string, { label: string; icon: string }> = {
  tangible: { label: "Tangible Heritage", icon: "🏛️" },
  events: { label: "Events & Rituals", icon: "🔥" },
  kumari: { label: "Living Goddess", icon: "👑" },
  conceptual: { label: "Conceptual", icon: "✨" },
  social: { label: "Social & People", icon: "👥" },
  spacetime: { label: "Spaces & Time", icon: "🗺️" },
  provenance: { label: "Sources", icon: "📚" },
};

const contributionIntents: ContributionIntent[] = [
  // Tangible Heritage
  {
    key: "structure",
    label: "Structure",
    shortDescription: "Temples, stupas, rest houses, water spouts",
    description:
      "Record architectural heritage with location, condition, style, and Guthi links.",
    icon: "🏛️",
    category: "Tangible Heritage",
    categoryKey: "tangible",
    route: "/contribute/structure",
    difficulty: "beginner",
  },
  {
    key: "iconography",
    label: "Iconographic Object",
    shortDescription: "Paubha paintings, Murti statues, sacred art",
    description:
      "Document sacred visual art with deity depictions and provenance.",
    icon: "🎨",
    category: "Tangible Heritage",
    categoryKey: "tangible",
    route: "/contribute/iconography",
    difficulty: "intermediate",
  },
  {
    key: "monument",
    label: "Buddhist Monument",
    shortDescription: "Stupas, Chaityas, sacred structures",
    description:
      "Add Buddhist sacred structures with circumambulation and ritual patterns.",
    icon: "⛩️",
    category: "Tangible Heritage",
    categoryKey: "tangible",
    route: "/contribute/monument",
    difficulty: "beginner",
  },

  // Events & Rituals
  {
    key: "ritual",
    label: "Ritual",
    shortDescription: "Puja, consecrations, processions",
    description:
      "Document rituals with deity invocation, performers, timing, and routes.",
    icon: "🔥",
    category: "Events & Rituals",
    categoryKey: "events",
    route: "/contribute/ritual",
    difficulty: "intermediate",
  },
  {
    key: "festival",
    label: "Festival",
    shortDescription: "Jatra processions, chariot festivals, dances",
    description:
      "Record large-scale community events with component rituals.",
    icon: "🎪",
    category: "Events & Rituals",
    categoryKey: "events",
    route: "/contribute/festival",
    difficulty: "intermediate",
  },
  {
    key: "event",
    label: "Historical Event",
    shortDescription: "Earthquakes, fires, political transitions",
    description: "Log major events that affected heritage sites or practices.",
    icon: "📅",
    category: "Events & Rituals",
    categoryKey: "events",
    route: "/contribute/event",
    difficulty: "beginner",
  },

  // Living Goddess (Kumari)
  {
    key: "kumari_tenure",
    label: "Kumari Tenure",
    shortDescription: "Period of divine embodiment",
    description:
      "Document a Kumari's tenure — person, deity, residence, and supporting Guthi.",
    icon: "👑",
    category: "Living Goddess (Kumari)",
    categoryKey: "kumari",
    route: "/contribute/kumari-tenure",
    difficulty: "advanced",
  },
  {
    key: "kumari_selection",
    label: "Kumari Selection",
    shortDescription: "Tantric selection ritual",
    description:
      "Document the 32 lakshana examination, horoscope matching, and fearlessness tests.",
    icon: "🔍",
    category: "Living Goddess (Kumari)",
    categoryKey: "kumari",
    route: "/contribute/kumari-selection",
    difficulty: "advanced",
  },
  {
    key: "kumari_retirement",
    label: "Kumari Retirement",
    shortDescription: "Return to secular status",
    description:
      "Record the formal event ending a Living Goddess tenure.",
    icon: "🚪",
    category: "Living Goddess (Kumari)",
    categoryKey: "kumari",
    route: "/contribute/kumari-retirement",
    difficulty: "advanced",
  },

  // Conceptual Entities
  {
    key: "deity",
    label: "Deity",
    shortDescription: "Hindu, Buddhist, or syncretic divine entities",
    description:
      "Add divine entities with tradition, alternate names, and iconographic links.",
    icon: "✨",
    category: "Conceptual Entities",
    categoryKey: "conceptual",
    route: "/contribute/deity",
    difficulty: "beginner",
  },
  {
    key: "syncretism",
    label: "Syncretic Relationship",
    shortDescription: "Cross-tradition deity equivalences",
    description:
      "Map deity equivalences (e.g., Avalokiteshvara = Matsyendranath) with provenance.",
    icon: "🔗",
    category: "Conceptual Entities",
    categoryKey: "conceptual",
    route: "/contribute/syncretism",
    difficulty: "advanced",
  },

  // Social Organizations
  {
    key: "guthi",
    label: "Guthi Organization",
    shortDescription: "Endowed trusts managing temples and rituals",
    description:
      "Register Guthi organizations with type, membership, and managed structures.",
    icon: "🏘️",
    category: "Social Organizations",
    categoryKey: "social",
    route: "/contribute/guthi",
    difficulty: "intermediate",
  },
  {
    key: "person",
    label: "Historical Person",
    shortDescription: "Kings, artisans, priests, scholars",
    description:
      "Record historical persons with biography and institutional affiliation.",
    icon: "👤",
    category: "Social Organizations",
    categoryKey: "social",
    route: "/contribute/person",
    difficulty: "beginner",
  },
  {
    key: "caste_group",
    label: "Caste Group",
    shortDescription: "Hereditary social groups (Jati)",
    description:
      "Document groups with specific ritual roles and occupational duties.",
    icon: "👥",
    category: "Social Organizations",
    categoryKey: "social",
    route: "/contribute/caste-group",
    difficulty: "intermediate",
  },

  // Spaces & Time
  {
    key: "location",
    label: "Place / Location",
    shortDescription: "Geographic heritage locations",
    description:
      "Add locations where heritage structures exist and events occur.",
    icon: "🗺️",
    category: "Spaces & Time",
    categoryKey: "spacetime",
    route: "/contribute/location",
    difficulty: "beginner",
  },
  {
    key: "period",
    label: "Historical Period",
    shortDescription: "Lichhavi, Malla, and other eras",
    description:
      "Define time periods for contextualizing heritage.",
    icon: "⏳",
    category: "Spaces & Time",
    categoryKey: "spacetime",
    route: "/contribute/period",
    difficulty: "beginner",
  },
  {
    key: "calendar",
    label: "Calendar System",
    shortDescription: "Bikram Sambat, Nepal Sambat, etc.",
    description:
      "Register calendar systems with epoch dates and Gregorian conversion rules.",
    icon: "📆",
    category: "Spaces & Time",
    categoryKey: "spacetime",
    route: "/contribute/calendar",
    difficulty: "intermediate",
  },

  // Sources & Provenance
  {
    key: "source",
    label: "Source / Document",
    shortDescription: "Books, records, oral histories, inscriptions",
    description:
      "Add sources with DataCite identifiers, citation, and language.",
    icon: "📚",
    category: "Sources & Provenance",
    categoryKey: "provenance",
    route: "/contribute/source",
    difficulty: "beginner",
  },
  {
    key: "documentation",
    label: "Documentation Activity",
    shortDescription: "Field surveys, interviews, archival research",
    description:
      "Log the process of recording heritage information.",
    icon: "📋",
    category: "Sources & Provenance",
    categoryKey: "provenance",
    route: "/contribute/documentation",
    difficulty: "intermediate",
  },
  {
    key: "assertion",
    label: "Heritage Assertion",
    shortDescription: "Factual claims with source and confidence",
    description:
      "Record a factual claim with explicit source, author, and confidence score.",
    icon: "✅",
    category: "Sources & Provenance",
    categoryKey: "provenance",
    route: "/contribute/assertion",
    difficulty: "advanced",
  },
];

const difficultyConfig: Record<
  string,
  { color: string; label: string }
> = {
  beginner: {
    color:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    label: "Beginner",
  },
  intermediate: {
    color:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    label: "Intermediate",
  },
  advanced: {
    color:
      "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    label: "Advanced",
  },
};

const quickStartKeys = ["structure", "source", "location", "person"];

function ContributionCard({
  intent,
  compact = false,
}: {
  intent: ContributionIntent;
  compact?: boolean;
}) {
  const router = useRouter();
  const diff = difficultyConfig[intent.difficulty];

  return (
    <motion.div
      variants={scaleIn}
      className="group relative"
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className={`relative ${glassCard} hover:bg-white dark:hover:bg-gray-900 transition-all duration-300 hover:shadow-xl cursor-pointer ${
          compact ? "p-4" : "p-5"
        }`}
        onClick={() => router.push(intent.route)}
      >
        <div className="flex items-start gap-3">
          <span className={compact ? "text-xl" : "text-2xl"} role="img">
            {intent.icon}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3
                className={`font-semibold text-blue-900 dark:text-blue-100 truncate ${
                  compact ? "text-sm" : "text-base"
                }`}
              >
                {intent.label}
              </h3>
              <Badge
                variant="secondary"
                className={`${diff.color} text-[10px] px-1.5 py-0 shrink-0`}
              >
                {diff.label}
              </Badge>
            </div>
            <p
              className={`text-blue-600/70 dark:text-blue-300/70 leading-relaxed ${
                compact ? "text-xs" : "text-sm"
              }`}
            >
              {compact ? intent.shortDescription : intent.description}
            </p>
          </div>
          <IconArrowRight className="w-4 h-4 text-blue-300 dark:text-blue-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all duration-200 shrink-0 mt-1" />
        </div>
      </div>
    </motion.div>
  );
}

export default function ContributeDashboard() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const filteredIntents = useMemo(() => {
    if (!search.trim()) return contributionIntents;
    const q = search.toLowerCase();
    return contributionIntents.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.shortDescription.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
    );
  }, [search]);

  const tabIntents = useMemo(() => {
    if (activeTab === "all") return filteredIntents;
    return filteredIntents.filter((i) => i.categoryKey === activeTab);
  }, [activeTab, filteredIntents]);

  const isSearching = search.trim().length > 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Hero — compact and focused */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={fadeInUp}
        className={`relative overflow-hidden ${glassCard} p-6 md:p-8`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-500 opacity-95 rounded-2xl" />
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        <div className="relative z-10 text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-xs font-medium text-white">
            <IconSparkles className="w-3.5 h-3.5" /> Contribute Knowledge
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            Preserve Nepal&apos;s Cultural Heritage
          </h1>
          <p className="text-blue-100 max-w-lg mx-auto text-sm">
            Choose what you&apos;d like to contribute. Every entry is reviewed
            by experts before publication.
          </p>
        </div>
      </motion.div>

      {/* Search bar */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={fadeInUp}
        className="relative"
      >
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search contribution types... (e.g. temple, festival, person)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-9 h-11 rounded-xl bg-white/80 dark:bg-gray-900/80 border-blue-200 dark:border-gray-700"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <IconX className="w-4 h-4" />
          </button>
        )}
      </motion.div>

      {isSearching ? (
        /* Search results */
        <motion.div
          initial="hidden"
          animate="show"
          variants={staggerContainer}
          className="space-y-3"
        >
          <p className="text-sm text-muted-foreground">
            {tabIntents.length} result{tabIntents.length !== 1 ? "s" : ""} for
            &ldquo;{search}&rdquo;
          </p>
          <AnimatePresence mode="popLayout">
            {tabIntents.map((intent) => (
              <ContributionCard key={intent.key} intent={intent} />
            ))}
          </AnimatePresence>
          {tabIntents.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">No matching contribution types</p>
              <p className="text-sm mt-1">
                Try different keywords or browse the categories below
              </p>
              <button
                onClick={() => setSearch("")}
                className="mt-3 text-sm text-blue-600 hover:underline"
              >
                Clear search
              </button>
            </div>
          )}
        </motion.div>
      ) : (
        <>
          {/* Quick Start — featured beginner items */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={staggerContainer}
          >
            <motion.div
              variants={fadeInUp}
              className="flex items-center gap-2 mb-3"
            >
              <span className="text-lg">💡</span>
              <h2 className="text-base font-semibold text-blue-900 dark:text-blue-100">
                Start Here
              </h2>
              <span className="text-xs text-muted-foreground">
                — beginner-friendly contributions
              </span>
            </motion.div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {contributionIntents
                .filter((i) => quickStartKeys.includes(i.key))
                .map((intent) => (
                  <ContributionCard key={intent.key} intent={intent} />
                ))}
            </div>
          </motion.div>

          {/* Category tabs + cards */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeInUp}
          >
            <h2 className="text-base font-semibold text-blue-900 dark:text-blue-100 mb-3">
              Browse by Category
            </h2>
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="space-y-4"
            >
              <TabsList className="flex-wrap h-auto gap-1 p-1 bg-blue-50/80 dark:bg-gray-800/80">
                <TabsTrigger value="all" className="text-xs px-3">
                  All
                </TabsTrigger>
                {categoryOrder.map((catKey) => {
                  const meta = categoryMeta[catKey];
                  const count = contributionIntents.filter(
                    (i) => i.categoryKey === catKey
                  ).length;
                  return (
                    <TabsTrigger
                      key={catKey}
                      value={catKey}
                      className="text-xs px-3 gap-1"
                    >
                      <span>{meta.icon}</span>
                      <span className="hidden sm:inline">{meta.label}</span>
                      <span className="sm:hidden">{meta.label.split(" ")[0]}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {count}
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              <TabsContent value={activeTab} className="mt-0">
                <motion.div
                  key={activeTab}
                  initial="hidden"
                  animate="show"
                  variants={staggerContainer}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  {tabIntents.map((intent) => (
                    <ContributionCard
                      key={intent.key}
                      intent={intent}
                      compact
                    />
                  ))}
                </motion.div>
                {tabIntents.length === 0 && (
                  <p className="text-center py-8 text-muted-foreground text-sm">
                    No contributions in this category yet
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </motion.div>
        </>
      )}
    </div>
  );
}
