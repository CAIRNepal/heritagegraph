'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconGripVertical,
  IconLayoutColumns,
  IconLoader,
  IconPlus,
} from '@tabler/icons-react';
import {
  ColumnDef,
  ColumnFiltersState,
  FilterFn,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  Row,
  SortingState,
  useReactTable,
  VisibilityState,
} from '@tanstack/react-table';
import { toast } from 'sonner';
import { rankItem } from '@tanstack/match-sorter-utils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import type { DataTableConfig } from './types';

// Custom fuzzy filter
const fuzzyFilter: FilterFn<unknown> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value);
  addMeta({ itemRank });
  return itemRank.passed;
};

// Drag handle component
function DragHandle({ id }: { id: UniqueIdentifier }) {
  const { attributes, listeners } = useSortable({ id });

  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="text-muted-foreground size-7 hover:bg-transparent"
    >
      <IconGripVertical className="text-muted-foreground size-3" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  );
}

// Draggable row component
function DraggableRow<TData extends { id: number | string }>({
  row,
}: {
  row: Row<TData>;
}) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  });

  return (
    <TableRow
      data-state={row.getIsSelected() && 'selected'}
      data-dragging={isDragging}
      ref={setNodeRef}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}

// Props interface
export interface GenericDataTableProps<TData extends { id: number | string }> {
  config: DataTableConfig<TData>;
  /** Optional initial data (for SSR or when data is already available) */
  initialData?: TData[];
  /** Optional custom fetch function */
  fetchFn?: () => Promise<TData[]>;
  /** Count data for tab badges */
  tabCounts?: {
    underReview?: number;
    reviewed?: number;
    accepted?: number;
  };
}

export function GenericDataTable<TData extends { id: number | string }>({
  config,
  initialData,
  fetchFn,
  tabCounts,
}: GenericDataTableProps<TData>) {
  const { data: session } = useSession();
  const [data, setData] = React.useState<TData[]>(initialData || []);
  const [loading, setLoading] = React.useState(!initialData);
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [pageCount, setPageCount] = React.useState(-1);

  const sortableId = React.useId();
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );

  // Build columns with optional drag handle and selection
  const columns = React.useMemo(() => {
    const cols: ColumnDef<TData>[] = [];

    if (config.enableDragDrop !== false) {
      cols.push({
        id: 'drag',
        header: () => null,
        cell: ({ row }) => <DragHandle id={row.original.id} />,
        enableHiding: false,
      });
    }

    if (config.enableSelection !== false) {
      cols.push({
        id: 'select',
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && 'indeterminate')
              }
              onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(!!value)
              }
              aria-label="Select all"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      });
    }

    return [...cols, ...config.columns];
  }, [config.columns, config.enableDragDrop, config.enableSelection]);

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => (Array.isArray(data) ? data.map((d) => d.id) : []),
    [data]
  );

  const table = useReactTable({
    data,
    columns,
    filterFns: {
      fuzzy: fuzzyFilter,
    },
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => String(row.id),
    enableRowSelection: config.enableSelection !== false,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualPagination: true,
    pageCount,
  });

  // Fetch data on mount and when pagination changes
  React.useEffect(() => {
    if (initialData) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        if (fetchFn) {
          const result = await fetchFn();
          setData(result);
          setPageCount(Math.ceil(result.length / pagination.pageSize));
          return;
        }

        const baseUrl =
          process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const url = `${baseUrl}${config.endpoint}`;

        const headers: HeadersInit = {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        };

        // Add auth token if available
        if (session?.accessToken) {
          headers.Authorization = `Bearer ${session.accessToken}`;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.statusText}`);
        }

        const result = await response.json();

        // Extract data from response using dataKey if provided
        let rows: TData[];
        if (config.dataKey) {
          rows = result[config.dataKey] || [];
        } else if (Array.isArray(result)) {
          rows = result;
        } else if (result.results) {
          rows = result.results;
        } else {
          rows = [];
        }

        setData(rows);

        // Set page count
        if (result.count) {
          setPageCount(Math.ceil(result.count / pagination.pageSize));
        } else {
          setPageCount(Math.ceil(rows.length / pagination.pageSize));
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [
    config.endpoint,
    config.dataKey,
    pagination.pageIndex,
    pagination.pageSize,
    session?.accessToken,
    initialData,
    fetchFn,
  ]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setData((old) => {
        const safeData = Array.isArray(old) ? old : [];
        const oldIndex = safeData.findIndex((item) => item.id === active.id);
        const newIndex = safeData.findIndex((item) => item.id === over.id);
        return arrayMove(safeData, oldIndex, newIndex);
      });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <IconLoader className="animate-spin h-8 w-8 text-blue-500" />
      </div>
    );
  }

  const renderTable = () => (
    <div className="overflow-hidden rounded-lg border">
      <DndContext
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
        sensors={sensors}
        id={sortableId}
      >
        <Table>
          <TableHeader className="bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}

            {/* Filter Row */}
            {config.enableFilters !== false &&
              table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={`${headerGroup.id}-filter`}
                  className="bg-background"
                >
                  {headerGroup.headers.map((header) => {
                    const column = header.column;
                    return (
                      <TableHead key={`${header.id}-filter`}>
                        {column.getCanFilter() ? (
                          <div className="w-full pt-2">
                            <Input
                              placeholder={`Filter...`}
                              value={(column.getFilterValue() as string) ?? ''}
                              onChange={(e) =>
                                column.setFilterValue(e.target.value)
                              }
                              className="h-9 text-sm"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        ) : (
                          <div className="pt-2" />
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
          </TableHeader>
          <TableBody className="**:data-[slot=table-cell]:first:w-10">
            {table.getRowModel().rows?.length ? (
              <SortableContext
                items={dataIds}
                strategy={verticalListSortingStrategy}
              >
                {table.getRowModel().rows.map((row) => (
                  <DraggableRow key={row.id} row={row} />
                ))}
              </SortableContext>
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {config.emptyMessage || 'No results.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DndContext>
    </div>
  );

  const renderPagination = () => (
    <div className="flex items-center justify-between px-4">
      <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
        {table.getFilteredSelectedRowModel().rows.length} of{' '}
        {table.getFilteredRowModel().rows.length} row(s) selected.
      </div>
      <div className="flex w-full items-center gap-8 lg:w-fit">
        <div className="hidden items-center gap-2 lg:flex">
          <Label htmlFor="rows-per-page" className="text-sm font-medium">
            Rows per page
          </Label>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger size="sm" className="w-20" id="rows-per-page">
              <SelectValue
                placeholder={table.getState().pagination.pageSize}
              />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 40, 50].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-fit items-center justify-center text-sm font-medium">
          Page {table.getState().pagination.pageIndex + 1} of{' '}
          {table.getPageCount() || 1}
        </div>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Go to first page</span>
            <IconChevronsLeft />
          </Button>
          <Button
            variant="outline"
            className="size-8"
            size="icon"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Go to previous page</span>
            <IconChevronLeft />
          </Button>
          <Button
            variant="outline"
            className="size-8"
            size="icon"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Go to next page</span>
            <IconChevronRight />
          </Button>
          <Button
            variant="outline"
            className="hidden size-8 lg:flex"
            size="icon"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Go to last page</span>
            <IconChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );

  const renderHeader = () => {
    if (config.showHeader === false || (!config.title && !config.description && !config.addAction)) {
      return null;
    }

    return (
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 lg:px-6 pb-4">
        <div>
          {config.title && (
            <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {config.title}
            </h2>
          )}
          {config.description && (
            <p className="text-muted-foreground text-sm mt-1">
              {config.description}
            </p>
          )}
        </div>
        {config.addAction && (
          <Link href={config.addAction.href}>
            <Button size="sm">
              <IconPlus className="h-4 w-4 mr-1" />
              {config.addAction.label}
            </Button>
          </Link>
        )}
      </div>
    );
  };

  const renderToolbar = () => (
    <div className="flex items-center justify-between px-4 lg:px-6">
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <IconLayoutColumns />
              <span className="hidden lg:inline">Columns</span>
              <IconChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {table
              .getAllColumns()
              .filter(
                (column) =>
                  typeof column.accessorFn !== 'undefined' &&
                  column.getCanHide()
              )
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>

        {config.addAction && (
          <Link href={config.addAction.href}>
            <Button variant="outline" size="sm">
              <IconPlus />
              <span className="hidden lg:inline">{config.addAction.label}</span>
            </Button>
          </Link>
        )}
      </div>
    </div>
  );

  // Render with or without tabs
  if (config.showTabs !== false) {
    return (
      <div className="w-full flex flex-col gap-4">
        {renderHeader()}
        <Tabs
          defaultValue="all"
          className="w-full flex-col justify-start gap-6"
        >
        <div className="flex items-center justify-between px-4 lg:px-6">
          <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 @4xl/main:flex">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">
              Pending{' '}
              {tabCounts?.underReview !== undefined && (
                <Badge variant="secondary">{tabCounts.underReview}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">
              Approved{' '}
              {tabCounts?.accepted !== undefined && (
                <Badge variant="secondary">{tabCounts.accepted}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <IconLayoutColumns />
                  <span className="hidden lg:inline">Columns</span>
                  <IconChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {table
                  .getAllColumns()
                  .filter(
                    (column) =>
                      typeof column.accessorFn !== 'undefined' &&
                      column.getCanHide()
                  )
                  .map((column) => {
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(!!value)
                        }
                      >
                        {column.id}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
              </DropdownMenuContent>
            </DropdownMenu>

            {config.addAction && (
              <Link href={config.addAction.href}>
                <Button variant="outline" size="sm">
                  <IconPlus />
                  <span className="hidden lg:inline">
                    {config.addAction.label}
                  </span>
                </Button>
              </Link>
            )}
          </div>
        </div>
        <TabsContent
          value="all"
          className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
        >
          {renderTable()}
          {renderPagination()}
        </TabsContent>
        <TabsContent
          value="pending"
          className="flex flex-col gap-4 px-4 lg:px-6"
        >
          {renderTable()}
          {renderPagination()}
        </TabsContent>
        <TabsContent
          value="approved"
          className="flex flex-col gap-4 px-4 lg:px-6"
        >
          {renderTable()}
          {renderPagination()}
        </TabsContent>
        <TabsContent
          value="rejected"
          className="flex flex-col gap-4 px-4 lg:px-6"
        >
          {renderTable()}
          {renderPagination()}
        </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Simple view without tabs
  return (
    <div className="w-full flex flex-col gap-4">
      {renderHeader()}
      {renderToolbar()}
      {renderTable()}
      {renderPagination()}
    </div>
  );
}
