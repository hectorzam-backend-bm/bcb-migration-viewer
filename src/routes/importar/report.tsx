import { Block } from '~/components/card'
import { Label, Stat } from '~/components/base'
import { cn } from '~/lib/cn'
import { integer } from '~/lib/format'
import type { ImportReport } from '~/server/seeds'

/**
 * Spanish labels for every `reasons`/`counters` code the backend's
 * `seeds.service.ts` can emit (`ImportReport.toJSON()`). An unknown code is
 * never hidden — it prints as-is, because pretending a discarded row didn't
 * happen would be a lie the report doesn't tell.
 */
export const REASON_LABELS: Record<string, string> = {
  STATION_ALREADY_EXISTS: 'La terminal ya existía',
  STATION_NOT_IN_CSV: 'La terminal no está en estados.csv',
  STATION_NOT_FOUND: 'No se encontró la terminal',
  ROUTE_ALREADY_EXISTS: 'La ruta ya existía',
  ROUTE_NOT_FOUND: 'No se encontró la ruta',
  SERVICE_NOT_FOUND: 'No se encontró el servicio',
  SEGMENT_NOT_FOUND: 'No se encontró el tramo',
  ORIGIN_DESTINATION_SAME: 'Origen y destino son la misma terminal',
  DUPLICATE_ORIGIN_DESTINATION: 'Origen y destino repetidos en la ruta',
  SAME_AS_MAIN_SEGMENT: 'Igual al tramo principal',
  MISSING_CLAVE_CORRIDA: 'Sin CLAVE_CORRIDA',
  DUPLICATE_CLAVE_CORRIDA: 'CLAVE_CORRIDA repetida en el archivo',
  DUPLICATE_ROUTE_DEPARTURE: 'Ya hay una corrida para esa ruta y salida',
  INVALID_DEPARTURE: 'Fecha y hora de salida inválida',
  PASSENGER_TYPE_NOT_FOUND: 'No se encontró el tipo de pasajero',
  TRIP_NOT_FOUND_FOR_LIMIT: 'El límite no corresponde a ninguna corrida',
}

export const COUNTER_LABELS: Record<string, string> = {
  routesUpdated: 'Rutas actualizadas',
  segmentsUpdated: 'Tramos actualizados',
  routesWithoutTariff: 'Rutas sin tarifa',
  segmentsWithoutTariff: 'Tramos sin tarifa',
  routePassengerTypesUpserted: 'Tipos de pasajero por ruta',
  segmentPassengerTypesUpserted: 'Tipos de pasajero por tramo',
  passengerTypesCreated: 'Tipos de pasajero creados',
  tripPassengerTypesCreated: 'Tipos de pasajero por corrida',
  tripsSkippedAsDuplicateInDb: 'Corridas que ya estaban en la base',
  operatorsUnresolved: 'Operadores sin resolver',
  busesUnresolved: 'Autobuses sin resolver',
  negativeTicketsSoldClamped: 'Boletos vendidos negativos ajustados a 0',
}

/** Counters worth flagging amber: gaps in the data, not routine outcomes of
 *  re-running an idempotent import. */
const AMBER_COUNTERS = new Set([
  'operatorsUnresolved',
  'busesUnresolved',
  'routesWithoutTariff',
  'segmentsWithoutTariff',
  'negativeTicketsSoldClamped',
])

function LabeledCounts({
  entries,
  labels,
  warnKeys,
}: {
  entries: Record<string, number>
  labels: Record<string, string>
  warnKeys?: ReadonlySet<string>
}) {
  const rows = Object.entries(entries).sort((a, b) => b[1] - a[1])
  return (
    <ul className="divide-y divide-rule-faint">
      {rows.map(([code, count]) => (
        <li key={code} className="flex items-baseline justify-between gap-4 py-1.5">
          <span className="min-w-0 text-body text-ink-2">{labels[code] ?? code}</span>
          <span
            data-numeric
            className={cn('shrink-0 font-mono text-data tabular-nums', warnKeys?.has(code) ? 'text-amber' : 'text-ink')}
          >
            {integer(count)}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * `created`/`skipped` always render in plain ink, never colored as a verdict:
 * `import/tariffs` only ever updates rows, so it always reports `created: 0`
 * — that is its normal, successful outcome, not a failure.
 *
 * Not wrapped in `Card`: this sits inside a panel that is already inside a
 * `Sheet` (see `index.tsx`), and a `Card` here would double the border and
 * title bar. A top rule plays the same separating role `Block` plays between
 * sections below it.
 */
export function ReportPanel({ title, report }: { title: string; report: ImportReport }) {
  const hasCounters = !!report.counters && Object.keys(report.counters).length > 0
  const hasReasons = !!report.reasons && Object.keys(report.reasons).length > 0
  const hasSamples = !!report.samples && report.samples.length > 0

  return (
    <div role="status" aria-live="polite" className="mt-6 border-t border-rule pt-5">
      <Label>Reporte — {title}</Label>

      <div className="mt-3 grid gap-5 sm:grid-cols-2">
        <Stat value={integer(report.created)} label="Creados" />
        <Stat value={integer(report.skipped)} label="Descartados" />
      </div>

      {hasCounters ? (
        <Block label="Detalle">
          <LabeledCounts entries={report.counters!} labels={COUNTER_LABELS} warnKeys={AMBER_COUNTERS} />
        </Block>
      ) : null}

      {hasReasons ? (
        <Block label="Motivos de descarte">
          <LabeledCounts entries={report.reasons!} labels={REASON_LABELS} />
        </Block>
      ) : null}

      {hasSamples ? (
        <Block label="Ejemplos">
          <pre className="overflow-x-auto rounded-chip bg-sunken p-3 font-mono text-note leading-relaxed whitespace-pre-wrap text-ink-3">
            {report.samples!.join('\n')}
          </pre>
        </Block>
      ) : null}
    </div>
  )
}
