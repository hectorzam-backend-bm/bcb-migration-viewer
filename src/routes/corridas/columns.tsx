import { createColumnHelper } from '@tanstack/react-table'
import { KeyText, Stamp } from '~/components/base'
import { TextLink } from '~/components/card'
import { RowLink } from '~/components/table'
import { features } from '~/components/data-table'
import { cn } from '~/lib/cn'
import { NO_DATA, TRIP_STATUS_LABELS, TRIP_TYPE_LABELS, currency, integer, time } from '~/lib/format'
import type { TripRow } from '~/server/trips'

/* Every sortable column's id is one of `TRIP_SORTS` (`src/server/trips.ts`).
   `Boletos` has an accessorFn but no cheap Postgres ordering — Postgres can't
   sort by a sum over `TripPassengerType` — so it stays `enableSorting: false`
   rather than a sortable column. The five columns after the `groupStart`
   never migrated: `Operator`, `Bus`, `TripPlanning`, `TripDispatch` and
   `TripSeat` are all empty in the connected database (see the plan). They are
   plain `display` columns that always print `SIN_DATO`, held together behind
   one rule and demoted to `text-ink-4` — one visible fact, not five. */

const TRIP_STATUS_TONE: Record<string, 'active' | 'inactive' | 'warning'> = {
  OPEN: 'active',
  CONFIRMED: 'active',
  DISPATCHED: 'active',
  CLOSED: 'inactive',
  FINISHED: 'inactive',
  CANCELLED: 'warning',
  CANCELLED_BY_GROUP: 'warning',
}

/** Shared with the trip detail page: deleted-first, then the status tone. */
export function TripStatus({ status, isDeleted }: { status: string; isDeleted: boolean }) {
  if (isDeleted) {
    return (
      <Stamp tone="deleted" title="Registro con deletedAt — borrado lógico">
        Baja
      </Stamp>
    )
  }
  return (
    <Stamp tone={TRIP_STATUS_TONE[status] ?? 'inactive'}>
      {TRIP_STATUS_LABELS[status] ?? status}
    </Stamp>
  )
}

function YesNo({ value }: { value: boolean }) {
  return (
    <span className={cn('font-mono text-data', value ? 'text-ink-2' : 'text-ink-4')}>
      {value ? 'Sí' : 'No'}
    </span>
  )
}

const helper = createColumnHelper<typeof features, TripRow>()

export const tripColumns = helper.columns([
  // `Trip.id` doubles as the legacy "clave de corrida" in the migrated data
  // (see `src/server/trips.ts`) — the identifier column carries the row link,
  // the same convention as `empresas`' and `rutas`' leading columns.
  helper.accessor('id', {
    id: 'key',
    header: 'Clave',
    meta: { skeletonWidth: 11 },
    cell: ({ getValue }) => (
      <RowLink to="/corridas/$id" params={{ id: getValue() }}>
        <KeyText emphasis>{getValue()}</KeyText>
      </RowLink>
    ),
  }),
  helper.accessor('departure', {
    header: 'Hora planeada',
    meta: { skeletonWidth: 6, className: 'text-ink' },
    cell: ({ getValue }) => (
      <span className="font-mono text-data font-medium tracking-[0.02em]">
        {time(getValue())}
      </span>
    ),
  }),
  helper.accessor('dispatchedAt', {
    id: 'dispatched',
    header: 'Hora despachada',
    meta: { skeletonWidth: 6, className: 'text-ink-2' },
    cell: ({ getValue }) => time(getValue()),
  }),
  helper.accessor('arrival', {
    header: 'Llegada',
    meta: { skeletonWidth: 6, className: 'text-ink-2' },
    cell: ({ getValue }) => time(getValue()),
  }),
  helper.accessor((row) => row.route.number, {
    id: 'route',
    header: 'Ruta',
    meta: { skeletonWidth: 12 },
    cell: ({ row }) => (
      <TextLink to="/rutas/$id" params={{ id: row.original.route.id }} className="relative">
        <span className="inline-flex items-baseline gap-2">
          <span className="font-mono text-data tracking-[0.04em] text-ink">
            {row.original.route.number}
          </span>
          <span className="truncate text-body text-ink-2">{row.original.route.name}</span>
        </span>
      </TextLink>
    ),
  }),
  helper.accessor((row) => row.service.label, {
    id: 'service',
    header: 'Servicio',
    meta: { skeletonWidth: 9 },
    cell: ({ row }) => (
      <TextLink
        to="/servicios/$id"
        params={{ id: row.original.service.id }}
        className="relative text-body text-ink-2"
      >
        {row.original.service.label}
      </TextLink>
    ),
  }),
  helper.accessor('type', {
    header: 'Tipo',
    meta: { skeletonWidth: 5 },
    cell: ({ getValue }) => {
      const value = getValue()
      return TRIP_TYPE_LABELS[value] ?? value
    },
  }),
  helper.accessor('openSale', {
    id: 'sale',
    header: 'Venta',
    meta: { skeletonWidth: 5 },
    cell: ({ getValue }) => <YesNo value={getValue()} />,
  }),
  helper.accessor('status', {
    header: 'Estatus',
    meta: { skeletonWidth: 8 },
    cell: ({ row }) => (
      <TripStatus status={row.original.status} isDeleted={row.original.isDeleted} />
    ),
  }),
  helper.accessor('segments', {
    header: 'Tramos',
    meta: { numeric: true, skeletonWidth: 5 },
    cell: ({ getValue }) => {
      const value = getValue()
      return <span className={value === 0 ? 'text-amber' : undefined}>{integer(value)}</span>
    },
  }),
  helper.accessor('tickets', {
    header: 'Boletos',
    enableSorting: false,
    meta: { numeric: true, skeletonWidth: 5 },
    cell: ({ getValue }) => {
      const value = getValue()
      return <span className={value === 0 ? 'text-amber' : undefined}>{integer(value)}</span>
    },
  }),
  helper.accessor('priceOneWay', {
    id: 'price',
    header: 'Sencilla',
    meta: { numeric: true, skeletonWidth: 7 },
    cell: ({ getValue }) => currency(getValue()),
  }),
  helper.accessor('priceRound', {
    id: 'priceRound',
    header: 'Redonda',
    meta: { numeric: true, className: 'text-ink-2', skeletonWidth: 7 },
    cell: ({ getValue }) => {
      const value = getValue()
      const isZero = Number(value) === 0
      return <span className={isZero ? 'text-amber' : undefined}>{currency(value)}</span>
    },
  }),
  helper.display({
    id: 'plannedOperator',
    header: 'Op. planeado',
    meta: { className: 'text-ink-4', skeletonWidth: 6, groupStart: true },
    cell: () => NO_DATA,
  }),
  helper.display({
    id: 'plannedBus',
    header: 'Bus planeado',
    meta: { className: 'text-ink-4', skeletonWidth: 6 },
    cell: () => NO_DATA,
  }),
  helper.display({
    id: 'operator',
    header: 'Operador',
    meta: { className: 'text-ink-4', skeletonWidth: 6 },
    cell: () => NO_DATA,
  }),
  helper.display({
    id: 'bus',
    header: 'Autobús',
    meta: { className: 'text-ink-4', skeletonWidth: 6 },
    cell: () => NO_DATA,
  }),
  helper.display({
    id: 'capacity',
    header: 'Capacidad',
    meta: { className: 'text-ink-4', skeletonWidth: 6 },
    cell: () => NO_DATA,
  }),
])
