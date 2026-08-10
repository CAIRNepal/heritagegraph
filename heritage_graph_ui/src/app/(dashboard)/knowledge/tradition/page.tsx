import { GenericDataTable, traditionTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function TraditionKnowledgePage() {
  return (
    <KnowledgeListPage domain="tradition">
      <GenericDataTable config={traditionTableConfig} />
    </KnowledgeListPage>
  );
}
