'use client';

import Link from 'next/link';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Eye } from 'lucide-react';

import type {
  PersonRecord,
  LocationRecord,
  EventRecord,
  TraditionRecord,
  CulturalEntityRecord,
  SourceRecord,
  HistoricalPeriodRecord,
  DataTableConfig,
} from './types';

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDate(dateString?: string): string {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return dateString;
  }
}

function getStatusColor(status?: string): string {
  switch (status?.toLowerCase()) {
    case 'approved':
    case 'published':
      return 'text-green-600 dark:text-green-400 border-green-500';
    case 'pending':
    case 'draft':
      return 'text-yellow-600 dark:text-yellow-400 border-yellow-500';
    case 'rejected':
      return 'text-red-600 dark:text-red-400 border-red-500';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}

// ============================================
// PERSON COLUMNS
// ============================================

export const personColumns: ColumnDef<PersonRecord>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => {
      const item = row.original;
      return (
        <HoverCard>
          <HoverCardTrigger asChild>
            <Link
              href={`/dashboard/knowledge/person/view/${item.id}`}
              className="text-blue-600 hover:underline font-medium"
            >
              {item.name || item.title || '-'}
            </Link>
          </HoverCardTrigger>
          <HoverCardContent className="w-80">
            <div className="space-y-3">
              <h4 className="font-semibold">{item.name}</h4>
              {item.occupation && (
                <p className="text-sm text-muted-foreground italic">
                  {item.occupation}
                </p>
              )}
              {item.biography && (
                <p className="text-sm line-clamp-3">{item.biography}</p>
              )}
              {item.aliases && (
                <p className="text-xs text-muted-foreground">
                  Also known as: {item.aliases}
                </p>
              )}
              <div className="pt-2">
                <Link href={`/dashboard/knowledge/person/view/${item.id}`}>
                  <Button variant="default" size="sm" className="w-full text-xs">
                    <Eye className="h-3 w-3 mr-1" /> View Details
                  </Button>
                </Link>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      );
    },
    enableHiding: false,
    enableColumnFilter: true,
  },
  {
    accessorKey: 'occupation',
    header: 'Occupation',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.occupation || '-'}</span>
    ),
    enableColumnFilter: true,
  },
  {
    accessorKey: 'birth_date',
    header: 'Birth',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.birth_date || '-'}
      </span>
    ),
  },
  {
    accessorKey: 'death_date',
    header: 'Death',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.death_date || '-'}
      </span>
    ),
  },
  {
    accessorKey: 'contributor',
    header: 'Contributor',
    cell: ({ row }) => {
      const contributor = row.original.contributor;
      if (!contributor) return '-';
      return (
        <Link href={`/dashboard/users/${contributor}`}>
          <Badge variant="secondary" className="cursor-pointer">
            @{contributor}
          </Badge>
        </Link>
      );
    },
    enableColumnFilter: true,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status;
      if (!status) return '-';
      return (
        <Badge variant="outline" className={getStatusColor(status)}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      );
    },
    enableColumnFilter: true,
  },
  {
    accessorKey: 'created_at',
    header: 'Created',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(row.original.created_at)}
      </span>
    ),
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/dashboard/knowledge/person/view/${row.original.id}`}>
          View
        </Link>
      </Button>
    ),
    enableColumnFilter: false,
  },
];

// ============================================
// LOCATION COLUMNS
// ============================================

export const locationColumns: ColumnDef<LocationRecord>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => {
      const item = row.original;
      return (
        <HoverCard>
          <HoverCardTrigger asChild>
            <Link
              href={`/dashboard/knowledge/location/view/${item.id}`}
              className="text-blue-600 hover:underline font-medium"
            >
              {item.name || item.title || '-'}
            </Link>
          </HoverCardTrigger>
          <HoverCardContent className="w-80">
            <div className="space-y-3">
              <h4 className="font-semibold">{item.name}</h4>
              {item.type && (
                <Badge variant="outline">{item.type}</Badge>
              )}
              {item.description && (
                <p className="text-sm line-clamp-3">{item.description}</p>
              )}
              {item.coordinates && (
                <p className="text-xs text-muted-foreground">
                  📍 {item.coordinates}
                </p>
              )}
              <div className="pt-2">
                <Link href={`/dashboard/knowledge/location/view/${item.id}`}>
                  <Button variant="default" size="sm" className="w-full text-xs">
                    <Eye className="h-3 w-3 mr-1" /> View Details
                  </Button>
                </Link>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      );
    },
    enableHiding: false,
    enableColumnFilter: true,
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => {
      const type = row.original.type;
      if (!type) return '-';
      return (
        <Badge variant="secondary">
          {type.replace('_', ' ').charAt(0).toUpperCase() +
            type.replace('_', ' ').slice(1)}
        </Badge>
      );
    },
    enableColumnFilter: true,
  },
  {
    accessorKey: 'current_status',
    header: 'Condition',
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.current_status?.replace('_', ' ') || '-'}
      </span>
    ),
    enableColumnFilter: true,
  },
  {
    accessorKey: 'coordinates',
    header: 'Coordinates',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.coordinates || '-'}
      </span>
    ),
  },
  {
    accessorKey: 'contributor',
    header: 'Contributor',
    cell: ({ row }) => {
      const contributor = row.original.contributor;
      if (!contributor) return '-';
      return (
        <Link href={`/dashboard/users/${contributor}`}>
          <Badge variant="secondary" className="cursor-pointer">
            @{contributor}
          </Badge>
        </Link>
      );
    },
    enableColumnFilter: true,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status;
      if (!status) return '-';
      return (
        <Badge variant="outline" className={getStatusColor(status)}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      );
    },
    enableColumnFilter: true,
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/dashboard/knowledge/location/view/${row.original.id}`}>
          View
        </Link>
      </Button>
    ),
    enableColumnFilter: false,
  },
];

// ============================================
// EVENT COLUMNS
// ============================================

export const eventColumns: ColumnDef<EventRecord>[] = [
  {
    accessorKey: 'name',
    header: 'Event',
    cell: ({ row }) => {
      const item = row.original;
      return (
        <HoverCard>
          <HoverCardTrigger asChild>
            <Link
              href={`/dashboard/knowledge/event/view/${item.id}`}
              className="text-blue-600 hover:underline font-medium"
            >
              {item.name || item.title || '-'}
            </Link>
          </HoverCardTrigger>
          <HoverCardContent className="w-80">
            <div className="space-y-3">
              <h4 className="font-semibold">{item.name || item.title}</h4>
              {item.event_type && (
                <Badge variant="outline">{item.event_type}</Badge>
              )}
              {item.description && (
                <p className="text-sm line-clamp-3">{item.description}</p>
              )}
              {(item.start_date || item.end_date) && (
                <p className="text-xs text-muted-foreground">
                  📅 {item.start_date || '?'} - {item.end_date || '?'}
                </p>
              )}
              <div className="pt-2">
                <Link href={`/dashboard/knowledge/event/view/${item.id}`}>
                  <Button variant="default" size="sm" className="w-full text-xs">
                    <Eye className="h-3 w-3 mr-1" /> View Details
                  </Button>
                </Link>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      );
    },
    enableHiding: false,
    enableColumnFilter: true,
  },
  {
    accessorKey: 'event_type',
    header: 'Type',
    cell: ({ row }) => {
      const type = row.original.event_type;
      if (!type) return '-';
      return <Badge variant="secondary">{type}</Badge>;
    },
    enableColumnFilter: true,
  },
  {
    accessorKey: 'start_date',
    header: 'Start Date',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.start_date || '-'}</span>
    ),
  },
  {
    accessorKey: 'end_date',
    header: 'End Date',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.end_date || '-'}</span>
    ),
  },
  {
    accessorKey: 'recurrence',
    header: 'Recurrence',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.recurrence || '-'}</span>
    ),
    enableColumnFilter: true,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status;
      if (!status) return '-';
      return (
        <Badge variant="outline" className={getStatusColor(status)}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      );
    },
    enableColumnFilter: true,
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/dashboard/knowledge/event/view/${row.original.id}`}>
          View
        </Link>
      </Button>
    ),
    enableColumnFilter: false,
  },
];

// ============================================
// TRADITION COLUMNS
// ============================================

export const traditionColumns: ColumnDef<TraditionRecord>[] = [
  {
    accessorKey: 'name',
    header: 'Tradition',
    cell: ({ row }) => {
      const item = row.original;
      return (
        <HoverCard>
          <HoverCardTrigger asChild>
            <Link
              href={`/dashboard/knowledge/tradition/view/${item.id}`}
              className="text-blue-600 hover:underline font-medium"
            >
              {item.name || item.title || '-'}
            </Link>
          </HoverCardTrigger>
          <HoverCardContent className="w-80">
            <div className="space-y-3">
              <h4 className="font-semibold">{item.name || item.title}</h4>
              {item.tradition_type && (
                <Badge variant="outline">{item.tradition_type}</Badge>
              )}
              {item.description && (
                <p className="text-sm line-clamp-3">{item.description}</p>
              )}
              <div className="pt-2">
                <Link href={`/dashboard/knowledge/tradition/view/${item.id}`}>
                  <Button variant="default" size="sm" className="w-full text-xs">
                    <Eye className="h-3 w-3 mr-1" /> View Details
                  </Button>
                </Link>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      );
    },
    enableHiding: false,
    enableColumnFilter: true,
  },
  {
    accessorKey: 'tradition_type',
    header: 'Type',
    cell: ({ row }) => {
      const type = row.original.tradition_type;
      if (!type) return '-';
      return <Badge variant="secondary">{type}</Badge>;
    },
    enableColumnFilter: true,
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => (
      <span className="text-sm line-clamp-2 max-w-xs">
        {row.original.description || '-'}
      </span>
    ),
  },
  {
    accessorKey: 'contributor',
    header: 'Contributor',
    cell: ({ row }) => {
      const contributor = row.original.contributor;
      if (!contributor) return '-';
      return (
        <Link href={`/dashboard/users/${contributor}`}>
          <Badge variant="secondary" className="cursor-pointer">
            @{contributor}
          </Badge>
        </Link>
      );
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status;
      if (!status) return '-';
      return (
        <Badge variant="outline" className={getStatusColor(status)}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      );
    },
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/dashboard/knowledge/tradition/view/${row.original.id}`}>
          View
        </Link>
      </Button>
    ),
    enableColumnFilter: false,
  },
];

// ============================================
// CULTURAL ENTITY COLUMNS
// ============================================

export const culturalEntityColumns: ColumnDef<CulturalEntityRecord>[] = [
  {
    accessorKey: 'label',
    header: 'Label',
    cell: ({ row }) => {
      const item = row.original;
      return (
        <HoverCard>
          <HoverCardTrigger asChild>
            <Link
              href={`/dashboard/knowledge/entity/view/${item.entity_id}`}
              className="text-blue-600 hover:underline font-medium"
            >
              {item.label}
            </Link>
          </HoverCardTrigger>
          <HoverCardContent className="w-80">
            <div className="space-y-3">
              <h4 className="font-semibold">{item.label}</h4>
              <Badge variant="outline">{item.category.replace('_', ' ')}</Badge>
              <Badge variant="secondary" className={getStatusColor(item.status)}>
                {item.status}
              </Badge>
              <div className="pt-2">
                <Link href={`/dashboard/knowledge/entity/view/${item.entity_id}`}>
                  <Button variant="default" size="sm" className="w-full text-xs">
                    <Eye className="h-3 w-3 mr-1" /> View Details
                  </Button>
                </Link>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      );
    },
    enableHiding: false,
    enableColumnFilter: true,
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => (
      <Badge variant="secondary">
        {row.original.category.replace('_', ' ')}
      </Badge>
    ),
    enableColumnFilter: true,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status;
      return (
        <Badge variant="outline" className={getStatusColor(status)}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      );
    },
    enableColumnFilter: true,
  },
  {
    accessorKey: 'created_by',
    header: 'Created By',
    cell: ({ row }) => {
      const creator = row.original.created_by;
      if (!creator) return '-';
      return (
        <Link href={`/dashboard/users/${creator}`}>
          <Badge variant="secondary" className="cursor-pointer">
            @{creator}
          </Badge>
        </Link>
      );
    },
  },
  {
    accessorKey: 'created_at',
    header: 'Created',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(row.original.created_at)}
      </span>
    ),
  },
  {
    accessorKey: 'updated_at',
    header: 'Updated',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(row.original.updated_at)}
      </span>
    ),
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/dashboard/knowledge/entity/view/${row.original.entity_id}`}>
          View
        </Link>
      </Button>
    ),
    enableColumnFilter: false,
  },
];

// ============================================
// SOURCE COLUMNS
// ============================================

export const sourceColumns: ColumnDef<SourceRecord>[] = [
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) => {
      const item = row.original;
      return (
        <HoverCard>
          <HoverCardTrigger asChild>
            <Link
              href={`/dashboard/knowledge/source/view/${item.id}`}
              className="text-blue-600 hover:underline font-medium"
            >
              {item.title || item.name || '-'}
            </Link>
          </HoverCardTrigger>
          <HoverCardContent className="w-80">
            <div className="space-y-3">
              <h4 className="font-semibold">{item.title || item.name}</h4>
              {item.source_type && (
                <Badge variant="outline">{item.source_type}</Badge>
              )}
              {item.author && (
                <p className="text-sm text-muted-foreground">By: {item.author}</p>
              )}
              {item.description && (
                <p className="text-sm line-clamp-3">{item.description}</p>
              )}
              <div className="pt-2">
                <Link href={`/dashboard/knowledge/source/view/${item.id}`}>
                  <Button variant="default" size="sm" className="w-full text-xs">
                    <Eye className="h-3 w-3 mr-1" /> View Details
                  </Button>
                </Link>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      );
    },
    enableHiding: false,
    enableColumnFilter: true,
  },
  {
    accessorKey: 'source_type',
    header: 'Type',
    cell: ({ row }) => {
      const type = row.original.source_type;
      if (!type) return '-';
      return <Badge variant="secondary">{type}</Badge>;
    },
    enableColumnFilter: true,
  },
  {
    accessorKey: 'author',
    header: 'Author',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.author || '-'}</span>
    ),
    enableColumnFilter: true,
  },
  {
    accessorKey: 'publication_date',
    header: 'Published',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.publication_date || '-'}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status;
      if (!status) return '-';
      return (
        <Badge variant="outline" className={getStatusColor(status)}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      );
    },
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/dashboard/knowledge/source/view/${row.original.id}`}>
          View
        </Link>
      </Button>
    ),
    enableColumnFilter: false,
  },
];

// ============================================
// HISTORICAL PERIOD COLUMNS
// ============================================

export const historicalPeriodColumns: ColumnDef<HistoricalPeriodRecord>[] = [
  {
    accessorKey: 'name',
    header: 'Period',
    cell: ({ row }) => {
      const item = row.original;
      return (
        <HoverCard>
          <HoverCardTrigger asChild>
            <Link
              href={`/dashboard/knowledge/period/view/${item.id}`}
              className="text-blue-600 hover:underline font-medium"
            >
              {item.name || item.title || '-'}
            </Link>
          </HoverCardTrigger>
          <HoverCardContent className="w-80">
            <div className="space-y-3">
              <h4 className="font-semibold">{item.name || item.title}</h4>
              {(item.start_year || item.end_year) && (
                <p className="text-sm text-muted-foreground">
                  📅 {item.start_year || '?'} - {item.end_year || '?'}
                </p>
              )}
              {item.description && (
                <p className="text-sm line-clamp-3">{item.description}</p>
              )}
              <div className="pt-2">
                <Link href={`/dashboard/knowledge/period/view/${item.id}`}>
                  <Button variant="default" size="sm" className="w-full text-xs">
                    <Eye className="h-3 w-3 mr-1" /> View Details
                  </Button>
                </Link>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      );
    },
    enableHiding: false,
    enableColumnFilter: true,
  },
  {
    accessorKey: 'start_year',
    header: 'Start',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.start_year || '-'}</span>
    ),
  },
  {
    accessorKey: 'end_year',
    header: 'End',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.end_year || '-'}</span>
    ),
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => (
      <span className="text-sm line-clamp-2 max-w-xs">
        {row.original.description || '-'}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status;
      if (!status) return '-';
      return (
        <Badge variant="outline" className={getStatusColor(status)}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      );
    },
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/dashboard/knowledge/period/view/${row.original.id}`}>
          View
        </Link>
      </Button>
    ),
    enableColumnFilter: false,
  },
];

// ============================================
// PRE-CONFIGURED TABLE CONFIGS
// ============================================

export const personTableConfig: DataTableConfig<PersonRecord> = {
  endpoint: '/cidoc/persons/',
  columns: personColumns,
  dataKey: 'results',
  viewBasePath: '/dashboard/knowledge/person',
  title: 'Persons',
  description: 'Browse historical and cultural figures in the knowledge base.',
  showHeader: true,
  addAction: {
    label: 'Add Person',
    href: '/dashboard/contribute/person',
  },
};

export const locationTableConfig: DataTableConfig<LocationRecord> = {
  endpoint: '/cidoc/locations/',
  columns: locationColumns,
  dataKey: 'results',
  viewBasePath: '/dashboard/knowledge/location',
  title: 'Locations',
  description: 'Browse heritage sites and cultural locations.',
  showHeader: true,
  addAction: {
    label: 'Add Location',
    href: '/dashboard/contribute/location',
  },
};

export const eventTableConfig: DataTableConfig<EventRecord> = {
  endpoint: '/cidoc/events/',
  columns: eventColumns,
  dataKey: 'results',
  viewBasePath: '/dashboard/knowledge/event',
  title: 'Events',
  description: 'Browse cultural events, festivals, and historical occurrences.',
  showHeader: true,
  addAction: {
    label: 'Add Event',
    href: '/dashboard/contribute/event',
  },
};

export const traditionTableConfig: DataTableConfig<TraditionRecord> = {
  endpoint: '/cidoc/traditions/',
  columns: traditionColumns,
  dataKey: 'results',
  viewBasePath: '/dashboard/knowledge/tradition',
  title: 'Traditions',
  description: 'Browse cultural practices and intangible heritage traditions.',
  showHeader: true,
  addAction: {
    label: 'Add Tradition',
    href: '/dashboard/contribute/tradition',
  },
};

export const culturalEntityTableConfig: DataTableConfig<CulturalEntityRecord> = {
  endpoint: '/data/cultural-entities/',
  columns: culturalEntityColumns,
  dataKey: 'results',
  viewBasePath: '/dashboard/knowledge/entity',
  title: 'Cultural Entities',
  description: 'Browse contributed cultural entities — monuments, festivals, rituals, traditions, and artifacts.',
  showHeader: true,
  addAction: {
    label: 'Add Entity',
    href: '/dashboard/contribute',
  },
};

export const sourceTableConfig: DataTableConfig<SourceRecord> = {
  endpoint: '/cidoc/sources/',
  columns: sourceColumns,
  dataKey: 'results',
  viewBasePath: '/dashboard/knowledge/source',
  title: 'Sources',
  description: 'Browse documentary sources, manuscripts, and reference materials.',
  showHeader: true,
  addAction: {
    label: 'Add Source',
    href: '/dashboard/contribute/source',
  },
};

export const historicalPeriodTableConfig: DataTableConfig<HistoricalPeriodRecord> = {
  endpoint: '/cidoc/historical_periods/',
  columns: historicalPeriodColumns,
  dataKey: 'results',
  viewBasePath: '/dashboard/knowledge/period',
  title: 'Historical Periods',
  description: 'Browse historical eras and time periods.',
  showHeader: true,
  addAction: {
    label: 'Add Period',
    href: '/dashboard/contribute/period',
  },
};
