'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  useXrTranslations,
  xrChip,
  xrCinematicBottom,
  xrCinematicLeft,
  xrGlassPanel,
  xrSubtlePanel,
} from '@/lib/heritage-museum/xr-theme';
import {
  IconExternalLink,
  IconMapPin,
  IconPlayerPlay,
  IconPlayerStop,
  IconShieldCheck,
  IconSparkles,
} from '@tabler/icons-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import {
  isCuratedResourceIri,
  resourceIriToDetailHref,
} from '@/lib/provenance';
import { hasUnescoStatement } from '@/lib/unesco/status';
import { isEquirectangular } from '@/lib/heritage-museum/panorama-support';
import { parseTemporalAnchor } from '@/lib/heritage-museum/temporal-parse';
import { cn } from '@/lib/utils';

import { NODE_TYPE_CONFIG, type GraphNode } from '../../heritage-data';
import { NodeGlyph } from '../../node-icons';
import { useBeatPlayer, useNarration } from '../../utils/useStoryPlayback';
import { ImageAttribution } from '../ImageAttribution';
import type { MuseumDataSource } from '../museum-toolbar';

const PanoramaViewer = dynamic(
  () => import('./PanoramaViewer').then((m) => m.PanoramaViewer),
  { ssr: false },
);

const XR_STYLES = `
  @keyframes xrFadeInUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes xrKenBurns {
    from { transform: scale(1) translate(0, 0); }
    to   { transform: scale(1.08) translate(-2%, -1%); }
  }
`;

function hasVisual(node: GraphNode): boolean {
  return Boolean(node.imageUrl || node.images?.length);
}

function StorytellingOverlay({
  node,
  cfg,
  reducedMotion,
}: {
  node: GraphNode;
  cfg: (typeof NODE_TYPE_CONFIG)[keyof typeof NODE_TYPE_CONFIG];
  reducedMotion: boolean;
}) {
  const t = useXrTranslations();
  const { beats, index: safeIdx, beat, progress, paused, setPaused, go } = useBeatPlayer(
    node,
    reducedMotion,
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(reducedMotion);
    if (reducedMotion) return;
    const timer = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(timer);
  }, [node.id, reducedMotion]);

  if (!beat) return null;

  const isBullet = beat.lines.length > 1;

  return (
    <div
      className="flex w-full flex-col justify-center py-6 pr-4 pl-2 lg:w-[42%] lg:py-8 lg:pr-8 lg:pl-4"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(16px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className={cn(xrGlassPanel, 'relative overflow-hidden')}
        style={{ boxShadow: `0 0 40px ${cfg.color}14` }}
      >
        <div className="h-0.5 w-full bg-muted">
          <div
            className="h-full transition-[width] duration-100"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(to right, ${cfg.color}, ${cfg.glowColor})`,
              transition: paused ? 'none' : 'width 0.1s linear',
            }}
          />
        </div>

        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-[0.16em]"
                style={{ background: `${cfg.color}22`, color: cfg.color }}
              >
                {beat.icon} {beat.title}
              </span>
              {paused && !reducedMotion ? (
                <span className={xrChip}>{t('paused')}</span>
              ) : null}
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {t('beatProgress', { current: safeIdx + 1, total: beats.length })}
            </span>
          </div>

          <div
            key={`${node.id}-${safeIdx}`}
            style={{ animation: reducedMotion ? 'none' : 'xrFadeInUp 0.4s ease both' }}
            aria-live="polite"
          >
            {isBullet ? (
              <ul className="space-y-2">
                {beat.lines.map((line, i) => {
                  const [label, value] = line.includes('  ·  ')
                    ? line.split('  ·  ')
                    : [null, line];
                  return (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      {label ? (
                        <>
                          <span
                            className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full"
                            style={{ background: cfg.color }}
                          />
                          <span className="w-28 shrink-0 truncate text-muted-foreground">
                            {label}
                          </span>
                          <span className="font-medium text-foreground">{value}</span>
                        </>
                      ) : (
                        <>
                          <span
                            className="mt-2 h-1 w-1 flex-shrink-0 rounded-full"
                            style={{ background: cfg.glowColor }}
                          />
                          <span className="leading-relaxed text-foreground/90">{line}</span>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm leading-7 text-foreground/90">{beat.lines[0]}</p>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
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

            <div className="flex max-w-[160px] flex-wrap items-center justify-center gap-1">
              {beats.map((b, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => go(i)}
                  title={b.title}
                  aria-label={b.title}
                  className="rounded-full transition-all hover:scale-125"
                  style={{
                    width: i === safeIdx ? 16 : 6,
                    height: 6,
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

      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        {reducedMotion ? t('storyHintManual') : t('storyHintAuto')}
      </p>
    </div>
  );
}

function KeyFactBadges({
  node,
  cfg,
}: {
  node: GraphNode;
  cfg: (typeof NODE_TYPE_CONFIG)[keyof typeof NODE_TYPE_CONFIG];
}) {
  if (!node.keyFacts?.length) return null;
  return (
    <div className="pointer-events-none absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
      {node.keyFacts.slice(0, 4).map((f, i) => (
        <div
          key={i}
          className={cn(
            xrSubtlePanel,
            'flex items-center gap-2 px-3 py-1.5 text-xs',
          )}
          style={{ animation: `xrFadeInUp 0.4s ease ${i * 0.1}s both` }}
        >
          <span
            className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
            style={{ background: cfg.color }}
          />
          <span className="text-muted-foreground">{f.label}</span>
          <span className="font-semibold text-foreground">{f.value}</span>
        </div>
      ))}
    </div>
  );
}

function GalleryCard({
  node,
  onSelect,
}: {
  node: GraphNode;
  onSelect: (n: GraphNode) => void;
}) {
  const t = useXrTranslations();
  const cfg = NODE_TYPE_CONFIG[node.nodeType];
  const visual = hasVisual(node);
  return (
    <button
      type="button"
      onClick={() => onSelect(node)}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-border text-left transition-all',
        'hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
      style={{ aspectRatio: '4/3' }}
    >
      <div
        className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
        style={{
          background: visual
            ? `url(${node.imageUrl ?? node.images?.[0]}) center/cover no-repeat`
            : `linear-gradient(135deg, ${cfg.color}33 0%, var(--muted) 100%)`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/25 to-transparent" />
      <div
        className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-border/60"
        style={{ background: `${cfg.color}cc` }}
      >
        <NodeGlyph nodeType={node.nodeType} size={17} color="#fff" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <p className="text-sm font-semibold leading-tight text-foreground">{node.label}</p>
        <p className="mt-0.5 text-xs font-medium" style={{ color: cfg.color }}>
          {cfg.label}
        </p>
      </div>
      <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <span className="rounded-full border border-border bg-card/80 px-4 py-2 text-xs text-foreground backdrop-blur-sm">
          {t('explore')} →
        </span>
      </div>
    </button>
  );
}

function GalleryListItem({
  node,
  onSelect,
}: {
  node: GraphNode;
  onSelect: (n: GraphNode) => void;
}) {
  const cfg = NODE_TYPE_CONFIG[node.nodeType];
  return (
    <button
      type="button"
      onClick={() => onSelect(node)}
      className={cn(
        'group flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-left transition-colors',
        'hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <span
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
        style={{ background: `${cfg.color}cc` }}
      >
        <NodeGlyph nodeType={node.nodeType} size={12} color="#fff" />
      </span>
      <span className="text-xs font-medium text-foreground">{node.label}</span>
      <span className="text-[11px] text-muted-foreground">{cfg.label}</span>
    </button>
  );
}

interface ImmersiveSceneProps {
  node: GraphNode | null;
  allNodes: GraphNode[];
  onSelect: (node: GraphNode) => void;
  dataSource?: MuseumDataSource;
  onClearFilters?: () => void;
}

export function ImmersiveScene({
  node,
  allNodes,
  onSelect,
  dataSource = 'demo',
  onClearFilters,
}: ImmersiveSceneProps) {
  const t = useXrTranslations();
  const tPanel = useTranslations('heritageMuseum.panel');
  const [heroIdx, setHeroIdx] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  // Only true once the hero image has loaded AND measured close to 2:1. The
  // 360° viewer is offered on that basis alone: wrapping an ordinary
  // photograph onto a sphere adds no immersion and looks broken at the poles.
  const [heroIsPanoramic, setHeroIsPanoramic] = useState(false);
  const [showPanorama, setShowPanorama] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const { playing, play, stop } = useNarration(node?.storyText ?? node?.description ?? '');

  const images: string[] = node
    ? node.images?.length
      ? node.images
      : node.imageUrl
        ? [node.imageUrl]
        : []
    : [];

  const sortedNodes = useMemo(
    () =>
      [...allNodes].sort((a, b) => {
        const av = hasVisual(a) ? 0 : 1;
        const bv = hasVisual(b) ? 0 : 1;
        if (av !== bv) return av - bv;
        return a.label.localeCompare(b.label);
      }),
    [allNodes],
  );
  // A 4:3 photo tile promises a picture. Records without one render as empty
  // pastel rectangles, so they get a compact list instead of the grid — unless
  // nothing has imagery at all, where a list-only view would hide the corpus.
  const visualNodes = useMemo(() => sortedNodes.filter(hasVisual), [sortedNodes]);
  const textOnlyNodes = useMemo(() => sortedNodes.filter((n) => !hasVisual(n)), [sortedNodes]);
  const withMediaCount = visualNodes.length;
  const cardNodes = withMediaCount > 0 ? visualNodes : sortedNodes;
  const listNodes = withMediaCount > 0 ? textOnlyNodes : [];

  useEffect(() => {
    setHeroIdx(0);
    setImgLoaded(false);
    setHeroIsPanoramic(false);
  }, [node?.id]);
  useEffect(() => {
    setImgLoaded(false);
    setHeroIsPanoramic(false);
  }, [heroIdx]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (reducedMotion) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setParallax({
        x: ((e.clientX - rect.left) / rect.width - 0.5) * 14,
        y: ((e.clientY - rect.top) / rect.height - 0.5) * 10,
      });
    },
    [reducedMotion],
  );
  const handleMouseLeave = useCallback(() => setParallax({ x: 0, y: 0 }), []);

  if (!node) {
    return (
      <>
        <style>{XR_STYLES}</style>
        <div className="h-full w-full overflow-y-auto bg-background p-4 sm:p-6">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 text-center">
              <div className="mb-3 flex justify-center">
                <IconSparkles className="h-8 w-8 text-primary" aria-hidden />
              </div>
              <p className="mb-2 text-2xl font-bold text-foreground sm:text-3xl">
                {t('galleryTitle')}
              </p>
              <p className="mx-auto max-w-xl text-sm text-muted-foreground">
                {t('gallerySubtitle')}
              </p>
            </div>

            {sortedNodes.length > 0 ? (
              <>
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {t('galleryAll', { count: sortedNodes.length })}
                  {withMediaCount > 0
                    ? ` · ${t('galleryWithMedia', { count: withMediaCount })}`
                    : null}
                </p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 md:gap-4">
                  {cardNodes.map((n) => (
                    <GalleryCard key={n.id} node={n} onSelect={onSelect} />
                  ))}
                </div>
                {listNodes.length > 0 ? (
                  <div className="mt-8">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {t('galleryTextOnly', { count: listNodes.length })}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {listNodes.map((n) => (
                        <GalleryListItem key={n.id} node={n} onSelect={onSelect} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">{t('galleryEmpty')}</p>
                {onClearFilters ? (
                  <Button type="button" variant="outline" size="sm" className="text-xs" onClick={onClearFilters}>
                    {t('galleryClearFilters')}
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  const cfg = NODE_TYPE_CONFIG[node.nodeType];
  const heroImage = images[heroIdx] ?? null;
  const detailHref = resourceIriToDetailHref(node.id);
  const showReviewed = dataSource === 'live' && isCuratedResourceIri(node.id);
  const temporal = parseTemporalAnchor(node.inceptionYear);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full select-none overflow-hidden bg-background"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <style>{XR_STYLES}</style>

      <div className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 40% 40%, ${cfg.color}22 0%, var(--background) 72%)`,
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          style={{ filter: `drop-shadow(0 0 60px ${cfg.color}44)` }}
        >
          <NodeGlyph
            nodeType={node.nodeType}
            size={320}
            color={cfg.color}
            strokeWidth={0.75}
            className="select-none opacity-[0.08]"
          />
        </div>
        {heroImage ? (
          <div
            className="absolute inset-[-4%]"
            style={{
              transform: `translate(${parallax.x}px, ${parallax.y}px)`,
              transition: 'transform 0.15s ease-out',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={heroImage}
              src={heroImage}
              alt={node.label}
              className="h-full w-full object-cover"
              style={{
                opacity: imgLoaded ? 1 : 0,
                transition: 'opacity 1s ease',
                animation:
                  imgLoaded && !reducedMotion
                    ? 'xrKenBurns 32s ease-in-out infinite alternate'
                    : 'none',
              }}
              onLoad={(e) => {
                setImgLoaded(true);
                // Measured off the element that is already loading, so the
                // panorama test costs no extra request.
                const img = e.currentTarget;
                setHeroIsPanoramic(
                  isEquirectangular(img.naturalWidth, img.naturalHeight),
                );
              }}
              onError={() => {
                setImgLoaded(false);
                setHeroIsPanoramic(false);
              }}
            />
          </div>
        ) : null}
      </div>

      <div className={xrCinematicLeft} />
      <div className={xrCinematicBottom} />

      <KeyFactBadges node={node} cfg={cfg} />

      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="sticky top-0 z-30 flex-shrink-0 border-b border-border/60 bg-background/80 px-4 pb-3 pt-14 backdrop-blur-md sm:px-6">
              {allNodes.length > 1 ? (
                <div className="mb-3 md:hidden">
                  <Select value={node.id} onValueChange={(id) => {
                    const picked = allNodes.find((n) => n.id === id);
                    if (picked) onSelect(picked);
                  }}>
                    <SelectTrigger className="h-9 w-full text-xs" aria-label={t('mobilePickerAria')}>
                      <SelectValue placeholder={t('mobilePickerPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {allNodes.map((n) => (
                        <SelectItem key={n.id} value={n.id} className="text-xs">
                          {n.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                {node.storyText || node.description ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={playing ? 'destructive' : 'default'}
                    className="h-8 gap-1.5 text-xs"
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
                {node.storyText ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => setShowTranscript((v) => !v)}
                    aria-expanded={showTranscript}
                  >
                    {showTranscript ? t('transcriptHide') : t('transcriptShow')}
                  </Button>
                ) : null}
                {heroImage && heroIsPanoramic ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 gap-1 text-xs"
                    onClick={() => setShowPanorama(true)}
                  >
                    <IconSparkles className="h-3.5 w-3.5" />
                    {t('panoramaOpen')}
                  </Button>
                ) : null}
                {detailHref ? (
                  <Button type="button" size="sm" variant="outline" className="h-8 gap-1 text-xs" asChild>
                    <Link href={detailHref}>
                      <IconExternalLink className="h-3.5 w-3.5" />
                      {tPanel('openRecord')}
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>

            <div
              className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-6 pt-3 sm:px-6"
              style={{ scrollbarWidth: 'thin' }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]"
                  style={{ background: `${cfg.color}22`, color: cfg.color }}
                >
                  <NodeGlyph nodeType={node.nodeType} size={14} color={cfg.color} />
                  {cfg.label}
                </span>
                {showReviewed ? (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <IconShieldCheck className="h-3 w-3" />
                    {tPanel('reviewedBadge')}
                  </Badge>
                ) : null}
                {hasUnescoStatement(node.label) ? (
                  <Badge variant="outline" className="text-[10px]">
                    {t('badgeUnesco')} ✦
                  </Badge>
                ) : null}
              </div>

              <h2
                className="font-extrabold leading-none text-foreground"
                style={{
                  fontSize: 'clamp(1.6rem, 3vw, 2.75rem)',
                  textShadow: `0 0 32px ${cfg.color}33`,
                }}
              >
                {node.label}
              </h2>

              <div className="flex flex-wrap gap-2">
                {node.religion ? <span className={xrChip}>🕉 {node.religion}</span> : null}
                {temporal ? (
                  <span className={xrChip}>📅 {temporal.displayLabel}</span>
                ) : null}
                {node.dynasty ? <span className={xrChip}>👑 {node.dynasty}</span> : null}
              </div>

              {node.lat && node.long ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <IconMapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {t('coords', {
                      lat: parseFloat(node.lat).toFixed(3),
                      lng: parseFloat(node.long).toFixed(3),
                    })}
                  </span>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${node.lat}&mlon=${node.long}&zoom=15`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {t('openMap')} ↗
                  </a>
                </div>
              ) : null}

              {!heroImage ? (
                <div className={cn(xrSubtlePanel, 'p-4')}>
                  <p className="text-sm font-medium text-foreground">{t('noMediaTitle')}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {node.description || node.storyText || t('noMediaBody')}
                  </p>
                </div>
              ) : null}

              {showTranscript && node.storyText ? (
                <div className={cn(xrSubtlePanel, 'p-4 text-sm leading-7 text-foreground/90')}>
                  {node.storyText}
                </div>
              ) : null}
            </div>
          </div>

          <StorytellingOverlay node={node} cfg={cfg} reducedMotion={reducedMotion} />
        </div>

        {images.length > 1 ? (
          <div className="flex-shrink-0 px-4 pb-4 sm:px-6">
            <div
              className="flex gap-2 overflow-x-auto pb-1"
              style={{ scrollbarWidth: 'thin' }}
            >
              {images.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setHeroIdx(i)}
                  className="relative flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all hover:scale-105"
                  style={{
                    width: 80,
                    height: 56,
                    borderColor: i === heroIdx ? cfg.color : 'transparent',
                    boxShadow: i === heroIdx ? `0 0 10px ${cfg.color}55` : 'none',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {heroImage && node.imageCredits?.[heroImage] ? (
        <div className="absolute bottom-2 right-3 z-10 max-w-[45%] text-right">
          <ImageAttribution credit={node.imageCredits[heroImage]} />
        </div>
      ) : null}

      {showPanorama && heroImage ? (
        <PanoramaViewer
          imageUrl={heroImage}
          node={node}
          reducedMotion={reducedMotion}
          onClose={() => setShowPanorama(false)}
        />
      ) : null}
    </div>
  );
}
