import { GenericDataTable, monumentTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function MonumentKnowledgePage() {
  return (
    <KnowledgeListPage>
      <GenericDataTable config={monumentTableConfig} />
    </KnowledgeListPage>
  );
}
