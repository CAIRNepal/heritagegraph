"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SearchResult {
  id: number | string;
  name: string;
  type?: string;
  description?: string;
}

interface EntitySearchProps {
  /** Label for the field */
  label: string;
  /** API endpoint to search (relative, e.g., "/cidoc/deities/") */
  endpoint: string;
  /** Backend base URL */
  backendUrl?: string;
  /** Currently selected entity */
  value?: SearchResult | null;
  /** Callback when entity is selected */
  onSelect: (entity: SearchResult | null) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether to allow creating new entries */
  allowCreate?: boolean;
  /** Callback when creating a new entry */
  onCreate?: (name: string) => void;
  className?: string;
}

export function EntitySearch({
  label,
  endpoint,
  backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  value,
  onSelect,
  placeholder = "Search existing records...",
  allowCreate = false,
  onCreate,
  className,
}: EntitySearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
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
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : data.results || [];
          setResults(
            items.slice(0, 10).map((item: Record<string, unknown>) => ({
              id: item.id,
              name: (item.name as string) || (item.title as string) || `#${item.id}`,
              type: (item.structure_type as string) || (item.ritual_type as string) || (item.guthi_type as string) || undefined,
              description: (item.description as string) || undefined,
            }))
          );
        }
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
    search(q);
  };

  if (value) {
    return (
      <div className={cn("space-y-2", className)}>
        <Label>{label}</Label>
        <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/50">
          <span className="text-sm font-medium">{value.name}</span>
          {value.type && (
            <Badge variant="secondary" className="text-xs">
              {value.type}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-xs h-6"
            onClick={() => onSelect(null)}
          >
            ✕
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2 relative", className)} ref={wrapperRef}>
      <Label>{label}</Label>
      <Input
        value={query}
        onChange={handleInputChange}
        onFocus={() => query.length >= 2 && setShowDropdown(true)}
        placeholder={placeholder}
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
              {allowCreate && onCreate && (
                <Button
                  variant="link"
                  size="sm"
                  className="mt-1"
                  onClick={() => {
                    onCreate(query);
                    setShowDropdown(false);
                    setQuery("");
                  }}
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
        </div>
      )}
    </div>
  );
}

export type { SearchResult };
