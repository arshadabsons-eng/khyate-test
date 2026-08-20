import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from "@tanstack/react-table";
import { IconArrowsSort, IconChevronLeft, IconChevronRight, IconSearch } from "@tabler/icons-react";
import { useMemo, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common/Page";

/** Simplified column shape: render a cell straight from the row. */
export type SimpleColumn<T> = {
  header: ReactNode;
  accessor: (row: T) => ReactNode;
  id?: string;
  sortable?: boolean;
};

export type DataTableColumn<T> = ColumnDef<T, unknown> | SimpleColumn<T>;

function isSimpleColumn<T>(col: DataTableColumn<T>): col is SimpleColumn<T> {
  return typeof (col as SimpleColumn<T>).accessor === "function";
}

/** Controlled (server-side) pagination. When supplied, the table renders these controls. */
export type ServerPagination = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function DataTable<T>({
  data,
  rows,
  columns,
  searchPlaceholder = "Search...",
  filtersSlot,
  bulkActions,
  onRowClick,
  emptyMessage = "No records found",
  pageSize = 10,
  pagination,
  mobileCard,
  getRowId,
}: {
  /** Provide either `data` or `rows` (alias). */
  data?: T[];
  rows?: T[];
  columns: DataTableColumn<T>[];
  searchPlaceholder?: string;
  filtersSlot?: ReactNode;
  bulkActions?: (selected: T[], clear: () => void) => ReactNode;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  pageSize?: number;
  pagination?: ServerPagination;
  /** Optional per-row card renderer used instead of the table below `md`. */
  mobileCard?: (row: T) => ReactNode;
  /** Stable row identity for `rowSelection`. Without this, TanStack keys
   *  selection by array position — harmless for a client-only table, but
   *  combining server-side `pagination` with `bulkActions` would misattribute
   *  a selection made on one page to whatever different record occupies that
   *  same index after a page change. Pass a real id accessor whenever both
   *  props are used together. */
  getRowId?: (row: T) => string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const tableData = data ?? rows ?? [];

  const normalizedColumns = useMemo<ColumnDef<T, unknown>[]>(
    () =>
      columns.map((col, i) => {
        if (isSimpleColumn(col)) {
          return {
            id: col.id ?? `col_${i}`,
            header: () => col.header,
            // SimpleColumn.accessor returns a ReactNode for rendering, which
            // gave TanStack's global filter nothing to match on — so the search
            // box accepted input and filtered zero rows on every table built
            // this way. Expose the value for filtering/sorting when it's a
            // primitive; a column rendering JSX (badge, button) stays
            // unfilterable, which is correct.
            accessorFn: (row: T) => {
              const value = col.accessor(row);
              return typeof value === "string" || typeof value === "number" ? value : undefined;
            },
            cell: ({ row }) => col.accessor(row.original),
            enableSorting: col.sortable ?? false,
          } as ColumnDef<T, unknown>;
        }
        return col;
      }),
    [columns],
  );

  const table = useReactTable({
    data: tableData,
    columns: normalizedColumns,
    state: { sorting, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: !!bulkActions,
    ...(getRowId ? { getRowId } : {}),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    // When the caller paginates server-side, the rows it hands us ARE the page
    // — client-paginating them again silently hid most of each batch (default
    // pageSize 10 against a typical 20-25 row server page), so pages that had
    // been "fixed" to use real server pagination were still truncating. The
    // footer already branches to the server controls in this case; this makes
    // the row model agree with it.
    initialState: {
      pagination: { pageSize: pagination ? Number.MAX_SAFE_INTEGER : pageSize },
    },
  });

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 border-b">
        <div className="relative flex-1 sm:max-w-xs">
          <IconSearch
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="pl-9"
          />
        </div>
        {filtersSlot && <div className="flex flex-wrap gap-2">{filtersSlot}</div>}
      </div>
      <div
        className={`overflow-x-auto [-webkit-overflow-scrolling:touch] ${mobileCard ? "hidden md:block" : ""}`}
      >
        <table className="w-full min-w-[640px] text-sm kh-table">
          <thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="text-left font-medium px-4 py-3 whitespace-nowrap">
                    {h.isPlaceholder ? null : (
                      <button
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={h.column.getToggleSortingHandler()}
                        disabled={!h.column.getCanSort()}
                        aria-label="Sort column"
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getCanSort() && (
                          <IconArrowsSort size={12} className="opacity-50" />
                        )}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={table.getVisibleFlatColumns().length} className="px-4">
                  <EmptyState title={emptyMessage} />
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-t hover:bg-muted/30 ${onRowClick ? "cursor-pointer" : ""}`}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button,input,a,[data-no-row]")) return;
                    onRowClick?.(row.original);
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {mobileCard && (
        <div className="md:hidden divide-y">
          {table.getRowModel().rows.length === 0 ? (
            <EmptyState title={emptyMessage} />
          ) : (
            table.getRowModel().rows.map((row) => (
              <div
                key={row.id}
                className={onRowClick ? "cursor-pointer active:bg-muted/40" : ""}
                onClick={() => onRowClick?.(row.original)}
              >
                {mobileCard(row.original)}
              </div>
            ))
          )}
        </div>
      )}
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-y-2 border-t text-xs text-muted-foreground">
        <div>
          {table.getFilteredRowModel().rows.length} record
          {table.getFilteredRowModel().rows.length !== 1 && "s"}
          {selectedRows.length > 0 && (
            <span className="ml-2">· {selectedRows.length} selected</span>
          )}
        </div>
        {pagination ? (
          <div className="flex items-center gap-2">
            <button
              className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-muted disabled:opacity-30"
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <IconChevronLeft size={16} />
            </button>
            <span>
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <button
              className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-muted disabled:opacity-30"
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              <IconChevronRight size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-muted disabled:opacity-30"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <IconChevronLeft size={16} />
            </button>
            <span>
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
            </span>
            <button
              className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-muted disabled:opacity-30"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <IconChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
      {bulkActions && selectedRows.length > 0 && (
        <div className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] mx-4 mb-4 bg-foreground text-background rounded-lg shadow-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-in slide-in-from-bottom-2">
          <span className="text-sm font-medium">{selectedRows.length} selected</span>
          <div className="flex flex-wrap items-center gap-2">
            {bulkActions(selectedRows, () => setRowSelection({}))}
          </div>
        </div>
      )}
    </div>
  );
}
