import { useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createColumnHelper, useTable } from '@tanstack/react-table'
import { KeyText, Field, Sheet, MainMark, Label, ActivityStamp } from '~/components/base'
import { PageHeader, Breadcrumb, Breadcrumbs, BreadcrumbSeparator } from '~/components/shell'
import { ErrorState, EmptyState, ManifestSkeleton } from '~/components/states'
import { Card, Tab, Tabs, Grid, ExternalTextLink } from '~/components/card'
import { RefreshButton } from '~/components/refresh'
import { RowLink } from '~/components/table'
import { DataTable, features, type Columns } from '~/components/data-table'
import {
  NO_DATA,
  STATION_TYPE_LABELS,
  coordinate,
  integer,
  date,
  dateTime,
  kilometers,
  minutes,
  currency,
} from '~/lib/format'
import { stripDefaults, oneOf } from '~/lib/params'
import {
  getStation,
  type StationFile,
  type StationRoute,
  type StationService,
  type StationSegment,
  type StationBrief,
} from '~/server/stations'

const TABS = ['services', 'departures', 'arrivals', 'segments'] as const
type StationTab = (typeof TABS)[number]

/** Optional on purpose: the default tab is not written to the URL. */
type StationDetailSearch = { tab?: StationTab }

export const Route = createFileRoute('/terminales/$id')({
  validateSearch: (input: Record<string, unknown>): StationDetailSearch =>
    stripDefaults(
      { tab: oneOf(input.tab, TABS, 'services') },
      { tab: 'services' },
    ),
  loader: ({ params }) => getStation({ data: { id: params.id } }),
  component: Screen,
  pendingComponent: () => (
    <>
      <PageHeader title="Terminal" subtitle="Leyendo la ficha…" />
      <div className="px-4 sm:px-8 py-6">
        <Sheet className="overflow-hidden py-2">
          <ManifestSkeleton columns={[12, 26, 20, 14, 10]} rows={6} />
        </Sheet>
      </div>
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <>
      <PageHeader title="Terminal" />
      <ErrorState
        title="No fue posible leer la ficha de la terminal"
        detail={error instanceof Error ? error.message : String(error)}
        onRetry={reset}
      />
    </>
  ),
})

/* ── Local pieces ─────────────────────────────────────────────────────────── */

/** Bytes to KB/MB: a file's size reads better rounded. */
function fileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return NO_DATA
  if (bytes < 1024) return `${integer(bytes)} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`
}

function Photo({ label, file }: { label: string; file: StationFile }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 min-w-0">
        <ExternalTextLink href={file.url}>{file.name}</ExternalTextLink>
      </div>
      <p data-numeric className="mt-1 font-mono text-note text-ink-3">
        {file.type} <span className="text-ink-4">·</span> {fileSize(file.bytes)}
      </p>
    </div>
  )
}

/** Origin → destination pair; the station of this card is in full ink. */
function StationPair({
  origin,
  destination,
  currentId,
}: {
  origin: { id: string; number: string; shortName: string }
  destination: { id: string; number: string; shortName: string }
  currentId: string
}) {
  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <span
        className={endpointClass(origin.id === currentId)}
        title={`Terminal ${origin.number}`}
      >
        {origin.shortName}
      </span>
      <span aria-hidden className="text-ink-4">
        →
      </span>
      <span
        className={endpointClass(destination.id === currentId)}
        title={`Terminal ${destination.number}`}
      >
        {destination.shortName}
      </span>
    </span>
  )
}

function endpointClass(isCurrent: boolean) {
  return isCurrent
    ? 'font-mono text-data font-medium text-ink'
    : 'font-mono text-data text-ink-3'
}

/* ── Tab columns ───────────────────────────────────────────────────────────
   None of these four tables sort, filter or paginate; `enableSorting: false`
   on each `useTable` call keeps the shared `features`' sort affordance off. */

const serviceHelper = createColumnHelper<typeof features, StationService>()

const stationServiceColumns = serviceHelper.columns([
  serviceHelper.accessor('number', {
    header: 'No. servicio',
    cell: ({ row, getValue }) => (
      <RowLink to="/servicios/$id" params={{ id: row.original.id }}>
        <KeyText emphasis>{getValue()}</KeyText>
      </RowLink>
    ),
  }),
  serviceHelper.accessor('key', {
    header: 'Clave',
    cell: ({ getValue }) => <KeyText>{getValue()}</KeyText>,
  }),
  serviceHelper.accessor('shortName', {
    header: 'Nombre corto',
    cell: ({ getValue }) => (
      <span className="font-mono text-data whitespace-nowrap text-ink">{getValue()}</span>
    ),
  }),
  serviceHelper.accessor('fullName', {
    header: 'Nombre completo',
    cell: ({ getValue }) => (
      <span className="block max-w-[24rem] truncate text-ink-2" title={getValue()}>
        {getValue()}
      </span>
    ),
  }),
  serviceHelper.display({
    id: 'company',
    header: 'Empresa',
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-ink-2">
        <span className="font-mono text-data text-ink-3">{row.original.company.key}</span>{' '}
        {row.original.company.shortName}
      </span>
    ),
  }),
  serviceHelper.display({
    id: 'status',
    header: 'Estatus',
    cell: ({ row }) => (
      <ActivityStamp active={row.original.isActive} deleted={row.original.isDeleted} />
    ),
  }),
])

const routeHelper = createColumnHelper<typeof features, StationRoute>()

/** `departures` and `arrivals` are the same table shape read from opposite
 *  ends: the endpoint column shows whichever station isn't this one. */
function makeRouteColumns(endpointColumn: string, endpoint: (r: StationRoute) => StationBrief) {
  return routeHelper.columns([
    routeHelper.accessor('number', {
      header: 'No. ruta',
      cell: ({ row, getValue }) => (
        <RowLink to="/rutas/$id" params={{ id: row.original.id }}>
          <KeyText emphasis>{getValue()}</KeyText>
        </RowLink>
      ),
    }),
    routeHelper.accessor('name', {
      header: 'Nombre',
      cell: ({ getValue }) => (
        <span className="block max-w-[24rem] truncate text-ink-2" title={getValue()}>
          {getValue()}
        </span>
      ),
    }),
    routeHelper.display({
      id: 'endpoint',
      header: endpointColumn,
      cell: ({ row }) => {
        const other = endpoint(row.original)
        return (
          <span className="font-mono text-data whitespace-nowrap text-ink-2">
            {other.number} <span className="text-ink-4">·</span> {other.shortName}
          </span>
        )
      },
    }),
    routeHelper.display({
      id: 'service',
      header: 'Servicio',
      cell: ({ row }) => (
        <span className="font-mono text-data whitespace-nowrap text-ink-2">
          {row.original.service.number} <span className="text-ink-4">·</span>{' '}
          {row.original.service.shortName}
        </span>
      ),
    }),
    routeHelper.accessor('travelTimeMinutes', {
      header: 'Tiempo',
      meta: { numeric: true },
      cell: ({ getValue }) => minutes(getValue()),
    }),
    routeHelper.accessor('distanceKm', {
      header: 'Distancia',
      meta: { numeric: true },
      cell: ({ getValue }) => kilometers(getValue()),
    }),
    routeHelper.accessor('priceOneWay', {
      header: 'Tarifa sencilla',
      meta: { numeric: true },
      cell: ({ getValue }) => currency(getValue()),
    }),
    routeHelper.display({
      id: 'status',
      header: 'Estatus',
      cell: ({ row }) => (
        <ActivityStamp active={row.original.isActive} deleted={row.original.isDeleted} />
      ),
    }),
  ])
}

const departureColumns = makeRouteColumns('Destino', (r) => r.destination)
const arrivalColumns = makeRouteColumns('Origen', (r) => r.origin)

function RouteTable({
  routes,
  columns,
  label,
  empty,
}: {
  routes: Array<StationRoute>
  columns: Columns<StationRoute>
  label: string
  empty: string
}) {
  const table = useTable({
    features,
    columns,
    data: routes,
    getRowId: (row) => row.id,
    enableSorting: false,
  })

  if (routes.length === 0) {
    return <EmptyState title={empty} />
  }
  return (
    <DataTable table={table} label={label} rowProps={(row) => ({ dimmed: row.original.isDeleted })} />
  )
}

const segmentHelper = createColumnHelper<typeof features, StationSegment>()

/** The segment ledger needs to know which station this page is about, so the
 *  origin/destination pair can put the current station in full ink. */
function makeSegmentColumns(currentId: string) {
  return segmentHelper.columns([
    segmentHelper.accessor('number', {
      header: 'No. tramo',
      cell: ({ row, getValue }) => (
        <span className="flex items-center gap-2">
          <KeyText emphasis>{getValue()}</KeyText>
          {row.original.isMain ? <MainMark /> : null}
        </span>
      ),
    }),
    segmentHelper.display({
      id: 'route',
      header: 'Ruta',
      cell: ({ row }) => (
        <RowLink to="/rutas/$id" params={{ id: row.original.route.id }}>
          <span className="flex items-baseline gap-2 whitespace-nowrap">
            <KeyText emphasis>{row.original.route.number}</KeyText>
            <span className="max-w-[20rem] truncate text-ink-2">{row.original.route.name}</span>
          </span>
        </RowLink>
      ),
    }),
    segmentHelper.display({
      id: 'endpoints',
      header: 'Trayecto',
      cell: ({ row }) => (
        <StationPair
          origin={row.original.origin}
          destination={row.original.destination}
          currentId={currentId}
        />
      ),
    }),
    segmentHelper.accessor('priceOneWay', {
      header: 'Tarifa sencilla',
      meta: { numeric: true },
      cell: ({ getValue }) => currency(getValue()),
    }),
    segmentHelper.display({
      id: 'status',
      header: 'Estatus',
      cell: ({ row }) => (
        <ActivityStamp active={row.original.isActive} deleted={row.original.isDeleted} />
      ),
    }),
  ])
}

/* ── Screen ───────────────────────────────────────────────────────────────── */

/** Stable empty fallbacks: a fresh `[]` on every render would invalidate the
 *  table's data reference for nothing. */
const NO_SERVICES: Array<StationService> = []
const NO_SEGMENTS: Array<StationSegment> = []

function Screen() {
  const data = Route.useLoaderData()
  const tab = Route.useSearch().tab ?? 'services'
  const navigate = Route.useNavigate()

  const stationId = data.ok ? data.station.id : ''
  const services = data.ok ? data.station.services : NO_SERVICES
  const segments = data.ok ? data.segments : NO_SEGMENTS

  // Hooks run unconditionally, before the `!data.ok` early return below. The
  // segment columns depend on this station's id (to bold it in the
  // origin/destination pair), so they're rebuilt only when that id changes.
  const segmentColumns = useMemo(() => makeSegmentColumns(stationId), [stationId])

  const servicesTable = useTable({
    features,
    columns: stationServiceColumns,
    data: services,
    getRowId: (row) => row.id,
    enableSorting: false,
  })

  const segmentsTable = useTable({
    features,
    columns: segmentColumns,
    data: segments,
    getRowId: (row) => row.id,
    enableSorting: false,
  })

  if (!data.ok) {
    return (
      <>
        <PageHeader
          title="Terminal"
          breadcrumbs={
            <Breadcrumbs>
              <Breadcrumb to="/terminales">Terminales</Breadcrumb>
            </Breadcrumbs>
          }
        />
        <ErrorState {...data.failure} />
      </>
    )
  }

  const { station: t, departures, arrivals } = data

  const hasCoordinates =
    Number.isFinite(t.latitude) &&
    Number.isFinite(t.longitude) &&
    (t.latitude !== 0 || t.longitude !== 0)
  const mapUrl = hasCoordinates
    ? `https://www.google.com/maps/search/?api=1&query=${t.latitude},${t.longitude}`
    : null

  function goToTab(value: string) {
    void navigate({
      search: () =>
        stripDefaults(
          { tab: oneOf(value, TABS, 'services') },
          { tab: 'services' },
        ),
      replace: true,
    })
  }

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Breadcrumbs>
            <Breadcrumb to="/terminales">Terminales</Breadcrumb>
            <BreadcrumbSeparator />
            <span className="text-ink-2">{t.number}</span>
          </Breadcrumbs>
        }
        title={t.name}
        subtitle={
          <>
            <span className="text-ink-2">{t.number}</span>
            <span className="text-ink-4"> · </span>
            {t.shortName}
          </>
        }
        actions={
          <>
            <ActivityStamp active={t.isActive} deleted={t.isDeleted} />
            <span aria-hidden className="h-4 w-px bg-rule" />
            <RefreshButton />
          </>
        }
      />

      <div className="px-4 sm:px-8 py-6">
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <Card title="Identificación">
            <Grid columns={2}>
              <Field label="No. terminal" mono>
                {t.number}
              </Field>
              <Field label="Nombre corto" mono>
                {t.shortName}
              </Field>
              <Field label="Nombre completo" wide>
                {t.name}
              </Field>
              <Field label="Tipo">{STATION_TYPE_LABELS[t.type] ?? t.type}</Field>
              <Field label="Estatus">
                <ActivityStamp active={t.isActive} deleted={t.isDeleted} />
              </Field>
            </Grid>
          </Card>

          <Card title="Ubicación">
            <Grid columns={2}>
              <Field label="Dirección" wide>
                {t.address ?? <span className="text-ink-4">{NO_DATA}</span>}
              </Field>
              <Field label="Estado de la república">
                {t.state ?? <span className="text-ink-4">{NO_DATA}</span>}
              </Field>
              <Field label="Teléfono" mono>
                {t.phone ?? <span className="text-ink-4">{NO_DATA}</span>}
              </Field>
              <Field label="Latitud" mono>
                {hasCoordinates ? (
                  coordinate(t.latitude)
                ) : (
                  <span className="text-ink-4">{NO_DATA}</span>
                )}
              </Field>
              <Field label="Longitud" mono>
                {hasCoordinates ? (
                  coordinate(t.longitude)
                ) : (
                  <span className="text-ink-4">{NO_DATA}</span>
                )}
              </Field>
              <Field label="Mapa" wide>
                {mapUrl || t.googleUrl ? (
                  <div className="flex flex-col items-start gap-1.5">
                    {mapUrl ? (
                      <ExternalTextLink href={mapUrl}>Abrir en Google Maps</ExternalTextLink>
                    ) : null}
                    {t.googleUrl ? (
                      <ExternalTextLink href={t.googleUrl}>{t.googleUrl}</ExternalTextLink>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-ink-4">{NO_DATA}</span>
                )}
              </Field>
            </Grid>
          </Card>
        </div>

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
          <Card
            title="Fotografías"
            note={
              t.facadePhoto || t.isometricPhoto
                ? `${[t.facadePhoto, t.isometricPhoto].filter(Boolean).length} de 2`
                : undefined
            }
          >
            {t.facadePhoto || t.isometricPhoto ? (
              <Grid columns={2}>
                {t.facadePhoto ? <Photo label="Fachada" file={t.facadePhoto} /> : null}
                {t.isometricPhoto ? (
                  <Photo label="Isométrico" file={t.isometricPhoto} />
                ) : null}
              </Grid>
            ) : (
              <p className="text-body text-ink-3">
                Sin fotografías registradas para esta terminal.
              </p>
            )}
          </Card>

          <Card
            title="Donaciones"
            note={t.donations.length > 0 ? `${integer(t.donations.length)}` : undefined}
          >
            {t.donations.length === 0 ? (
              <p className="text-body text-ink-3">
                Sin activaciones de donativo registradas.
              </p>
            ) : (
              <ul>
                {t.donations.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-rule-faint py-2 first:pt-0 last:border-b-0 last:pb-0"
                  >
                    <span data-numeric className="font-mono text-data text-ink-2">
                      {date(d.startDate)} <span className="text-ink-4">→</span> {date(d.endDate)}
                    </span>
                    <ActivityStamp active={d.isActive} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Sheet className="mt-5 overflow-hidden">
          <Tabs
            value={tab}
            onChange={goToTab}
            options={[
              { value: 'services', label: 'Servicios', count: t.services.length },
              { value: 'departures', label: 'Rutas que salen de aquí', count: departures.length },
              { value: 'arrivals', label: 'Rutas que llegan', count: arrivals.length },
              { value: 'segments', label: 'Tramos', count: segments.length },
            ]}
          >
            <Tab value="services">
              {t.services.length === 0 ? (
                <EmptyState
                  title="Sin servicios asociados"
                  detail="Esta terminal no está dada de alta en ningún servicio, por lo que tampoco se le puede deducir una empresa."
                />
              ) : (
                <DataTable
                  table={servicesTable}
                  label="Servicios de la terminal"
                  rowProps={(row) => ({ dimmed: row.original.isDeleted })}
                />
              )}
            </Tab>

            <Tab value="departures">
              <RouteTable
                routes={departures}
                columns={departureColumns}
                label="Destino"
                empty="Ninguna ruta sale de esta terminal"
              />
            </Tab>

            <Tab value="arrivals">
              <RouteTable
                routes={arrivals}
                columns={arrivalColumns}
                label="Origen"
                empty="Ninguna ruta llega a esta terminal"
              />
            </Tab>

            <Tab value="segments">
              {segments.length === 0 ? (
                <EmptyState
                  title="Sin tramos que toquen esta terminal"
                  detail="Ningún tramo la usa como origen ni como destino."
                />
              ) : (
                <DataTable
                  table={segmentsTable}
                  label="Tramos que tocan la terminal"
                  rowProps={(row) => ({ dimmed: row.original.isDeleted })}
                />
              )}
            </Tab>
          </Tabs>
        </Sheet>

        <Card title="Rastro" className="mt-5">
          <Grid columns={4}>
            <Field label="Identificador" mono>
              {t.id}
            </Field>
            <Field label="Alta" mono>
              {dateTime(t.createdAt)}
              <span className="mt-1 block font-sans text-note text-ink-3">
                {t.createdBy ?? NO_DATA}
              </span>
            </Field>
            <Field label="Última edición" mono>
              {dateTime(t.updatedAt)}
              <span className="mt-1 block font-sans text-note text-ink-3">
                {t.updatedBy ?? NO_DATA}
              </span>
            </Field>
            <Field label="Baja" mono>
              {t.deletedAt ? (
                <span className="text-rust">{dateTime(t.deletedAt)}</span>
              ) : (
                <span className="text-ink-4">{NO_DATA}</span>
              )}
            </Field>
          </Grid>
        </Card>
      </div>
    </>
  )
}
