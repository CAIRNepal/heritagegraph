/**
 * Atlas-only: show captured exception text in prod when operators set the flag.
 */
export function atlasShowProdErrorDetail(): boolean {
  const raw = process.env.NEXT_PUBLIC_ATLAS_SHOW_ERROR_DETAIL;
  if (typeof raw !== 'string') return false;
  const v = raw.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}
