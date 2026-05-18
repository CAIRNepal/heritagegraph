/** Lightweight dev telemetry for Atlas interactions (no PII). */
export function atlasTrack(event: string, payload?: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== 'development') return;
  console.debug('[atlas]', event, payload ?? {});
}
