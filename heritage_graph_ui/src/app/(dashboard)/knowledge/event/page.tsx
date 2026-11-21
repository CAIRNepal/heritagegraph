import { GenericDataTable, eventTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function EventKnowledgePage() {
  return (
    <KnowledgeListPage domain="event">
      <GenericDataTable config={eventTableConfig} />
    </KnowledgeListPage>
  );
}
