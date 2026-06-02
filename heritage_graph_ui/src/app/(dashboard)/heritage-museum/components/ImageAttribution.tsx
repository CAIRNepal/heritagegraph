'use client';

import type { ImageCredit } from '../heritage-data';

/**
 * Renders the licensing/attribution line for a displayed image. This is a
 * legal requirement for CC-BY-SA assets and a provenance expectation for the
 * publishable corpus. Returns null when no credit metadata is available so it
 * never fabricates an attribution.
 */
export function ImageAttribution({
  credit,
  className = '',
}: {
  credit?: ImageCredit;
  className?: string;
}) {
  if (!credit || (!credit.artist && !credit.license && !credit.descriptionUrl)) return null;

  const { artist, license, licenseUrl, descriptionUrl, source } = credit;

  return (
    <p className={`text-[10px] leading-tight text-white/55 ${className}`}>
      {artist && <span>© {artist}</span>}
      {artist && license && <span> · </span>}
      {license &&
        (licenseUrl ? (
          <a href={licenseUrl} target="_blank" rel="noopener noreferrer license" className="underline hover:text-white/80">
            {license}
          </a>
        ) : (
          <span>{license}</span>
        ))}
      {descriptionUrl && (
        <>
          {' · '}
          <a href={descriptionUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-white/80">
            {source || 'Source'} ↗
          </a>
        </>
      )}
    </p>
  );
}
