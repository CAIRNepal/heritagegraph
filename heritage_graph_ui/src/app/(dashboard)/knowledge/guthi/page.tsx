import { GenericDataTable, guthiTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function GuthiKnowledgePage() {
  return (
    <KnowledgeListPage
      title="Guthi"
      description="Endowments and traditional institutions that steward cultural and religious assets."
      contributeHref="/contribute/guthi"
    >
      <GenericDataTable config={guthiTableConfig} />
    </KnowledgeListPage>
  );
}
