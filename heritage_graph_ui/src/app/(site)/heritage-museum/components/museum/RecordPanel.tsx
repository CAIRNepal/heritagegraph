'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { IconBook2, IconExternalLink, IconRoute } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
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
    <section aria-labelledby={id} className="grid gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={id} className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
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
    <button type="button" onClick={onClick} className="cursor-pointer py-1 text-[12.5px] font-medium text-primary hover:underline">
      {children}
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
      <figure className="m-0 grid aspect-[3/2] place-items-center gap-1.5 rounded-xl border border-border bg-muted text-[12.5px] text-muted-foreground">
        <span className="grid size-8 place-items-center rounded-full" style={{ background: cfg?.color }}>
          <NodeGlyph nodeType={node.nodeType} size={16} color="var(--node-glyph)" />
        </span>
        {tx('noPhoto')}
      </figure>
    );
  }
  return (
    <figure className="m-0 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex justify-center bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote, credited per file */}
        <img
          key={stage}
          src={stage === 0 ? sizedImage(original, 800) : original}
          alt={tx('photoAlt', { name: node.label })}
          onError={() => setStage((s) => s + 1)}
          className="block h-auto max-h-[260px] w-auto max-w-full object-contain"
        />
      </div>
      {credit ? (
        <figcaption className="border-t border-border px-3 py-1.5">
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
  // A borrowed point is the containing record's; say so instead of printing it as this one's.
  const borrowedFrom = node.coordinateSource === 'inherited' ? allNodes.find((n) => n.id === node.coordinateFrom) ?? null : null;
  const c = node.coordinateSource === 'inherited' ? null : coordsOf(node);
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
          className="grid w-full cursor-pointer grid-cols-[34px_minmax(0,1fr)] items-center gap-2.5 rounded-lg px-1 py-1.5 text-left hover:bg-background"
        >
          <RecordThumb node={x.other} size="sm" />
          <span className="min-w-0">
            <span className="block text-[11.5px] text-muted-foreground">{words.relation(x)}</span>
            <span className="block text-[13.5px] leading-tight font-medium text-foreground">{x.other.label}</span>
            {x.other.labelNe ? (
              <span lang="ne" className="block font-devanagari text-xs">
                {x.other.labelNe}
              </span>
            ) : null}
            <span className="block text-[11px] text-muted-foreground">
              {[d, source === 'live' && p?.source ? tp('provSource', { value: p.source }) : null].filter(Boolean).join(' · ')}
            </span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="grid content-start gap-3.5 text-foreground">
      {tour ? (
        <div role="group" aria-label={ta('tourTitle')} className="grid gap-2 rounded-xl border border-primary bg-card px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 text-[12.5px]">
            <span>
              <b className="font-semibold text-primary">{ta('tourTitle')}</b> · {ta('tourStop', { k: tour.k + 1, n: tour.n })}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={tour.onEnd}>
              {ta('tourEnd')}
            </Button>
          </div>
          <div className="flex gap-1.5">
            <Button type="button" variant="outline" size="sm" onClick={tour.onPrev} disabled={tour.k === 0}>
              ← {ta('tourPrev')}
            </Button>
            <Button type="button" size="sm" onClick={tour.onNext} disabled={tour.k === tour.n - 1}>
              {ta('tourNext')} →
            </Button>
          </div>
        </div>
      ) : null}

      {lens !== 'exhibit' ? (
        <div className="grid gap-2.5">
          <Photo node={node} />
          <div className="grid gap-1.5">
            <h2 className="font-serif text-[1.75rem] leading-[1.08] text-foreground">{node.label}</h2>
            {node.labelNe ? (
              <p lang="ne" className="font-devanagari text-base text-foreground">
                {node.labelNe}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[13.5px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <span className="size-[9px] rounded-full" style={{ background: cfg?.color }} aria-hidden />
                {cfg?.label}
              </span>
              {y != null ? <span>{words.year(y)}</span> : null}
            </div>
            {lede ? <p className="font-serif text-base leading-normal text-foreground">{lede}</p> : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {lens !== 'exhibit' ? (
          <Button type="button" size="sm" onClick={() => onLens('exhibit')}>
            {tr('openExhibit')}
          </Button>
        ) : null}
        {storyHref ? (
          <Button asChild variant="outline" size="sm">
            <Link href={storyHref}>
              <IconBook2 className="size-3.5" aria-hidden />
              {tr('readStory')}
            </Link>
          </Button>
        ) : null}
        {linkedLocated ? (
          <Button type="button" variant="outline" size="sm" onClick={onShowConnectionsOnMap}>
            <IconRoute className="size-3.5" aria-hidden />
            {ta('showConnections')}
          </Button>
        ) : null}
        {detailHref ? (
          <Button asChild variant="outline" size="sm">
            <Link href={detailHref}>
              <IconExternalLink className="size-3.5" aria-hidden />
              {ta('knowledgeRecord')}
            </Link>
          </Button>
        ) : null}
      </div>

      <Section id="rp-where" title={t('where')} action={c && lens !== 'map' ? <LensLink onClick={() => onLens('map')}>{t('openMap')}</LensLink> : undefined}>
        <NepalMiniMap nodes={allNodes} selectedId={node.id} />
        {c ? (
          <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[13px]">
            <dt className="text-muted-foreground">{ta('location')}</dt>
            <dd className="m-0">
              {c.lat.toFixed(4)}° N, {c.lon.toFixed(4)}° E
            </dd>
            {place ? (
              <>
                <dt className="text-muted-foreground">{tr('in')}</dt>
                <dd className="m-0">{place.label}</dd>
              </>
            ) : null}
            {self ? (
              <>
                <dt className="text-muted-foreground">{tr('region')}</dt>
                <dd className="m-0">{self.inValley ? ta('regionValley') : ta('regionNepal')}</dd>
              </>
            ) : null}
            {altitude != null ? (
              <>
                <dt className="text-muted-foreground">{ta('altitude')}</dt>
                <dd className="m-0">{ta('altitudeValue', { metres: roundAltitude(altitude).toLocaleString() })}</dd>
              </>
            ) : null}
          </dl>
        ) : borrowedFrom ? (
          <p className="text-[13px]">
            <span className="text-muted-foreground">{tr('noOwnLocation')} </span>
            <button type="button" onClick={() => onSelect(borrowedFrom)} className="cursor-pointer font-medium text-primary hover:underline">
              {tr('within', { place: borrowedFrom.label })}
            </button>
          </p>
        ) : (
          <p className="text-[13px] text-muted-foreground">{t('noLocation')}</p>
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
            <span className="text-muted-foreground">{t('noDate')}</span>
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
        {rest.length ? <ul className="m-0 grid list-none gap-0.5 p-0">{rest.map(row)}</ul> : <p className="text-[13px] text-muted-foreground">{t('noConnections')}</p>}
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
                    className="grid w-full cursor-pointer grid-cols-[34px_minmax(0,1fr)] items-center gap-2.5 rounded-lg px-1 py-1.5 text-left hover:bg-background"
                  >
                    <RecordThumb node={p.node} size="sm" />
                    <span className="min-w-0">
                      <span className="block text-[11.5px] text-muted-foreground">{km(d)}</span>
                      <span className="block text-[13.5px] leading-tight font-medium text-foreground">{p.node.label}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted-foreground">{ta('noNearby')}</p>
          )}
        </Section>
      ) : null}

      <Section id="rp-sources" title={tr('sources')}>
        {source === 'demo' ? (
          <p className="text-[13px] leading-relaxed">{tr('demoSources')}</p>
        ) : node.recordSource ? (
          <div className="grid gap-1 text-[13px]">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{node.recordSource.name ?? (tier ? tp(`tier.${tier}`) : '')}</span>
              {tier ? (
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', tier === 'reviewed' ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary')}>
                  {tp(`tier.${tier}`)}
                </span>
              ) : null}
            </p>
            {(node.recordSource.citation ?? '')
              .split('\n')
              .filter(Boolean)
              .map((line) => (
                <p key={line} className="text-xs text-muted-foreground">
                  {line}
                </p>
              ))}
            {qid ? (
              <a href={`https://www.wikidata.org/wiki/${qid}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary hover:underline">
                Wikidata {qid} ↗
              </a>
            ) : null}
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">{tr('noSource')}</p>
        )}
        <Link href="/contribute" className="text-xs font-medium text-primary hover:underline">
          {tr('suggest')} →
        </Link>
      </Section>
    </div>
  );
}
