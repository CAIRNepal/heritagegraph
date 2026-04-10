"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

import { apiFetch, apiFetchJson, getApiErrorMessage } from "@/lib/api-client";
import { getPublicApiUrl } from "@/lib/api-base";

interface SearchResult {
  id: number | string;
  name: string;
  type?: string;
  description?: string;
}

interface EntitySearchProps {
  label: string;
  endpoint: string;
  backendUrl?: string;
  value?: SearchResult | null;
  onSelect: (entity: SearchResult | null) => void;
  placeholder?: string;
  allowCreate?: boolean;
  onCreate?: (name: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  className?: string;
}

const API_BASE = getPublicApiUrl();

export function EntitySearch({
  label,
  endpoint,
  backendUrl = API_BASE,
  value,
  onSelect,
  placeholder = "Search existing records...",
  allowCreate = false,
  onCreate,
  disabled = false,
  hasError = false,
  className,
}: EntitySearchProps) {
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const search = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const url = `${backendUrl}${endpoint}?search=${encodeURIComponent(q)}`;
        const res = await apiFetch(url, {
          headers: { Accept: "application/json" },
        });
        const data = await res.json();
        const items = Array.isArray(data) ? data : data.results || [];
        setResults(
          items.slice(0, 10).map((item: Record<string, unknown>) => ({
            id: item.id,
            name:
              (item.name as string) ||
              (item.title as string) ||
              `#${item.id}`,
            type:
              (item.structure_type as string) ||
              (item.ritual_type as string) ||
              (item.guthi_type as string) ||
              (item.type as string) ||
              undefined,
            description: (item.description as string) || undefined,
          }))
        );
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [backendUrl, endpoint]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    setShowDropdown(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 250);
  };

  const handleInlineCreate = async () => {
    if (!createName.trim()) return;
    setIsCreating(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const token = (session as any)?.accessToken;
      if (token) headers.Authorization = `Bearer ${token}`;

      const body: Record<string, string> = { name: createName.trim() };
      if (createDesc.trim()) body.description = createDesc.trim();

      const data = await apiFetchJson<{
        id: number | string;
        name?: string;
        title?: string;
      }>(`${backendUrl}${endpoint}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const newEntity: SearchResult = {
        id: data.id,
        name: data.name || data.title || createName,
      };
      onSelect(newEntity);
      setCreating(false);
      setCreateName("");
      setCreateDesc("");
    } catch (err) {
      toast.error(
        getApiErrorMessage(err, "Could not create this record. Please try again.")
      );
    } finally {
      setIsCreating(false);
    }
  };

  const openCreateDialog = (prefill: string) => {
    if (onCreate) {
      onCreate(prefill);
      return;
    }
    setCreateName(prefill);
    setCreateDesc("");
    setCreating(true);
    setShowDropdown(false);
    setQuery("");
  };

  if (value) {
    return (
      <div className={cn("space-y-2", className)}>
        {label && <Label>{label}</Label>}
        <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/50">
          <span className="text-sm font-medium">{value.name}</span>
          {value.type && (
            <Badge variant="secondary" className="text-xs">
              {value.type}
            </Badge>
          )}
          {!disabled && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-xs h-6"
              onClick={() => onSelect(null)}
            >
              ✕
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={cn("space-y-2 relative", className)} ref={wrapperRef}>
        {label && <Label>{label}</Label>}
        <Input
          value={query}
          onChange={handleInputChange}
          onFocus={() => query.length >= 2 && setShowDropdown(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={hasError ? "ring-2 ring-red-400/50 border-red-300 dark:border-red-700" : ""}
        />

        {showDropdown && query.length >= 2 && (
          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
            {loading && (
              <div className="p-3 text-sm text-muted-foreground text-center">
                Searching...
              </div>
            )}

            {!loading && results.length === 0 && (
              <div className="p-3 text-sm text-center">
                <p className="text-muted-foreground">No results found.</p>
                {allowCreate && (
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-1"
                    onClick={() => openCreateDialog(query)}
                  >
                    + Create &quot;{query}&quot;
                  </Button>
                )}
              </div>
            )}

            {results.map((result) => (
              <button
                key={result.id}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
                onClick={() => {
                  onSelect(result);
                  setShowDropdown(false);
                  setQuery("");
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{result.name}</span>
                  {result.type && (
                    <Badge variant="outline" className="text-xs">
                      {result.type}
                    </Badge>
                  )}
                </div>
                {result.description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {result.description}
                  </p>
                )}
              </button>
            ))}

            {!loading && results.length > 0 && allowCreate && (
              <div className="border-t px-3 py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                  onClick={() => openCreateDialog(query)}
                >
                  + Create new entry
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inline create dialog (only when no external onCreate handler) */}
      {!onCreate && (
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="create-name">Name *</Label>
                <Input
                  id="create-name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Enter a name..."
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-desc">Description</Label>
                <Textarea
                  id="create-desc"
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  placeholder="Brief description (optional)..."
                  rows={2}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This creates a stub entry that will be reviewed and enriched by moderators.
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreating(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleInlineCreate}
                disabled={!createName.trim() || isCreating}
              >
                {isCreating ? "Creating..." : "Create & Select"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export type { SearchResult };
