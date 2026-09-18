import { createFileRoute } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { KeyText, Stamp, ActivityStamp } from '~/components/base'
import { PageHeader } from '~/components/shell'
import { ErrorState, EmptyState, ManifestSkeleton } from '~/components/states'
import { FilterBar, SearchBox, ListFilter } from '~/components/filters'
import type { Option } from '~/components/filters'
import { TextLink } from '~/components/card'
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
import { NO_DATA, integer, plural } from '~/lib/format'
import {
  DIRECTIONS,
  bool,
  integerParam,
  stripDefaults,
  list,
  pageSize,
  text,
  oneOf,
} from '~/lib/params'
import {
  COMPANY_STATUSES,
  COMPANY_SORTS,
  COMPANY_SOURCES,
  listCompanies,
} from '~/server/companies'
import type {
  CompanyStatus,
  CompanySearch,
  CompanySource,
} from '~/server/companies'

/* ───────────────────────────────────────────────────────────────────────────
   The companies manifest. All of the view state —search, filters, sort and
   page— lives in the URL, so the exact screen can be pasted into a chat and
   the other person sees the same thing.
   ─────────────────────────────────────────────────────────────────────────── */

type Search = CompanySearch

const URL_DEFAULTS: Search = {
  q: '',
  page: 1,
  perPage: 25,
  sort: 'key',
  dir: 'asc',
  status: [],
  source: [],
  deleted: false,
}

/** Filters a list from the URL down to only the values the catalog accepts. */
function listOf<const T extends ReadonlyArray<string>>(
  value: unknown,
  valid: T,
): Array<T[number]> {
  return list(value).filter((v): v is T[number] =>
    (valid as ReadonlyArray<string>).includes(v),
  )
}

const STATUS_OPTIONS: Array<Option> = [
  { value: 'active', label: 'Activa' },
  { value: 'inactive', label: 'Inactiva' },
]

const SOURCE_OPTIONS: Array<Option> = [
  { value: 'hcm', label: 'Sincronizada por HCM' },
  { value: 'manual', label: 'Creada a mano' },
]

/** Restores the default values that do not travel in the URL. */
function withDefaults(s: Partial<Search>): Search {
  return { ...URL_DEFAULTS, ...s }
}

export const Route = createFileRoute('/empresas/')({
  // Only what the user changed travels in the URL: if `validateSearch` returned
  // the whole object, entering /empresas would leave the address bar with
  // `?q=&page=1&perPage=25&…` on top. `withDefaults` restores the default
  // values for the loader and for the view, which always get them complete.
  validateSearch: (input: Record<string, unknown>): Partial<Search> =>
    stripDefaults(
      {
        q: text(input.q),
        page: integerParam(input.page, 1, 1),
        perPage: pageSize(input.perPage),
        sort: oneOf(input.sort, COMPANY_SORTS, 'key'),
        dir: oneOf(input.dir, DIRECTIONS, 'asc'),
        status: listOf(input.status, COMPANY_STATUSES),
        source: listOf(input.source, COMPANY_SOURCES),
        deleted: bool(input.deleted),
      },
      URL_DEFAULTS,
    ),
  loaderDeps: ({ search }) => withDefaults(search),
  loader: ({ deps }) => listCompanies({ data: deps }),
  component: Screen,
  pendingComponent: () => <ManifestSkeleton columns={[9, 14, 22, 28, 8, 10]} />,
  errorComponent: ({ error, reset }) => (
    <ErrorState
      title="No fue posible leer el catálogo de empresas"
      detail={error instanceof Error ? error.message : String(error)}
      onRetry={reset}
    />
  ),
})

/* ── Checkbox ─────────────────────────────────────────────────────────────
   "Incluir bajas" is not a list of options but a yes/no, and a popover for
   a single checkbox would be one door too many. It is built from the same
   tokens as the ListFilter trigger so the bar reads even.                   */
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

function Screen() {
  const result = Route.useLoaderData()
  const search = withDefaults(Route.useSearch())
  const navigate = Route.useNavigate()

  function updateSearch(patch: Partial<Search>) {
    navigate({
      search: (prev) =>
        stripDefaults({ ...withDefaults(prev), ...patch }, URL_DEFAULTS),
      replace: true,
    })
  }

  function sortBy(field: string) {
    updateSearch({
      sort: field as Search['sort'],
      dir: search.sort === field && search.dir === 'asc' ? 'desc' : 'asc',
      page: 1,
    })
  }

  const hasFilters =
    search.q.trim().length > 0 ||
    search.status.length > 0 ||
    search.source.length > 0 ||
    search.deleted

  if (!result.ok) {
    return (
      <>
        <PageHeader title="Empresas" subtitle={NO_DATA} />
        <ErrorState {...result.failure} />
      </>
    )
  }

  const { rows, total, page } = result

  return (
    <>
      <PageHeader
        actions={<RefreshButton />}
        title="Empresas"
        subtitle={
          hasFilters
            ? `${plural(total, 'empresa', 'empresas')} con los filtros aplicados`
            : plural(total, 'empresa migrada', 'empresas migradas')
        }
      />

      <div className="px-4 sm:px-8 py-6">
        <div className="overflow-hidden rounded-sheet border border-rule bg-sheet">
          <FilterBar
            hasFilters={hasFilters}
            onClear={() =>
              updateSearch({ q: '', status: [], source: [], deleted: false, page: 1 })
            }
          >
            <SearchBox
              className="w-64"
              value={search.q}
              placeholder="Buscar clave, nombre o razón social"
              onChange={(q) => updateSearch({ q, page: 1 })}
            />
            <ListFilter
              label="Estatus"
              options={STATUS_OPTIONS}
              selection={search.status}
              onChange={(selection) =>
                updateSearch({
                  status: selection as Array<CompanyStatus>,
                  page: 1,
                })
              }
            />
            <ListFilter
              label="Origen"
              options={SOURCE_OPTIONS}
              selection={search.source}
              onChange={(selection) =>
                updateSearch({ source: selection as Array<CompanySource>, page: 1 })
              }
            />
            <Checkbox
              checked={search.deleted}
              title="Muestra también las empresas con borrado lógico (deletedAt)"
              onChange={(deleted) => updateSearch({ deleted, page: 1 })}
            >
              Incluir bajas
            </Checkbox>
          </FilterBar>

          {rows.length === 0 ? (
            hasFilters ? (
              <EmptyState
                title="Ninguna empresa coincide"
                detail="Ajusta la búsqueda o retira los filtros para ver el catálogo completo."
                action={
                  <button
                    type="button"
                    onClick={() =>
                      updateSearch({
                        q: '',
                        status: [],
                        source: [],
                        deleted: false,
                        page: 1,
                      })
                    }
                    className="inline-flex h-8 items-center rounded-chip border border-rule px-3 font-mono text-note font-medium tracking-[0.08em] text-ink-2 uppercase transition-[colors,transform] duration-100 hover:border-rule-strong hover:bg-row hover:text-ink active:scale-[0.97]"
                  >
                    Limpiar filtros
                  </button>
                }
              />
            ) : (
              <EmptyState
                title="El catálogo de empresas está vacío"
                detail="La base conectada no tiene ninguna empresa migrada. Confirma que DATABASE_URL apunta a la base correcta."
              />
            )
          ) : (
            <Manifest label="Empresas migradas">
              <TableHead>
                <SortableTh
                  field="key"
                  currentSort={search.sort}
                  direction={search.dir}
                  onSort={sortBy}
                >
                  Clave
                </SortableTh>
                <SortableTh
                  field="shortName"
                  currentSort={search.sort}
                  direction={search.dir}
                  onSort={sortBy}
                >
                  Nombre corto
                </SortableTh>
                <SortableTh
                  field="tradeName"
                  currentSort={search.sort}
                  direction={search.dir}
                  onSort={sortBy}
                >
                  Nombre comercial
                </SortableTh>
                <Th>Razón social</Th>
                <SortableTh
                  field="services"
                  numeric
                  currentSort={search.sort}
                  direction={search.dir}
                  onSort={sortBy}
                >
                  Servicios
                </SortableTh>
                <Th>Estatus</Th>
              </TableHead>

              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} dimmed={row.isDeleted}>
                    <Td>
                      <RowLink
                        to="/empresas/$id"
                        params={{ id: row.id }}
                        className="inline-block"
                      >
                        <KeyText emphasis>{row.key}</KeyText>
                      </RowLink>
                    </Td>
                    <Td className="text-ink-2">{row.shortName || NO_DATA}</Td>
                    <Td className="text-ink">
                      {/* The truncation goes on a span: with `table-layout: auto`
                          a max-width on the cell is only a suggestion. */}
                      <span className="block max-w-[20rem] truncate">
                        {row.tradeName || NO_DATA}
                      </span>
                    </Td>
                    <Td className="text-ink-3">
                      <span
                        className="block max-w-[22rem] truncate"
                        title={row.legalName}
                      >
                        {row.legalName || NO_DATA}
                      </span>
                    </Td>
                    <Td numeric>
                      {row.services === 0 ? (
                        // Zero is a value, not an absence: it is printed, dimmed
                        // and without a link. `—` would mean "unknown".
                        <span className="text-ink-4">{integer(0)}</span>
                      ) : (
                        // Above the link that covers the row: crossing into the
                        // services catalog is what the viewer is worth.
                        <TextLink
                          to="/servicios"
                          search={{ company: [row.id] }}
                          className="relative z-10 text-ink"
                        >
                          {integer(row.services)}
                        </TextLink>
                      )}
                    </Td>
                    <Td>
                      <span className="flex items-center gap-2">
                        <ActivityStamp
                          active={row.isActive}
                          deleted={row.isDeleted}
                        />
                        {row.hcmDisabled ? (
                          <Stamp
                            tone="warning"
                            title="HCM la reportó ausente o con estatus N. Es meramente informativo: no afecta el funcionamiento del sistema."
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

          {rows.length > 0 ? (
            <Pagination
              page={page}
              perPage={search.perPage}
              total={total}
              noun="empresas"
              onPageChange={(p) => updateSearch({ page: p })}
              onPageSizeChange={(t) => updateSearch({ perPage: t, page: 1 })}
            />
          ) : null}
        </div>
      </div>
    </>
  )
}
