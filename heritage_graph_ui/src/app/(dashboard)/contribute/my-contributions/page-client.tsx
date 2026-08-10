"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconCircleCheck,
  IconCircleX,
  IconEdit,
  IconMessage,
  IconInfoCircle,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fadeInUp, staggerContainer, scaleIn, glassCard } from "@/lib/design";
import { getPublicApiUrl } from "@/lib/api-base";
import { apiFetchJson, getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface ActivityRow {
  activity_id: string;
  activity_type: string;
  comment?: string | null;
  created_at: string;
  user?: { username?: string } | null;
}
interface Feedback {
  activity_type: string;
  comment: string;
  created_at: string;
}
interface MyContribution {
  entity_id: string;
  name: string;
  category?: string | null;
  status: string;
  created_at: string;
  updated_at?: string;
  activities?: ActivityRow[];
  latest_feedback?: Feedback | null;
}

/** Status → plain-language label, tint, and a one-line meaning for laymen. */
const STATUS_META: Record<
  string,
  { key: string; color: string }
> = {
  draft: {
    key: "draft",
    color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  pending_review: {
    key: "pendingReview",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  pending_revision: {
    key: "pendingRevision",
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  },
  accepted: {
    key: "accepted",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  merged: {
    key: "merged",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  rejected: {
    key: "rejected",
    color: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
  },
  superseded: {
    key: "superseded",
    color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
};

const ACTIVITY_META: Record<
  string,
  { key: string; icon: React.ComponentType<{ className?: string }> }
> = {
  submitted: { key: "submitted", icon: IconClock },
  accepted: { key: "accepted", icon: IconCircleCheck },
  rejected: { key: "rejected", icon: IconCircleX },
  changes_requested: { key: "changesRequested", icon: IconEdit },
  revised: { key: "revised", icon: IconEdit },
  commented: { key: "commented", icon: IconMessage },
  escalated: { key: "escalated", icon: IconInfoCircle },
  flagged: { key: "flagged", icon: IconInfoCircle },
  conflict_resolved: { key: "conflictResolved", icon: IconCircleCheck },
};

function statusMeta(status: string) {
  return STATUS_META[status] ?? STATUS_META.pending_review;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function ContributionCard({ item }: { item: MyContribution }) {
  const t = useTranslations("myContributions");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const meta = statusMeta(item.status);
  const canRevise = item.status === "rejected" || item.status === "pending_revision";
  const activities = item.activities ?? [];

  return (
    <motion.div variants={scaleIn} className={cn(glassCard, "p-5")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/knowledge/entity/view/${item.entity_id}`}
              className="font-semibold text-foreground hover:text-primary transition-colors truncate"
            >
              {item.name || t('untitled')}
            </Link>
            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", meta.color)}>
              {t(`status.${meta.key}.label`)}
            </Badge>
            {item.category ? (
              <span className="text-xs text-muted-foreground capitalize">
                {item.category.replace(/_/g, " ")}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t(`status.${meta.key}.hint`)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground/80">
            Submitted {fmtDate(item.created_at)}
          </p>
        </div>
        {canRevise ? (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => router.push(`/contribute/entity/revise?entity=${item.entity_id}`)}
          >
            <IconEdit className="mr-1.5 h-3.5 w-3.5" /> Revise
          </Button>
        ) : null}
      </div>

      {/* Latest reviewer note, surfaced prominently when action is needed. */}
      {item.latest_feedback?.comment ? (
        <div
          className={cn(
            "mt-3 rounded-lg border px-3 py-2 text-sm",
            canRevise
              ? "border-orange-200 bg-orange-50/60 dark:border-orange-900/40 dark:bg-orange-950/20"
              : "border-border bg-muted/40",
          )}
        >
          <div className="text-xs font-medium text-muted-foreground">
            Reviewer note
          </div>
          <p className="mt-0.5 text-foreground/90">{item.latest_feedback.comment}</p>
        </div>
      ) : null}

      {activities.length > 0 ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {open ? (
              <IconChevronDown className="h-3.5 w-3.5" />
            ) : (
              <IconChevronRight className="h-3.5 w-3.5" />
            )}
            {open ? t('hideHistory') : `View history (${activities.length})`}
          </button>
          {open ? (
            <ol className="mt-2 space-y-2 border-l border-border pl-4">
              {activities.map((a) => {
                const am = ACTIVITY_META[a.activity_type] ?? {
                  label: a.activity_type.replace(/_/g, " "),
                  icon: IconInfoCircle,
                };
                const Icon = am.icon;
                return (
                  <li key={a.activity_id} className="relative text-sm">
                    <span className="absolute -left-[1.3rem] top-0.5 text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{t(`activity.${am.key}`)}</span>
                      <span className="text-xs text-muted-foreground">
                        {fmtDate(a.created_at)}
                        {a.user?.username ? ` · ${a.user.username}` : ""}
                      </span>
                    </div>
                    {a.comment ? (
                      <p className="text-sm text-muted-foreground">{a.comment}</p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  );
}

export default function MyContributionsClient() {
  const t = useTranslations("myContributions");
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<MyContribution[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const token = (session as { accessToken?: string } | null)?.accessToken;

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await apiFetchJson<
        MyContribution[] | { results?: MyContribution[] }
      >(`${getPublicApiUrl()}/data/api/cultural-entities/my_contributions/`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const list = Array.isArray(data) ? data : (data.results ?? []);
      setItems(list);
    } catch (err) {
      setError(getApiErrorMessage(err, t('loadFailed')));
      setItems([]);
    }
  }, [token]);

  useEffect(() => {
    if (sessionStatus === "authenticated") void load();
  }, [sessionStatus, load]);

  const counts = useMemo(() => {
    const c = { pending: 0, published: 0, action: 0 };
    for (const i of items ?? []) {
      if (i.status === "pending_review") c.pending += 1;
      else if (i.status === "accepted" || i.status === "merged") c.published += 1;
      else if (i.status === "rejected" || i.status === "pending_revision") c.action += 1;
    }
    return c;
  }, [items]);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* What happens next — the review lifecycle, in plain language. */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={fadeInUp}
        className={cn(glassCard, "p-5")}
      >
        <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s what happens after you submit:{" "}
          <span className="text-foreground">you submit</span> →{" "}
          <span className="text-foreground">a reviewer checks it</span> →{" "}
          <span className="text-foreground">once accepted, it&apos;s published</span> to
          the public knowledge graph. You&apos;ll be notified at each step, and can track
          status and reviewer notes right here.
        </p>
        {items && items.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              {counts.pending} pending
            </Badge>
            <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
              {counts.action} need your attention
            </Badge>
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              {counts.published} published
            </Badge>
          </div>
        ) : null}
      </motion.div>

      {sessionStatus === "unauthenticated" ? (
        <div className={cn(glassCard, "p-8 text-center")}>
          <p className="text-muted-foreground">Sign in to see your contributions.</p>
        </div>
      ) : error ? (
        <div className={cn(glassCard, "p-6 text-center space-y-3")}>
          <p className="text-muted-foreground">{error}</p>
          <Button size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : items === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className={cn(glassCard, "p-5 h-24 animate-pulse")} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className={cn(glassCard, "p-8 text-center space-y-3")}>
          <p className="text-muted-foreground">
            You haven&apos;t contributed anything yet.
          </p>
          <Button onClick={() => router.push("/contribute")}>{t('startContributing')}</Button>
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={staggerContainer}
          className="space-y-3"
        >
          {items.map((item) => (
            <ContributionCard key={item.entity_id} item={item} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
