import { useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { KeyText, Sheet, ActivityStamp } from '~/components/base'
import { PageHeader } from '~/components/shell'
import { ErrorState, EmptyState, ManifestSkeleton } from '~/components/states'
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
import { NO_DATA, STATION_TYPE_LABELS, plural } from '~/lib/format'
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
          <ManifestSkeleton columns={[7, 12, 22, 8, 13, 16, 12, 8]} />
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

/** Up to two values in the row; the rest collapses into "+N" and lives in the title. */
function Summary({ values, empty }: { values: Array<string>; empty: string }) {
  if (values.length === 0) {
    return (
      <span className="text-ink-4" title={empty}>
        {NO_DATA}
      </span>
    )
  }
  const visible = values.slice(0, 2)
  const rest = values.length - visible.length
  return (
    <span className="flex items-center gap-2" title={values.join('\n')}>
      {visible.map((v) => (
        <span
          key={v}
          className="border-l border-rule pl-2 font-mono text-data whitespace-nowrap text-ink-2 first:border-l-0 first:pl-0"
        >
          {v}
        </span>
      ))}
      {rest > 0 ? (
        <span
          data-numeric
          className="shrink-0 rounded-chip bg-row px-1 font-mono text-note text-ink-3"
        >
          +{rest}
        </span>
      ) : null}
    </span>
  )
}

/* ── Screen ───────────────────────────────────────────────────────────────── */

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

  if (!data.ok) {
    return (
      <>
        <PageHeader title="Terminales" />
        <ErrorState {...data.failure} />
      </>
    )
  }

  const { rows, total, page, options } = data

  function onSort(field: string) {
    const same = search.sort === field
    update({
      sort: oneOf(field, STATION_SORTS, 'number'),
      dir: same && search.dir === 'asc' ? 'desc' : 'asc',
    })
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
            <Manifest label="Catálogo de terminales">
              <TableHead>
                <SortableTh
                  field="number"
                  currentSort={search.sort}
                  direction={search.dir}
                  onSort={onSort}
                >
                  No. terminal
                </SortableTh>
                <SortableTh
                  field="shortName"
                  currentSort={search.sort}
                  direction={search.dir}
                  onSort={onSort}
                >
                  Nombre corto
                </SortableTh>
                <SortableTh
                  field="name"
                  currentSort={search.sort}
                  direction={search.dir}
                  onSort={onSort}
                >
                  Nombre completo
                </SortableTh>
                <Th>Tipo</Th>
                <SortableTh
                  field="state"
                  currentSort={search.sort}
                  direction={search.dir}
                  onSort={onSort}
                >
                  Estado
                </SortableTh>
                <Th>Servicios</Th>
                <Th>Empresas</Th>
                <Th>Estatus</Th>
              </TableHead>
              <TableBody>
                {rows.map((f) => (
                  <TableRow key={f.id} dimmed={f.isDeleted}>
                    <Td>
                      <RowLink to="/terminales/$id" params={{ id: f.id }}>
                        <KeyText emphasis>{f.number}</KeyText>
                      </RowLink>
                    </Td>
                    <Td>
                      <span className="font-mono text-data tracking-[0.04em] text-ink">
                        {f.shortName}
                      </span>
                    </Td>
                    <Td>
                      <span className="block max-w-[26rem] truncate text-ink-2" title={f.name}>
                        {f.name}
                      </span>
                    </Td>
                    <Td>
                      <span className="whitespace-nowrap text-ink-2">
                        {STATION_TYPE_LABELS[f.type] ?? f.type}
                      </span>
                    </Td>
                    <Td>
                      <span className="whitespace-nowrap text-ink-2">
                        {f.state ?? <span className="text-ink-4">{NO_DATA}</span>}
                      </span>
                    </Td>
                    <Td>
                      <Summary
                        values={f.services.map((s) => `${s.number} · ${s.shortName}`)}
                        empty="Sin servicios asociados"
                      />
                    </Td>
                    <Td>
                      <Summary
                        values={f.companies.map((e) => e.shortName)}
                        empty="Sin empresa deducible: la terminal no tiene servicios"
                      />
                    </Td>
                    <Td>
                      <ActivityStamp active={f.isActive} deleted={f.isDeleted} />
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Manifest>
          )}

          <Pagination
            page={page}
            perPage={search.perPage}
            total={total}
            noun="terminales"
            pageSizes={[...PAGE_SIZES]}
            onPageChange={(p) => update({ page: p }, false)}
            onPageSizeChange={(t) => update({ perPage: t })}
          />
        </Sheet>
      </div>
    </>
  )
}
