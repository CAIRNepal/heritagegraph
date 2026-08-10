import { GenericDataTable, iconographyTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export default function IconographyKnowledgePage() {
  return (
    <KnowledgeListPage domain="iconography">
      <GenericDataTable config={iconographyTableConfig} />
    </KnowledgeListPage>
  );
}
