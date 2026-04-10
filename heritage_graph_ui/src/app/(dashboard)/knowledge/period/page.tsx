import { GenericDataTable, historicalPeriodTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function PeriodKnowledgePage() {
  return (
    <KnowledgeListPage
      title="Historical periods"
      description="Reigns, dynasties, and time spans used to contextualize heritage records."
      contributeHref="/contribute/period"
    >
      <GenericDataTable config={historicalPeriodTableConfig} />
    </KnowledgeListPage>
  );
}
