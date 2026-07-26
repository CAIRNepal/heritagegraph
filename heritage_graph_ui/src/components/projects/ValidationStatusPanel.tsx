"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── types ──────────────────────────────────────────────────────────────────────

interface Violation {
  shape: string;
  focus_node: string;
  message: string;
  severity?: string;
}

interface ValidationResult {
  conforms: boolean;
  violations: Violation[];
  pid_collisions?: string[];
  reconciliation?: {
    reconciled: number;
    close_match: number;
    no_match: number;
    pending: number;
    total: number;
  };
}

interface ValidationStatusPanelProps {
  projectSlug: string;
  projectId: string;
  className?: string;
  /** Called when validation passes so the parent can enable "Open MR" */
  onValidationPass?: () => void;
}

// ── icons ──────────────────────────────────────────────────────────────────────

function IconCheck() {
  return (
    <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function IconX() {
  return (
    <svg className="h-4 w-4 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function IconWarn() {
  return (
    <svg className="h-4 w-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}

function IconDash() {
  return <span className="text-muted-foreground">—</span>;
}

// ── component ─────────────────────────────────────────────────────────────────

export function ValidationStatusPanel({
  projectSlug,
  projectId,
  className,
  onValidationPass,
}: ValidationStatusPanelProps) {
  const { data: session } = useSession();
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canOpenMR =
    result !== null &&
    result.conforms &&
    (result.pid_collisions ?? []).length === 0;

  useEffect(() => {
    if (canOpenMR) onValidationPass?.();
  }, [canOpenMR, onValidationPass]);

  async function runValidation() {
    if (!session?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/merge-requests/validate/?project_id=${projectId}`,
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!res.ok) {
        setError(`Validation endpoint returned ${res.status}`);
        return;
      }
      const data: ValidationResult = await res.json();
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn("rounded-lg border bg-card p-4 space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Validation Status</h3>
        <Button size="sm" variant="outline" onClick={runValidation} disabled={loading}>
          {loading ? "Running…" : "Run validation"}
        </Button>
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Results grid */}
      {loading && (
        <div className="space-y-2">
          {["LinkML", "SHACL", "DL reason", "PID"].map((l) => (
            <Skeleton key={l} className="h-5 w-full" />
          ))}
        </div>
      )}

      {!loading && result && (
        <div className="space-y-2">
          {/* LinkML row — placeholder, real check via backend */}
          <StatusRow
            label="LinkML"
            pass={result.conforms}
            detail={
              result.conforms
                ? "Assertions pass required fields"
                : result.violations
                    .filter((v) => v.shape.includes("linkml") || !v.shape.includes("shacl"))
                    .map((v) => v.message)
                    .join("; ") || "Validation warnings"
            }
          />

          {/* SHACL row */}
          <StatusRow
            label="SHACL"
            pass={result.conforms}
            detail={
              result.conforms
                ? "No violations"
                : `${result.violations.length} violation${result.violations.length !== 1 ? "s" : ""}`
            }
          />
          {!result.conforms &&
            result.violations.map((v, i) => (
              <ViolationRow key={i} violation={v} />
            ))}

          {/* DL reasoning — not run until SHACL passes */}
          <StatusRow
            label="DL reason"
            pending={!result.conforms}
            detail={
              result.conforms
                ? "No disjointness errors"
                : "— not run (resolve SHACL errors first)"
            }
          />

          {/* PID uniqueness */}
          <StatusRow
            label="PID"
            pass={(result.pid_collisions ?? []).length === 0}
            detail={
              (result.pid_collisions ?? []).length === 0
                ? "No collisions with main graph"
                : `${result.pid_collisions!.length} PID collision(s)`
            }
          />

          {/* Separator */}
          <div className="border-t" />

          {/* Reconciliation summary */}
          {result.reconciliation && (
            <ReconciliationSummary r={result.reconciliation} />
          )}

          {/* Block / pass banner */}
          {!canOpenMR ? (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <IconX />
              Cannot open Merge Request — resolve validation errors first.
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-2 text-xs text-green-700 dark:text-green-400">
              <IconCheck />
              All checks pass — ready to open Merge Request.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── sub-components ─────────────────────────────────────────────────────────────

function StatusRow({
  label,
  pass,
  pending,
  detail,
}: {
  label: string;
  pass?: boolean;
  pending?: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="w-20 shrink-0 font-medium text-foreground">{label}</span>
      {pending ? <IconDash /> : pass ? <IconCheck /> : <IconX />}
      <span className="text-muted-foreground">{detail}</span>
    </div>
  );
}

function ViolationRow({ violation }: { violation: Violation }) {
  return (
    <div className="ml-6 rounded border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs text-destructive space-y-0.5">
      <div className="font-mono">{violation.shape.split("/").pop()}</div>
      <div className="text-muted-foreground">{violation.message}</div>
    </div>
  );
}

function ReconciliationSummary({
  r,
}: {
  r: NonNullable<ValidationResult["reconciliation"]>;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium">Reconciliation ({r.total} assertions)</p>
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="secondary" className="text-green-600 border-green-300">
          ✓ reconciled {r.reconciled}
        </Badge>
        <Badge variant="secondary" className="text-amber-600 border-amber-300">
          ~ close match {r.close_match}
        </Badge>
        <Badge variant="secondary" className="text-destructive border-destructive/30">
          ✗ no match {r.no_match}
        </Badge>
        {r.pending > 0 && (
          <Badge variant="secondary" className="text-muted-foreground">
            ⏳ pending {r.pending}
          </Badge>
        )}
      </div>
    </div>
  );
}
