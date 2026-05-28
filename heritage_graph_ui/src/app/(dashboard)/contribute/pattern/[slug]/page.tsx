'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, Suspense } from 'react';
import { Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { glassCard } from '@/lib/design';
import { useOntology } from '@/lib/ontology/OntologyProvider';
import type { SemanticPattern } from '@/lib/ontology/types';
import { ProjectContributeBanner } from '@/components/projects/project-contribute-banner';
import {
  appendWorkflowContextToRoute,
  parseSemanticWorkflowCompleted,
} from '@/lib/semantic-workflow-params';
import { appendProjectToRoute, projectWorkspacePath } from '@/lib/project-contribute';

function sortSuggestedPatterns(
  all: readonly SemanticPattern[],
  currentKey: string,
  currentHubCategory?: string
): SemanticPattern[] {
  return [...all]
    .filter((p) => p.key !== currentKey)
    .sort((a, b) => {
      const aMatch =
        Boolean(currentHubCategory) && a.hubCategory === currentHubCategory ? 0 : 1;
      const bMatch =
        Boolean(currentHubCategory) && b.hubCategory === currentHubCategory ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return a.userLabel.localeCompare(b.userLabel);
    });
}

function SemanticPatternWorkflowInner() {
  const params = useParams();
  const slug = typeof params.slug === 'string' ? params.slug : '';
  const urlSearchParams = useSearchParams();
  const projectSlug = urlSearchParams.get('project')?.trim() || null;
  const completed = parseSemanticWorkflowCompleted(urlSearchParams);
  const nextStepRef = useRef<HTMLDivElement>(null);

  const { registry } = useOntology();
  const pattern = useMemo(
    () => (registry.semantic_patterns ?? []).find((p) => p.key === slug),
    [registry.semantic_patterns, slug]
  );

  const steps = useMemo(
    () =>
      pattern ? [...pattern.steps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [],
    [pattern]
  );

  const maxStepOrder = useMemo(
    () => (steps.length > 0 ? Math.max(...steps.map((s) => s.order ?? 0), 1) : 1),
    [steps]
  );

  const fullyComplete =
    completed != null && completed >= maxStepOrder;

  const nextStep = useMemo(() => {
    if (completed == null || fullyComplete) return null;
    return steps.find((s) => (s.order ?? 0) > completed) ?? null;
  }, [completed, fullyComplete, steps]);

  useEffect(() => {
    if (completed != null && !fullyComplete && nextStepRef.current) {
      nextStepRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [completed, fullyComplete, nextStep]);

  const suggestions = useMemo(() => {
    if (!pattern) return [];
    return sortSuggestedPatterns(
      registry.semantic_patterns ?? [],
      pattern.key,
      pattern.hubCategory
    ).slice(0, 6);
  }, [pattern, registry.semantic_patterns]);

  if (!pattern) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-10">
        <Card className={`${glassCard}`}>
          <CardHeader>
            <CardTitle>Workflow not found</CardTitle>
            <CardDescription>
              The guided semantic pattern &quot;{slug}&quot; is missing from the loaded schema
              registry. Ask an administrator to refresh tools/semantic-patterns.yaml and run the
              registry generator if needed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/contribute">Back to contribute hub</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      {projectSlug ? (
        <ProjectContributeBanner slug={projectSlug} />
      ) : null}
      {completed != null ? (
        <div
          className={`${glassCard} p-4`}
          role="status"
          aria-live="polite"
        >
          {fullyComplete ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Workflow complete</p>
              <p className="text-sm text-muted-foreground">
                Thank you. Your contributions and proposals are in the review queue; curators may
                follow up or publish them when they align with the vocabulary and evidence rules.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-semibold">Step {completed} complete</p>
              {nextStep ? (
                <p className="text-sm text-muted-foreground">
                  When you are ready, continue with step {nextStep.order}: {nextStep.title}.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Continue with the next step below.
                </p>
              )}
            </div>
          )}
        </div>
      ) : null}

      <div className={`${glassCard} p-6 space-y-3`}>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-2xl" role="img" aria-hidden>
            {pattern.emoji ?? '📋'}
          </span>
          {pattern.difficulty ? (
            <Badge variant="secondary">{pattern.difficulty}</Badge>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold">{pattern.userLabel}</h1>
        {pattern.userDescription ? (
          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {pattern.userDescription}
          </p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Steps</CardTitle>
          <CardDescription>
            Each step opens the same ontology-driven surfaces you already use—they are numbered so
            the resulting CIDOC entities and moderated proposals knit into a richer graph once
            curators approve them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {steps.map((s) => {
            const order = s.order ?? 0;
            const done = completed != null && order <= completed;
            const isNext =
              nextStep != null && order === (nextStep.order ?? 0);
            const href = appendWorkflowContextToRoute(
              s.ctaRoute,
              s.linkQuery,
              {
                patternKey: pattern.key,
                stepOrder: order,
              },
              projectSlug
            );

            return (
              <div
                key={`${order}-${s.ctaRoute}`}
                ref={isNext ? nextStepRef : undefined}
                className={`border-border space-y-2 rounded-xl border p-4 ${
                  isNext ? 'ring-2 ring-primary/40' : ''
                } ${done && !isNext ? 'bg-muted/30' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        done
                          ? 'bg-emerald-600 text-white'
                          : 'bg-muted text-muted-foreground'
                      }`}
                      aria-hidden
                    >
                      {done ? <Check className="size-4" aria-hidden /> : order}
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        Step {order}
                        {done ? ' · Done' : ''}
                      </p>
                      <h2 className="font-medium">{s.title}</h2>
                    </div>
                  </div>
                  <Button asChild size="sm" variant={isNext ? 'default' : 'secondary'}>
                    <Link href={href}>{s.ctaLabel}</Link>
                  </Button>
                </div>
                {s.detail ? (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap pl-11">
                    {s.detail}
                  </p>
                ) : null}
              </div>
            );
          })}
          <div className="flex flex-wrap gap-2">
            {projectSlug ? (
              <Button asChild variant="default">
                <Link href={projectWorkspacePath(projectSlug)}>Back to project</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href="/contribute">All contribution types</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {fullyComplete && suggestions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Suggested next workflows</CardTitle>
            <CardDescription>
              Similar guided paths you can start when you are ready.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {suggestions.map((p) => (
              <Link
                key={p.key}
                href={
                  projectSlug
                    ? appendProjectToRoute(
                        `/contribute/pattern/${encodeURIComponent(p.key)}`,
                        projectSlug
                      )
                    : `/contribute/pattern/${encodeURIComponent(p.key)}`
                }
                className="border-border hover:bg-muted/50 rounded-lg border px-4 py-3 text-sm font-medium transition-colors"
              >
                <span className="mr-2" aria-hidden>
                  {p.emoji ?? '📋'}
                </span>
                {p.userLabel}
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default function SemanticPatternWorkflowPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-10 text-center text-sm text-muted-foreground">
          Loading workflow…
        </div>
      }
    >
      <SemanticPatternWorkflowInner />
    </Suspense>
  );
}
