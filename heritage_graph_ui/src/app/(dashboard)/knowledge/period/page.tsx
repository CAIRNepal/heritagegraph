import { GenericDataTable, historicalPeriodTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function PeriodKnowledgePage() {
  return (
    <KnowledgeListPage>
      <GenericDataTable config={historicalPeriodTableConfig} />
    </KnowledgeListPage>
  );
}
