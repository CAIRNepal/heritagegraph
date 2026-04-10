'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  BookOpen,
  ExternalLink,
  Eye,
  FileText,
  Layers,
  MapPin,
  User,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import type { SourceRecord } from './types';

/** Human-readable labels for CIDOC `Source.type` (backend choices + common UI extras). */
export function formatSourceTypeLabel(type?: string): string {
  if (!type?.trim()) return '';
  const map: Record<string, string> = {
    book: 'Book',
    journal: 'Journal Article',
    archive: 'Archive Document',
    thesis: 'Thesis',
    web: 'Web Resource',
    field_note: 'Field Notes',
    oral_history: 'Oral History',
    inscription: 'Inscription',
  };
  return map[type] || type.replace(/_/g, ' ');
}

function nonEmpty(s?: string | null): string | undefined {
  const t = typeof s === 'string' ? s.trim() : '';
  return t.length > 0 ? t : undefined;
}

/** Returns a safe http(s) URL, or null if the value cannot be used as a link. */
export function safeHttpUrl(raw: string | undefined | null): string | null {
  const t = nonEmpty(raw);
  if (!t) return null;
  try {
    const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    const u = new URL(withProto);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase().replace(/\s+/g, '_');
  switch (s) {
    case 'approved':
    case 'published':
    case 'accepted':
    case 'merged':
      return 'text-green-700 dark:text-green-300 border-green-500/50 bg-green-500/10';
    case 'pending':
    case 'draft':
    case 'pending_review':
    case 'pending_revision':
      return 'text-amber-800 dark:text-amber-200 border-amber-500/50 bg-amber-500/10';
    case 'rejected':
      return 'text-red-700 dark:text-red-300 border-red-500/50 bg-red-500/10';
    default:
      return 'text-muted-foreground border-border bg-muted/40';
  }
}

function formatStatusLabel(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function shortUrlLabel(href: string): string {
  try {
    const u = new URL(href);
    const path =
      u.pathname && u.pathname !== '/' ? u.pathname : '';
    let out = u.hostname + path;
    if (out.length > 52) out = `${out.slice(0, 49)}…`;
    return out;
  } catch {
    return href.length > 52 ? `${href.slice(0, 49)}…` : href;
  }
}

function PreviewBlock({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border/70 bg-card/80 p-3 shadow-sm',
        className
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        {label}
      </div>
      <div className="min-w-0 pl-9 text-sm leading-relaxed text-foreground">
        {children}
      </div>
    </div>
  );
}

export function SourceRecordHoverCard({
  item,
  children,
}: {
  item: SourceRecord;
  children: React.ReactNode;
}) {
  const headline = nonEmpty(item.title) || nonEmpty(item.name) || 'Untitled source';
  const typeLabel = formatSourceTypeLabel(item.type);
  const authors = nonEmpty(item.authors);
  const description = nonEmpty(item.description);
  const archive = nonEmpty(item.archive_location);
  const year = nonEmpty(item.publication_year);
  const contributor = nonEmpty(item.contributor);
  const digitalRaw = nonEmpty(item.digital_link);
  const digitalSafe = digitalRaw ? safeHttpUrl(digitalRaw) : null;
  const entityId = (() => {
    const v = item.cultural_entity_id;
    if (v === null || v === undefined) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
  })();

  const hasDetails =
    !!authors ||
    !!description ||
    !!archive ||
    !!digitalRaw ||
    !!contributor ||
    !!entityId;

  const viewHref = `/knowledge/source/view/${item.id}`;

  return (
    <HoverCard openDelay={220} closeDelay={120}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        className={cn(
          'flex max-h-[min(32rem,78svh)] w-[min(22rem,calc(100vw-1.25rem))] flex-col overflow-hidden p-0 sm:min-w-[26rem] sm:max-w-[28rem]',
          'rounded-xl border-border/80 shadow-xl'
        )}
        side="right"
        align="start"
        sideOffset={10}
        collisionPadding={20}
      >
        <div className="relative shrink-0 border-b border-border/60 bg-gradient-to-br from-primary/[0.12] via-primary/[0.06] to-transparent px-4 pb-3 pt-4 dark:from-primary/20 dark:via-primary/10">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background/80 shadow-sm ring-1 ring-border/60 dark:bg-background/60">
              <BookOpen className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <h4 className="text-balance font-semibold leading-snug tracking-tight text-foreground">
                {headline}
              </h4>
              <div className="flex flex-wrap items-center gap-1.5">
                {item.type ? (
                  <Badge variant="secondary" className="font-normal">
                    {typeLabel}
                  </Badge>
                ) : null}
                {year ? (
                  <Badge variant="outline" className="border-dashed font-mono text-xs font-normal">
                    {year}
                  </Badge>
                ) : null}
                {item.status ? (
                  <Badge
                    variant="outline"
                    className={cn('font-normal', statusBadgeClass(item.status))}
                  >
                    {formatStatusLabel(item.status)}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div
          className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3"
          role="region"
          aria-label="Source summary"
        >
          {authors ? (
            <PreviewBlock icon={User} label="Author(s)">
              <p className="whitespace-pre-wrap break-words">{authors}</p>
            </PreviewBlock>
          ) : null}

          {description ? (
            <PreviewBlock icon={FileText} label="Description">
              <p className="line-clamp-6 whitespace-pre-wrap break-words text-muted-foreground">
                {description}
              </p>
            </PreviewBlock>
          ) : null}

          {archive ? (
            <PreviewBlock icon={MapPin} label="Archive & holding">
              <p className="break-words">{archive}</p>
            </PreviewBlock>
          ) : null}

          {digitalRaw ? (
            <PreviewBlock icon={ExternalLink} label="Digital access">
              {digitalSafe ? (
                <a
                  href={digitalSafe}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={digitalSafe}
                  className="inline-flex max-w-full items-start gap-2 rounded-md text-primary underline-offset-4 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  <span className="min-w-0 break-all font-mono text-xs leading-snug">
                    {shortUrlLabel(digitalSafe)}
                  </span>
                </a>
              ) : (
                <p className="break-all text-xs text-muted-foreground">
                  <span className="italic">Link not usable in browser:</span>{' '}
                  <span className="font-mono">{digitalRaw}</span>
                </p>
              )}
            </PreviewBlock>
          ) : null}

          {contributor || entityId ? (
            <>
              <Separator className="bg-border/60" />
              <div className="space-y-2 text-xs text-muted-foreground">
                {contributor ? (
                  <p className="flex items-start gap-2">
                    <User className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                    <span>
                      <span className="text-muted-foreground/80">Recorded by</span>{' '}
                      <span className="font-medium text-foreground">{contributor}</span>
                    </span>
                  </p>
                ) : null}
                {entityId ? (
                  <p>
                    <Link
                      href={`/knowledge/entity/view/${entityId}`}
                      className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Layers className="h-3.5 w-3.5" aria-hidden />
                      Linked cultural entity
                    </Link>
                  </p>
                ) : null}
              </div>
            </>
          ) : null}

          {!hasDetails ? (
            <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-4 text-center">
              <p className="text-sm text-muted-foreground">
                No extra bibliographic fields on this row yet.
              </p>
              <p className="mt-1 text-xs text-muted-foreground/80">
                Open the full record for the complete form and history.
              </p>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-border/60 bg-muted/30 p-3 dark:bg-muted/20">
          <Button variant="default" size="sm" className="h-9 w-full gap-2 text-xs font-medium" asChild>
            <Link href={viewHref}>
              <Eye className="h-3.5 w-3.5" aria-hidden />
              Open full record
            </Link>
          </Button>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
