/**
 * Photography for the UNESCO entry experience.
 *
 * Reads `src/data/unesco-imagery.json`, produced by
 * `scripts/freeze-unesco-imagery.mjs`. Every image carries a licence, an
 * author, a file description page and a retrieval date — attribution for
 * CC-BY-SA assets is a licensing obligation, not a nice-to-have.
 *
 * A subject whose credit could not be retrieved is stored with `image: null`
 * and must render the explicit "no photograph recorded" state. There is no
 * placeholder and no substitute image: showing an unrelated photograph under a
 * monument's name would be a fabrication.
 */
import manifest from '@/data/unesco-imagery.json';

import type { ImageCredit } from '@/app/(dashboard)/heritage-museum/heritage-data';

export interface SubjectImage {
  readonly url: string;
  /** Intrinsic pixel size — used to reserve aspect ratio and avoid layout shift. */
  readonly width: number;
  readonly height: number;
  readonly credit: ImageCredit;
}

export interface SubjectImagery {
  /** The Wikipedia article the file was taken from. Provenance for the
   *  selection of the image — never rendered as a fact about the monument. */
  readonly sourceArticle: string;
  readonly file: string;
  readonly image: SubjectImage | null;
}

interface ImageryManifest {
  _provenance: {
    generatedBy: string;
    retrieved: string;
    imageSource: string;
    selection: string;
    note: string;
  };
  subjects: Record<string, SubjectImagery>;
}

const DOC = manifest as unknown as ImageryManifest;

export const IMAGERY_PROVENANCE = DOC._provenance;

/**
 * Imagery for a subject key — a `MonumentZone.key`, or `'lumbini'`.
 * Returns `null` when the key is unknown, so a caller that adds a zone without
 * adding its photograph gets the empty state rather than a crash.
 */
export function imageryFor(subjectKey: string): SubjectImagery | null {
  return DOC.subjects[subjectKey] ?? null;
}

/** True when we hold a fully credited photograph for this subject. */
export function hasPhotograph(subjectKey: string): boolean {
  return Boolean(imageryFor(subjectKey)?.image);
}

/** Aspect ratio as a CSS value, for reserving space before the image loads. */
export function aspectRatioOf(image: SubjectImage): string {
  return `${image.width} / ${image.height}`;
}
