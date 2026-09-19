import { createFileRoute } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import { Check } from 'lucide-react'
import { Sheet } from '~/components/base'
import { PageHeader } from '~/components/shell'
import { ErrorState, EmptyState, ManifestSkeleton } from '~/components/states'
import type { Option } from '~/components/filters'
import { FilterBar, SearchBox, ListFilter } from '~/components/filters'
import { RefreshButton } from '~/components/refresh'
import { Pagination } from '~/components/table'
import { DataTable, features, skeletonWidths } from '~/components/data-table'
import { tripColumns } from './columns'
import { DayStrip } from './day-strip'
import { useUrlTableState } from '~/lib/table-state'
import { cn } from '~/lib/cn'
import { NO_DATA, TRIP_STATUS_LABELS, TRIP_TYPE_LABELS, dayLabel, dayLabelFull, plural } from '~/lib/format'
import {
  DIRECTIONS,
  bool,
  integerParam,
  isoDate,
  list,
  pageSize,
  stripDefaults,
  text,
  oneOf,
} from '~/lib/params'
import { TRIP_SORTS, TRIP_STATUSES, TRIP_TYPES, listTrips, parseIsoDate } from '~/server/trips'
import type {
  TripDayCount,
  TripRow,
  TripSearch,
  TripStatusValue,
  TripTypeValue,
} from '~/server/trips'

/* ───────────────────────────────────────────────────────────────────────────
   Corridas: one day's trips, the day strip's signature above the manifest.
   All view state —day, search, filters, sort and page— lives in the URL.
   ─────────────────────────────────────────────────────────────────────────── */

type Search = TripSearch

const URL_DEFAULTS: Search = {
  date: '',
  q: '',
  page: 1,
  perPage: 25,
  sort: 'departure',
  dir: 'asc',
  company: [],
  service: [],
  route: [],
  origin: [],
  destination: [],
  status: [],
  type: [],
  deleted: false,
}

/** Filters a list from the URL down to only the values the catalog accepts. */
function listOf<const T extends ReadonlyArray<string>>(
  value: unknown,
  valid: T,
): Array<T[number]> {
  return list(value).filter((v): v is T[number] => (valid as ReadonlyArray<string>).includes(v))
}

const STATUS_OPTIONS: Array<Option> = TRIP_STATUSES.map((value) => ({
  value,
  label: TRIP_STATUS_LABELS[value] ?? value,
}))

const TYPE_OPTIONS: Array<Option> = TRIP_TYPES.map((value) => ({
  value,
  label: TRIP_TYPE_LABELS[value] ?? value,
}))

/** Restores the default values that do not travel in the URL. */
function withDefaults(s: Partial<Search>): Search {
  return { ...URL_DEFAULTS, ...s }
}

function shiftMonth(dateIso: string, delta: number): string {
  const { year, month } = parseIsoDate(dateIso)
  return new Date(Date.UTC(year, month - 1 + delta, 1)).toISOString().slice(0, 10)
}

/** The analyst's real local calendar day — not the UTC day, and not derived
 *  from `Date.UTC`: "Hoy" means the day it is on their desk. */
function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** Closest day within the visible month strip that has any trips — used to
 *  offer a way out of an empty day without a second query. */
function nearestDayWithData(days: Array<TripDayCount>, date: string): TripDayCount | null {
  const withData = days.filter((d) => d.count > 0)
  if (withData.length === 0) return null
  const target = Number(date.slice(8, 10))
  return withData.reduce((closest, d) =>
    Math.abs(Number(d.date.slice(8, 10)) - target) < Math.abs(Number(closest.date.slice(8, 10)) - target)
      ? d
      : closest,
  )
}

export const Route = createFileRoute('/corridas/')({
  validateSearch: (input: Record<string, unknown>): Partial<Search> =>
    stripDefaults(
      {
        date: isoDate(input.date),
        q: text(input.q),
        page: integerParam(input.page, 1, 1),
        perPage: pageSize(input.perPage),
        sort: oneOf(input.sort, TRIP_SORTS, 'departure'),
        dir: oneOf(input.dir, DIRECTIONS, 'asc'),
        company: list(input.company),
        service: list(input.service),
        route: list(input.route),
        origin: list(input.origin),
        destination: list(input.destination),
        status: listOf(input.status, TRIP_STATUSES),
        type: listOf(input.type, TRIP_TYPES),
        deleted: bool(input.deleted),
      },
      URL_DEFAULTS,
    ),
  loaderDeps: ({ search }) => withDefaults(search),
  loader: ({ deps }) => listTrips({ data: deps }),
  component: Screen,
  pendingComponent: () => (
    <>
      <PageHeader title="Corridas" subtitle="Cargando…" />
      <div className="px-4 sm:px-8 py-6">
        <Sheet className="py-2">
          <ManifestSkeleton columns={skeletonWidths(tripColumns)} />
        </Sheet>
      </div>
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <ErrorState
      title="No fue posible leer las corridas"
      detail={error instanceof Error ? error.message : String(error)}
      onRetry={reset}
    />
  ),
})

/** "Incluir bajas" is a yes/no, not a list: same tokens as `ListFilter`'s
 *  trigger, copied per the repo's convention (`empresas`, `terminales`). */
function Checkbox({
  checked,
  onChange,
  children,
  title,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  children: React.ReactNode
  title?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      title={title}
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
      {children}
    </button>
  )
}

/** Stable empty fallbacks: a fresh array on every render would invalidate the
 *  table's data reference for nothing. */
const NO_ROWS: Array<TripRow> = []
const NO_DAYS: Array<TripDayCount> = []

function Screen() {
  const result = Route.useLoaderData()
  const search = withDefaults(Route.useSearch())
  const navigate = Route.useNavigate()

  function updateSearch(patch: Partial<Search>) {
    navigate({
      search: (prev) => stripDefaults({ ...withDefaults(prev), ...patch }, URL_DEFAULTS),
      replace: true,
    })
  }

  const rows = result.ok ? result.rows : NO_ROWS
  const total = result.ok ? result.total : 0
  const page = result.ok ? result.page : 1
  const days = result.ok ? result.days : NO_DAYS
  // The server resolves an empty `date` to the latest day with data; the URL
  // only ever carries a day the analyst explicitly chose.
  const date = result.ok ? result.date : search.date || todayIso()

  // Hooks run unconditionally, before the `!result.ok` early return below.
  const { sorting, pagination, onSortingChange, onPaginationChange } = useUrlTableState({
    sort: search.sort,
    dir: search.dir,
    page,
    perPage: search.perPage,
    onChange: updateSearch,
  })

  const table = useTable({
    features,
    columns: tripColumns,
    data: rows,
    getRowId: (row) => row.id,
    manualSorting: true,
    manualPagination: true,
    rowCount: total,
    enableSortingRemoval: false, // asc → desc → asc, never unsorted
    enableMultiSort: false, // one sort key, because the URL carries one
    sortDescFirst: false, // parity, and avoids getAutoSortDir's getFilteredRowModel
    state: { sorting, pagination },
    onSortingChange,
    onPaginationChange,
  })

  const hasFilters =
    search.q.trim().length > 0 ||
    search.company.length > 0 ||
    search.service.length > 0 ||
    search.route.length > 0 ||
    search.origin.length > 0 ||
    search.destination.length > 0 ||
    search.status.length > 0 ||
    search.type.length > 0 ||
    search.deleted

  function clearFilters() {
    updateSearch({
      q: '',
      company: [],
      service: [],
      route: [],
      origin: [],
      destination: [],
      status: [],
      type: [],
      deleted: false,
      page: 1,
    })
  }

  if (!result.ok) {
    return (
      <>
        <PageHeader title="Corridas" subtitle={NO_DATA} />
        <ErrorState {...result.failure} />
      </>
    )
  }

  const { options } = result
  const nearest = total === 0 && !hasFilters ? nearestDayWithData(days, date) : null

  return (
    <>
      <PageHeader
        actions={<RefreshButton />}
        title="Corridas"
        subtitle={
          <>
            {hasFilters
              ? `${plural(total, 'corrida', 'corridas')} con los filtros aplicados`
              : plural(total, 'corrida', 'corridas')}{' '}
            · {dayLabelFull(date)}
            <span className="text-ink-4">
              {' '}
              · Sin migrar: operador · autobús · asientos · planeación · despacho
            </span>
          </>
        }
      />

      <div className="px-4 sm:px-8 py-6">
        <Sheet className="overflow-hidden">
          <DayStrip
            days={days}
            selected={date}
            today={todayIso()}
            monthAnchor={date}
            onSelect={(d) => updateSearch({ date: d, page: 1 })}
            onPrevMonth={() => updateSearch({ date: shiftMonth(date, -1), page: 1 })}
            onNextMonth={() => updateSearch({ date: shiftMonth(date, 1), page: 1 })}
            onToday={() => updateSearch({ date: todayIso(), page: 1 })}
          />

          <FilterBar hasFilters={hasFilters} onClear={clearFilters}>
            <SearchBox
              className="w-full max-w-72"
              value={search.q}
              placeholder="Buscar por ruta o terminal…"
              onChange={(q) => updateSearch({ q, page: 1 })}
            />
            <ListFilter
              label="Origen"
              options={options.stations}
              selection={search.origin}
              onChange={(origin) => updateSearch({ origin, page: 1 })}
              searchable
            />
            <ListFilter
              label="Destino"
              options={options.stations}
              selection={search.destination}
              onChange={(destination) => updateSearch({ destination, page: 1 })}
              searchable
            />
            <ListFilter
              label="Empresa"
              options={options.companies}
              selection={search.company}
              onChange={(company) => updateSearch({ company, page: 1 })}
            />
            <ListFilter
              label="Servicio"
              options={options.services}
              selection={search.service}
              onChange={(service) => updateSearch({ service, page: 1 })}
            />
            <ListFilter
              label="Ruta"
              options={options.routes}
              selection={search.route}
              onChange={(route) => updateSearch({ route, page: 1 })}
              searchable
            />
            <ListFilter
              label="Tipo"
              options={TYPE_OPTIONS}
              selection={search.type}
              onChange={(type) => updateSearch({ type: type as Array<TripTypeValue>, page: 1 })}
            />
            <ListFilter
              label="Estatus"
              options={STATUS_OPTIONS}
              selection={search.status}
              onChange={(status) =>
                updateSearch({ status: status as Array<TripStatusValue>, page: 1 })
              }
            />
            <Checkbox
              checked={search.deleted}
              title="Muestra también las corridas con borrado lógico (deletedAt) y las de rutas dadas de baja"
              onChange={(deleted) => updateSearch({ deleted, page: 1 })}
            >
              Incluir bajas
            </Checkbox>
          </FilterBar>

          {rows.length === 0 ? (
            hasFilters ? (
              <EmptyState
                title="Ningún registro coincide"
                detail="No hay corridas que cumplan con la búsqueda y los filtros de esta hoja."
                action={
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex h-8 items-center rounded-chip border border-rule px-3 font-mono text-note font-medium tracking-[0.08em] text-ink-2 uppercase transition-[colors,transform] duration-100 hover:border-rule-strong hover:bg-row hover:text-ink active:scale-[0.97]"
                  >
                    Limpiar filtros
                  </button>
                }
              />
            ) : (
              <EmptyState
                title="Esta hoja no tiene corridas"
                detail={
                  nearest
                    ? `El ${dayLabelFull(date)} no tiene corridas migradas. El día más cercano con datos es el ${dayLabelFull(nearest.date)}.`
                    : `El ${dayLabelFull(date)} no tiene corridas migradas.`
                }
                action={
                  nearest || date !== todayIso() ? (
                    <button
                      type="button"
                      onClick={() =>
                        updateSearch({ date: nearest ? nearest.date : todayIso(), page: 1 })
                      }
                      className="inline-flex h-8 items-center rounded-chip border border-rule px-3 font-mono text-note font-medium tracking-[0.08em] text-ink-2 uppercase transition-[colors,transform] duration-100 hover:border-rule-strong hover:bg-row hover:text-ink active:scale-[0.97]"
                    >
                      {nearest ? `Ver ${dayLabel(nearest.date)}` : 'Ir a hoy'}
                    </button>
                  ) : undefined
                }
              />
            )
          ) : (
            <DataTable
              table={table}
              label="Corridas"
              rowProps={(row) => ({ dimmed: row.original.isDeleted })}
            />
          )}

          {rows.length > 0 ? (
            <Pagination
              page={table.state.pagination.pageIndex + 1}
              perPage={table.state.pagination.pageSize}
              total={table.getRowCount()}
              noun="corridas"
              onPageChange={(p) => table.setPageIndex(p - 1)}
              onPageSizeChange={(t) => table.setPageSize(t)}
            />
          ) : null}
        </Sheet>
      </div>
    </>
  )
}
