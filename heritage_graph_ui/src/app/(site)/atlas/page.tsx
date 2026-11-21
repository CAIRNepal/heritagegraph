import { redirect } from 'next/navigation';

interface AtlasPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The atlas is now the museum's map lens. Old atlas links — including cited
 * ones with `?selected=` and `?source=` — land on the same record, on the map.
 */
export default async function AtlasPage({ searchParams }: AtlasPageProps) {
  const incoming = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(incoming)) {
    if (typeof value === 'string') params.set(key, value);
  }
  const selected = params.get('selected');
  if (selected && !params.has('node')) params.set('node', selected);
  params.delete('selected');
  params.set('lens', 'map');
  redirect(`/heritage-museum?${params.toString()}`);
}
