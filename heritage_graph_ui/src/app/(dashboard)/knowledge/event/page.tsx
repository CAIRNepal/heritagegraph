import { GenericDataTable, eventTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function EventKnowledgePage() {
  return (
    <KnowledgeListPage
      title="Events"
      description="Cultural, historical, and ritual events with optional links to people, places, and traditions."
      contributeHref="/contribute/event"
    >
      <GenericDataTable config={eventTableConfig} />
    </KnowledgeListPage>
  );
}
