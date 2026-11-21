"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { DataSourceCreateDialog } from "@/components/cidoc/data-source-create-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiFetchJson } from "@/lib/api-client";
import { getPublicApiUrl } from "@/lib/api-base";
import {
  entityRecordLabel,
  unwrapCidocList,
} from "@/lib/cidoc-type-scope";
import { cn } from "@/lib/utils";

interface CidocEntityPickerProps {
  token: string | null | undefined;
  apiSegment: string;
  placeholder?: string;
  /** Text shown on the trigger when a row is chosen (relationship subject/object). */
  selectionSummary?: string | null;
  disabled?: boolean;
  onSelect: (id: number, label: string) => void;
}

export function CidocEntityPicker({
  token,
  apiSegment,
  placeholder = "Search entity…",
  selectionSummary,
  disabled,
  onSelect,
}: CidocEntityPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const base = getPublicApiUrl();
      const q = debounced.trim();
      const qs = new URLSearchParams({ limit: "25" });
      if (q) qs.set("search", q);
      const url = `${base}/api/v1/cidoc/${apiSegment}/?${qs.toString()}`;
      const data = await apiFetchJson<unknown>(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          Accept: "application/json",
        },
      });
      setRows(unwrapCidocList<Record<string, unknown>>(data));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiSegment, debounced, token]);

  useEffect(() => {
    if (!open) return;
    void fetchRows();
  }, [open, fetchRows]);

  const handlePick = (record: Record<string, unknown>) => {
    const rawId = record.id;
    const id =
      typeof rawId === "number"
        ? rawId
        : typeof rawId === "string"
          ? parseInt(rawId, 10)
          : NaN;
    if (!Number.isFinite(id)) return;
    const label = entityRecordLabel(record);
    onSelect(id, label);
    setOpen(false);
    setSearch("");
    setDebounced("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSearch("");
          setDebounced("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-9 min-w-[220px] max-w-full justify-between font-normal",
            !selectionSummary && "text-muted-foreground"
          )}
        >
          <span className="truncate text-left">
            {selectionSummary ?? placeholder}
          </span>
          <ChevronsUpDown className="ms-2 size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,24rem)] p-2" align="start">
        <Input
          placeholder="Filter…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2 h-8"
          autoFocus
        />
        <ScrollArea className="h-[240px] pr-2">
          {loading ? (
            <div className="flex justify-center py-6 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" aria-hidden />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No matches.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {rows.map((r, idx) => {
                const idVal = r.id;
                const key =
                  typeof idVal === "string" || typeof idVal === "number"
                    ? String(idVal)
                    : `row-${idx}`;
                const label = entityRecordLabel(r);
                return (
                  <li key={key}>
                    <button
                      type="button"
                      className="hover:bg-accent flex w-full rounded-md px-2 py-1.5 text-left text-sm"
                      onClick={() => handlePick(r)}
                    >
                      <span className="truncate">{label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

interface DataSourcePickerProps {
  token: string | null | undefined;
  placeholder?: string;
  selectionSummary?: string | null;
  disabled?: boolean;
  allowClear?: boolean;
  onSelect: (uuid: string, label: string) => void;
  onClear?: () => void;
}

export function DataSourcePicker({
  token,
  placeholder = "Choose DataSource…",
  selectionSummary,
  disabled,
  allowClear,
  onSelect,
  onClear,
}: DataSourcePickerProps) {
  const [open, setOpen] = useState(false);
  const [fullFormOpen, setFullFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<
    { id: string; name?: string; citation?: string }[]
  >([]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const base = getPublicApiUrl();
      const q = debounced.trim();
      const qs = new URLSearchParams({ limit: "25" });
      if (q) qs.set("search", q);
      const url = `${base}/api/v1/cidoc/data_sources/?${qs.toString()}`;
      const data = await apiFetchJson<unknown>(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          Accept: "application/json",
        },
      });
      const list = unwrapCidocList<Record<string, unknown>>(data);
      setRows(
        list.map((r) => ({
          id: String(r.id ?? ""),
          name: typeof r.name === "string" ? r.name : undefined,
          citation:
            typeof r.citation === "string" ? r.citation.slice(0, 80) : undefined,
        }))
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [debounced, token]);

  useEffect(() => {
    if (!open) return;
    void fetchRows();
  }, [open, fetchRows]);

  const summarize = (r: { id: string; name?: string }) =>
    r.name?.trim() ? `${r.name.trim()} · ${r.id.slice(0, 8)}…` : r.id;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setSearch("");
            setDebounced("");
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-9 min-w-[220px] max-w-full justify-between font-normal",
              !selectionSummary && "text-muted-foreground"
            )}
          >
            <span className="truncate text-left">
              {selectionSummary ?? placeholder}
            </span>
            <ChevronsUpDown className="ms-2 size-4 shrink-0 opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(100vw-2rem,24rem)] p-2" align="start">
          <Input
            placeholder="Filter by name, author, citation…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-2 h-8"
            autoFocus
          />
          <ScrollArea className="h-[240px] pr-2">
            {loading ? (
              <div className="flex justify-center py-6 text-muted-foreground">
                <Loader2 className="size-6 animate-spin" aria-hidden />
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col gap-2 py-2">
                <p className="text-center text-sm text-muted-foreground">
                  No matches.
                </p>
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="link"
                    className="text-primary h-auto px-2 py-1 text-sm font-medium"
                    onClick={() => setFullFormOpen(true)}
                  >
                    New data source (full form)
                  </Button>
                </div>
              </div>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {rows.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="hover:bg-accent flex w-full flex-col rounded-md px-2 py-1.5 text-left text-sm"
                      onClick={() => {
                        const label = summarize(r);
                        onSelect(r.id, label);
                        setOpen(false);
                        setSearch("");
                        setDebounced("");
                      }}
                    >
                      <span className="truncate font-medium">
                        {r.name ?? r.id}
                      </span>
                      {r.citation ? (
                        <span className="text-muted-foreground truncate text-xs">
                          {r.citation}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
      {allowClear && selectionSummary ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => onClear?.()}
        >
          Clear
        </Button>
      ) : null}
      </div>
      <Button
        type="button"
        variant="link"
        className="text-primary h-auto justify-start px-0 py-1 text-sm font-medium"
        onClick={() => setFullFormOpen(true)}
      >
        New data source (full form)
      </Button>
      <DataSourceCreateDialog
        open={fullFormOpen}
        onOpenChange={setFullFormOpen}
        token={token}
        onCreated={(uuid, label) => {
          onSelect(uuid, label);
        }}
      />
    </div>
  );
}

/** Adds a DataSource without replacing selection (supporting evidence list). */
export function DataSourceAddPicker({
  token,
  disabled,
  excludeIds,
  onAdd,
}: {
  token: string | null | undefined;
  disabled?: boolean;
  excludeIds?: ReadonlySet<string>;
  onAdd: (uuid: string, label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [fullFormOpen, setFullFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<
    { id: string; name?: string; citation?: string }[]
  >([]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const base = getPublicApiUrl();
      const q = debounced.trim();
      const qs = new URLSearchParams({ limit: "25" });
      if (q) qs.set("search", q);
      const url = `${base}/api/v1/cidoc/data_sources/?${qs.toString()}`;
      const data = await apiFetchJson<unknown>(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          Accept: "application/json",
        },
      });
      const list = unwrapCidocList<Record<string, unknown>>(data);
      setRows(
        list.map((r) => ({
          id: String(r.id ?? ""),
          name: typeof r.name === "string" ? r.name : undefined,
          citation:
            typeof r.citation === "string" ? r.citation.slice(0, 80) : undefined,
        }))
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [debounced, token]);

  useEffect(() => {
    if (!open) return;
    void fetchRows();
  }, [open, fetchRows]);

  const summarize = (r: { id: string; name?: string }) =>
    r.name?.trim() ? `${r.name.trim()} · ${r.id.slice(0, 8)}…` : r.id;

  const excluded = excludeIds ?? new Set<string>();

  return (
    <div className="flex flex-col gap-2">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setSearch("");
            setDebounced("");
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button type="button" variant="secondary" size="sm" disabled={disabled}>
            Add source
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(100vw-2rem,24rem)] p-2" align="start">
        <Input
          placeholder="Filter…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2 h-8"
          autoFocus
        />
        <ScrollArea className="h-[220px] pr-2">
          {loading ? (
            <div className="flex justify-center py-6 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" aria-hidden />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col gap-2 py-2">
              <p className="text-center text-sm text-muted-foreground">
                No matches.
              </p>
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="link"
                  className="text-primary h-auto px-2 py-1 text-sm font-medium"
                  onClick={() => setFullFormOpen(true)}
                >
                  New data source (full form)
                </Button>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {rows.map((r) => {
                const taken = excluded.has(r.id);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      disabled={taken}
                      className={cn(
                        "flex w-full flex-col rounded-md px-2 py-1.5 text-left text-sm",
                        taken
                          ? "cursor-not-allowed opacity-50"
                          : "hover:bg-accent"
                      )}
                      onClick={() => {
                        if (taken) return;
                        onAdd(r.id, summarize(r));
                        setOpen(false);
                        setSearch("");
                        setDebounced("");
                      }}
                    >
                      <span className="flex items-center gap-1 truncate font-medium">
                        {taken ? (
                          <Check className="size-3 shrink-0" aria-hidden />
                        ) : null}
                        {r.name ?? r.id}
                      </span>
                      {r.citation ? (
                        <span className="text-muted-foreground truncate text-xs">
                          {r.citation}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
        </PopoverContent>
      </Popover>
      <Button
        type="button"
        variant="link"
        className="text-primary h-auto justify-start px-0 py-1 text-sm font-medium"
        onClick={() => setFullFormOpen(true)}
      >
        New data source (full form)
      </Button>
      <DataSourceCreateDialog
        open={fullFormOpen}
        onOpenChange={setFullFormOpen}
        token={token}
        onCreated={(uuid, label) => {
          onAdd(uuid, label);
        }}
      />
    </div>
  );
}

interface EntityClusterPickerProps {
  token: string | null | undefined;
  typeScope: string;
  placeholder?: string;
  selectionSummary?: string | null;
  disabled?: boolean;
  onSelect: (clusterId: string, label: string) => void;
}

export function EntityClusterPicker({
  token,
  typeScope,
  placeholder = "Choose cluster…",
  selectionSummary,
  disabled,
  onSelect,
}: EntityClusterPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<
    { id: string; canonical_label: string; merged_into?: string | null }[]
  >([]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const base = getPublicApiUrl();
      const q = debounced.trim();
      const qs = new URLSearchParams({
        limit: "25",
        type_scope: typeScope,
      });
      if (q) qs.set("search", q);
      const url = `${base}/api/v1/cidoc/entity-clusters/?${qs.toString()}`;
      const data = await apiFetchJson<unknown>(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          Accept: "application/json",
        },
      });
      const list = unwrapCidocList<Record<string, unknown>>(data);
      const mapped = list
        .map((r) => ({
          id: String(r.id ?? ""),
          canonical_label:
            typeof r.canonical_label === "string"
              ? r.canonical_label
              : String(r.id ?? ""),
          merged_into:
            r.merged_into === null || r.merged_into === undefined
              ? r.merged_into
              : String(r.merged_into),
        }))
        .filter((r) => !r.merged_into);
      setRows(mapped);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [debounced, token, typeScope]);

  useEffect(() => {
    if (!open) return;
    void fetchRows();
  }, [open, fetchRows]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSearch("");
          setDebounced("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-9 min-w-[220px] max-w-full justify-between font-normal",
            !selectionSummary && "text-muted-foreground"
          )}
        >
          <span className="truncate text-left">
            {selectionSummary ?? placeholder}
          </span>
          <ChevronsUpDown className="ms-2 size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,24rem)] p-2" align="start">
        <Input
          placeholder="Filter by label…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2 h-8"
          autoFocus
        />
        <ScrollArea className="h-[240px] pr-2">
          {loading ? (
            <div className="flex justify-center py-6 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" aria-hidden />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No clusters for this type scope.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="hover:bg-accent flex w-full flex-col rounded-md px-2 py-1.5 text-left text-sm"
                    onClick={() => {
                      const label = `${r.canonical_label} · ${r.id.slice(0, 8)}…`;
                      onSelect(r.id, label);
                      setOpen(false);
                      setSearch("");
                      setDebounced("");
                    }}
                  >
                    <span className="truncate font-medium">{r.canonical_label}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {r.id}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
