import { createFileRoute, Link } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import { Sheet } from '~/components/base'
import { PageHeader } from '~/components/shell'
import { ErrorState, EmptyState, ManifestSkeleton } from '~/components/states'
import type { Option } from '~/components/filters'
import { FilterBar, SearchBox, ListFilter } from '~/components/filters'
import { RefreshButton } from '~/components/refresh'
import { Pagination } from '~/components/table'
import { DataTable, features, skeletonWidths } from '~/components/data-table'
import { ticketColumns } from './columns'
import { useUrlTableState } from '~/lib/table-state'
import { cn } from '~/lib/cn'
import {
  NO_DATA,
  PAYMENT_METHOD_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_TYPE_LABELS,
  integer,
  plural,
} from '~/lib/format'
import { DIRECTIONS, integerParam, isoDate, list, pageSize, stripDefaults, text, oneOf } from '~/lib/params'
import {
  ORDER_TYPES,
  PAYMENT_METHODS,
  TICKET_SORTS,
  TICKET_STATUSES,
  getTicketHealth,
  listTickets,
} from '~/server/tickets'
import type {
  OrderTypeValue,
  PaymentMethodValue,
  TicketRow,
  TicketSearch,
  TicketStatusValue,
} from '~/server/tickets'
import { STEPS } from '~/routes/importar/steps'

/* ───────────────────────────────────────────────────────────────────────────
   Boletos: a flat, filterable manifest — not a DayStrip. The date is one
   optional filter among several, not the organizing unit: unlike corridas,
   there is no single "day" a boleto belongs to that matters more than any
   other fact about it. All view state lives in the URL, as everywhere else.
   ─────────────────────────────────────────────────────────────────────────── */

type Search = TicketSearch

const URL_DEFAULTS: Search = {
  q: '',
  date: '',
  page: 1,
  perPage: 25,
  sort: 'sold',
  // El manifiesto de ventas se lee de lo más reciente hacia atrás — al revés
  // que corridas, que ordena una tabla de horarios de temprano a tarde.
  dir: 'desc',
  company: [],
  service: [],
  status: [],
  channel: [],
  payment: [],
  type: [],
  terminal: [],
  trip: [],
}

/** Filters a list from the URL down to only the values the catalog accepts. */
function listOf<const T extends ReadonlyArray<string>>(value: unknown, valid: T): Array<T[number]> {
  return list(value).filter((v): v is T[number] => (valid as ReadonlyArray<string>).includes(v))
}

const STATUS_OPTIONS: Array<Option> = TICKET_STATUSES.map((value) => ({
  value,
  label: TICKET_STATUS_LABELS[value] ?? value,
}))

const PAYMENT_OPTIONS: Array<Option> = PAYMENT_METHODS.map((value) => ({
  value,
  label: PAYMENT_METHOD_LABELS[value] ?? value,
}))

const TYPE_OPTIONS: Array<Option> = ORDER_TYPES.map((value) => ({
  value,
  label: TICKET_TYPE_LABELS[value] ?? value,
}))

/** Restores the default values that do not travel in the URL. */
function withDefaults(s: Partial<Search>): Search {
  return { ...URL_DEFAULTS, ...s }
}

/** The Boletos step's index, read from the wizard's own step table instead of
 *  a hardcoded number — same reasoning `importar/index.tsx` uses for its
 *  `tripsIndex`. */
const BOLETOS_STEP = STEPS.findIndex((s) => s.importStep === 'boletos')

export const Route = createFileRoute('/boletos/')({
  validateSearch: (input: Record<string, unknown>): Partial<Search> =>
    stripDefaults(
      {
        q: text(input.q),
        date: isoDate(input.date),
        page: integerParam(input.page, 1, 1),
        perPage: pageSize(input.perPage),
        sort: oneOf(input.sort, TICKET_SORTS, 'sold'),
        dir: oneOf(input.dir, DIRECTIONS, 'desc'),
        company: list(input.company),
        service: list(input.service),
        status: listOf(input.status, TICKET_STATUSES),
        channel: list(input.channel),
        payment: listOf(input.payment, PAYMENT_METHODS),
        type: listOf(input.type, ORDER_TYPES),
        terminal: list(input.terminal),
        trip: list(input.trip),
      },
      URL_DEFAULTS,
    ),
  loaderDeps: ({ search }) => withDefaults(search),
  loader: ({ deps }) =>
    Promise.all([listTickets({ data: deps }), getTicketHealth()]).then(([tickets, health]) => ({
      tickets,
      health,
    })),
  component: Screen,
  pendingComponent: () => (
    <>
      <PageHeader title="Boletos" subtitle="Cargando…" />
      <div className="px-4 sm:px-8 py-6">
        <Sheet className="py-2">
          <ManifestSkeleton columns={skeletonWidths(ticketColumns)} />
        </Sheet>
      </div>
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <ErrorState
      title="No fue posible leer los boletos"
      detail={error instanceof Error ? error.message : String(error)}
      onRetry={reset}
    />
  ),
})

/** El día es un filtro, no la unidad de organización (eso es el `DayStrip` de
 *  corridas). Campo nativo `date`, con la misma superficie que un `ListFilter`
 *  con selección activa. */
function DayFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Filtrar por fecha de venta"
      title="Filtra por el día de la venta"
      className={cn(
        'h-9 rounded-chip border px-2.5 font-mono text-data text-ink transition-colors duration-100 focus:outline-none',
        '[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50',
        '[&::-webkit-calendar-picker-indicator]:hover:opacity-100',
        value
          ? 'border-stamp/40 bg-stamp-wash'
          : 'border-rule border-dashed bg-sunken text-ink-2 hover:border-rule-strong hover:border-solid focus:border-stamp/50',
      )}
    />
  )
}

const OUTLINE_BUTTON_CLASS =
  'inline-flex h-8 items-center rounded-chip border border-rule px-3 font-mono text-note font-medium tracking-[0.08em] text-ink-2 uppercase transition-[colors,transform] duration-100 hover:border-rule-strong hover:bg-row hover:text-ink active:scale-[0.97]'

/** Stable empty fallback: a fresh array on every render would invalidate the
 *  table's data reference for nothing. */
const NO_ROWS: Array<TicketRow> = []

function Screen() {
  const data = Route.useLoaderData()
  const search = withDefaults(Route.useSearch())
  const navigate = Route.useNavigate()

  function updateSearch(patch: Partial<Search>) {
    navigate({
      search: (prev) => stripDefaults({ ...withDefaults(prev), ...patch }, URL_DEFAULTS),
      replace: true,
    })
  }

  const result = data.tickets
  const health = data.health

  const rows = result.ok ? result.rows : NO_ROWS
  const total = result.ok ? result.total : 0
  const page = result.ok ? result.page : 1

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
    columns: ticketColumns,
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

  const hasFilters =
    search.q.trim().length > 0 ||
    search.date !== '' ||
    search.company.length > 0 ||
    search.service.length > 0 ||
    search.status.length > 0 ||
    search.channel.length > 0 ||
    search.payment.length > 0 ||
    search.type.length > 0 ||
    search.terminal.length > 0 ||
    search.trip.length > 0

  function clearFilters() {
    updateSearch({
      q: '',
      date: '',
      company: [],
      service: [],
      status: [],
      channel: [],
      payment: [],
      type: [],
      terminal: [],
      trip: [],
      page: 1,
    })
  }

  if (!result.ok) {
    return (
      <>
        <PageHeader title="Boletos" subtitle={NO_DATA} />
        <ErrorState {...result.failure} />
      </>
    )
  }

  const { options } = result
  const withoutTrip = health.ok ? health.health.withoutTrip : 0

  return (
    <>
      <PageHeader
        actions={<RefreshButton />}
        title="Boletos"
        subtitle={
          <>
            {hasFilters
              ? `${plural(total, 'boleto', 'boletos')} con los filtros aplicados`
              : plural(total, 'boleto migrado', 'boletos migrados')}
            {withoutTrip > 0 ? (
              <span className="text-amber"> · {integer(withoutTrip)} sin corrida</span>
            ) : null}
            <span className="text-ink-4"> · Sin migrar: asesor · caja · corte</span>
          </>
        }
      />

      <div className="px-4 sm:px-8 py-6">
        <Sheet className="overflow-hidden">
          <FilterBar hasFilters={hasFilters} onClear={clearFilters}>
            <SearchBox
              className="w-full max-w-80"
              value={search.q}
              placeholder="Buscar folio, pasajero o clave de corrida…"
              onChange={(q) => updateSearch({ q, page: 1 })}
            />
            <DayFilter value={search.date} onChange={(date) => updateSearch({ date, page: 1 })} />
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
              label="Estatus"
              options={STATUS_OPTIONS}
              selection={search.status}
              onChange={(status) => updateSearch({ status: status as Array<TicketStatusValue>, page: 1 })}
            />
            <ListFilter
              label="Canal de venta"
              options={options.channels}
              selection={search.channel}
              onChange={(channel) => updateSearch({ channel, page: 1 })}
            />
            <ListFilter
              label="Forma de pago"
              options={PAYMENT_OPTIONS}
              selection={search.payment}
              onChange={(payment) => updateSearch({ payment: payment as Array<PaymentMethodValue>, page: 1 })}
            />
            <ListFilter
              label="Tipo de boleto"
              options={TYPE_OPTIONS}
              selection={search.type}
              onChange={(type) => updateSearch({ type: type as Array<OrderTypeValue>, page: 1 })}
            />
            <ListFilter
              label="Terminal de venta"
              options={options.terminals}
              selection={search.terminal}
              onChange={(terminal) => updateSearch({ terminal, page: 1 })}
              searchable
            />
          </FilterBar>

          {rows.length === 0 ? (
            hasFilters ? (
              <EmptyState
                title="Ningún boleto coincide"
                detail={
                  search.trip.length === 1
                    ? 'Esa corrida no tiene boletos migrados con estos filtros. El conteo que se ve en /corridas viene de un contador del CSV legado (boletos vendidos), no de contar boletos reales — pueden no coincidir.'
                    : 'No hay boletos que cumplan con la búsqueda y los filtros de esta hoja.'
                }
                action={
                  <button type="button" onClick={clearFilters} className={OUTLINE_BUTTON_CLASS}>
                    Limpiar filtros
                  </button>
                }
              />
            ) : (
              <EmptyState
                title="El manifiesto de boletos está vacío"
                detail="La base conectada no tiene ningún boleto migrado todavía. El paso «Boletos» de /importar los sube desde boletos.csv."
                action={
                  BOLETOS_STEP >= 0 ? (
                    <Link to="/importar" search={{ paso: BOLETOS_STEP }} className={OUTLINE_BUTTON_CLASS}>
                      Ir a Importar
                    </Link>
                  ) : undefined
                }
              />
            )
          ) : (
            <DataTable table={table} label="Boletos" />
          )}

          {rows.length > 0 ? (
            <Pagination
              page={table.state.pagination.pageIndex + 1}
              perPage={table.state.pagination.pageSize}
              total={table.getRowCount()}
              noun="boletos"
              onPageChange={(p) => table.setPageIndex(p - 1)}
              onPageSizeChange={(t) => table.setPageSize(t)}
            />
          ) : null}
        </Sheet>
      </div>
    </>
  )
}
