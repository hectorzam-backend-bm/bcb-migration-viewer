import { createServerFn } from '@tanstack/react-start'
import type { Prisma } from '../../generated/prisma/client.ts'
import { db, describeFailure } from './db'

/**
 * Routes and segments — the viewer's main view.
 *
 * Two listings over the same URL: the live tab is the `view` parameter.
 * The flat segment listing is what the old system lacked and what a migration
 * cross-check needs: see the 4 000 segments without opening route by route.
 */

export type View = 'routes' | 'segments'

export type RouteSearch = {
  view: View
  q: string
  page: number
  perPage: number
  sort: string
  dir: 'asc' | 'desc'
  company: Array<string>
  service: Array<string>
  collection: Array<string>
  iva: Array<string>
  seats: Array<string>
  status: Array<string>
  route: Array<string>
  main: Array<string>
  sale: Array<string>
  deleted: boolean
}

type Failure = ReturnType<typeof describeFailure>

export type FilterOption = { value: string; label: string; note?: string }

export type RouteFilterOptions = {
  companies: Array<FilterOption>
  services: Array<FilterOption>
  routes: Array<FilterOption>
}

export type StationRef = { id: string; key: string; name: string }

export type RouteRow = {
  id: string
  number: string
  name: string
  service: { id: string; label: string }
  company: { id: string; label: string }
  origin: StationRef
  destination: StationRef
  segments: number
  priceOneWay: string
  travelTimeMinutes: number
  distanceKm: number | null
  isActive: boolean
  isDeleted: boolean
}

export type SegmentRow = {
  id: string
  number: string
  route: { id: string; number: string; name: string }
  origin: StationRef
  destination: StationRef
  stayTimeMinutes: number
  durationMinutes: number
  distanceKm: number | null
  allowSale: boolean
  priceOneWay: string
  priceRound: string | null
  isMain: boolean
  isActive: boolean
  isDeleted: boolean
}

export type RouteCounts = { routes: number; segments: number }

export type RoutesResponse =
  | {
      ok: true
      view: 'routes'
      rows: Array<RouteRow>
      total: number
      counts: RouteCounts
      options: RouteFilterOptions
    }
  | {
      ok: true
      view: 'segments'
      rows: Array<SegmentRow>
      total: number
      counts: RouteCounts
      options: RouteFilterOptions
    }
  | { ok: false; failure: Failure }

/* ── Utilities ──────────────────────────────────────────────────────────── */

/** Route and segment numbers are text in the database: sort them as numbers. */
function byNumber(a: string, b: string) {
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
}

/** A Yes/No filter only narrows when exactly one of the two was chosen. */
function yesNo(selection: Array<string>): boolean | undefined {
  if (selection.length !== 1) return undefined
  return selection[0] === 'yes'
}

function station(e: {
  id: string
  number: string
  shortName: string
  name: string
}): StationRef {
  return { id: e.id, key: e.shortName || e.number, name: e.name }
}

const STATION_SELECT = {
  id: true,
  number: true,
  shortName: true,
  name: true,
} as const

type RouteSort = (dir: Prisma.SortOrder) => Array<Prisma.RouteOrderByWithRelationInput>
type SegmentSort = (dir: Prisma.SortOrder) => Array<Prisma.SegmentOrderByWithRelationInput>

const ROUTES_BY_NUMBER: RouteSort = (dir) => [{ number: dir }]
const SEGMENTS_BY_ROUTE: SegmentSort = (dir) => [
  { route: { number: dir } },
  { number: 'asc' },
]

const ROUTE_SORTS: Record<string, RouteSort> = {
  number: ROUTES_BY_NUMBER,
  name: (dir) => [{ name: dir }],
  service: (dir) => [{ service: { shortName: dir } }, { number: 'asc' }],
  company: (dir) => [{ service: { company: { shortName: dir } } }, { number: 'asc' }],
  segments: (dir) => [{ segments: { _count: dir } }, { number: 'asc' }],
  price: (dir) => [{ priceOneWay: dir }],
  travelTime: (dir) => [{ travelTimeMinutes: dir }],
  distance: (dir) => [{ distanceKm: dir }],
  status: (dir) => [{ isActive: dir }, { number: 'asc' }],
}

const SEGMENT_SORTS: Record<string, SegmentSort> = {
  number: (dir) => [{ number: dir }],
  route: SEGMENTS_BY_ROUTE,
  origin: (dir) => [{ originStation: { shortName: dir } }],
  destination: (dir) => [{ destinationStation: { shortName: dir } }],
  stayTime: (dir) => [{ stayTimeMinutes: dir }],
  duration: (dir) => [{ durationMinutes: dir }],
  distance: (dir) => [{ distanceKm: dir }],
  sale: (dir) => [{ allowSale: dir }, { route: { number: 'asc' } }],
  price: (dir) => [{ priceOneWay: dir }],
  priceRound: (dir) => [{ priceRound: dir }],
  main: (dir) => [{ isMain: dir }, { route: { number: 'asc' } }],
  status: (dir) => [{ isActive: dir }, { route: { number: 'asc' } }],
}

/* ── Listing ────────────────────────────────────────────────────────────── */

async function readOptions(withRoutes: boolean): Promise<RouteFilterOptions> {
  const [companies, services, routes] = await Promise.all([
    db.company.findMany({
      where: { deletedAt: null },
      select: { id: true, key: true, shortName: true, tradeName: true },
      orderBy: { shortName: 'asc' },
    }),
    db.service.findMany({
      where: { deletedAt: null },
      select: { id: true, key: true, shortName: true },
      orderBy: { shortName: 'asc' },
    }),
    withRoutes
      ? db.route.findMany({
          where: { deletedAt: null },
          select: { id: true, number: true, name: true },
        })
      : Promise.resolve([]),
  ])

  return {
    companies: companies.map((e) => ({
      value: e.id,
      label: e.shortName || e.tradeName,
      note: e.key,
    })),
    services: services.map((s) => ({
      value: s.id,
      label: s.shortName,
      note: s.key,
    })),
    routes: routes
      .slice()
      .sort((a, b) => byNumber(a.number, b.number))
      .map((r) => ({ value: r.id, label: r.name, note: r.number })),
  }
}

export const listRoutes = createServerFn({ method: 'GET' })
  .inputValidator((input: RouteSearch) => input)
  .handler(async ({ data }): Promise<RoutesResponse> => {
    const {
      view,
      q,
      page,
      perPage,
      sort,
      dir,
      company,
      service,
      collection,
      iva,
      seats,
      status,
      route,
      main,
      sale,
      deleted,
    } = data

    const query = q.trim()
    const isActive = status.length === 1 ? status[0] === 'active' : undefined
    const skip = Math.max(0, (page - 1) * perPage)

    try {
      const [counts, options] = await Promise.all([
        Promise.all([
          db.route.count({ where: { deletedAt: null } }),
          db.segment.count({ where: { deletedAt: null } }),
        ]).then(([routesN, segmentsN]) => ({ routes: routesN, segments: segmentsN })),
        readOptions(view === 'segments'),
      ])

      if (view === 'segments') {
        const where: Prisma.SegmentWhereInput = {
          ...(deleted ? {} : { deletedAt: null, route: { deletedAt: null } }),
          ...(query
            ? {
                OR: [
                  { number: { contains: query, mode: 'insensitive' } },
                  {
                    originStation: {
                      OR: [
                        { name: { contains: query, mode: 'insensitive' } },
                        { shortName: { contains: query, mode: 'insensitive' } },
                        { number: { contains: query, mode: 'insensitive' } },
                      ],
                    },
                  },
                  {
                    destinationStation: {
                      OR: [
                        { name: { contains: query, mode: 'insensitive' } },
                        { shortName: { contains: query, mode: 'insensitive' } },
                        { number: { contains: query, mode: 'insensitive' } },
                      ],
                    },
                  },
                ],
              }
            : {}),
          ...(route.length ? { routeId: { in: route } } : {}),
          ...(service.length || company.length
            ? {
                route: {
                  ...(deleted ? {} : { deletedAt: null }),
                  ...(service.length ? { serviceId: { in: service } } : {}),
                  ...(company.length
                    ? { service: { companyId: { in: company } } }
                    : {}),
                },
              }
            : {}),
          ...(yesNo(main) !== undefined ? { isMain: yesNo(main) } : {}),
          ...(yesNo(sale) !== undefined ? { allowSale: yesNo(sale) } : {}),
          ...(isActive !== undefined ? { isActive: isActive } : {}),
        }

        const orderBy = (SEGMENT_SORTS[sort] ?? SEGMENTS_BY_ROUTE)(dir)

        const [records, total] = await Promise.all([
          db.segment.findMany({
            where,
            orderBy,
            skip,
            take: perPage,
            select: {
              id: true,
              number: true,
              stayTimeMinutes: true,
              durationMinutes: true,
              distanceKm: true,
              allowSale: true,
              isMain: true,
              isActive: true,
              deletedAt: true,
              priceOneWay: true,
              priceRound: true,
              route: { select: { id: true, number: true, name: true } },
              originStation: { select: STATION_SELECT },
              destinationStation: { select: STATION_SELECT },
            },
          }),
          db.segment.count({ where }),
        ])

        const rows: Array<SegmentRow> = records.map((t) => ({
          id: t.id,
          number: t.number,
          route: { id: t.route.id, number: t.route.number, name: t.route.name },
          origin: station(t.originStation),
          destination: station(t.destinationStation),
          stayTimeMinutes: t.stayTimeMinutes,
          durationMinutes: t.durationMinutes,
          distanceKm: t.distanceKm,
          allowSale: t.allowSale,
          priceOneWay: t.priceOneWay.toString(),
          priceRound: t.priceRound === null ? null : t.priceRound.toString(),
          isMain: t.isMain,
          isActive: t.isActive,
          isDeleted: t.deletedAt !== null,
        }))

        return { ok: true, view: 'segments', rows, total, counts, options }
      }

      const where: Prisma.RouteWhereInput = {
        ...(deleted ? {} : { deletedAt: null }),
        ...(query
          ? {
              OR: [
                { number: { contains: query, mode: 'insensitive' } },
                { name: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(service.length ? { serviceId: { in: service } } : {}),
        ...(company.length ? { service: { companyId: { in: company } } } : {}),
        ...(collection.length
          ? { collectionType: { in: collection as Array<'AUTOMATIC' | 'NORMAL'> } }
          : {}),
        ...(yesNo(iva) !== undefined ? { appliedIVA: yesNo(iva) } : {}),
        ...(yesNo(seats) !== undefined ? { hasSeatsSelection: yesNo(seats) } : {}),
        ...(isActive !== undefined ? { isActive: isActive } : {}),
      }

      const orderBy = (ROUTE_SORTS[sort] ?? ROUTES_BY_NUMBER)(dir)

      const [records, total] = await Promise.all([
        db.route.findMany({
          where,
          orderBy,
          skip,
          take: perPage,
          select: {
            id: true,
            number: true,
            name: true,
            priceOneWay: true,
            travelTimeMinutes: true,
            distanceKm: true,
            isActive: true,
            deletedAt: true,
            service: {
              select: {
                id: true,
                key: true,
                shortName: true,
                company: { select: { id: true, key: true, shortName: true } },
              },
            },
            origin: { select: STATION_SELECT },
            destination: { select: STATION_SELECT },
            _count: { select: { segments: { where: { deletedAt: null } } } },
          },
        }),
        db.route.count({ where }),
      ])

      const rows: Array<RouteRow> = records.map((r) => ({
        id: r.id,
        number: r.number,
        name: r.name,
        service: { id: r.service.id, label: r.service.shortName },
        company: { id: r.service.company.id, label: r.service.company.shortName },
        origin: station(r.origin),
        destination: station(r.destination),
        segments: r._count.segments,
        priceOneWay: r.priceOneWay.toString(),
        travelTimeMinutes: r.travelTimeMinutes,
        distanceKm: r.distanceKm,
        isActive: r.isActive,
        isDeleted: r.deletedAt !== null,
      }))

      return { ok: true, view: 'routes', rows, total, counts, options }
    } catch (error) {
      console.error('[routes]', error)
      return { ok: false, failure: describeFailure(error) }
    }
  })

/* ── Detail ─────────────────────────────────────────────────────────────── */

export type SegmentDetail = {
  id: string
  number: string
  origin: StationRef
  destination: StationRef
  stayTimeMinutes: number
  durationMinutes: number
  distanceKm: number | null
  allowSale: boolean
  priceOneWay: string
  priceRound: string | null
  isMain: boolean
  isActive: boolean
}

export type RouteDetail = {
  id: string
  number: string
  name: string
  service: { id: string; key: string; name: string }
  company: { id: string; key: string; name: string }
  origin: StationRef
  destination: StationRef
  collectionType: string
  appliedIva: boolean
  hasSeatsSelection: boolean
  unit: string | null
  isActive: boolean
  isDeleted: boolean
  priceOneWay: string
  priceRound: string | null
  travelTimeMinutes: number
  distanceKm: number
  stayTimeMinutes: number
  salesChannels: Array<{ id: string; name: string; isActive: boolean; isDeleted: boolean }>
  passengerTypes: Array<{
    id: string
    key: string
    name: string
    discountPercent: number
    seatingLimit: number | null
    isActive: boolean
  }>
  stops: Array<{ id: string; name: string; order: number; isActive: boolean }>
  segments: Array<SegmentDetail>
  deletedSegments: number
}

export type RouteResponse =
  | { ok: true; route: RouteDetail }
  | { ok: false; failure: Failure }

export const getRoute = createServerFn({ method: 'GET' })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }): Promise<RouteResponse> => {
    try {
      const r = await db.route.findUnique({
        where: { id: data.id },
        select: {
          id: true,
          number: true,
          name: true,
          collectionType: true,
          priceOneWay: true,
          priceRound: true,
          travelTimeMinutes: true,
          distanceKm: true,
          stayTimeMinutes: true,
          appliedIVA: true,
          hasSeatsSelection: true,
          isActive: true,
          deletedAt: true,
          service: {
            select: {
              id: true,
              key: true,
              shortName: true,
              company: { select: { id: true, key: true, shortName: true } },
            },
          },
          origin: { select: STATION_SELECT },
          destination: { select: STATION_SELECT },
          unit: { select: { id: true, name: true } },
          salesChannels: {
            select: {
              salesChannel: {
                select: { id: true, name: true, isActive: true, deletedAt: true },
              },
            },
          },
          passengerTypes: {
            select: {
              seatingLimit: true,
              passengerType: {
                select: {
                  id: true,
                  key: true,
                  name: true,
                  discountPercent: true,
                  isActive: true,
                },
              },
            },
          },
          stops: {
            select: { id: true, name: true, order: true, isActive: true },
            orderBy: { order: 'asc' },
          },
          segments: {
            where: { deletedAt: null },
            select: {
              id: true,
              number: true,
              stayTimeMinutes: true,
              durationMinutes: true,
              distanceKm: true,
              allowSale: true,
              isMain: true,
              isActive: true,
              priceOneWay: true,
              priceRound: true,
              originStation: { select: STATION_SELECT },
              destinationStation: { select: STATION_SELECT },
            },
          },
          _count: { select: { segments: { where: { NOT: { deletedAt: null } } } } },
        },
      })

      if (!r) {
        return {
          ok: false,
          failure: {
            title: 'La ruta no existe',
            detail: `No hay ninguna ruta con el identificador ${data.id}.`,
            suggestion:
              'Es posible que el registro se haya eliminado de la base o que el enlace esté mal copiado.',
          },
        }
      }

      const route: RouteDetail = {
        id: r.id,
        number: r.number,
        name: r.name,
        service: {
          id: r.service.id,
          key: r.service.key,
          name: r.service.shortName,
        },
        company: {
          id: r.service.company.id,
          key: r.service.company.key,
          name: r.service.company.shortName,
        },
        origin: station(r.origin),
        destination: station(r.destination),
        collectionType: r.collectionType,
        appliedIva: r.appliedIVA,
        hasSeatsSelection: r.hasSeatsSelection,
        unit: r.unit?.name ?? null,
        isActive: r.isActive,
        isDeleted: r.deletedAt !== null,
        priceOneWay: r.priceOneWay.toString(),
        priceRound: r.priceRound === null ? null : r.priceRound.toString(),
        travelTimeMinutes: r.travelTimeMinutes,
        distanceKm: r.distanceKm,
        stayTimeMinutes: r.stayTimeMinutes,
        salesChannels: r.salesChannels
          .map((c) => ({
            id: c.salesChannel.id,
            name: c.salesChannel.name,
            isActive: c.salesChannel.isActive,
            isDeleted: c.salesChannel.deletedAt !== null,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'es')),
        passengerTypes: r.passengerTypes
          .map((p) => ({
            id: p.passengerType.id,
            key: p.passengerType.key,
            name: p.passengerType.name,
            discountPercent: p.passengerType.discountPercent,
            seatingLimit: p.seatingLimit,
            isActive: p.passengerType.isActive,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'es')),
        stops: r.stops.map((p) => ({
          id: p.id,
          name: p.name,
          order: p.order,
          isActive: p.isActive,
        })),
        segments: r.segments
          .map((t) => ({
            id: t.id,
            number: t.number,
            origin: station(t.originStation),
            destination: station(t.destinationStation),
            stayTimeMinutes: t.stayTimeMinutes,
            durationMinutes: t.durationMinutes,
            distanceKm: t.distanceKm,
            allowSale: t.allowSale,
            priceOneWay: t.priceOneWay.toString(),
            priceRound: t.priceRound === null ? null : t.priceRound.toString(),
            isMain: t.isMain,
            isActive: t.isActive,
          }))
          .sort((a, b) => byNumber(a.number, b.number)),
        deletedSegments: r._count.segments,
      }

      return { ok: true, route }
    } catch (error) {
      console.error('[route]', error)
      return { ok: false, failure: describeFailure(error) }
    }
  })
