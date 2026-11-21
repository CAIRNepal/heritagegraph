"use client";

/**
 * Contribute hub — human-first entry.
 * Goal: someone with no ontology knowledge can answer
 * “Is this new, or already here?” then pick a plain type and start.
 */

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  IconArrowRight,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import {
  AlertCircle,
  FolderKanban,
  GitMerge,
  Link2,
  Plus,
  Search,
  ListChecks,
} from "lucide-react";
import { fadeInUp, staggerContainer, scaleIn, glassCard } from "@/lib/design";
import { useOntology } from "@/lib/ontology/OntologyProvider";
import type { ContributeHubIntentRow } from "@/lib/ontology/types";
import { plainContributeClassLabel } from "@/lib/ontology/contribute-plain-copy";
import { cn } from "@/lib/utils";

interface ContributionIntent {
  key: string;
  label: string;
  description: string;
  shortDescription: string;
  icon: string;
  route: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  journey: "places" | "people" | "events" | "sources";
}

const JOURNEYS: Array<{ key: ContributionIntent["journey"] }> = [
  { key: "places" },
  { key: "people" },
  { key: "events" },
  { key: "sources" },
];

const journeyByRegistryKey: Record<string, ContributionIntent["journey"]> = {
  entity: "places",
  structure: "places",
  iconography: "places",
  monument: "places",
  deity: "places",
  tradition: "places",
  location: "places",
  period: "places",
  calendar: "places",
  syncretism: "places",
  person: "people",
  guthi: "people",
  caste_group: "people",
  entity_proposal: "people",
  ritual: "events",
  festival: "events",
  event: "events",
  production: "events",
  consecration: "events",
  enshrinement: "events",
  transfer_of_custody: "events",
  kumari_tenure: "events",
  kumari_selection: "events",
  kumari_retirement: "events",
  source: "sources",
  data_source: "sources",
  assertion: "sources",
};

function journeyFromIntent(
  key: string,
  categoryKey: string
): ContributionIntent["journey"] {
  const mapped = journeyByRegistryKey[key];
  if (mapped) return mapped;
  if (categoryKey === "events" || categoryKey === "kumari") return "events";
  if (categoryKey === "social") return "people";
  if (categoryKey === "provenance") return "sources";
  return "places";
}

function buildIntents(
  hubIntents: readonly ContributeHubIntentRow[],
  classLabelByKey: Map<string, string>
): ContributionIntent[] {
  const out: ContributionIntent[] = [];
  for (const row of hubIntents) {
    const label = plainContributeClassLabel(
      row.registryKey,
      classLabelByKey.get(row.registryKey) || titleCaseKey(row.registryKey)
    );
    out.push({
      key: row.registryKey,
      label,
      description: row.description,
      shortDescription: row.shortDescription,
      icon: row.emoji,
      route: row.route,
      difficulty: row.difficulty,
      journey: journeyFromIntent(row.registryKey, row.hubCategory),
    });
  }
  return out;
}

function titleCaseKey(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function TypePill({
  intent,
  onClick,
}: {
  intent: ContributionIntent;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-[11.5rem] shrink-0 flex-col gap-1 rounded-2xl border border-border/80 bg-card p-3.5 text-left",
        "transition-all hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <span className="text-xl" role="img" aria-hidden>
        {intent.icon}
      </span>
      <span className="text-sm font-semibold leading-snug text-foreground line-clamp-2">
        {intent.label}
      </span>
      <span className="text-[11px] leading-snug text-muted-foreground line-clamp-2">
        {intent.shortDescription}
      </span>
      <span className="mt-auto inline-flex items-center gap-0.5 pt-1 text-[11px] font-medium text-primary opacity-80 group-hover:opacity-100">
        Start
        <IconArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

function HorizontalScroller({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  const t = useTranslations("contributeHub");
  const ref = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(320, el.clientWidth * 0.75), behavior: "smooth" });
  };
  return (
    <div className="relative">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="hidden gap-1 sm:flex">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            aria-label={t('scrollLeft')}
            onClick={() => scrollBy(-1)}
          >
            <IconChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            aria-label={t('scrollRight')}
            onClick={() => scrollBy(1)}
          >
            <IconChevronRight className="size-4" />
          </Button>
        </div>
      </div>
      <div
        ref={ref}
        className="flex gap-3 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </div>
  );
}

export default function ContributeDashboard() {
  const t = useTranslations("contributeHub");
  const router = useRouter();
  const { registry, reload, degradedReason } = useOntology();
  const hub = registry.contribute_hub ?? {
    hubCategories: [],
    intents: [],
    quickStart: [],
  };

  const classLabelByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const [k, cls] of Object.entries(registry.classes)) {
      m.set(k, cls.label);
    }
    return m;
  }, [registry.classes]);

  const contributionIntents = useMemo(
    () => buildIntents(hub.intents, classLabelByKey),
    [hub.intents, classLabelByKey]
  );

  const quickStartKeys = hub.quickStart;
  const [search, setSearch] = useState("");
  const [activeJourney, setActiveJourney] =
    useState<ContributionIntent["journey"]>("places");
  const [showSpecialist, setShowSpecialist] = useState(false);

  const filteredIntents = useMemo(() => {
    if (!search.trim()) return contributionIntents;
    const q = search.toLowerCase();
    return contributionIntents.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.shortDescription.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.key.toLowerCase().includes(q)
    );
  }, [search, contributionIntents]);

  const isSearching = search.trim().length > 0;

  const quickStart = useMemo(() => {
    const preferred = contributionIntents.filter((i) =>
      quickStartKeys.includes(i.key)
    );
    if (preferred.length) return preferred;
    return contributionIntents.filter((i) => i.difficulty === "beginner").slice(0, 6);
  }, [contributionIntents, quickStartKeys]);

  const journeyTypes = useMemo(() => {
    const list = contributionIntents.filter((i) => i.journey === activeJourney);
    if (showSpecialist) return list;
    return list.filter((i) => i.difficulty !== "advanced");
  }, [contributionIntents, activeJourney, showSpecialist]);

  const specialistCount = useMemo(
    () =>
      contributionIntents.filter(
        (i) => i.journey === activeJourney && i.difficulty === "advanced"
      ).length,
    [contributionIntents, activeJourney]
  );

  if (contributionIntents.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
        <Alert className="border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/30">
          <AlertCircle className="text-amber-700 dark:text-amber-400" />
          <AlertTitle>We couldn&apos;t load contribution options</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              This is usually temporary. Try again in a moment
              {degradedReason === "unauthenticated" ? ", or sign in first" : ""}.
            </p>
            <Button type="button" size="sm" onClick={() => void reload()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-1 sm:px-0">
      {/* One clear job */}
      <motion.header
        initial="hidden"
        animate="show"
        variants={fadeInUp}
        className="space-y-2 pt-1"
      >
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Share what you know
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground leading-relaxed">
          You don&apos;t need technical knowledge. Choose whether you&apos;re adding something
          new or improving a record that already exists. A reviewer checks every submission
          before it is published.
        </p>
      </motion.header>

      {/* Two paths only */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={staggerContainer}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <motion.button
          type="button"
          variants={scaleIn}
          onClick={() =>
            document
              .getElementById("add-new")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          className={cn(
            "group text-left p-5",
            glassCard,
            "ring-1 ring-primary/25 hover:border-primary/40 hover:shadow-sm transition-all"
          )}
        >
          <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Plus className="size-5" aria-hidden />
          </span>
          <h2 className="text-base font-semibold">{t('addNew')}</h2>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            A temple, person, festival, or document that isn&apos;t in the system yet.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
            Choose a type below
            <IconArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </motion.button>

        <motion.button
          type="button"
          variants={scaleIn}
          onClick={() => router.push("/contribute/improve")}
          className={cn(
            "group text-left p-5",
            glassCard,
            "hover:border-primary/40 hover:shadow-sm transition-all"
          )}
        >
          <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Search className="size-5" aria-hidden />
          </span>
          <h2 className="text-base font-semibold">{t('updateExisting')}</h2>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            Search first — then fix details or connect it to another record. Avoids duplicates.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
            Search records
            <IconArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </motion.button>
      </motion.div>

      {/* Secondary actions — horizontal chips, not a card wall */}
      <motion.div initial="hidden" animate="show" variants={fadeInUp} className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Also useful
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            {
              href: "/contribute/relationship-proposal",
              icon: Link2,
              label: t('quick.connect'),
            },
            {
              href: "/contribute/entity-proposal",
              icon: GitMerge,
              label: t('quick.duplicate'),
            },
            {
              href: "/contribute/projects",
              icon: FolderKanban,
              label: t('quick.project'),
            },
            {
              href: "/contribute/my-contributions",
              icon: ListChecks,
              label: t('quick.mySubmissions'),
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-muted/40"
            >
              <item.icon className="size-3.5 text-muted-foreground" aria-hidden />
              {item.label}
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Add new — search + scrollers */}
      <motion.section
        id="add-new"
        initial="hidden"
        animate="show"
        variants={fadeInUp}
        className="scroll-mt-24 space-y-5"
      >
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">{t('whatAreYouAdding')}</h2>
          <p className="text-sm text-muted-foreground">
            Pick the closest match. If you&apos;re unsure, choose &ldquo;Something else&rdquo; or
            search by everyday words like temple, festival, or priest.
          </p>
        </div>

        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('searchTypesPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 rounded-xl border-border bg-card pl-9 pr-9"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={t('clearSearch')}
            >
              <IconX className="size-4" />
            </button>
          ) : null}
        </div>

        {isSearching ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {filteredIntents.length} match
              {filteredIntents.length === 1 ? "" : "es"} for &ldquo;{search.trim()}&rdquo;
            </p>
            <AnimatePresence mode="popLayout">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {filteredIntents.map((intent) => (
                  <button
                    key={intent.key}
                    type="button"
                    onClick={() => router.push(intent.route)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border border-border bg-card p-3.5 text-left",
                      "hover:border-primary/40 transition-colors"
                    )}
                  >
                    <span className="text-xl" role="img" aria-hidden>
                      {intent.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{intent.label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">
                        {intent.shortDescription}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </AnimatePresence>
            {filteredIntents.length === 0 ? (
              <div className={`${glassCard} space-y-3 p-5`}>
                <p className="text-sm text-muted-foreground">
                  No type matched that search. Try another word, or check whether the record
                  already exists.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setSearch("")}>
                    Clear search
                  </Button>
                  <Button asChild size="sm">
                    <Link href="/contribute/improve">{t('searchExisting')}</Link>
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">{t('popularStarts')}</h3>
              <HorizontalScroller label={t('swipeHint')}>
                {quickStart.map((intent) => (
                  <div key={intent.key} className="snap-start">
                    <TypePill intent={intent} onClick={() => router.push(intent.route)} />
                  </div>
                ))}
              </HorizontalScroller>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{t('browseByKind')}</h3>
              <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {JOURNEYS.map((j) => {
                  const count = contributionIntents.filter((i) => {
                    if (i.journey !== j.key) return false;
                    if (!showSpecialist && i.difficulty === "advanced") return false;
                    return true;
                  }).length;
                  const active = activeJourney === j.key;
                  return (
                    <button
                      key={j.key}
                      type="button"
                      onClick={() => setActiveJourney(j.key)}
                      className={cn(
                        "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:border-primary/40"
                      )}
                    >
                      {t(`journeys.${j.key}.label`)}
                      <span
                        className={cn(
                          "ml-1.5 text-[10px]",
                          active ? "text-primary-foreground/80" : "text-muted-foreground"
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {activeJourney ? t(`journeys.${activeJourney}.hint`) : null}
              </p>
              <HorizontalScroller label={t('scrollHint')}>
                {journeyTypes.map((intent) => (
                  <div key={intent.key} className="snap-start">
                    <TypePill intent={intent} onClick={() => router.push(intent.route)} />
                  </div>
                ))}
              </HorizontalScroller>
              {journeyTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Nothing in this group yet.</p>
              ) : null}
              {!showSpecialist && specialistCount > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setShowSpecialist(true)}
                >
                  Show {specialistCount} less common type{specialistCount === 1 ? "" : "s"}
                </Button>
              ) : showSpecialist ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setShowSpecialist(false)}
                >
                  Hide less common types
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </motion.section>

      <p className="pb-6 text-center text-xs text-muted-foreground">
        After you submit, track status under{" "}
        <Link href="/contribute/my-contributions" className="underline underline-offset-2">
          My submissions
        </Link>
        .
      </p>
    </div>
  );
}
