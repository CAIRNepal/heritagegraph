import { GenericDataTable, iconographyTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function IconographyKnowledgePage() {
  return (
    <KnowledgeListPage
      title="Iconography"
      description="Symbols, motifs, and visual programs used in heritage art and ritual contexts."
      contributeHref="/contribute/iconography"
    >
      <GenericDataTable config={iconographyTableConfig} />
    </KnowledgeListPage>
  );
}
