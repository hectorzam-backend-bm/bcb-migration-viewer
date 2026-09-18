import { useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { KeyText, Sheet, Stamp, ActivityStamp } from '~/components/base'
import { PageHeader } from '~/components/shell'
import { ErrorState, EmptyState, ManifestSkeleton } from '~/components/states'
import { TextLink } from '~/components/card'
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
import { NO_DATA, integer } from '~/lib/format'
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
} from '~/lib/params'
import { SERVICE_SORTS, listServices, type ServiceSearch } from '~/server/services'

/* Skeleton widths: the same split as the manifest's eight columns. */
const LOADING_COLUMNS = [9, 7, 24, 16, 15, 8, 7, 11]

const DEFAULTS: ServiceSearch = {
  q: '',
  page: 1,
  perPage: 25,
  sort: 'key',
  dir: 'asc',
  company: [],
  status: [],
  earlyDispatch: [],
  deleted: false,
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
]

const EARLY_DISPATCH_OPTIONS = [
  { value: 'yes', label: 'Permitido' },
  { value: 'no', label: 'No permitido' },
]

const DELETED_OPTIONS = [{ value: 'include', label: 'Incluir servicios dados de baja' }]

/** Restores the default values that do not travel in the URL. */
function withDefaults(s: Partial<ServiceSearch>): ServiceSearch {
  return { ...DEFAULTS, ...s }
}

export const Route = createFileRoute('/servicios/')({
  // Only what the user changed travels in the URL; `withDefaults` restores the rest.
  validateSearch: (input: Record<string, unknown>): Partial<ServiceSearch> =>
    stripDefaults(
      {
        q: text(input.q),
        page: integerParam(input.page, 1, 1),
        perPage: pageSize(input.perPage),
        sort: oneOf(input.sort, SERVICE_SORTS, 'key'),
        dir: oneOf(input.dir, DIRECTIONS, 'asc'),
        company: list(input.company),
        status: list(input.status),
        earlyDispatch: list(input.earlyDispatch),
        deleted: bool(input.deleted),
      },
      DEFAULTS,
    ),
  loaderDeps: ({ search }) => withDefaults(search),
  loader: ({ deps }) => listServices({ data: deps }),
  component: Screen,
  pendingComponent: () => (
    <>
      <PageHeader title="Servicios" subtitle="Leyendo el catálogo…" />
      <div className="px-4 sm:px-8 py-6">
        <Sheet className="overflow-hidden py-2">
          <ManifestSkeleton columns={LOADING_COLUMNS} />
        </Sheet>
      </div>
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <>
      <PageHeader title="Servicios" subtitle={NO_DATA} />
      <ErrorState
        title="No fue posible leer el catálogo de servicios"
        detail={error instanceof Error ? error.message : String(error)}
        onRetry={reset}
      />
    </>
  ),
})

/** `stripDefaults` returns only what the user changed; `validateSearch`
 *  restores the defaults when reading the URL, so the trim is safe. */
function prune(search: ServiceSearch): Partial<ServiceSearch> {
  return stripDefaults(search, DEFAULTS)
}

function Screen() {
  const data = Route.useLoaderData()
  const search = withDefaults(Route.useSearch())
  const navigate = Route.useNavigate()

  /* Every filter or search change returns the manifest to the first page;
     whoever moves the pagination sends an explicit `page` and wins. */
  const updateSearch = useCallback(
    (patch: Partial<ServiceSearch>) => {
      navigate({
        search: (prev) => prune({ ...withDefaults(prev), page: 1, ...patch }),
        replace: true,
      })
    },
    [navigate],
  )

  const onSearch = useCallback((q: string) => updateSearch({ q }), [updateSearch])

  if (!data.ok) {
    return (
      <>
        <PageHeader title="Servicios" subtitle={NO_DATA} />
        <ErrorState {...data.failure} />
      </>
    )
  }

  const { rows, total, catalogTotal, page, companies } = data

  const hasFilters =
    search.q.trim().length > 0 ||
    search.company.length > 0 ||
    search.status.length > 0 ||
    search.earlyDispatch.length > 0 ||
    search.deleted

  const subtitle =
    total === catalogTotal
      ? `${integer(total)} servicios`
      : `${integer(total)} de ${integer(catalogTotal)} servicios`

  function onSort(field: string) {
    updateSearch({
      sort: field as ServiceSearch['sort'],
      dir: search.sort === field && search.dir === 'asc' ? 'desc' : 'asc',
    })
  }

  return (
    <>
      <PageHeader
        actions={<RefreshButton />}
        title="Servicios"
        subtitle={
          <>
            {subtitle}
            {search.deleted ? <span className="text-ink-4"> · con bajas</span> : null}
          </>
        }
      />

      <div className="px-4 sm:px-8 py-6">
        <Sheet className="overflow-hidden">
          <FilterBar
            hasFilters={hasFilters}
            onClear={() =>
              navigate({
                search: () => prune({ ...DEFAULTS, perPage: search.perPage }),
                replace: true,
              })
            }
          >
            <SearchBox
              className="w-full max-w-[19rem]"
              value={search.q}
              onChange={onSearch}
              placeholder="Buscar clave, número o nombre…"
            />
            <ListFilter
              label="Empresa"
              searchable
              options={companies}
              selection={search.company}
              onChange={(company) => updateSearch({ company })}
            />
            <ListFilter
              label="Estatus"
              options={STATUS_OPTIONS}
              selection={search.status}
              onChange={(status) => updateSearch({ status })}
            />
            <ListFilter
              label="Despacho anticipado"
              options={EARLY_DISPATCH_OPTIONS}
              selection={search.earlyDispatch}
              onChange={(earlyDispatch) => updateSearch({ earlyDispatch })}
            />
            <ListFilter
              label="Bajas"
              options={DELETED_OPTIONS}
              selection={search.deleted ? ['include'] : []}
              onChange={(selection) => updateSearch({ deleted: selection.includes('include') })}
            />
          </FilterBar>

          {rows.length === 0 ? (
            catalogTotal === 0 && !hasFilters ? (
              <EmptyState
                title="El catálogo de servicios está vacío"
                detail="La base conectada no tiene servicios migrados. Confirma que DATABASE_URL apunta a la base correcta."
              />
            ) : (
              <EmptyState
                title="Ningún servicio coincide con los filtros"
                detail="Ajusta la búsqueda o retira algún filtro para volver a ver el catálogo completo."
                action={
                  hasFilters ? (
                    <button
                      type="button"
                      onClick={() =>
                        navigate({
                          search: () => prune({ ...DEFAULTS, perPage: search.perPage }),
                          replace: true,
                        })
                      }
                      className="inline-flex h-8 items-center rounded-chip border border-rule px-3 font-mono text-note font-medium tracking-[0.08em] text-ink-2 uppercase transition-[colors,transform] duration-100 hover:border-rule-strong hover:bg-row hover:text-ink active:scale-[0.97]"
                    >
                      Limpiar filtros
                    </button>
                  ) : null
                }
              />
            )
          ) : (
            <Manifest label="Servicios migrados">
              <TableHead>
                <SortableTh
                  field="key"
                  currentSort={search.sort}
                  direction={search.dir}
                  onSort={onSort}
                >
                  Clave servicio
                </SortableTh>
                <SortableTh
                  field="number"
                  numeric
                  currentSort={search.sort}
                  direction={search.dir}
                  onSort={onSort}
                >
                  No. servicio
                </SortableTh>
                <SortableTh
                  field="name"
                  currentSort={search.sort}
                  direction={search.dir}
                  onSort={onSort}
                >
                  Nombre del servicio
                </SortableTh>
                <Th>Nombre corto</Th>
                <SortableTh
                  field="company"
                  currentSort={search.sort}
                  direction={search.dir}
                  onSort={onSort}
                >
                  Empresa
                </SortableTh>
                <Th numeric>Terminales</Th>
                <SortableTh
                  field="routes"
                  numeric
                  currentSort={search.sort}
                  direction={search.dir}
                  onSort={onSort}
                >
                  Rutas
                </SortableTh>
                <Th>Estatus</Th>
              </TableHead>

              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.id} dimmed={s.isDeleted}>
                    <Td>
                      <RowLink to="/servicios/$id" params={{ id: s.id }}>
                        <KeyText emphasis>{s.key || NO_DATA}</KeyText>
                      </RowLink>
                    </Td>
                    <Td numeric className="text-ink-2">
                      {s.number || NO_DATA}
                    </Td>
                    <Td>
                      <span className="block max-w-[26rem] truncate" title={s.name}>
                        {s.name || NO_DATA}
                      </span>
                    </Td>
                    <Td className="text-ink-2">{s.shortName || NO_DATA}</Td>
                    <Td>
                      <TextLink
                        to="/empresas/$id"
                        params={{ id: s.companyId }}
                        className="relative z-10"
                      >
                        {s.companyName || s.companyKey || NO_DATA}
                      </TextLink>
                    </Td>
                    <Td numeric>
                      <span className={s.stations === 0 ? 'text-ink-4' : undefined}>
                        {integer(s.stations)}
                      </span>
                    </Td>
                    <Td numeric>
                      <span className={s.routes === 0 ? 'text-ink-4' : undefined}>
                        {integer(s.routes)}
                      </span>
                    </Td>
                    <Td>
                      <span className="flex items-center gap-2">
                        <ActivityStamp active={s.isActive} deleted={s.isDeleted} />
                        {s.hcmDisabled ? (
                          <Stamp
                            tone="warning"
                            title="hcmDisabled — la sincronización HCM lo marcó como inhabilitado"
                          >
                            HCM
                          </Stamp>
                        ) : null}
                      </span>
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
            pageSizes={[...PAGE_SIZES]}
            noun="servicios"
            onPageChange={(p) => updateSearch({ page: p })}
            onPageSizeChange={(t) => updateSearch({ perPage: t })}
          />
        </Sheet>
      </div>
    </>
  )
}
