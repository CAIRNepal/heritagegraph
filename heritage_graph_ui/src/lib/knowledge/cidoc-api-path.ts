/**
 * Derive the CIDOC router resource segment from an ontology registry `apiEndpoint`
 * (e.g. `/cidoc/structures/` → `structures`).
 */
export function cidocResourceFromApiEndpoint(apiEndpoint: string): string | null {
  const m = apiEndpoint.match(/\/cidoc\/([^/]+)\/?$/);
  return m ? m[1] : null;
}

/** Lowercase Django `ContentType.model` name for `/cidoc/assertions/?entity_type=` */
export function djangoModelNameFromOntologyKey(domain: string): string {
  const map: Record<string, string> = {
    structure: "architecturalstructure",
    ritual: "ritualevent",
    deity: "deity",
    guthi: "guthi",
    festival: "festival",
    iconography: "iconographicobject",
    monument: "monument",
    person: "person",
    location: "location",
    event: "event",
    period: "historicalperiod",
    tradition: "tradition",
    source: "source",
    kumari_tenure: "kumaritenure",
    kumari_selection: "kumariselection",
    kumari_retirement: "kumariretirement",
    syncretism: "syncreticrelationship",
    caste_group: "castegroup",
    calendar: "calendarsystem",
  };
  return map[domain] || domain.replace(/-/g, "");
}
