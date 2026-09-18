/**
 * Formateadores del manifiesto. Todo número que se imprima en una columna pasa por aquí
 * para que la cifra sea tabular y la unidad quede separada de la magnitud.
 */

const MONEDA = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const ENTERO = new Intl.NumberFormat('es-MX')

const DECIMAL_1 = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const FECHA = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const FECHA_HORA = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Marcador de dato ausente. Un guión largo, nunca una celda en blanco. */
export const SIN_DATO = '—'

export function moneda(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return SIN_DATO
  const n = typeof valor === 'string' ? Number(valor) : valor
  return Number.isFinite(n) ? MONEDA.format(n) : SIN_DATO
}

export function entero(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return SIN_DATO
  return ENTERO.format(valor)
}

export function minutos(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return SIN_DATO
  return `${ENTERO.format(valor)} min`
}

export function kilometros(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return SIN_DATO
  return `${DECIMAL_1.format(valor)} km`
}

export function porcentaje(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return SIN_DATO
  return `${ENTERO.format(valor)} %`
}

export function fecha(valor: string | Date | null | undefined): string {
  if (!valor) return SIN_DATO
  const d = typeof valor === 'string' ? new Date(valor) : valor
  return Number.isNaN(d.getTime()) ? SIN_DATO : FECHA.format(d)
}

export function fechaHora(valor: string | Date | null | undefined): string {
  if (!valor) return SIN_DATO
  const d = typeof valor === 'string' ? new Date(valor) : valor
  return Number.isNaN(d.getTime()) ? SIN_DATO : FECHA_HORA.format(d)
}

export function coordenada(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return SIN_DATO
  return valor.toFixed(6)
}

/** "6 tramos" / "1 tramo" — plural sin la muleta de "(s)". */
export function plural(cantidad: number, singular: string, pluralForma: string): string {
  return `${ENTERO.format(cantidad)} ${cantidad === 1 ? singular : pluralForma}`
}

export const TIPO_TERMINAL: Record<string, string> = {
  SALE: 'Venta',
  SCALE: 'Escala',
}

export const TIPO_RECAUDACION: Record<string, string> = {
  AUTOMATIC: 'Automática',
  NORMAL: 'Manual',
}

export const TIPO_BOLETO: Record<string, string> = {
  ONE_WAY: 'Sencillo',
  ROUND: 'Redondo',
  OPEN: 'Abierto',
  OPEN_ROUND: 'Abierto redondo',
}
