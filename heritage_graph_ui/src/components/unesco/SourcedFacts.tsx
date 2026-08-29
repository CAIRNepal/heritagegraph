'use client';

import { useTranslations } from 'next-intl';
import { IconExternalLink } from '@tabler/icons-react';

import { FACTS_PROVENANCE, factsFor, orderedFacts } from '@/lib/unesco/facts';
import { descriptionFor } from '@/lib/unesco/descriptions';
import { imageryFor } from '@/lib/unesco/imagery';
import { cn } from '@/lib/utils';

/**
 * Structured facts for a UNESCO subject, each traceable to a Wikidata property.
 *
 * This is the answer to a record that had almost nothing to show. The demo
 * corpus's prose is unsourced by its own admission, so rather than write more
 * of it, the record states what can actually be cited — and names where each
 * value came from.
 */
export function SourcedFacts({
  subjectKey,
  className,
  heading = true,
}: {
  subjectKey: string;
  className?: string;
  heading?: boolean;
}) {
  const t = useTranslations('unescoEntry.facts');
  const subject = factsFor(subjectKey);
  const rows = orderedFacts(subjectKey);
  if (!subject || rows.length === 0) return null;

  return (
    <section className={cn('flex flex-col gap-3', className)} aria-label={t('heading')}>
      {heading ? (
        <h3 className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
          {t('heading')}
        </h3>
      ) : null}

      <dl className="flex flex-col">
        {rows.map(({ key, values, property }) => (
          <div
            key={key}
            className="grid grid-cols-[minmax(5rem,9rem)_minmax(0,1fr)] gap-x-4 border-t border-border py-2"
          >
            <dt className="text-xs text-muted-foreground">{t(`labels.${key}`)}</dt>
            <dd
              className={cn(
                'text-sm text-foreground',
                key === 'worldHeritageId' && 'font-mono tabular-nums',
              )}
              // The Wikidata property is the citation for this row; exposing it
              // in the title keeps the row itself uncluttered.
              title={`Wikidata ${property}`}
            >
              {values.join(' · ')}
            </dd>
          </div>
        ))}
      </dl>

      <p className="text-[0.68rem] leading-relaxed text-muted-foreground">
        {t('source', { date: FACTS_PROVENANCE.retrieved })}{' '}
        <a
          href={subject.wikidataUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-foreground focus-visible:text-foreground"
        >
          {subject.wikidataId}
          <IconExternalLink className="size-3" aria-hidden="true" />
        </a>
      </p>
    </section>
  );
}


/**
 * Full title–author–source–licence credits, listed once per page.
 *
 * CC BY-SA 3.0 requires the work's title, which is too much to repeat under
 * every thumbnail. Creative Commons explicitly accepts collecting attribution
 * in one place when that is reasonable for the medium, so the compact
 * per-image line carries author and licence and this list carries the rest.
 */
export function ImageCreditsList({
  subjectKeys,
  className,
}: {
  subjectKeys: readonly string[];
  className?: string;
}) {
  const t = useTranslations('unescoEntry.facts');
  const entries = subjectKeys
    .map((k) => ({ key: k, imagery: imageryFor(k) }))
    .filter((e): e is { key: string; imagery: NonNullable<ReturnType<typeof imageryFor>> } =>
      Boolean(e.imagery?.image),
    );
  if (entries.length === 0) return null;

  return (
    <section className={cn('flex flex-col gap-2', className)} aria-label={t('creditsHeading')}>
      <h3 className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
        {t('creditsHeading')}
      </h3>
      <ul className="flex flex-col gap-1.5">
        {entries.map(({ key, imagery }) => {
          const img = imagery.image!;
          // The file name is the work's title; strip the namespace prefix.
          const title = imagery.file.replace(/^File:/, '');
          return (
            <li key={key} className="text-[0.7rem] leading-relaxed text-muted-foreground">
              <a
                href={img.credit.descriptionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground focus-visible:text-foreground"
              >
                {title}
              </a>
              {img.credit.artist ? <> — {img.credit.artist}</> : null}
              {img.credit.license ? (
                <>
                  {' · '}
                  {img.credit.licenseUrl ? (
                    <a
                      href={img.credit.licenseUrl}
                      target="_blank"
                      rel="noopener noreferrer license"
                      className="underline underline-offset-2 hover:text-foreground focus-visible:text-foreground"
                    >
                      {img.credit.license}
                    </a>
                  ) : (
                    img.credit.license
                  )}
                </>
              ) : null}
              {img.credit.source ? <> · {img.credit.source}</> : null}
            </li>
          );
        })}
      </ul>
      <p className="text-[0.68rem] text-muted-foreground">
        {t('creditsRetrieved', { date: entries[0].imagery.image!.credit.retrieved ?? '' })}
      </p>
    </section>
  );
}


/**
 * A short description of a subject, quoted with its source.
 *
 * The removal notice is deliberate. These leads call the Durbar Squares World
 * Heritage Sites in the plural; that sentence is dropped because the record
 * states the real relationship with UNESCO's own component numbering. Editing
 * a quotation is only honest if the reader can see it was edited.
 */
export function SubjectDescription({
  subjectKey,
  className,
}: {
  subjectKey: string;
  className?: string;
}) {
  const t = useTranslations('unescoEntry.facts');
  const d = descriptionFor(subjectKey);
  if (!d) return null;
  return (
    <section className={cn('flex flex-col gap-2', className)} aria-label={t('descriptionHeading')}>
      <h3 className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
        {t('descriptionHeading')}
      </h3>
      <p className="text-sm leading-relaxed text-foreground">{d.text}</p>
      <p className="text-[0.68rem] leading-relaxed text-muted-foreground">
        {t('descriptionSource', { date: d.retrieved })}{' '}
        <a
          href={d.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground focus-visible:text-foreground"
        >
          {d.sourceTitle}
        </a>
        {' · '}
        <a
          href={d.licenseUrl}
          target="_blank"
          rel="noopener noreferrer license"
          className="underline underline-offset-2 hover:text-foreground focus-visible:text-foreground"
        >
          {d.license}
        </a>
        {d.sentencesRemoved > 0 ? (
          <>
            {' · '}
            {t('descriptionTrimmed', { count: d.sentencesRemoved })}
          </>
        ) : null}
      </p>
    </section>
  );
}
