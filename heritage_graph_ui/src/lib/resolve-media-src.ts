/**
 * Django serves uploads under `/media/...` with a relative URL. The dashboard
 * runs on a different origin than the API, so those paths must be absolutized
 * before `next/image` can fetch and optimize them.
 */
export function resolveMediaSrc(src: string | null | undefined): string | null {
  if (src == null || typeof src !== 'string') return null;
  const t = src.trim();
  if (!t) return null;
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  if (t.startsWith('//')) return `https:${t}`;
  if (t.startsWith('/media/')) {
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(
      /\/$/,
      '',
    );
    return `${base}${t}`;
  }
  return t.startsWith('/') ? t : `/${t}`;
}
