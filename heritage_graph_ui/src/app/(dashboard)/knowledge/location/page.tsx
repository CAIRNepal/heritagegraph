import { GenericDataTable, locationTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function LocationKnowledgePage() {
  return (
    <KnowledgeListPage>
      <GenericDataTable config={locationTableConfig} />
    </KnowledgeListPage>
  );
}
