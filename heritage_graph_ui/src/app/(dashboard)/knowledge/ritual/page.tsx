import { GenericDataTable, ritualTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function RitualKnowledgePage() {
  return (
    <KnowledgeListPage>
      <GenericDataTable config={ritualTableConfig} />
    </KnowledgeListPage>
  );
}
