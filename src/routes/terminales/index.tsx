import { useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import { Check } from 'lucide-react'
import { Sheet } from '~/components/base'
import { PageHeader } from '~/components/shell'
import { ErrorState, EmptyState, ManifestSkeleton } from '~/components/states'
import { FilterBar, SearchBox, ListFilter } from '~/components/filters'
import { RefreshButton } from '~/components/refresh'
import { Pagination } from '~/components/table'
import { DataTable, features, skeletonWidths } from '~/components/data-table'
import { stationColumns } from './columns'
import { useUrlTableState } from '~/lib/table-state'
import { cn } from '~/lib/cn'
import { STATION_TYPE_LABELS, plural } from '~/lib/format'
import {
  DIRECTIONS,
  PAGE_SIZES,
  bool,
  integerParam,
  stripDefaults,
  list,
  pageSize,
  text,
  oneOf,
  type Direction,
} from '~/lib/params'
import {
  STATION_STATUSES,
  STATION_SORTS,
  STATION_TYPES,
  listStations,
  type StationRow,
  type StationSearch,
} from '~/server/stations'

/**
 * Two shapes of the same state:
 *  · `UrlSearch` is what gets written to the URL — everything optional and the
 *    lists in a single comma-separated string, so the link can be read and
 *    pasted. The router rewrites the URL with whatever `validateSearch`
 *    returns: if it returned the whole object, every visit would end up with
 *    `?q=&page=1&perPage=25&…` on top.
 *  · `StationSearch` is what the server function consumes, already complete.
 */
type UrlSearch = {
  q?: string
  page?: number
  perPage?: number
  sort?: (typeof STATION_SORTS)[number]
  dir?: Direction
  company?: string
  service?: string
  type?: string
  state?: string
  status?: string
  deleted?: boolean
}

const URL_DEFAULTS = {
  q: '',
  page: 1,
  perPage: PAGE_SIZES[0],
  sort: 'number',
  dir: 'asc',
  company: '',
  service: '',
  type: '',
  state: '',
  status: '',
  deleted: false,
} satisfies Required<UrlSearch>

/** Fills in the defaults: the view and the server always receive everything. */
function withDefaults(s: UrlSearch): StationSearch {
  return {
    q: s.q ?? URL_DEFAULTS.q,
    page: s.page ?? URL_DEFAULTS.page,
    perPage: s.perPage ?? URL_DEFAULTS.perPage,
    sort: s.sort ?? 'number',
    dir: s.dir ?? 'asc',
    company: list(s.company),
    service: list(s.service),
    type: list(s.type),
    state: list(s.state),
    status: list(s.status),
    deleted: s.deleted ?? URL_DEFAULTS.deleted,
  }
}

/** Drops from the URL everything that already is the default value. */
function toUrl(b: StationSearch): UrlSearch {
  return stripDefaults(
    {
      q: b.q.trim(),
      page: b.page,
      perPage: b.perPage,
      sort: b.sort,
      dir: b.dir,
      company: b.company.join(','),
      service: b.service.join(','),
      type: b.type.join(','),
      state: b.state.join(','),
      status: b.status.join(','),
      deleted: b.deleted,
    },
    URL_DEFAULTS,
  )
}

export const Route = createFileRoute('/terminales/')({
  validateSearch: (input: Record<string, unknown>): UrlSearch =>
    toUrl({
      q: text(input.q),
      page: integerParam(input.page, 1, 1),
      perPage: pageSize(input.perPage),
      sort: oneOf(input.sort, STATION_SORTS, 'number'),
      dir: oneOf(input.dir, DIRECTIONS, 'asc'),
      company: list(input.company),
      service: list(input.service),
      type: list(input.type),
      state: list(input.state),
      status: list(input.status),
      deleted: bool(input.deleted),
    }),
  loaderDeps: ({ search }) => withDefaults(search),
  loader: ({ deps }) => listStations({ data: deps }),
  component: Screen,
  pendingComponent: () => (
    <>
      <PageHeader title="Terminales" subtitle="Leyendo el catálogo…" />
      <div className="px-4 sm:px-8 py-6">
        <Sheet className="overflow-hidden py-2">
          <ManifestSkeleton columns={skeletonWidths(stationColumns)} />
        </Sheet>
      </div>
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <>
      <PageHeader title="Terminales" />
      <ErrorState
        title="No fue posible leer el catálogo de terminales"
        detail={error instanceof Error ? error.message : String(error)}
        onRetry={reset}
      />
    </>
  ),
})

/* ── Local controls ───────────────────────────────────────────────────────── */

/** Filter-bar checkbox. Not a data switch: it filters the view. */
function Checkbox({
  name,
  checked,
  onChange,
}: {
  name: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-chip border px-3 text-body',
        'transition-[colors,transform] duration-100 active:scale-[0.98]',
        checked
          ? 'border-stamp/40 bg-stamp-wash text-ink'
          : 'border-rule border-dashed bg-transparent text-ink-2 hover:border-rule-strong hover:border-solid hover:bg-row',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid size-[15px] shrink-0 place-items-center rounded-[2px] border transition-colors duration-100',
          checked ? 'border-stamp bg-stamp text-sheet' : 'border-rule-strong',
        )}
      >
        {checked ? <Check size={10} strokeWidth={3} /> : null}
      </span>
      <span className="font-medium whitespace-nowrap">{name}</span>
    </button>
  )
}

/* ── Screen ───────────────────────────────────────────────────────────────── */

/** Stable empty fallbacks: a fresh `[]`/`{}` on every render would invalidate
 *  the table's data reference, and the filter options, for nothing. */
const NO_ROWS: Array<StationRow> = []
const NO_OPTIONS = { companies: [], services: [], states: [] }

function Screen() {
  const data = Route.useLoaderData()
  const search = withDefaults(Route.useSearch())
  const navigate = Route.useNavigate()

  const update = useCallback(
    (patch: Partial<StationSearch>, resetPage = true) => {
      void navigate({
        search: (prev) =>
          toUrl({
            ...withDefaults(prev),
            ...patch,
            ...(resetPage ? { page: 1 } : {}),
          }),
        replace: true,
      })
    },
    [navigate],
  )

  const onSearch = useCallback((q: string) => update({ q }), [update])

  const hasFilters =
    search.q.trim() !== '' ||
    search.company.length > 0 ||
    search.service.length > 0 ||
    search.type.length > 0 ||
    search.state.length > 0 ||
    search.status.length > 0 ||
    search.deleted

  const rows = data.ok ? data.rows : NO_ROWS
  const total = data.ok ? data.total : 0
  const page = data.ok ? data.page : 1
  const options = data.ok ? data.options : NO_OPTIONS

  // Hooks run unconditionally, before the `!data.ok` early return below. The
  // bridge's patch already carries the right `page` for every case (1 on a
  // sort or page-size change, the target page otherwise), so `resetPage` is
  // always turned off here — `update`'s own default would otherwise clobber
  // a plain page change the same way the original `onPageChange` avoided it.
  const { sorting, pagination, onSortingChange, onPaginationChange } = useUrlTableState({
    sort: search.sort,
    dir: search.dir,
    page,
    perPage: search.perPage,
    onChange: (patch) => update(patch, false),
  })

  const table = useTable({
    features,
    columns: stationColumns,
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
        <PageHeader title="Terminales" />
        <ErrorState {...data.failure} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        actions={<RefreshButton />}
        title="Terminales"
        subtitle={
          hasFilters
            ? `${plural(total, 'terminal', 'terminales')} con los filtros aplicados`
            : plural(total, 'terminal en el catálogo', 'terminales en el catálogo')
        }
      />

      <div className="px-4 sm:px-8 py-6">
        <Sheet className="overflow-hidden">
          <FilterBar
            hasFilters={hasFilters}
            onClear={() =>
              update({
                q: '',
                company: [],
                service: [],
                type: [],
                state: [],
                status: [],
                deleted: false,
              })
            }
          >
            <SearchBox
              value={search.q}
              onChange={onSearch}
              placeholder="Buscar por número, nombre o dirección…"
              className="w-full max-w-[22rem]"
            />
            <ListFilter
              label="Empresa"
              options={options.companies}
              selection={search.company}
              onChange={(company) => update({ company })}
            />
            <ListFilter
              label="Servicio"
              options={options.services}
              selection={search.service}
              onChange={(service) => update({ service })}
            />
            <ListFilter
              label="Tipo"
              options={STATION_TYPES.map((t) => ({
                value: t,
                label: STATION_TYPE_LABELS[t] ?? t,
              }))}
              selection={search.type}
              onChange={(type) => update({ type })}
            />
            <ListFilter
              label="Estado"
              options={options.states}
              selection={search.state}
              onChange={(state) => update({ state })}
            />
            <ListFilter
              label="Estatus"
              options={STATION_STATUSES.map((e) => ({
                value: e,
                label: e === 'active' ? 'Activa' : 'Inactiva',
              }))}
              selection={search.status}
              onChange={(status) => update({ status })}
            />
            <Checkbox
              name="Incluir bajas"
              checked={search.deleted}
              onChange={(deleted) => update({ deleted })}
            />
          </FilterBar>

          {rows.length === 0 ? (
            hasFilters ? (
              <EmptyState
                title="Ninguna terminal coincide"
                detail="Ningún registro cumple con la búsqueda y los filtros activos. Prueba con menos criterios."
              />
            ) : (
              <EmptyState
                title="El catálogo de terminales está vacío"
                detail="La base conectada no tiene terminales vigentes. Si esperabas registros, revisa que apuntes a la base migrada."
              />
            )
          ) : (
            <DataTable
              table={table}
              label="Catálogo de terminales"
              rowProps={(row) => ({ dimmed: row.original.isDeleted })}
            />
          )}

          <Pagination
            page={table.state.pagination.pageIndex + 1}
            perPage={table.state.pagination.pageSize}
            total={table.getRowCount()}
            noun="terminales"
            pageSizes={[...PAGE_SIZES]}
            onPageChange={(p) => table.setPageIndex(p - 1)}
            onPageSizeChange={(t) => table.setPageSize(t)}
          />
        </Sheet>
      </div>
    </>
  )
}
