"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { IconArrowRight } from "@tabler/icons-react";

import type { DashboardLinkItem } from "@/config/dashboard-links";
import { glassCard, scaleIn } from "@/lib/design";
import { cn } from "@/lib/utils";

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
              className={cn(
                "relative h-full cursor-pointer transition-all duration-200",
                glassCard,
                "hover:border-primary/30 hover:shadow-sm",
                variant === "compact" ? "text-center p-5" : "p-6",
              )}
            >
              {/* Single-accent tinted chip — one brand colour, not a rainbow. */}
              {variant === "compact" ? (
                <>
                  <div className="inline-flex p-3 rounded-lg bg-primary/10 text-primary mx-auto mb-3 transition-colors group-hover:bg-primary/15">
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className="block text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                    {item.title}
                  </span>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-4">
                    <div className="inline-flex p-3 rounded-lg bg-primary/10 text-primary shrink-0 transition-colors group-hover:bg-primary/15">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {item.title}
                      </h3>
                      {item.desc ? (
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          {item.desc}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <IconArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300 mt-3" />
                </>
              )}
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
