"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { IconSparkles, IconArrowRight } from "@tabler/icons-react";
import { fadeInUp, staggerContainer, scaleIn, glassCard } from '@/lib/design';

interface ContributionIntent {
  key: string;
  label: string;
  description: string;
  icon: string;
  category: string;
  route: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  gradient: string;
}

const contributionIntents: ContributionIntent[] = [
  // Tangible Heritage
  { key: "structure", label: "Record a Structure", description: "Temples, stupas, rest houses, water spouts, and other architectural heritage. Includes location, condition, architectural style, and managed Guthi links.", icon: "🏛️", category: "Tangible Heritage", route: "/dashboard/contribute/structure", difficulty: "beginner", gradient: "from-blue-500 to-sky-500" },
  { key: "iconography", label: "Document an Iconographic Object", description: "Sacred visual art — Paubha scroll paintings, Murti consecrated statues — with deity depictions and provenance.", icon: "🎨", category: "Tangible Heritage", route: "/dashboard/contribute/iconography", difficulty: "intermediate", gradient: "from-blue-600 to-cyan-500" },
  { key: "monument", label: "Add a Buddhist Monument", description: "Stupas, Chaityas, and other Buddhist sacred structures with circumambulation and ritual patterns.", icon: "⛩️", category: "Tangible Heritage", route: "/dashboard/contribute/monument", difficulty: "beginner", gradient: "from-sky-400 to-blue-500" },

  // Events & Rituals
  { key: "ritual", label: "Document a Ritual", description: "Puja ceremonies, consecrations, processions, and other ritual activities. Includes deity invocation, performers, timing, and procession routes.", icon: "🔥", category: "Events & Rituals", route: "/dashboard/contribute/ritual", difficulty: "intermediate", gradient: "from-blue-600 to-cyan-500" },
  { key: "festival", label: "Record a Festival", description: "Jatra processions, chariot festivals, masked dances — large-scale community events with component rituals.", icon: "🎪", category: "Events & Rituals", route: "/dashboard/contribute/festival", difficulty: "intermediate", gradient: "from-sky-500 to-blue-600" },
  { key: "event", label: "Log a Historical Event", description: "Major events affecting heritage: earthquakes, fires, political transitions, floods.", icon: "📅", category: "Events & Rituals", route: "/dashboard/contribute/event", difficulty: "beginner", gradient: "from-blue-500 to-indigo-500" },

  // Living Goddess (Kumari)
  { key: "kumari_tenure", label: "Record a Living Goddess Tenure", description: "Document a Kumari's period of divine embodiment — the person, deity, residence god-house, and supporting Guthi.", icon: "👑", category: "Living Goddess (Kumari)", route: "/dashboard/contribute/kumari-tenure", difficulty: "advanced", gradient: "from-purple-500 to-pink-500" },
  { key: "kumari_selection", label: "Document a Kumari Selection", description: "The tantric selection ritual — 32 lakshana examination, horoscope matching, and fearlessness tests.", icon: "🔍", category: "Living Goddess (Kumari)", route: "/dashboard/contribute/kumari-selection", difficulty: "advanced", gradient: "from-pink-500 to-purple-500" },
  { key: "kumari_retirement", label: "Record a Kumari Retirement", description: "The formal event ending a Living Goddess tenure, marking return to secular status.", icon: "🚪", category: "Living Goddess (Kumari)", route: "/dashboard/contribute/kumari-retirement", difficulty: "advanced", gradient: "from-purple-600 to-indigo-500" },

  // Conceptual Entities
  { key: "deity", label: "Add a Deity", description: "Hindu, Buddhist, or syncretic divine entities with tradition, alternate names, and links to iconographic objects.", icon: "✨", category: "Conceptual Entities", route: "/dashboard/contribute/deity", difficulty: "beginner", gradient: "from-sky-400 to-blue-500" },
  { key: "syncretism", label: "Map a Syncretic Relationship", description: "Document cross-tradition deity equivalences (e.g., Avalokiteshvara = Matsyendranath) with epistemic provenance.", icon: "🔗", category: "Conceptual Entities", route: "/dashboard/contribute/syncretism", difficulty: "advanced", gradient: "from-blue-500 to-indigo-500" },

  // Social Organizations
  { key: "guthi", label: "Register a Guthi Organization", description: "Endowed trust organizations managing temples, rituals, and land. Includes Guthi type, membership, and managed structures.", icon: "🏘️", category: "Social Organizations", route: "/dashboard/contribute/guthi", difficulty: "intermediate", gradient: "from-blue-500 to-indigo-500" },
  { key: "person", label: "Record a Historical Person", description: "Kings, artisans, priests, scholars — with biography, institutional affiliation, and expertise areas.", icon: "👤", category: "Social Organizations", route: "/dashboard/contribute/person", difficulty: "beginner", gradient: "from-blue-500 to-cyan-500" },
  { key: "caste_group", label: "Document a Caste Group", description: "Hereditary social groups (Jati) with specific ritual roles and occupational duties (e.g., Vajracharya, Shakya).", icon: "👥", category: "Social Organizations", route: "/dashboard/contribute/caste-group", difficulty: "intermediate", gradient: "from-sky-500 to-blue-600" },

  // Spaces & Time
  { key: "location", label: "Add a Place / Location", description: "Geographic locations where heritage structures exist and events occur. Includes WKT coordinates and place type.", icon: "🗺️", category: "Spaces & Time", route: "/dashboard/contribute/location", difficulty: "beginner", gradient: "from-sky-500 to-blue-500" },
  { key: "period", label: "Define a Historical Period", description: "Time periods (Lichhavi Era, Malla Period) with temporal extent for contextualizing heritage.", icon: "⏳", category: "Spaces & Time", route: "/dashboard/contribute/period", difficulty: "beginner", gradient: "from-blue-400 to-sky-500" },
  { key: "calendar", label: "Register a Calendar System", description: "Calendar reckoning systems (Bikram Sambat, Nepal Sambat) with epoch dates and Gregorian conversion rules.", icon: "📆", category: "Spaces & Time", route: "/dashboard/contribute/calendar", difficulty: "intermediate", gradient: "from-blue-500 to-sky-600" },

  // Sources & Provenance
  { key: "source", label: "Add a Source / Document", description: "Books, archival records, oral histories, inscriptions — with DataCite identifiers, citation, and language.", icon: "📚", category: "Sources & Provenance", route: "/dashboard/contribute/source", difficulty: "beginner", gradient: "from-blue-400 to-sky-500" },
  { key: "documentation", label: "Log a Documentation Activity", description: "Field surveys, oral history interviews, archival research — the process of recording heritage information.", icon: "📋", category: "Sources & Provenance", route: "/dashboard/contribute/documentation", difficulty: "intermediate", gradient: "from-sky-500 to-blue-600" },
  { key: "assertion", label: "Record a Heritage Assertion", description: "A factual claim about a heritage entity with explicit source, author, confidence score, and reconciliation status.", icon: "✅", category: "Sources & Provenance", route: "/dashboard/contribute/assertion", difficulty: "advanced", gradient: "from-blue-500 to-indigo-500" },
];

const difficultyColors: Record<string, string> = {
  beginner: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  intermediate: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  advanced: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

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
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* ── Hero Header ── */}
      <motion.div initial="hidden" animate="show" variants={staggerContainer} className={`relative overflow-hidden ${glassCard} p-8 md:p-10`}>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-500 opacity-95 rounded-2xl" />
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-sky-300/20 rounded-full blur-2xl animate-pulse" />
        <motion.div variants={fadeInUp} className="relative z-10 space-y-3 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-sm font-medium text-white mx-auto">
            <IconSparkles className="w-4 h-4" /> Contribute Knowledge
          </div>
          <h1 className="text-3xl md:text-4xl font-black leading-tight text-white">
            Help Preserve Nepal&apos;s{" "}
            <span className="bg-gradient-to-r from-white via-blue-100 to-sky-100 bg-clip-text text-transparent">Cultural Heritage</span>
          </h1>
          <p className="text-blue-100 max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
            Contribute structured data backed by provenance — cite your sources, and reviewers will verify the information.
          </p>
        </motion.div>
      </motion.div>

      {/* Quick-start callout */}
      <motion.div initial="hidden" animate="show" variants={fadeInUp} className={`${glassCard} p-4 flex items-start gap-3`}>
        <span className="text-xl">💡</span>
        <div>
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">New to contributing?</p>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Start by recording a <strong>Structure</strong> or adding a <strong>Source</strong> — these are the simplest forms and help build the foundation for more complex entries.
          </p>
        </div>
      </motion.div>

      {/* Contribution intent cards grouped by category */}
      {Object.entries(grouped).map(([category, intents]) => (
        <motion.div key={category} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={staggerContainer}>
          <motion.h2 variants={fadeInUp} className="text-xl font-bold mb-4 text-blue-900 dark:text-blue-100">
            {category.split(" ")[0]}{" "}
            <span className="text-transparent bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text">{category.split(" ").slice(1).join(" ")}</span>
          </motion.h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {intents.map((intent) => (
              <motion.div key={intent.key} variants={scaleIn} className="group relative">
                <div className={`relative p-6 ${glassCard} hover:bg-white dark:hover:bg-gray-900 transition-all duration-500 transform hover:scale-[1.02] overflow-hidden hover:shadow-xl cursor-pointer`}
                  onClick={() => router.push(intent.route)}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${intent.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-2xl`} />
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`inline-flex p-3 rounded-2xl bg-gradient-to-br ${intent.gradient} shadow-lg`}>
                        <span className="text-xl">{intent.icon}</span>
                      </div>
                      <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-sky-500 group-hover:bg-clip-text transition-all duration-300">
                        {intent.label}
                      </h3>
                    </div>
                    <Badge variant="secondary" className={difficultyColors[intent.difficulty]}>{intent.difficulty}</Badge>
                  </div>
                  <p className="text-blue-700 dark:text-blue-300 text-sm leading-relaxed">{intent.description}</p>
                  <IconArrowRight className="w-4 h-4 text-blue-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all duration-300 mt-3" />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
