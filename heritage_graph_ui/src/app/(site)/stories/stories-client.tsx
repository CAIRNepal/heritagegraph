'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { Eyebrow, Nepali, StoryContainer, StoryShell } from '@/components/story/story-chrome';
import { StoryFigure } from '@/components/story/story-figure';
import { useStoryGraph } from '@/hooks/use-story-graph';
import { cn } from '@/lib/utils';
import { buildStory, goesBeyondPlace, storyHref, storyReadyRecords, type StoryRecord } from '@/lib/stories/build-story';

interface Card {
  record: StoryRecord;
  stops: number;
  /** Says more than where things are (see goesBeyondPlace). */
  rich: boolean;
}

export function StoriesClient() {
  const t = useTranslations('stories');
  const { index, loading, error } = useStoryGraph();
  const [type, setType] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [placeOnlyShown, setPlaceOnlyShown] = useState(false);

  const allCards = useMemo<Card[]>(() => {
    if (!index) return [];
    return storyReadyRecords(index).map((record) => {
      const story = buildStory(index, record.id);
      return { record, stops: story?.stops.length ?? 0, rich: story ? goesBeyondPlace(story) : false };
    });
  }, [index]);
  const placeOnlyCount = allCards.filter((c) => !c.rich).length;
  // Location-only stories are listed only on request, and the page says how
  // many are held back, so the filter is visible rather than silent.
  const cards = useMemo(() => (placeOnlyShown ? allCards : allCards.filter((c) => c.rich)), [allCards, placeOnlyShown]);

  const types = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of cards) counts.set(c.record.typeLabel, (counts.get(c.record.typeLabel) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [cards]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter(
      (c) =>
        (!type || c.record.typeLabel === type) &&
        (!q ||
          c.record.label.toLowerCase().includes(q) ||
          (c.record.labelNe ?? '').includes(query.trim())),
    );
  }, [cards, type, query]);

  return (
    <StoryShell>
      <StoryContainer className="grid gap-8 border-b border-story-rule py-12 md:grid-cols-2 md:py-16">
        <div>
          <Eyebrow>{t('indexEyebrow')}</Eyebrow>
          <h1 className="mt-4 text-5xl leading-[1.02] font-serif font-medium tracking-[-0.01em] md:text-7xl">{t('indexTitle')}</h1>
        </div>
        <p className="self-end text-lg">{t('indexLead')}</p>
      </StoryContainer>

      <div className="border-b border-story-rule">
        <StoryContainer className="flex flex-wrap items-center gap-3 py-4">
          <div className="flex flex-wrap gap-2 text-sm font-medium">
            <FilterButton active={!type} onClick={() => setType(null)}>
              {t('all')} {cards.length}
            </FilterButton>
            {types.map(([label, n]) => (
              <FilterButton key={label} active={type === label} onClick={() => setType(label)}>
                {label} {n}
              </FilterButton>
            ))}
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search')}
            aria-label={t('search')}
            className="ml-auto w-full rounded-full border border-story-rule bg-story-panel px-4 py-1.5 text-sm placeholder:text-story-ink-soft sm:w-64"
          />
        </StoryContainer>
      </div>

      <StoryContainer className="py-8">
        {loading && <p className="text-xl font-bold">{t('loading')}</p>}
        {error && <p className="text-xl font-bold">{t('error')}</p>}
        {!loading && !error && (
          <>
            <p className="text-[11px] font-bold tracking-[0.14em] uppercase">{t('storyCount', { count: shown.length })}</p>
            {placeOnlyCount > 0 && (
              <p className="mt-2 max-w-3xl text-sm text-story-ink-soft">
                {placeOnlyShown ? t('placeOnlyIncluded', { count: placeOnlyCount }) : t('placeOnlyHidden', { count: placeOnlyCount })}{' '}
                <button
                  type="button"
                  onClick={() => setPlaceOnlyShown((v) => !v)}
                  className="font-semibold text-story-accent underline underline-offset-4"
                >
                  {placeOnlyShown ? t('placeOnlyHide') : t('placeOnlyShow')}
                </button>
              </p>
            )}
            {shown.length === 0 ? (
              <p className="mt-6 text-xl font-bold">{t('empty')}</p>
            ) : (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {shown.map(({ record, stops }) => (
                  <li key={record.id}>
                    <Link href={storyHref(record)} className="group flex h-full flex-col overflow-hidden rounded-xl border border-story-rule bg-story-panel shadow-xs transition-shadow hover:shadow-md">
                      {record.imageUrl ? (
                        <StoryFigure src={record.imageUrl} alt={record.label} credit={record.imageCredit} linked={false} className="aspect-[16/10] border-b border-story-rule" />
                      ) : (
                        <div className="flex aspect-[16/10] items-end border-b border-story-rule bg-story-panel p-3">
                          <span className="font-serif text-3xl leading-none text-story-ink-soft/40">{record.typeLabel}</span>
                        </div>
                      )}
                      <div className="flex flex-1 flex-col p-3">
                        <Eyebrow>{record.typeLabel}</Eyebrow>
                        <p className="mt-1 font-serif text-lg leading-snug">{record.label}</p>
                        {record.labelNe && <Nepali className="text-sm font-normal">{record.labelNe}</Nepali>}
                        <div className="mt-auto flex items-center justify-between border-t border-story-rule-soft pt-2 text-xs font-semibold">
                          <span className="text-story-accent">{t('stops', { count: stops })}</span>
                          <span className="group-hover:underline">{t('readStory')} →</span>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </StoryContainer>
    </StoryShell>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn('rounded-full border px-3 py-1.5', active ? 'border-story-accent bg-story-accent text-story-accent-ink' : 'border-story-rule bg-story-panel hover:bg-muted')}
    >
      {children}
    </button>
  );
}
