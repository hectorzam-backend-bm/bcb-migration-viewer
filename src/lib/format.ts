/**
 * Manifest formatters. Every number printed in a column goes through here so that
 * the figure is tabular and the unit stays separated from the magnitude.
 */

const CURRENCY = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const INTEGER = new Intl.NumberFormat('es-MX')

const DECIMAL_1 = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const DATE = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const DATE_TIME = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/**
 * `Trip.departure`/`arrival`/`dispatchedAt`/`realDepartureAt`/`realArrivalAt` are
 * naked `DateTime` columns holding a schedule's wall-clock value, not an observed
 * instant — the `pg` driver parses them as UTC. Every trip-schedule formatter
 * pins `timeZone: 'UTC'`, or the viewer's runtime zone would shift 06:15 to
 * 00:15. `createdAt`/`updatedAt` are real instants and keep using `dateTime`.
 */
const TIME = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
})

const DAY_LABEL = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

const DAY_LABEL_FULL = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const MONTH_LABEL = new Intl.DateTimeFormat('es-MX', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/** Placeholder for missing data. An em dash, never a blank cell. */
export const NO_DATA = '—'

export function currency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return NO_DATA
  const n = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(n) ? CURRENCY.format(n) : NO_DATA
}

export function integer(value: number | null | undefined): string {
  if (value === null || value === undefined) return NO_DATA
  return INTEGER.format(value)
}

export function minutes(value: number | null | undefined): string {
  if (value === null || value === undefined) return NO_DATA
  return `${INTEGER.format(value)} min`
}

export function kilometers(value: number | null | undefined): string {
  if (value === null || value === undefined) return NO_DATA
  return `${DECIMAL_1.format(value)} km`
}

export function percent(value: number | null | undefined): string {
  if (value === null || value === undefined) return NO_DATA
  return `${INTEGER.format(value)} %`
}

export function date(value: string | Date | null | undefined): string {
  if (!value) return NO_DATA
  const d = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(d.getTime()) ? NO_DATA : DATE.format(d)
}

export function dateTime(value: string | Date | null | undefined): string {
  if (!value) return NO_DATA
  const d = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(d.getTime()) ? NO_DATA : DATE_TIME.format(d)
}

/** Wall-clock hour of a trip schedule value, pinned to UTC — see the note above. */
export function time(value: string | Date | null | undefined): string {
  if (!value) return NO_DATA
  const d = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(d.getTime()) ? NO_DATA : TIME.format(d)
}

/** Day-strip chip label for a plain `YYYY-MM-DD` calendar date, e.g. "18 ago". */
export function dayLabel(value: string): string {
  return DAY_LABEL.format(new Date(`${value}T00:00:00Z`))
}

/** Full date for headers and breadcrumbs, e.g. "18 de agosto de 2026". */
export function dayLabelFull(value: string): string {
  return DAY_LABEL_FULL.format(new Date(`${value}T00:00:00Z`))
}

/** Month heading for the day strip, e.g. "agosto 2026". */
export function monthLabel(value: string): string {
  return MONTH_LABEL.format(new Date(`${value}T00:00:00Z`))
}

export function coordinate(value: number | null | undefined): string {
  if (value === null || value === undefined) return NO_DATA
  return value.toFixed(6)
}

/** "6 tramos" / "1 tramo" — plural without the "(s)" crutch. */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${INTEGER.format(count)} ${count === 1 ? singular : pluralForm}`
}

export const STATION_TYPE_LABELS: Record<string, string> = {
  SALE: 'Venta',
  SCALE: 'Escala',
}

export const COLLECTION_TYPE_LABELS: Record<string, string> = {
  AUTOMATIC: 'Automática',
  NORMAL: 'Manual',
}

export const TICKET_TYPE_LABELS: Record<string, string> = {
  ONE_WAY: 'Sencillo',
  ROUND: 'Redondo',
  OPEN: 'Abierto',
  OPEN_ROUND: 'Abierto redondo',
}

export const TRIP_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Abierta',
  CLOSED: 'Cerrada',
  CANCELLED: 'Cancelada',
  FINISHED: 'Finalizada',
  DISPATCHED: 'Despachada',
  CONFIRMED: 'Confirmada',
  CANCELLED_BY_GROUP: 'Cancelada por grupo',
}

export const TRIP_TYPE_LABELS: Record<string, string> = {
  NORMAL: 'Normal',
  EXTRA: 'Extra',
}
