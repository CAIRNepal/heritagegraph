import { GenericDataTable, festivalTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function FestivalKnowledgePage() {
  return (
    <KnowledgeListPage domain="festival">
      <GenericDataTable config={festivalTableConfig} />
    </KnowledgeListPage>
  );
}
