'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Chip, Eyebrow, Marker, Nepali, StoryContainer, StoryShell } from '@/components/story/story-chrome';
import { StoryFigure } from '@/components/story/story-figure';
import { StoryMap, type StoryMapItem } from '@/components/story/story-map';
import { useStoryGraph } from '@/hooks/use-story-graph';
import {
  buildStory,
  findRecordId,
  recordHref,
  storyHref,
  storyLength,
  type StoryLink,
  type StoryStop,
} from '@/lib/stories/build-story';

interface StoryClientProps {
  segment: string;
  pk: string;
}

export function StoryClient({ segment, pk }: StoryClientProps) {
  const t = useTranslations('stories');
  const { index, loading, error } = useStoryGraph();
  const story = useMemo(() => {
    if (!index) return null;
    const id = findRecordId(index, segment, pk);
    return id ? buildStory(index, id) : null;
  }, [index, segment, pk]);

  const [active, setActive] = useState(0);
  const [revealed, setRevealed] = useState(1);
  const stopRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (!story) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) setRevealed(story.stops.length);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = Number((e.target as HTMLElement).dataset.stop);
          setActive(i);
          setRevealed((r) => Math.max(r, i + 1));
        }
      },
      { rootMargin: '-35% 0px -55% 0px' },
    );
    stopRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [story]);

  if (loading) return <Status text={t('loading')} />;
  if (error) return <Status text={t('error')} />;
  if (!story) return <Status text={t('notFound')} back={t('allStories')} />;
  if (story.stops.length === 0)
    return <Status text={t('tooShort')} back={t('openRecord')} href={recordHref(story.focus)} />;

  const { focus, stops } = story;
  const mapItems: StoryMapItem[] = stops.map((s) => ({
    id: s.key,
    label: s.links[0].record.label,
    phrase: s.links[0].phrase,
    direction: 'out',
    href: storyLength(index!, s.links[0].record.id) >= 2 ? storyHref(s.links[0].record) : recordHref(s.links[0].record),
  }));
  const next = stops
    .map((s) => s.links[0].record)
    .filter((r, i, all) => all.findIndex((x) => x.id === r.id) === i)
    .filter((r) => storyLength(index!, r.id) >= 2)
    .slice(0, 6);

  return (
    <StoryShell>
      <StoryContainer className="pt-10 pb-12 md:pt-14">
        <Link href="/stories" className="text-sm font-semibold text-story-accent underline underline-offset-4">
          ← {t('allStories')}
        </Link>
        <div className="mt-5 flex flex-wrap gap-2">
          <Chip filled>{focus.typeLabel}</Chip>
          <Chip>{t('stops', { count: stops.length })}</Chip>
        </div>
        <h1 className="mt-5 max-w-5xl text-5xl leading-[0.95] font-extrabold tracking-tight text-balance md:text-8xl">
          {focus.label}
        </h1>
        {focus.labelNe && <Nepali className="mt-3 text-2xl md:text-3xl">{focus.labelNe}</Nepali>}
        {focus.comment && <p className="mt-6 max-w-2xl text-lg">{focus.comment}</p>}
        <p className="mt-3 max-w-2xl text-story-ink-soft">{t('lead', { label: focus.label })}</p>
      </StoryContainer>

      {focus.imageUrl && (
        <StoryFigure
          src={focus.imageUrl}
          alt={focus.label}
          credit={focus.imageCredit}
          className="h-[46vh] min-h-72 w-full border-y border-story-rule"
        />
      )}

      <StoryContainer className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="relative border-story-rule lg:border-r">
          <div aria-hidden className="absolute top-0 bottom-0 left-[7px] w-px bg-story-rule" />
          {stops.map((stop, i) => (
            <StopSection
              key={stop.key}
              ref={(el) => {
                stopRefs.current[i] = el;
              }}
              index={i}
              stop={stop}
              focusLabel={focus.label}
              onRecordPage={recordHref(focus)}
            />
          ))}
          {next.length > 0 && (
            <section className="relative py-14 pl-10 md:pl-14">
              <Marker className="absolute top-[3.9rem] left-0" />
              <h2 className="text-3xl font-bold text-story-accent md:text-4xl">{t('whereNext')}</h2>
              <p className="mt-3 max-w-3xl text-4xl leading-tight font-extrabold tracking-tight md:text-5xl">
                {t('whereNextTitle')}
              </p>
              <div className="mt-8 grid border border-story-rule sm:grid-cols-2 xl:grid-cols-3">
                {next.map((r) => (
                  <Link key={r.id} href={storyHref(r)} className="group border-story-rule p-4 hover:bg-story-panel sm:[&:not(:last-child)]:border-r">
                    <Eyebrow>{r.typeLabel}</Eyebrow>
                    <p className="mt-1 text-lg font-bold">{r.label}</p>
                    {r.labelNe && <Nepali className="text-sm font-normal">{r.labelNe}</Nepali>}
                    <p className="mt-3 text-sm font-semibold group-hover:underline">{t('readItsStory')} →</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-14 pt-6 pl-6">
            <div className="flex items-baseline justify-between border-b border-story-rule pb-3">
              <p className="text-[11px] font-bold tracking-[0.14em] uppercase">
                {t('mapSoFar')}{' '}
                <span lang="ne" className="font-devanagari tracking-normal">
                  · {t('mapSoFarNe')}
                </span>
              </p>
              <p className="text-[11px] font-semibold text-story-accent">
                {t('mapCount', { records: Math.min(revealed, stops.length) + 1, links: Math.min(revealed, stops.length) })}
              </p>
            </div>
            <StoryMap focusLabel={focus.label} items={mapItems} revealed={revealed} active={active} className="mt-4" />
          </div>
        </aside>
      </StoryContainer>
    </StoryShell>
  );
}

interface StopSectionProps {
  index: number;
  stop: StoryStop;
  focusLabel: string;
  onRecordPage: string;
  ref: (el: HTMLElement | null) => void;
}

function StopSection({ index, stop, focusLabel, onRecordPage, ref }: StopSectionProps) {
  const t = useTranslations('stories');
  const [lead, ...others] = stop.links;
  const shown = others.slice(0, 9);
  const kindNe = t(`kindNe.${stop.kind}`);
  return (
    <section ref={ref} data-stop={index} className="relative border-b border-story-rule-soft py-14 pl-10 md:pl-14">
      <Marker className="absolute top-[3.9rem] left-0" />
      <h2 className="text-3xl leading-tight font-bold text-story-accent md:text-[2.6rem]">{stop.question.en}</h2>
      {stop.question.ne && <Nepali className="mt-1 text-lg">{stop.question.ne}</Nepali>}
      <Eyebrow className="mt-4" ne={kindNe || null}>
        {t('stop', { n: String(index + 1).padStart(2, '0') })} · {t(`kind.${stop.kind}`)}
      </Eyebrow>

      <div className="mt-3 grid gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <h3 className="text-4xl leading-[0.98] font-extrabold tracking-tight text-balance md:text-6xl">
            <Link href={recordHref(lead.record)} className="hover:underline">
              {lead.record.label}
            </Link>
          </h3>
          {lead.record.labelNe && <Nepali className="mt-2 text-xl">{lead.record.labelNe}</Nepali>}
          <p className="mt-2 text-sm font-medium text-story-ink-soft">{lead.record.typeLabel}</p>
          {lead.record.comment && <p className="mt-4 max-w-xl">{lead.record.comment}</p>}
        </div>
        {lead.record.imageUrl && (
          <StoryFigure
            src={lead.record.imageUrl}
            alt={lead.record.label}
            credit={lead.record.imageCredit}
            className="aspect-[4/5] border border-story-rule"
          />
        )}
      </div>

      <RelationLine focusLabel={focusLabel} link={lead} />

      {shown.length > 0 && (
        <div className="mt-6">
          <p className="text-[11px] font-bold tracking-[0.14em] uppercase">{t('alsoConnected')}</p>
          <ul className="mt-3 grid border-t border-l border-story-rule sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((l) => (
              <li key={l.record.id} className="border-r border-b border-story-rule">
                <Link href={recordHref(l.record)} className="block p-3 hover:bg-story-panel">
                  <span className="block font-semibold">{l.record.label}</span>
                  {l.record.labelNe && (
                    <span lang="ne" className="block font-devanagari text-sm">
                      {l.record.labelNe}
                    </span>
                  )}
                  <span className="block text-xs text-story-ink-soft">{l.record.typeLabel}</span>
                </Link>
              </li>
            ))}
          </ul>
          {others.length > shown.length && (
            <Link href={onRecordPage} className="mt-3 inline-block text-sm font-semibold text-story-accent underline underline-offset-4">
              {t('moreOnRecord', { count: others.length - shown.length })} →
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

function RelationLine({ focusLabel, link }: { focusLabel: string; link: StoryLink }) {
  const t = useTranslations('stories');
  const source = link.provenance?.source;
  return (
    <div className="mt-8 border-y border-story-rule py-3">
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
        <span>{focusLabel}</span>
        <span className="text-story-accent">— {link.phrase} →</span>
        <span>{link.record.label}</span>
      </p>
      {source && (
        <p className="mt-1 text-xs text-story-ink-soft" title={link.provenance?.citation ?? undefined}>
          {t('source')}: {source}
        </p>
      )}
    </div>
  );
}

function Status({ text, back, href = '/stories' }: { text: string; back?: string; href?: string }) {
  return (
    <StoryShell>
      <StoryContainer className="py-24">
        <p className="text-2xl font-bold">{text}</p>
        {back && (
          <Link href={href} className="mt-4 inline-block font-semibold text-story-accent underline underline-offset-4">
            {back} →
          </Link>
        )}
      </StoryContainer>
    </StoryShell>
  );
}
