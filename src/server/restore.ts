import { createServerFn } from '@tanstack/react-start'
import { db, dbWrite, describeFailure } from './db'
import type { ImportReport } from './seeds'

/**
 * `/importar`'s restore step for the four tables `POST /seeds/clean` deletes
 * but no backend endpoint can recreate — see `db.ts`'s file header for why
 * `dbWrite` exists. This is the only module in the viewer that imports it;
 * every other write in the app goes through `seeds.ts`'s HTTP proxy instead.
 *
 * The four JSON files in `src/assets/` are raw table dumps taken before a
 * `/seeds/clean` wiped the live DB. Verified against the live DB (2026-09-19):
 * every id already matches a current row (upsert-by-id is a safe no-op today,
 * and a full create after a real clean), every `createdById`/`updatedById` is
 * dangling (written as null below), and `Service.paymentGatewayAccountId` in
 * the dump is not a column in this schema revision — fields are mapped
 * explicitly per table, never spread from the raw row.
 *
 * No `$transaction` wraps the per-row loops on purpose: Postgres aborts an
 * entire transaction after the first failed statement inside it, which would
 * turn "skip this one bad row" into "every row after it fails too". Skipping
 * a row that already exists under a different id — the actual failure mode
 * here — is more useful than all-or-nothing atomicity for a restore.
 */

// Same dynamic-import trick as `db.ts`: `src/server/` is pulled into the client
// graph in dev (Vite needs it to resolve server-function RPC calls), so a
// static `import companies from '~/assets/Company.json'` would ship all four
// dumps to the browser. `resolveJsonModule` types each `.default` from the
// file's actual contents, so the row shapes below need no hand-written type.
const assets = import.meta.env.SSR
  ? {
      companies: (await import('~/assets/Company.json')).default,
      services: (await import('~/assets/Service.json')).default,
      units: (await import('~/assets/Unit.json')).default,
      unitDecks: (await import('~/assets/UnitDeck.json')).default,
    }
  : null

function requireAssets() {
  if (!assets) {
    throw new Error(
      'src/server/restore.ts was evaluated in the browser: check who imported it.',
    )
  }
  return assets
}

/** The dumps store `"2026-06-30 17:19:48.758"` — Postgres's default text
 *  output, not ISO. Swapping the space for a `T` is the only fix needed.
 *  Returns `undefined` (field omitted from the write) on anything else, so
 *  the column's own schema default applies instead of a bad Date. */
function parseDumpDate(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined
  const d = new Date(value.replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? undefined : d
}

const UNIT_TYPES = new Set(['BUS', 'MICROBUS', 'VAN'])
/** Plain string union, not an import of the generated `$Enums.UnitType` — that
 *  import would pull the same client code the SSR guard above exists to keep
 *  out of the browser. Structurally identical, so Prisma accepts it as-is. */
function unitType(value: string): 'BUS' | 'MICROBUS' | 'VAN' {
  return UNIT_TYPES.has(value) ? (value as 'BUS' | 'MICROBUS' | 'VAN') : 'BUS'
}

/** Duck-types a Prisma `PrismaClientKnownRequestError` without importing the
 *  class (same reasoning as `unitType` above). P2002 = unique constraint,
 *  P2003 = foreign key constraint failed. */
function prismaErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code
  }
  return undefined
}

type Failure = ReturnType<typeof describeFailure>
type RestoreResponse = { ok: true; report: ImportReport } | { ok: false; failure: Failure }

/**
 * Upserts each row by id, classifying every outcome instead of throwing:
 * `created` / `updated` from a successful write, or a named `reason` (via
 * `describeError`) from a caught Prisma error. An error `describeError`
 * doesn't recognize is rethrown — an unknown failure should still surface,
 * not be counted as a silent skip.
 */
async function upsertRows<T>(
  rows: ReadonlyArray<T>,
  run: (row: T) => Promise<'created' | 'updated'>,
  describeError: (error: unknown) => string | undefined,
  sampleLabel: (row: T) => string,
): Promise<{
  created: number
  updated: number
  skipped: number
  reasons: Record<string, number>
  samples: Array<string>
}> {
  let created = 0
  let updated = 0
  let skipped = 0
  const reasons: Record<string, number> = {}
  const samples: Array<string> = []
  for (const row of rows) {
    try {
      if ((await run(row)) === 'created') created++
      else updated++
    } catch (error) {
      const reason = describeError(error)
      if (!reason) throw error
      skipped++
      reasons[reason] = (reasons[reason] ?? 0) + 1
      if (samples.length < 10) samples.push(`${reason}: ${sampleLabel(row)}`)
    }
  }
  return { created, updated, skipped, reasons, samples }
}

function mergeReasons(...maps: Array<Record<string, number>>): Record<string, number> | undefined {
  const merged: Record<string, number> = {}
  for (const map of maps) {
    for (const [key, count] of Object.entries(map)) merged[key] = (merged[key] ?? 0) + count
  }
  return Object.keys(merged).length ? merged : undefined
}

/* ── Empresas y servicios ─────────────────────────────────────────────────
   Company.json (32 rows) then Service.json (15) — companies first, since
   every service's companyId resolves inside Company.json. */

export const restoreCatalog = createServerFn({ method: 'POST' }).handler(
  async (): Promise<RestoreResponse> => {
    try {
      const { companies, services } = requireAssets()

      const existingCompanyIds = new Set(
        (await db.company.findMany({ select: { id: true } })).map((r) => r.id),
      )
      const companyResult = await upsertRows(
        companies,
        async (row) => {
          const isUpdate = existingCompanyIds.has(row.id)
          const data = {
            key: row.key,
            shortName: row.shortName,
            tradeName: row.tradeName,
            legalName: row.legalName,
            isActive: row.isActive,
            deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
            hcmDisabled: row.hcmDisabled ?? false,
            hcmLastSeenRunId: row.hcmLastSeenRunId ?? null,
            createdById: null,
            updatedById: null,
            createdAt: parseDumpDate(row.createdAt),
            updatedAt: parseDumpDate(row.updatedAt),
          }
          await dbWrite.company.upsert({ where: { id: row.id }, create: { id: row.id, ...data }, update: data })
          return isUpdate ? 'updated' : 'created'
        },
        (error) => (prismaErrorCode(error) === 'P2002' ? 'ALREADY_EXISTS_WITH_OTHER_ID' : undefined),
        (row) => row.key,
      )

      const existingServiceIds = new Set(
        (await db.service.findMany({ select: { id: true } })).map((r) => r.id),
      )
      const serviceResult = await upsertRows(
        services,
        async (row) => {
          const isUpdate = existingServiceIds.has(row.id)
          const data = {
            key: row.key,
            shortName: row.shortName,
            fullName: row.fullName,
            number: row.number,
            account: row.account ?? null,
            isActive: row.isActive,
            allowEarlyDispatch: row.allowEarlyDispatch ?? false,
            deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
            hcmDisabled: row.hcmDisabled ?? false,
            hcmLastSeenRunId: row.hcmLastSeenRunId ?? null,
            companyId: row.companyId,
            createdById: null,
            updatedById: null,
            createdAt: parseDumpDate(row.createdAt),
            updatedAt: parseDumpDate(row.updatedAt),
          }
          await dbWrite.service.upsert({ where: { id: row.id }, create: { id: row.id, ...data }, update: data })
          return isUpdate ? 'updated' : 'created'
        },
        (error) => {
          const code = prismaErrorCode(error)
          if (code === 'P2002') return 'ALREADY_EXISTS_WITH_OTHER_ID'
          if (code === 'P2003') return 'COMPANY_NOT_FOUND'
          return undefined
        },
        (row) => row.key,
      )

      const samples = [...companyResult.samples, ...serviceResult.samples].slice(0, 10)
      return {
        ok: true,
        report: {
          created: companyResult.created + serviceResult.created,
          skipped: companyResult.skipped + serviceResult.skipped,
          counters: { companiesUpdated: companyResult.updated, servicesUpdated: serviceResult.updated },
          reasons: mergeReasons(companyResult.reasons, serviceResult.reasons),
          samples: samples.length ? samples : undefined,
        },
      }
    } catch (error) {
      console.error('[restore-catalog]', error)
      return { ok: false, failure: describeFailure(error) }
    }
  },
)

/* ── Unidades ─────────────────────────────────────────────────────────────
   Unit.json (16) -> placeholder File per deck layout -> UnitDeck.json (17).
   UnitDeck.layoutFileId is NOT NULL and every id in the dump is dangling (no
   matching File row survives a clean), so a deck can't insert without one;
   the placeholder mirrors the backend's own passenger-type icon convention
   (`seeds/passenger-types/*.svg`, 1-byte, a fake `placeholder.bcb.internal`
   URL) instead of inventing a new one. verticalLayoutFileId is optional and
   its 17 referenced ids are just as dangling, so it's written as null rather
   than doubling the placeholder count for a deck feature nothing here uses. */

export const restoreUnits = createServerFn({ method: 'POST' }).handler(
  async (): Promise<RestoreResponse> => {
    try {
      const { units, unitDecks } = requireAssets()

      const existingUnitIds = new Set((await db.unit.findMany({ select: { id: true } })).map((r) => r.id))
      const unitResult = await upsertRows(
        units,
        async (row) => {
          const isUpdate = existingUnitIds.has(row.id)
          const data = {
            name: row.name,
            description: row.description ?? null,
            number: row.number,
            type: unitType(row.type),
            bathroomSide: row.bathroomSide ?? null,
            deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
            createdById: null,
            updatedById: null,
            createdAt: parseDumpDate(row.createdAt),
            updatedAt: parseDumpDate(row.updatedAt),
          }
          await dbWrite.unit.upsert({ where: { id: row.id }, create: { id: row.id, ...data }, update: data })
          return isUpdate ? 'updated' : 'created'
        },
        (error) => (prismaErrorCode(error) === 'P2002' ? 'ALREADY_EXISTS_WITH_OTHER_ID' : undefined),
        (row) => row.name,
      )

      const existingFileIds = new Set(
        (
          await db.file.findMany({
            where: { id: { in: unitDecks.map((d) => d.layoutFileId) } },
            select: { id: true },
          })
        ).map((f) => f.id),
      )
      let placeholderFilesCreated = 0
      for (const deck of unitDecks) {
        if (existingFileIds.has(deck.layoutFileId)) continue
        await dbWrite.file.create({
          data: {
            id: deck.layoutFileId,
            name: `unit-deck-${deck.order}.svg`,
            path: `seeds/unit-decks/${deck.layoutFileId}.svg`,
            url: `https://placeholder.bcb.internal/unit-decks/${deck.layoutFileId}.svg`,
            mimetype: 'image/svg+xml',
            size: 1,
          },
        })
        placeholderFilesCreated++
      }

      const existingDeckIds = new Set(
        (await db.unitDeck.findMany({ select: { id: true } })).map((r) => r.id),
      )
      const deckResult = await upsertRows(
        unitDecks,
        async (row) => {
          const isUpdate = existingDeckIds.has(row.id)
          const data = {
            order: row.order,
            capacity: row.capacity,
            unitId: row.unitId,
            layoutFileId: row.layoutFileId,
            verticalLayoutFileId: null,
            createdAt: parseDumpDate(row.createdAt),
            updatedAt: parseDumpDate(row.updatedAt),
          }
          await dbWrite.unitDeck.upsert({ where: { id: row.id }, create: { id: row.id, ...data }, update: data })
          return isUpdate ? 'updated' : 'created'
        },
        (error) => {
          const code = prismaErrorCode(error)
          if (code === 'P2002') return 'ALREADY_EXISTS_WITH_OTHER_ID'
          if (code === 'P2003') return 'UNIT_NOT_FOUND'
          return undefined
        },
        (row) => `orden ${row.order}`,
      )

      const samples = [...unitResult.samples, ...deckResult.samples].slice(0, 10)
      return {
        ok: true,
        report: {
          created: unitResult.created + deckResult.created,
          skipped: unitResult.skipped + deckResult.skipped,
          counters: {
            unitsUpdated: unitResult.updated,
            decksUpdated: deckResult.updated,
            placeholderFilesCreated,
          },
          reasons: mergeReasons(unitResult.reasons, deckResult.reasons),
          samples: samples.length ? samples : undefined,
        },
      }
    } catch (error) {
      console.error('[restore-units]', error)
      return { ok: false, failure: describeFailure(error) }
    }
  },
)

/* ── Asignación de unidad ─────────────────────────────────────────────────
   Optional, opt-in: restoring units does not assign them to anything, so
   without this the trips gate would stay blocked at 0 assigned. One update,
   one unit, every route that currently lacks one — a migration shortcut the
   panel must say plainly it is, not a business decision this tool is making
   quietly. */

export const assignUnitToRoutes = createServerFn({ method: 'POST' })
  .validator((data: { unitId: string }) => data)
  .handler(async ({ data }): Promise<RestoreResponse> => {
    if (!data.unitId) {
      return {
        ok: false,
        failure: { title: 'Falta elegir una unidad', detail: '', suggestion: 'Elige una unidad de la lista.' },
      }
    }
    try {
      const result = await dbWrite.route.updateMany({
        where: { unitId: null, deletedAt: null },
        data: { unitId: data.unitId },
      })
      return { ok: true, report: { created: 0, skipped: 0, counters: { routesAssigned: result.count } } }
    } catch (error) {
      console.error('[assign-unit]', error)
      return { ok: false, failure: describeFailure(error) }
    }
  })
