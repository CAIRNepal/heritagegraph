'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { IconX } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import type { CollectionSource, LiveError } from '@/lib/heritage-museum/use-heritage-collection';

/** Below this many records the live graph is explained, not presented as complete. */
export const SPARSE_LIVE_RECORDS = 20;

interface CollectionNoticesProps {
  source: CollectionSource;
  liveError: LiveError | null;
  liveLoading: boolean;
  /** Records currently shown from the live graph, when it has loaded. */
  liveCount: number | null;
  onRetry: () => void;
  onShowDemo: () => void;
  onDismiss: () => void;
}

/** Visitor-facing wording for a collection load failure; detail goes to the console. */
export function useCollectionErrorMessage() {
  const t = useTranslations('heritageMuseum');
  return (e: string | null): string | null =>
    e === 'unconfigured' || e === 'notfound'
      ? t('errors.liveUnavailable')
      : e === 'timeout'
        ? t('errors.liveTimeout')
        : e === 'live'
          ? t('errors.liveLoad')
          : e === 'demo'
            ? t('errors.demoLoad')
            : null;
}

/**
 * The two notices above the collection: a live-graph load failure, with retry
 * and a way back to the demo corpus, and a sparse live graph, said plainly
 * rather than shown as if it were the whole picture.
 */
export function CollectionNotices({ source, liveError, liveLoading, liveCount, onRetry, onShowDemo, onDismiss }: CollectionNoticesProps) {
  const t = useTranslations('heritageMuseum');
  const messageFor = useCollectionErrorMessage();
  const retryable = liveError === 'timeout' || liveError === 'live';
  const sparse = source === 'live' && !liveLoading && !liveError && liveCount != null && liveCount < SPARSE_LIVE_RECORDS;

  return (
    <>
      {liveError ? (
        <div className="z-20 flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive" role="alert">
          <span aria-hidden="true">⚠</span>
          <span>{messageFor(liveError)}</span>
          <span className="ml-auto flex items-center gap-2">
            {retryable ? (
              <Button onClick={onRetry} disabled={liveLoading} variant="outline" size="sm" className="h-7 text-xs" type="button">
                {liveLoading ? t('errors.retrying') : t('errors.retry')}
              </Button>
            ) : null}
            {source === 'live' ? (
              <Button onClick={onShowDemo} variant="outline" size="sm" className="h-7 text-xs" type="button">
                {t('errors.showDemo')}
              </Button>
            ) : null}
            <Button onClick={onDismiss} variant="ghost" size="icon" className="size-7" aria-label={t('errors.dismiss')} type="button">
              <IconX className="size-4" />
            </Button>
          </span>
        </div>
      ) : null}
      {sparse ? (
        <div className="z-20 flex-shrink-0 border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground" role="status">
          {t('sparseLive', { count: liveCount })}{' '}
          <Link href="/contribute/entity" className="text-primary underline underline-offset-2">
            {t('sparseLiveContribute')}
          </Link>
        </div>
      ) : null}
    </>
  );
}
