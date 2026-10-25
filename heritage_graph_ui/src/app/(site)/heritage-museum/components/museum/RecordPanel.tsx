'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { IconBook2, IconExternalLink, IconRoute } from '@tabler/icons-react';

import { Eyebrow, Nepali } from '@/components/story/story-chrome';
import { useAtlasWords } from '@/app/(site)/atlas/components/atlas-words';
import { distanceKm, eraOf, roundAltitude, type AtlasPlace } from '@/lib/heritage-atlas/atlas-model';
import { provenanceTier, wikidataIdIn } from '@/lib/heritage-museum/provenance-tier';
import type { Lens } from '@/lib/heritage-museum/museum-state';
import type { CollectionSource } from '@/lib/heritage-museum/use-heritage-collection';
import { isCuratedResourceIri, resourceIriToDetailHref } from '@/lib/provenance';
import { recordRef } from '@/lib/stories/build-story';
import { cn } from '@/lib/utils';

import { NODE_TYPE_CONFIG, type GraphNode } from '../../heritage-data';
import { NodeGlyph } from '../../node-icons';
import { RecordThumb } from '../exhibit/CollectionRail';
import { MiniTimeline, NepalMiniMap } from '../exhibit/MiniViews';
import { coordsOf, heroImageOf, placeOf, sizedImage, useExhibitWords, yearOf, type Connection } from '../exhibit/exhibit-utils';
import { ImageAttribution } from '../ImageAttribution';

/** Edges that put the other record AT this one: what stands, happens or is kept here. */
const HERE_PREDICATES = new Set([
  'has_current_location',
  'P55_has_current_location',
  'located_in',
  'located_at',
  'took_place_at',
  'P7_took_place_at',
  'celebrated_at',
  'held_at',
  'performed_at',
  'housed_in',
  'based_in',
]);

export interface TourState {
  k: number;
  n: number;
  onPrev: () => void;
  onNext: () => void;
  onEnd: () => void;
}

interface RecordPanelProps {
  node: GraphNode;
  allNodes: GraphNode[];
  connections: Connection[];
  /** Located records by id, for distances and "show on map". */
  placeById: Map<string, AtlasPlace>;
  nearby: { place: AtlasPlace; km: number }[];
  altitude: number | null;
  source: CollectionSource;
  lens: Lens;
  onLens: (lens: Lens) => void;
  onSelect: (node: GraphNode) => void;
  onShowConnectionsOnMap: () => void;
  tour: TourState | null;
}

function Section({ id, title, action, children }: { id: string; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-2.5 border-t border-story-rule pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={id} className="text-[11px] font-bold tracking-[0.14em] text-story-ink uppercase">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function LensLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="cursor-pointer text-xs font-semibold text-story-accent underline-offset-4 hover:underline">
      {children} →
    </button>
  );
}

function Photo({ node }: { node: GraphNode }) {
  const tx = useTranslations('heritageMuseum.exhibit');
  const original = heroImageOf(node);
  const [stage, setStage] = useState(0);
  useEffect(() => setStage(0), [original]);
  const credit = original ? node.imageCredits?.[original] : undefined;
  const cfg = NODE_TYPE_CONFIG[node.nodeType];
  if (!original || stage >= 2) {
    return (
      <figure className="m-0 grid aspect-[3/2] place-items-center gap-1.5 border border-story-rule bg-story-panel text-xs text-story-ink-soft">
        <span className="grid size-8 place-items-center rounded-full" style={{ background: cfg?.color }}>
          <NodeGlyph nodeType={node.nodeType} size={16} color="var(--node-glyph)" />
        </span>
        {tx('noPhoto')}
      </figure>
    );
  }
  return (
    <figure className="m-0 border border-story-rule bg-story-panel">
      <div className="flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote, credited per file */}
        <img
          key={stage}
          src={stage === 0 ? sizedImage(original, 800) : original}
          alt={tx('photoAlt', { name: node.label })}
          onError={() => setStage((s) => s + 1)}
          className="block h-auto max-h-[240px] w-auto max-w-full object-contain"
        />
      </div>
      {credit ? (
        <figcaption className="border-t border-story-rule px-2.5 py-1.5">
          <ImageAttribution credit={credit} variant="onSurface" className="text-[11px]" />
        </figcaption>
      ) : null}
    </figure>
  );
}

/**
 * Everything about the open record that is not the exhibit itself: where it is
 * and how high, when it dates from, what is at it, what it connects to and how
 * far away, what is near, and what its content rests on. It merges what the
 * museum's context column and the atlas's place panel each knew half of.
 */
export function RecordPanel({
  node,
  allNodes,
  connections,
  placeById,
  nearby,
  altitude,
  source,
  lens,
  onLens,
  onSelect,
  onShowConnectionsOnMap,
  tour,
}: RecordPanelProps) {
  const t = useTranslations('heritageMuseum.exhibit');
  const tp = useTranslations('heritageMuseum.panel');
  const tr = useTranslations('heritageMuseum.record');
  const { t: ta, eraName, km } = useAtlasWords();
  const words = useExhibitWords();
  const cfg = NODE_TYPE_CONFIG[node.nodeType];
  const c = coordsOf(node);
  const y = yearOf(node);
  const place = placeOf(connections);
  const self = placeById.get(node.id);
  const here = connections.filter((x) => x.direction === 'in' && HERE_PREDICATES.has(x.predicate));
  const rest = connections.filter((x) => !here.includes(x));
  const linkedLocated = connections.some((x) => placeById.has(x.other.id));
  const ref = isCuratedResourceIri(node.id) ? recordRef(node.id) : null;
  const storyHref = source === 'live' && ref && connections.length >= 2 ? `/stories/${ref.segment}/${ref.pk}` : null;
  const detailHref = resourceIriToDetailHref(node.id);
  const lede = node.significance || node.description;
  const tier = source === 'live' ? provenanceTier(node.recordSource) : null;
  const qid = wikidataIdIn(node.recordSource?.citation);
  const dated = allNodes.some((n) => yearOf(n) != null);

  const distanceTo = (other: GraphNode) => {
    const p = placeById.get(other.id);
    if (!self || !p) return null;
    const d = distanceKm(self, p);
    return d < 1 ? ta('sameSpot') : ta('away', { distance: km(d) });
  };

  const row = (x: Connection) => {
    const d = distanceTo(x.other);
    const p = x.provenance;
    return (
      <li key={`${x.direction}-${x.predicate}-${x.other.id}`}>
        <button
          type="button"
          onClick={() => onSelect(x.other)}
          className="grid w-full cursor-pointer grid-cols-[34px_minmax(0,1fr)] items-center gap-2.5 px-1 py-1.5 text-left hover:bg-story-panel"
        >
          <RecordThumb node={x.other} size="sm" />
          <span className="min-w-0">
            <span className="block text-[11.5px] text-story-accent">{words.relation(x)}</span>
            <span className="block text-[13.5px] leading-tight font-semibold">{x.other.label}</span>
            {x.other.labelNe ? (
              <span lang="ne" className="block font-devanagari text-xs">
                {x.other.labelNe}
              </span>
            ) : null}
            <span className="block text-[11px] text-story-ink-soft">
              {[d, source === 'live' && p?.source ? tp('provSource', { value: p.source }) : null].filter(Boolean).join(' · ')}
            </span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="grid content-start gap-4 text-story-ink">
      {tour ? (
        <div role="group" aria-label={ta('tourTitle')} className="grid gap-2 border border-story-accent bg-story-paper px-3 py-2.5">
          <p className="text-[12.5px]">
            <b className="font-semibold text-story-accent">{ta('tourTitle')}</b> · {ta('tourStop', { k: tour.k + 1, n: tour.n })}
          </p>
          <div className="flex flex-wrap gap-1.5 text-sm font-semibold">
            <button type="button" onClick={tour.onPrev} disabled={tour.k === 0} className="cursor-pointer border border-story-rule px-2.5 py-1 disabled:opacity-40">
              ← {ta('tourPrev')}
            </button>
            <button
              type="button"
              onClick={tour.onNext}
              disabled={tour.k === tour.n - 1}
              className="cursor-pointer bg-story-accent px-2.5 py-1 text-story-accent-ink disabled:opacity-40"
            >
              {ta('tourNext')} →
            </button>
            <button type="button" onClick={tour.onEnd} className="ml-auto cursor-pointer px-1 underline underline-offset-4">
              {ta('tourEnd')}
            </button>
          </div>
        </div>
      ) : null}

      {lens !== 'exhibit' ? (
        <div className="grid gap-2.5">
          <Photo node={node} />
          <div className="grid gap-1">
            <Eyebrow>
              {cfg?.label}
              {y != null ? ` · ${words.year(y)}` : ''}
            </Eyebrow>
            <h2 className="text-[1.65rem] leading-[1.05] font-extrabold tracking-tight">{node.label}</h2>
            {node.labelNe ? <Nepali className="text-base">{node.labelNe}</Nepali> : null}
            {lede ? <p className="pt-1 text-sm leading-relaxed">{lede}</p> : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 text-sm font-semibold">
        {lens !== 'exhibit' ? (
          <button type="button" onClick={() => onLens('exhibit')} className="cursor-pointer bg-story-ink px-3 py-1.5 text-story-paper hover:brightness-125">
            {tr('openExhibit')}
          </button>
        ) : null}
        {storyHref ? (
          <Link href={storyHref} className="inline-flex items-center gap-1.5 bg-story-accent px-3 py-1.5 text-story-accent-ink hover:brightness-110">
            <IconBook2 className="size-4" aria-hidden />
            {tr('readStory')}
          </Link>
        ) : null}
        {linkedLocated ? (
          <button
            type="button"
            onClick={onShowConnectionsOnMap}
            className="inline-flex cursor-pointer items-center gap-1.5 border border-story-rule px-3 py-1.5 hover:bg-story-panel"
          >
            <IconRoute className="size-4" aria-hidden />
            {ta('showConnections')}
          </button>
        ) : null}
        {detailHref ? (
          <Link href={detailHref} className="inline-flex items-center gap-1.5 border border-story-rule px-3 py-1.5 hover:bg-story-panel">
            <IconExternalLink className="size-4" aria-hidden />
            {ta('knowledgeRecord')}
          </Link>
        ) : null}
      </div>

      <Section id="rp-where" title={t('where')} action={c && lens !== 'map' ? <LensLink onClick={() => onLens('map')}>{t('openMap')}</LensLink> : undefined}>
        <NepalMiniMap nodes={allNodes} selectedId={node.id} />
        {c ? (
          <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[13px]">
            <dt className="text-story-ink-soft">{ta('location')}</dt>
            <dd className="m-0">
              {c.lat.toFixed(4)}° N, {c.lon.toFixed(4)}° E
            </dd>
            {place ? (
              <>
                <dt className="text-story-ink-soft">{tr('in')}</dt>
                <dd className="m-0">{place.label}</dd>
              </>
            ) : null}
            {self ? (
              <>
                <dt className="text-story-ink-soft">{tr('region')}</dt>
                <dd className="m-0">{self.inValley ? ta('regionValley') : ta('regionNepal')}</dd>
              </>
            ) : null}
            {altitude != null ? (
              <>
                <dt className="text-story-ink-soft">{ta('altitude')}</dt>
                <dd className="m-0">{ta('altitudeValue', { metres: roundAltitude(altitude).toLocaleString() })}</dd>
              </>
            ) : null}
          </dl>
        ) : (
          <p className="text-[13px] text-story-ink-soft">{t('noLocation')}</p>
        )}
      </Section>

      <Section id="rp-when" title={t('when')} action={dated && lens !== 'timeline' ? <LensLink onClick={() => onLens('timeline')}>{t('openTimeline')}</LensLink> : undefined}>
        <MiniTimeline nodes={allNodes} selectedId={node.id} />
        <p className="text-[13px]">
          {y != null ? (
            <>
              {words.year(y)} · {eraName(eraOf(y))}
            </>
          ) : (
            <span className="text-story-ink-soft">{t('noDate')}</span>
          )}
        </p>
      </Section>

      {here.length ? (
        <Section id="rp-here" title={ta('atThisPlace', { count: here.length })}>
          <ul className="m-0 grid list-none gap-0.5 p-0">{here.map(row)}</ul>
        </Section>
      ) : null}

      <Section
        id="rp-connected"
        title={t('connected', { count: rest.length })}
        action={connections.length && lens !== 'connections' ? <LensLink onClick={() => onLens('connections')}>{t('openGraph')}</LensLink> : undefined}
      >
        {rest.length ? <ul className="m-0 grid list-none gap-0.5 p-0">{rest.map(row)}</ul> : <p className="text-[13px] text-story-ink-soft">{t('noConnections')}</p>}
      </Section>

      {c ? (
        <Section id="rp-nearby" title={ta('nearby', { count: nearby.length })}>
          {nearby.length ? (
            <ul className="m-0 grid list-none gap-0.5 p-0">
              {nearby.map(({ place: p, km: d }) => (
                <li key={p.node.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(p.node)}
                    className="grid w-full cursor-pointer grid-cols-[34px_minmax(0,1fr)] items-center gap-2.5 px-1 py-1.5 text-left hover:bg-story-panel"
                  >
                    <RecordThumb node={p.node} size="sm" />
                    <span className="min-w-0">
                      <span className="block text-[11.5px] text-story-ink-soft">{km(d)}</span>
                      <span className="block text-[13.5px] leading-tight font-semibold">{p.node.label}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-story-ink-soft">{ta('noNearby')}</p>
          )}
        </Section>
      ) : null}

      <Section id="rp-sources" title={tr('sources')}>
        {source === 'demo' ? (
          <p className="text-[13px] leading-relaxed">{tr('demoSources')}</p>
        ) : node.recordSource ? (
          <div className="grid gap-1 text-[13px]">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{node.recordSource.name ?? (tier ? tp(`tier.${tier}`) : '')}</span>
              {tier ? (
                <span className={cn('border px-1.5 py-0.5 text-[11px] font-medium', tier === 'reviewed' ? 'border-story-accent bg-story-accent text-story-accent-ink' : 'border-story-accent text-story-accent')}>
                  {tp(`tier.${tier}`)}
                </span>
              ) : null}
            </p>
            {(node.recordSource.citation ?? '')
              .split('\n')
              .filter(Boolean)
              .map((line) => (
                <p key={line} className="text-xs text-story-ink-soft">
                  {line}
                </p>
              ))}
            {qid ? (
              <a href={`https://www.wikidata.org/wiki/${qid}`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold underline underline-offset-4">
                Wikidata {qid} ↗
              </a>
            ) : null}
          </div>
        ) : (
          <p className="text-[13px] text-story-ink-soft">{tr('noSource')}</p>
        )}
        <Link href="/contribute" className="text-xs font-semibold text-story-accent underline underline-offset-4">
          {tr('suggest')} →
        </Link>
      </Section>
    </div>
  );
}
