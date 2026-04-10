import { GenericDataTable, personTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function PersonKnowledgePage() {
  return (
    <KnowledgeListPage
      title="Persons"
      description="Historical and contemporary people linked to heritage narratives. Data follows the CIDOC-CRM person model where applicable."
      contributeHref="/contribute/person"
    >
      <GenericDataTable config={personTableConfig} />
    </KnowledgeListPage>
  );
}
