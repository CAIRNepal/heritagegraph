import { GenericDataTable, ritualTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function RitualKnowledgePage() {
  return (
    <KnowledgeListPage
      title="Rituals"
      description="Ceremonial acts, worship sequences, and ritual programs tied to time, place, or community."
      contributeHref="/contribute/ritual"
    >
      <GenericDataTable config={ritualTableConfig} />
    </KnowledgeListPage>
  );
}
