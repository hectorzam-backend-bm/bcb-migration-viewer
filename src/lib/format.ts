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
