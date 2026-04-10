import { GenericDataTable, deityTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function DeityKnowledgePage() {
  return (
    <KnowledgeListPage>
      <GenericDataTable config={deityTableConfig} />
    </KnowledgeListPage>
  );
}
