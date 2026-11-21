/**
 * Browser-local drafts for schema-driven OntologyForm (new entries only).
 * Keys are namespaced so they do not collide with other app storage.
 *
 * Primary store: IndexedDB via `idb-keyval` (offline-friendly).
 * Legacy: same keys may exist in `localStorage`; on read we migrate then remove.
 */

import { get, set, del } from "idb-keyval";

const STORAGE_PREFIX = "heritagegraph:ontologyFormDraft:v1:";
const IDB_STORE_HINT = "ontology-form-drafts";

export interface OntologyFormDraftPayload {
  formData: Record<string, unknown>;
  schemaVersion: string | null;
  savedAt: string;
}

export function buildOntologyFormDraftStorageKey(opts: {
  userKey: string;
  ontologyClassKey: string;
  mode: "new" | "edit";
  recordId?: string | null;
}): string {
  const safeUser = opts.userKey.trim() || "anon";
  const modePart =
    opts.mode === "edit" && opts.recordId
      ? `edit:${encodeURIComponent(opts.recordId)}`
      : "new";
  return `${STORAGE_PREFIX}${safeUser}:${opts.ontologyClassKey}:${modePart}`;
}

function migrateFromLocalStorage(storageKey: string): OntologyFormDraftPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OntologyFormDraftPayload;
    if (!parsed || typeof parsed !== "object" || parsed.formData == null) {
      return null;
    }
    window.localStorage.removeItem(storageKey);
    return parsed;
  } catch {
    return null;
  }
}

export async function loadOntologyFormDraft(
  storageKey: string
): Promise<OntologyFormDraftPayload | null> {
  if (typeof window === "undefined") return null;
  try {
    const fromIdb = await get<OntologyFormDraftPayload>(storageKey);
    if (fromIdb && typeof fromIdb === "object" && fromIdb.formData != null) {
      return fromIdb;
    }
  } catch {
    // IndexedDB unavailable (private mode, SSR) — fall through
  }
  const migrated = migrateFromLocalStorage(storageKey);
  if (migrated) {
    try {
      await set(storageKey, migrated);
    } catch {
      // ignore
    }
  }
  return migrated;
}

/** Sync wrapper for call sites that expect immediate read (legacy). Prefer async. */
export function loadOntologyFormDraftSync(storageKey: string): OntologyFormDraftPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OntologyFormDraftPayload;
    if (!parsed || typeof parsed !== "object" || parsed.formData == null) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveOntologyFormDraft(
  storageKey: string,
  payload: OntologyFormDraftPayload
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await set(storageKey, payload);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  } catch {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // Quota / private mode — ignore
    }
  }
}

/** @deprecated Prefer async `saveOntologyFormDraft` */
export function saveOntologyFormDraftSync(
  storageKey: string,
  payload: OntologyFormDraftPayload
): void {
  void saveOntologyFormDraft(storageKey, payload);
}

export async function clearOntologyFormDraft(storageKey: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await del(storageKey);
  } catch {
    // ignore
  }
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // ignore
  }
}

/** Export store hint for debugging / docs */
export const ONTOLOGY_FORM_DRAFTS_STORE = IDB_STORE_HINT;
