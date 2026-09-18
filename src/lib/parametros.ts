/**
 * Validadores de parámetros de URL.
 *
 * Todo el estado de las vistas vive en la dirección: filtros, orden, página y
 * búsqueda. Así cualquier pantalla del visor se puede pegar en un chat y el otro
 * ve exactamente lo mismo — que es para lo que sirve un visor de migración.
 *
 * Se escriben a mano en vez de usar un validador externo para que la firma de
 * `validateSearch` quede exactamente tipada, sin dependencias extra.
 */

export function texto(valor: unknown, porDefecto = ''): string {
  return typeof valor === 'string' ? valor : porDefecto
}

export function entero(
  valor: unknown,
  porDefecto: number,
  minimo = Number.MIN_SAFE_INTEGER,
  maximo = Number.MAX_SAFE_INTEGER,
): number {
  const n = typeof valor === 'number' ? valor : Number(valor)
  if (!Number.isFinite(n)) return porDefecto
  return Math.min(maximo, Math.max(minimo, Math.trunc(n)))
}

export function booleano(valor: unknown, porDefecto = false): boolean {
  if (typeof valor === 'boolean') return valor
  if (valor === 'true' || valor === '1') return true
  if (valor === 'false' || valor === '0') return false
  return porDefecto
}

/** Acepta `?x=a&x=b` y `?x=a,b`; devuelve siempre una lista limpia y ordenada. */
export function lista(valor: unknown): Array<string> {
  const crudo = Array.isArray(valor)
    ? valor
    : typeof valor === 'string' && valor.length > 0
      ? valor.split(',')
      : []
  const limpio = crudo
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0)
  return Array.from(new Set(limpio)).sort()
}

export function unoDe<const T extends ReadonlyArray<string>>(
  valor: unknown,
  opciones: T,
  porDefecto: T[number],
): T[number] {
  return typeof valor === 'string' && (opciones as ReadonlyArray<string>).includes(valor)
    ? (valor as T[number])
    : porDefecto
}

export const DIRECCIONES = ['asc', 'desc'] as const
export type Direccion = (typeof DIRECCIONES)[number]

export const TAMANOS = [25, 50, 100] as const

export function tamanoDePagina(valor: unknown): number {
  const n = entero(valor, 25)
  return (TAMANOS as ReadonlyArray<number>).includes(n) ? n : 25
}

/**
 * Quita del objeto de búsqueda todo lo que ya es el valor por omisión, para que
 * la URL sólo muestre lo que el usuario cambió.
 */
export function limpiarBusqueda<T extends Record<string, unknown>>(
  busqueda: T,
  porDefecto: Partial<T>,
): Partial<T> {
  const salida: Record<string, unknown> = {}
  for (const [llave, valor] of Object.entries(busqueda)) {
    const omision = porDefecto[llave as keyof T]
    const vacio =
      valor === undefined ||
      valor === '' ||
      (Array.isArray(valor) && valor.length === 0) ||
      (omision !== undefined && JSON.stringify(valor) === JSON.stringify(omision))
    if (!vacio) salida[llave] = valor
  }
  return salida as Partial<T>
}

/** Rango seguro para `skip`/`take` de Prisma. */
export function rango(pagina: number, porPagina: number) {
  return { skip: Math.max(0, (pagina - 1) * porPagina), take: porPagina }
}

/**
 * Corrige la página cuando los filtros dejan menos resultados que la página
 * pedida: mejor la última hoja con datos que una hoja en blanco.
 */
export function paginaValida(pagina: number, total: number, porPagina: number) {
  const ultimas = Math.max(1, Math.ceil(total / porPagina))
  return Math.min(Math.max(1, pagina), ultimas)
}
