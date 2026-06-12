"use client";

import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

/** Attribution metadata for a single image (mirrors KG `imageCredits`). */
export interface ImageCreditData {
  license?: string;
  licenseUrl?: string;
  artist?: string;
  source?: string;
  descriptionUrl?: string;
  retrieved?: string;
}

/**
 * Compact image attribution caption (artist + license, linked when possible).
 * Required for lawful reuse of heritage imagery; render directly under an image.
 */
export function ImageCredit({
  credit,
  className,
}: {
  credit?: ImageCreditData | null;
  className?: string;
}) {
  if (!credit) return null;
  const { license, licenseUrl, artist, descriptionUrl } = credit;
  if (!license && !artist && !descriptionUrl) return null;

  const artistEl = artist ? (
    descriptionUrl ? (
      <a
        href={descriptionUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-foreground hover:underline"
      >
        {artist}
      </a>
    ) : (
      <span>{artist}</span>
    )
  ) : null;

  const licenseEl = license ? (
    licenseUrl ? (
      <a
        href={licenseUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-0.5 hover:text-foreground hover:underline"
      >
        {license}
        <ExternalLink className="h-2.5 w-2.5" />
      </a>
    ) : (
      <span>{license}</span>
    )
  ) : null;

  return (
    <p className={cn("text-[10px] leading-snug text-muted-foreground", className)}>
      {artistEl ? <>Credit: {artistEl}</> : null}
      {artistEl && licenseEl ? " · " : null}
      {licenseEl ? <>License: {licenseEl}</> : null}
    </p>
  );
}
