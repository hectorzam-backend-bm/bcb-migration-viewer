import { createServerFn } from '@tanstack/react-start'
import type { Prisma } from '@prisma/generated'
import { db, describeFailure } from './db'
import { clampPage, range } from '~/lib/params'

/**
 * Stations — reads the Station catalog and its cross-references (services, companies,
 * origin and destination routes, segments). Nothing here writes: the Prisma client
 * rejects any operation that is not a read.
 */

export const STATION_SORTS = ['number', 'shortName', 'name', 'state'] as const
export type StationSort = (typeof STATION_SORTS)[number]

export const STATION_STATUSES = ['active', 'inactive'] as const
export const STATION_TYPES = ['SALE', 'SCALE'] as const

export type StationSearch = {
  q: string
  page: number
  perPage: number
  sort: StationSort
  dir: 'asc' | 'desc'
  company: Array<string>
  service: Array<string>
  type: Array<string>
  state: Array<string>
  status: Array<string>
  deleted: boolean
}

type Failure = ReturnType<typeof describeFailure>

export type CatalogOption = { value: string; label: string; note?: string }

export type StationFilterOptions = {
  companies: Array<CatalogOption>
  services: Array<CatalogOption>
  states: Array<CatalogOption>
}

export type ServiceBrief = { id: string; number: string; shortName: string }
export type CompanyBrief = { id: string; key: string; shortName: string }

export type StationRow = {
  id: string
  number: string
  shortName: string
  name: string
  type: string
  state: string | null
  services: Array<ServiceBrief>
  companies: Array<CompanyBrief>
  isActive: boolean
  isDeleted: boolean
}

export type StationsResponse =
  | {
      ok: true
      rows: Array<StationRow>
      total: number
      page: number
      options: StationFilterOptions
    }
  | { ok: false; failure: Failure }

function isStationType(value: string): value is 'SALE' | 'SCALE' {
  return value === 'SALE' || value === 'SCALE'
}

function stationOrderBy(
  sort: StationSort,
  dir: 'asc' | 'desc',
): Array<Prisma.StationOrderByWithRelationInput> {
  switch (sort) {
    case 'shortName':
      return [{ shortName: dir }]
    case 'name':
      return [{ name: dir }]
    case 'state':
      return [{ state: { name: dir } }, { number: 'asc' }]
    default:
      return [{ number: dir }]
  }
}

/* ── List ─────────────────────────────────────────────────────────────────── */

export const listStations = createServerFn({ method: 'GET' })
  .inputValidator((input: StationSearch) => input)
  .handler(async ({ data }): Promise<StationsResponse> => {
    try {
      const q = data.q.trim()
      const conditions: Array<Prisma.StationWhereInput> = []

      if (q) {
        conditions.push({
          OR: [
            { number: { contains: q, mode: 'insensitive' } },
            { shortName: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { address: { contains: q, mode: 'insensitive' } },
          ],
        })
      }
      if (data.company.length > 0) {
        conditions.push({ services: { some: { companyId: { in: data.company } } } })
      }
      if (data.service.length > 0) {
        conditions.push({ services: { some: { id: { in: data.service } } } })
      }
      const types = data.type.filter(isStationType)
      if (types.length > 0) {
        conditions.push({ type: { in: types } })
      }
      if (data.state.length > 0) {
        conditions.push({ stateId: { in: data.state } })
      }
      const status = data.status.filter(
        (e): e is 'active' | 'inactive' => e === 'active' || e === 'inactive',
      )
      // Selecting both statuses is the same as not filtering.
      if (status.length === 1) {
        conditions.push({ isActive: status[0] === 'active' })
      }

      const where: Prisma.StationWhereInput = {
        ...(data.deleted ? {} : { deletedAt: null }),
        ...(conditions.length > 0 ? { AND: conditions } : {}),
      }

      // Deleted services only show up when the viewer is showing deleted records.
      const services = {
        where: data.deleted ? {} : { deletedAt: null },
        orderBy: [{ number: 'asc' as const }],
        select: {
          id: true,
          number: true,
          shortName: true,
          company: { select: { id: true, key: true, shortName: true } },
        },
      }

      const select = {
        id: true,
        number: true,
        shortName: true,
        name: true,
        type: true,
        isActive: true,
        deletedAt: true,
        state: { select: { name: true } },
        services,
      } as const

      const orderBy = stationOrderBy(data.sort, data.dir)
      const [rawRows, total, companies, catalogServices, states] = await Promise.all([
        db.station.findMany({
          where,
          select,
          orderBy,
          ...range(data.page, data.perPage),
        }),
        db.station.count({ where }),
        db.company.findMany({
          where: { deletedAt: null },
          select: { id: true, key: true, shortName: true },
          orderBy: [{ shortName: 'asc' }],
        }),
        db.service.findMany({
          where: { deletedAt: null },
          select: { id: true, number: true, shortName: true },
          orderBy: [{ number: 'asc' }],
        }),
        db.state.findMany({ select: { id: true, name: true }, orderBy: [{ name: 'asc' }] }),
      ])

      // If the filter left fewer pages than requested, go back to the last one with data.
      const page = clampPage(data.page, total, data.perPage)
      const records =
        page === data.page
          ? rawRows
          : await db.station.findMany({
              where,
              select,
              orderBy,
              ...range(page, data.perPage),
            })

      const rows: Array<StationRow> = records.map((e) => {
        const seen = new Set<string>()
        const stationCompanies: Array<CompanyBrief> = []
        for (const s of e.services) {
          if (seen.has(s.company.key)) continue
          seen.add(s.company.key)
          stationCompanies.push({
            id: s.company.id,
            key: s.company.key,
            shortName: s.company.shortName,
          })
        }

        return {
          id: e.id,
          number: e.number,
          shortName: e.shortName,
          name: e.name,
          type: e.type,
          state: e.state?.name ?? null,
          services: e.services.map((s) => ({
            id: s.id,
            number: s.number,
            shortName: s.shortName,
          })),
          companies: stationCompanies,
          isActive: e.isActive,
          isDeleted: e.deletedAt !== null,
        }
      })

      return {
        ok: true,
        rows,
        total,
        page,
        options: {
          companies: companies.map((c) => ({
            value: c.id,
            label: c.shortName,
            note: c.key,
          })),
          services: catalogServices.map((s) => ({
            value: s.id,
            label: `${s.number} · ${s.shortName}`,
          })),
          states: states.map((s) => ({ value: s.id, label: s.name })),
        },
      }
    } catch (error) {
      console.error('[stations:list]', error)
      return { ok: false, failure: describeFailure(error) }
    }
  })

/* ── Detail ───────────────────────────────────────────────────────────────── */

export type StationFile = {
  id: string
  name: string
  url: string
  type: string
  bytes: number
}

export type StationDonation = {
  id: string
  startDate: string
  endDate: string
  isActive: boolean
}

export type StationService = {
  id: string
  number: string
  key: string
  shortName: string
  fullName: string
  isActive: boolean
  isDeleted: boolean
  company: { id: string; key: string; shortName: string }
}

export type StationBrief = { id: string; number: string; shortName: string }

export type StationRoute = {
  id: string
  number: string
  name: string
  isActive: boolean
  isDeleted: boolean
  origin: StationBrief
  destination: StationBrief
  service: ServiceBrief
  priceOneWay: string
  travelTimeMinutes: number
  distanceKm: number
}

export type StationSegment = {
  id: string
  number: string
  isMain: boolean
  isActive: boolean
  isDeleted: boolean
  route: { id: string; number: string; name: string }
  origin: StationBrief
  destination: StationBrief
  priceOneWay: string
}

export type StationDetail = {
  id: string
  number: string
  shortName: string
  name: string
  address: string | null
  latitude: number
  longitude: number
  googleUrl: string | null
  phone: string | null
  type: string
  state: string | null
  isActive: boolean
  isDeleted: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  createdBy: string | null
  updatedBy: string | null
  facadePhoto: StationFile | null
  isometricPhoto: StationFile | null
  donations: Array<StationDonation>
  services: Array<StationService>
}

export type StationResponse =
  | {
      ok: true
      station: StationDetail
      departures: Array<StationRoute>
      arrivals: Array<StationRoute>
      segments: Array<StationSegment>
    }
  | { ok: false; failure: Failure }

const STATION_BRIEF = { select: { id: true, number: true, shortName: true } } as const

const ROUTE_SELECT = {
  id: true,
  number: true,
  name: true,
  isActive: true,
  deletedAt: true,
  priceOneWay: true,
  travelTimeMinutes: true,
  distanceKm: true,
  origin: STATION_BRIEF,
  destination: STATION_BRIEF,
  service: { select: { id: true, number: true, shortName: true } },
} as const

function toStationFile(
  file: { id: string; name: string; url: string; mimetype: string; size: number } | null,
): StationFile | null {
  if (!file) return null
  return {
    id: file.id,
    name: file.name,
    url: file.url,
    type: file.mimetype,
    bytes: file.size,
  }
}

function toStationRoute(r: {
  id: string
  number: string
  name: string
  isActive: boolean
  deletedAt: Date | null
  priceOneWay: { toString(): string }
  travelTimeMinutes: number
  distanceKm: number
  origin: { id: string; number: string; shortName: string }
  destination: { id: string; number: string; shortName: string }
  service: { id: string; number: string; shortName: string }
}): StationRoute {
  return {
    id: r.id,
    number: r.number,
    name: r.name,
    isActive: r.isActive,
    isDeleted: r.deletedAt !== null,
    origin: { id: r.origin.id, number: r.origin.number, shortName: r.origin.shortName },
    destination: {
      id: r.destination.id,
      number: r.destination.number,
      shortName: r.destination.shortName,
    },
    service: {
      id: r.service.id,
      number: r.service.number,
      shortName: r.service.shortName,
    },
    priceOneWay: r.priceOneWay.toString(),
    travelTimeMinutes: r.travelTimeMinutes,
    distanceKm: r.distanceKm,
  }
}

export const getStation = createServerFn({ method: 'GET' })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }): Promise<StationResponse> => {
    try {
      const [record, departures, arrivals, segments] = await Promise.all([
        db.station.findUnique({
          where: { id: data.id },
          select: {
            id: true,
            number: true,
            shortName: true,
            name: true,
            address: true,
            latitude: true,
            longitude: true,
            googleUrl: true,
            phone: true,
            type: true,
            isActive: true,
            deletedAt: true,
            createdAt: true,
            updatedAt: true,
            state: { select: { name: true } },
            createdBy: { select: { name: true } },
            updatedBy: { select: { name: true } },
            facadePhoto: {
              select: { id: true, name: true, url: true, mimetype: true, size: true },
            },
            isometricPhoto: {
              select: { id: true, name: true, url: true, mimetype: true, size: true },
            },
            activeDonations: {
              select: { id: true, startDate: true, endDate: true, isActive: true },
              orderBy: [{ startDate: 'desc' }],
            },
            services: {
              orderBy: [{ number: 'asc' }],
              select: {
                id: true,
                number: true,
                key: true,
                shortName: true,
                fullName: true,
                isActive: true,
                deletedAt: true,
                company: { select: { id: true, key: true, shortName: true } },
              },
            },
          },
        }),
        db.route.findMany({
          where: { originId: data.id },
          select: ROUTE_SELECT,
          orderBy: [{ number: 'asc' }],
        }),
        db.route.findMany({
          where: { destinationId: data.id },
          select: ROUTE_SELECT,
          orderBy: [{ number: 'asc' }],
        }),
        db.segment.findMany({
          where: {
            OR: [{ originStationId: data.id }, { destinationStationId: data.id }],
          },
          select: {
            id: true,
            number: true,
            isMain: true,
            isActive: true,
            deletedAt: true,
            priceOneWay: true,
            originStation: STATION_BRIEF,
            destinationStation: STATION_BRIEF,
            route: { select: { id: true, number: true, name: true } },
          },
          orderBy: [{ route: { number: 'asc' } }, { number: 'asc' }],
        }),
      ])

      if (!record) {
        return {
          ok: false,
          failure: {
            title: 'No existe esa terminal',
            detail: data.id,
            suggestion:
              'El identificador no corresponde a ningún registro de la base conectada. Vuelve al listado de terminales.',
          },
        }
      }

      const station: StationDetail = {
        id: record.id,
        number: record.number,
        shortName: record.shortName,
        name: record.name,
        address: record.address,
        latitude: record.latitude,
        longitude: record.longitude,
        googleUrl: record.googleUrl,
        phone: record.phone,
        type: record.type,
        state: record.state?.name ?? null,
        isActive: record.isActive,
        isDeleted: record.deletedAt !== null,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        deletedAt: record.deletedAt ? record.deletedAt.toISOString() : null,
        createdBy: record.createdBy?.name ?? null,
        updatedBy: record.updatedBy?.name ?? null,
        facadePhoto: toStationFile(record.facadePhoto),
        isometricPhoto: toStationFile(record.isometricPhoto),
        donations: record.activeDonations.map((d) => ({
          id: d.id,
          startDate: d.startDate.toISOString(),
          endDate: d.endDate.toISOString(),
          isActive: d.isActive,
        })),
        services: record.services.map((s) => ({
          id: s.id,
          number: s.number,
          key: s.key,
          shortName: s.shortName,
          fullName: s.fullName,
          isActive: s.isActive,
          isDeleted: s.deletedAt !== null,
          company: {
            id: s.company.id,
            key: s.company.key,
            shortName: s.company.shortName,
          },
        })),
      }

      return {
        ok: true,
        station,
        departures: departures.map(toStationRoute),
        arrivals: arrivals.map(toStationRoute),
        segments: segments.map((t) => ({
          id: t.id,
          number: t.number,
          isMain: t.isMain,
          isActive: t.isActive,
          isDeleted: t.deletedAt !== null,
          route: { id: t.route.id, number: t.route.number, name: t.route.name },
          origin: {
            id: t.originStation.id,
            number: t.originStation.number,
            shortName: t.originStation.shortName,
          },
          destination: {
            id: t.destinationStation.id,
            number: t.destinationStation.number,
            shortName: t.destinationStation.shortName,
          },
          priceOneWay: t.priceOneWay.toString(),
        })),
      }
    } catch (error) {
      console.error('[stations:detail]', error)
      return { ok: false, failure: describeFailure(error) }
    }
  })
