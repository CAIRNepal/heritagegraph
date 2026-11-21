"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { IconArrowRight } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { glassCard } from "@/lib/design";
import { useOntology } from "@/lib/ontology/OntologyProvider";
import { appendProjectToRoute } from "@/lib/project-contribute";
import type { SemanticPattern } from "@/lib/ontology/types";

const SUBJECT_INTENT_HINTS: Record<string, string[]> = {
  temple: ["structure", "monument", "location", "ritual", "deity"],
  monument: ["monument", "structure", "location", "event"],
  ritual: ["ritual", "festival", "person", "deity", "location"],
  festival: ["festival", "ritual", "event", "location"],
  place: ["location", "structure", "monument"],
  bhaktapur: ["location", "structure", "monument", "ritual", "festival"],
};

function intentKeysForSubject(subject: string): string[] | null {
  const lower = subject.toLowerCase();
  for (const [key, keys] of Object.entries(SUBJECT_INTENT_HINTS)) {
    if (lower.includes(key)) return keys;
  }
  return null;
}

export function ProjectAddPanel({
  projectSlug,
  intendedSubject,
}: {
  projectSlug: string;
  intendedSubject?: string;
}) {
  const router = useRouter();
  const { registry } = useOntology();
  const hub = registry.contribute_hub;
  const patterns = registry.semantic_patterns ?? [];

  const quickRoutes = useMemo(() => {
    const hints = intendedSubject ? intentKeysForSubject(intendedSubject) : null;
    const intents = hub?.intents ?? [];
    const filtered = hints
      ? intents.filter((i) => hints.includes(i.registryKey))
      : intents.slice(0, 6);
    const list = (filtered.length > 0 ? filtered : intents).slice(0, 6);
    return list.map((intent) => ({
      label:
        registry.classes[intent.registryKey]?.label ??
        intent.shortDescription ??
        intent.registryKey,
      route: appendProjectToRoute(intent.route, projectSlug),
    }));
  }, [hub?.intents, intendedSubject, projectSlug, registry.classes]);

  const suggestedPatterns = useMemo((): SemanticPattern[] => {
    const subject = (intendedSubject ?? "").toLowerCase();
    const ranked = [...patterns].sort((a, b) => {
      const aHit =
        subject &&
        (a.userLabel.toLowerCase().includes(subject) ||
          (a.userDescription ?? '').toLowerCase().includes(subject));
      const bHit =
        subject &&
        (b.userLabel.toLowerCase().includes(subject) ||
          (b.userDescription ?? '').toLowerCase().includes(subject));
      if (aHit !== bHit) return aHit ? -1 : 1;
      return a.userLabel.localeCompare(b.userLabel);
    });
    return ranked.slice(0, 4);
  }, [patterns, intendedSubject]);

  return (
    <div className={`${glassCard} p-4 space-y-4`}>
      <div>
        <h3 className="text-sm font-semibold">Add to this project</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Use a quick form or a guided multi-step workflow. New records are linked to this
          dossier automatically.
        </p>
      </div>

      {quickRoutes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Quick forms</p>
          <div className="flex flex-wrap gap-2">
            {quickRoutes.map((item) => (
              <Button
                key={item.route}
                type="button"
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => router.push(item.route)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {suggestedPatterns.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Guided workflows</p>
          <ul className="space-y-2">
            {suggestedPatterns.map((p) => (
              <li key={p.key}>
                <Link
                  href={`/contribute/pattern/${encodeURIComponent(p.key)}?project=${encodeURIComponent(projectSlug)}`}
                  className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                >
                  <span>
                    {p.emoji ? `${p.emoji} ` : ""}
                    {p.userLabel}
                  </span>
                  <IconArrowRight className="w-4 h-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() =>
          router.push(appendProjectToRoute("/contribute/entity", projectSlug))
        }
      >
        Generic entity form
      </Button>
    </div>
  );
}
