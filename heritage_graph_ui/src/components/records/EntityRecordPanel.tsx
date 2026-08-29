'use client';

import { useTranslations } from 'next-intl';
import { IconExternalLink } from '@tabler/icons-react';

import {
  orderedRecordFacts,
  recordFor,
} from '@/lib/records/entity-records';
import { cn } from '@/lib/utils';

/**
 * What a record actually says about an entity, in plain terms.
 *
 * Every entity in the corpus used to show a photograph and an ontology class.
 * "heritageGraph:IconographicObject" tells a cataloguer a great deal and a
 * visitor nothing, so this leads with a description and a table of readable
 * facts, and leaves the class in the technical section further down where the
 * people who need it will look.
 */
export function EntityRecordPanel({
  nodeId,
  className,
}: {
  nodeId: string | null | undefined;
  className?: string;
}) {
  const t = useTranslations('entityRecord');
  const record = recordFor(nodeId);
  const facts = orderedRecordFacts(nodeId);
  if (!record) return null;
  const d = record.description;
  if (!d && facts.length === 0) return null;

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {d ? (
        <section aria-label={t('descriptionHeading')} className="flex flex-col gap-2">
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
            {d.sentencesRemoved > 0 ? <> · {t('trimmed', { count: d.sentencesRemoved })}</> : null}
          </p>
        </section>
      ) : null}

      {facts.length > 0 ? (
        <section
          aria-label={t('factsHeading')}
          className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-4"
        >
          <h3 className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
            {t('factsHeading')}
          </h3>
          <dl className="flex flex-col">
            {facts.map(({ key, values, property }) => (
              <div
                key={key}
                className="grid grid-cols-[minmax(5.5rem,8rem)_1fr] gap-x-3 border-t border-border py-1.5"
              >
                <dt className="text-xs text-muted-foreground">{t(`labels.${key}`)}</dt>
                <dd
                  className={cn(
                    'text-sm text-foreground',
                    key === 'worldHeritageId' && 'font-mono tabular-nums',
                  )}
                  title={`Wikidata ${property}`}
                >
                  {values.join(' · ')}
                </dd>
              </div>
            ))}
          </dl>
          {record.wikidataUrl ? (
            <p className="text-[0.68rem] text-muted-foreground">
              {t('factsSource')}{' '}
              <a
                href={record.wikidataUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-foreground focus-visible:text-foreground"
              >
                {record.wikidataId}
                <IconExternalLink className="size-3" aria-hidden="true" />
              </a>
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
