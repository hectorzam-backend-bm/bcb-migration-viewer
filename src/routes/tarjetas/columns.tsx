import { createColumnHelper } from '@tanstack/react-table'
import { KeyText, Stamp } from '~/components/base'
import { TextLink } from '~/components/card'
import { RowLink } from '~/components/table'
import { features } from '~/components/data-table'
import { NO_DATA, TRAVEL_CARD_STATUS_LABELS, currency, legacyDateTime } from '~/lib/format'
import type { TravelCardRow } from '~/server/travel-cards'

/* Every sortable column's id equals a value of TRAVEL_CARD_SORTS. */

/** A collected card is the normal end state; only a cancelled one stands out. */
export function TravelCardStatusStamp({ status }: { status: string }) {
  const tone = status === 'CANCELLED' ? 'warning' : status === 'COLLECTED' ? 'inactive' : 'active'
  return <Stamp tone={tone}>{TRAVEL_CARD_STATUS_LABELS[status] ?? status}</Stamp>
}

const helper = createColumnHelper<typeof features, TravelCardRow>()

export const travelCardColumns = helper.columns([
  helper.accessor('key', {
    header: 'Folio',
    meta: { skeletonWidth: 10 },
    cell: ({ row, getValue }) => (
      <RowLink to="/tarjetas/$id" params={{ id: row.original.id }}>
        <KeyText emphasis>{getValue() ?? `No. ${row.original.number}`}</KeyText>
      </RowLink>
    ),
  }),
  helper.accessor('departure', {
    header: 'Salida',
    meta: { skeletonWidth: 12, className: 'font-mono text-data' },
    cell: ({ getValue }) => legacyDateTime(getValue()),
  }),
  helper.accessor((row) => row.trip.id, {
    id: 'trip',
    header: 'Corrida',
    enableSorting: false, // not in TRAVEL_CARD_SORTS
    meta: { skeletonWidth: 14 },
    cell: ({ row }) => (
      <TextLink to="/corridas/$id" params={{ id: row.original.trip.id }} className="relative">
        <span className="font-mono text-data tracking-[0.02em]">{row.original.trip.id}</span>
      </TextLink>
    ),
  }),
  helper.accessor((row) => row.route.number, {
    id: 'route',
    header: 'Ruta',
    enableSorting: false, // not in TRAVEL_CARD_SORTS
    meta: { skeletonWidth: 14 },
    cell: ({ row }) => (
      <TextLink to="/rutas/$id" params={{ id: row.original.route.id }} className="relative">
        <span className="inline-flex items-baseline gap-2">
          <span className="font-mono text-data tracking-[0.04em] text-ink">{row.original.route.number}</span>
          <span className="truncate text-body text-ink-2">{row.original.route.name}</span>
        </span>
      </TextLink>
    ),
  }),
  helper.accessor('collectedAmount', {
    id: 'amount',
    header: 'Recaudado',
    meta: { numeric: true, skeletonWidth: 9 },
    cell: ({ getValue }) => {
      const value = getValue()
      if (value === null) return <span className="text-ink-4">{NO_DATA}</span>
      return <span className={Number(value) === 0 ? 'text-amber' : undefined}>{currency(value)}</span>
    },
  }),
  helper.accessor('collectedAt', {
    id: 'collected',
    header: 'Recaudada',
    meta: { skeletonWidth: 12, className: 'font-mono text-data text-ink-2' },
    cell: ({ getValue }) => legacyDateTime(getValue()),
  }),
  helper.display({
    id: 'status',
    header: 'Estatus',
    meta: { skeletonWidth: 9 },
    cell: ({ row }) => <TravelCardStatusStamp status={row.original.status} />,
  }),
])
