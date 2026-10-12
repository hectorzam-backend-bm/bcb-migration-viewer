import { useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createColumnHelper, useTable } from '@tanstack/react-table'
import { KeyText, Field, Sheet } from '~/components/base'
import { PageHeader, Breadcrumb, Breadcrumbs, BreadcrumbSeparator } from '~/components/shell'
import { ErrorState, EmptyState, ManifestSkeleton } from '~/components/states'
import { Card, Tab, Tabs, Grid, TextLink } from '~/components/card'
import { FilterBar, SearchBox } from '~/components/filters'
import { RefreshButton } from '~/components/refresh'
import { Pagination, RowLink } from '~/components/table'
import { DataTable, features } from '~/components/data-table'
import { useUrlTableState } from '~/lib/table-state'
import {
  CAMPAIGN_TYPE_LABELS,
  DAY_OF_WEEK_LABELS,
  DISCOUNT_APPLIES_TO_LABELS,
  DISCOUNT_TYPE_LABELS,
  NO_DATA,
  PROMOTION_TRIP_TYPE_LABELS,
  dateTime,
  integer,
  plural,
} from '~/lib/format'
import { DIRECTIONS, PAGE_SIZES, integerParam, oneOf, pageSize, stripDefaults, text } from '~/lib/params'
import {
  CODE_SORTS,
  getCampaign,
  type CampaignDetail,
  type CodeSearch,
  type CouponCodeRow,
  type Validity,
} from '~/server/coupons'
import { CampaignStatusStamp, CouponStatusStamp, discountValue } from './columns'

/* ── Code columns ──────────────────────────────────────────────────────────
   Sortable ids equal CODE_SORTS: `code` and `uses`.                         */

const codeHelper = createColumnHelper<typeof features, CouponCodeRow>()

const codeColumns = codeHelper.columns([
  codeHelper.accessor('code', {
    header: 'Código',
    cell: ({ getValue }) => <KeyText emphasis>{getValue()}</KeyText>,
  }),
  codeHelper.accessor('currentUses', {
    id: 'uses',
    header: 'Veces usado',
    meta: { numeric: true },
    cell: ({ row, getValue }) => {
      const value = getValue()
      return value > row.original.maxUses ? (
        <span className="text-amber" title="Más usos que su límite máximo">
          {integer(value)}
        </span>
      ) : (
        <span className={value === 0 ? 'text-ink-4' : undefined}>{integer(value)}</span>
      )
    },
  }),
  codeHelper.accessor('maxUses', {
    header: 'Límite máximo de usos',
    enableSorting: false, // not in CODE_SORTS
    meta: { numeric: true },
    cell: ({ getValue }) => integer(getValue()),
  }),
  codeHelper.display({
    id: 'status',
    header: 'Estatus',
    cell: ({ row }) => <CouponStatusStamp status={row.original.status} />,
  }),
])

const routeHelper = createColumnHelper<typeof features, CampaignDetail['routes'][number]>()

const routeColumns = routeHelper.columns([
  routeHelper.accessor('number', {
    header: 'Número',
    meta: { numeric: true },
    cell: ({ row, getValue }) => (
      <RowLink to="/rutas/$id" params={{ id: row.original.id }}>
        <KeyText emphasis>{getValue() || NO_DATA}</KeyText>
      </RowLink>
    ),
  }),
  routeHelper.accessor('name', {
    header: 'Nombre',
    cell: ({ getValue }) => getValue() || NO_DATA,
  }),
])

/* ── Search ────────────────────────────────────────────────────────────── */

const TABS = ['codes', 'routes'] as const
type TabId = (typeof TABS)[number]
type CampaignDetailSearch = CodeSearch & { tab: TabId }

const DEFAULTS: CampaignDetailSearch = {
  tab: 'codes',
  q: '',
  page: 1,
  perPage: 25,
  sort: 'code',
  dir: 'asc',
}

function withDefaults(s: Partial<CampaignDetailSearch>): CampaignDetailSearch {
  return { ...DEFAULTS, ...s }
}

function prune(search: CampaignDetailSearch): Partial<CampaignDetailSearch> {
  return stripDefaults(search, DEFAULTS)
}

const NO_CODES: Array<CouponCodeRow> = []

export const Route = createFileRoute('/cupones/$id')({
  validateSearch: (input: Record<string, unknown>): Partial<CampaignDetailSearch> =>
    stripDefaults(
      {
        tab: oneOf(input.tab, TABS, 'codes'),
        q: text(input.q),
        page: integerParam(input.page, 1, 1),
        perPage: pageSize(input.perPage),
        sort: oneOf(input.sort, CODE_SORTS, 'code'),
        dir: oneOf(input.dir, DIRECTIONS, 'asc'),
      },
      DEFAULTS,
    ),
  // `tab` stays out of the deps: switching tabs must not refetch the campaign.
  loaderDeps: ({ search }) => {
    const { tab: _tab, ...codes } = withDefaults(search)
    return codes
  },
  loader: ({ params, deps }) => getCampaign({ data: { id: params.id, codes: deps } }),
  component: Screen,
  pendingComponent: () => (
    <>
      <PageHeader title="Cupones" subtitle="Leyendo la campaña…" />
      <div className="px-4 sm:px-8 py-6">
        <Sheet className="overflow-hidden py-2">
          <ManifestSkeleton columns={[18, 26, 30, 14]} rows={6} />
        </Sheet>
      </div>
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <>
      <PageHeader title="Cupones" subtitle={NO_DATA} />
      <ErrorState
        title="No fue posible leer la campaña de cupones"
        detail={error instanceof Error ? error.message : String(error)}
        onRetry={reset}
      />
    </>
  ),
})

function Screen() {
  const data = Route.useLoaderData()
  const search = withDefaults(Route.useSearch())
  const navigate = Route.useNavigate()

  /* A search or sort change returns the codes to their first page; whoever
     moves the pagination sends an explicit `page` and wins. */
  const updateSearch = useCallback(
    (patch: Partial<CampaignDetailSearch>) => {
      navigate({
        search: (prev) => prune({ ...withDefaults(prev), page: 1, ...patch }),
        replace: true,
      })
    },
    [navigate],
  )

  const onSearch = useCallback((q: string) => updateSearch({ q }), [updateSearch])

  const codes = data.ok ? data.codes.rows : NO_CODES
  const codesTotal = data.ok ? data.codes.total : 0

  // Hooks run unconditionally, before the `!data.ok` early return below.
  const { sorting, pagination, onSortingChange, onPaginationChange } = useUrlTableState({
    sort: search.sort,
    dir: search.dir,
    page: data.ok ? data.codes.page : 1,
    perPage: search.perPage,
    onChange: updateSearch,
  })

  const codesTable = useTable({
    features,
    columns: codeColumns,
    data: codes,
    getRowId: (row) => row.id,
    manualSorting: true,
    manualPagination: true,
    rowCount: codesTotal,
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
        <PageHeader
          title="Campaña de cupones"
          subtitle={NO_DATA}
          breadcrumbs={
            <Breadcrumbs>
              <Breadcrumb to="/cupones">Cupones</Breadcrumb>
            </Breadcrumbs>
          }
        />
        <ErrorState {...data.failure} />
      </>
    )
  }

  const c = data.campaign

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Breadcrumbs>
            <Breadcrumb to="/cupones">Cupones</Breadcrumb>
            <BreadcrumbSeparator />
            <span className="text-ink-2">No. {c.number}</span>
          </Breadcrumbs>
        }
        title={c.name}
        subtitle={
          <>
            {CAMPAIGN_TYPE_LABELS[c.campaignType] ?? c.campaignType}
            <span className="px-1.5 text-ink-4">·</span>
            {plural(c.codesTotal, 'cupón', 'cupones')}
            <span className="px-1.5 text-ink-4">·</span>
            {plural(c.uses, 'orden', 'órdenes')}
          </>
        }
        actions={
          <>
            <CampaignStatusStamp status={c.status} deleted={c.isDeleted} />
            <span aria-hidden className="h-4 w-px bg-rule" />
            <RefreshButton />
          </>
        }
      />

      <div className="space-y-5 px-4 sm:px-8 py-6">
        <div className="grid gap-5 lg:grid-cols-3">
          <Card title="Información general" className="lg:col-span-2">
            <Grid columns={2}>
              <Field label="Nombre del paquete" wide>
                {c.name}
              </Field>
              {c.description ? (
                <Field label="Descripción" wide>
                  {c.description}
                </Field>
              ) : null}
              <Field label="Empresas">
                <LinkList items={c.companies} to="/empresas/$id" />
              </Field>
              <Field label="Servicios">
                <LinkList items={c.services} to="/servicios/$id" />
              </Field>
              <Field label="Canal">{joinOrNone(c.salesChannels)}</Field>
              <Field label="Forma de pago">{joinOrNone(c.paymentMethods)}</Field>
              <Field label="Límite de usos del cupón" mono>
                {integer(c.maxUsesPerCode)}
              </Field>
              <Field label="Tipo de pasajero">
                {c.purchasePassengerType || c.deliveryPassengerType ? (
                  <>
                    {c.purchasePassengerType ?? NO_DATA}
                    <span className="px-1.5 text-ink-4">→</span>
                    {c.deliveryPassengerType ?? NO_DATA}
                  </>
                ) : (
                  NO_DATA
                )}
              </Field>
              <Field label="Prefijo de códigos" mono>
                {c.prefix ?? NO_DATA}
              </Field>
              <Field label="Cantidad a generar" mono>
                {c.quantityToGenerate === null ? NO_DATA : integer(c.quantityToGenerate)}
              </Field>
            </Grid>
          </Card>

          <Card title="Rastro">
            <div className="space-y-5">
              <Field label="Creado por">{c.createdBy}</Field>
              <Field label="Creado" mono>
                {dateTime(c.createdAt)}
              </Field>
              <Field label="Actualizado" mono>
                {dateTime(c.updatedAt)}
                {c.updatedBy ? <span className="text-ink-3"> · {c.updatedBy}</span> : null}
              </Field>
              <Field label="Dado de baja" mono>
                {c.deletedAt ? <span className="text-rust">{dateTime(c.deletedAt)}</span> : NO_DATA}
              </Field>
              <Field label="Identificador" mono>
                <span className="break-all text-ink-2">{c.id}</span>
              </Field>
            </div>
          </Card>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <Card title="Tipo de descuento">
            <div className="space-y-5">
              <Field label="Tipo de descuento">{DISCOUNT_TYPE_LABELS[c.discountType] ?? c.discountType}</Field>
              <Field label="Valor" mono>
                {discountValue(c.discountType, c.discountValue)}
              </Field>
              {c.ticketsPaid !== null ? (
                <Field label="Boletos pagados" mono>
                  {integer(c.ticketsPaid)}
                </Field>
              ) : null}
              {c.ticketLimit !== null ? (
                <Field label="Límite de boletos" mono>
                  {integer(c.ticketLimit)}
                </Field>
              ) : null}
              <Field label="Tipo de boleto">
                {joinOrNone(c.tripTypes.map((t) => PROMOTION_TRIP_TYPE_LABELS[t] ?? t))}
              </Field>
              <Field label="Aplica descuento a">
                {DISCOUNT_APPLIES_TO_LABELS[c.discountAppliesTo] ?? c.discountAppliesTo}
                {c.discountTicketQuantity !== null ? (
                  <span className="text-ink-3"> · {plural(c.discountTicketQuantity, 'boleto', 'boletos')}</span>
                ) : null}
              </Field>
            </div>
          </Card>

          <Card title="Validación por fecha de compra">
            {c.purchaseValidity ? (
              <ValidityFields validity={c.purchaseValidity} />
            ) : (
              <p className="text-body text-ink-3">Sin validación por fecha de compra.</p>
            )}
          </Card>

          <Card title="Validación por fecha de corrida">
            {c.oneWayTripValidity || c.roundTripValidity ? (
              <div className="space-y-7">
                {c.oneWayTripValidity ? (
                  <section>
                    <p className="mb-3 font-serif text-body font-medium text-ink">Sencillo</p>
                    <ValidityFields validity={c.oneWayTripValidity} />
                  </section>
                ) : null}
                {c.roundTripValidity ? (
                  <section>
                    <p className="mb-3 font-serif text-body font-medium text-ink">
                      Redondo
                      {c.roundTripValidity.sameDay ? (
                        <span className="font-sans font-normal text-ink-3"> · regreso el mismo día</span>
                      ) : null}
                    </p>
                    <ValidityFields validity={c.roundTripValidity} />
                  </section>
                ) : null}
              </div>
            ) : (
              <p className="text-body text-ink-3">Sin validación por fecha de corrida.</p>
            )}
          </Card>
        </div>

        <Sheet className="overflow-hidden">
          <Tabs
            value={search.tab}
            onChange={(value) => updateSearch({ tab: oneOf(value, TABS, 'codes') })}
            options={[
              { value: 'codes', label: 'Cupones generados', count: c.codesTotal },
              { value: 'routes', label: 'Rutas', count: c.routes.length },
            ]}
          >
            <Tab value="codes">
              <FilterBar hasFilters={search.q.trim().length > 0} onClear={() => updateSearch({ q: '' })}>
                <SearchBox
                  className="w-full max-w-[19rem]"
                  value={search.q}
                  onChange={onSearch}
                  placeholder="Buscar código…"
                />
                {c.codesOverLimit > 0 ? (
                  <span className="text-note text-amber">
                    {plural(c.codesOverLimit, 'cupón usado', 'cupones usados')} más veces que su límite
                  </span>
                ) : null}
              </FilterBar>

              {codes.length === 0 ? (
                c.codesTotal === 0 ? (
                  <EmptyState
                    title="Sin cupones generados"
                    detail="Esta campaña no tiene ningún código en la base."
                  />
                ) : (
                  <EmptyState
                    title="Ningún código coincide con la búsqueda"
                    detail="Ajusta la búsqueda para volver a ver todos los códigos de la campaña."
                  />
                )
              ) : (
                <DataTable table={codesTable} label="Cupones generados" />
              )}

              <Pagination
                page={codesTable.state.pagination.pageIndex + 1}
                perPage={codesTable.state.pagination.pageSize}
                total={codesTable.getRowCount()}
                pageSizes={[...PAGE_SIZES]}
                noun="cupones"
                onPageChange={(p) => codesTable.setPageIndex(p - 1)}
                onPageSizeChange={(t) => codesTable.setPageSize(t)}
              />
            </Tab>
            <Tab value="routes">
              <RoutesTable routes={c.routes} />
            </Tab>
          </Tabs>
        </Sheet>
      </div>
    </>
  )
}

/* ── Pieces ────────────────────────────────────────────────────────────── */

function joinOrNone(items: Array<string>): string {
  return items.length > 0 ? items.join(', ') : NO_DATA
}

function LinkList({
  items,
  to,
}: {
  items: Array<{ id: string; name: string }>
  to: '/empresas/$id' | '/servicios/$id'
}) {
  if (items.length === 0) return <>{NO_DATA}</>
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {items.map((item) => (
        <TextLink key={item.id} to={to} params={{ id: item.id }}>
          {item.name}
        </TextLink>
      ))}
    </span>
  )
}

/** `YYYY-MM-DD` → `DD/MM/YYYY`, as the admin app prints it. */
function dayMonthYear(value: string): string {
  return value.split('-').reverse().join('/')
}

function ValidityFields({ validity }: { validity: Validity }) {
  return (
    <div className="space-y-5">
      <Field label="Vigencia" mono>
        {dayMonthYear(validity.startDate)} – {dayMonthYear(validity.endDate)}
      </Field>
      <Field label="Horarios" mono>
        {validity.startTime} – {validity.endTime}
      </Field>
      <Field label="Días">
        {validity.allDays
          ? 'Todos los días'
          : joinOrNone(validity.activeDays.map((d) => DAY_OF_WEEK_LABELS[d] ?? d))}
      </Field>
    </div>
  )
}

function RoutesTable({ routes }: { routes: CampaignDetail['routes'] }) {
  const table = useTable({
    features,
    columns: routeColumns,
    data: routes,
    getRowId: (row) => row.id,
    enableSorting: false,
  })

  if (routes.length === 0) {
    return (
      <EmptyState
        title="Sin rutas asignadas"
        detail="Esta campaña no tiene ninguna ruta ligada en la base migrada."
      />
    )
  }

  return <DataTable table={table} label="Rutas de la campaña" />
}
