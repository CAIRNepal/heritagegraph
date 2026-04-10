import { GenericDataTable, festivalTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function FestivalKnowledgePage() {
  return (
    <KnowledgeListPage
      title="Festivals"
      description="Annual and periodic public celebrations, processions, and calendar-bound gatherings."
      contributeHref="/contribute/festival"
    >
      <GenericDataTable config={festivalTableConfig} />
    </KnowledgeListPage>
  );
}
