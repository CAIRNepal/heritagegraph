import { GenericDataTable, locationTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function LocationKnowledgePage() {
  return (
    <KnowledgeListPage
      title="Locations"
      description="Heritage places, sites, and spatial anchors used across the knowledge graph."
      contributeHref="/contribute/location"
    >
      <GenericDataTable config={locationTableConfig} />
    </KnowledgeListPage>
  );
}
