import type { AtlasEntity, DataSource } from '@/types/atlas';

/** System preamble so assistant replies respect the user's Atlas focus. */
export function buildAtlasAssistantContext(
  entity: AtlasEntity | undefined,
  currentYear: number,
  dataSource: 'demo' | 'live',
  sources: DataSource[] = [],
): string | null {
  if (!entity) return null;

  const conflicts = entity.assertions.filter((a) => a.reconciliationStatus === 'conflicting').length;
  const maxConf =
    entity.assertions.length > 0 ?
      Math.max(...entity.assertions.map((a) => a.confidenceScore))
    : null;

  const lines = [
    'You are assisting a researcher using Heritage Atlas (cultural heritage command center).',
    `Corpus mode: ${dataSource}.`,
    `Focused entity: "${entity.name}"${entity.nameNe ? ` (${entity.nameNe})` : ''}.`,
    `Ontology class: ${entity.class}. Era bucket: ${entity.era.replace('_', ' ')}.`,
    `Timeline scrubber year: ${currentYear}.`,
    `Summary: ${entity.summary.slice(0, 600)}`,
  ];

  if (entity.foundedYear != null) lines.push(`Founded (approx.): ${entity.foundedYear}.`);
  if (entity.lat != null && entity.lon != null) {
    lines.push(
      `Coordinates (WGS84): ${entity.lat.toFixed(5)}, ${entity.lon.toFixed(5)}` +
        (entity.coordProvenance ? ` (resolution: ${entity.coordProvenance})` : '') +
        '.',
    );
  }
  if (maxConf != null) lines.push(`Max assertion confidence: ${(maxConf * 100).toFixed(0)}%.`);

  const citedSourceIds = [...new Set(entity.assertions.flatMap((a) => a.derivedFromSourceIds))];
  const citations = citedSourceIds
    .map((sid) => sources.find((s) => s.id === sid)?.citation)
    .filter((c): c is string => Boolean(c))
    .slice(0, 3);
  if (citations.length > 0) {
    lines.push(`Cited sources: ${citations.join(' | ')}.`);
  }
  if (conflicts > 0) {
    lines.push(
      `Warning: ${conflicts} conflicting assertion(s) on this entity — acknowledge uncertainty.`,
    );
  }

  lines.push(
    'Prefer precise, culturally sensitive answers. Do not invent coordinates or dates not implied above.',
  );

  return lines.join('\n');
}
