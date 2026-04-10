import { GenericDataTable, monumentTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function MonumentKnowledgePage() {
  return (
    <KnowledgeListPage
      title="Monuments"
      description="Standalone monuments and commemorative structures with cultural significance."
      contributeHref="/contribute/monument"
    >
      <GenericDataTable config={monumentTableConfig} />
    </KnowledgeListPage>
  );
}
