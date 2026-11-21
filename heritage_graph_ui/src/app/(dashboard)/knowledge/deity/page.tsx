import { GenericDataTable, deityTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function DeityKnowledgePage() {
  return (
    <KnowledgeListPage domain="deity">
      <GenericDataTable config={deityTableConfig} />
    </KnowledgeListPage>
  );
}
