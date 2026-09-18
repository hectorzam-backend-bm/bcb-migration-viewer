import { createServerFn } from '@tanstack/react-start'
import type { Prisma } from '@prisma/generated'
import { db, describeFailure } from './db'

/* ── View contract ─────────────────────────────────────────────────────────
   A service belongs to a company and spans stations and routes: the viewer's
   value is in the crossing, so the list loads both counts and the detail
   links to each related entity.                                             */

export const SERVICE_SORTS = ['key', 'number', 'name', 'company', 'routes'] as const
export type ServiceSort = (typeof SERVICE_SORTS)[number]

export const SERVICE_STATUSES = ['active', 'inactive'] as const
export const EARLY_DISPATCH_OPTIONS = ['yes', 'no'] as const

export type ServiceSearch = {
  q: string
  page: number
  perPage: number
  sort: ServiceSort
  dir: 'asc' | 'desc'
  company: Array<string>
  status: Array<string>
  earlyDispatch: Array<string>
  deleted: boolean
}

type Failure = ReturnType<typeof describeFailure>

export type ServiceRow = {
  id: string
  key: string
  number: string
  name: string
  shortName: string
  isActive: boolean
  isDeleted: boolean
  hcmDisabled: boolean
  allowEarlyDispatch: boolean
  companyId: string
  companyKey: string
  companyName: string
  stations: number
  routes: number
}

export type CompanyOption = { value: string; label: string; note?: string }

export type ServicesResponse =
  | {
      ok: true
      rows: Array<ServiceRow>
      total: number
      catalogTotal: number
      page: number
      companies: Array<CompanyOption>
    }
  | { ok: false; failure: Failure }

/** Translates a two-value ListFilter selection to a boolean, or to nothing. */
function booleanFromSelection(
  selection: Array<string>,
  truthy: string,
  falsy: string,
): boolean | undefined {
  const yes = selection.includes(truthy)
  const no = selection.includes(falsy)
  if (yes === no) return undefined
  return yes
}

function buildOrderBy(
  sort: ServiceSort,
  dir: 'asc' | 'desc',
): Prisma.ServiceOrderByWithRelationInput {
  switch (sort) {
    case 'number':
      return { number: dir }
    case 'name':
      return { fullName: dir }
    case 'company':
      return { company: { shortName: dir } }
    case 'routes':
      return { routes: { _count: dir } }
    default:
      return { key: dir }
  }
}

const CURRENT_COUNTS = {
  select: {
    stations: { where: { deletedAt: null } },
    routes: { where: { deletedAt: null } },
  },
} satisfies Prisma.ServiceCountOutputTypeDefaultArgs

export const listServices = createServerFn({ method: 'GET' })
  .inputValidator((input: ServiceSearch) => input)
  .handler(async ({ data }): Promise<ServicesResponse> => {
    const q = data.q.trim()

    try {
      const isActive = booleanFromSelection(data.status, 'active', 'inactive')
      const allowEarlyDispatch = booleanFromSelection(data.earlyDispatch, 'yes', 'no')

      const where: Prisma.ServiceWhereInput = {
        ...(data.deleted ? {} : { deletedAt: null }),
        ...(data.company.length > 0 ? { companyId: { in: data.company } } : {}),
        ...(isActive === undefined ? {} : { isActive }),
        ...(allowEarlyDispatch === undefined ? {} : { allowEarlyDispatch }),
        ...(q
          ? {
              OR: [
                { key: { contains: q, mode: 'insensitive' } },
                { number: { contains: q, mode: 'insensitive' } },
                { fullName: { contains: q, mode: 'insensitive' } },
                { shortName: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      }

      const select = {
        id: true,
        key: true,
        number: true,
        fullName: true,
        shortName: true,
        isActive: true,
        allowEarlyDispatch: true,
        hcmDisabled: true,
        deletedAt: true,
        companyId: true,
        company: { select: { id: true, key: true, shortName: true } },
        _count: CURRENT_COUNTS,
      } satisfies Prisma.ServiceSelect

      const orderBy = buildOrderBy(data.sort, data.dir)
      const perPage = data.perPage

      const [rawRows, total, catalogTotal, companies] = await Promise.all([
        db.service.findMany({
          where,
          select,
          orderBy,
          skip: Math.max(0, (data.page - 1) * perPage),
          take: perPage,
        }),
        db.service.count({ where }),
        db.service.count({ where: data.deleted ? {} : { deletedAt: null } }),
        db.company.findMany({
          where: { deletedAt: null },
          select: { id: true, key: true, shortName: true },
          orderBy: { shortName: 'asc' },
        }),
      ])

      // If the filters left the requested page out of range, fetch the last one with data:
      // better the end of the manifest than a blank page.
      const lastPage = Math.max(1, Math.ceil(total / perPage))
      const page = Math.min(Math.max(1, data.page), lastPage)
      const rows =
        rawRows.length === 0 && total > 0
          ? await db.service.findMany({
              where,
              select,
              orderBy,
              skip: (page - 1) * perPage,
              take: perPage,
            })
          : rawRows

      return {
        ok: true,
        total,
        catalogTotal,
        page,
        rows: rows.map((s) => ({
          id: s.id,
          key: s.key,
          number: s.number,
          name: s.fullName,
          shortName: s.shortName,
          isActive: s.isActive,
          isDeleted: s.deletedAt !== null,
          hcmDisabled: s.hcmDisabled,
          allowEarlyDispatch: s.allowEarlyDispatch,
          companyId: s.companyId,
          companyKey: s.company.key,
          companyName: s.company.shortName,
          stations: s._count.stations,
          routes: s._count.routes,
        })),
        companies: companies.map((c) => ({
          value: c.id,
          label: c.shortName,
          note: c.key,
        })),
      }
    } catch (error) {
      console.error('[services]', error)
      return { ok: false, failure: describeFailure(error) }
    }
  })

/* ── Detail ────────────────────────────────────────────────────────────── */

export type ServiceStation = {
  id: string
  number: string
  shortName: string
  name: string
  type: string
  state: string
  isActive: boolean
  isDeleted: boolean
}

export type ServiceRoute = {
  id: string
  number: string
  name: string
  origin: string
  destination: string
  segments: number
  priceOneWay: string
  isActive: boolean
  isDeleted: boolean
}

export type PassengerType = {
  id: string
  key: string
  name: string
  description: string | null
  discountPercent: number
  seatingLimit: number | null
  requiredDocument: boolean
  documentType: string | null
  isActive: boolean
  isDeleted: boolean
}

export type ServiceDetail = {
  id: string
  key: string
  number: string
  name: string
  shortName: string
  account: string | null
  isActive: boolean
  isDeleted: boolean
  allowEarlyDispatch: boolean
  hcmDisabled: boolean
  hcmLastRunId: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  company: {
    id: string
    key: string
    shortName: string
    tradeName: string
    legalName: string
    isActive: boolean
    isDeleted: boolean
  }
  stations: Array<ServiceStation>
  routes: Array<ServiceRoute>
  passengerTypes: Array<PassengerType>
}

export type ServiceResponse =
  | { ok: true; service: ServiceDetail }
  | { ok: false; failure: Failure }

export const getService = createServerFn({ method: 'GET' })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }): Promise<ServiceResponse> => {
    try {
      const s = await db.service.findUnique({
        where: { id: data.id },
        select: {
          id: true,
          key: true,
          number: true,
          fullName: true,
          shortName: true,
          account: true,
          isActive: true,
          allowEarlyDispatch: true,
          hcmDisabled: true,
          hcmLastSeenRunId: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
          company: {
            select: {
              id: true,
              key: true,
              shortName: true,
              tradeName: true,
              legalName: true,
              isActive: true,
              deletedAt: true,
            },
          },
          stations: {
            select: {
              id: true,
              number: true,
              shortName: true,
              name: true,
              type: true,
              isActive: true,
              deletedAt: true,
              state: { select: { name: true } },
            },
            orderBy: { number: 'asc' },
          },
          routes: {
            select: {
              id: true,
              number: true,
              name: true,
              priceOneWay: true,
              isActive: true,
              deletedAt: true,
              origin: { select: { shortName: true } },
              destination: { select: { shortName: true } },
              _count: { select: { segments: { where: { deletedAt: null } } } },
            },
            orderBy: { number: 'asc' },
          },
          passengerTypes: {
            select: {
              id: true,
              key: true,
              name: true,
              description: true,
              discountPercent: true,
              seatingLimit: true,
              requiredDocument: true,
              documentType: true,
              isActive: true,
              deletedAt: true,
            },
            orderBy: { number: 'asc' },
          },
        },
      })

      if (!s) {
        return {
          ok: false,
          failure: {
            title: 'No existe ese servicio',
            detail: `Identificador consultado: ${data.id}`,
            suggestion:
              'Revisa el identificador en la dirección o vuelve al listado de servicios.',
          },
        }
      }

      return {
        ok: true,
        service: {
          id: s.id,
          key: s.key,
          number: s.number,
          name: s.fullName,
          shortName: s.shortName,
          account: s.account,
          isActive: s.isActive,
          isDeleted: s.deletedAt !== null,
          allowEarlyDispatch: s.allowEarlyDispatch,
          hcmDisabled: s.hcmDisabled,
          hcmLastRunId: s.hcmLastSeenRunId,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
          deletedAt: s.deletedAt ? s.deletedAt.toISOString() : null,
          company: {
            id: s.company.id,
            key: s.company.key,
            shortName: s.company.shortName,
            tradeName: s.company.tradeName,
            legalName: s.company.legalName,
            isActive: s.company.isActive,
            isDeleted: s.company.deletedAt !== null,
          },
          stations: s.stations.map((st) => ({
            id: st.id,
            number: st.number,
            shortName: st.shortName,
            name: st.name,
            type: st.type,
            state: st.state.name,
            isActive: st.isActive,
            isDeleted: st.deletedAt !== null,
          })),
          routes: s.routes.map((r) => ({
            id: r.id,
            number: r.number,
            name: r.name,
            origin: r.origin.shortName,
            destination: r.destination.shortName,
            segments: r._count.segments,
            // The Decimal stays on the server side: only text reaches the client.
            priceOneWay: r.priceOneWay.toString(),
            isActive: r.isActive,
            isDeleted: r.deletedAt !== null,
          })),
          passengerTypes: s.passengerTypes.map((p) => ({
            id: p.id,
            key: p.key,
            name: p.name,
            description: p.description,
            discountPercent: p.discountPercent,
            seatingLimit: p.seatingLimit,
            requiredDocument: p.requiredDocument,
            documentType: p.documentType,
            isActive: p.isActive,
            isDeleted: p.deletedAt !== null,
          })),
        },
      }
    } catch (error) {
      console.error('[service]', error)
      return { ok: false, failure: describeFailure(error) }
    }
  })
