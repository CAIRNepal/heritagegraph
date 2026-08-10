import { GenericDataTable, ritualTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function RitualKnowledgePage() {
  return (
    <KnowledgeListPage domain="ritual">
      <GenericDataTable config={ritualTableConfig} />
    </KnowledgeListPage>
  );
}
