import { createServerFn } from '@tanstack/react-start'
import { db, describeFailure } from './db'

/**
 * `/importar`'s CSV steps: every write here is a proxy to the `/seeds/*`
 * endpoints of the BCB_EstrellaRoja_Backend API (unauthenticated, local-only
 * by design), never a direct database write — the read-only lock in `./db.ts`
 * is untouched, every query below is a `count()` or a `findMany` select. The
 * wizard's JSON restore step (companies, services, units — `restore.ts`) is
 * the one exception to that, for tables `/seeds/clean` deletes with no API
 * able to bring them back; see that file's header.
 *
 * Order is enforced by the backend, not here: `clean -> stations -> routes ->
 * segments -> tariffs -> trips`. Each `import/*` call expects specific
 * multipart field names (`FileFieldsInterceptor` in the API's controller) —
 * see `IMPORT_STEPS` below, which is the single source of truth for them.
 */

type Failure = ReturnType<typeof describeFailure>

// `clean` and `trips` can run for minutes against a large legacy export. This
// alone does not raise Node's own ceiling — undici defaults `headersTimeout`/
// `bodyTimeout` to 300 s, and there is no supported way to override that
// without a custom `dispatcher` (an `undici` dependency this local tool
// doesn't otherwise need) — but it is a safety net for whatever case that
// ceiling doesn't cover. Either way, `networkFailure` below turns a cutoff
// into an honest message: every import is idempotent, so re-running the step
// after a timeout is always safe.
const TIMEOUT_MS = 15 * 60_000

const IMPORT_STEPS = {
  stations: { path: '/seeds/import/stations', fields: ['stations', 'routes', 'segments'] },
  routes: { path: '/seeds/import/routes', fields: ['routes', 'services'] },
  segments: { path: '/seeds/import/segments', fields: ['segments', 'routes'] },
  tariffs: { path: '/seeds/import/tariffs', fields: ['tariffs'] },
  trips: { path: '/seeds/import/trips', fields: ['corridas', 'limits'] },
} as const satisfies Record<string, { path: string; fields: ReadonlyArray<string> }>

export type ImportStep = keyof typeof IMPORT_STEPS

/** Spanish hints for the `errors.SEEDS.*` i18n keys the API can return on a 400
 *  (see `ValidationErrorBuilder` in the backend). Unknown codes fall back to a
 *  generic hint instead of disappearing. */
const API_ERROR_HINTS: Record<string, string> = {
  'errors.SEEDS.NO_STATES_FOUND':
    'No hay estados en la base. El paso de Terminales los necesita para resolver cada una a CDMX o Puebla.',
  'errors.SEEDS.NO_STATIONS_IMPORTED':
    'Todavía no hay terminales importadas — sube primero el paso "Terminales".',
  'errors.SEEDS.NO_ROUTES_IMPORTED':
    'Todavía no hay rutas importadas — sube primero el paso "Rutas".',
  'errors.SEEDS.FILE_REQUIRED': 'Falta un archivo en la solicitud.',
}

function missingUrlFailure(): Failure {
  return {
    title: 'Falta SEEDS_API_URL',
    detail: '',
    suggestion:
      'Copia .env.example a .env y define SEEDS_API_URL con la URL del backend local (por defecto http://localhost:3000).',
  }
}

function networkFailure(error: unknown): Failure {
  const name =
    typeof error === 'object' && error !== null && 'name' in error
      ? String((error as { name: unknown }).name)
      : ''
  const message = error instanceof Error ? error.message : String(error)

  // `name === 'TimeoutError'` is our own `AbortSignal.timeout` firing; the
  // `UND_ERR_*` codes are undici's own 300 s default (headers/body), which fires
  // regardless of that signal — the realistic case for `clean` and `trips`.
  const cause = error instanceof Error ? (error.cause as { code?: unknown } | undefined) : undefined
  if (name === 'TimeoutError' || cause?.code === 'UND_ERR_HEADERS_TIMEOUT' || cause?.code === 'UND_ERR_BODY_TIMEOUT') {
    return {
      title: 'El API tardó demasiado en responder',
      detail: message,
      suggestion:
        'El import puede seguir corriendo del lado del backend — revisa sus logs. Es seguro repetir el paso.',
    }
  }
  if (/ECONNREFUSED|fetch failed|ENOTFOUND|EAI_AGAIN/i.test(message)) {
    return {
      title: 'No hay respuesta del API de importación',
      detail: message,
      suggestion: `Verifica que el backend esté corriendo en ${process.env.SEEDS_API_URL ?? 'SEEDS_API_URL'}.`,
    }
  }
  return { title: 'Error al conectar con el API', detail: message, suggestion: '' }
}

/** First message of a Nest 400 body: `{ errors: [{ property, message: string[] }] }` —
 *  see `ValidationErrorBuilder.build()` in the backend. */
function firstApiMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object' || !('errors' in body)) return null
  const errors = (body as { errors: unknown }).errors
  if (!Array.isArray(errors)) return null
  const first: unknown = errors[0]
  if (!first || typeof first !== 'object' || !('message' in first)) return null
  const message = (first as { message: unknown }).message
  if (Array.isArray(message)) return typeof message[0] === 'string' ? message[0] : null
  return typeof message === 'string' ? message : null
}

async function apiFailure(response: Response): Promise<Failure> {
  const text = await response.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    // The API always answers JSON; if it didn't, the raw text becomes the detail.
  }
  const code = firstApiMessage(body)
  return {
    title: `El API rechazó la solicitud (${response.status})`,
    detail: code ?? text.slice(0, 2000),
    suggestion:
      (code && API_ERROR_HINTS[code]) ??
      'Revisa el orden de los pasos: cada uno depende de que el anterior haya cargado datos.',
  }
}

/* ── Estado ───────────────────────────────────────────────────────────────
   Everything the 7 step cards need, in one read. All read-only counts —
   the write lock in `./db.ts` never sees anything but `count()` here. */

export type ImportStatus = {
  states: number
  companies: number
  services: number
  stations: number
  routes: number
  segments: number
  /** The gate for the trips step. */
  routesWithoutUnit: number
  units: number
  unitDecks: number
  /** For the units step's assign picker — active units only, capacity summed
   *  across decks (a double-decker unit has more than one). */
  unitOptions: Array<{ id: string; name: string; capacity: number }>
  routesWithTariff: number
  segmentsWithTariff: number
  trips: number
  tripSeats: number
  operators: number
  buses: number
}

export type StatusResponse = { ok: true; status: ImportStatus } | { ok: false; failure: Failure }

export const getImportStatus = createServerFn({ method: 'GET' }).handler(
  async (): Promise<StatusResponse> => {
    try {
      const [
        states,
        companies,
        services,
        stations,
        routes,
        segments,
        routesWithoutUnit,
        units,
        unitDecks,
        unitRows,
        routesWithTariff,
        segmentsWithTariff,
        trips,
        tripSeats,
        operators,
        buses,
      ] = await Promise.all([
        db.state.count(),
        db.company.count({ where: { deletedAt: null } }),
        db.service.count({ where: { deletedAt: null } }),
        db.station.count({ where: { deletedAt: null } }),
        db.route.count({ where: { deletedAt: null } }),
        db.segment.count({ where: { deletedAt: null } }),
        db.route.count({ where: { deletedAt: null, unitId: null } }),
        db.unit.count({ where: { deletedAt: null } }),
        db.unitDeck.count(),
        db.unit.findMany({
          where: { deletedAt: null },
          select: { id: true, name: true, decks: { select: { capacity: true } } },
          orderBy: { name: 'asc' },
        }),
        db.route.count({ where: { deletedAt: null, priceOneWay: { gt: 0 } } }),
        db.segment.count({ where: { deletedAt: null, priceOneWay: { gt: 0 } } }),
        db.trip.count({ where: { deletedAt: null } }),
        db.tripSeat.count(),
        db.operator.count(),
        db.bus.count({ where: { deletedAt: null } }),
      ])
      const unitOptions = unitRows.map((u) => ({
        id: u.id,
        name: u.name,
        capacity: u.decks.reduce((sum, d) => sum + d.capacity, 0),
      }))
      return {
        ok: true,
        status: {
          states,
          companies,
          services,
          stations,
          routes,
          segments,
          routesWithoutUnit,
          units,
          unitDecks,
          unitOptions,
          routesWithTariff,
          segmentsWithTariff,
          trips,
          tripSeats,
          operators,
          buses,
        },
      }
    } catch (error) {
      console.error('[import-status]', error)
      return { ok: false, failure: describeFailure(error) }
    }
  },
)

/* ── Importación ──────────────────────────────────────────────────────────
   One CSV upload -> one `/seeds/import/*` call -> its `ImportReport`. */

export type ImportReport = {
  created: number
  skipped: number
  counters?: Record<string, number>
  reasons?: Record<string, number>
  samples?: Array<string>
}

export type ImportResponse = { ok: true; report: ImportReport } | { ok: false; failure: Failure }

function isImportReport(body: unknown): body is ImportReport {
  return (
    !!body &&
    typeof body === 'object' &&
    typeof (body as { created?: unknown }).created === 'number' &&
    typeof (body as { skipped?: unknown }).skipped === 'number'
  )
}

/**
 * Forwards a CSV to its `/seeds/import/*` endpoint. The client only sends a
 * KEY (`step`) — it never chooses the destination URL — and only the fields
 * that step declares are forwarded; everything else in the incoming
 * `FormData` (including `step` itself) is dropped here.
 */
export const runImport = createServerFn({ method: 'POST' })
  .validator((data: FormData) => data)
  .handler(async ({ data }): Promise<ImportResponse> => {
    const step = data.get('step')
    if (typeof step !== 'string' || !(step in IMPORT_STEPS)) {
      return {
        ok: false,
        failure: { title: 'Paso de importación desconocido', detail: String(step), suggestion: '' },
      }
    }
    if (!process.env.SEEDS_API_URL) {
      return { ok: false, failure: missingUrlFailure() }
    }

    const { path, fields } = IMPORT_STEPS[step as ImportStep]
    const forwarded = new FormData()
    for (const field of fields) {
      const file = data.get(field)
      if (!(file instanceof File)) {
        return {
          ok: false,
          failure: {
            title: 'Falta un archivo',
            detail: field,
            suggestion: `Suelta el archivo de "${field}" antes de continuar.`,
          },
        }
      }
      forwarded.append(field, file, file.name)
    }

    try {
      const response = await fetch(new URL(path, process.env.SEEDS_API_URL), {
        method: 'POST',
        body: forwarded,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!response.ok) return { ok: false, failure: await apiFailure(response) }

      const body: unknown = await response.json().catch(() => null)
      if (!isImportReport(body)) {
        return {
          ok: false,
          failure: {
            title: 'Respuesta inesperada del API',
            detail: JSON.stringify(body),
            suggestion: '',
          },
        }
      }
      return { ok: true, report: body }
    } catch (error) {
      return { ok: false, failure: networkFailure(error) }
    }
  })

/* ── Limpieza ─────────────────────────────────────────────────────────────
   `POST /seeds/clean` — no files, no report, just a message. Kept separate
   from `runImport` because its shape and its risk (it is destructive) are
   both different. */

export type CleanResponse = { ok: true; message: string } | { ok: false; failure: Failure }

export const cleanDatabase = createServerFn({ method: 'POST' }).handler(
  async (): Promise<CleanResponse> => {
    if (!process.env.SEEDS_API_URL) {
      return { ok: false, failure: missingUrlFailure() }
    }
    try {
      const response = await fetch(new URL('/seeds/clean', process.env.SEEDS_API_URL), {
        method: 'POST',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!response.ok) return { ok: false, failure: await apiFailure(response) }

      const body: unknown = await response.json().catch(() => null)
      const message =
        body && typeof body === 'object' && typeof (body as { message?: unknown }).message === 'string'
          ? (body as { message: string }).message
          : 'Base limpiada.'
      return { ok: true, message }
    } catch (error) {
      return { ok: false, failure: networkFailure(error) }
    }
  },
)
