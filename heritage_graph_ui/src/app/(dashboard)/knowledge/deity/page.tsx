import { GenericDataTable, deityTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function DeityKnowledgePage() {
  return (
    <KnowledgeListPage
      title="Deities"
      description="Divine figures and worship traditions as represented in documented heritage sources."
      contributeHref="/contribute/deity"
    >
      <GenericDataTable config={deityTableConfig} />
    </KnowledgeListPage>
  );
}
