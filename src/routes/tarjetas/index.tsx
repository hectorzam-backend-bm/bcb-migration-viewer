import { useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import { Sheet } from '~/components/base'
import { PageHeader } from '~/components/shell'
import { ErrorState, EmptyState, ManifestSkeleton } from '~/components/states'
import { FilterBar, SearchBox } from '~/components/filters'
import { RefreshButton } from '~/components/refresh'
import { Pagination } from '~/components/table'
import { DataTable, features, skeletonWidths } from '~/components/data-table'
import { travelCardColumns } from './columns'
import { useUrlTableState } from '~/lib/table-state'
import { NO_DATA, integer, plural } from '~/lib/format'
import { DIRECTIONS, PAGE_SIZES, integerParam, stripDefaults, pageSize, text, oneOf } from '~/lib/params'
import {
  TRAVEL_CARD_SORTS,
  listTravelCards,
  type TravelCardRow,
  type TravelCardSearch,
} from '~/server/travel-cards'

const DEFAULTS: TravelCardSearch = {
  q: '',
  page: 1,
  perPage: 25,
  sort: 'departure',
  dir: 'desc',
}

/** Stable empty fallback: a fresh `[]` on every render would invalidate the
 *  table's data reference for nothing. */
const NO_ROWS: Array<TravelCardRow> = []

/** Restores the default values that do not travel in the URL. */
function withDefaults(s: Partial<TravelCardSearch>): TravelCardSearch {
  return { ...DEFAULTS, ...s }
}

export const Route = createFileRoute('/tarjetas/')({
  // Only what the user changed travels in the URL; `withDefaults` restores the rest.
  validateSearch: (input: Record<string, unknown>): Partial<TravelCardSearch> =>
    stripDefaults(
      {
        q: text(input.q),
        page: integerParam(input.page, 1, 1),
        perPage: pageSize(input.perPage),
        sort: oneOf(input.sort, TRAVEL_CARD_SORTS, 'departure'),
        dir: oneOf(input.dir, DIRECTIONS, 'desc'),
      },
      DEFAULTS,
    ),
  loaderDeps: ({ search }) => withDefaults(search),
  loader: ({ deps }) => listTravelCards({ data: deps }),
  component: Screen,
  pendingComponent: () => (
    <>
      <PageHeader title="Tarjetas de viaje" subtitle="Leyendo las tarjetas…" />
      <div className="px-4 sm:px-8 py-6">
        <Sheet className="overflow-hidden py-2">
          <ManifestSkeleton columns={skeletonWidths(travelCardColumns)} />
        </Sheet>
      </div>
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <>
      <PageHeader title="Tarjetas de viaje" subtitle={NO_DATA} />
      <ErrorState
        title="No fue posible leer las tarjetas de viaje"
        detail={error instanceof Error ? error.message : String(error)}
        onRetry={reset}
      />
    </>
  ),
})

function prune(search: TravelCardSearch): Partial<TravelCardSearch> {
  return stripDefaults(search, DEFAULTS)
}

function Screen() {
  const data = Route.useLoaderData()
  const search = withDefaults(Route.useSearch())
  const navigate = Route.useNavigate()

  const updateSearch = useCallback(
    (patch: Partial<TravelCardSearch>) => {
      navigate({
        search: (prev) => prune({ ...withDefaults(prev), page: 1, ...patch }),
        replace: true,
      })
    },
    [navigate],
  )

  const onSearch = useCallback((q: string) => updateSearch({ q }), [updateSearch])

  const rows = data.ok ? data.rows : NO_ROWS
  const total = data.ok ? data.total : 0
  const catalogTotal = data.ok ? data.catalogTotal : 0
  const page = data.ok ? data.page : 1

  // Hooks run unconditionally, before the `!data.ok` early return below.
  const { sorting, pagination, onSortingChange, onPaginationChange } = useUrlTableState({
    sort: search.sort,
    dir: search.dir,
    page,
    perPage: search.perPage,
    onChange: updateSearch,
  })

  const table = useTable({
    features,
    columns: travelCardColumns,
    data: rows,
    getRowId: (row) => row.id,
    manualSorting: true,
    manualPagination: true,
    rowCount: total,
    enableSortingRemoval: false,
    enableMultiSort: false,
    sortDescFirst: false,
    state: { sorting, pagination },
    onSortingChange,
    onPaginationChange,
  })

  if (!data.ok) {
    return (
      <>
        <PageHeader title="Tarjetas de viaje" subtitle={NO_DATA} />
        <ErrorState {...data.failure} />
      </>
    )
  }

  const hasFilters = search.q.trim().length > 0
  const clear = () => navigate({ search: () => prune({ ...DEFAULTS, perPage: search.perPage }), replace: true })

  return (
    <>
      <PageHeader
        actions={<RefreshButton />}
        title="Tarjetas de viaje"
        subtitle={
          total === catalogTotal
            ? plural(total, 'tarjeta', 'tarjetas')
            : `${integer(total)} de ${integer(catalogTotal)} tarjetas`
        }
      />

      <div className="px-4 sm:px-8 py-6">
        <Sheet className="overflow-hidden">
          <FilterBar hasFilters={hasFilters} onClear={clear}>
            <SearchBox
              className="w-full max-w-[19rem]"
              value={search.q}
              onChange={onSearch}
              placeholder="Buscar folio, número o corrida…"
            />
          </FilterBar>

          {rows.length === 0 ? (
            catalogTotal === 0 ? (
              <EmptyState
                title="No hay tarjetas de viaje"
                detail="La base conectada no tiene tarjetas. Las del sistema legado llegan con el paso «Tarjetas de viaje» de /importar."
              />
            ) : (
              <EmptyState
                title="Ninguna tarjeta coincide con la búsqueda"
                detail="La búsqueda revisa el folio impreso, el número consecutivo y la clave de la corrida."
              />
            )
          ) : (
            <DataTable table={table} label="Tarjetas de viaje" />
          )}

          <Pagination
            page={table.state.pagination.pageIndex + 1}
            perPage={table.state.pagination.pageSize}
            total={table.getRowCount()}
            pageSizes={[...PAGE_SIZES]}
            noun="tarjetas"
            onPageChange={(p) => table.setPageIndex(p - 1)}
            onPageSizeChange={(t) => table.setPageSize(t)}
          />
        </Sheet>
      </div>
    </>
  )
}
