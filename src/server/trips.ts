import { createServerFn } from '@tanstack/react-start'
import type { Prisma } from '@prisma/generated'
import { db, describeFailure } from './db'
import { clampPage, range } from '~/lib/params'

/**
 * Corridas — trips over a route on a single day.
 *
 * `Trip.departure`/`dispatchedAt`/`arrival`/`realDepartureAt`/`realArrivalAt`
 * are naked `DateTime` columns holding a schedule's wall-clock value, not an
 * observed instant: the `pg` driver parses them as UTC, so every date
 * boundary here is computed in UTC too — mixing zones would put the wrong
 * trips on the wrong day. `createdAt`/`updatedAt` stay ordinary instants.
 */

export const TRIP_SORTS = [
  'key',
  'departure',
  'dispatched',
  'arrival',
  'route',
  'service',
  'sale',
  'status',
  'type',
  'segments',
  'price',
  'priceRound',
] as const
export type TripSort = (typeof TRIP_SORTS)[number]

export const TRIP_STATUSES = [
  'OPEN',
  'CLOSED',
  'CANCELLED',
  'FINISHED',
  'DISPATCHED',
  'CONFIRMED',
  'CANCELLED_BY_GROUP',
] as const
export type TripStatusValue = (typeof TRIP_STATUSES)[number]

export const TRIP_TYPES = ['NORMAL', 'EXTRA'] as const
export type TripTypeValue = (typeof TRIP_TYPES)[number]

export type TripSearch = {
  date: string
  q: string
  page: number
  perPage: number
  sort: TripSort
  dir: 'asc' | 'desc'
  company: Array<string>
  service: Array<string>
  route: Array<string>
  origin: Array<string>
  destination: Array<string>
  status: Array<TripStatusValue>
  type: Array<TripTypeValue>
  deleted: boolean
}

type Failure = ReturnType<typeof describeFailure>

export type FilterOption = { value: string; label: string; note?: string }

export type TripFilterOptions = {
  companies: Array<FilterOption>
  services: Array<FilterOption>
  routes: Array<FilterOption>
  stations: Array<FilterOption>
}

export type StationRef = { id: string; key: string; name: string }

export type TripRow = {
  id: string
  departure: string
  dispatchedAt: string | null
  arrival: string | null
  route: { id: string; number: string; name: string }
  service: { id: string; label: string }
  status: string
  type: string
  openSale: boolean
  segments: number
  tickets: number
  priceOneWay: string
  priceRound: string
  isDeleted: boolean
}

export type TripDayCount = { date: string; count: number }

export type TripsResponse =
  | {
      ok: true
      date: string
      rows: Array<TripRow>
      total: number
      page: number
      days: Array<TripDayCount>
      options: TripFilterOptions
    }
  | { ok: false; failure: Failure }

/* ── Date helpers — everything below works in whole UTC calendar days ─────── */

/** `dateIso` is always a validated `YYYY-MM-DD` (see `isoDate` in
 *  `src/lib/params.ts`) or a value this file built itself, so the fallbacks
 *  here only satisfy `noUncheckedIndexedAccess` — they never actually fire. */
export function parseIsoDate(dateIso: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso)
  return {
    year: Number(match?.[1] ?? 0),
    month: Number(match?.[2] ?? 1),
    day: Number(match?.[3] ?? 1),
  }
}

function dayBoundsUTC(dateIso: string) {
  const { year, month, day } = parseIsoDate(dateIso)
  return {
    start: new Date(Date.UTC(year, month - 1, day)),
    end: new Date(Date.UTC(year, month - 1, day + 1)),
  }
}

function monthBoundsUTC(dateIso: string) {
  const { year, month } = parseIsoDate(dateIso)
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  }
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** No `date` in the URL: land on the latest day with migrated trips instead
 *  of on today's certainly-empty sheet. */
async function resolveDate(requested: string): Promise<string> {
  if (requested) return requested
  const latest = await db.trip.aggregate({ _max: { departure: true } })
  return latest._max.departure ? toIsoDate(latest._max.departure) : toIsoDate(new Date())
}

/** One trip count per calendar day of the resolved date's month, zero-filled —
 *  a manifest never leaves a day blank. */
async function dayCounts(dateIso: string): Promise<Array<TripDayCount>> {
  const { start, end } = monthBoundsUTC(dateIso)
  const trips = await db.trip.findMany({
    where: { departure: { gte: start, lt: end } },
    select: { departure: true },
  })

  const counts = new Map<string, number>()
  for (const t of trips) {
    const key = toIsoDate(t.departure)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const { year, month } = parseIsoDate(dateIso)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const monthPrefix = dateIso.slice(0, 7)
  return Array.from({ length: daysInMonth }, (_, i) => {
    const date = `${monthPrefix}-${String(i + 1).padStart(2, '0')}`
    return { date, count: counts.get(date) ?? 0 }
  })
}

function byNumber(a: string, b: string) {
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
}

const STATION_SELECT = {
  id: true,
  number: true,
  shortName: true,
  name: true,
} as const

function station(e: {
  id: string
  number: string
  shortName: string
  name: string
}): StationRef {
  return { id: e.id, key: e.shortName || e.number, name: e.name }
}

async function readTripOptions(): Promise<TripFilterOptions> {
  const [companies, services, routes, stations] = await Promise.all([
    db.company.findMany({
      where: { deletedAt: null },
      select: { id: true, key: true, shortName: true },
      orderBy: { shortName: 'asc' },
    }),
    db.service.findMany({
      where: { deletedAt: null },
      select: { id: true, key: true, shortName: true },
      orderBy: { shortName: 'asc' },
    }),
    db.route.findMany({
      where: { deletedAt: null },
      select: { id: true, number: true, name: true },
    }),
    db.station.findMany({
      where: { deletedAt: null },
      select: { id: true, number: true, shortName: true, name: true },
      orderBy: { shortName: 'asc' },
    }),
  ])

  return {
    companies: companies.map((c) => ({ value: c.id, label: c.shortName, note: c.key })),
    services: services.map((s) => ({ value: s.id, label: s.shortName, note: s.key })),
    routes: routes
      .slice()
      .sort((a, b) => byNumber(a.number, b.number))
      .map((r) => ({ value: r.id, label: r.name, note: r.number })),
    stations: stations.map((s) => ({
      value: s.id,
      label: s.shortName || s.number,
      note: s.name,
    })),
  }
}

type TripOrder = (dir: 'asc' | 'desc') => Array<Prisma.TripOrderByWithRelationInput>

const TRIP_BY_DEPARTURE: TripOrder = (dir) => [{ departure: dir }]

const TRIP_SORT_MAP: Record<string, TripOrder> = {
  // `Trip.id` is not a generated uuid in the migrated data: every row's id is
  // the legacy "clave de corrida" (e.g. `TAPOI1824N292362`), carried over
  // verbatim as the primary key — see the "Clave" column in `columns.tsx`.
  key: (dir) => [{ id: dir }],
  departure: TRIP_BY_DEPARTURE,
  dispatched: (dir) => [{ dispatchedAt: dir }, { departure: 'asc' }],
  arrival: (dir) => [{ arrival: dir }, { departure: 'asc' }],
  route: (dir) => [{ route: { number: dir } }, { departure: 'asc' }],
  service: (dir) => [{ route: { service: { shortName: dir } } }, { departure: 'asc' }],
  sale: (dir) => [{ openSale: dir }, { departure: 'asc' }],
  status: (dir) => [{ status: dir }, { departure: 'asc' }],
  type: (dir) => [{ type: dir }, { departure: 'asc' }],
  segments: (dir) => [{ segments: { _count: dir } }, { departure: 'asc' }],
  price: (dir) => [{ priceOneWay: dir }],
  priceRound: (dir) => [{ priceRound: dir }],
}

export const listTrips = createServerFn({ method: 'GET' })
  .inputValidator((input: TripSearch) => input)
  .handler(async ({ data }): Promise<TripsResponse> => {
    try {
      const date = await resolveDate(data.date)
      const { start, end } = dayBoundsUTC(date)
      const q = data.q.trim()

      const routeConditions: Prisma.RouteWhereInput = {
        // A trip's own `deletedAt` is 0 on every migrated row, but its route
        // can still be soft-deleted; "Incluir bajas" governs both the same way
        // `routes.ts` does for segments.
        ...(data.deleted ? {} : { deletedAt: null }),
        ...(data.service.length ? { serviceId: { in: data.service } } : {}),
        ...(data.company.length ? { service: { companyId: { in: data.company } } } : {}),
        ...(data.origin.length ? { originId: { in: data.origin } } : {}),
        ...(data.destination.length ? { destinationId: { in: data.destination } } : {}),
        ...(q
          ? {
              OR: [
                { number: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
                {
                  origin: {
                    OR: [
                      { name: { contains: q, mode: 'insensitive' } },
                      { shortName: { contains: q, mode: 'insensitive' } },
                      { number: { contains: q, mode: 'insensitive' } },
                    ],
                  },
                },
                {
                  destination: {
                    OR: [
                      { name: { contains: q, mode: 'insensitive' } },
                      { shortName: { contains: q, mode: 'insensitive' } },
                      { number: { contains: q, mode: 'insensitive' } },
                    ],
                  },
                },
              ],
            }
          : {}),
      }
      const hasRouteConditions = Object.keys(routeConditions).length > 0

      const where: Prisma.TripWhereInput = {
        departure: { gte: start, lt: end },
        ...(data.deleted ? {} : { deletedAt: null }),
        ...(data.route.length ? { routeId: { in: data.route } } : {}),
        ...(hasRouteConditions ? { route: routeConditions } : {}),
        ...(data.status.length ? { status: { in: data.status } } : {}),
        ...(data.type.length ? { type: { in: data.type } } : {}),
      }

      const select = {
        id: true,
        departure: true,
        dispatchedAt: true,
        arrival: true,
        status: true,
        type: true,
        openSale: true,
        priceOneWay: true,
        priceRound: true,
        deletedAt: true,
        route: {
          select: {
            id: true,
            number: true,
            name: true,
            service: { select: { id: true, shortName: true } },
          },
        },
        _count: { select: { segments: true } },
      } satisfies Prisma.TripSelect

      const orderBy = (TRIP_SORT_MAP[data.sort] ?? TRIP_BY_DEPARTURE)(data.dir)

      const [rawRows, total, days, options] = await Promise.all([
        db.trip.findMany({ where, orderBy, select, ...range(data.page, data.perPage) }),
        db.trip.count({ where }),
        dayCounts(date),
        readTripOptions(),
      ])

      // Filters can leave fewer pages than the URL asked for: better the last
      // page with data than a blank one.
      const corrected = clampPage(data.page, total, data.perPage)
      const records =
        rawRows.length === 0 && total > 0 && corrected !== data.page
          ? await db.trip.findMany({
              where,
              orderBy,
              select,
              ...range(corrected, data.perPage),
            })
          : rawRows
      const page = records === rawRows ? data.page : corrected

      const tripIds = records.map((t) => t.id)
      const ticketSums = tripIds.length
        ? await db.tripPassengerType.groupBy({
            by: ['tripId'],
            where: { tripId: { in: tripIds } },
            _sum: { ticketsSold: true },
          })
        : []
      const ticketsByTrip = new Map(ticketSums.map((s) => [s.tripId, s._sum.ticketsSold ?? 0]))

      const rows: Array<TripRow> = records.map((t) => ({
        id: t.id,
        departure: t.departure.toISOString(),
        dispatchedAt: t.dispatchedAt ? t.dispatchedAt.toISOString() : null,
        arrival: t.arrival ? t.arrival.toISOString() : null,
        route: { id: t.route.id, number: t.route.number, name: t.route.name },
        service: { id: t.route.service.id, label: t.route.service.shortName },
        status: t.status,
        type: t.type,
        openSale: t.openSale,
        segments: t._count.segments,
        tickets: ticketsByTrip.get(t.id) ?? 0,
        priceOneWay: t.priceOneWay.toString(),
        priceRound: t.priceRound.toString(),
        isDeleted: t.deletedAt !== null,
      }))

      return { ok: true, date, rows, total, page, days, options }
    } catch (error) {
      console.error('[trips] list', error)
      return { ok: false, failure: describeFailure(error) }
    }
  })

/* ── Detail ─────────────────────────────────────────────────────────────── */

export type TripSegmentDetail = {
  id: string
  number: string
  isMain: boolean
  origin: StationRef
  destination: StationRef
  departure: string
  arrival: string
  priceOneWay: string
  priceRound: string | null
}

export type TripPassengerTypeDetail = {
  id: string
  key: string
  name: string
  seatingLimit: number | null
  ticketsSold: number
  isActive: boolean
}

export type TripDetail = {
  id: string
  departure: string
  dispatchedAt: string | null
  arrival: string | null
  realDepartureAt: string | null
  realArrivalAt: string | null
  status: string
  type: string
  openSale: boolean
  priceOneWay: string
  priceRound: string
  route: { id: string; number: string; name: string }
  service: { id: string; key: string; name: string }
  company: { id: string; key: string; name: string }
  origin: StationRef
  destination: StationRef
  operatorId: string | null
  busId: string | null
  isDeleted: boolean
  createdAt: string
  updatedAt: string
  segments: Array<TripSegmentDetail>
  passengerTypes: Array<TripPassengerTypeDetail>
  ticketsSold: number
}

export type TripResponse =
  | { ok: true; trip: TripDetail }
  | { ok: false; failure: Failure }

export const getTrip = createServerFn({ method: 'GET' })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }): Promise<TripResponse> => {
    try {
      const t = await db.trip.findUnique({
        where: { id: data.id },
        select: {
          id: true,
          departure: true,
          dispatchedAt: true,
          arrival: true,
          realDepartureAt: true,
          realArrivalAt: true,
          status: true,
          type: true,
          openSale: true,
          priceOneWay: true,
          priceRound: true,
          operatorId: true,
          busId: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
          route: {
            select: {
              id: true,
              number: true,
              name: true,
              origin: { select: STATION_SELECT },
              destination: { select: STATION_SELECT },
              service: {
                select: {
                  id: true,
                  key: true,
                  shortName: true,
                  company: { select: { id: true, key: true, shortName: true } },
                },
              },
            },
          },
          segments: {
            orderBy: { departure: 'asc' },
            select: {
              id: true,
              departure: true,
              arrival: true,
              priceOneWay: true,
              priceRound: true,
              segment: {
                select: {
                  number: true,
                  isMain: true,
                  originStation: { select: STATION_SELECT },
                  destinationStation: { select: STATION_SELECT },
                },
              },
            },
          },
          passengers: {
            select: {
              seatingLimit: true,
              ticketsSold: true,
              isActive: true,
              passengerType: { select: { id: true, key: true, name: true } },
            },
          },
        },
      })

      if (!t) {
        return {
          ok: false,
          failure: {
            title: 'La corrida no existe',
            detail: `No hay ninguna corrida con el identificador ${data.id}.`,
            suggestion:
              'Es posible que el registro se haya eliminado de la base o que el enlace esté mal copiado.',
          },
        }
      }

      const passengerTypes = t.passengers
        .map((p) => ({
          id: p.passengerType.id,
          key: p.passengerType.key,
          name: p.passengerType.name,
          seatingLimit: p.seatingLimit,
          ticketsSold: p.ticketsSold,
          isActive: p.isActive,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))

      const trip: TripDetail = {
        id: t.id,
        departure: t.departure.toISOString(),
        dispatchedAt: t.dispatchedAt ? t.dispatchedAt.toISOString() : null,
        arrival: t.arrival ? t.arrival.toISOString() : null,
        realDepartureAt: t.realDepartureAt ? t.realDepartureAt.toISOString() : null,
        realArrivalAt: t.realArrivalAt ? t.realArrivalAt.toISOString() : null,
        status: t.status,
        type: t.type,
        openSale: t.openSale,
        priceOneWay: t.priceOneWay.toString(),
        priceRound: t.priceRound.toString(),
        route: { id: t.route.id, number: t.route.number, name: t.route.name },
        service: {
          id: t.route.service.id,
          key: t.route.service.key,
          name: t.route.service.shortName,
        },
        company: {
          id: t.route.service.company.id,
          key: t.route.service.company.key,
          name: t.route.service.company.shortName,
        },
        origin: station(t.route.origin),
        destination: station(t.route.destination),
        operatorId: t.operatorId,
        busId: t.busId,
        isDeleted: t.deletedAt !== null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        segments: t.segments.map((s) => ({
          id: s.id,
          number: s.segment.number,
          isMain: s.segment.isMain,
          origin: station(s.segment.originStation),
          destination: station(s.segment.destinationStation),
          departure: s.departure.toISOString(),
          arrival: s.arrival.toISOString(),
          priceOneWay: s.priceOneWay.toString(),
          priceRound: s.priceRound === null ? null : s.priceRound.toString(),
        })),
        passengerTypes,
        ticketsSold: passengerTypes.reduce((sum, p) => sum + p.ticketsSold, 0),
      }

      return { ok: true, trip }
    } catch (error) {
      console.error('[trips] detail', error)
      return { ok: false, failure: describeFailure(error) }
    }
  })
