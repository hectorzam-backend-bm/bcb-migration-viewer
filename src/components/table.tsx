import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import {
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import type { LinkProps } from '@tanstack/react-router'
import { cn } from '~/lib/cn'
import { integer } from '~/lib/format'

/* The manifest: a ruled table. No zebra —the fine rule already guides the eye—
   and no vertical borders, which would cut the row into pieces.            */

export function Manifest({
  children,
  className,
  label,
}: {
  children: ReactNode
  className?: string
  label: string
}) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table
        aria-label={label}
        className="w-full border-collapse text-body"
      >
        {children}
      </table>
    </div>
  )
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-sheet">
      <tr className="[&>th]:border-b-[3px] [&>th]:border-double [&>th]:border-rule-strong">
        {children}
      </tr>
    </thead>
  )
}

type AlignmentProps = { numeric?: boolean }

export function Th({
  children,
  className,
  numeric,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & AlignmentProps) {
  return (
    <th
      scope="col"
      className={cn(
        'px-3 py-2.5 text-left align-bottom font-mono text-note font-medium tracking-[0.085em] text-ink-3 uppercase',
        numeric && 'text-right',
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  )
}

/** Sorting header. The indicator only appears on the active column. */
export function SortableTh({
  children,
  field,
  currentSort,
  direction,
  onSort,
  numeric,
  className,
}: {
  children: ReactNode
  field: string
  currentSort: string
  direction: 'asc' | 'desc'
  onSort: (field: string) => void
  numeric?: boolean
  className?: string
}) {
  const active = currentSort === field
  return (
    <Th numeric={numeric} className={cn('p-0', className)} aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          'group flex w-full items-center gap-1.5 px-3 py-2.5 font-mono text-note font-medium tracking-[0.085em] uppercase transition-colors duration-100',
          'hover:text-ink focus-visible:text-ink',
          numeric && 'justify-end',
          active ? 'text-ink' : 'text-ink-3',
        )}
      >
        {children}
        <ArrowUp
          size={11}
          strokeWidth={2.25}
          aria-hidden
          className={cn(
            'shrink-0 transition-[opacity,transform] duration-150',
            active
              ? cn('opacity-100', direction === 'desc' && 'rotate-180')
              : 'opacity-0 group-hover:opacity-40',
          )}
        />
      </button>
    </Th>
  )
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>
}

export function TableRow({
  children,
  className,
  highlighted,
  dimmed,
  ...rest
}: React.HTMLAttributes<HTMLTableRowElement> & {
  highlighted?: boolean
  dimmed?: boolean
}) {
  return (
    <tr
      className={cn(
        'relative border-b border-rule-faint transition-colors duration-100 last:border-b-0',
        'hover:bg-row has-focus-visible:bg-row',
        highlighted && 'bg-stamp-wash/45',
        dimmed && 'text-ink-3',
        className,
      )}
      {...rest}
    >
      {children}
    </tr>
  )
}

export function Td({
  children,
  className,
  numeric,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & AlignmentProps) {
  return (
    <td
      className={cn(
        'px-3 py-2.5 align-middle',
        numeric && 'text-right font-mono text-data',
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  )
}

/**
 * Link that covers the whole row without nesting controls: a single focusable
 * element per row, and the rest of the cells stay selectable.
 */
export function RowLink({
  children,
  className,
  ...linkProps
}: LinkProps & { children: ReactNode; className?: string }) {
  return (
    <Link
      {...linkProps}
      className={cn(
        'after:absolute after:inset-0 after:content-[""] hover:text-stamp focus-visible:outline-none',
        className,
      )}
    >
      {children}
    </Link>
  )
}

/* ── Manifest footer: count and pagination ───────────────────────────────── */

function PageButton({
  children,
  disabled,
  onClick,
  label,
}: {
  children: ReactNode
  disabled?: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-chip border border-rule text-ink-2 transition-[colors,transform] duration-100',
        'hover:border-rule-strong hover:bg-row hover:text-ink active:scale-[0.97]',
        'disabled:pointer-events-none disabled:border-rule-faint disabled:text-ink-4',
      )}
    >
      {children}
    </button>
  )
}

export function Pagination({
  page,
  perPage,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizes = [25, 50, 100],
  noun = 'registros',
}: {
  page: number
  perPage: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  pageSizes?: Array<number>
  noun?: string
}) {
  const pages = Math.max(1, Math.ceil(total / perPage))
  const from = total === 0 ? 0 : (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-rule px-4 py-3">
      <p data-numeric className="font-mono text-data text-ink-3">
        {total === 0 ? (
          `Sin ${noun}`
        ) : (
          <>
            <span className="text-ink-2">
              {integer(from)}–{integer(to)}
            </span>{' '}
            de <span className="text-ink-2">{integer(total)}</span> {noun}
          </>
        )}
      </p>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 font-mono text-note tracking-[0.06em] text-ink-3 uppercase">
          Por hoja
          {/* Native select —keyboard and accessibility for free— but without the
              operating system's control on top of the paper: its appearance is
              stripped and it gets the same chip as the rest of the controls. */}
          <span className="relative inline-flex items-center">
            <select
              value={perPage}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className={cn(
                'h-8 appearance-none rounded-chip border border-rule bg-sunken py-0 pr-6 pl-2',
                'font-mono text-data text-ink transition-colors duration-100',
                'hover:border-rule-strong focus:border-stamp/50 focus:outline-none',
              )}
            >
              {pageSizes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              strokeWidth={1.75}
              aria-hidden
              className="pointer-events-none absolute right-1.5 text-ink-4"
            />
          </span>
        </label>

        <div className="flex items-center gap-1.5">
          <PageButton label="Primera hoja" disabled={page <= 1} onClick={() => onPageChange(1)}>
            <ChevronsLeft size={15} strokeWidth={1.75} />
          </PageButton>
          <PageButton label="Hoja anterior" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft size={15} strokeWidth={1.75} />
          </PageButton>

          <span data-numeric className="min-w-[5.5rem] text-center font-mono text-data text-ink-2">
            {integer(page)} <span className="text-ink-4">/</span> {integer(pages)}
          </span>

          <PageButton label="Hoja siguiente" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
            <ChevronRight size={15} strokeWidth={1.75} />
          </PageButton>
          <PageButton label="Última hoja" disabled={page >= pages} onClick={() => onPageChange(pages)}>
            <ChevronsRight size={15} strokeWidth={1.75} />
          </PageButton>
        </div>
      </div>
    </div>
  )
}
