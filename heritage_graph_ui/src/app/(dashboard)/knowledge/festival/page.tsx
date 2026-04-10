import { GenericDataTable, festivalTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function FestivalKnowledgePage() {
  return (
    <KnowledgeListPage>
      <GenericDataTable config={festivalTableConfig} />
    </KnowledgeListPage>
  );
}
