'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  IconExternalLink,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerStop,
  IconPlus,
  IconShieldCheck,
  IconSparkles,
  IconWorld,
} from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { EntityRecordPanel } from '@/components/records/EntityRecordPanel';
import { isEquirectangular } from '@/lib/heritage-museum/panorama-support';
import { isCuratedResourceIri, resourceIriToDetailHref } from '@/lib/provenance';
import { provenanceTier } from '@/lib/heritage-museum/provenance-tier';
import { unescoStatementForLabel } from '@/lib/unesco/status';
import { cn } from '@/lib/utils';

import { HG_CATEGORY_CONFIG, NODE_TYPE_CONFIG, type GraphNode } from '../../heritage-data';
import { NodeGlyph } from '../../node-icons';
import { useNarration } from '../../utils/useStoryPlayback';
import { ImageAttribution } from '../ImageAttribution';
import type { MuseumDataSource } from '../museum-types';
import { heroImageOf, placeOf, sizedImage, useExhibitWords, yearOf, type Connection } from './exhibit-utils';

// three.js; loaded only when someone opens a panorama.
const PanoramaViewer = dynamic(() => import('../xr/PanoramaViewer').then((m) => m.PanoramaViewer), { ssr: false });

interface ExhibitViewProps {
  node: GraphNode;
  connections: Connection[];
  dataSource: MuseumDataSource;
  onPrev?: () => void;
  onNext?: () => void;
  /** Live data only: pull this record's neighbours from the knowledge graph. */
  onExpand?: () => void;
  expanding?: boolean;
  /** Switch to the map lens on this record; absent when it has no location. */
  onShowOnMap?: () => void;
}

/**
 * One record, presented like an object in a gallery: the whole photograph
 * (never cropped, nothing printed over it), then a label — name, kind, date,
 * place, why it matters — then what can be verified, then the story.
 */
export function ExhibitView({ node, connections, dataSource, onPrev, onNext, onExpand, expanding, onShowOnMap }: ExhibitViewProps) {
  const t = useTranslations('heritageMuseum');
  const tx = useTranslations('heritageMuseum.exhibit');
  const tp = useTranslations('heritageMuseum.panel');
  const tGloss = useTranslations('entityRecord.typeGloss');
  const tUnesco = useTranslations('unescoEntry');
  const words = useExhibitWords();
  const cfg = NODE_TYPE_CONFIG[node.nodeType];
  const image = heroImageOf(node);
  const credit = image ? node.imageCredits?.[image] : undefined;
  const year = yearOf(node);
  const place = placeOf(connections);
  const unesco = unescoStatementForLabel(node.label);
  const detailHref = resourceIriToDetailHref(node.id);
  // What the record rests on, not merely which graph it came from: most live
  // records are Wikidata imports, and "reviewed" would overstate them.
  const tier = dataSource === 'live' && isCuratedResourceIri(node.id) ? provenanceTier(node.recordSource) : null;
  const lede = node.significance || (node.description !== node.storyText ? node.description : '');

  // 0: ~1280px version, 1: original upload, 2: no photograph.
  const [imgStage, setImgStage] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgFailed = imgStage >= 2;
  const displaySrc = image ? (imgStage === 0 ? sizedImage(image, 1280) : image) : undefined;
  const [panoramic, setPanoramic] = useState(false);
  const [showPanorama, setShowPanorama] = useState(false);
  const narration = useNarration(node.storyText ?? '');
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    setImgStage(0);
    setImgLoaded(false);
    setPanoramic(false);
    setShowPanorama(false);
    narration.stop();
    // narration.stop is stable per hook instance; run on record change only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  const more = [
    [tp('history'), node.history],
    [tp('culturalRole'), node.culturalRole],
    [tp('architecture'), node.architecture],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <article className="grid gap-0" aria-labelledby="exhibit-title">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <span className="hidden text-[11px] font-bold tracking-[0.14em] text-story-accent uppercase sm:inline">
          {HG_CATEGORY_CONFIG[node.hgCategory]?.label} / {cfg?.label}
        </span>
        <span className="ml-auto flex gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={onPrev} disabled={!onPrev} aria-label={tx('previousAria')}>
            ← {tx('previous')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onNext} disabled={!onNext} aria-label={tx('nextAria')}>
            {tx('next')} →
          </Button>
        </span>
      </div>

      <figure className="m-0 overflow-hidden border border-story-rule bg-story-panel">
        {image && !imgFailed ? (
          // Holds its height while the photograph loads, so the label below
          // does not jump up and then down again.
          <div className={cn('flex w-full items-center justify-center bg-story-panel', !imgLoaded && 'min-h-[45vh]')}>
            {/* Whole photograph at its own proportions, scaled to fit. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={displaySrc}
              src={displaySrc}
              alt={tx('photoAlt', { name: node.label })}
              className={cn('block h-auto max-h-[72vh] w-auto max-w-full object-contain transition-opacity duration-300 motion-reduce:transition-none', imgLoaded ? 'opacity-100' : 'opacity-0')}
              onLoad={(e) => {
                setImgLoaded(true);
                setPanoramic(isEquirectangular(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight));
              }}
              onError={() => setImgStage((s) => s + 1)}
            />
          </div>
        ) : (
          <div className="flex aspect-[3/2] max-h-[50vh] w-full flex-col items-center justify-center gap-2 bg-story-panel text-[13px] text-story-ink-soft">
            <span className="grid size-11 place-items-center rounded-full" style={{ background: cfg?.color }}>
              <NodeGlyph nodeType={node.nodeType} size={22} color="var(--node-glyph)" />
            </span>
            {tx('noPhoto')}
          </div>
        )}
        {credit && !imgFailed ? (
          <figcaption className="border-t border-story-rule px-3.5 py-2">
            <ImageAttribution credit={credit} variant="onSurface" className="text-[11.5px]" />
          </figcaption>
        ) : null}
      </figure>

      <div className="grid max-w-[46rem] gap-2 pt-5">
        <h2 id="exhibit-title" className="text-[clamp(2.2rem,5vw,3.75rem)] leading-[0.95] font-extrabold tracking-tight text-balance">
          {node.label}
        </h2>
        {node.labelNe ? (
          <p lang="ne" className="font-devanagari text-xl font-semibold">
            {node.labelNe}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-sm text-story-ink-soft">
          <span className="inline-flex items-center gap-1.5 font-semibold text-story-ink">
            <span className="size-[9px] rounded-full" style={{ background: cfg?.color }} aria-hidden />
            {cfg?.label}
          </span>
          {year != null ? <span>{words.year(year)}</span> : null}
          {place ? <span>{place.label}</span> : null}
          {node.religion ? <span>{node.religion}</span> : null}
          {node.dynasty ? <span>{tp('dynasty', { name: node.dynasty })}</span> : null}
        </div>
        <p className="text-xs text-story-ink-soft">{tGloss(node.nodeType)}</p>
        {/* From ground truth, never node.unescoStatus (see lib/unesco/status). */}
        {unesco ? (
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-story-accent">
            <span className="size-2 bg-story-accent" aria-hidden />
            {unesco.kind === 'monumentZone'
              ? tUnesco('statusMonumentZone', { year: unesco.year })
              : tUnesco('statusProperty', { year: unesco.year })}
          </p>
        ) : null}
        {tier ? (
          <p className="inline-flex items-center gap-1 border border-story-accent px-1.5 py-0.5 text-xs font-medium text-story-accent">
            {tier === 'reviewed' ? <IconShieldCheck className="size-3.5" aria-hidden /> : null}
            {tp(`tier.${tier}`)}
          </p>
        ) : null}
        {lede ? <p className="pt-1 text-lg leading-relaxed">{lede}</p> : null}

        <div className="flex flex-wrap gap-2 pt-2">
          {narration.supported && node.storyText?.trim() ? (
            narration.state === 'idle' ? (
              <Button type="button" variant="outline" size="sm" onClick={narration.play} title={t('media.narrate')}>
                <IconPlayerPlay className="size-3.5" aria-hidden />
                {t('media.narrateShort')}
              </Button>
            ) : (
              <span className="inline-flex gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={narration.state === 'playing' ? narration.pause : narration.resume}
                  aria-label={narration.state === 'playing' ? tx('pauseNarration') : tx('resumeNarration')}
                >
                  {narration.state === 'playing' ? <IconPlayerPause className="size-3.5" aria-hidden /> : <IconPlayerPlay className="size-3.5" aria-hidden />}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={narration.stop} aria-label={t('media.stop')}>
                  <IconPlayerStop className="size-3.5" aria-hidden />
                </Button>
              </span>
            )
          ) : null}
          {image && panoramic && !imgFailed ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setShowPanorama(true)}>
              <IconSparkles className="size-3.5" aria-hidden />
              {t('xr.panoramaOpen')}
            </Button>
          ) : null}
          {detailHref ? (
            <Button asChild variant="outline" size="sm">
              <Link href={detailHref}>
                <IconExternalLink className="size-3.5" aria-hidden />
                {tp('openRecord')}
              </Link>
            </Button>
          ) : null}
          {onShowOnMap ? (
            <Button type="button" variant="outline" size="sm" onClick={onShowOnMap}>
              <IconWorld className="size-3.5" aria-hidden />
              {tp('viewOnGlobe')}
            </Button>
          ) : null}
          {onExpand ? (
            <Button type="button" variant="outline" size="sm" onClick={onExpand} disabled={expanding} title={t('expand.title')}>
              <IconPlus className="size-3.5" aria-hidden />
              {expanding ? t('expand.loading') : t('expand.action')}
            </Button>
          ) : null}
        </div>
      </div>

      {/* What can be checked comes before what cannot: the sourced description
          and facts for records that have them (entity-records.json). */}
      <div className="max-w-[46rem] pt-6">
        <EntityRecordPanel nodeId={node.id} />
      </div>

      <section className="grid max-w-[46rem] gap-2.5 pt-6" aria-labelledby="exhibit-story">
        <h3 id="exhibit-story" className="text-[11px] font-bold tracking-[0.14em] uppercase">
          {tp('story')}
        </h3>
        {dataSource === 'demo' && node.storyText?.trim() ? (
          <p className="justify-self-start border border-warning-strong/40 bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning-on-soft">{tp('sampleNarrative')}</p>
        ) : null}
        {node.storyText?.trim() ? (
          <p className="text-base leading-[1.75] whitespace-pre-line text-story-ink">{node.storyText}</p>
        ) : (
          <p className="text-sm italic text-story-ink-soft">{tp('noNarrativeRecorded')}</p>
        )}
      </section>

      {node.keyFacts?.length ? (
        <section className="grid max-w-[46rem] gap-2.5 pt-6" aria-labelledby="exhibit-facts">
          <h3 id="exhibit-facts" className="text-[11px] font-bold tracking-[0.14em] uppercase">
            {tp('keyFacts')}
          </h3>
          <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-5 gap-y-2 text-sm">
            {node.keyFacts.map((f, i) => (
              <div key={i} className="contents">
                <dt className="text-story-ink-soft">{f.label}</dt>
                <dd className="m-0 text-story-ink">{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {more.length || node.rituals?.length ? (
        <details className="group max-w-[46rem] pt-6">
          <summary className="cursor-pointer text-sm font-semibold text-story-accent">{tx('moreAbout', { name: node.label })}</summary>
          <div className="grid gap-4 pt-3 text-sm leading-relaxed text-story-ink">
            {more.map(([h, v]) => (
              <div key={h} className="grid gap-1">
                <h4 className="text-[11px] font-bold tracking-[0.14em] uppercase">{h}</h4>
                <p>{v}</p>
              </div>
            ))}
            {node.rituals?.length ? (
              <div className="grid gap-1">
                <h4 className="text-[11px] font-bold tracking-[0.14em] uppercase">{tp('rituals')}</h4>
                <ul className="list-disc pl-5">
                  {node.rituals.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      <section className="grid max-w-[46rem] gap-2 pt-6 pb-2" aria-labelledby="exhibit-record">
        <h3 id="exhibit-record" className="text-[11px] font-bold tracking-[0.14em] uppercase">
          {tx('record')}
        </h3>
        <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-5 gap-y-1.5 text-[13px]">
          <dt className="text-story-ink-soft">ID</dt>
          <dd className="m-0 font-mono text-xs break-all text-story-ink">{node.id}</dd>
          <dt className="text-story-ink-soft">{tp('hgClass')}</dt>
          <dd className="m-0 font-mono text-xs text-story-ink">hg:{node.nodeType}</dd>
          <dt className="text-story-ink-soft">CIDOC-CRM</dt>
          <dd className="m-0 font-mono text-xs break-all text-story-ink">{node.cidocMapping}</dd>
        </dl>
      </section>

      {showPanorama && image ? (
        <PanoramaViewer imageUrl={image} node={node} reducedMotion={reducedMotion} onClose={() => setShowPanorama(false)} />
      ) : null}
    </article>
  );
}
