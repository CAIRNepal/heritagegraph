'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Bookmark, CalendarClock, Compass, ImageIcon, ScrollText, Waypoints, X } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ImageCredit } from '@/components/knowledge/image-credit';
import { museumStoryHrefForNode } from '@/lib/cross-surface-links';
import { cn } from '@/lib/utils';
import type { AtlasEntity } from '@/types/atlas';

import { useAtlasStore } from '../../hooks/use-atlas-store';
import { useAtlasUiStore } from '../../hooks/use-atlas-ui-store';
import { ATLAS_GLASS, formatYear } from '../../lib/atlas-format';
import { AtlasKnowledgeLink } from '../atlas-knowledge-link';
import { ProvenancePanel } from '../provenance-panel';
import { markerStyleForEntity } from '../HeritageGlobe/marker-config';
import { KnowledgeConnections } from './KnowledgeConnections';
import { QuickFacts } from './QuickFacts';

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function SectionHeading({ icon: Icon, children }: { icon: typeof Compass; children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
      <Icon className="h-3 w-3" strokeWidth={1.5} />
      {children}
    </h3>
  );
}

interface EntityDetailsContentProps {
  entity: AtlasEntity;
  onClose: () => void;
}

/** Full entity dossier — shared between the desktop sidebar and mobile sheet. */
export function EntityDetailsContent({ entity, onClose }: EntityDetailsContentProps) {
  const t = useTranslations('Atlas');
  const getProvenanceSummary = useAtlasStore((s) => s.getProvenanceSummary);
  const entities = useAtlasStore((s) => s.entities);
  const selectEntity = useAtlasStore((s) => s.selectEntity);
  const sources = useAtlasStore((s) => s.sources);
  const dataSource = useAtlasStore((s) => s.dataSource);

  const bookmarkIds = useAtlasUiStore((s) => s.bookmarkIds);
  const toggleBookmark = useAtlasUiStore((s) => s.toggleBookmark);
  const bookmarked = bookmarkIds.includes(entity.id);

  const provenance = getProvenanceSummary(entity.id);
  // Reciprocal of the Museum's "view on globe": both surfaces hydrate live mode
  // from the same /kg/graph/ response and keep the node id verbatim.
  const storyHref = museumStoryHrefForNode(entity.id, dataSource);
  const style = markerStyleForEntity(entity);
  const gallery = (entity.images ?? []).filter((u) => u !== entity.imageUrl).slice(0, 6);
  const events = [...entity.events].sort((a, b) => a.year - b.year);

  // Discovery: nearby sites in the same category (graph-adjacent exploration).
  const nearby = useMemo(() => {
    if (entity.lat == null || entity.lon == null) return [];
    return entities
      .filter(
        (e) =>
          e.id !== entity.id &&
          e.lat != null &&
          e.lon != null &&
          markerStyleForEntity(e).id === style.id,
      )
      .map((e) => ({
        entity: e,
        km: haversineKm(entity.lat!, entity.lon!, e.lat!, e.lon!),
      }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 3);
  }, [entities, entity, style.id]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Hero */}
      <div className="relative shrink-0">
        {entity.imageUrl ? (
          <div className="relative h-44 w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote KG media */}
            <img src={entity.imageUrl} alt={entity.name} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/35 to-transparent" />
          </div>
        ) : (
          <div
            className="h-24 w-full"
            style={{
              background: `radial-gradient(120% 160% at 50% -30%, ${style.color}33, transparent 70%)`,
            }}
          />
        )}
        <div className="absolute right-2 top-2 flex gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this site'}
            aria-pressed={bookmarked}
            className="h-8 w-8 rounded-xl bg-black/30 text-white backdrop-blur-md hover:bg-black/50 hover:text-white"
            onClick={() => toggleBookmark(entity.id)}
          >
            <Bookmark className={cn('h-4 w-4', bookmarked && 'fill-current')} strokeWidth={1.5} />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Close details"
            className="h-8 w-8 rounded-xl bg-black/30 text-white backdrop-blur-md hover:bg-black/50 hover:text-white"
            onClick={onClose}
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </div>
        <div className={cn('px-4', entity.imageUrl ? 'absolute inset-x-0 bottom-2' : '-mt-12')}>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide backdrop-blur-md"
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.color }} />
            {entity.class}
          </span>
          <h2 className="mt-1 text-lg font-semibold leading-tight tracking-tight">{entity.name}</h2>
          {entity.nameNe ? (
            <p className="text-[12px] text-muted-foreground">{entity.nameNe}</p>
          ) : null}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 px-4 pb-4 pt-3">
          <QuickFacts entity={entity} provenance={provenance} />

          <p className="text-[13px] leading-relaxed text-foreground/90">{entity.summary}</p>
          {entity.imageUrl ? (
            <ImageCredit credit={entity.imageCredits?.[entity.imageUrl]} />
          ) : null}

          <section className="space-y-2">
            <SectionHeading icon={Waypoints}>Knowledge graph</SectionHeading>
            <KnowledgeConnections entity={entity} />
          </section>

          {events.length > 0 ? (
            <section className="space-y-2">
              <SectionHeading icon={CalendarClock}>Timeline</SectionHeading>
              <ol className="relative space-y-2.5 border-l border-border/50 pl-4">
                {events.map((ev) => (
                  <li key={`${ev.year}-${ev.kind}-${ev.description.slice(0, 12)}`} className="relative">
                    <span
                      className="absolute -left-[21.5px] top-1.5 h-2 w-2 rounded-full border border-background"
                      style={{ backgroundColor: style.color }}
                    />
                    <p className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      {formatYear(ev.year)} · {ev.kind}
                    </p>
                    <p className="text-[12px] leading-snug">{ev.description}</p>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {gallery.length > 0 ? (
            <section className="space-y-2">
              <SectionHeading icon={ImageIcon}>Media</SectionHeading>
              <div className="grid grid-cols-3 gap-1.5">
                {gallery.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- remote KG media */}
                    <img
                      src={url}
                      alt=""
                      loading="lazy"
                      className="aspect-square w-full rounded-xl object-cover transition-transform hover:scale-[1.03]"
                    />
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          {entity.assertions.length > 0 ? (
            <section className="space-y-2">
              <SectionHeading icon={ScrollText}>Provenance & evidence</SectionHeading>
              <ProvenancePanel assertions={entity.assertions} sources={sources} />
            </section>
          ) : null}

          {nearby.length > 0 ? (
            <section className="space-y-2">
              <SectionHeading icon={Compass}>Discover nearby</SectionHeading>
              <div className="space-y-1">
                {nearby.map(({ entity: e, km }) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => selectEntity(e.id)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left transition-colors hover:bg-muted/40"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{e.name}</span>
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      {km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 20 ? 1 : 0)} km`}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </ScrollArea>

      <div className="flex shrink-0 items-center gap-2 border-t border-border/40 px-4 py-3">
        <AtlasKnowledgeLink entity={entity} className="h-8 flex-1 rounded-xl text-[12px]" />
        {storyHref ? (
          <Button asChild variant="outline" size="sm" className="h-8 rounded-xl text-[12px]">
            <Link href={storyHref}>
              <ScrollText className="mr-1 h-3.5 w-3.5" aria-hidden />
              {t('readTheStory')}
            </Link>
          </Button>
        ) : null}
        {entity.sourceLayer === 'lux' && entity.externalUri ? (
          <Button asChild variant="outline" size="sm" className="h-8 rounded-xl text-[12px]">
            <a href={entity.externalUri} target="_blank" rel="noopener noreferrer">
              Yale LUX
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Right-hand entity panel — slides in from the right on selection (desktop). */
export function EntitySidebar() {
  const selectedId = useAtlasStore((s) => s.selectedId);
  const getEntityById = useAtlasStore((s) => s.getEntityById);
  const selectEntity = useAtlasStore((s) => s.selectEntity);
  const storyActive = useAtlasUiStore((s) => s.story.active);

  const entity = selectedId ? getEntityById(selectedId) : undefined;
  const open = entity != null && !storyActive;

  return (
    <AnimatePresence>
      {open && entity ? (
        <motion.aside
          key={entity.id}
          initial={{ opacity: 0, x: 48 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 48 }}
          transition={{ type: 'spring', stiffness: 340, damping: 34 }}
          aria-label="Entity details"
          className={cn(
            ATLAS_GLASS,
            'pointer-events-auto absolute bottom-28 right-4 top-4 z-30 hidden w-[360px] flex-col overflow-hidden md:flex',
          )}
        >
          <EntityDetailsContent entity={entity} onClose={() => selectEntity(null)} />
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
