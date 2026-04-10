import { GenericDataTable, sourceTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function SourceKnowledgePage() {
  return (
    <KnowledgeListPage>
      <GenericDataTable config={sourceTableConfig} />
    </KnowledgeListPage>
  );
}
