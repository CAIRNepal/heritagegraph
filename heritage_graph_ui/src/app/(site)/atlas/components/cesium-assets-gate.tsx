'use client';

/* Side-effect: ensure CESIUM_BASE_URL matches globe.tsx before probing same-origin URLs. */
import '@/app/(dashboard)/atlas/cesium-base-url';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

interface CesiumAssetsGateProps {
  children: React.ReactNode;
}

/** File always produced by scripts/copy-cesium-assets.mjs under public/cesium/Assets/. */
export const CESIUM_PREFLIGHT_JSON = '/Assets/approximateTerrainHeights.json';

function cesiumStaticBase(): string {
  if (typeof window === 'undefined') return '/cesium';
  return (window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL ?? '/cesium';
}

export function CesiumAssetsGate({ children }: CesiumAssetsGateProps) {
  const t = useTranslations('Atlas');
  const [phase, setPhase] = useState<'checking' | 'ready' | 'failed'>('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const url = `${cesiumStaticBase()}${CESIUM_PREFLIGHT_JSON}`;

    async function probe(): Promise<void> {
      setPhase('checking');
      try {
        let ok = false;
        const head = await fetch(url, { method: 'HEAD', cache: 'no-store' });
        if (head.ok) ok = true;
        if (!ok) {
          const get = await fetch(url, {
            method: 'GET',
            cache: 'no-store',
            headers: { Accept: 'application/json' },
          });
          ok = get.ok;
        }
        if (cancelled) return;
        setPhase(ok ? 'ready' : 'failed');
      } catch {
        if (cancelled) return;
        setPhase('failed');
      }
    }

    void probe();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (phase === 'checking') {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center bg-background text-muted-foreground text-sm"
        role="status"
      >
        {t('checkingCesiumAssets')}
      </div>
    );
  }

  if (phase === 'ready') {
    return <>{children}</>;
  }

  return (
    <div
      role="alert"
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background p-6 text-center"
    >
      <div className="max-w-md space-y-2">
        <h2 className="text-lg font-semibold text-foreground">{t('globeCesiumAssetsUnavailableTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('globeCesiumAssetsUnavailableHint')}</p>
      </div>
      <Button type="button" variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
        {t('globeLoadErrorRetry')}
      </Button>
    </div>
  );
}
