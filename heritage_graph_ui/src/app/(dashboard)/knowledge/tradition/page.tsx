import { GenericDataTable, traditionTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function TraditionKnowledgePage() {
  return (
    <KnowledgeListPage
      title="Traditions and practices"
      description="Living traditions, customs, and recurring cultural practices documented in the graph."
      contributeHref="/contribute/tradition"
    >
      <GenericDataTable config={traditionTableConfig} />
    </KnowledgeListPage>
  );
}
