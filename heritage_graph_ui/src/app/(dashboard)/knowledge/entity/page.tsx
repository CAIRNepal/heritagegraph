import { GenericDataTable, culturalEntityTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function EntityKnowledgePage() {
  return (
    <KnowledgeListPage
      title="Cultural entities"
      description="Community-submitted and curated heritage records in the CulturalEntity workflow. Open a row for detail, revision history, and review context."
      contributeHref="/contribute/entity"
    >
      <GenericDataTable config={culturalEntityTableConfig} />
    </KnowledgeListPage>
  );
}
