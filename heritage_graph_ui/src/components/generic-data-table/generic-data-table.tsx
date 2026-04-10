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
  Table,
  useReactTable,
  VisibilityState,
} from '@tanstack/react-table';
import { toast } from 'sonner';
import { rankItem } from '@tanstack/match-sorter-utils';

import { apiFetch, apiUrl, getApiErrorMessage } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
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
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { createStatusWorkflowTabs } from './create-status-tabs';
import type { DataTableConfig, DataTableTab } from './types';

/** Normalize legacy tab count keys from earlier dashboard props. */
function mergeTabCountOverrides(
  raw?: Partial<Record<string, number>> & {
    underReview?: number;
    accepted?: number;
    reviewed?: number;
  }
): Partial<Record<string, number>> | undefined {
  if (!raw) return undefined;
  const { underReview, accepted, reviewed, ...rest } = raw;
  return {
    ...rest,
    ...(underReview !== undefined ? { pending: underReview } : {}),
    ...(accepted !== undefined ? { approved: accepted } : {}),
    ...(reviewed !== undefined ? { reviewed } : {}),
  };
}

const fuzzyFilter: FilterFn<unknown> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value);
  addMeta({ itemRank });
  return itemRank.passed;
};

function DragHandle({
  id,
  disabled,
}: {
  id: UniqueIdentifier;
  disabled?: boolean;
}) {
  const { attributes, listeners } = useSortable({ id, disabled });

  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      disabled={disabled}
      className="text-muted-foreground size-7 hover:bg-transparent disabled:opacity-40"
    >
      <IconGripVertical className="text-muted-foreground size-3" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  );
}

function DraggableRow<TData>({
  row,
  rowId,
  disableDrag,
}: {
  row: Row<TData>;
  rowId: UniqueIdentifier;
  disableDrag?: boolean;
}) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: rowId,
    disabled: disableDrag,
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

function StaticTableRow<TData>({ row }: { row: Row<TData> }) {
  return (
    <TableRow data-state={row.getIsSelected() && 'selected'}>
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}

function ColumnVisibilityMenu<TData>({ table }: { table: Table<TData> }) {
  return (
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
              typeof column.accessorFn !== 'undefined' && column.getCanHide()
          )
          .map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              className="capitalize"
              checked={column.getIsVisible()}
              onCheckedChange={(value) => column.toggleVisibility(!!value)}
            >
              {column.id}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface GenericDataTableProps<TData> {
  config: DataTableConfig<TData>;
  initialData?: TData[];
  fetchFn?: () => Promise<TData[]>;
  /**
   * Optional badge counts keyed by tab id (`pending`, `approved`, …).
   * Overrides client-side counts for those keys.
   * Legacy: `underReview` → `pending`, `accepted` → `approved`.
   */
  tabCounts?: Partial<Record<string, number>> & {
    underReview?: number;
    accepted?: number;
    reviewed?: number;
  };
}

export function GenericDataTable<TData>({
  config,
  initialData,
  fetchFn,
  tabCounts,
}: GenericDataTableProps<TData>) {
  const { data: session } = useSession();
  const tabCountOverrides = React.useMemo(
    () => mergeTabCountOverrides(tabCounts),
    [tabCounts]
  );
  const [data, setData] = React.useState<TData[]>(initialData ?? []);
  const [loading, setLoading] = React.useState(!initialData);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
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

  const sortableId = React.useId();
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );

  const resolvedTabs = React.useMemo((): DataTableTab<TData>[] | null => {
    if (config.tabs === false || config.showTabs === false) return null;
    if (Array.isArray(config.tabs)) {
      return config.tabs.length ? config.tabs : null;
    }
    return createStatusWorkflowTabs<
      TData & { status?: string | null }
    >() as DataTableTab<TData>[];
  }, [config.tabs, config.showTabs]);

  const firstTabId = resolvedTabs?.[0]?.id ?? 'all';
  const [activeTab, setActiveTab] = React.useState(
    () => config.defaultTabId ?? firstTabId
  );

  React.useEffect(() => {
    if (!resolvedTabs?.length) return;
    if (!resolvedTabs.some((t) => t.id === activeTab)) {
      setActiveTab(config.defaultTabId ?? resolvedTabs[0].id);
    }
  }, [resolvedTabs, activeTab, config.defaultTabId]);

  const rowIdKey = React.useMemo(
    () => (config.rowIdField ?? config.idField ?? 'id') as keyof TData,
    [config.rowIdField, config.idField]
  );

  const resolveRowId = React.useCallback(
    (row: TData) => String(row[rowIdKey]),
    [rowIdKey]
  );

  const tableData = React.useMemo(() => {
    if (!resolvedTabs?.length) return data;
    const tab = resolvedTabs.find((t) => t.id === activeTab);
    if (!tab?.filter) return data;
    return data.filter(tab.filter);
  }, [data, resolvedTabs, activeTab]);

  const dragDropActive =
    config.enableDragDrop !== false &&
    (!resolvedTabs?.length || activeTab === 'all');

  const columns = React.useMemo(() => {
    const cols: ColumnDef<TData>[] = [];

    if (config.enableDragDrop !== false) {
      cols.push({
        id: 'drag',
        header: () => null,
        cell: ({ row }) => (
          <DragHandle
            id={resolveRowId(row.original)}
            disabled={!dragDropActive}
          />
        ),
        enableHiding: false,
      });
    }

    if (config.enableSelection !== false) {
      cols.push({
        id: 'select',
        header: ({ table: t }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={
                t.getIsAllPageRowsSelected() ||
                (t.getIsSomePageRowsSelected() && 'indeterminate')
              }
              onCheckedChange={(value) => t.toggleAllPageRowsSelected(!!value)}
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
  }, [
    config.columns,
    config.enableDragDrop,
    config.enableSelection,
    resolveRowId,
    dragDropActive,
  ]);

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => tableData.map((d) => resolveRowId(d)),
    [tableData, resolveRowId]
  );

  const table = useReactTable({
    data: tableData,
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
    getRowId: resolveRowId,
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
    manualPagination: false,
  });

  React.useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [columnFilters, sorting, activeTab]);

  React.useEffect(() => {
    if (initialData) return;

    let cancelled = false;

    const load = async () => {
      try {
        setFetchError(null);
        setLoading(true);

        if (fetchFn) {
          const result = await fetchFn();
          if (!cancelled) setData(Array.isArray(result) ? result : []);
          return;
        }

        const url = apiUrl(config.endpoint);
        const headers: HeadersInit = {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        };

        if (session?.accessToken) {
          headers.Authorization = `Bearer ${session.accessToken}`;
        }

        const response = await apiFetch(url, { headers });
        const result = await response.json();

        let rows: TData[];
        if (config.dataKey) {
          const raw = result[config.dataKey as string];
          rows = Array.isArray(raw) ? raw : [];
        } else if (Array.isArray(result)) {
          rows = result;
        } else if (Array.isArray(result.results)) {
          rows = result.results;
        } else {
          rows = [];
        }

        if (!cancelled) setData(rows);
      } catch (error) {
        const message = getApiErrorMessage(
          error,
          'Could not load this table. Please try again.'
        );
        if (!cancelled) {
          setFetchError(message);
          toast.error(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [config.endpoint, config.dataKey, session?.accessToken, initialData, fetchFn]);

  function handleDragEnd(event: DragEndEvent) {
    if (!dragDropActive) return;
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setData((old) => {
        const safeData = Array.isArray(old) ? old : [];
        const oldIndex = safeData.findIndex(
          (item) => resolveRowId(item) === String(active.id)
        );
        const newIndex = safeData.findIndex(
          (item) => resolveRowId(item) === String(over.id)
        );
        if (oldIndex < 0 || newIndex < 0) return old;
        return arrayMove(safeData, oldIndex, newIndex);
      });
    }
  }

  const tabBadge = React.useCallback(
    (tab: DataTableTab<TData>) => {
      if (tab.id === 'all') return undefined;
      const override = tabCountOverrides?.[tab.id];
      if (override !== undefined) return override;
      if (!tab.filter) return data.length;
      return data.filter(tab.filter).length;
    },
    [data, tabCountOverrides]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <IconLoader className="animate-spin h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  if (fetchError && data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 h-64 px-4">
        <p className="text-sm text-muted-foreground text-center max-w-md">
          {fetchError}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setFetchError(null);
            setLoading(true);
            void (async () => {
              try {
                const url = apiUrl(config.endpoint);
                const headers: HeadersInit = {
                  Accept: 'application/json',
                  'Content-Type': 'application/json',
                };
                if (session?.accessToken) {
                  headers.Authorization = `Bearer ${session.accessToken}`;
                }
                const response = await apiFetch(url, { headers });
                const result = await response.json();
                let rows: TData[];
                if (config.dataKey) {
                  const raw = result[config.dataKey as string];
                  rows = Array.isArray(raw) ? raw : [];
                } else if (Array.isArray(result)) {
                  rows = result;
                } else if (Array.isArray(result.results)) {
                  rows = result.results;
                } else {
                  rows = [];
                }
                setData(rows);
                setFetchError(null);
              } catch (e) {
                const message = getApiErrorMessage(
                  e,
                  'Could not load this table. Please try again.'
                );
                setFetchError(message);
                toast.error(message);
              } finally {
                setLoading(false);
              }
            })();
          }}
        >
          Retry
        </Button>
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
        <UITable>
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
                              placeholder="Filter…"
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
              dragDropActive ? (
                <SortableContext
                  items={dataIds}
                  strategy={verticalListSortingStrategy}
                >
                  {table.getRowModel().rows.map((row) => (
                    <DraggableRow
                      key={row.id}
                      row={row}
                      rowId={resolveRowId(row.original)}
                      disableDrag={false}
                    />
                  ))}
                </SortableContext>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <StaticTableRow key={row.id} row={row} />
                ))
              )
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {config.emptyMessage || 'No results.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </UITable>
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
    if (
      config.showHeader === false ||
      (!config.title && !config.description && !config.addAction)
    ) {
      return null;
    }

    return (
      <div className="px-4 lg:px-6 pt-4">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                {config.title && (
                  <CardTitle className="text-2xl font-bold">
                    {config.title}
                  </CardTitle>
                )}
                {config.description && (
                  <CardDescription>{config.description}</CardDescription>
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
          </CardHeader>
        </Card>
      </div>
    );
  };

  const renderToolbar = () => (
    <div className="flex items-center justify-between px-4 lg:px-6">
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <ColumnVisibilityMenu table={table} />
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

  if (resolvedTabs?.length) {
    return (
      <div className="w-full flex flex-col gap-4">
        {renderHeader()}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full flex-col justify-start gap-6"
        >
          <div className="flex items-center justify-between px-4 lg:px-6">
            <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 @4xl/main:flex flex-wrap h-auto min-h-9">
              {resolvedTabs.map((tab) => {
                const n = tabBadge(tab);
                return (
                  <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5">
                    {tab.label}
                    {tab.id !== 'all' && n !== undefined && (
                      <Badge variant="secondary">{n}</Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <div className="flex items-center gap-2 shrink-0">
              <ColumnVisibilityMenu table={table} />
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
            value={activeTab}
            className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
          >
            {renderTable()}
            {renderPagination()}
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4">
      {renderHeader()}
      {renderToolbar()}
      {renderTable()}
      {renderPagination()}
    </div>
  );
}
