import { GenericDataTable, culturalEntityTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function EntityKnowledgePage() {
  return (
    <KnowledgeListPage domain="entity">
      <GenericDataTable config={culturalEntityTableConfig} />
    </KnowledgeListPage>
  );
}
