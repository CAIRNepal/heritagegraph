'use client';

import * as React from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
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
  // IconChevronDown,
  // IconChevronLeft,
  // IconChevronRight,
  // IconChevronsLeft,
  // IconChevronsRight,
  IconDotsVertical,
  IconGripVertical,
  // IconLayoutColumns,
  IconLoader,
  // IconPlus,
  IconTrendingUp,
} from '@tabler/icons-react';
import {
  ColumnDef,
  ColumnFiltersState,
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
import { z } from 'zod';

import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  DropdownMenu,
  // DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { Tabs, TabsContent } from '@/components/ui/tabs';

// ----- SCHEMA -----
export const schema = z.object({
  submission_id: z.string(),
  title: z.string(),
  description: z.string(),
  contributor: z.number(),
  contributor_username: z.string(),
  status: z.string(),
  created_at: z.string(),
});

// ----- TYPES -----
export type UniqueIdentifier = string | number;

// ----- DRAG HANDLE -----
function DragHandle({ id }: { id: string }) {
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

// ----- COLUMNS -----
const columns: ColumnDef<z.infer<typeof schema>>[] = [
  {
    id: 'drag',
    header: () => null,
    cell: ({ row }) => <DragHandle id={row.original.submission_id} />,
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
    cell: ({ row }) => <TableCellViewer item={row.original} />,
    enableHiding: false,
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => (
      <div className="max-w-xs truncate">{row.original.description || 'No description'}</div>
    ),
  },
  {
    accessorKey: 'contributor_username',
    header: 'Contributor',
    cell: ({ row }) => row.original.contributor_username,
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
  },
  {
    accessorKey: 'created_at',
    header: 'Created At',
    cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
  },
  {
    id: 'actions',
    cell: () => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
            size="icon"
          >
            <IconDotsVertical />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuItem>Make a copy</DropdownMenuItem>
          <DropdownMenuItem>Favorite</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

// ----- DRAGGABLE ROW -----
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
        transition,
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

// ----- DATATABLE COMPONENT -----
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
  const [pageCount, setPageCount] = React.useState(-1);

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor),
  );

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => data?.map(({ submission_id }) => submission_id) || [],
    [data],
  );

  const table = useReactTable({
    data,
    columns,
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
    manualPagination: true,
    pageCount,
  });

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const url = `http://127.0.0.1:8000/data/submissions/?page=${pagination.pageIndex + 1}&page_size=${pagination.pageSize}`;
        const response = await fetch(url);
        const result = await response.json();
        setData(result.results || []);
        setPageCount(Math.ceil(result.count / pagination.pageSize));
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load submissions');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [pagination.pageIndex, pagination.pageSize]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setData((data) => {
        const oldIndex = dataIds.indexOf(active.id);
        const newIndex = dataIds.indexOf(over.id);
        return arrayMove(data, oldIndex, newIndex);
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <IconLoader className="animate-spin h-8 w-8" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="outline" className="w-full flex-col justify-start gap-6">
      {/* Tabs, table rendering, pagination etc. */}
      {/* ... same as before, no change needed here */}
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
          >
            <Table>
              <TableHeader className="bg-muted sticky top-0 z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length ? (
                  <SortableContext items={dataIds} strategy={verticalListSortingStrategy}>
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
      </TabsContent>
    </Tabs>
  );
}

// ----- TABLE CELL VIEWER -----
function TableCellViewer({ item }: { item: z.infer<typeof schema> }) {
  const isMobile = useIsMobile();

  return (
    <Drawer direction={isMobile ? 'bottom' : 'right'}>
      <DrawerTrigger asChild>
        <Button variant="link" className="text-foreground w-fit px-0 text-left">
          {item.title}
        </Button>
      </DrawerTrigger>
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
                    <p className="text-muted-foreground">{item.contributor_username}</p>
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
                <Input id="contributor" defaultValue={item.contributor_username} readOnly />
              </div>
            </div>
          </form>
        </div>
        <DrawerFooter>
          <Button>Save Changes</Button>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
