import type { ColumnDef, Header, Row, RowData } from '@tanstack/react-table'
import {
  flexRender,
  metaHelper,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
} from '@tanstack/react-table'
import type { ReactTable } from '@tanstack/react-table'
import { ArrowUp } from 'lucide-react'
import { cn } from '~/lib/cn'
import { Manifest, TableBody, TableHead, TableRow, Td, Th } from './table'

/**
 * One feature set for every table in the viewer, so every column def shares the
 * same `typeof features` and can be passed to the same `DataTable`. The catalog
 * tables use `rowSortingFeature` / `rowPaginationFeature` for real; the
 * unpaginated detail tables carry them in their type without ever calling their
 * APIs — the alternative is two feature objects whose column defs cannot mix.
 *
 * No row-model slots (`sortedRowModel`, `paginatedRowModel`) and no `sortFns`
 * registry: the catalogs run `manualSorting` / `manualPagination`, which bypass
 * those models entirely, so registering them would ship dead code.
 */
export const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  columnMeta: metaHelper<ColumnMeta>(),
})

export type ColumnMeta = {
  /** Right-aligned, mono, tabular figures — the manifest's number columns. */
  numeric?: boolean
  /** Extra classes for the cell's `<td>`, e.g. `'text-ink-2'`. */
  className?: string
  /** This column's share (0–100) of `ManifestSkeleton`'s loading placeholder. */
  skeletonWidth?: number
  /** Opens a `border-l` before this column, binding it and everything after
   *  it into one visual band — e.g. corridas' un-migrated columns. */
  groupStart?: boolean
}

export type Columns<TData extends RowData> = ReadonlyArray<
  ColumnDef<typeof features, TData>
>

/** Reads the widths declared on each column so the pending skeleton stays in
 *  sync with the real columns instead of a hand-maintained, drift-prone copy. */
export function skeletonWidths<TData extends RowData>(columns: Columns<TData>): Array<number> {
  return columns.map((column) => column.meta?.skeletonWidth ?? 0)
}

function HeaderCell<TData extends RowData>({
  header,
}: {
  header: Header<typeof features, TData, unknown>
}) {
  if (header.isPlaceholder) return <Th />

  const meta = header.column.columnDef.meta
  if (!header.column.getCanSort()) {
    return (
      <Th numeric={meta?.numeric} className={cn(meta?.groupStart && 'border-l border-rule')}>
        {flexRender(header.column.columnDef.header, header.getContext())}
      </Th>
    )
  }

  const direction = header.column.getIsSorted()
  return (
    <Th
      numeric={meta?.numeric}
      className={cn('p-0', meta?.groupStart && 'border-l border-rule')}
      aria-sort={direction ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={header.column.getToggleSortingHandler()}
        className={cn(
          'group flex w-full items-center gap-1.5 px-3 py-2.5 font-mono text-note font-medium tracking-[0.085em] uppercase transition-colors duration-100',
          'hover:text-ink focus-visible:text-ink',
          meta?.numeric && 'justify-end',
          direction ? 'text-ink' : 'text-ink-3',
        )}
      >
        {flexRender(header.column.columnDef.header, header.getContext())}
        <ArrowUp
          size={11}
          strokeWidth={2.25}
          aria-hidden
          className={cn(
            'shrink-0 transition-[opacity,transform] duration-150',
            direction
              ? cn('opacity-100', direction === 'desc' && 'rotate-180')
              : 'opacity-0 group-hover:opacity-40',
          )}
        />
      </button>
    </Th>
  )
}

/**
 * The table-instance layer above `table.tsx`'s presentational primitives: it
 * renders a `ReactTable`'s header groups, row model and footer groups through
 * `flexRender`, reusing `Manifest` / `TableHead` / `TableBody` / `Td` verbatim
 * so the markup stays byte-for-byte what the hand-written manifests produced.
 */
export function DataTable<TData extends RowData>({
  table,
  label,
  className,
  rowProps,
}: {
  table: ReactTable<typeof features, TData>
  label: string
  className?: string
  /** Row-level emphasis still comes from the data: isDeleted, isMain, isActive. */
  rowProps?: (row: Row<typeof features, TData>) => {
    highlighted?: boolean
    dimmed?: boolean
  }
}) {
  const footerGroups = table.getFooterGroups()
  const hasFooter = footerGroups.some((group) =>
    group.headers.some((header) => header.column.columnDef.footer),
  )

  return (
    <Manifest label={label} className={className}>
      <TableHead>
        {table
          .getHeaderGroups()[0]
          ?.headers.map((header) => <HeaderCell key={header.id} header={header} />)}
      </TableHead>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id} {...rowProps?.(row)}>
            {/* getAllCells, not getVisibleCells: no columnVisibilityFeature. */}
            {row.getAllCells().map((cell) => {
              const meta = cell.column.columnDef.meta
              return (
                <Td
                  key={cell.id}
                  numeric={meta?.numeric}
                  className={cn(meta?.className, meta?.groupStart && 'border-l border-rule')}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </Td>
              )
            })}
          </TableRow>
        ))}
      </TableBody>
      {hasFooter ? (
        <tfoot>
          {footerGroups.map((group) => (
            <tr
              key={group.id}
              className="[&>td]:border-t-[3px] [&>td]:border-double [&>td]:border-rule-strong"
            >
              {group.headers.map((header) => {
                // Only `numeric` carries over from the body cell's meta: a
                // footer cell needs the same alignment (`text-align` on a
                // `<span>` does nothing — it has to sit on the cell itself),
                // but its own emphasis (the "Total" label, the bold sums) is
                // usually different from the body's `className`, so that one
                // is left for the `footer` template to bring itself.
                const numeric = header.column.columnDef.meta?.numeric
                return (
                  <Td key={header.id} numeric={numeric}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.footer, header.getContext())}
                  </Td>
                )
              })}
            </tr>
          ))}
        </tfoot>
      ) : null}
    </Manifest>
  )
}
