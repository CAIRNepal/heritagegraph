'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useXrTranslations } from '@/lib/heritage-museum/xr-theme';
import * as THREE from 'three';
import {
  IconPlayerPlay,
  IconPlayerStop,
  IconX,
} from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { isEquirectangular } from '@/lib/heritage-museum/panorama-support';
import {
  xrChip,
  xrGlassPanel,
  xrSubtlePanel,
} from '@/lib/heritage-museum/xr-theme';
import { hasUnescoStatement } from '@/lib/unesco/status';
import { cn } from '@/lib/utils';

import { NODE_TYPE_CONFIG, type GraphNode } from '../../heritage-data';
import { useBeatPlayer, useNarration } from '../../utils/useStoryPlayback';
import { ImageAttribution } from '../ImageAttribution';
import { NodeGlyph } from '../../node-icons';

interface PanoramaViewerProps {
  imageUrl: string;
  node: GraphNode;
  reducedMotion?: boolean;
  onClose: () => void;
}

function isWikimediaFilePath(url: string): boolean {
  return /\/Special:FilePath\//.test(url);
}

function extractWikimediaFileTitle(url: string): string | null {
  const m = /\/Special:FilePath\/([^?#]+)/.exec(url);
  if (!m) return null;
  return `File:${decodeURIComponent(m[1])}`;
}

async function resolveWikimediaDirectUrl(originalUrl: string): Promise<string | null> {
  const title = extractWikimediaFileTitle(originalUrl);
  if (!title) return null;
  const api = new URL('https://en.wikipedia.org/w/api.php');
  api.searchParams.set('action', 'query');
  api.searchParams.set('format', 'json');
  api.searchParams.set('prop', 'imageinfo');
  api.searchParams.set('iiprop', 'url');
  api.searchParams.set('redirects', '1');
  api.searchParams.set('origin', '*');
  api.searchParams.set('titles', title);

  const res = await fetch(api.toString(), { method: 'GET' });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    query?: { pages?: Record<string, { imageinfo?: Array<{ url?: string }> }> };
  };
  const pages = json.query?.pages ?? {};
  for (const p of Object.values(pages)) {
    const url = p.imageinfo?.[0]?.url;
    if (typeof url === 'string' && url.startsWith('https://')) return url;
  }
  return null;
}

function PanoramaStory({
  node,
  reducedMotion,
}: {
  node: GraphNode;
  reducedMotion: boolean;
}) {
  const t = useXrTranslations();
  const cfg = NODE_TYPE_CONFIG[node.nodeType];
  const { beats, index: safeIdx, beat, progress, paused, setPaused, go } = useBeatPlayer(
    node,
    reducedMotion,
  );
  const [collapsed, setCollapsed] = useState(false);

  if (!beat) return null;

  const isBullet = beat.lines.length > 1;

  return (
    <div className="absolute bottom-6 left-4 z-20 w-[min(420px,calc(100vw-2rem))] sm:left-6">
      {collapsed ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-2 backdrop-blur-md"
          onClick={() => setCollapsed(false)}
        >
          <span style={{ color: cfg.color }}>{beat.icon}</span>
          {beat.title}
          <span className="ml-auto text-muted-foreground">{t('panoramaExpand')}</span>
        </Button>
      ) : (
        <div
          className={cn(xrGlassPanel, 'overflow-hidden')}
          style={{ boxShadow: `0 8px 48px rgba(0,0,0,0.35), 0 0 32px ${cfg.color}18` }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="h-0.5 bg-muted">
            <div
              className="h-full"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(to right, ${cfg.color}, ${cfg.glowColor})`,
              }}
            />
          </div>

          <div className="p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span
                className="rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-widest"
                style={{ background: `${cfg.color}22`, color: cfg.color }}
              >
                {beat.icon} {beat.title}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-muted-foreground">
                  {t('beatProgress', { current: safeIdx + 1, total: beats.length })}
                </span>
                {paused && !reducedMotion ? (
                  <span className={xrChip}>{t('paused')}</span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCollapsed(true)}
                  title={t('panoramaCollapse')}
                >
                  ↓
                </Button>
              </div>
            </div>

            <div key={`${node.id}-${safeIdx}`}>
              {isBullet ? (
                <ul className="space-y-1.5">
                  {beat.lines.map((line, i) => {
                    const parts = line.split('  ·  ');
                    const [label, value] = parts.length === 2 ? parts : [null, line];
                    return (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span
                          className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full"
                          style={{ background: cfg.color }}
                        />
                        {label ? (
                          <>
                            <span className="w-24 shrink-0 truncate text-muted-foreground">
                              {label}
                            </span>
                            <span className="font-medium text-foreground">{value}</span>
                          </>
                        ) : (
                          <span className="leading-relaxed text-foreground/90">{line}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm leading-7 text-foreground/90">{beat.lines[0]}</p>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={safeIdx === 0}
                onClick={() => go(Math.max(0, safeIdx - 1))}
              >
                ← {t('prev')}
              </Button>
              <div className="flex max-w-[140px] flex-wrap items-center justify-center gap-1">
                {beats.map((b, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => go(i)}
                    title={b.title}
                    className="rounded-full transition-all hover:scale-125"
                    style={{
                      width: i === safeIdx ? 14 : 5,
                      height: 5,
                      background: i === safeIdx ? cfg.color : 'var(--muted-foreground)',
                      opacity: i === safeIdx ? 1 : 0.35,
                    }}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={safeIdx === beats.length - 1}
                onClick={() => go(Math.min(beats.length - 1, safeIdx + 1))}
              >
                {t('next')} →
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PanoramaFacts({ node }: { node: GraphNode }) {
  const cfg = NODE_TYPE_CONFIG[node.nodeType];
  if (!node.keyFacts?.length) return null;
  return (
    <div className="pointer-events-none absolute right-4 top-20 z-20 flex flex-col items-end gap-2 sm:right-5">
      {node.keyFacts.slice(0, 4).map((f, i) => (
        <div
          key={i}
          className={cn(xrSubtlePanel, 'flex items-center gap-2 px-3 py-1.5 text-xs')}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.color }} />
          <span className="text-muted-foreground">{f.label}</span>
          <span className="font-semibold text-foreground">{f.value}</span>
        </div>
      ))}
    </div>
  );
}

export function PanoramaViewer({
  imageUrl,
  node,
  reducedMotion = false,
  onClose,
}: PanoramaViewerProps) {
  const t = useXrTranslations();
  const cfg = NODE_TYPE_CONFIG[node.nodeType];
  const { playing, play, stop } = useNarration(node.storyText ?? '');
  const mountRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [vrSupported, setVrSupported] = useState(false);
  const [arSupported, setArSupported] = useState(false);
  const [xrActive, setXrActive] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [equirect, setEquirect] = useState<boolean | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!mountRef.current) return;
    setLoaded(false);
    setLoadError(null);
    setEquirect(null);
    const urlToLoad = resolvedUrl ?? imageUrl;
    const container = mountRef.current;
    const W = container.clientWidth;
    const H = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, W / H, 0.1, 2000);
    camera.position.set(0, 0, 0.01);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.xr.enabled = true;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const geo = new THREE.SphereGeometry(500, 60, 40);
    geo.scale(-1, 1, 1);
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    const tex = loader.load(
      urlToLoad,
      (loadedTex) => {
        setLoaded(true);
        const img = loadedTex.image as { width?: number; height?: number } | undefined;
        if (img?.width && img?.height) setEquirect(isEquirectangular(img.width, img.height));
      },
      undefined,
      async () => {
        if (!resolvedUrl && isWikimediaFilePath(urlToLoad)) {
          const direct = await resolveWikimediaDirectUrl(urlToLoad);
          if (direct) {
            setResolvedUrl(direct);
            return;
          }
        }
        setLoadError(t('panoramaLoadErrorBody'));
      },
    );
    tex.colorSpace = THREE.SRGBColorSpace;
    const sphere = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex }));
    scene.add(sphere);

    let lon = 0;
    let lat = 0;
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    let autoRotate = !reducedMotion;
    const AUTO_SPEED = 0.05;
    const toRad = (d: number) => (d * Math.PI) / 180;

    function updateCamera() {
      lat = Math.max(-85, Math.min(85, lat));
      const phi = toRad(90 - lat);
      const theta = toRad(lon);
      camera.lookAt(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      );
    }

    const canvas = renderer.domElement;
    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      autoRotate = false;
      prevX = e.clientX;
      prevY = e.clientY;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      lon -= (e.clientX - prevX) * 0.25;
      lat += (e.clientY - prevY) * 0.25;
      prevX = e.clientX;
      prevY = e.clientY;
    };
    const onMouseUp = () => {
      isDragging = false;
    };
    let lastTX = 0;
    let lastTY = 0;
    const onTouchStart = (e: TouchEvent) => {
      isDragging = true;
      autoRotate = false;
      lastTX = e.touches[0].clientX;
      lastTY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!isDragging) return;
      lon -= (e.touches[0].clientX - lastTX) * 0.3;
      lat += (e.touches[0].clientY - lastTY) * 0.3;
      lastTX = e.touches[0].clientX;
      lastTY = e.touches[0].clientY;
    };
    const onTouchEnd = () => {
      isDragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      camera.fov = Math.max(20, Math.min(100, camera.fov + e.deltaY * 0.03));
      camera.updateProjectionMatrix();
    };
    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const onKeyLook = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const STEP = 6;
      switch (e.key) {
        case 'ArrowLeft':
          lon -= STEP;
          autoRotate = false;
          break;
        case 'ArrowRight':
          lon += STEP;
          autoRotate = false;
          break;
        case 'ArrowUp':
          lat += STEP;
          autoRotate = false;
          break;
        case 'ArrowDown':
          lat -= STEP;
          autoRotate = false;
          break;
        case '+':
        case '=':
          camera.fov = Math.max(20, camera.fov - 4);
          camera.updateProjectionMatrix();
          break;
        case '-':
        case '_':
          camera.fov = Math.min(100, camera.fov + 4);
          camera.updateProjectionMatrix();
          break;
        default:
          return;
      }
      e.preventDefault();
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKeyLook);

    renderer.setAnimationLoop(() => {
      if (autoRotate && !isDragging) lon += AUTO_SPEED;
      updateCamera();
      renderer.render(scene, camera);
    });

    if ('xr' in navigator && navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr').then(setVrSupported).catch(() => {});
      navigator.xr.isSessionSupported('immersive-ar').then(setArSupported).catch(() => {});
    }

    return () => {
      renderer.setAnimationLoop(null);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyLook);
      tex.dispose();
      (sphere.material as THREE.Material).dispose();
      geo.dispose();
      renderer.dispose();
      if (container.contains(canvas)) container.removeChild(canvas);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl, resolvedUrl, reducedMotion]);

  const enterVR = useCallback(async () => {
    const r = rendererRef.current;
    if (!r || !navigator.xr) return;
    try {
      const s = await navigator.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
      });
      await r.xr.setSession(s);
      setXrActive(true);
      s.addEventListener('end', () => setXrActive(false));
    } catch {
      /* WebXR optional */
    }
  }, []);

  const enterAR = useCallback(async () => {
    const r = rendererRef.current;
    if (!r || !navigator.xr) return;
    try {
      const s = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
      });
      await r.xr.setSession(s);
      setXrActive(true);
      s.addEventListener('end', () => setXrActive(false));
    } catch {
      /* WebXR optional */
    }
  }, []);

  const exitXR = useCallback(async () => {
    const s = rendererRef.current?.xr.getSession();
    if (s) await s.end();
  }, []);

  const subtitle = loadError
    ? t('panoramaLoadError')
    : !loaded
      ? t('panoramaSubtitleLoading')
      : equirect === false
        ? t('panoramaSubtitleFlat')
        : t('panoramaSubtitleControls');

  return (
    <div
      className="fixed inset-0 z-50 bg-background"
      role="dialog"
      aria-modal="true"
      aria-label={`${t('panoramaOpen')}: ${node.label}`}
    >
      <div ref={mountRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-background/90 to-transparent px-4 py-4 sm:px-5">
        <div className="pointer-events-auto flex items-center gap-3">
          <Button
            ref={closeBtnRef}
            type="button"
            variant="secondary"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={onClose}
            aria-label={t('panoramaClose')}
          >
            <IconX className="h-4 w-4" />
          </Button>
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <NodeGlyph nodeType={node.nodeType} size={16} color={cfg.color} />
              {node.label}
              {equirect === true ? (
                <Badge variant="secondary" className="text-[10px]">
                  {t('badge360')}
                </Badge>
              ) : null}
              {hasUnescoStatement(node.label) ? (
                <Badge variant="outline" className="text-[10px]">
                  {t('badgeUnesco')}
                </Badge>
              ) : null}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {node.storyText ? (
            <Button
              type="button"
              size="sm"
              variant={playing ? 'destructive' : 'default'}
              className="h-8 gap-1 text-xs"
              onClick={playing ? stop : play}
              aria-pressed={playing}
            >
              {playing ? (
                <IconPlayerStop className="h-3.5 w-3.5" />
              ) : (
                <IconPlayerPlay className="h-3.5 w-3.5" />
              )}
              {playing ? t('stopNarration') : t('narrate')}
            </Button>
          ) : null}
          {!xrActive ? (
            <>
              {vrSupported ? (
                <Button type="button" size="sm" variant="secondary" className="h-8 text-xs" onClick={enterVR}>
                  {t('enterVr')}
                </Button>
              ) : null}
              {arSupported ? (
                <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={enterAR}>
                  {t('enterAr')}
                </Button>
              ) : null}
              {!vrSupported && !arSupported ? (
                <span className={xrChip}>{t('webXrUnavailable')}</span>
              ) : null}
            </>
          ) : (
            <Button type="button" size="sm" variant="destructive" className="h-8 text-xs" onClick={exitXR}>
              {t('exitXr')}
            </Button>
          )}
        </div>
      </div>

      {!loaded && !loadError ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="text-center">
            <div
              className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: `${cfg.color}55`, borderTopColor: cfg.color }}
            />
            <p className="text-sm text-muted-foreground">
              {t('panoramaLoading', { label: node.label })}
            </p>
          </div>
        </div>
      ) : null}

      {loadError ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center px-6">
          <div className={cn(xrGlassPanel, 'max-w-md p-6 text-center')}>
            <p className="mb-1 text-sm font-semibold text-foreground">{t('panoramaLoadError')}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">{loadError}</p>
            <p className="mt-3 break-all text-[11px] text-muted-foreground/80">{imageUrl}</p>
            <Button type="button" variant="outline" size="sm" className="mt-4" onClick={onClose}>
              {t('panoramaClose')}
            </Button>
          </div>
        </div>
      ) : null}

      <PanoramaFacts node={node} />
      <PanoramaStory node={node} reducedMotion={reducedMotion} />

      <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 max-w-[90vw] -translate-x-1/2">
        <p className="rounded-full bg-card/80 px-4 py-1 text-center text-[11px] text-muted-foreground backdrop-blur-sm">
          {equirect === true
            ? t('panoramaTrue360')
            : equirect === false
              ? t('panoramaFlatDisclaimer')
              : t('panoramaPreparing')}
        </p>
      </div>

      <div className="pointer-events-auto absolute bottom-2 right-3 z-10 max-w-[40vw] text-right">
        <ImageAttribution credit={node.imageCredits?.[imageUrl]} />
      </div>
    </div>
  );
}
