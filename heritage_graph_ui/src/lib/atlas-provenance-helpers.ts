import type { DataSource, HeritageAssertion, ReliabilityTier } from '@/types/atlas';

export function tierFromAssertionSources(
  assertion: HeritageAssertion,
  sources: DataSource[],
): ReliabilityTier | null {
  for (const sid of assertion.derivedFromSourceIds) {
    const s = sources.find((row) => row.id === sid);
    if (s) return s.reliabilityTier;
  }
  return null;
}

export function assertionGroups(assertions: HeritageAssertion[]): Map<string, HeritageAssertion[]> {
  const map = new Map<string, HeritageAssertion[]>();
  for (const a of assertions) {
    const arr = map.get(a.assertedProperty) ?? [];
    arr.push(a);
    map.set(a.assertedProperty, arr);
  }
  return map;
}

export function rootAssertionChain(first: HeritageAssertion, all: HeritageAssertion[]): HeritageAssertion[] {
  const chain: HeritageAssertion[] = [first];
  let cur = first;
  const seen = new Set<string>([first.id]);
  while (cur.supersedesAssertionId) {
    const prev = all.find((x) => x.id === cur.supersedesAssertionId);
    if (!prev || seen.has(prev.id)) break;
    chain.push(prev);
    seen.add(prev.id);
    cur = prev;
  }
  return chain;
}
