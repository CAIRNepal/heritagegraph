"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { IconArrowRight } from "@tabler/icons-react";

import type { DashboardLinkItem } from "@/config/dashboard-links";
import { glassCard, scaleIn } from "@/lib/design";

interface ShortcutGridProps {
  items: DashboardLinkItem[];
  variant: "compact" | "detailed";
  columns?: {
    base?: string;
    sm?: string;
    md?: string;
    lg?: string;
  };
}

export function ShortcutGrid({
  items,
  variant,
  columns = {
    base: "grid-cols-1",
    sm: "sm:grid-cols-2",
    lg: "lg:grid-cols-4",
  },
}: ShortcutGridProps) {
  const gridCols = ["grid", "gap-6", columns.base, columns.sm, columns.md, columns.lg]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={gridCols}>
      {items.map((item) => (
        <motion.div key={item.title} variants={scaleIn} className="group relative">
          <Link href={item.href} className="block h-full">
            <div
              className={[
                "relative overflow-hidden hover:shadow-xl cursor-pointer h-full",
                "transition-colors duration-200",
                glassCard,
                variant === "compact" ? "text-center p-5" : "p-6",
                "hover:bg-white dark:hover:bg-gray-900",
              ].join(" ")}
            >
              <div
                className={[
                  "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-500",
                  "bg-gradient-to-br",
                  item.gradient,
                ].join(" ")}
              />

              {variant === "compact" ? (
                <>
                  <div
                    className={[
                      "relative z-10 inline-flex p-3 rounded-2xl shadow-md mx-auto mb-3",
                      "bg-gradient-to-br",
                      item.gradient,
                    ].join(" ")}
                  >
                    <item.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="relative z-10 block text-xs font-semibold text-blue-800 dark:text-blue-200 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-sky-500 group-hover:bg-clip-text transition-all duration-300">
                    {item.title}
                  </span>
                </>
              ) : (
                <>
                  <div className="relative z-10 flex items-start gap-4">
                    <div
                      className={[
                        "inline-flex p-3 rounded-2xl shadow-lg shrink-0",
                        "bg-gradient-to-br",
                        item.gradient,
                      ].join(" ")}
                    >
                      <item.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <h3 className="font-bold text-blue-900 dark:text-blue-100 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-sky-500 group-hover:bg-clip-text transition-all duration-300">
                        {item.title}
                      </h3>
                      {item.desc ? (
                        <p className="text-blue-700 dark:text-blue-300 text-sm leading-relaxed">
                          {item.desc}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <IconArrowRight className="relative z-10 w-4 h-4 text-blue-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all duration-300 mt-3" />
                </>
              )}
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

