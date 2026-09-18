import { createServerFn } from '@tanstack/react-start'
import { clampPage, range } from '~/lib/params'
import { db, describeFailure } from './db'

/* ───────────────────────────────────────────────────────────────────────────
   Companies — read-only queries.

   Nothing that comes out of here is a Prisma object: every `select` is
   explicit and every date is serialized with `.toISOString()` before crossing
   the server boundary. Company has no Decimal columns, but the rule stays the
   same so the contract is uniform across the whole viewer.
   ─────────────────────────────────────────────────────────────────────────── */

export const COMPANY_SORTS = [
  'key',
  'shortName',
  'tradeName',
  'services',
  'createdAt',
] as const
export type CompanySort = (typeof COMPANY_SORTS)[number]

export const COMPANY_STATUSES = ['active', 'inactive'] as const
export type CompanyStatus = (typeof COMPANY_STATUSES)[number]

/** Record source: the HCM sync brought it in or someone captured it via CRUD. */
export const COMPANY_SOURCES = ['hcm', 'manual'] as const
export type CompanySource = (typeof COMPANY_SOURCES)[number]

export type CompanySearch = {
  q: string
  page: number
  perPage: number
  sort: CompanySort
  dir: 'asc' | 'desc'
  status: Array<CompanyStatus>
  source: Array<CompanySource>
  deleted: boolean
}

export type Failure = ReturnType<typeof describeFailure>

export type CompanyRow = {
  id: string
  key: string
  shortName: string
  tradeName: string
  legalName: string
  isActive: boolean
  isDeleted: boolean
  /** HCM reported the company as missing or inactive. Purely informational. */
  hcmDisabled: boolean
  /** Managed by the HCM sync (hcmLastSeenRunId != null), not by the CRUD. */
  syncedByHcm: boolean
  services: number
  createdAt: string
}

export type CompaniesResponse =
  | { ok: true; rows: Array<CompanyRow>; total: number; page: number }
  | { ok: false; failure: Failure }

function buildWhere(data: CompanySearch) {
  const q = data.q.trim()

  // With both options checked (or neither) the filter discriminates nothing.
  const activeOnly =
    data.status.length === 1 ? data.status[0] === 'active' : undefined
  const hcmOnly = data.source.length === 1 ? data.source[0] === 'hcm' : undefined

  return {
    ...(data.deleted ? {} : { deletedAt: null }),
    ...(activeOnly === undefined ? {} : { isActive: activeOnly }),
    ...(hcmOnly === undefined
      ? {}
      : { hcmLastSeenRunId: hcmOnly ? { not: null } : null }),
    ...(q
      ? {
          OR: [
            { key: { contains: q, mode: 'insensitive' as const } },
            { shortName: { contains: q, mode: 'insensitive' as const } },
            { tradeName: { contains: q, mode: 'insensitive' as const } },
            { legalName: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }
}

function buildOrderBy(sort: CompanySort, dir: 'asc' | 'desc') {
  switch (sort) {
    case 'shortName':
      return { shortName: dir }
    case 'tradeName':
      return { tradeName: dir }
    case 'services':
      return { services: { _count: dir } }
    case 'createdAt':
      return { createdAt: dir }
    default:
      return { key: dir }
  }
}

/** `as const` on purpose: it keeps the `true` literals so Prisma infers the
    exact shape of the result and not a generic record. */
function listSelect(includeDeleted: boolean) {
  return {
    id: true,
    key: true,
    shortName: true,
    tradeName: true,
    legalName: true,
    isActive: true,
    deletedAt: true,
    createdAt: true,
    hcmDisabled: true,
    hcmLastSeenRunId: true,
    _count: {
      select: { services: { where: { deletedAt: includeDeleted ? undefined : null } } },
    },
  } as const
}

type RawListRow = {
  id: string
  key: string
  shortName: string
  tradeName: string
  legalName: string
  isActive: boolean
  deletedAt: Date | null
  createdAt: Date
  hcmDisabled: boolean
  hcmLastSeenRunId: string | null
  _count: { services: number }
}

function toRow(c: RawListRow): CompanyRow {
  return {
    id: c.id,
    key: c.key,
    shortName: c.shortName,
    tradeName: c.tradeName,
    legalName: c.legalName,
    isActive: c.isActive,
    isDeleted: c.deletedAt !== null,
    hcmDisabled: c.hcmDisabled,
    syncedByHcm: c.hcmLastSeenRunId !== null,
    services: c._count.services,
    createdAt: c.createdAt.toISOString(),
  }
}

export const listCompanies = createServerFn({ method: 'GET' })
  .inputValidator((input: CompanySearch) => input)
  .handler(async ({ data }): Promise<CompaniesResponse> => {
    try {
      const where = buildWhere(data)
      const orderBy = buildOrderBy(data.sort, data.dir)
      const select = listSelect(data.deleted)

      const [rawRows, total] = await Promise.all([
        db.company.findMany({
          where,
          orderBy,
          select,
          ...range(data.page, data.perPage),
        }),
        db.company.count({ where }),
      ])

      // Filters can leave fewer pages than the URL asked for: better the last
      // page with data than a blank one.
      const corrected = clampPage(data.page, total, data.perPage)
      if (rawRows.length === 0 && total > 0 && corrected !== data.page) {
        const fallback = await db.company.findMany({
          where,
          orderBy,
          select,
          ...range(corrected, data.perPage),
        })
        return { ok: true, page: corrected, total, rows: fallback.map(toRow) }
      }

      return { ok: true, page: data.page, total, rows: rawRows.map(toRow) }
    } catch (error) {
      console.error('[companies] list', error)
      return { ok: false, failure: describeFailure(error) }
    }
  })

/* ── Detail ──────────────────────────────────────────────────────────────── */

export type CompanyService = {
  id: string
  key: string
  number: string
  name: string
  isActive: boolean
  isDeleted: boolean
}

export type CompanyDetail = {
  id: string
  key: string
  shortName: string
  tradeName: string
  legalName: string
  isActive: boolean
  isDeleted: boolean
  hcmDisabled: boolean
  hcmRunId: string | null
  syncedByHcm: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  createdBy: string | null
  updatedBy: string | null
  services: Array<CompanyService>
  scope: { services: number; stations: number; routes: number }
}

export type CompanyResponse =
  | { ok: true; company: CompanyDetail | null }
  | { ok: false; failure: Failure }

export const getCompany = createServerFn({ method: 'GET' })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }): Promise<CompanyResponse> => {
    try {
      const raw = await db.company.findUnique({
        where: { id: data.id },
        select: {
          id: true,
          key: true,
          shortName: true,
          tradeName: true,
          legalName: true,
          isActive: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
          hcmDisabled: true,
          hcmLastSeenRunId: true,
          createdBy: { select: { name: true } },
          updatedBy: { select: { name: true } },
          services: {
            orderBy: { key: 'asc' },
            select: {
              id: true,
              key: true,
              number: true,
              fullName: true,
              isActive: true,
              deletedAt: true,
            },
          },
        },
      })

      if (!raw) return { ok: true, company: null }

      // Scope by aggregation: counted in the database, no rows are fetched.
      const [services, stations, routes] = await Promise.all([
        db.service.count({ where: { companyId: raw.id, deletedAt: null } }),
        db.station.count({
          where: {
            deletedAt: null,
            services: { some: { companyId: raw.id, deletedAt: null } },
          },
        }),
        db.route.count({
          where: {
            deletedAt: null,
            service: { companyId: raw.id, deletedAt: null },
          },
        }),
      ])

      return {
        ok: true,
        company: {
          id: raw.id,
          key: raw.key,
          shortName: raw.shortName,
          tradeName: raw.tradeName,
          legalName: raw.legalName,
          isActive: raw.isActive,
          isDeleted: raw.deletedAt !== null,
          hcmDisabled: raw.hcmDisabled,
          hcmRunId: raw.hcmLastSeenRunId,
          syncedByHcm: raw.hcmLastSeenRunId !== null,
          createdAt: raw.createdAt.toISOString(),
          updatedAt: raw.updatedAt.toISOString(),
          deletedAt: raw.deletedAt ? raw.deletedAt.toISOString() : null,
          createdBy: raw.createdBy?.name ?? null,
          updatedBy: raw.updatedBy?.name ?? null,
          services: raw.services.map((s) => ({
            id: s.id,
            key: s.key,
            number: s.number,
            name: s.fullName,
            isActive: s.isActive,
            isDeleted: s.deletedAt !== null,
          })),
          scope: { services, stations, routes },
        },
      }
    } catch (error) {
      console.error('[companies] detail', error)
      return { ok: false, failure: describeFailure(error) }
    }
  })
