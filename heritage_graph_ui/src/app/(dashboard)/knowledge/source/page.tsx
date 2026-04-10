import { GenericDataTable, sourceTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function SourceKnowledgePage() {
  return (
    <KnowledgeListPage
      title="Sources"
      description="Bibliographic and documentary references that support claims in the knowledge base."
      contributeHref="/contribute/source"
    >
      <GenericDataTable config={sourceTableConfig} />
    </KnowledgeListPage>
  );
}
