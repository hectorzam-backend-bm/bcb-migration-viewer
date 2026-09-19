import { createColumnHelper } from '@tanstack/react-table'
import { KeyText, Stamp } from '~/components/base'
import { TextLink } from '~/components/card'
import { RowLink } from '~/components/table'
import { features } from '~/components/data-table'
import { cn } from '~/lib/cn'
import {
  NO_DATA,
  PAYMENT_METHOD_LABELS,
  TICKET_OPERATION_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_TYPE_LABELS,
  currency,
  integer,
  legacyDateTime,
} from '~/lib/format'
import type { TicketRow } from '~/server/tickets'

/* Every sortable column's id is one of `TICKET_SORTS` (`src/server/tickets.ts`).
   `Tipo de operación` and `Fecha y hora de operación` are `enableSorting: false`:
   both are derived in JS from a folio's movement history, nothing for Postgres to
   order by. `Corrida` and `Asiento` stay unsorted too — `Corrida` hangs off a
   nullable `OrderItem → TripSeat → Trip` two-hop, and grouping a corrida's boletos
   is already what the `trip` filter (written by the `/corridas` cross-link) does;
   a seat number has no meaning across corridas.

   The three columns after `groupStart` never migrated: asesor, caja (la real) y
   corte no vienen en boletos.csv, y el importador no los escribe. Son `display`
   que siempre imprimen SIN_DATO, unidas por una sola raya y degradadas a
   `text-ink-4` — un hecho visible, no tres.

   Ojo: `Terminal de venta` y `Canal de venta` SÍ son columnas reales, a propósito
   — no van en la banda gris. La estación de `Terminal de venta` se resuelve contra
   `Station.shortName` (dato legado genuino); lo sintético es sólo la caja
   específica que la contiene (`CashRegister` de relleno, un placeholder por
   estación — ver el paso de Boletos en `/importar`), y esa caja SÍ vive en la
   banda gris. */

const TICKET_STATUS_TONE: Record<string, 'active' | 'inactive' | 'warning'> = {
  PAID: 'active',
  TRAVELED: 'active',
  EXCHANGED: 'inactive',
  NOT_EXCHANGED: 'inactive',
  NOT_TRAVELED: 'inactive',
  APPROACHED: 'inactive',
  EXPIRED: 'inactive',
  CANCELED: 'warning',
}

/** Shared with the ticket detail page, same convention as `TripStatus`.
 *  `OrderItem` has no `deletedAt` — `CANCELED` is a status, not a logical
 *  delete, so there is no deleted-first branch here. */
export function TicketStatus({ status }: { status: string }) {
  return (
    <Stamp tone={TICKET_STATUS_TONE[status] ?? 'inactive'}>
      {TICKET_STATUS_LABELS[status] ?? status}
    </Stamp>
  )
}

const helper = createColumnHelper<typeof features, TicketRow>()

export const ticketColumns = helper.columns([
  helper.accessor('folio', {
    header: 'Folio',
    meta: { skeletonWidth: 9 },
    cell: ({ row, getValue }) => (
      <RowLink to="/boletos/$id" params={{ id: row.original.folio }}>
        <KeyText emphasis>{getValue()}</KeyText>
      </RowLink>
    ),
  }),
  helper.accessor('status', {
    header: 'Estatus',
    meta: { skeletonWidth: 6 },
    cell: ({ getValue }) => <TicketStatus status={getValue()} />,
  }),
  helper.accessor('operation', {
    header: 'Tipo de operación',
    enableSorting: false,
    meta: { skeletonWidth: 6, className: 'text-ink-2' },
    cell: ({ getValue }) => TICKET_OPERATION_LABELS[getValue()] ?? getValue(),
  }),
  helper.accessor('soldAt', {
    id: 'sold',
    header: 'Fecha y hora de venta',
    meta: { skeletonWidth: 7, className: 'text-ink' },
    cell: ({ getValue }) => (
      <span className="font-mono text-data tracking-[0.02em]">{legacyDateTime(getValue())}</span>
    ),
  }),
  helper.accessor('operatedAt', {
    header: 'Fecha y hora de operación',
    enableSorting: false,
    meta: { skeletonWidth: 7, className: 'text-ink-2' },
    cell: ({ getValue }) => legacyDateTime(getValue()),
  }),
  helper.accessor('passenger', {
    header: 'Pasajero',
    meta: { skeletonWidth: 8 },
    cell: ({ getValue }) => getValue() ?? NO_DATA,
  }),
  helper.accessor((row) => row.passengerType?.name ?? '', {
    id: 'passengerType',
    header: 'Tipo de pasajero',
    meta: { skeletonWidth: 6 },
    cell: ({ row }) =>
      row.original.passengerType ? (
        <span className="inline-flex items-baseline gap-1.5">
          <KeyText>{row.original.passengerType.key}</KeyText>
          <span className="text-body text-ink-2">{row.original.passengerType.name}</span>
        </span>
      ) : (
        NO_DATA
      ),
  }),
  helper.accessor((row) => row.company?.label ?? '', {
    id: 'company',
    header: 'Empresa',
    meta: { skeletonWidth: 5 },
    cell: ({ row }) =>
      row.original.company ? (
        <TextLink
          to="/empresas/$id"
          params={{ id: row.original.company.id }}
          className="relative text-body text-ink-2"
        >
          {row.original.company.label}
        </TextLink>
      ) : (
        NO_DATA
      ),
  }),
  helper.accessor((row) => row.service?.label ?? '', {
    id: 'service',
    header: 'Servicio',
    meta: { skeletonWidth: 5 },
    cell: ({ row }) =>
      row.original.service ? (
        <TextLink
          to="/servicios/$id"
          params={{ id: row.original.service.id }}
          className="relative text-body text-ink-2"
        >
          {row.original.service.label}
        </TextLink>
      ) : (
        NO_DATA
      ),
  }),
  helper.accessor((row) => row.trip?.id ?? '', {
    id: 'trip',
    header: 'Corrida',
    enableSorting: false,
    meta: { skeletonWidth: 8 },
    cell: ({ row }) => {
      const trip = row.original.trip
      if (!trip) {
        return (
          <span className="text-amber" title="El boleto no quedó ligado a ninguna corrida (sin asiento migrado)">
            {NO_DATA}
          </span>
        )
      }
      return (
        <TextLink to="/corridas/$id" params={{ id: trip.id }} className="relative">
          <span className="inline-flex items-baseline gap-2">
            <KeyText emphasis>{trip.id}</KeyText>
            {row.original.route ? (
              <span className="text-body text-ink-3">{row.original.route.number}</span>
            ) : null}
          </span>
        </TextLink>
      )
    },
  }),
  helper.accessor('type', {
    header: 'Tipo de boleto',
    meta: { skeletonWidth: 5, className: 'text-ink-2' },
    cell: ({ getValue }) => TICKET_TYPE_LABELS[getValue()] ?? getValue(),
  }),
  helper.accessor('payment', {
    header: 'Forma de pago',
    meta: { skeletonWidth: 5 },
    cell: ({ getValue }) => PAYMENT_METHOD_LABELS[getValue()] ?? getValue(),
  }),
  helper.accessor((row) => row.channel ?? '', {
    id: 'channel',
    header: 'Canal de venta',
    meta: { skeletonWidth: 5 },
    cell: ({ row }) => row.original.channel ?? NO_DATA,
  }),
  helper.accessor((row) => row.terminal?.key ?? '', {
    id: 'terminal',
    header: 'Terminal de venta',
    meta: { skeletonWidth: 5 },
    cell: ({ row }) =>
      row.original.terminal ? (
        <TextLink to="/terminales/$id" params={{ id: row.original.terminal.id }} className="relative">
          <KeyText>{row.original.terminal.key}</KeyText>
        </TextLink>
      ) : (
        NO_DATA
      ),
  }),
  helper.accessor('invoiceCode', {
    id: 'invoice',
    header: 'Facturado',
    meta: { skeletonWidth: 4 },
    cell: ({ getValue }) => {
      const value = getValue()
      return value ? <KeyText>{value}</KeyText> : <span className="text-ink-4">{NO_DATA}</span>
    },
  }),
  helper.accessor('total', {
    header: 'Total',
    meta: { numeric: true, skeletonWidth: 5 },
    cell: ({ getValue }) => currency(getValue()),
  }),
  helper.accessor('seat', {
    header: 'Asiento',
    enableSorting: false,
    meta: { numeric: true, skeletonWidth: 3 },
    cell: ({ getValue }) => {
      const value = getValue()
      return value === null ? <span className="text-amber">{NO_DATA}</span> : integer(value)
    },
  }),

  /* ── Sin migrar ─────────────────────────────────────────────────────────── */
  helper.display({
    id: 'advisor',
    header: 'Asesor',
    meta: { className: 'text-ink-4', skeletonWidth: 4, groupStart: true },
    cell: () => NO_DATA,
  }),
  helper.display({
    id: 'register',
    header: 'Caja',
    meta: { className: 'text-ink-4', skeletonWidth: 3 },
    cell: () => NO_DATA,
  }),
  helper.display({
    id: 'shift',
    header: 'No. de corte',
    meta: { className: 'text-ink-4', skeletonWidth: 3 },
    cell: () => NO_DATA,
  }),
])

/** `Sí`/`No` for the ticket detail card — kept here so the boolean formatting
 *  matches `corridas/$id.tsx`'s `YesNo` byte for byte without importing across
 *  route files. */
export function YesNo({ value }: { value: boolean | null }) {
  if (value === null) return <span className="font-mono text-data text-ink-4">{NO_DATA}</span>
  return (
    <span className={cn('font-mono text-data', value ? 'text-ink' : 'text-ink-3')}>{value ? 'Sí' : 'No'}</span>
  )
}
