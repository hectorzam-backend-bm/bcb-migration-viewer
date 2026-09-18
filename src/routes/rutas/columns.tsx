import { createColumnHelper } from '@tanstack/react-table'
import { KeyText, MainMark, ActivityStamp } from '~/components/base'
import { TextLink } from '~/components/card'
import { RowLink } from '~/components/table'
import { features } from '~/components/data-table'
import { cn } from '~/lib/cn'
import { NO_DATA, integer, currency, minutes, kilometers } from '~/lib/format'
import type { RouteRow, SegmentRow, StationRef } from '~/server/routes'

/* Both tables share one URL search schema and one 17-entry sort-key union
   (`SORTS` in index.tsx); every sortable column's id equals one of its
   values. `status`, `sale` and `main` render stamps but sort on the
   underlying boolean, so they stay accessor columns (sorting requires an
   accessorFn) with an explicit `id` override rather than display columns. */

/** A pair of stations with the manifest arrow between them. */
function StationPair({
  origin,
  destination,
}: {
  origin: StationRef
  destination: StationRef
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

/* ── Routes ──────────────────────────────────────────────────────────────── */

const routeHelper = createColumnHelper<typeof features, RouteRow>()

export const routeColumns = routeHelper.columns([
  routeHelper.accessor('number', {
    header: 'No.',
    meta: { skeletonWidth: 6 },
    cell: ({ row, getValue }) => (
      <RowLink to="/rutas/$id" params={{ id: row.original.id }}>
        <KeyText emphasis>{getValue()}</KeyText>
      </RowLink>
    ),
  }),
  routeHelper.accessor('name', {
    header: 'Nombre',
    meta: { className: 'max-w-[24rem] truncate text-ink', skeletonWidth: 20 },
  }),
  routeHelper.accessor((row) => row.service.label, {
    id: 'service',
    header: 'Servicio',
    meta: { skeletonWidth: 10 },
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
  routeHelper.accessor((row) => row.company.label, {
    id: 'company',
    header: 'Empresa',
    meta: { skeletonWidth: 10 },
    cell: ({ row }) => (
      <TextLink
        to="/empresas/$id"
        params={{ id: row.original.company.id }}
        className="relative text-body text-ink-2"
      >
        {row.original.company.label}
      </TextLink>
    ),
  }),
  routeHelper.display({
    id: 'endpoints',
    header: 'Origen → Destino',
    meta: { skeletonWidth: 18 },
    cell: ({ row }) => (
      <StationPair origin={row.original.origin} destination={row.original.destination} />
    ),
  }),
  routeHelper.accessor('segments', {
    header: 'Tramos',
    meta: { numeric: true, skeletonWidth: 6 },
    cell: ({ getValue }) => {
      const value = getValue()
      return <span className={value === 0 ? 'text-amber' : undefined}>{integer(value)}</span>
    },
  }),
  routeHelper.accessor('priceOneWay', {
    id: 'price',
    header: 'Tarifa sencilla',
    meta: { numeric: true, skeletonWidth: 10 },
    cell: ({ getValue }) => currency(getValue()),
  }),
  routeHelper.accessor('travelTimeMinutes', {
    id: 'travelTime',
    header: 'Tiempo',
    meta: { numeric: true, className: 'text-ink-2', skeletonWidth: 8 },
    cell: ({ getValue }) => minutes(getValue()),
  }),
  routeHelper.accessor('distanceKm', {
    id: 'distance',
    header: 'Distancia',
    meta: { numeric: true, className: 'text-ink-2', skeletonWidth: 8 },
    cell: ({ getValue }) => kilometers(getValue()),
  }),
  routeHelper.accessor('isActive', {
    id: 'status',
    header: 'Estatus',
    meta: { skeletonWidth: 10 },
    cell: ({ row }) => (
      <ActivityStamp active={row.original.isActive} deleted={row.original.isDeleted} />
    ),
  }),
])

/* ── Segments ────────────────────────────────────────────────────────────── */

const segmentHelper = createColumnHelper<typeof features, SegmentRow>()

export const segmentColumns = segmentHelper.columns([
  segmentHelper.accessor('number', {
    header: 'No.',
    meta: { skeletonWidth: 7 },
    cell: ({ getValue }) => <KeyText emphasis>{getValue()}</KeyText>,
  }),
  segmentHelper.accessor((row) => row.route.number, {
    id: 'route',
    header: 'Ruta',
    meta: { className: 'max-w-[22rem]', skeletonWidth: 12 },
    // The row-covering link lives here, not on `number`: a segment has no
    // detail page of its own, so the whole row goes to its parent route.
    cell: ({ row }) => (
      <RowLink to="/rutas/$id" params={{ id: row.original.route.id }}>
        <span className="inline-flex items-baseline gap-2">
          <KeyText emphasis>{row.original.route.number}</KeyText>
          <span className="truncate text-body text-ink-2">{row.original.route.name}</span>
        </span>
      </RowLink>
    ),
  }),
  segmentHelper.display({
    id: 'endpoints',
    header: 'Origen → Destino',
    meta: { skeletonWidth: 22 },
    cell: ({ row }) => (
      <StationPair origin={row.original.origin} destination={row.original.destination} />
    ),
  }),
  segmentHelper.accessor('stayTimeMinutes', {
    id: 'stayTime',
    header: 'Estancia',
    meta: { numeric: true, className: 'text-ink-2', skeletonWidth: 8 },
    cell: ({ getValue }) => minutes(getValue()),
  }),
  segmentHelper.accessor('durationMinutes', {
    id: 'duration',
    header: 'Duración',
    meta: { numeric: true, className: 'text-ink-2', skeletonWidth: 8 },
    cell: ({ getValue }) => minutes(getValue()),
  }),
  segmentHelper.accessor('distanceKm', {
    id: 'distance',
    header: 'Distancia',
    meta: { numeric: true, className: 'text-ink-2', skeletonWidth: 8 },
    cell: ({ getValue }) => kilometers(getValue()),
  }),
  segmentHelper.accessor('allowSale', {
    id: 'sale',
    header: 'Venta',
    meta: { skeletonWidth: 6 },
    cell: ({ getValue }) => <YesNo value={getValue()} />,
  }),
  segmentHelper.accessor('priceOneWay', {
    id: 'price',
    header: 'Tarifa sencilla',
    meta: { numeric: true, skeletonWidth: 10 },
    cell: ({ getValue }) => currency(getValue()),
  }),
  segmentHelper.accessor('priceRound', {
    id: 'priceRound',
    header: 'Tarifa redonda',
    meta: { numeric: true, className: 'text-ink-2', skeletonWidth: 10 },
    cell: ({ getValue }) => currency(getValue()),
  }),
  segmentHelper.accessor('isMain', {
    id: 'main',
    header: 'Principal',
    meta: { skeletonWidth: 8 },
    cell: ({ getValue }) =>
      getValue() ? <MainMark /> : <span className="text-ink-4">{NO_DATA}</span>,
  }),
  segmentHelper.accessor('isActive', {
    id: 'status',
    header: 'Estatus',
    meta: { skeletonWidth: 9 },
    cell: ({ row }) => (
      <ActivityStamp active={row.original.isActive} deleted={row.original.isDeleted} />
    ),
  }),
])
