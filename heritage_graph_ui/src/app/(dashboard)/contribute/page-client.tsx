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
import { AlertCircle } from "lucide-react";
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
  }, [search, contributionIntents]);

  const tabIntents = useMemo(() => {
    if (activeTab === "all") return filteredIntents;
    return filteredIntents.filter((i) => i.categoryKey === activeTab);
  }, [activeTab, filteredIntents]);

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
            Choose what you&apos;d like to contribute. Every entry is reviewed
            by experts before publication.
          </p>
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

      {isSearching ? (
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
                  if (!meta) return null;
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
