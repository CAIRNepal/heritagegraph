"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  IconSparkles,
  IconArrowRight,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { AlertCircle, FileText } from "lucide-react";
import { fadeInUp, staggerContainer, scaleIn, glassCard } from "@/lib/design";
import { useOntology } from "@/lib/ontology/OntologyProvider";
import type { ContributeHubIntentRow } from "@/lib/ontology/types";

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
  journey: "describe" | "record" | "claim" | "verify";
}

const journeyMeta: Record<
  "describe" | "record" | "claim" | "verify",
  { label: string; icon: string; description: string }
> = {
  describe: {
    label: "Describe",
    icon: "🧭",
    description: "Capture what this heritage item is and where it exists.",
  },
  record: {
    label: "Record",
    icon: "📝",
    description: "Document events, ritual cycles, tenures, and timelines.",
  },
  claim: {
    label: "Claim",
    icon: "⚖️",
    description: "State relationships or assertions that need verification.",
  },
  verify: {
    label: "Verify",
    icon: "🔎",
    description: "Attach evidence and sources to support what we publish.",
  },
};

const journeyByRegistryKey: Record<
  string,
  "describe" | "record" | "claim" | "verify"
> = {
  entity_proposal: "claim",
  structure: "describe",
  iconography: "describe",
  monument: "describe",
  deity: "describe",
  tradition: "describe",
  person: "describe",
  caste_group: "describe",
  guthi: "describe",
  location: "describe",
  ritual: "record",
  festival: "record",
  event: "record",
  period: "record",
  calendar: "record",
  kumari_tenure: "record",
  kumari_selection: "record",
  kumari_retirement: "record",
  assertion: "claim",
  syncretism: "claim",
  source: "verify",
  data_source: "verify",
};

function journeyFromIntent(
  key: string,
  categoryKey: string
): "describe" | "record" | "claim" | "verify" {
  const mapped = journeyByRegistryKey[key];
  if (mapped) return mapped;
  if (categoryKey === "events" || categoryKey === "kumari" || categoryKey === "spatiotemporal") {
    return "record";
  }
  if (categoryKey === "provenance") {
    return "verify";
  }
  return "describe";
}

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

function buildIntents(
  hubIntents: readonly ContributeHubIntentRow[],
  categoryLabelByKey: Map<string, string>,
  classLabelByKey: Map<string, string>
): ContributionIntent[] {
  const out: ContributionIntent[] = [];
  for (const row of hubIntents) {
    const label = classLabelByKey.get(row.registryKey);
    if (!label) continue;
    out.push({
      key: row.registryKey,
      label,
      description: row.description,
      shortDescription: row.shortDescription,
      icon: row.emoji,
      category: categoryLabelByKey.get(row.hubCategory) ?? row.hubCategory,
      categoryKey: row.hubCategory,
      route: row.route,
      difficulty: row.difficulty,
      journey: journeyFromIntent(row.registryKey, row.hubCategory),
    });
  }
  return out;
}

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
  const router = useRouter();
  const { registry, reload, degradedReason } = useOntology();
  const hub = registry.contribute_hub ?? {
    hubCategories: [],
    intents: [],
    quickStart: [],
  };

  const categoryLabelByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of hub.hubCategories) {
      m.set(c.key, c.label);
    }
    return m;
  }, [hub.hubCategories]);

  const classLabelByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const [k, cls] of Object.entries(registry.classes)) {
      m.set(k, cls.label);
    }
    return m;
  }, [registry.classes]);

  const categoryOrder = useMemo(
    () =>
      [...hub.hubCategories]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((c) => c.key),
    [hub.hubCategories]
  );

  const categoryMeta = useMemo(() => {
    const r: Record<string, { label: string; icon: string }> = {};
    for (const c of hub.hubCategories) {
      r[c.key] = { label: c.label, icon: c.icon };
    }
    return r;
  }, [hub.hubCategories]);

  const contributionIntents = useMemo(
    () => buildIntents(hub.intents, categoryLabelByKey, classLabelByKey),
    [hub.intents, categoryLabelByKey, classLabelByKey]
  );

  const quickStartKeys = hub.quickStart;

  const [search, setSearch] = useState("");
  const [activeJourney, setActiveJourney] = useState<
    "describe" | "record" | "claim" | "verify"
  >("describe");

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
  }, [search, contributionIntents]);

  const journeyIntents = useMemo(
    () => filteredIntents.filter((i) => i.journey === activeJourney),
    [activeJourney, filteredIntents]
  );

  const journeyCategoryGroups = useMemo(() => {
    const grouped: Record<string, ContributionIntent[]> = {};
    for (const intent of journeyIntents) {
      if (!grouped[intent.categoryKey]) grouped[intent.categoryKey] = [];
      grouped[intent.categoryKey].push(intent);
    }
    return categoryOrder
      .filter((k) => grouped[k]?.length)
      .map((k) => ({
        categoryKey: k,
        categoryLabel: categoryMeta[k]?.label ?? k,
        categoryIcon: categoryMeta[k]?.icon ?? "📂",
        intents: grouped[k],
      }));
  }, [categoryMeta, categoryOrder, journeyIntents]);

  const isSearching = search.trim().length > 0;

  if (contributionIntents.length === 0) {
    const hubEmpty =
      !hub.intents?.length &&
      !hub.hubCategories?.length &&
      !hub.quickStart?.length;
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
        <Alert className="border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/30">
          <AlertCircle className="text-amber-700 dark:text-amber-400" />
          <AlertTitle className="text-amber-950 dark:text-amber-100">
            Contribution types could not be loaded
          </AlertTitle>
          <AlertDescription className="space-y-3 text-amber-950/90 dark:text-amber-100/90">
            <p>
              The contribute hub needs both <strong className="text-foreground">registry classes</strong>{" "}
              and metadata from <code className="rounded bg-muted px-1 font-mono text-xs">contribute-hub</code>.
              Right now nothing matched, so there are no cards to show.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {hubEmpty ? (
                <li>
                  The loaded registry has <strong>no contribute hub data</strong> (often an
                  old server snapshot). Sign in and retry, or ask an admin to run{" "}
                  <code className="font-mono">python manage.py rebuild_schema_registry</code>.
                </li>
              ) : (
                <li>
                  Hub intents reference registry keys that are missing from{" "}
                  <code className="font-mono">registry.classes</code>—check that{" "}
                  <code className="font-mono">tools/contribute-hub.yaml</code>{" "}
                  <code className="font-mono">registryKey</code> values match{" "}
                  <code className="font-mono">tools/ui-classmap.yaml</code> <code className="font-mono">key</code>{" "}
                  entries, then run <code className="font-mono">make ontology</code>.
                </li>
              )}
              {degradedReason === "unauthenticated" ? (
                <li>You are not signed in; only the bundled snapshot is used—sign in for the live registry.</li>
              ) : null}
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" size="sm" onClick={() => void reload()}>
                Retry loading schema
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
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
            Navigate contribution journeys as Describe, Record, Claim, and Verify.
            Every entry is reviewed by experts before publication.
          </p>
        </div>
      </motion.div>

      <motion.div
        initial="hidden"
        animate="show"
        variants={fadeInUp}
        className={`${glassCard} p-5 md:p-6`}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="size-5" aria-hidden />
            </span>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Supervised document ingestion</h2>
              <p className="text-sm text-muted-foreground max-w-xl">
                Upload PDFs or scans, review OCR regions and extracted mentions, reconcile against the
                knowledge graph, then merge hints into a contribute form—nothing is published
                automatically.
              </p>
            </div>
          </div>
          <Button
            type="button"
            className="shrink-0"
            onClick={() => router.push("/contribute/ingestion")}
          >
            Start ingestion
          </Button>
        </div>
      </motion.div>

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
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <IconX className="w-4 h-4" />
          </button>
        )}
      </motion.div>

      {!isSearching &&
        (registry.semantic_patterns?.length ?? 0) > 0 ? (
          <motion.div
            initial="hidden"
            animate="show"
            variants={staggerContainer}
            className={`${glassCard} p-5 md:p-6 space-y-4`}
          >
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">
                Semantic workflows
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Guided multi-step paths that combine ontology forms and moderated relationship
                proposals so domain experts can assemble graph-shaped stories without writing RDF.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {(registry.semantic_patterns ?? []).map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => router.push(`/contribute/pattern/${encodeURIComponent(p.key)}`)}
                  className={`text-left ${glassCard} p-4 hover:bg-white/70 dark:hover:bg-gray-900 transition-colors cursor-pointer rounded-xl border border-blue-100/60 dark:border-gray-800`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xl shrink-0" role="img">
                      {p.emoji ?? "🧭"}
                    </span>
                    <div className="space-y-1 min-w-0">
                      <div className="font-medium text-sm truncate">{p.userLabel}</div>
                      {p.userDescription ? (
                        <p className="text-xs text-muted-foreground line-clamp-3">
                          {p.userDescription}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}

      {isSearching ? (
        <motion.div
          initial="hidden"
          animate="show"
          variants={staggerContainer}
          className="space-y-3"
        >
          <p className="text-sm text-muted-foreground">
            {filteredIntents.length} result{filteredIntents.length !== 1 ? "s" : ""} for
            &ldquo;{search}&rdquo;
          </p>
          <AnimatePresence mode="popLayout">
            {filteredIntents.map((intent) => (
              <ContributionCard key={intent.key} intent={intent} />
            ))}
          </AnimatePresence>
          {filteredIntents.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">No matching contribution types</p>
              <p className="text-sm mt-1">
                Try different keywords or browse the categories below
              </p>
              <button
                type="button"
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

          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeInUp}
          >
            <h2 className="text-base font-semibold text-blue-900 dark:text-blue-100 mb-3">
              Browse by Workflow
            </h2>
            <Tabs
              value={activeJourney}
              onValueChange={(value) =>
                setActiveJourney(value as "describe" | "record" | "claim" | "verify")
              }
              className="space-y-4"
            >
              <TabsList className="flex-wrap h-auto gap-1 p-1 bg-blue-50/80 dark:bg-gray-800/80">
                {(Object.keys(journeyMeta) as Array<
                  "describe" | "record" | "claim" | "verify"
                >).map((journeyKey) => {
                  const meta = journeyMeta[journeyKey];
                  const count = contributionIntents.filter(
                    (i) => i.journey === journeyKey
                  ).length;
                  return (
                    <TabsTrigger
                      key={journeyKey}
                      value={journeyKey}
                      className="text-xs px-3 gap-1"
                    >
                      <span>{meta.icon}</span>
                      <span>{meta.label}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {count}
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              <TabsContent value={activeJourney} className="mt-0 space-y-4">
                <p className="text-xs text-muted-foreground">
                  {journeyMeta[activeJourney].description}
                </p>
                <motion.div
                  key={activeJourney}
                  initial="hidden"
                  animate="show"
                  variants={staggerContainer}
                  className="space-y-4"
                >
                  {journeyCategoryGroups.map((group) => (
                    <div key={group.categoryKey} className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-800/90 dark:text-blue-200/90">
                        {group.categoryIcon} {group.categoryLabel}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {group.intents.map((intent) => (
                          <ContributionCard
                            key={intent.key}
                            intent={intent}
                            compact
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </motion.div>
                {journeyIntents.length === 0 && (
                  <p className="text-center py-8 text-muted-foreground text-sm">
                    No contributions in this workflow yet
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
