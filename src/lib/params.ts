/**
 * URL parameter validators.
 *
 * All view state lives in the URL: filters, sort, page and search. That way any
 * screen of the viewer can be pasted into a chat and the other person sees
 * exactly the same thing — which is what a migration viewer is for.
 *
 * Written by hand instead of using an external validator so the signature of
 * `validateSearch` stays exactly typed, with no extra dependencies.
 */

export function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function integerParam(
  value: unknown,
  fallback: number,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

export function bool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === '1') return true
  if (value === 'false' || value === '0') return false
  return fallback
}

/** Accepts `?x=a&x=b` and `?x=a,b`; always returns a clean, sorted list. */
export function list(value: unknown): Array<string> {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string' && value.length > 0
      ? value.split(',')
      : []
  const cleaned = raw
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0)
  return Array.from(new Set(cleaned)).sort()
}

export function oneOf<const T extends ReadonlyArray<string>>(
  value: unknown,
  options: T,
  fallback: T[number],
): T[number] {
  return typeof value === 'string' && (options as ReadonlyArray<string>).includes(value)
    ? (value as T[number])
    : fallback
}

/** A plain `YYYY-MM-DD` calendar date, or '' when absent/invalid. Corridas'
 *  day strip and `Trip.departure` both work in whole UTC calendar days —
 *  see `src/server/trips.ts`. */
export function isoDate(value: unknown): string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
}

export const DIRECTIONS = ['asc', 'desc'] as const
export type Direction = (typeof DIRECTIONS)[number]

export const PAGE_SIZES = [25, 50, 100] as const

export function pageSize(value: unknown): number {
  const n = integerParam(value, 25)
  return (PAGE_SIZES as ReadonlyArray<number>).includes(n) ? n : 25
}

/**
 * Drops from the search object everything that already is the default value, so
 * the URL only shows what the user changed.
 */
export function stripDefaults<T extends Record<string, unknown>>(
  search: T,
  defaults: Partial<T>,
): Partial<T> {
  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(search)) {
    const defaultValue = defaults[key as keyof T]
    const isEmpty =
      value === undefined ||
      value === '' ||
      (Array.isArray(value) && value.length === 0) ||
      (defaultValue !== undefined && JSON.stringify(value) === JSON.stringify(defaultValue))
    if (!isEmpty) output[key] = value
  }
  return output as Partial<T>
}

/** Safe range for Prisma's `skip`/`take`. */
export function range(page: number, perPage: number) {
  return { skip: Math.max(0, (page - 1) * perPage), take: perPage }
}

/**
 * Corrects the page when the filters leave fewer results than the requested
 * page: better the last page with data than a blank one.
 */
export function clampPage(page: number, total: number, perPage: number) {
  const lastPage = Math.max(1, Math.ceil(total / perPage))
  return Math.min(Math.max(1, page), lastPage)
}
