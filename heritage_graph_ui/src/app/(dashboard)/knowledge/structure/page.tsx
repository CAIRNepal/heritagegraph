import { GenericDataTable, structureTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function StructureKnowledgePage() {
  return (
    <KnowledgeListPage
      title="Structures"
      description="Built heritage: temples, monuments, palaces, and other physical structures."
      contributeHref="/contribute/structure"
    >
      <GenericDataTable config={structureTableConfig} />
    </KnowledgeListPage>
  );
}
