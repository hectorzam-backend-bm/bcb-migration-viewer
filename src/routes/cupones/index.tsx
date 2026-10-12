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
import { campaignColumns } from './columns'
import { useUrlTableState } from '~/lib/table-state'
import { NO_DATA, integer, plural } from '~/lib/format'
import { DIRECTIONS, PAGE_SIZES, integerParam, stripDefaults, pageSize, text, oneOf } from '~/lib/params'
import { CAMPAIGN_SORTS, listCampaigns, type CampaignRow, type CampaignSearch } from '~/server/coupons'

const DEFAULTS: CampaignSearch = {
  q: '',
  page: 1,
  perPage: 25,
  sort: 'number',
  dir: 'asc',
}

/** Stable empty fallback: a fresh `[]` on every render would invalidate the
 *  table's data reference for nothing. */
const NO_ROWS: Array<CampaignRow> = []

/** Restores the default values that do not travel in the URL. */
function withDefaults(s: Partial<CampaignSearch>): CampaignSearch {
  return { ...DEFAULTS, ...s }
}

export const Route = createFileRoute('/cupones/')({
  // Only what the user changed travels in the URL; `withDefaults` restores the rest.
  validateSearch: (input: Record<string, unknown>): Partial<CampaignSearch> =>
    stripDefaults(
      {
        q: text(input.q),
        page: integerParam(input.page, 1, 1),
        perPage: pageSize(input.perPage),
        sort: oneOf(input.sort, CAMPAIGN_SORTS, 'number'),
        dir: oneOf(input.dir, DIRECTIONS, 'asc'),
      },
      DEFAULTS,
    ),
  loaderDeps: ({ search }) => withDefaults(search),
  loader: ({ deps }) => listCampaigns({ data: deps }),
  component: Screen,
  pendingComponent: () => (
    <>
      <PageHeader title="Cupones" subtitle="Leyendo las campañas…" />
      <div className="px-4 sm:px-8 py-6">
        <Sheet className="overflow-hidden py-2">
          <ManifestSkeleton columns={skeletonWidths(campaignColumns)} />
        </Sheet>
      </div>
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <>
      <PageHeader title="Cupones" subtitle={NO_DATA} />
      <ErrorState
        title="No fue posible leer las campañas de cupones"
        detail={error instanceof Error ? error.message : String(error)}
        onRetry={reset}
      />
    </>
  ),
})

function prune(search: CampaignSearch): Partial<CampaignSearch> {
  return stripDefaults(search, DEFAULTS)
}

function Screen() {
  const data = Route.useLoaderData()
  const search = withDefaults(Route.useSearch())
  const navigate = Route.useNavigate()

  const updateSearch = useCallback(
    (patch: Partial<CampaignSearch>) => {
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
    columns: campaignColumns,
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
        <PageHeader title="Cupones" subtitle={NO_DATA} />
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
        title="Cupones"
        subtitle={
          total === catalogTotal
            ? plural(total, 'campaña', 'campañas')
            : `${integer(total)} de ${integer(catalogTotal)} campañas`
        }
      />

      <div className="px-4 sm:px-8 py-6">
        <Sheet className="overflow-hidden">
          <FilterBar hasFilters={hasFilters} onClear={clear}>
            <SearchBox
              className="w-full max-w-[19rem]"
              value={search.q}
              onChange={onSearch}
              placeholder="Buscar número, nombre o código…"
            />
          </FilterBar>

          {rows.length === 0 ? (
            catalogTotal === 0 ? (
              <EmptyState
                title="No hay campañas de cupones"
                detail="La base conectada no tiene cupones. Los del sistema legado llegan con el paso «Cupones» de /importar."
              />
            ) : (
              <EmptyState
                title="Ninguna campaña coincide con la búsqueda"
                detail="La búsqueda revisa el número, el nombre, el prefijo y los códigos de cada campaña."
              />
            )
          ) : (
            <DataTable table={table} label="Campañas de cupones" />
          )}

          <Pagination
            page={table.state.pagination.pageIndex + 1}
            perPage={table.state.pagination.pageSize}
            total={table.getRowCount()}
            pageSizes={[...PAGE_SIZES]}
            noun="campañas"
            onPageChange={(p) => table.setPageIndex(p - 1)}
            onPageSizeChange={(t) => table.setPageSize(t)}
          />
        </Sheet>
      </div>
    </>
  )
}
