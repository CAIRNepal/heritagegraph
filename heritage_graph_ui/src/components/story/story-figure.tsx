import { cn } from '@/lib/utils';
import type { KgImageCredit } from '@/lib/kg-graph';

interface StoryFigureProps {
  src: string;
  alt: string;
  credit: KgImageCredit | null;
  className?: string;
  /** Photographs on story pages are shown in black and white, as one archive. */
  monochrome?: boolean;
  /** False inside a link (a story card): the credit is printed without its own links. */
  linked?: boolean;
}

/**
 * A photograph with its author and licence. The credit is printed in full,
 * never truncated: the author links to the file page, the licence to its text.
 */
export function StoryFigure({ src, alt, credit, className, monochrome = false, linked = true }: StoryFigureProps) {
  const author = credit?.artist?.trim();
  const license = credit?.license?.trim();
  const authorHref = linked ? credit?.descriptionUrl : undefined;
  const licenseHref = linked ? credit?.licenseUrl : undefined;
  return (
    <figure className={cn('relative overflow-hidden bg-story-panel', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote Commons images, credited per file */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={cn('size-full object-cover', monochrome && 'grayscale')}
      />
      {author || license ? (
        <figcaption className="absolute bottom-0 left-0 max-w-full bg-story-ink px-2 py-1 text-[10px] leading-snug font-medium text-story-paper">
          {author ? (
            authorHref ? (
              <a href={authorHref} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                {author}
              </a>
            ) : (
              author
            )
          ) : null}
          {author && license ? ' · ' : null}
          {license ? (
            licenseHref ? (
              <a href={licenseHref} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                {license}
              </a>
            ) : (
              license
            )
          ) : null}
        </figcaption>
      ) : null}
    </figure>
  );
}
