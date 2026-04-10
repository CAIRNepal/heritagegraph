import { GenericDataTable, traditionTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function TraditionKnowledgePage() {
  return (
    <KnowledgeListPage>
      <GenericDataTable config={traditionTableConfig} />
    </KnowledgeListPage>
  );
}
