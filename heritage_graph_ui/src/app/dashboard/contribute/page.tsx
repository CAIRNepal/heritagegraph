"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { IconSparkles, IconArrowRight } from "@tabler/icons-react";

/* ── animation variants (matches landing page & dashboard home) ── */
const fadeInUp = {
  hidden: { opacity: 0, y: 60 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8 } },
};
const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.3 } },
};
const scaleIn = {
  hidden: { scale: 0.8, opacity: 0 },
  show: { scale: 1, opacity: 1, transition: { duration: 0.6 } },
};
const glassCard =
  "bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-blue-200 dark:border-gray-700 rounded-2xl shadow-lg";

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
  { key: "structure", label: "Record a Structure", description: "Temples, stupas, rest houses, water spouts, and other architectural heritage. Includes location, condition, and construction details.", icon: "🏛️", category: "Tangible Heritage", route: "/dashboard/contribute/structure", difficulty: "beginner", gradient: "from-blue-500 to-sky-500" },
  { key: "ritual", label: "Document a Ritual or Festival", description: "Puja ceremonies, Jatra processions, masked dances, and other ritual activities. Includes timing, performers, and procession routes.", icon: "🔥", category: "Events & Rituals", route: "/dashboard/contribute/ritual", difficulty: "intermediate", gradient: "from-blue-600 to-cyan-500" },
  { key: "deity", label: "Add a Deity", description: "Hindu, Buddhist, or syncretic divine entities with their traditions, alternate names, and iconographic descriptions.", icon: "✨", category: "Conceptual Entities", route: "/dashboard/contribute/deity", difficulty: "beginner", gradient: "from-sky-400 to-blue-500" },
  { key: "guthi", label: "Register a Guthi Organization", description: "Endowed trust organizations managing temples, rituals, and land. Includes type, membership, and managed structures.", icon: "🏘️", category: "Social Organizations", route: "/dashboard/contribute/guthi", difficulty: "intermediate", gradient: "from-blue-500 to-indigo-500" },
  { key: "field-survey", label: "Submit a Field Survey", description: "On-the-ground condition reports with observations, photos, and GPS coordinates. Ideal for mobile contributors.", icon: "📋", category: "Documentation", route: "/dashboard/contribute/structure", difficulty: "beginner", gradient: "from-sky-500 to-blue-600" },
  { key: "source", label: "Add a Source / Document", description: "Books, archival records, oral histories, inscriptions, and other reference materials that support heritage claims.", icon: "📚", category: "Sources & Provenance", route: "/dashboard/contribute/source", difficulty: "beginner", gradient: "from-blue-400 to-sky-500" },
  { key: "person", label: "Record a Historical Person", description: "Kings, artisans, priests, scholars, and other individuals who shaped cultural heritage through their activities.", icon: "👤", category: "Social Organizations", route: "/dashboard/contribute/person", difficulty: "beginner", gradient: "from-blue-500 to-cyan-500" },
  { key: "location", label: "Add a Place / Location", description: "Geographic locations where heritage structures exist and events occur. Includes coordinates and place type.", icon: "🗺️", category: "Spaces & Time", route: "/dashboard/contribute/location", difficulty: "beginner", gradient: "from-sky-500 to-blue-500" },
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
