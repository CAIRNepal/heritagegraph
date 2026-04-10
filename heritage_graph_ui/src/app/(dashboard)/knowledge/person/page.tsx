import { GenericDataTable, personTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function PersonKnowledgePage() {
  return (
    <KnowledgeListPage>
      <GenericDataTable config={personTableConfig} />
    </KnowledgeListPage>
  );
}
