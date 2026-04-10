import { GenericDataTable, guthiTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function GuthiKnowledgePage() {
  return (
    <KnowledgeListPage>
      <GenericDataTable config={guthiTableConfig} />
    </KnowledgeListPage>
  );
}
