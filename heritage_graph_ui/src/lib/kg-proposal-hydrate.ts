import { apiFetchJson } from '@/lib/api-client';
import { entityRecordLabel, getCidocListSegment } from '@/lib/cidoc-type-scope';

export function coerceFkPk(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id: unknown }).id;
    if (typeof id === 'string' && id.trim()) return id.trim();
  }
  return null;
}

function bearer(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
}

export function normalizeAnchorRecords(
  raw: unknown
): { entity_type: string; entity_id: number }[] {
  if (!Array.isArray(raw)) return [];
  const out: { entity_type: string; entity_id: number }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const et = o.entity_type;
    const eid = o.entity_id;
    if (typeof et !== 'string') continue;
    const idNum =
      typeof eid === 'number' ? eid : Number.parseInt(String(eid), 10);
    if (!Number.isFinite(idNum)) continue;
    out.push({ entity_type: et, entity_id: idNum });
  }
  return out;
}

export function normalizeUuidList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x).trim()).filter(Boolean);
}

/** Resolve display label for a CIDOC row (detail GET). */
export async function fetchCidocEntityRowLabel(
  token: string,
  base: string,
  entityType: string,
  entityId: number
): Promise<string | undefined> {
  const seg = getCidocListSegment(entityType);
  if (!seg) return undefined;
  try {
    const row = await apiFetchJson<Record<string, unknown>>(
      `${base}/api/v1/cidoc/${seg}/${entityId}/`,
      { headers: bearer(token) }
    );
    return entityRecordLabel(row);
  } catch {
    return undefined;
  }
}

export async function fetchDataSourcePickerLabel(
  token: string,
  base: string,
  uuid: string
): Promise<string> {
  try {
    const row = await apiFetchJson<Record<string, unknown>>(
      `${base}/api/v1/cidoc/data_sources/${uuid}/`,
      { headers: bearer(token) }
    );
    const name = row.name;
    const short = uuid.slice(0, 8);
    if (typeof name === 'string' && name.trim()) {
      return `${name.trim()} · ${short}…`;
    }
    return uuid;
  } catch {
    return uuid;
  }
}

export async function fetchEntityClusterPickerLabel(
  token: string,
  base: string,
  uuid: string
): Promise<string> {
  try {
    const row = await apiFetchJson<{ canonical_label?: unknown }>(
      `${base}/api/v1/cidoc/entity-clusters/${uuid}/`,
      { headers: bearer(token) }
    );
    const lab = row.canonical_label;
    const short = uuid.slice(0, 8);
    if (typeof lab === 'string' && lab.trim()) {
      return `${lab.trim()} · ${short}…`;
    }
    return uuid;
  } catch {
    return uuid;
  }
}
