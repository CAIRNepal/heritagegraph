import Link from 'next/link';
import { glassCard } from '@/lib/design';

interface KnowledgeListPageProps {
  title: string;
  description: string;
  contributeHref: string;
  children: React.ReactNode;
}

/**
 * Shared header + glass container for knowledge-base list routes so pages are not
 * “table-only” and users get context + a contribute path.
 */
export function KnowledgeListPage({
  title,
  description,
  contributeHref,
  children,
}: KnowledgeListPageProps) {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-blue-900 dark:text-blue-100">
          {title}
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-blue-800/85 dark:text-blue-200/75">
          {description}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            href={contributeHref}
            className="font-medium text-blue-700 underline underline-offset-4 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
          >
            Contribute a new record
          </Link>
          <span className="text-blue-600/50 dark:text-blue-300/40" aria-hidden>
            ·
          </span>
          <span className="text-blue-700/75 dark:text-blue-200/65">
            Approval and status labels follow the curation workflow.
          </span>
        </div>
      </header>
      <div className={`${glassCard} overflow-hidden`}>{children}</div>
    </div>
  );
}
