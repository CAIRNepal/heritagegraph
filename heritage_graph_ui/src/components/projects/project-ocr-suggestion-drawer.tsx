"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { OcrSuggestionBadge } from "@/components/ocr/ocr-suggestion-badge";
import {
  fetchOcrSuggestions,
  type OcrFieldSuggestion,
} from "@/hooks/use-heritage-ocr-suggestions";
import { pollOcrStatusWithBackoff } from "@/lib/poll-ocr-status";

export function ProjectOcrSuggestionDrawer({
  open,
  onOpenChange,
  projectSlug,
  uploadedDocumentId,
  accessToken,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectSlug: string;
  uploadedDocumentId: string;
  accessToken: string;
}) {
  const router = useRouter();
  const [statusLabel, setStatusLabel] = useState("Loading…");
  const [suggestions, setSuggestions] = useState<Record<string, OcrFieldSuggestion>>({});
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !uploadedDocumentId) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setStatusLabel("Checking extraction status…");
      try {
        const st = await pollOcrStatusWithBackoff({
          uploadedDocumentId,
          accessToken,
          onStatus: (s) => setStatusLabel(`Status: ${s.status}`),
          maxMs: 180_000,
        });
        if (cancelled) return;
        if (st.status === "failed") {
          toast.error(st.user_safe_error || "Extraction failed.");
          setLoading(false);
          return;
        }
        const sug = await fetchOcrSuggestions({ uploadedDocumentId, accessToken });
        if (!cancelled) {
          setSuggestions(sug);
          setStatusLabel(
            Object.keys(sug).length
              ? `${Object.keys(sug).length} field suggestions`
              : "No structured fields detected"
          );
        }
      } catch {
        if (!cancelled) toast.error("Could not load OCR suggestions.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, uploadedDocumentId, accessToken]);

  const entries = Object.entries(suggestions);

  const applyAccepted = () => {
    const picked = Object.fromEntries(
      entries.filter(([k]) => accepted.has(k)).map(([k, v]) => [k, v])
    );
    if (!Object.keys(picked).length) {
      toast.error("Select at least one field to apply.");
      return;
    }
    const storageKey = `hg-project-ocr-apply-${uploadedDocumentId}`;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(picked));
    } catch {
      /* ignore quota */
    }
    const params = new URLSearchParams({
      project: projectSlug,
      ocrDoc: uploadedDocumentId,
    });
    router.push(`/contribute/entity?${params.toString()}`);
    onOpenChange(false);
    toast.success("Opening contribute form with selected suggestions.");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>OCR suggestions</SheetTitle>
          <SheetDescription>
            Accept fields you trust, then apply them to a new entity in this project. Nothing is
            published automatically.
          </SheetDescription>
        </SheetHeader>
        <p className="text-xs text-muted-foreground mt-2">{statusLabel}</p>
        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading suggestions…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No field suggestions for this document.
          </p>
        ) : (
          <ul className="space-y-3 mt-4">
            {entries.map(([key, sug]) => {
              const on = accepted.has(key);
              return (
                <li
                  key={key}
                  className="rounded-lg border p-3 space-y-2 cursor-pointer hover:bg-muted/40"
                  onClick={() => {
                    setAccepted((prev) => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    });
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">{key}</span>
                    <OcrSuggestionBadge confidence={sug.confidence} />
                  </div>
                  <p className="text-sm">{sug.value}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant={on ? "default" : "outline"}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {on ? "Accepted" : "Accept"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        {!loading && entries.length > 0 && (
          <div className="mt-6 flex gap-2">
            <Button onClick={applyAccepted}>Apply to new entity</Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
