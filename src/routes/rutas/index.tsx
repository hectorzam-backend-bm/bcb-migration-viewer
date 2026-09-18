import { createFileRoute } from '@tanstack/react-router'
import { KeyText, Sheet, MainMark, ActivityStamp } from '~/components/base'
import { PageHeader } from '~/components/shell'
import { ErrorState, EmptyState, ManifestSkeleton } from '~/components/states'
import { Tab, Tabs, TextLink } from '~/components/card'
import type { Option } from '~/components/filters'
import { FilterBar, SearchBox, ListFilter } from '~/components/filters'
import { RefreshButton } from '~/components/refresh'
import {
  TableHead,
  TableBody,
  RowLink,
  TableRow,
  Manifest,
  Pagination,
  Td,
  Th,
  SortableTh,
} from '~/components/table'
import { cn } from '~/lib/cn'
import {
  NO_DATA,
  COLLECTION_TYPE_LABELS,
  integer,
  kilometers,
  minutes,
  currency,
} from '~/lib/format'
import {
  DIRECTIONS,
  PAGE_SIZES,
  bool,
  stripDefaults,
  list,
  integerParam,
  pageSize,
  text,
  oneOf,
} from '~/lib/params'
import type { RouteSearch, RouteRow, SegmentRow, View } from '~/server/routes'
import { listRoutes } from '~/server/routes'

const VIEWS = ['routes', 'segments'] as const

const SORTS = [
  'number',
  'name',
  'service',
  'company',
  'segments',
  'price',
  'travelTime',
  'distance',
  'status',
  'route',
  'origin',
  'destination',
  'stayTime',
  'duration',
  'priceRound',
  'sale',
  'main',
] as const

function defaultSort(view: View) {
  return view === 'segments' ? 'route' : 'number'
}

function defaultSearch(view: View): RouteSearch {
  return {
    view: 'routes',
    q: '',
    page: 1,
    perPage: PAGE_SIZES[0],
    sort: defaultSort(view),
    dir: 'asc',
    company: [],
    service: [],
    collection: [],
    iva: [],
    seats: [],
    status: [],
    route: [],
    main: [],
    sale: [],
    deleted: false,
  }
}

/** Refills the tab's default values that do not travel in the URL. */
function withDefaults(s: Partial<RouteSearch>): RouteSearch {
  const view = s.view ?? 'routes'
  return { ...defaultSearch(view), ...s, view }
}

export const Route = createFileRoute('/rutas/')({
  // Only what the user changed travels in the URL; `withDefaults` refills the rest.
  // The default values depend on the tab (each view sorts differently),
  // so the trim is done against `defaultSearch(view)` and not against a constant.
  validateSearch: (input: Record<string, unknown>): Partial<RouteSearch> => {
    const view = oneOf(input.view, VIEWS, 'routes')
    const full: RouteSearch = {
      view,
      q: text(input.q),
      page: integerParam(input.page, 1, 1),
      perPage: pageSize(input.perPage),
      sort: oneOf(input.sort, SORTS, defaultSort(view)),
      dir: oneOf(input.dir, DIRECTIONS, 'asc'),
      company: list(input.company),
      service: list(input.service),
      collection: list(input.collection),
      iva: list(input.iva),
      seats: list(input.seats),
      status: list(input.status),
      route: list(input.route),
      main: list(input.main),
      sale: list(input.sale),
      deleted: bool(input.deleted),
    }
    return stripDefaults(full, defaultSearch(view))
  },
  loaderDeps: ({ search }) => withDefaults(search),
  loader: ({ deps }) => listRoutes({ data: deps }),
  component: Screen,
  pendingComponent: () => (
    <>
      <PageHeader title="Rutas y tramos" subtitle="Cargando…" />
      <div className="px-4 sm:px-8 py-6">
        <Sheet className="py-2">
          <ManifestSkeleton columns={[6, 20, 10, 10, 18, 6, 10, 8]} />
        </Sheet>
      </div>
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <ErrorState
      title="No fue posible leer las rutas"
      detail={error instanceof Error ? error.message : String(error)}
      onRetry={reset}
    />
  ),
})

/* ── Controls ───────────────────────────────────────────────────────────── */

const YES_NO: Array<Option> = [
  { value: 'yes', label: 'Sí' },
  { value: 'no', label: 'No' },
]

const STATUS: Array<Option> = [
  { value: 'active', label: 'Activa' },
  { value: 'inactive', label: 'Inactiva' },
]

const COLLECTION: Array<Option> = Object.entries(COLLECTION_TYPE_LABELS).map(
  ([value, label]) => ({ value, label }),
)

/**
 * One-piece filter: not a data switch, a query modifier. It is drawn like the
 * other pills in the bar so the control area reads as a single family.
 */
function Toggle({
  name,
  on,
  onChange,
  title,
}: {
  name: string
  on: boolean
  onChange: (on: boolean) => void
  title?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={title}
      onClick={() => onChange(!on)}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-chip border px-3 text-body',
        'transition-[colors,transform] duration-100 active:scale-[0.98]',
        on
          ? 'border-stamp/40 bg-stamp-wash font-medium text-ink'
          : 'border-rule border-dashed bg-transparent text-ink-2 hover:border-rule-strong hover:border-solid hover:bg-row',
      )}
    >
      {name}
    </button>
  )
}

/** A pair of stations with the manifest arrow between them. */
function StationPair({
  origin,
  destination,
}: {
  origin: { id: string; key: string; name: string }
  destination: { id: string; key: string; name: string }
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap"
      title={`${origin.name} → ${destination.name}`}
    >
      <TextLink to="/terminales/$id" params={{ id: origin.id }} className="relative">
        <KeyText>{origin.key}</KeyText>
      </TextLink>
      <span aria-hidden className="text-ink-4">
        →
      </span>
      <TextLink to="/terminales/$id" params={{ id: destination.id }} className="relative">
        <KeyText>{destination.key}</KeyText>
      </TextLink>
    </span>
  )
}

function YesNo({ value }: { value: boolean }) {
  return (
    <span className={cn('font-mono text-data', value ? 'text-ink-2' : 'text-ink-4')}>
      {value ? 'Sí' : 'No'}
    </span>
  )
}

/* ── Screen ─────────────────────────────────────────────────────────────── */

function Screen() {
  const data = Route.useLoaderData()
  const search = withDefaults(Route.useSearch())
  const navigate = Route.useNavigate()
  const { view } = search

  function goTo(patch: Partial<RouteSearch>) {
    navigate({
      search: (prev) => {
        const next = { ...withDefaults(prev), ...patch }
        return stripDefaults(next, defaultSearch(next.view))
      },
      replace: true,
    })
  }

  function sortBy(field: string) {
    goTo({
      sort: field,
      dir: search.sort === field && search.dir === 'asc' ? 'desc' : 'asc',
      page: 1,
    })
  }

  function changeView(value: string) {
    const next = oneOf(value, VIEWS, 'routes')
    if (next === view) return
    goTo({
      view: next,
      page: 1,
      sort: defaultSort(next),
      dir: 'asc',
      // The other tab's own filters do not apply here.
      ...(next === 'routes'
        ? { route: [], main: [], sale: [] }
        : { collection: [], iva: [], seats: [] }),
    })
  }

  if (!data.ok) {
    return (
      <>
        <PageHeader title="Rutas y tramos" subtitle={NO_DATA} />
        <ErrorState {...data.failure} />
      </>
    )
  }

  const { counts, options, total } = data
  const noun = view === 'routes' ? 'rutas' : 'tramos'
  const inCatalog = view === 'routes' ? counts.routes : counts.segments

  const hasFilters =
    search.q.trim().length > 0 ||
    search.company.length > 0 ||
    search.service.length > 0 ||
    search.status.length > 0 ||
    search.deleted ||
    (view === 'routes'
      ? search.collection.length > 0 ||
        search.iva.length > 0 ||
        search.seats.length > 0
      : search.route.length > 0 ||
        search.main.length > 0 ||
        search.sale.length > 0)

  function clear() {
    goTo({
      q: '',
      page: 1,
      company: [],
      service: [],
      collection: [],
      iva: [],
      seats: [],
      status: [],
      route: [],
      main: [],
      sale: [],
      deleted: false,
    })
  }

  const empty =
    total === 0 ? (
      hasFilters ? (
        <EmptyState
          title={`Ningún registro coincide`}
          detail={`No hay ${noun} que cumplan con la búsqueda y los filtros de esta hoja.`}
          action={
            <button
              type="button"
              onClick={clear}
              className="inline-flex h-8 items-center rounded-chip border border-rule px-3 font-mono text-note font-medium tracking-[0.08em] text-ink-2 uppercase transition-[colors,transform] duration-100 hover:border-rule-strong hover:bg-row hover:text-ink active:scale-[0.97]"
            >
              Limpiar filtros
            </button>
          }
        />
      ) : (
        <EmptyState
          title={
            view === 'routes'
              ? 'El catálogo de rutas está vacío'
              : 'No hay tramos registrados'
          }
          detail={
            view === 'routes'
              ? 'La base conectada no tiene ninguna ruta migrada todavía.'
              : 'Ninguna ruta de la base conectada tiene tramos migrados todavía.'
          }
        />
      )
    ) : null

  return (
    <>
      <PageHeader
        actions={<RefreshButton />}
        title="Rutas y tramos"
        subtitle={
          hasFilters
            ? `${integer(total)} de ${integer(inCatalog)} ${noun}`
            : `${integer(inCatalog)} ${noun} en el catálogo`
        }
      />

      <div className="px-4 sm:px-8 py-6">
        <Sheet className="overflow-hidden">
          <Tabs
            value={view}
            onChange={changeView}
            options={[
              { value: 'routes', label: 'Rutas', count: counts.routes },
              { value: 'segments', label: 'Tramos', count: counts.segments },
            ]}
          >
            <Tab value={view}>
              <FilterBar hasFilters={hasFilters} onClear={clear}>
                <SearchBox
                  className="w-full max-w-72"
                  value={search.q}
                  placeholder={
                    view === 'routes'
                      ? 'Buscar por número o nombre de ruta…'
                      : 'Buscar por número de tramo o terminal…'
                  }
                  onChange={(q) => goTo({ q, page: 1 })}
                />

                <ListFilter
                  label="Empresa"
                  options={options.companies}
                  selection={search.company}
                  onChange={(company) => goTo({ company, page: 1 })}
                />
                <ListFilter
                  label="Servicio"
                  options={options.services}
                  selection={search.service}
                  onChange={(service) => goTo({ service, page: 1 })}
                />

                {view === 'routes' ? (
                  <>
                    <ListFilter
                      label="Recaudación"
                      options={COLLECTION}
                      selection={search.collection}
                      onChange={(collection) => goTo({ collection, page: 1 })}
                    />
                    <ListFilter
                      label="Aplica IVA"
                      options={YES_NO}
                      selection={search.iva}
                      onChange={(iva) => goTo({ iva, page: 1 })}
                    />
                    <ListFilter
                      label="Selección de asientos"
                      options={YES_NO}
                      selection={search.seats}
                      onChange={(seats) => goTo({ seats, page: 1 })}
                    />
                  </>
                ) : (
                  <>
                    <ListFilter
                      label="Ruta"
                      options={options.routes}
                      selection={search.route}
                      onChange={(route) => goTo({ route, page: 1 })}
                      searchable
                    />
                    <ListFilter
                      label="Principal"
                      options={YES_NO}
                      selection={search.main}
                      onChange={(main) => goTo({ main, page: 1 })}
                    />
                    <ListFilter
                      label="Permitir venta"
                      options={YES_NO}
                      selection={search.sale}
                      onChange={(sale) => goTo({ sale, page: 1 })}
                    />
                  </>
                )}

                <ListFilter
                  label="Estatus"
                  options={STATUS}
                  selection={search.status}
                  onChange={(status) => goTo({ status, page: 1 })}
                />
                <Toggle
                  name="Incluir bajas"
                  on={search.deleted}
                  title="Muestra también los registros con borrado lógico (deletedAt)"
                  onChange={(deleted) => goTo({ deleted, page: 1 })}
                />
              </FilterBar>

              {empty ??
                (data.view === 'routes' ? (
                  <RoutesTable
                    rows={data.rows}
                    sort={search.sort}
                    dir={search.dir}
                    onSort={sortBy}
                  />
                ) : (
                  <SegmentsTable
                    rows={data.rows}
                    sort={search.sort}
                    dir={search.dir}
                    onSort={sortBy}
                  />
                ))}

              <Pagination
                page={search.page}
                perPage={search.perPage}
                total={total}
                noun={noun}
                pageSizes={[...PAGE_SIZES]}
                onPageChange={(page) => goTo({ page })}
                onPageSizeChange={(perPage) => goTo({ perPage, page: 1 })}
              />
            </Tab>
          </Tabs>
        </Sheet>
      </div>
    </>
  )
}

/* ── Routes manifest ────────────────────────────────────────────────────── */

type SortProps = {
  sort: string
  dir: 'asc' | 'desc'
  onSort: (field: string) => void
}

function RoutesTable({ rows, sort, dir, onSort }: SortProps & { rows: Array<RouteRow> }) {
  const common = { currentSort: sort, direction: dir, onSort }
  return (
    <Manifest label="Rutas">
      <TableHead>
        <SortableTh field="number" {...common}>
          No.
        </SortableTh>
        <SortableTh field="name" {...common}>
          Nombre
        </SortableTh>
        <SortableTh field="service" {...common}>
          Servicio
        </SortableTh>
        <SortableTh field="company" {...common}>
          Empresa
        </SortableTh>
        <Th>Origen → Destino</Th>
        <SortableTh field="segments" numeric {...common}>
          Tramos
        </SortableTh>
        <SortableTh field="price" numeric {...common}>
          Tarifa sencilla
        </SortableTh>
        <SortableTh field="travelTime" numeric {...common}>
          Tiempo
        </SortableTh>
        <SortableTh field="distance" numeric {...common}>
          Distancia
        </SortableTh>
        <SortableTh field="status" {...common}>
          Estatus
        </SortableTh>
      </TableHead>
      <TableBody>
        {rows.map((f) => (
          <TableRow key={f.id} dimmed={f.isDeleted}>
            <Td>
              <RowLink to="/rutas/$id" params={{ id: f.id }}>
                <KeyText emphasis>{f.number}</KeyText>
              </RowLink>
            </Td>
            <Td className="max-w-[24rem] truncate text-ink">{f.name}</Td>
            <Td>
              <TextLink
                to="/servicios/$id"
                params={{ id: f.service.id }}
                className="relative text-body text-ink-2"
              >
                {f.service.label}
              </TextLink>
            </Td>
            <Td>
              <TextLink
                to="/empresas/$id"
                params={{ id: f.company.id }}
                className="relative text-body text-ink-2"
              >
                {f.company.label}
              </TextLink>
            </Td>
            <Td>
              <StationPair origin={f.origin} destination={f.destination} />
            </Td>
            <Td numeric className={f.segments === 0 ? 'text-amber' : undefined}>
              {integer(f.segments)}
            </Td>
            <Td numeric>{currency(f.priceOneWay)}</Td>
            <Td numeric className="text-ink-2">
              {minutes(f.travelTimeMinutes)}
            </Td>
            <Td numeric className="text-ink-2">
              {kilometers(f.distanceKm)}
            </Td>
            <Td>
              <ActivityStamp active={f.isActive} deleted={f.isDeleted} />
            </Td>
          </TableRow>
        ))}
      </TableBody>
    </Manifest>
  )
}

/* ── Flat segments manifest ─────────────────────────────────────────────── */

function SegmentsTable({ rows, sort, dir, onSort }: SortProps & { rows: Array<SegmentRow> }) {
  const common = { currentSort: sort, direction: dir, onSort }
  return (
    <Manifest label="Tramos">
      <TableHead>
        <SortableTh field="number" {...common}>
          No.
        </SortableTh>
        <SortableTh field="route" {...common}>
          Ruta
        </SortableTh>
        <Th>Origen → Destino</Th>
        <SortableTh field="stayTime" numeric {...common}>
          Estancia
        </SortableTh>
        <SortableTh field="duration" numeric {...common}>
          Duración
        </SortableTh>
        <SortableTh field="distance" numeric {...common}>
          Distancia
        </SortableTh>
        <SortableTh field="sale" {...common}>
          Venta
        </SortableTh>
        <SortableTh field="price" numeric {...common}>
          Tarifa sencilla
        </SortableTh>
        <SortableTh field="priceRound" numeric {...common}>
          Tarifa redonda
        </SortableTh>
        <SortableTh field="main" {...common}>
          Principal
        </SortableTh>
        <SortableTh field="status" {...common}>
          Estatus
        </SortableTh>
      </TableHead>
      <TableBody>
        {rows.map((f) => (
          <TableRow key={f.id} highlighted={f.isMain} dimmed={f.isDeleted || !f.isActive}>
            <Td>
              <KeyText emphasis>{f.number}</KeyText>
            </Td>
            <Td className="max-w-[22rem]">
              <RowLink to="/rutas/$id" params={{ id: f.route.id }}>
                <span className="inline-flex items-baseline gap-2">
                  <KeyText emphasis>{f.route.number}</KeyText>
                  <span className="truncate text-body text-ink-2">{f.route.name}</span>
                </span>
              </RowLink>
            </Td>
            <Td>
              <StationPair origin={f.origin} destination={f.destination} />
            </Td>
            <Td numeric className="text-ink-2">
              {minutes(f.stayTimeMinutes)}
            </Td>
            <Td numeric className="text-ink-2">
              {minutes(f.durationMinutes)}
            </Td>
            <Td numeric className="text-ink-2">
              {kilometers(f.distanceKm)}
            </Td>
            <Td>
              <YesNo value={f.allowSale} />
            </Td>
            <Td numeric>{currency(f.priceOneWay)}</Td>
            <Td numeric className="text-ink-2">
              {currency(f.priceRound)}
            </Td>
            <Td>{f.isMain ? <MainMark /> : <span className="text-ink-4">{NO_DATA}</span>}</Td>
            <Td>
              <ActivityStamp active={f.isActive} deleted={f.isDeleted} />
            </Td>
          </TableRow>
        ))}
      </TableBody>
    </Manifest>
  )
}
