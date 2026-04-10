import { glassCard } from '@/lib/design';

interface KnowledgeListPageProps {
  children: React.ReactNode;
}

/** Shared glass container for knowledge-base list routes (table only; nav is in the sidebar). */
export function KnowledgeListPage({ children }: KnowledgeListPageProps) {
  return <div className={`${glassCard} overflow-hidden`}>{children}</div>;
}
