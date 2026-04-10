import { GenericDataTable, structureTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function StructureKnowledgePage() {
  return (
    <KnowledgeListPage>
      <GenericDataTable config={structureTableConfig} />
    </KnowledgeListPage>
  );
}
