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

import { Badge } from '@/components/ui/badge';
import {
  GenericDataTable,
  type DataTableConfig,
} from '@/components/generic-data-table';
import { getStatusColor } from '@/components/generic-data-table/columns';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';
import { useOntology } from '@/lib/ontology/OntologyProvider';

type Row = Record<string, unknown> & { id: number | string };

/** Provenance / identity browsers — no contribution workflow status tabs. */
const BROWSE_ONLY_DOMAINS = new Set(['assertion', 'entity_cluster']);

/** Domains without a matching `/contribute/<segment>/page.tsx`. */
const CONTRIBUTE_HREF_OVERRIDES: Record<string, string> = {
  entity_cluster: '/contribute/entity-proposal',
};

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

  const columns: ColumnDef<Row>[] = [];

  if (!BROWSE_ONLY_DOMAINS.has(domain)) {
    columns.push({
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        if (!status) return <span className="text-muted-foreground">—</span>;
        const text = String(status).replace(/_/g, ' ');
        return (
          <Badge variant="outline" className={getStatusColor(String(status))}>
            {text.charAt(0).toUpperCase() + text.slice(1)}
          </Badge>
        );
      },
    });
  }

  columns.push(...displayFields.map((field) => ({
    accessorKey: field.key,
    header: field.label,
    cell: ({ row }: { row: { original: Record<string, unknown> } }) => {
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
  })));

  const contributeHref =
    CONTRIBUTE_HREF_OVERRIDES[domain] ??
    `/contribute/${domain.replace(/_/g, '-')}`;

  const config: DataTableConfig<Row> = {
    endpoint: cls.apiEndpoint,
    columns,
    dataKey: 'results',
    serverPagination: true,
    enableServerSearch: true,
    viewBasePath: `/knowledge/${domain}`,
    title: cls.labelPlural ?? cls.label,
    description: cls.description,
    showHeader: true,
    ...(BROWSE_ONLY_DOMAINS.has(domain) ? { tabs: false as const } : {}),
    defaultTabId: BROWSE_ONLY_DOMAINS.has(domain) ? undefined : 'approved',
    rowIdField: 'id',
    idField: 'id',
    addAction: {
      label:
        domain === 'entity_cluster' ? 'Propose identity cluster' : `Add ${cls.label}`,
      href: contributeHref,
    },
  };

  return (
    <KnowledgeListPage>
      <GenericDataTable config={config} />
    </KnowledgeListPage>
  );
}
