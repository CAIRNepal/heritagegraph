'use client';

/**
 * Generic knowledge-list page for any *navigable* ontology class that does not
 * have a hand-written static page (e.g. caste_group, calendar, syncretism,
 * kumari_*). The dashboard sidebar links every navigable class to
 * `/knowledge/<key>`, so without this fallback those links 404.
 *
 * It builds a DataTableConfig from the live ontology registry: the class's API
 * endpoint, its text fields as columns, and a link to the per-entity view
 * (handled by the sibling `[domain]/view/[id]` route).
 */

import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';

import { GenericDataTable, type DataTableConfig } from '@/components/generic-data-table';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';
import { useOntology } from '@/lib/ontology/OntologyProvider';

type Row = Record<string, unknown> & { id: number | string };

export default function GenericKnowledgePage() {
  const params = useParams();
  const domain = String(params?.domain ?? '');
  const { registry } = useOntology();
  const cls = registry.classes?.[domain];

  // Unknown or non-navigable class -> 404 (matches Next.js not-found behavior).
  if (!cls || !cls.navigable) {
    notFound();
  }

  const labelFieldKey =
    cls.fields.find((f) => f.slot_uri === 'rdfs:label')?.key ?? 'name';

  // Show the label field plus a few other simple scalar fields as columns.
  const displayFields = cls.fields
    .filter((f) => ['text', 'textarea', 'select', 'enum'].includes(f.type))
    .slice(0, 4);

  const columns: ColumnDef<Row>[] = displayFields.map((field) => ({
    accessorKey: field.key,
    header: field.label,
    cell: ({ row }) => {
      const value = row.original[field.key];
      const text = value == null ? '' : String(value);
      if (field.key === labelFieldKey) {
        return (
          <Link
            href={`/knowledge/${domain}/view/${row.original.id}`}
            className="font-medium text-blue-600 hover:underline"
          >
            {text || '(unnamed)'}
          </Link>
        );
      }
      return <span className="text-muted-foreground">{text}</span>;
    },
  }));

  const config: DataTableConfig<Row> = {
    endpoint: cls.apiEndpoint,
    columns,
    dataKey: 'results',
    viewBasePath: `/knowledge/${domain}`,
    title: cls.labelPlural ?? cls.label,
    description: cls.description,
    showHeader: true,
    tabs: false,
    rowIdField: 'id',
    idField: 'id',
    addAction: {
      label: `Add ${cls.label}`,
      href: `/contribute/${domain.replace(/_/g, '-')}`,
    },
  };

  return (
    <KnowledgeListPage>
      <GenericDataTable config={config} />
    </KnowledgeListPage>
  );
}
