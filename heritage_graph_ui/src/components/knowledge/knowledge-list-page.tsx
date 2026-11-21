'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { IconFlask, IconInfoCircle } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { surfaceCard } from '@/lib/design';
import { cn } from '@/lib/utils';

interface KnowledgeListPageProps {
  children: React.ReactNode;
  /**
   * Registry key of the class being listed (e.g. "entity", "person"), used to
   * look up the heading and definition. Omit to render the table alone.
   */
  domain?: string;
}

/**
 * Shell for knowledge-base list routes.
 *
 * Previously this was a bare card containing only the table: no heading, no
 * statement of what the listed class means, and no route to the provenance
 * documentation. A reader landing here from a citation had no way to tell what
 * they were looking at, and the page had no `h1` at all — so assistive tech got
 * an unlabelled data grid. The table itself still owns filtering and paging.
 */
export function KnowledgeListPage({ children, domain }: KnowledgeListPageProps) {
  const t = useTranslations('knowledgeList');

  if (!domain) {
    return <div className={cn(surfaceCard, 'overflow-hidden')}>{children}</div>;
  }

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <h1 className="font-serif text-2xl font-semibold text-foreground">
          {t(`domains.${domain}.title`)}
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {t(`domains.${domain}.definition`)}
        </p>
      </header>

      <div
        className={cn(
          surfaceCard,
          'flex flex-col gap-2 p-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between',
        )}
      >
        <p className="flex items-start gap-2 leading-relaxed">
          <IconInfoCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t('statusNote')}
        </p>
        <Button variant="outline" size="sm" asChild className="shrink-0">
          <Link href="/methods">
            <IconFlask className="mr-2 size-4" />
            {t('methodsCta')}
          </Link>
        </Button>
      </div>

      <div className={cn(surfaceCard, 'overflow-hidden')}>{children}</div>
    </div>
  );
}
