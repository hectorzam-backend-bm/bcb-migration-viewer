import { createFileRoute } from '@tanstack/react-router'
import { createColumnHelper, useTable } from '@tanstack/react-table'
import { Stat, KeyText, Field, Sheet, MainMark } from '~/components/base'
import { PageHeader, Breadcrumb, Breadcrumbs, BreadcrumbSeparator } from '~/components/shell'
import { ErrorState, ManifestSkeleton } from '~/components/states'
import { Card, Grid, Block, TextLink } from '~/components/card'
import { RefreshButton } from '~/components/refresh'
import { DataTable, features } from '~/components/data-table'
import { TripStatus } from './columns'
import { cn } from '~/lib/cn'
import {
  NO_DATA,
  TRIP_TYPE_LABELS,
  currency,
  dateTime,
  dayLabelFull,
  integer,
  minutes,
  plural,
  time,
} from '~/lib/format'
import type { StationRef, TripDetail, TripPassengerTypeDetail, TripSegmentDetail } from '~/server/trips'
import { getTrip } from '~/server/trips'

export const Route = createFileRoute('/corridas/$id')({
  loader: ({ params }) => getTrip({ data: { id: params.id } }),
  component: Screen,
  pendingComponent: () => (
    <>
      <PageHeader title="Cargando corrida…" subtitle={NO_DATA} />
      <div className="px-4 sm:px-8 py-6">
        <Sheet className="py-2">
          <ManifestSkeleton columns={[8, 26, 12, 12, 12, 10]} rows={6} />
        </Sheet>
      </div>
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <ErrorState
      title="No fue posible leer la corrida"
      detail={error instanceof Error ? error.message : String(error)}
      onRetry={reset}
    />
  ),
})

/* ── Pieces ─────────────────────────────────────────────────────────────── */

function StationLink({ station }: { station: StationRef }) {
  return (
    <TextLink to="/terminales/$id" params={{ id: station.id }}>
      <span className="inline-flex items-baseline gap-2">
        <KeyText emphasis>{station.key}</KeyText>
        <span className="text-body text-ink-2">{station.name}</span>
      </span>
    </TextLink>
  )
}

function YesNo({ value }: { value: boolean }) {
  return (
    <span className={cn('font-mono text-data', value ? 'text-ink' : 'text-ink-3')}>
      {value ? 'Sí' : 'No'}
    </span>
  )
}

/* ── Segments table ─────────────────────────────────────────────────────── */

const segmentHelper = createColumnHelper<typeof features, TripSegmentDetail>()

const segmentColumns = segmentHelper.columns([
  segmentHelper.accessor('number', {
    header: 'No.',
    cell: ({ row, getValue }) => (
      <span className="inline-flex items-center gap-1.5">
        <KeyText emphasis>{getValue()}</KeyText>
        {row.original.isMain ? <MainMark /> : null}
      </span>
    ),
  }),
  segmentHelper.display({
    id: 'endpoints',
    header: 'Origen → Destino',
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <TextLink to="/terminales/$id" params={{ id: row.original.origin.id }}>
          <KeyText>{row.original.origin.key}</KeyText>
        </TextLink>
        <span aria-hidden className="text-ink-4">
          →
        </span>
        <TextLink to="/terminales/$id" params={{ id: row.original.destination.id }}>
          <KeyText>{row.original.destination.key}</KeyText>
        </TextLink>
      </span>
    ),
  }),
  segmentHelper.accessor('departure', {
    header: 'Salida',
    meta: { className: 'text-ink-2' },
    cell: ({ getValue }) => time(getValue()),
  }),
  segmentHelper.accessor('arrival', {
    header: 'Llegada',
    meta: { className: 'text-ink-2' },
    cell: ({ getValue }) => time(getValue()),
  }),
  segmentHelper.accessor('priceOneWay', {
    id: 'price',
    header: 'Tarifa sencilla',
    meta: { numeric: true },
    cell: ({ getValue }) => currency(getValue()),
  }),
  segmentHelper.accessor('priceRound', {
    id: 'priceRound',
    header: 'Tarifa redonda',
    meta: { numeric: true, className: 'text-ink-2' },
    cell: ({ getValue }) => currency(getValue()),
  }),
])

/* ── Passenger types table ──────────────────────────────────────────────── */

const passengerHelper = createColumnHelper<typeof features, TripPassengerTypeDetail>()

const passengerColumns = passengerHelper.columns([
  passengerHelper.accessor('name', {
    header: 'Tipo',
    meta: { className: 'text-ink' },
  }),
  passengerHelper.accessor('key', {
    header: 'Clave',
    cell: ({ getValue }) => <KeyText>{getValue()}</KeyText>,
  }),
  passengerHelper.accessor('seatingLimit', {
    header: 'Límite de asientos',
    meta: { numeric: true },
    cell: ({ getValue }) => {
      const value = getValue()
      return (
        <span className={value === null ? 'text-ink-3' : undefined}>
          {value === null ? 'Sin límite' : integer(value)}
        </span>
      )
    },
  }),
  passengerHelper.accessor('ticketsSold', {
    header: 'Boletos vendidos',
    meta: { numeric: true },
    cell: ({ getValue }) => {
      const value = getValue()
      return <span className={value === 0 ? 'text-amber' : undefined}>{integer(value)}</span>
    },
  }),
])

/* ── Screen ─────────────────────────────────────────────────────────────── */

const NO_SEGMENTS: Array<TripSegmentDetail> = []
const NO_PASSENGER_TYPES: Array<TripPassengerTypeDetail> = []

function Screen() {
  const data = Route.useLoaderData()

  // Hooks run unconditionally, before the `!data.ok` early return below.
  const segmentsTable = useTable({
    features,
    columns: segmentColumns,
    data: data.ok ? data.trip.segments : NO_SEGMENTS,
    getRowId: (row) => row.id,
    enableSorting: false,
  })

  const passengerTable = useTable({
    features,
    columns: passengerColumns,
    data: data.ok ? data.trip.passengerTypes : NO_PASSENGER_TYPES,
    getRowId: (row) => row.id,
    enableSorting: false,
  })

  if (!data.ok) {
    return (
      <>
        <PageHeader
          title="Corrida"
          breadcrumbs={
            <Breadcrumbs>
              <Breadcrumb to="/corridas">Corridas</Breadcrumb>
              <BreadcrumbSeparator />
              <span className="text-ink-2">{NO_DATA}</span>
            </Breadcrumbs>
          }
        />
        <ErrorState {...data.failure} />
      </>
    )
  }

  const trip = data.trip
  const day = trip.departure.slice(0, 10)
  const durationMinutes = trip.arrival
    ? Math.round((new Date(trip.arrival).getTime() - new Date(trip.departure).getTime()) / 60000)
    : null

  const schedulesMatch =
    trip.dispatchedAt === trip.departure &&
    trip.realDepartureAt === trip.departure &&
    trip.realArrivalAt === trip.arrival

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Breadcrumbs>
            <Breadcrumb to="/corridas">Corridas</Breadcrumb>
            <BreadcrumbSeparator />
            <span className="text-ink-2">{dayLabelFull(day)}</span>
          </Breadcrumbs>
        }
        title={`${trip.route.number} ${trip.route.name}`}
        subtitle={`${time(trip.departure)} → ${time(trip.arrival)} · ${trip.service.name} · ${trip.company.name}`}
        actions={
          <>
            <TripStatus status={trip.status} isDeleted={trip.isDeleted} />
            <span aria-hidden className="h-4 w-px bg-rule" />
            <RefreshButton />
          </>
        }
      />

      <div className="flex flex-col gap-7 px-4 sm:px-8 py-6">
        <Sheet>
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 p-5 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Tramos" value={integer(trip.segments.length)} />
            <Stat
              label="Boletos vendidos"
              value={integer(trip.ticketsSold)}
              tone={trip.ticketsSold === 0 ? 'amber' : 'ink'}
            />
            <Stat label="Tarifa sencilla" value={currency(trip.priceOneWay)} tone="stamp" />
            <Stat
              label="Tarifa redonda"
              value={currency(trip.priceRound)}
              tone={Number(trip.priceRound) === 0 ? 'amber' : 'ink'}
            />
            <Stat label="Duración planeada" value={minutes(durationMinutes)} />
            <Stat label="Tipo" value={TRIP_TYPE_LABELS[trip.type] ?? trip.type} />
          </div>
        </Sheet>

        <Card title="Información básica">
          <Grid columns={3}>
            <Field label="Ruta">
              <TextLink to="/rutas/$id" params={{ id: trip.route.id }}>
                {trip.route.number} · {trip.route.name}
              </TextLink>
            </Field>
            <Field label="Servicio">
              <TextLink to="/servicios/$id" params={{ id: trip.service.id }}>
                {trip.service.name}
              </TextLink>
            </Field>
            <Field label="Empresa">
              <TextLink to="/empresas/$id" params={{ id: trip.company.id }}>
                {trip.company.name}
              </TextLink>
            </Field>
            <Field label="Origen">
              <StationLink station={trip.origin} />
            </Field>
            <Field label="Destino">
              <StationLink station={trip.destination} />
            </Field>
            <Field label="Venta abierta">
              <YesNo value={trip.openSale} />
            </Field>
          </Grid>
        </Card>

        <Card title="Horarios">
          <Grid columns={3}>
            <Field label="Salida planeada" mono>
              {time(trip.departure)}
            </Field>
            <Field label="Llegada planeada" mono>
              {time(trip.arrival)}
            </Field>
            <Field label="Hora despachada" mono>
              {time(trip.dispatchedAt)}
            </Field>
            <Field label="Salida real" mono>
              {time(trip.realDepartureAt)}
            </Field>
            <Field label="Llegada real" mono>
              {time(trip.realArrivalAt)}
            </Field>
          </Grid>
          <p className="mt-5 text-body text-ink-3">
            {schedulesMatch
              ? 'La hora despachada y las horas reales coinciden con las horas planeadas en esta corrida: son el mismo valor migrado, no una observación operativa distinta.'
              : 'La hora despachada o alguna de las horas reales difiere de la hora planeada en esta corrida.'}
          </p>
        </Card>

        <Block label="Sin migrar en esta corrida" className="pb-2">
          <p className="text-body text-ink-3">
            Operador, autobús, asientos (TripSeat), planeación (TripPlanning) y despacho
            (TripDispatch) no llegaron con la migración: las tablas correspondientes están vacías
            en la base conectada, así que no hay capacidad ni tripulación que mostrar para ninguna
            corrida.
          </p>
        </Block>

        <Card
          title="Tramos"
          note={trip.segments.length > 0 ? plural(trip.segments.length, 'tramo', 'tramos') : undefined}
        >
          {trip.segments.length === 0 ? (
            <p className="text-body text-ink-3">Esta corrida no tiene tramos migrados.</p>
          ) : (
            <div className="-m-5">
              <DataTable
                table={segmentsTable}
                label={`Tramos de la corrida ${trip.route.number}`}
                rowProps={(row) => ({ highlighted: row.original.isMain })}
              />
            </div>
          )}
        </Card>

        <Card
          title="Tipos de pasajero"
          note={
            trip.passengerTypes.length > 0
              ? plural(trip.passengerTypes.length, 'tipo', 'tipos')
              : undefined
          }
        >
          {trip.passengerTypes.length === 0 ? (
            <p className="text-body text-ink-3">
              Esta corrida no tiene tipos de pasajero configurados.
            </p>
          ) : (
            <div className="-m-5">
              <DataTable
                table={passengerTable}
                label="Tipos de pasajero de la corrida"
                rowProps={(row) => ({ dimmed: !row.original.isActive })}
              />
            </div>
          )}
        </Card>

        <Card title="Auditoría">
          <Grid columns={2}>
            <Field label="Creado" mono>
              {dateTime(trip.createdAt)}
            </Field>
            <Field label="Actualizado" mono>
              {dateTime(trip.updatedAt)}
            </Field>
          </Grid>
        </Card>
      </div>
    </>
  )
}
