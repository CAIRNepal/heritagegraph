"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { IconArrowRight } from "@tabler/icons-react";

import type { DashboardLinkItem } from "@/config/dashboard-links";
import { scaleIn, surfaceCard } from "@/lib/design";
import { cn } from "@/lib/utils";

interface ShortcutGridProps {
  items: DashboardLinkItem[];
  variant: "compact" | "detailed";
  /**
   * next-intl namespace holding the items' `titleKey` / `descKey` messages.
   * Defaults to the dashboard's shortcut namespace.
   */
  namespace?: string;
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
  namespace = "dashboard.shortcuts",
  columns = {
    base: "grid-cols-1",
    sm: "sm:grid-cols-2",
    lg: "lg:grid-cols-4",
  },
}: ShortcutGridProps) {
  const t = useTranslations(namespace);

  const gridCols = ["grid", "gap-6", columns.base, columns.sm, columns.md, columns.lg]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={gridCols}>
      {items.map((item) => (
        <motion.div key={item.titleKey} variants={scaleIn} className="group relative">
          <Link
            href={item.href}
            className="block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <div
              className={cn(
                "relative h-full transition-all duration-200",
                surfaceCard,
                "hover:border-primary/30 hover:shadow-sm",
                variant === "compact" ? "p-5 text-center" : "p-6",
              )}
            >
              {variant === "compact" ? (
                <>
                  <div className="mx-auto mb-3 inline-flex rounded-lg bg-primary/10 p-3 text-primary transition-colors group-hover:bg-primary/15">
                    <item.icon className="size-5" aria-hidden />
                  </div>
                  <span className="block text-xs font-semibold text-foreground transition-colors group-hover:text-primary">
                    {t(item.titleKey)}
                  </span>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-4">
                    <div className="inline-flex shrink-0 rounded-lg bg-primary/10 p-3 text-primary transition-colors group-hover:bg-primary/15">
                      <item.icon className="size-5" aria-hidden />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <h3 className="font-semibold text-foreground transition-colors group-hover:text-primary">
                        {t(item.titleKey)}
                      </h3>
                      {item.descKey ? (
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {t(item.descKey)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <IconArrowRight
                    className="mt-3 size-4 text-muted-foreground transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary"
                    aria-hidden
                  />
                </>
              )}
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
