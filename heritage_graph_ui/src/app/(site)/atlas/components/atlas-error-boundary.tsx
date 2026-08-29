'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { atlasShowProdErrorDetail } from '@/lib/atlas-diagnostic-env';

interface AtlasErrorBoundaryProps {
  children: ReactNode;
}

interface AtlasErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class AtlasErrorBoundary extends Component<
  AtlasErrorBoundaryProps,
  AtlasErrorBoundaryState
> {
  constructor(props: AtlasErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): AtlasErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[AtlasErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <AtlasErrorFallback
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      );
    }
    return this.props.children;
  }
}

function AtlasErrorFallback({
  error,
  onRetry,
}: {
  error: Error | null;
  onRetry: () => void;
}) {
  const t = useTranslations('Atlas');

  return (
    <div
      role="alert"
      className="flex min-h-[280px] flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <div className="max-w-md space-y-2">
        <h2 className="text-lg font-semibold text-foreground">{t('globeLoadErrorTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('globeLoadErrorHint')}</p>
        {(process.env.NODE_ENV === 'development' || atlasShowProdErrorDetail()) && error?.message ?
          <p className="break-all font-mono text-xs text-destructive">{error.message}</p>
        : null}
      </div>
      <Button type="button" variant="secondary" onClick={onRetry}>
        {t('globeLoadErrorRetry')}
      </Button>
    </div>
  );
}
