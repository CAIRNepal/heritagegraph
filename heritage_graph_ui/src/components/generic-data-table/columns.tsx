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
  DeityRecord,
  GuthiRecord,
  StructureRecord,
  RitualRecord,
  FestivalRecord,
  IconographyRecord,
  MonumentRecord,
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
  const s = (status ?? '').toLowerCase().replace(/\s+/g, '_');
  switch (s) {
    case 'approved':
    case 'published':
    case 'accepted':
    case 'merged':
      return 'text-green-600 dark:text-green-400 border-green-500';
    case 'pending':
    case 'draft':
    case 'pending_review':
    case 'pending_revision':
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
              href={`/knowledge/person/view/${item.id}`}
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
                <Link href={`/knowledge/person/view/${item.id}`}>
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
        <Link href={`/users/${contributor}`}>
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
        <Link href={`/knowledge/person/view/${row.original.id}`}>
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
              href={`/knowledge/location/view/${item.id}`}
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
                <Link href={`/knowledge/location/view/${item.id}`}>
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
        <Link href={`/users/${contributor}`}>
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
        <Link href={`/knowledge/location/view/${row.original.id}`}>
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
              href={`/knowledge/event/view/${item.id}`}
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
                <Link href={`/knowledge/event/view/${item.id}`}>
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
        <Link href={`/knowledge/event/view/${row.original.id}`}>
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
              href={`/knowledge/tradition/view/${item.id}`}
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
                <Link href={`/knowledge/tradition/view/${item.id}`}>
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
        <Link href={`/users/${contributor}`}>
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
        <Link href={`/knowledge/tradition/view/${row.original.id}`}>
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
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => {
      const item = row.original;
      return (
        <HoverCard>
          <HoverCardTrigger asChild>
            <Link
              href={`/knowledge/entity/view/${item.entity_id}`}
              className="text-blue-600 hover:underline font-medium"
            >
              {item.name}
            </Link>
          </HoverCardTrigger>
          <HoverCardContent className="w-80">
            <div className="space-y-3">
              <h4 className="font-semibold">{item.name}</h4>
              <Badge variant="outline">{item.category.replace('_', ' ')}</Badge>
              <Badge variant="secondary" className={getStatusColor(item.status)}>
                {item.status ? item.status.replace(/_/g, ' ') : '—'}
              </Badge>
              <div className="pt-2">
                <Link href={`/knowledge/entity/view/${item.entity_id}`}>
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
      if (!status) return '-';
      return (
        <Badge variant="outline" className={getStatusColor(status)}>
          {status.replace(/_/g, ' ')}
        </Badge>
      );
    },
    enableColumnFilter: true,
  },
  {
    id: 'contributor',
    accessorFn: (row) => row.contributor?.username ?? '',
    header: 'Contributor',
    cell: ({ row }) => {
      const username = row.original.contributor?.username;
      if (!username) return '-';
      return (
        <Link href={`/users/${username}`}>
          <Badge variant="secondary" className="cursor-pointer">
            @{username}
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
        <Link href={`/knowledge/entity/view/${row.original.entity_id}`}>
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
              href={`/knowledge/source/view/${item.id}`}
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
                <Link href={`/knowledge/source/view/${item.id}`}>
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
        <Link href={`/knowledge/source/view/${row.original.id}`}>
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
              href={`/knowledge/period/view/${item.id}`}
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
                <Link href={`/knowledge/period/view/${item.id}`}>
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
        <Link href={`/knowledge/period/view/${row.original.id}`}>
          View
        </Link>
      </Button>
    ),
    enableColumnFilter: false,
  },
];

// ============================================
// DEITY COLUMNS
// ============================================

export const deityColumns: ColumnDef<DeityRecord>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => {
      const item = row.original;
      return (
        <HoverCard>
          <HoverCardTrigger asChild>
            <Link
              href={`/knowledge/deity/view/${item.id}`}
              className="text-blue-600 hover:underline font-medium"
            >
              {item.name || item.title || '-'}
            </Link>
          </HoverCardTrigger>
          <HoverCardContent className="w-80">
            <div className="space-y-3">
              <h4 className="font-semibold">{item.name}</h4>
              {item.religious_tradition && (
                <Badge variant="outline">{item.religious_tradition}</Badge>
              )}
              {item.note && (
                <p className="text-sm line-clamp-3">{item.note}</p>
              )}
              <div className="pt-2">
                <Link href={`/knowledge/deity/view/${item.id}`}>
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
    accessorKey: 'religious_tradition',
    header: 'Tradition',
    cell: ({ row }) => {
      const tradition = row.original.religious_tradition;
      if (!tradition) return '-';
      return <Badge variant="secondary">{tradition}</Badge>;
    },
    enableColumnFilter: true,
  },
  {
    accessorKey: 'alternate_names',
    header: 'Alternate Names',
    cell: ({ row }) => (
      <span className="text-sm line-clamp-1 max-w-xs">
        {row.original.alternate_names || '-'}
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
        <Link href={`/users/${contributor}`}>
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
    enableColumnFilter: true,
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/knowledge/deity/view/${row.original.id}`}>
          View
        </Link>
      </Button>
    ),
    enableColumnFilter: false,
  },
];

// ============================================
// GUTHI COLUMNS
// ============================================

export const guthiColumns: ColumnDef<GuthiRecord>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => {
      const item = row.original;
      return (
        <HoverCard>
          <HoverCardTrigger asChild>
            <Link
              href={`/knowledge/guthi/view/${item.id}`}
              className="text-blue-600 hover:underline font-medium"
            >
              {item.name || item.title || '-'}
            </Link>
          </HoverCardTrigger>
          <HoverCardContent className="w-80">
            <div className="space-y-3">
              <h4 className="font-semibold">{item.name}</h4>
              {item.guthi_type && (
                <Badge variant="outline">{item.guthi_type.replace('_', ' ')}</Badge>
              )}
              {item.location && (
                <p className="text-xs text-muted-foreground">📍 {item.location}</p>
              )}
              {item.note && (
                <p className="text-sm line-clamp-3">{item.note}</p>
              )}
              <div className="pt-2">
                <Link href={`/knowledge/guthi/view/${item.id}`}>
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
    accessorKey: 'guthi_type',
    header: 'Type',
    cell: ({ row }) => {
      const type = row.original.guthi_type;
      if (!type) return '-';
      return <Badge variant="secondary">{type.replace('_', ' ')}</Badge>;
    },
    enableColumnFilter: true,
  },
  {
    accessorKey: 'location',
    header: 'Location',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.location || '-'}</span>
    ),
    enableColumnFilter: true,
  },
  {
    accessorKey: 'contributor',
    header: 'Contributor',
    cell: ({ row }) => {
      const contributor = row.original.contributor;
      if (!contributor) return '-';
      return (
        <Link href={`/users/${contributor}`}>
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
    enableColumnFilter: true,
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/knowledge/guthi/view/${row.original.id}`}>
          View
        </Link>
      </Button>
    ),
    enableColumnFilter: false,
  },
];

// ============================================
// STRUCTURE COLUMNS
// ============================================

export const structureColumns: ColumnDef<StructureRecord>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => {
      const item = row.original;
      return (
        <HoverCard>
          <HoverCardTrigger asChild>
            <Link
              href={`/knowledge/structure/view/${item.id}`}
              className="text-blue-600 hover:underline font-medium"
            >
              {item.name || item.title || '-'}
            </Link>
          </HoverCardTrigger>
          <HoverCardContent className="w-80">
            <div className="space-y-3">
              <h4 className="font-semibold">{item.name}</h4>
              {item.structure_type && (
                <Badge variant="outline">{item.structure_type.replace('_', ' ')}</Badge>
              )}
              {item.architectural_style && (
                <Badge variant="secondary">{item.architectural_style.replace('_', ' ')}</Badge>
              )}
              {item.location_name && (
                <p className="text-xs text-muted-foreground">📍 {item.location_name}</p>
              )}
              <div className="pt-2">
                <Link href={`/knowledge/structure/view/${item.id}`}>
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
    accessorKey: 'structure_type',
    header: 'Type',
    cell: ({ row }) => {
      const type = row.original.structure_type;
      if (!type) return '-';
      return <Badge variant="secondary">{type.replace('_', ' ')}</Badge>;
    },
    enableColumnFilter: true,
  },
  {
    accessorKey: 'architectural_style',
    header: 'Style',
    cell: ({ row }) => {
      const style = row.original.architectural_style;
      if (!style) return '-';
      return <Badge variant="outline">{style.replace('_', ' ')}</Badge>;
    },
    enableColumnFilter: true,
  },
  {
    accessorKey: 'location_name',
    header: 'Location',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.location_name || '-'}</span>
    ),
    enableColumnFilter: true,
  },
  {
    accessorKey: 'existence_status',
    header: 'Condition',
    cell: ({ row }) => {
      const es = row.original.existence_status;
      if (!es) return '-';
      return <span className="text-sm">{es.replace('_', ' ')}</span>;
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
        <Link href={`/knowledge/structure/view/${row.original.id}`}>
          View
        </Link>
      </Button>
    ),
    enableColumnFilter: false,
  },
];

// ============================================
// RITUAL COLUMNS
// ============================================

export const ritualColumns: ColumnDef<RitualRecord>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => {
      const item = row.original;
      return (
        <HoverCard>
          <HoverCardTrigger asChild>
            <Link
              href={`/knowledge/ritual/view/${item.id}`}
              className="text-blue-600 hover:underline font-medium"
            >
              {item.name || item.title || '-'}
            </Link>
          </HoverCardTrigger>
          <HoverCardContent className="w-80">
            <div className="space-y-3">
              <h4 className="font-semibold">{item.name}</h4>
              {item.ritual_type && (
                <Badge variant="outline">{item.ritual_type}</Badge>
              )}
              {item.location_name && (
                <p className="text-xs text-muted-foreground">📍 {item.location_name}</p>
              )}
              {item.note && (
                <p className="text-sm line-clamp-3">{item.note}</p>
              )}
              <div className="pt-2">
                <Link href={`/knowledge/ritual/view/${item.id}`}>
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
    accessorKey: 'ritual_type',
    header: 'Type',
    cell: ({ row }) => {
      const type = row.original.ritual_type;
      if (!type) return '-';
      return <Badge variant="secondary">{type}</Badge>;
    },
    enableColumnFilter: true,
  },
  {
    accessorKey: 'date',
    header: 'Date',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.date || '-'}</span>
    ),
  },
  {
    accessorKey: 'performed_by',
    header: 'Performed By',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.performed_by || '-'}</span>
    ),
    enableColumnFilter: true,
  },
  {
    accessorKey: 'location_name',
    header: 'Location',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.location_name || '-'}</span>
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
        <Link href={`/knowledge/ritual/view/${row.original.id}`}>
          View
        </Link>
      </Button>
    ),
    enableColumnFilter: false,
  },
];

// ============================================
// FESTIVAL COLUMNS
// ============================================

export const festivalColumns: ColumnDef<FestivalRecord>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => {
      const item = row.original;
      return (
        <HoverCard>
          <HoverCardTrigger asChild>
            <Link
              href={`/knowledge/festival/view/${item.id}`}
              className="text-blue-600 hover:underline font-medium"
            >
              {item.name || item.title || '-'}
            </Link>
          </HoverCardTrigger>
          <HoverCardContent className="w-80">
            <div className="space-y-3">
              <h4 className="font-semibold">{item.name}</h4>
              {item.festival_type && (
                <Badge variant="outline">{item.festival_type}</Badge>
              )}
              {item.location_name && (
                <p className="text-xs text-muted-foreground">📍 {item.location_name}</p>
              )}
              {item.note && (
                <p className="text-sm line-clamp-3">{item.note}</p>
              )}
              <div className="pt-2">
                <Link href={`/knowledge/festival/view/${item.id}`}>
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
    accessorKey: 'festival_type',
    header: 'Type',
    cell: ({ row }) => {
      const type = row.original.festival_type;
      if (!type) return '-';
      return <Badge variant="secondary">{type}</Badge>;
    },
    enableColumnFilter: true,
  },
  {
    accessorKey: 'date',
    header: 'Date',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.date || '-'}</span>
    ),
  },
  {
    accessorKey: 'duration',
    header: 'Duration',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.duration || '-'}</span>
    ),
  },
  {
    accessorKey: 'location_name',
    header: 'Location',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.location_name || '-'}</span>
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
        <Link href={`/knowledge/festival/view/${row.original.id}`}>
          View
        </Link>
      </Button>
    ),
    enableColumnFilter: false,
  },
];

// ============================================
// ICONOGRAPHY COLUMNS
// ============================================

export const iconographyColumns: ColumnDef<IconographyRecord>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => {
      const item = row.original;
      return (
        <HoverCard>
          <HoverCardTrigger asChild>
            <Link
              href={`/knowledge/iconography/view/${item.id}`}
              className="text-blue-600 hover:underline font-medium"
            >
              {item.name || item.title || '-'}
            </Link>
          </HoverCardTrigger>
          <HoverCardContent className="w-80">
            <div className="space-y-3">
              <h4 className="font-semibold">{item.name}</h4>
              {item.object_type && (
                <Badge variant="outline">{item.object_type}</Badge>
              )}
              {item.depicts_deity && (
                <p className="text-sm text-muted-foreground">Depicts: {item.depicts_deity}</p>
              )}
              {item.note && (
                <p className="text-sm line-clamp-3">{item.note}</p>
              )}
              <div className="pt-2">
                <Link href={`/knowledge/iconography/view/${item.id}`}>
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
    accessorKey: 'object_type',
    header: 'Type',
    cell: ({ row }) => {
      const type = row.original.object_type;
      if (!type) return '-';
      return <Badge variant="secondary">{type}</Badge>;
    },
    enableColumnFilter: true,
  },
  {
    accessorKey: 'depicts_deity',
    header: 'Depicts',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.depicts_deity || '-'}</span>
    ),
    enableColumnFilter: true,
  },
  {
    accessorKey: 'technique',
    header: 'Technique',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.technique || '-'}</span>
    ),
  },
  {
    accessorKey: 'location_name',
    header: 'Location',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.location_name || '-'}</span>
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
        <Link href={`/knowledge/iconography/view/${row.original.id}`}>
          View
        </Link>
      </Button>
    ),
    enableColumnFilter: false,
  },
];

// ============================================
// MONUMENT COLUMNS
// ============================================

export const monumentColumns: ColumnDef<MonumentRecord>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => {
      const item = row.original;
      return (
        <HoverCard>
          <HoverCardTrigger asChild>
            <Link
              href={`/knowledge/monument/view/${item.id}`}
              className="text-blue-600 hover:underline font-medium"
            >
              {item.name || item.title || '-'}
            </Link>
          </HoverCardTrigger>
          <HoverCardContent className="w-80">
            <div className="space-y-3">
              <h4 className="font-semibold">{item.name}</h4>
              {item.monument_type && (
                <Badge variant="outline">{item.monument_type}</Badge>
              )}
              {item.location_name && (
                <p className="text-xs text-muted-foreground">📍 {item.location_name}</p>
              )}
              {item.note && (
                <p className="text-sm line-clamp-3">{item.note}</p>
              )}
              <div className="pt-2">
                <Link href={`/knowledge/monument/view/${item.id}`}>
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
    accessorKey: 'monument_type',
    header: 'Type',
    cell: ({ row }) => {
      const type = row.original.monument_type;
      if (!type) return '-';
      return <Badge variant="secondary">{type}</Badge>;
    },
    enableColumnFilter: true,
  },
  {
    accessorKey: 'construction_date',
    header: 'Built',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.construction_date || '-'}</span>
    ),
  },
  {
    accessorKey: 'location_name',
    header: 'Location',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.location_name || '-'}</span>
    ),
    enableColumnFilter: true,
  },
  {
    accessorKey: 'existence_status',
    header: 'Condition',
    cell: ({ row }) => {
      const es = row.original.existence_status;
      if (!es) return '-';
      return <span className="text-sm">{es.replace('_', ' ')}</span>;
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
        <Link href={`/knowledge/monument/view/${row.original.id}`}>
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
  viewBasePath: '/knowledge/person',
  title: 'Persons',
  description: 'Browse historical and cultural figures in the knowledge base.',
  showHeader: true,
  addAction: {
    label: 'Add Person',
    href: '/contribute/person',
  },
};

export const locationTableConfig: DataTableConfig<LocationRecord> = {
  endpoint: '/cidoc/locations/',
  columns: locationColumns,
  dataKey: 'results',
  viewBasePath: '/knowledge/location',
  title: 'Locations',
  description: 'Browse heritage sites and cultural locations.',
  showHeader: true,
  addAction: {
    label: 'Add Location',
    href: '/contribute/location',
  },
};

export const eventTableConfig: DataTableConfig<EventRecord> = {
  endpoint: '/cidoc/events/',
  columns: eventColumns,
  dataKey: 'results',
  viewBasePath: '/knowledge/event',
  title: 'Events',
  description: 'Browse cultural events, festivals, and historical occurrences.',
  showHeader: true,
  addAction: {
    label: 'Add Event',
    href: '/contribute/event',
  },
};

export const traditionTableConfig: DataTableConfig<TraditionRecord> = {
  endpoint: '/cidoc/traditions/',
  columns: traditionColumns,
  dataKey: 'results',
  viewBasePath: '/knowledge/tradition',
  title: 'Traditions',
  description: 'Browse cultural practices and intangible heritage traditions.',
  showHeader: true,
  addAction: {
    label: 'Add Tradition',
    href: '/contribute/tradition',
  },
};

export const culturalEntityTableConfig: DataTableConfig<CulturalEntityRecord> = {
  endpoint: '/data/cultural-entities/',
  columns: culturalEntityColumns,
  dataKey: 'results',
  rowIdField: 'entity_id',
  viewBasePath: '/knowledge/entity',
  title: 'Cultural Entities',
  description: 'Browse contributed cultural entities — monuments, festivals, rituals, traditions, and artifacts.',
  showHeader: true,
  addAction: {
    label: 'Add Entity',
    href: '/contribute',
  },
};

export const sourceTableConfig: DataTableConfig<SourceRecord> = {
  endpoint: '/cidoc/sources/',
  columns: sourceColumns,
  dataKey: 'results',
  viewBasePath: '/knowledge/source',
  title: 'Sources',
  description: 'Browse documentary sources, manuscripts, and reference materials.',
  showHeader: true,
  addAction: {
    label: 'Add Source',
    href: '/contribute/source',
  },
};

export const historicalPeriodTableConfig: DataTableConfig<HistoricalPeriodRecord> = {
  endpoint: '/cidoc/historical_periods/',
  columns: historicalPeriodColumns,
  dataKey: 'results',
  viewBasePath: '/knowledge/period',
  title: 'Historical Periods',
  description: 'Browse historical eras and time periods.',
  showHeader: true,
  addAction: {
    label: 'Add Period',
    href: '/contribute/period',
  },
};

export const deityTableConfig: DataTableConfig<DeityRecord> = {
  endpoint: '/cidoc/deities/',
  columns: deityColumns,
  dataKey: 'results',
  viewBasePath: '/knowledge/deity',
  title: 'Deities',
  description: 'Browse deities and divine figures in the knowledge base.',
  showHeader: true,
  addAction: {
    label: 'Add Deity',
    href: '/contribute/deity',
  },
};

export const guthiTableConfig: DataTableConfig<GuthiRecord> = {
  endpoint: '/cidoc/guthis/',
  columns: guthiColumns,
  dataKey: 'results',
  viewBasePath: '/knowledge/guthi',
  title: 'Guthis',
  description: 'Browse Guthi organizations and community institutions.',
  showHeader: true,
  addAction: {
    label: 'Add Guthi',
    href: '/contribute/guthi',
  },
};

export const structureTableConfig: DataTableConfig<StructureRecord> = {
  endpoint: '/cidoc/structures/',
  columns: structureColumns,
  dataKey: 'results',
  viewBasePath: '/knowledge/structure',
  title: 'Architectural Structures',
  description: 'Browse temples, stupas, and other heritage structures.',
  showHeader: true,
  addAction: {
    label: 'Add Structure',
    href: '/contribute/structure',
  },
};

export const ritualTableConfig: DataTableConfig<RitualRecord> = {
  endpoint: '/cidoc/rituals/',
  columns: ritualColumns,
  dataKey: 'results',
  viewBasePath: '/knowledge/ritual',
  title: 'Rituals',
  description: 'Browse ritual events, pujas, and ceremonial practices.',
  showHeader: true,
  addAction: {
    label: 'Add Ritual',
    href: '/contribute/ritual',
  },
};

export const festivalTableConfig: DataTableConfig<FestivalRecord> = {
  endpoint: '/cidoc/festivals/',
  columns: festivalColumns,
  dataKey: 'results',
  viewBasePath: '/knowledge/festival',
  title: 'Festivals',
  description: 'Browse cultural festivals and celebrations.',
  showHeader: true,
  addAction: {
    label: 'Add Festival',
    href: '/contribute/festival',
  },
};

export const iconographyTableConfig: DataTableConfig<IconographyRecord> = {
  endpoint: '/cidoc/iconographic_objects/',
  columns: iconographyColumns,
  dataKey: 'results',
  viewBasePath: '/knowledge/iconography',
  title: 'Iconographic Objects',
  description: 'Browse sculptures, paintings, and iconographic artifacts.',
  showHeader: true,
  addAction: {
    label: 'Add Iconography',
    href: '/contribute/iconography',
  },
};

export const monumentTableConfig: DataTableConfig<MonumentRecord> = {
  endpoint: '/cidoc/monuments/',
  columns: monumentColumns,
  dataKey: 'results',
  viewBasePath: '/knowledge/monument',
  title: 'Monuments',
  description: 'Browse heritage monuments and historical landmarks.',
  showHeader: true,
  addAction: {
    label: 'Add Monument',
    href: '/contribute/monument',
  },
};
