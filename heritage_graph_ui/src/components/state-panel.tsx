import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { glassCard } from '@/lib/design';
import { cn } from '@/lib/utils';

interface StatePanelProps {
  variant: 'loading' | 'empty' | 'error';
  title: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Consistent loading / empty / error surfaces for dashboard pages.
 */
export function StatePanel({
  variant,
  title,
  description,
  onRetry,
  className,
}: StatePanelProps) {
  return (
    <div
      className={cn(
        `${glassCard} p-6`,
        variant === 'error' && 'border-destructive/30 bg-destructive/5',
        className
      )}
      role={variant === 'loading' ? 'status' : undefined}
      aria-live={variant === 'error' ? 'polite' : undefined}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-blue-950 dark:text-blue-50">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm text-blue-800/80 dark:text-blue-200/75">
              {description}
            </p>
          ) : null}
        </div>
        {variant === 'loading' ? (
          <Loader2
            className="size-6 shrink-0 animate-spin text-blue-600 dark:text-blue-400"
            aria-hidden
          />
        ) : null}
        {variant === 'error' && onRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    </div>
  );
}
