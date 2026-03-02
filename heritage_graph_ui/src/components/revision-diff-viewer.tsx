"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Minus,
  Equal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  useRevisionDiff,
  type RevisionDiff,
} from "@/hooks/use-contributions";

interface RevisionDiffViewerProps {
  entityId: string;
  revisions: { version: number; created_at: string; created_by?: string }[];
  className?: string;
}

export function RevisionDiffViewer({
  entityId,
  revisions,
  className,
}: RevisionDiffViewerProps) {
  const { getDiff } = useRevisionDiff();
  const [fromRev, setFromRev] = useState<number | null>(null);
  const [toRev, setToRev] = useState<number | null>(null);
  const [diff, setDiff] = useState<RevisionDiff | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  // Auto-select last two revisions
  useEffect(() => {
    if (revisions.length >= 2) {
      setFromRev(revisions[revisions.length - 2].version);
      setToRev(revisions[revisions.length - 1].version);
    }
  }, [revisions]);

  const fetchDiff = useCallback(async () => {
    if (fromRev === null || toRev === null || fromRev === toRev) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getDiff(entityId, fromRev, toRev);
      setDiff(result);
    } catch (err: any) {
      setError(err.message || "Failed to load diff");
      setDiff(null);
    } finally {
      setLoading(false);
    }
  }, [entityId, fromRev, toRev, getDiff]);

  useEffect(() => {
    fetchDiff();
  }, [fetchDiff]);

  const diffEntries = diff?.diff ? Object.entries(diff.diff) : [];
  const addedCount = diffEntries.filter(
    ([, v]) => v.old === null || v.old === "" || v.old === undefined
  ).length;
  const removedCount = diffEntries.filter(
    ([, v]) => v.new === null || v.new === "" || v.new === undefined
  ).length;
  const changedCount = diffEntries.length - addedCount - removedCount;

  if (revisions.length < 2) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowLeftRight className="h-4 w-4" />
            Version Diff
          </CardTitle>
          <CardDescription>
            At least two revisions are needed to compare.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowLeftRight className="h-4 w-4" />
            Version Diff
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Revision Selectors */}
        <div className="flex items-center gap-3 flex-wrap mt-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">From:</span>
            <Select
              value={fromRev?.toString() || ""}
              onValueChange={(v) => setFromRev(Number(v))}
            >
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue placeholder="Select revision" />
              </SelectTrigger>
              <SelectContent>
                {revisions.map((rev) => (
                  <SelectItem
                    key={rev.version}
                    value={rev.version.toString()}
                    disabled={rev.version === toRev}
                  >
                    v{rev.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">To:</span>
            <Select
              value={toRev?.toString() || ""}
              onValueChange={(v) => setToRev(Number(v))}
            >
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue placeholder="Select revision" />
              </SelectTrigger>
              <SelectContent>
                {revisions.map((rev) => (
                  <SelectItem
                    key={rev.version}
                    value={rev.version.toString()}
                    disabled={rev.version === fromRev}
                  >
                    v{rev.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-sm text-red-500 py-4 text-center">
              {error}
            </div>
          ) : diffEntries.length === 0 && diff ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              No differences between these revisions.
            </div>
          ) : diff ? (
            <div className="space-y-1">
              {/* Stats */}
              <div className="flex items-center gap-3 mb-4 text-xs">
                <span className="flex items-center gap-1 text-green-600">
                  <Plus className="h-3 w-3" /> {addedCount} added
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <Minus className="h-3 w-3" /> {removedCount} removed
                </span>
                <span className="flex items-center gap-1 text-amber-600">
                  <Equal className="h-3 w-3" /> {changedCount} changed
                </span>
              </div>

              {/* Diff Table */}
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-3 py-2 font-medium w-1/4">
                        Field
                      </th>
                      <th className="text-left px-3 py-2 font-medium w-[37.5%]">
                        v{fromRev} (old)
                      </th>
                      <th className="text-left px-3 py-2 font-medium w-[37.5%]">
                        v{toRev} (new)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffEntries.map(([field, { old: oldVal, new: newVal }]) => {
                      const isAdded =
                        oldVal === null || oldVal === "" || oldVal === undefined;
                      const isRemoved =
                        newVal === null || newVal === "" || newVal === undefined;

                      return (
                        <tr key={field} className="border-b last:border-b-0">
                          <td className="px-3 py-2 font-mono text-xs align-top">
                            {field.replace(/_/g, " ")}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-2 text-xs align-top break-words",
                              isAdded && "text-muted-foreground",
                              !isAdded &&
                                !isRemoved &&
                                "bg-red-50 dark:bg-red-950/20"
                            )}
                          >
                            {isAdded ? (
                              <span className="italic">—</span>
                            ) : typeof oldVal === "object" ? (
                              <pre className="whitespace-pre-wrap font-mono">
                                {JSON.stringify(oldVal, null, 2)}
                              </pre>
                            ) : (
                              String(oldVal)
                            )}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-2 text-xs align-top break-words",
                              isRemoved && "text-muted-foreground",
                              !isAdded &&
                                !isRemoved &&
                                "bg-green-50 dark:bg-green-950/20",
                              isAdded && "bg-green-50 dark:bg-green-950/20"
                            )}
                          >
                            {isRemoved ? (
                              <span className="italic">—</span>
                            ) : typeof newVal === "object" ? (
                              <pre className="whitespace-pre-wrap font-mono">
                                {JSON.stringify(newVal, null, 2)}
                              </pre>
                            ) : (
                              String(newVal)
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </CardContent>
      )}
    </Card>
  );
}
