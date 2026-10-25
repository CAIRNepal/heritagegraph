'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { Chip, Eyebrow, Nepali, StoryContainer, StoryShell } from '@/components/story/story-chrome';
import { StoryFigure } from '@/components/story/story-figure';
import { StoryMap } from '@/components/story/story-map';
import { useStoryGraph } from '@/hooks/use-story-graph';
import { provenanceTier, wikidataIdIn } from '@/lib/heritage-museum/provenance-tier';
import { buildStory, findRecordId, recordHref, storyHref } from '@/lib/stories/build-story';

interface RecordClientProps {
  segment: string;
  pk: string;
}

export function RecordClient({ segment, pk }: RecordClientProps) {
  const t = useTranslations('stories');
  const { index, loading, error } = useStoryGraph();
  const story = useMemo(() => {
    if (!index) return null;
    const id = findRecordId(index, segment, pk);
    return id ? buildStory(index, id, 12) : null;
  }, [index, segment, pk]);

  if (loading || error || !story) {
    return (
      <StoryShell>
        <StoryContainer className="py-24">
          <p className="text-2xl font-bold">{loading ? t('loading') : error ? t('error') : t('notFound')}</p>
        </StoryContainer>
      </StoryShell>
    );
  }

  const { focus, stops } = story;
  const src = focus.node.recordSource;
  const kind = provenanceTier(src);
  const citationLines = (src?.citation ?? '').split('\n').filter(Boolean);
  const qid = wikidataIdIn(src?.citation);
  const threads = stops.map((s) => ({ stop: s, link: s.links[0], more: s.links.length - 1 }));

  return (
    <StoryShell>
      <div className="border-b border-story-rule">
        <StoryContainer className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-xs font-semibold">
          <Link href="/stories" className="text-story-accent underline underline-offset-4">
            ← {t('allStories')}
          </Link>
          <span className="tracking-[0.14em] uppercase">{t('yourPath')}</span>
          <span className="text-story-accent">{focus.label}</span>
        </StoryContainer>
      </div>

      <div className="grid border-b border-story-rule md:grid-cols-2">
        <div className="flex flex-col justify-center px-5 py-12 md:px-12 md:py-16">
          <div className="flex flex-wrap gap-2">
            <Chip filled>{focus.typeLabel}</Chip>
            <Chip>
              {segment} {pk}
            </Chip>
          </div>
          <h1 className="mt-5 text-5xl leading-[0.95] font-extrabold tracking-tight text-balance md:text-7xl">
            {focus.label}
          </h1>
          {focus.labelNe && <Nepali className="mt-3 text-2xl">{focus.labelNe}</Nepali>}
          {focus.comment && <p className="mt-6 max-w-xl text-lg">{focus.comment}</p>}
        </div>
        {focus.imageUrl ? (
          <StoryFigure
            src={focus.imageUrl}
            alt={focus.label}
            credit={focus.imageCredit}
            className="min-h-80 border-story-rule md:border-l"
          />
        ) : (
          <div className="hidden bg-story-panel md:block md:border-l md:border-story-rule" />
        )}
      </div>

      {stops.length >= 2 && (
        <Link href={storyHref(focus)} className="block bg-story-accent text-story-accent-ink hover:brightness-110">
          <StoryContainer className="flex flex-wrap items-center justify-between gap-3 py-5">
            <span className="text-[11px] font-bold tracking-[0.14em] uppercase">{t('everyRecord')}</span>
            <span className="text-xl font-extrabold tracking-tight md:text-3xl">
              {t('readStoryOf', { label: focus.label })} →
            </span>
          </StoryContainer>
        </Link>
      )}

      <StoryContainer className="py-14">
        <Eyebrow ne={t('worldNe')}>{t('worldEyebrow')}</Eyebrow>
        {threads.length === 0 ? (
          <p className="mt-3 text-2xl font-bold">{t('noThreads')}</p>
        ) : (
          <>
            <h2 className="mt-2 max-w-3xl text-4xl leading-tight font-extrabold tracking-tight md:text-5xl">
              {t('threads', { count: threads.length })}
              <br />
              {t('pickOne')}
            </h2>
            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
              <div className="border border-story-rule p-4">
                <StoryMap
                  focusLabel={focus.label}
                  revealed={threads.length}
                  items={threads.map(({ stop, link }) => ({
                    id: stop.key,
                    label: link.record.label,
                    phrase: link.phrase,
                    direction: 'out',
                    href: recordHref(link.record),
                  }))}
                />
              </div>
              <ul className="border-t border-story-rule">
                {threads.map(({ stop, link, more }) => (
                  <li key={stop.key} className="border-b border-story-rule py-4">
                    <p className="text-xs font-semibold">
                      {focus.label} <span className="text-story-accent">— {link.phrase} →</span>
                    </p>
                    <div className="mt-1 flex items-baseline justify-between gap-4">
                      <Link href={recordHref(link.record)} className="text-xl font-bold hover:underline">
                        {link.record.label}
                      </Link>
                      <Link href={recordHref(link.record)} className="shrink-0 text-sm font-semibold">
                        {t('goThere')} →
                      </Link>
                    </div>
                    <p className="text-sm">
                      {link.record.labelNe && (
                        <span lang="ne" className="font-devanagari">
                          {link.record.labelNe} ·{' '}
                        </span>
                      )}
                      {link.record.typeLabel}
                      {more > 0 && <span className="text-story-ink-soft"> · {t('andMore', { count: more })}</span>}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </StoryContainer>

      <div className="border-t border-story-rule">
        <StoryContainer className="grid gap-8 py-14 md:grid-cols-2">
          <div>
            <Eyebrow ne={t('sourcesNe')}>{t('sourcesEyebrow')}</Eyebrow>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight">{t('sourcesTitle')}</h2>
          </div>
          <div>
            {src ? (
              <ul className="border-t border-story-rule">
                <li className="flex items-start justify-between gap-4 border-b border-story-rule py-3">
                  <span>
                    {/* The record's own source; a curated record that only took
                        labels from Wikidata must not be headed "Wikidata". */}
                    <span className="font-semibold">{src.name ?? t(kind === 'imported' ? 'imported' : 'curated')}</span>
                    {citationLines.map((line) => (
                      <span key={line} className="block text-xs text-story-ink-soft">
                        {line}
                      </span>
                    ))}
                    {qid && (
                      <a
                        href={`https://www.wikidata.org/wiki/${qid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs font-semibold underline underline-offset-4"
                      >
                        Wikidata {qid} ↗
                      </a>
                    )}
                  </span>
                  {kind && <Chip filled={kind === 'reviewed'}>{t(kind)}</Chip>}
                </li>
                {focus.imageCredit && (
                  <li className="flex items-start justify-between gap-4 border-b border-story-rule py-3 text-sm">
                    <span>
                      {t('image')}: {[focus.imageCredit.artist, focus.imageCredit.license, focus.imageCredit.source].filter(Boolean).join(' · ')}
                    </span>
                  </li>
                )}
              </ul>
            ) : (
              <p className="border-y border-story-rule py-3">{t('noSource')}</p>
            )}
            <Link href="/contribute" className="mt-4 inline-block text-sm font-semibold text-story-accent underline underline-offset-4">
              {t('suggest')} →
            </Link>
          </div>
        </StoryContainer>
      </div>
    </StoryShell>
  );
}
