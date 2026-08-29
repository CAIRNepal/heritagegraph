'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { IconExternalLink, IconShieldCheck, IconWorld } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { atlasHrefForNode } from '@/lib/cross-surface-links';
import { unescoStatementForLabel } from '@/lib/unesco/status';
import { subjectKeyForNodeId } from '@/lib/unesco/facts';
import { SourcedFacts, SubjectDescription } from '@/components/unesco/SourcedFacts';
import {
  isCuratedResourceIri,
  resourceIriToDetailHref,
} from '@/lib/provenance';

import {
  NODE_TYPE_CONFIG,
  RELATION_LABELS,
  type GraphNode,
  type GraphData,
  type RelationProvenance,
} from '../heritage-data';
import { MediaViewer } from './MediaViewer';
import { NodeGlyph } from '../node-icons';
import type { MuseumDataSource, MuseumViewMode } from './museum-toolbar';

interface StoryPanelProps {
  node: GraphNode | null;
  graphData: GraphData;
  onRelatedNodeClick: (nodeId: string) => void;
  dataSource?: MuseumDataSource;
  viewMode?: MuseumViewMode;
  onBrowseStories?: () => void;
}

export function StoryPanel({
  node,
  graphData,
  onRelatedNodeClick,
  dataSource = 'demo',
  viewMode = '2d',
  onBrowseStories,
}: StoryPanelProps) {
  const isSampleNarrative = dataSource === 'demo';
  const t = useTranslations('heritageMuseum.panel');
  const tUnesco = useTranslations('unescoEntry');
  const unescoStatement = unescoStatementForLabel(node?.label);
  const unescoSubjectKey = subjectKeyForNodeId(node?.id);
  const scrollRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = scrollRootRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]',
    ) as HTMLElement | null;
    if (viewport) viewport.scrollTop = 0;
  }, [node?.id]);

  if (!node) {
    const emptyBody =
      viewMode === 'map' ? t('emptyBodyMap') : t('emptyBodyConnections');
    return (
      <ScrollArea className="h-full min-h-0" ref={scrollRootRef}>
        <div className="flex min-h-[min(100%,20rem)] flex-col items-center justify-center gap-4 px-8 py-8 text-center">
          <p className="text-primary font-semibold text-lg">{t('emptyTitle')}</p>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">{emptyBody}</p>
          {onBrowseStories ? (
            <Button type="button" variant="outline" size="sm" className="text-xs" onClick={onBrowseStories}>
              {t('browseStories')}
            </Button>
          ) : null}
        </div>
      </ScrollArea>
    );
  }

  const cfg = NODE_TYPE_CONFIG[node.nodeType];
  const detailHref = resourceIriToDetailHref(node.id);
  const showReviewed =
    dataSource === 'live' && isCuratedResourceIri(node.id);
  // Only offered when this surface already knows the coordinates: Atlas is
  // place-first, so linking an entity it cannot place would land the reader on
  // the globe with nothing selected.
  const globeHref =
    node.lat != null && node.long != null
      ? atlasHrefForNode(node.id, dataSource)
      : null;

  const relatedNodes = node.relations
    .map((r) => ({ rel: r, rn: graphData.nodes.find((n) => n.id === r.targetId) }))
    .filter((x) => x.rn !== undefined);

  const grouped = relatedNodes.reduce<
    Record<string, Array<{ node: GraphNode; provenance?: RelationProvenance | null }>>
  >((acc, { rel, rn }) => {
    if (!rn) return acc;
    if (!acc[rel.predicate]) acc[rel.predicate] = [];
    acc[rel.predicate].push({ node: rn, provenance: rel.provenance });
    return acc;
  }, {});

  return (
    <ScrollArea className="h-full min-h-0" ref={scrollRootRef}>
    <div className="min-h-0">
      {/* Hero image + narration */}
      <MediaViewer node={node} />

      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 px-6 py-5 border-b border-border"
        style={{
          background: `linear-gradient(135deg, ${cfg.color}22 0%, var(--card) 100%)`,
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: `radial-gradient(circle at 35% 35%, ${cfg.glowColor}, ${cfg.color})`,
              boxShadow: `0 0 20px ${cfg.color}66`,
            }}
          >
            <NodeGlyph nodeType={node.nodeType} size={26} color="var(--node-glyph)" title={cfg.label} />
          </div>
          <div className="min-w-0">
            <span
              className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-1"
              style={{ background: `${cfg.color}33`, color: cfg.glowColor }}
            >
              {cfg.label}
            </span>
            <h2 className="text-foreground font-bold text-lg leading-tight">{node.label}</h2>
            {showReviewed ? (
              <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-medium text-primary">
                <IconShieldCheck className="w-3.5 h-3.5" aria-hidden />
                {t('reviewedBadge')}
              </span>
            ) : null}
            {detailHref ? (
              <Button
                asChild
                variant="link"
                size="sm"
                className="h-auto p-0 mt-1 text-xs text-primary"
              >
                <Link href={detailHref}>
                  {t('openRecord')}
                  <IconExternalLink className="w-3 h-3 ml-1 inline" aria-hidden />
                </Link>
              </Button>
            ) : null}
            {globeHref ? (
              <Button
                asChild
                variant="link"
                size="sm"
                className="h-auto p-0 mt-1 ml-3 text-xs text-primary"
              >
                <Link href={globeHref}>
                  {t('viewOnGlobe')}
                  <IconWorld className="w-3 h-3 ml-1 inline" aria-hidden />
                </Link>
              </Button>
            ) : null}
            {/*
              Derived from ground truth, never from `node.unescoStatus`. That
              field labels Nyatapola Temple and the city of Bhaktapur as World
              Heritage Sites — neither is a monument zone — and frames the real
              zones as separate Sites rather than zones of one serial property.
              A record with no defensible status renders nothing.
            */}
            {unescoStatement ? (
              <div className="mt-1 flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-full bg-primary" aria-hidden="true" />
                <span className="text-xs text-primary">
                  {unescoStatement.kind === 'monumentZone'
                    ? tUnesco('statusMonumentZone', { year: unescoStatement.year })
                    : tUnesco('statusProperty', { year: unescoStatement.year })}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Meta chips */}
        <div className="flex flex-wrap gap-2 mt-3">
          {node.religion      && <Chip label={node.religion}                  icon="🕉"  color="var(--chart-4)" />}
          {node.dynasty       && <Chip label={t('dynasty', { name: node.dynasty })}      icon="👑"  color="var(--chart-2)" />}
          {node.inceptionYear && <Chip label={t('inception', { year: node.inceptionYear })}  icon="📅"  color="var(--chart-3)" />}
          {node.period        && <Chip label={node.period}                     icon="🗓"  color="var(--chart-1)" />}
          {node.ethnicity     && <Chip label={node.ethnicity}                  icon="🎨"  color="var(--chart-5)" />}
        </div>
      </div>

      {/* Content — sourced facts first, then narrative.
          A record like Hanuman Dhoka Durbar Square has no citable prose at all;
          what it does have is structured, referenced data. Leading with the
          part a reader can verify, rather than with an apology for the part
          they cannot, is the honest ordering — and it is the difference between
          a record that looks empty and one that says something. */}
      <div className="px-6 py-5 space-y-6">
        {unescoSubjectKey ? (
          <>
            <SubjectDescription subjectKey={unescoSubjectKey} />
            <SourcedFacts
              subjectKey={unescoSubjectKey}
              className="rounded-lg border border-border bg-muted/30 p-4"
            />
          </>
        ) : null}

        <Section title={t('story')} icon="📖" color={cfg.color}>
          {node.storyText?.trim() ? (
            <p className="whitespace-pre-line text-sm leading-7 text-foreground">{node.storyText}</p>
          ) : (
            /* Some records carry no narrative — nothing could be sourced for
               them. Say so, rather than rendering an empty panel that reads as
               a loading failure. */
            <p className="text-sm italic leading-7 text-muted-foreground">
              {t('noNarrativeRecorded')}
            </p>
          )}
          {isSampleNarrative ? (
            <p className="mt-3 rounded-lg border border-warning/50 bg-warning-soft p-2.5 text-[11px] leading-snug text-warning-on-soft">
              {/*
                No outbound Wikipedia link. Sending a reader off-site to check a
                claim we are already telling them not to trust is not a fix for
                the claim — and the caution below stands on its own. Everything
                a reader should follow from here leads further into the graph.
              */}
              {t('sampleNarrative')}
            </p>
          ) : null}
        </Section>

        {node.description && node.description !== node.storyText ? (
          <p className="text-foreground/90 text-sm leading-relaxed">{node.description}</p>
        ) : null}

        {node.keyFacts && node.keyFacts.length > 0 && (
          <Section title={t('keyFacts')} icon="📋" color={cfg.color}>
            <div className="grid grid-cols-1 gap-1.5">
              {node.keyFacts.map((f, i) => (
                <div key={i} className="flex items-baseline gap-2 text-xs rounded-lg px-3 py-2 bg-muted/40 border border-border">
                  <span className="text-muted-foreground shrink-0 w-28 truncate">{f.label}</span>
                  <span className="text-foreground font-medium">{f.value}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        <details className="rounded-xl border border-border bg-muted/30 group">
          <summary className="cursor-pointer list-none px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
            {t('recordDetails')}
            <span className="ml-auto text-muted-foreground/70 normal-case tracking-normal font-normal group-open:hidden">
              {t('recordDetailsShow')}
            </span>
          </summary>
          <div className="px-4 pb-4 space-y-1.5 border-t border-border pt-3">
            <div className="flex items-start gap-2 text-xs">
              <span className="text-muted-foreground shrink-0 w-24">{t('hgClass')}</span>
              <code className="text-[11px] px-1.5 py-0.5 rounded bg-muted border border-border font-mono break-all" style={{ color: cfg.glowColor }}>
                hg:{node.nodeType}
              </code>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <span className="text-muted-foreground shrink-0 w-24">CIDOC-CRM</span>
              <code className="text-[11px] px-1.5 py-0.5 rounded bg-muted border border-border font-mono break-all text-primary">
                {node.cidocMapping}
              </code>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <span className="text-muted-foreground shrink-0 w-24">{t('category')}</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded border font-medium capitalize"
                style={{ color: cfg.glowColor, borderColor: `${cfg.color}44`, background: `${cfg.color}11` }}>
                {node.hgCategory}
              </span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <span className="text-muted-foreground shrink-0 w-24">{t('namespace')}</span>
              <code className="text-[11px] text-muted-foreground font-mono break-all">
                https://w3id.org/heritagegraph/
              </code>
            </div>
          </div>
        </details>

        <Divider color={cfg.color} />

        {node.history && (
          <Section title={t('history')} icon="⏳" color={cfg.color}>
            <p className="text-foreground/90 text-sm leading-6">{node.history}</p>
          </Section>
        )}

        {node.culturalRole && (
          <Section title={t('culturalRole')} icon="🌐" color={cfg.color}>
            <p className="text-foreground/90 text-sm leading-6">{node.culturalRole}</p>
          </Section>
        )}

        {node.architecture && (
          <Section title={t('architecture')} icon="🏛" color={cfg.color}>
            <p className="text-foreground/90 text-sm leading-6">{node.architecture}</p>
          </Section>
        )}

        {node.significance && (
          <div className="bg-muted/50 rounded-xl p-4 border border-border">
            <h3
              className="text-xs font-semibold uppercase tracking-widest mb-2"
              style={{ color: cfg.glowColor }}
            >
              ✦ {t('significance')}
            </h3>
            <p className="text-foreground/90 text-sm">{node.significance}</p>
          </div>
        )}

        {node.rituals && node.rituals.length > 0 && (
          <Section title={t('rituals')} icon="🙏" color={cfg.color}>
            <ul className="space-y-1.5">
              {node.rituals.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                  {r}
                </li>
              ))}
            </ul>
          </Section>
        )}


        {node.tags && node.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {node.tags.map((tag) => (
              <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-muted/50 border border-border text-muted-foreground">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {node.lat && node.long && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>📍</span>
            <span>{parseFloat(node.lat).toFixed(4)}°N, {parseFloat(node.long).toFixed(4)}°E</span>
            <a
              href={`https://www.openstreetmap.org/?mlat=${node.lat}&mlon=${node.long}&zoom=15`}
              target="_blank" rel="noopener noreferrer"
              className="text-primary hover:underline ml-auto"
            >
              {t('mapLink')}
            </a>
          </div>
        )}

        {Object.keys(grouped).length > 0 && (
          <div>
            <h3
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: cfg.glowColor }}
            >
              🔗 {t('connections')}
            </h3>
            <div className="space-y-3">
              {Object.entries(grouped).map(([pred, entries]) => (
                <div key={pred}>
                  <p className="text-xs text-muted-foreground mb-1.5">
                    {RELATION_LABELS[pred] || pred}
                  </p>
                  <div className="space-y-2">
                    {entries.map(({ node: rn, provenance: relProv }) => {
                      const rcfg = NODE_TYPE_CONFIG[rn.nodeType];
                      return (
                        <div key={rn.id} className="space-y-1">
                          <button
                            type="button"
                            onClick={() => onRelatedNodeClick(rn.id)}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all hover:scale-105 active:scale-95"
                            style={{
                              borderColor: `${rcfg.color}66`,
                              background: `${rcfg.color}11`,
                              color: rcfg.glowColor,
                            }}
                          >
                            <NodeGlyph nodeType={rn.nodeType} size={14} color={rcfg.glowColor} />
                            <span>{rn.label}</span>
                          </button>
                          {relProv ? <ProvenanceBlock prov={relProv} /> : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    </ScrollArea>
  );
}

function Section({ title, icon, color, children }: { title: string; icon: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
        className="text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-1.5"
        style={{ color }}
      >
        <span>{icon}</span> {title}
      </h3>
      {children}
    </div>
  );
}

function Divider({ color }: { color: string }) {
  return (
    <div
      className="h-px w-full"
      style={{ background: `linear-gradient(to right, transparent, ${color}66, transparent)` }}
    />
  );
}

function ProvenanceBlock({ prov }: { prov: RelationProvenance }) {
  const t = useTranslations('heritageMuseum.panel');
  if (!prov.source && !prov.assertedBy && prov.confidenceScore == null && !prov.assertedAt) {
    return null;
  }
  return (
    <div className="rounded-md border border-border/80 bg-muted/30 px-2.5 py-2 text-[10px] text-muted-foreground space-y-0.5">
      <p className="font-semibold uppercase tracking-wide text-foreground/80">{t('provenance')}</p>
      {prov.source ? <p>{t('provSource', { value: prov.source })}</p> : null}
      {prov.confidence || prov.confidenceScore != null ? (
        <p>
          {t('provConfidence', {
            value: prov.confidence ?? String(prov.confidenceScore),
          })}
        </p>
      ) : null}
      {prov.assertedBy ? <p>{t('provAgent', { value: prov.assertedBy })}</p> : null}
      {prov.temporalScope ? <p>{t('provTemporal', { value: prov.temporalScope })}</p> : null}
      {prov.assertedAt ? (
        <p className="font-mono opacity-80">{t('provDate', { value: prov.assertedAt })}</p>
      ) : null}
    </div>
  );
}

function Chip({ label, icon, color }: { label: string; icon: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
      style={{ background: `${color}22`, color }}
    >
      <span>{icon}</span>
      {label}
    </span>
  );
}
