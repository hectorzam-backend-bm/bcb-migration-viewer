import { useMemo } from 'react'
import { functionalUpdate } from '@tanstack/react-table'
import type { OnChangeFn, PaginationState, SortingState } from '@tanstack/react-table'
import type { Direction } from './params'

/**
 * Bridges a catalog route's URL search params to a `useTable` instance running
 * in manual mode. The URL stays the single source of truth: this hook only
 * translates `{ sort, dir, page, perPage }` into `SortingState` / `PaginationState`
 * for the table to read, and translates the table's `onSortingChange` /
 * `onPaginationChange` callbacks back into a URL patch.
 *
 * `OnChangeFn` hands over a value *or* an updater function — `functionalUpdate`
 * resolves both, so the callback never has to guess which one it received.
 */
export function useUrlTableState<TSort extends string = string>({
  sort,
  dir,
  page,
  perPage,
  onChange,
}: {
  sort: TSort
  dir: Direction
  page: number
  perPage: number
  onChange: (patch: {
    sort?: TSort
    dir?: Direction
    page?: number
    perPage?: number
  }) => void
}) {
  const sorting = useMemo<SortingState>(() => [{ id: sort, desc: dir === 'desc' }], [sort, dir])

  const pagination = useMemo<PaginationState>(
    () => ({ pageIndex: page - 1, pageSize: perPage }),
    [page, perPage],
  )

  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = functionalUpdate(updater, sorting)[0]
    // `enableSortingRemoval: false` on the table keeps the cycle to asc/desc,
    // so this should never actually clear — the guard is for the type only.
    if (!next) return
    // `next.id` is a column id, a plain string; the cast mirrors what the
    // hand-written `sortBy` functions already did (`field as Search['sort']`)
    // and is safe because every sortable column's id is one of TSort by
    // construction — see each route's `columns.tsx`.
    onChange({ sort: next.id as TSort, dir: next.desc ? 'desc' : 'asc', page: 1 })
  }

  const onPaginationChange: OnChangeFn<PaginationState> = (updater) => {
    const next = functionalUpdate(updater, pagination)
    // Changing the page size restarts at the first sheet, as it does today;
    // moving pages keeps the current size.
    onChange(
      next.pageSize === pagination.pageSize
        ? { page: next.pageIndex + 1 }
        : { perPage: next.pageSize, page: 1 },
    )
  }

  return { sorting, pagination, onSortingChange, onPaginationChange }
}
