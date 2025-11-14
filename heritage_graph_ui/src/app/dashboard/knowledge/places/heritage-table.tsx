'use client';

import * as React from 'react';
import Link from 'next/link';
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
  // IconCircleCheckFilled,
  // IconDotsVertical,
  IconGripVertical,
  IconLayoutColumns,
  IconLoader,
  IconPlus,
  IconTrendingUp,
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
// import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
import { toast } from 'sonner';
import { z } from 'zod';

import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  // ChartConfig,
  // ChartContainer,
  // ChartTooltip,
  // ChartTooltipContent,
} from '@/components/ui/chart';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  // DrawerTrigger,
} from '@/components/ui/drawer';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  // DropdownMenuItem,
  // DropdownMenuSeparator,
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
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { rankItem } from '@tanstack/match-sorter-utils';

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
// import { useSession } from 'next-auth/react';

// Updated schema to match the new data structure
export const schema = z.object({
  submission_id: z.string(),
  title: z.string(),
  description: z.string(),
  contributor: z.number(),
  contributor_username: z.string(),
  status: z.string(),
  created_at: z.string(),
});

// Create a separate component for the drag handle
function DragHandle({ id }: { id: string }) {
  const { attributes, listeners } = useSortable({
    id,
  });

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

// Custom fuzzy filter
const fuzzyFilter: FilterFn<unknown> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value);
  addMeta({ itemRank });
  return itemRank.passed;
};

const columns: ColumnDef<z.infer<typeof schema>>[] = [
  {
    id: 'drag',
    header: () => null,
    cell: ({ row }) => <DragHandle id={row.original.submission_id} />,
    enableHiding: false,
  },
  {
    id: 'select',
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
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
  },
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) => {
      return <TableCellViewer item={row.original} />;
    },
    enableHiding: false,
    enableColumnFilter: true,
    // filterFn: 'fuzzy',
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => (
      <div className="max-w-xs truncate">
        {row.original.description || 'No description'}
      </div>
    ),
    enableColumnFilter: true,
    // filterFn: 'fuzzy',
  },
  {
    accessorKey: 'contributor_username',
    header: 'Contributor',
    cell: ({ row }) => {
      const username = row.original.contributor_username;
      return (
        <Link href={`/dashboard/users/${username}`}>
          <Badge variant="secondary" className="cursor-pointer">
            @{username}
          </Badge>
        </Link>
      );
    },
    enableColumnFilter: true,
    // filterFn: 'fuzzy',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={
          row.original.status === 'approved'
            ? 'text-green-500'
            : row.original.status === 'pending'
              ? 'text-yellow-500'
              : 'text-red-500'
        }
      >
        {row.original.status.charAt(0).toUpperCase() + row.original.status.slice(1)}
      </Badge>
    ),
    enableColumnFilter: true,
    filterFn: (row, columnId, value: string) =>
      row.getValue<string>(columnId).toLowerCase().includes(value.toLowerCase()),
  },
  {
    accessorKey: 'created_at',
    header: 'Created At',
    cell: ({ row }) => {
      const date = new Date(row.original.created_at);
      return date.toLocaleDateString();
    },
    enableColumnFilter: true,
    filterFn: (row, columnId, value: string) => {
      const cellValue = new Date(row.getValue<string>(columnId)).toLocaleDateString();
      return cellValue.includes(value);
    },
  },
  // {
  //   id: 'actions',
  //   header: 'Actions',
  //   cell: ({ row }) => {
  //     const submissionId = row.original.submission_id;

  //     return (
  //       // <DropdownMenu>
  //       //   <DropdownMenuTrigger asChild>
  //       //     <Button
  //       //       variant="ghost"
  //       //       className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
  //       //       size="icon"
  //       //     >
  //       //       <IconDotsVertical />
  //       //       <span className="sr-only">Open menu</span>
  //       //     </Button>
  //       //   </DropdownMenuTrigger>
  //       //   <DropdownMenuContent align="end" className="w-32">
  //       //     <DropdownMenuItem>
  //       //     </DropdownMenuItem>
  //       //     <DropdownMenuItem>Edit</DropdownMenuItem>
  //       //     <DropdownMenuItem>Make a copy</DropdownMenuItem>
  //       //     <DropdownMenuItem>Favorite</DropdownMenuItem>
  //       //     <DropdownMenuSeparator />
  //       //     <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
  //       //   </DropdownMenuContent>
  //       // </DropdownMenu>
  //       <Button>
  //         <Link href={`/dashboard/knowledge/viewreport/${submissionId}`}>View</Link>
  //       </Button>
  //     );
  //   },
  //   enableColumnFilter: false,
  // },
];

function DraggableRow({ row }: { row: Row<z.infer<typeof schema>> }) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.submission_id,
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

export function DataTable() {
  const [data, setData] = React.useState<z.infer<typeof schema>[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const [pageCount, setPageCount] = React.useState(-1); // server total pages

  const sortableId = React.useId();
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {}),
  );

  // Ensures it's always an array
  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => (Array.isArray(data) ? data.map((d) => d.submission_id) : []),
    [data],
  );

  // const dataIds = React.useMemo<UniqueIdentifier[]>(
  //   () => data?.map(({ submission_id }) => submission_id) || [],
  //   [data],
  // );

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
    getRowId: (row) => row.submission_id,
    enableRowSelection: true,
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

    //pagination for server side:
    manualPagination: true,
    pageCount,
  });

  // Fetch data from the API
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        // const response = await fetch('http://127.0.0.1:8000/data/submissions/');
        const url = `http://0.0.0.0:8000/cidoc/locations/?page=${
          pagination.pageIndex + 1
        }&page_size=${pagination.pageSize}`;

        const response = await fetch(url);
        const result = await response.json();

        // Normalize for DRF pagination
        const rows = Array.isArray(result.results) ? result.results : result;
        setData(rows);
        if (result.count) {
          setPageCount(Math.ceil(result.count / pagination.pageSize));
        }
        // setData(result);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load submissions');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [pagination.pageIndex, pagination.pageSize]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setData((old) => {
        const safeData = Array.isArray(old) ? old : [];
        const oldIndex = dataIds.indexOf(active.id);
        const newIndex = dataIds.indexOf(over.id);
        return arrayMove(safeData, oldIndex, newIndex);
      });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <IconLoader className="animate-spin h-8 w-8" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="outline" className="w-full flex-col justify-start gap-6">
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Label htmlFor="view-selector" className="sr-only">
          View
        </Label>
        <Select defaultValue="outline">
          <SelectTrigger
            className="flex w-fit @4xl/main:hidden"
            size="sm"
            id="view-selector"
          >
            <SelectValue placeholder="Select a view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="outline">Outline</SelectItem>
            <SelectItem value="past-performance">Under Review</SelectItem>
            <SelectItem value="key-personnel">Reviewed</SelectItem>
            <SelectItem value="focus-documents">Accepted</SelectItem>
          </SelectContent>
        </Select>
        <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 @4xl/main:flex">
          <TabsTrigger value="outline">All Submissions</TabsTrigger>
          <TabsTrigger value="past-performance">
            Under Review <Badge variant="secondary">3</Badge>
          </TabsTrigger>
          <TabsTrigger value="key-personnel">
            Reviewed <Badge variant="secondary">2</Badge>
          </TabsTrigger>
          <TabsTrigger value="focus-documents">Accepted</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <IconLayoutColumns />
                <span className="hidden lg:inline">Customize Columns</span>
                <span className="lg:hidden">Columns</span>
                <IconChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== 'undefined' && column.getCanHide(),
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

          <Button variant="outline" size="sm">
            <IconPlus />
            <span className="hidden lg:inline">Add Submission</span>
          </Button>
        </div>
      </div>
      <TabsContent
        value="outline"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
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
                {/* Header Row */}
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}

                {/* Filter Row */}
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={`${headerGroup.id}-filter`} className="bg-background">
                    {headerGroup.headers.map((header) => {
                      const column = header.column;
                      return (
                        <TableHead key={`${header.id}-filter`}>
                          {column.getCanFilter() ? (
                            <div className="w-full pt-2">
                              <Input
                                placeholder={`Filter ${
                                  typeof header.column.columnDef.header === 'function'
                                    ? header.column.columnDef
                                        .header(header.getContext())
                                        ?.toString() || ''
                                    : header.column.columnDef.header || ''
                                }`}
                                value={(column.getFilterValue() as string) ?? ''}
                                onChange={(e) => column.setFilterValue(e.target.value)}
                                className="h-10 text-sm"
                                onClick={(e) => e.stopPropagation()}
                              />{' '}
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
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </div>
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
                  <SelectValue placeholder={table.getState().pagination.pageSize} />
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
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
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
      </TabsContent>
      <TabsContent value="past-performance" className="flex flex-col px-4 lg:px-6">
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed"></div>
      </TabsContent>
      <TabsContent value="key-personnel" className="flex flex-col px-4 lg:px-6">
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed"></div>
      </TabsContent>
      <TabsContent value="focus-documents" className="flex flex-col px-4 lg:px-6">
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed"></div>
      </TabsContent>
    </Tabs>
  );
}

// const chartData = [
//   { month: 'January', desktop: 186, mobile: 80 },
//   { month: 'February', desktop: 305, mobile: 200 },
//   { month: 'March', desktop: 237, mobile: 120 },
//   { month: 'April', desktop: 73, mobile: 190 },
//   { month: 'May', desktop: 209, mobile: 130 },
//   { month: 'June', desktop: 214, mobile: 140 },
// ];

// const chartConfig = {
//   desktop: {
//     label: 'Desktop',
//     color: 'var(--primary)',
//   },
//   mobile: {
//     label: 'Mobile',
//     color: 'var(--primary)',
//   },
// } satisfies ChartConfig;
import { useState } from 'react';
// import { Bluetooth } from 'lucide-react';

function TableCellViewer({ item }: { item: z.infer<typeof schema> }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false); // control drawer manually
  // const { data: session, status } = useSession();

  return (
    <>
      <HoverCard>
        <HoverCardTrigger asChild>
          <Button
            variant="link"
            className="text-foreground w-fit px-0 text-left hover:underline"
            onClick={() => {
              setOpen(false); // close drawer if needed
              window.location.href = `/dashboard/knowledge/viewreport/${item.submission_id}`;
            }}
          >
            {item.title}
          </Button>
        </HoverCardTrigger>

        <HoverCardContent className="p-4 w-[500px] max-w-2xl space-y-3 rounded-xl shadow-lg bg-background">
          {/* Contributor row */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              @{item.contributor_username}
            </p>
            <Link
              href={`/dashboard/users/${item.contributor_username}`}
              className="flex items-center gap-2"
            >
              <Button variant="default" size="sm">
                View Profile
              </Button>
            </Link>
          </div>

          {/* Action button */}
          <Link href={`/dashboard/knowledge/viewreport/${item.submission_id}`}>
            <Button variant="secondary" className="w-full" size="sm">
              View Submission
            </Button>
          </Link>

          {/* Description / paragraph */}
          <div className="prose prose-sm dark:prose-invert max-h-60 overflow-y-auto leading-relaxed">
            <p className="text-base whitespace-pre-line">{item.description}</p>
          </div>
        </HoverCardContent>
      </HoverCard>

      <Drawer
        open={open}
        onOpenChange={setOpen}
        direction={isMobile ? 'bottom' : 'right'}
      >
        <DrawerContent>
          <DrawerHeader className="gap-1">
            <DrawerTitle>{item.title}</DrawerTitle>
            <DrawerDescription>Submission ID: {item.submission_id}</DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
            {!isMobile && (
              <>
                <div className="rounded-lg border p-4">
                  <h3 className="text-lg font-medium mb-4">Submission Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-medium">Contributor</p>
                      <p className="text-muted-foreground">
                        {item.contributor_username}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">Status</p>
                      <p className="text-muted-foreground">
      
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">Created At</p>
                      <p className="text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="grid gap-2">
                  <div className="flex gap-2 leading-none font-medium">
                    {item.title} <IconTrendingUp className="size-4" />
                  </div>
                  <div className="text-muted-foreground">
                    {item.description || 'No description provided'}
                  </div>
                </div>
                <Separator />
              </>
            )}
            <form className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                <Label htmlFor="title">Title</Label>
                <Input id="title" defaultValue={item.title} />
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="description">Description</Label>
                <Input id="description" defaultValue={item.description} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-3">
                  <Label htmlFor="status">Status</Label>
                  <Select defaultValue={item.status}>
                    <SelectTrigger id="status" className="w-full">
                      <SelectValue placeholder="Select a status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-3">
                  <Label htmlFor="contributor">Contributor</Label>
                  <Input
                    id="contributor"
                    defaultValue={item.contributor_username}
                    readOnly
                  />
                </div>
              </div>
            </form>
          </div>
          <DrawerFooter>
            <Button variant="outline">
              <a href={`/dashboard/knowledge/viewreport/${item.submission_id}`}>
                View Detail
              </a>
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Close</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
