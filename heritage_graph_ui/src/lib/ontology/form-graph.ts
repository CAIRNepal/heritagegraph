/**
 * Derived graph view + JSON-LD preview for OntologyForm.
 * Subject URIs follow Django `rdf_signals._resource_uri`: `{base}/{model.__name__.lower()}/{pk}`.
 */

import type { OntologyClass, OntologyField } from "./types";

// RDF_PREFIXES is generated from ontology/HeritageGraph.yaml (prefixes section).
// To change a namespace: edit the schema, run python3 tools/gen_heritage_viz_config.py.
import { RDF_PREFIXES } from "./__generated__/heritage-viz-config";
export { RDF_PREFIXES };

const RDF_TYPE_IRI = RDF_PREFIXES.rdf + "type";
const RDFS_LABEL_IRI = RDF_PREFIXES.rdfs + "label";

export interface GraphNode {
  /** Stable local key (URI or bnode id) */
  id: string;
  /** Resource IRI when named */
  uri?: string;
  /** rdfs:label when known */
  label?: string;
}

export interface GraphEdge {
  subject: string;
  predicate: string;
  objectUri?: string;
  objectLiteral?: string | number | boolean;
}

export interface FormGraph {
  rootId: string;
  rootUri: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * LinkML `relationTo` / range name → path segment used in `_resource_uri`
 * (`instance.__class__.__name__.lower()`). `null` = no stable persisted row (skip edge).
 */
export const LINKML_RANGE_TO_RESOURCE_SEGMENT: Readonly<
  Record<string, string | null>
> = {
  Person: "person",
  Place: "location",
  Actor: "person",
  ReligiousTradition: "tradition",
  HistoricalEvent: "event",
  InformationObject: "source",
  BuddhistMonument: "monument",
  ArchitecturalStructure: "architecturalstructure",
  RitualEvent: "ritualevent",
  Festival: "festival",
  IconographicObject: "iconographicobject",
  Deity: "deity",
  Guthi: "guthi",
  DataSource: "datasource",
  HeritageAssertion: "heritageassertion",
  EntityCluster: "entitycluster",
  LivingGoddessTenure: "kumaritenure",
  LivingGoddessSelection: "kumariselection",
  LivingGoddessRetirement: "kumariretirement",
  SyncreticRelationship: "syncreticrelationship",
  CasteGroup: "castegroup",
  CalendarSystem: "calendarsystem",
  HistoricalPeriod: "historicalperiod",
  Source: "source",
  Monument: "monument",
  Event: "event",
  Location: "location",
  Tradition: "tradition",
  TimeSpan: null,
  // No dedicated MetaData rows in cidoc_data/models — keep preview URIs namespaced
  ArchitecturalElement: "unresolved/architecturalelement",
  AssertableEntity: "unresolved/assertableentity",
  ConditionAssessment: "unresolved/conditionassessment",
  DocumentationActivity: "unresolved/documentationactivity",
  Enshrinement: "unresolved/enshrinement",
  Production: "unresolved/production",
  TransferOfCustody: "unresolved/transferofcustody",
  DestructionEvent: "unresolved/destructionevent",
  Material: "unresolved/material",
  PhysicalHeritageThing: "unresolved/physicalheritagething",
};

/** Registry `OntologyClass.key` → resource segment for the form’s root subject. */
export const REGISTRY_KEY_TO_RESOURCE_SEGMENT: Readonly<Record<string, string>> = {
  person: "person",
  location: "location",
  event: "event",
  period: "historicalperiod",
  tradition: "tradition",
  source: "source",
  deity: "deity",
  guthi: "guthi",
  structure: "architecturalstructure",
  ritual: "ritualevent",
  festival: "festival",
  iconography: "iconographicobject",
  monument: "monument",
  kumari_tenure: "kumaritenure",
  kumari_selection: "kumariselection",
  kumari_retirement: "kumariretirement",
  syncretism: "syncreticrelationship",
  caste_group: "castegroup",
  calendar: "calendarsystem",
  assertion: "heritageassertion",
  entity_cluster: "entitycluster",
  data_source: "datasource",
  entity: "culturalentity",
};

export function expandCurie(curie: string): string {
  const raw = (curie || "").trim();
  if (!raw) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (!raw.includes(":")) {
    return (RDF_PREFIXES.heritageGraph || "https://w3id.org/heritagegraph/") + raw;
  }
  const [prefix, rest] = raw.split(":", 2);
  const base = RDF_PREFIXES[prefix];
  if (!base) {
    return RDF_PREFIXES.heritageGraph + rest;
  }
  return base + rest;
}

export function getRdfResourceBase(): string {
  const fromEnv =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_RDF_RESOURCE_BASE_URI?.trim()
      : undefined;
  return (fromEnv || "https://w3id.org/heritagegraph/resource").replace(/\/$/, "");
}

export function registryKeyToResourceSegment(registryKey: string): string {
  return REGISTRY_KEY_TO_RESOURCE_SEGMENT[registryKey] ?? registryKey.toLowerCase();
}

export function linkmlRangeToResourceSegment(relationTo: string): string | null {
  if (Object.prototype.hasOwnProperty.call(LINKML_RANGE_TO_RESOURCE_SEGMENT, relationTo)) {
    return LINKML_RANGE_TO_RESOURCE_SEGMENT[relationTo] as string | null;
  }
  return relationTo.charAt(0).toLowerCase() + relationTo.slice(1);
}

export function resourceUriForRelated(
  base: string,
  relationTo: string,
  pk: string | number
): string | null {
  const seg = linkmlRangeToResourceSegment(relationTo);
  if (seg == null) return null;
  return `${base.replace(/\/$/, "")}/${seg}/${pk}`;
}

export function rootSubjectUri(options: {
  base: string;
  registryKey: string;
  recordId?: string | null;
  draftLocalId: string;
}): string {
  const b = options.base.replace(/\/$/, "");
  const seg = registryKeyToResourceSegment(options.registryKey);
  if (options.recordId != null && String(options.recordId).trim() !== "") {
    return `${b}/${seg}/${String(options.recordId).trim()}`;
  }
  return `${b}/${seg}/draft-${options.draftLocalId}`;
}

function parseRelationIds(
  val: unknown,
  multivalued: boolean
): { id: string | number; label?: string }[] {
  if (val == null) return [];
  if (Array.isArray(val)) {
    const out: { id: string | number; label?: string }[] = [];
    for (const item of val) {
      if (item && typeof item === "object" && "id" in item) {
        const id = (item as { id: unknown }).id;
        const name = (item as { name?: unknown }).name;
        if (id != null && id !== "")
          out.push({
            id: id as string | number,
            label: typeof name === "string" ? name : undefined,
          });
      } else if (typeof item === "number" || (typeof item === "string" && item.trim())) {
        const n = typeof item === "number" ? item : Number(item);
        if (!Number.isNaN(n)) out.push({ id: n });
      }
    }
    return out;
  }
  if (typeof val === "object" && val !== null && "id" in val) {
    const id = (val as { id: unknown }).id;
    const name = (val as { name?: unknown }).name;
    if (id != null && id !== "")
      return [
        {
          id: id as string | number,
          label: typeof name === "string" ? name : undefined,
        },
      ];
    return [];
  }
  if (typeof val === "number") return [{ id: val }];
  if (typeof val === "string" && val.trim()) {
    if (multivalued) {
      const parts = val.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
      const out: { id: string | number; label?: string }[] = [];
      for (const p of parts) {
        const n = Number(p);
        if (!Number.isNaN(n)) out.push({ id: n });
      }
      return out;
    }
    const n = Number(val.trim());
    if (!Number.isNaN(n)) return [{ id: n }];
  }
  return [];
}

function literalForField(field: OntologyField, val: unknown): string | number | boolean | null {
  if (val === undefined || val === null || val === "") return null;
  const ft = field.type;
  if (ft === "boolean") return Boolean(val);
  if (ft === "number" || ft === "float") {
    if (typeof val === "number") return val;
    const n = Number(val);
    return Number.isNaN(n) ? String(val) : n;
  }
  if (ft === "multiselect" && Array.isArray(val)) {
    return val.map((x) => String(x)).join("; ");
  }
  if (ft === "geo_point" && val && typeof val === "object") {
    const g = val as { lat?: string; lng?: string };
    const lat = g.lat?.trim();
    const lng = g.lng?.trim();
    if (!lat && !lng) return null;
    return `${lat ?? ""}, ${lng ?? ""}`.trim();
  }
  if (ft === "coordinates" && val && typeof val === "object") {
    const c = val as { lat?: string; lng?: string };
    const lat = c.lat?.trim();
    const lng = c.lng?.trim();
    if (!lat && !lng) return null;
    return `${lat ?? ""}, ${lng ?? ""}`.trim();
  }
  return String(val);
}

function collectNodesFromEdges(rootUri: string, edges: GraphEdge[]): GraphNode[] {
  const byId = new Map<string, GraphNode>();
  byId.set(rootUri, { id: rootUri, uri: rootUri });
  for (const e of edges) {
    if (e.objectUri && !byId.has(e.objectUri)) {
      byId.set(e.objectUri, { id: e.objectUri, uri: e.objectUri });
    }
  }
  return Array.from(byId.values());
}

/**
 * Build a directed edge list + root from flat form state (authoritative source of truth).
 */
export function deriveFormGraph(options: {
  ontologyClass: OntologyClass;
  formData: Record<string, unknown>;
  recordId?: string | null;
  draftLocalId: string;
  resourceBase?: string;
  /** rdfs:label for root from a primary human-facing field when available */
  rootLabel?: string;
}): FormGraph {
  const base = options.resourceBase ?? getRdfResourceBase();
  const rootUri = rootSubjectUri({
    base,
    registryKey: options.ontologyClass.key,
    recordId: options.recordId ?? null,
    draftLocalId: options.draftLocalId,
  });
  const rootId = rootUri;
  const edges: GraphEdge[] = [];

  if (options.rootLabel?.trim()) {
    edges.push({
      subject: rootUri,
      predicate: RDFS_LABEL_IRI,
      objectLiteral: options.rootLabel.trim(),
    });
  }

  const classUri = options.ontologyClass.classUri?.trim();
  if (classUri) {
    edges.push({
      subject: rootUri,
      predicate: RDF_TYPE_IRI,
      objectUri: expandCurie(classUri),
    });
  }

  for (const field of options.ontologyClass.fields) {
    const slot = field.slot_uri?.trim();
    if (!slot) continue;
    const pred = expandCurie(slot);

    if (field.type === "relation") {
      const relTo = field.relationTo ?? "";
      if (!relTo) continue;
      const ids = parseRelationIds(
        options.formData[field.key],
        Boolean(field.multivalued)
      );
      for (const { id } of ids) {
        const objUri = resourceUriForRelated(base, relTo, id);
        if (objUri == null) continue;
        edges.push({
          subject: rootUri,
          predicate: pred,
          objectUri: objUri,
        });
      }
      continue;
    }

    if (field.type === "media") continue;

    const lit = literalForField(field, options.formData[field.key]);
    if (lit === null) continue;
    edges.push({
      subject: rootUri,
      predicate: pred,
      objectLiteral: lit,
    });
  }

  const nodes = collectNodesFromEdges(rootUri, edges);
  return { rootId, rootUri, nodes, edges };
}

/**
 * Prefer `name`, then `title`, for root rdfs:label when building the graph from form data.
 */
export function inferRootLabel(
  ontologyClass: OntologyClass,
  formData: Record<string, unknown>
): string | undefined {
  const prefer = ["name", "title", "preferred_label", "label"];
  const keys = new Set(ontologyClass.fields.map((f) => f.key));
  for (const k of prefer) {
    if (!keys.has(k)) continue;
    const v = formData[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  for (const f of ontologyClass.fields) {
    if (f.type !== "text" && f.type !== "textarea") continue;
    const v = formData[f.key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

/** Compact IRI using known registry prefixes (for JSON-LD keys and UI). */
export function compactIri(iri: string): string {
  const entries = Object.entries(RDF_PREFIXES).sort((a, b) => b[1].length - a[1].length);
  for (const [p, expanded] of entries) {
    if (iri.startsWith(expanded) && expanded.length > 0) {
      return `${p}:${iri.slice(expanded.length)}`;
    }
  }
  return iri;
}

/**
 * Produce a flattened JSON-LD document (single @graph is avoided; one root entity + linked @id refs).
 */
export function formGraphToJsonLd(
  graph: FormGraph,
  ontologyClass: OntologyClass,
  resourceBase?: string
): Record<string, unknown> {
  const base = resourceBase ?? getRdfResourceBase();

  const ctx: Record<string, string> = { ...RDF_PREFIXES };
  ctx["@base"] = base.replace(/\/$/, "") + "/";

  const referenced = new Set<string>();

  type RefMapEntry = Record<string, unknown>;

  const props: Record<string, unknown | RefMapEntry | unknown[]> = {};
  let jsonLdType: string | undefined;

  for (const e of graph.edges) {
    if (e.subject !== graph.rootUri) continue;
    if (e.predicate === RDF_TYPE_IRI && e.objectUri != null) {
      jsonLdType = compactIri(e.objectUri);
      continue;
    }
    const key = compactIri(e.predicate);
    if (e.objectUri != null) {
      referenced.add(e.objectUri);
      const ref: RefMapEntry = { "@id": e.objectUri };
      const existing = props[key];
      if (existing === undefined) {
        props[key] = ref;
      } else if (Array.isArray(existing)) {
        (existing as unknown[]).push(ref);
      } else {
        props[key] = [existing, ref];
      }
    } else if (e.objectLiteral !== undefined) {
      const lit = e.objectLiteral;
      const existingLit = props[key];
      if (existingLit === undefined) {
        props[key] = lit;
      } else if (Array.isArray(existingLit)) {
        (existingLit as unknown[]).push(lit);
      } else {
        props[key] = [existingLit, lit];
      }
    }
  }

  if (!jsonLdType && ontologyClass.classUri?.trim()) {
    jsonLdType = compactIri(expandCurie(ontologyClass.classUri.trim()));
  }

  const rootNode: Record<string, unknown> = {
    "@id": graph.rootUri,
    ...(jsonLdType != null ? { "@type": jsonLdType } : {}),
    ...props,
  };

  const graphBodies: Record<string, unknown>[] = [rootNode];
  for (const uri of referenced) {
    if (uri === graph.rootUri) continue;
    graphBodies.push({ "@id": uri });
  }

  const doc: Record<string, unknown> = {
    "@context": ctx,
  };

  if (graphBodies.length === 1) {
    Object.assign(doc, graphBodies[0]);
  } else {
    doc["@graph"] = graphBodies;
  }

  return doc;
}
