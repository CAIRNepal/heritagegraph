import { cn } from '@/lib/utils';
import type { KgImageCredit } from '@/lib/kg-graph';

interface StoryFigureProps {
  src: string;
  alt: string;
  credit: KgImageCredit | null;
  className?: string;
  /** Photographs on story pages are shown in black and white, as one archive. */
  monochrome?: boolean;
}

/** A photograph with its author and licence, linked to the file page. */
export function StoryFigure({ src, alt, credit, className, monochrome = true }: StoryFigureProps) {
  const byline = [credit?.artist, credit?.license].filter(Boolean).join(' · ');
  return (
    <figure className={cn('relative overflow-hidden bg-story-panel', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote Commons images, credited per file */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={cn('size-full object-cover', monochrome && 'grayscale')}
      />
      {byline && (
        <figcaption className="absolute bottom-0 left-0 max-w-full truncate bg-story-ink px-2 py-1 text-[10px] font-medium text-story-paper">
          {credit?.descriptionUrl ? (
            <a href={credit.descriptionUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
              {byline}
            </a>
          ) : (
            byline
          )}
        </figcaption>
      )}
    </figure>
  );
}
