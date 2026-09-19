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
 * `Trip.departure`/`arrival`/`dispatchedAt`/`realDepartureAt`/`realArrivalAt`
 * (and every boletos sale/movement timestamp — see `~/server/tickets`) are real
 * instants, but shifted: the backend's `dateTimeTZ` helper adds 6h to the CSV's
 * naive local time before storing it (14:20 local becomes 20:20Z), and no column
 * is `@db.Timestamptz`. Reading the original wall clock back means subtracting
 * those 6h out — `LEGACY_OFFSET_HOURS`/`toLegacyLocal` below do that; pinning
 * `timeZone: 'UTC'` alone (this file's previous approach) prints the stored
 * value as-is, 6 hours late. Verified against the live data: `Trip.departure`'s
 * hour histogram peaks at 06:00-08:00 and 17:00-19:00 UTC (a bus schedule,
 * shifted); shifted back it peaks at 00:00-02:00 and 11:00-13:00 instead, and
 * the 7-day legacy export buckets into exactly 7 local days instead of 8 UTC
 * calendar-day buckets with a truncated first and last day.
 *
 * `dayLabel`/`dayLabelFull`/`monthLabel` below do NOT need this shift — they
 * format an already-resolved `YYYY-MM-DD` calendar-day string (built by
 * `~/server/trips`'s `toIsoDate`, itself corrected), never a raw stored
 * instant, so there is nothing left to shift. Only `time`/`legacyDateTime`
 * take a raw instant. `createdAt`/`updatedAt` on every OTHER model are real,
 * unshifted instants and keep using plain `dateTime`.
 */
export const LEGACY_OFFSET_HOURS = 6

/** Shifts a stored legacy instant back to the local wall clock it was built from. */
export function toLegacyLocal(value: Date): Date {
  return new Date(value.getTime() - LEGACY_OFFSET_HOURS * 3_600_000)
}

const TIME = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
})

const LEGACY_DATE_TIME = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
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

/** Wall-clock hour of a legacy schedule value, shifted back from storage —
 *  see the note above `LEGACY_OFFSET_HOURS`. */
export function time(value: string | Date | null | undefined): string {
  if (!value) return NO_DATA
  const d = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(d.getTime()) ? NO_DATA : TIME.format(toLegacyLocal(d))
}

/** Full date + time for a legacy-shifted instant (boletos sale/operation
 *  timestamps) — the `dateTime`-shaped counterpart to `time`. */
export function legacyDateTime(value: string | Date | null | undefined): string {
  if (!value) return NO_DATA
  const d = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(d.getTime()) ? NO_DATA : LEGACY_DATE_TIME.format(toLegacyLocal(d))
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

/** Size of a file staged for upload, before it goes anywhere. Base 1024. */
export function bytes(value: number): string {
  if (value < 1024) return `${INTEGER.format(value)} B`
  const kb = value / 1024
  // Compare the rounded value, not the raw one: a file at e.g. 1023.93 KB
  // rounds to 1024 and belongs in the MB branch, or it prints as "1,024 KB".
  if (Math.round(kb) < 1024) return `${INTEGER.format(Math.round(kb))} KB`
  return `${DECIMAL_1.format(kb / 1024)} MB`
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

/** `OrderType`. `SURCHARGE`/`REFUND` are not travel tickets but share the enum,
 *  so they need labels too or a recargo/devolución order prints its raw code. */
export const TICKET_TYPE_LABELS: Record<string, string> = {
  ONE_WAY: 'Sencillo',
  ROUND: 'Redondo',
  OPEN: 'Abierto',
  OPEN_ROUND: 'Abierto redondo',
  SURCHARGE: 'Recargo',
  REFUND: 'Devolución',
}

/** `TicketStatus` — `OrderItem.status`. */
export const TICKET_STATUS_LABELS: Record<string, string> = {
  PAID: 'Pagado',
  EXCHANGED: 'Canjeado',
  NOT_EXCHANGED: 'Sin canjear',
  TRAVELED: 'Viajó',
  NOT_TRAVELED: 'No viajó',
  CANCELED: 'Cancelado',
  APPROACHED: 'Presentado',
  EXPIRED: 'Vencido',
}

/** `PaymentMethod` — `Order.paymentMethod`. */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  MIT: 'Tarjeta (MIT)',
  MPAGO: 'Mercado Pago',
  STRIPE: 'Stripe',
  POINTS: 'Puntos',
  NO_CHARGE: 'Sin cargo',
}

/** A boleto's reconstructed "Tipo de operación" — see `~/server/tickets`'s
 *  `TicketOperation` for how it's derived; the CSV's own column doesn't
 *  survive the import as a stored field. */
export const TICKET_OPERATION_LABELS: Record<string, string> = {
  SALE: 'Venta',
  OPEN_SALE: 'Venta abierta',
  CHANGED: 'Cambio',
  EXCHANGED: 'Canje',
  CANCELED: 'Cancelación',
}

/** `OrderStatus`, read as a raw movement in `OrderItemStatusHistory.movementType`
 *  (a ticket's detail page shows these one by one) — NOT the same thing as
 *  `TICKET_OPERATION_LABELS` above, which is `TicketOperation`, this file's own
 *  5-value summary derived FROM a folio's movements. `Order.status` reuses this
 *  same `OrderStatus` enum too. */
export const ORDER_MOVEMENT_LABELS: Record<string, string> = {
  AWAITING_PAYMENT: 'Por pagar',
  PAID: 'Venta',
  CHANGED: 'Cambio',
  EXCHANGED: 'Canje',
  CANCELED: 'Cancelación',
  AWAITING_REFUND: 'Devolución pendiente',
  REFUNDED: 'Devolución',
  REFUND_FAILED: 'Devolución fallida',
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
