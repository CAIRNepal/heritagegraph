import type { OntologyClass } from '@/types/atlas';
import { ONTOLOGY_CLASSES } from '@/types/atlas';

const CHART_VARS = [
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
] as const;

/** CSS-variable aligned marker colour for WebGL (reads theme tokens at runtime). */
export function colorForOntologyClass(cls: OntologyClass): string {
  const idx = ONTOLOGY_CLASSES.indexOf(cls);
  const i = idx >= 0 ? idx % CHART_VARS.length : 0;
  const name = CHART_VARS[i];
  if (typeof document !== 'undefined') {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (raw) return raw;
  }
  return '#5a9bff';
}
