import { createServerFn } from '@tanstack/react-start'
import type { Prisma } from '@prisma/generated'
import { db, describeFailure } from './db'
import { clampPage, range } from '~/lib/params'
import { LEGACY_OFFSET_HOURS } from '~/lib/format'
import { parseIsoDate } from './trips'

/**
 * Boletos — the individual tickets a legacy `boletos.csv` sale event became
 * after `POST /seeds/import/boletos` (see the backend's `importBoletos`).
 * "Boleto" here is `OrderItem`; there is no `Ticket` model.
 *
 * Two facts drive nearly every choice below, both verified against the
 * importer and the connected database:
 *
 * 1. `OrderItem` has no `tripId` of its own — the only path to a corrida is
 *    `tripSeat.trip`, and a `TripSeat` exists only when the CSV's
 *    `NO_ASIENTO` was non-null. "Sin asiento" and "sin corrida" are the same
 *    fact: `tripSeatId === null`.
 * 2. `OrderItem.createdAt`/`canceledAt`, `Order.createdAt`/`issuedAt` and
 *    `OrderItemStatusHistory.createdAt` are all written through the backend's
 *    `dateTimeTZ` — the same helper `Trip.departure` uses. See
 *    `~/lib/format`'s `LEGACY_OFFSET_HOURS` note for the mechanism. Every
 *    date boundary here is built in that shifted (stored) space, and every
 *    timestamp is displayed with `legacyDateTime`, never the plain
 *    `dateTime` (which would read 6 hours late).
 *
 * `OrderItem` has no `deletedAt` — a cancelled boleto is still a migrated
 * one, and its `status` carries that fact, so no query here filters on a
 * soft delete.
 */

export const TICKET_SORTS = [
  'folio',
  'sold',
  'status',
  'passenger',
  'passengerType',
  'company',
  'service',
  'type',
  'payment',
  'channel',
  'terminal',
  'total',
  'invoice',
] as const
export type TicketSort = (typeof TICKET_SORTS)[number]

export const TICKET_STATUSES = [
  'PAID',
  'EXCHANGED',
  'NOT_EXCHANGED',
  'TRAVELED',
  'NOT_TRAVELED',
  'CANCELED',
  'APPROACHED',
  'EXPIRED',
] as const
export type TicketStatusValue = (typeof TICKET_STATUSES)[number]

export const PAYMENT_METHODS = ['CASH', 'MIT', 'MPAGO', 'STRIPE', 'POINTS', 'NO_CHARGE'] as const
export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number]

export const ORDER_TYPES = ['ONE_WAY', 'ROUND', 'OPEN', 'OPEN_ROUND', 'SURCHARGE', 'REFUND'] as const
export type OrderTypeValue = (typeof ORDER_TYPES)[number]

/**
 * A boleto's reconstructed "Tipo de operación". The CSV's own column
 * (VT/VA/CN/HO/AC) does not survive the import as a stored field — see
 * `classifyMovements` below for how it's rebuilt from
 * `OrderItemStatusHistory` + `Order.type`.
 */
export const TICKET_OPERATIONS = ['SALE', 'OPEN_SALE', 'CHANGED', 'EXCHANGED', 'CANCELED'] as const
export type TicketOperation = (typeof TICKET_OPERATIONS)[number]

export type TicketSearch = {
  q: string
  date: string
  page: number
  perPage: number
  sort: TicketSort
  dir: 'asc' | 'desc'
  company: Array<string>
  service: Array<string>
  status: Array<TicketStatusValue>
  channel: Array<string>
  payment: Array<PaymentMethodValue>
  type: Array<OrderTypeValue>
  terminal: Array<string>
  /** Trip id (the legacy "clave de corrida") — written only by the
   *  `/corridas` cross-link, never offered as a dropdown (5,014 trips). */
  trip: Array<string>
}

type Failure = ReturnType<typeof describeFailure>

export type FilterOption = { value: string; label: string; note?: string }
export type StationRef = { id: string; key: string; name: string }

export type TicketFilterOptions = {
  companies: Array<FilterOption>
  services: Array<FilterOption>
  channels: Array<FilterOption>
  terminals: Array<FilterOption>
}

export type TicketRow = {
  id: string
  folio: string
  status: string
  operation: TicketOperation
  soldAt: string
  operatedAt: string
  passenger: string | null
  passengerType: { id: string; key: string; name: string } | null
  company: { id: string; label: string } | null
  service: { id: string; label: string } | null
  trip: { id: string } | null
  route: { number: string } | null
  type: string
  payment: string
  channel: string | null
  terminal: StationRef | null
  invoiceCode: string | null
  total: string
  seat: number | null
}

export type TicketsResponse =
  | { ok: true; rows: Array<TicketRow>; total: number; page: number; options: TicketFilterOptions }
  | { ok: false; failure: Failure }

/* ── Date bounds ────────────────────────────────────────────────────────── */

/** A calendar day of sales, in stored (shifted) instant space: local midnight
 *  of day D is the stored instant `D 06:00 UTC` — see `~/lib/format`'s
 *  `LEGACY_OFFSET_HOURS` note. `lt` is exclusive. */
function dayBounds(dateIso: string): { gte: Date; lt: Date } {
  const { year, month, day } = parseIsoDate(dateIso)
  return {
    gte: new Date(Date.UTC(year, month - 1, day, LEGACY_OFFSET_HOURS)),
    lt: new Date(Date.UTC(year, month - 1, day + 1, LEGACY_OFFSET_HOURS)),
  }
}

/* ── Shared shapes ──────────────────────────────────────────────────────── */

const STATION_SELECT = { id: true, number: true, shortName: true, name: true } as const

function station(e: { id: string; number: string; shortName: string; name: string }): StationRef {
  return { id: e.id, key: e.shortName || e.number, name: e.name }
}

/**
 * Rebuilds "Tipo de operación" and "Fecha y hora de operación" from one pass
 * over a folio's movement history. The newest non-PAID movement wins; ties
 * are broken toward "not PAID" on purpose (`>=`, not `>`) because a lifecycle
 * row can reuse its sale row's exact timestamp when its own date failed to
 * parse (the backend falls back to the sale's `createdAt` in that case) —
 * `orderBy: createdAt desc, take: 1` would silently return PAID for a
 * cancelled folio in that situation. With no non-PAID movement, the folio is
 * whatever the sale row made it: an open sale (`Order.type` OPEN/OPEN_ROUND,
 * i.e. the CSV said `VA`) or a plain sale.
 */
function classifyMovements(
  movements: Array<{ movementType: string; createdAt: Date }>,
  orderType: string,
  soldAt: Date,
): { operation: TicketOperation; operatedAt: Date } {
  let latest: { movementType: string; createdAt: Date } | null = null
  for (const m of movements) {
    if (m.movementType === 'PAID') continue
    if (!latest || m.createdAt >= latest.createdAt) latest = m
  }
  if (latest) {
    const operation: TicketOperation =
      latest.movementType === 'CANCELED'
        ? 'CANCELED'
        : latest.movementType === 'EXCHANGED'
          ? 'EXCHANGED'
          : 'CHANGED' // HO, and any movement code this file doesn't otherwise recognize
    return { operation, operatedAt: latest.createdAt }
  }
  return {
    operation: orderType === 'OPEN' || orderType === 'OPEN_ROUND' ? 'OPEN_SALE' : 'SALE',
    operatedAt: soldAt,
  }
}

/**
 * `channels`: the whole `SalesChannel` catalog (8 rows, fixed and pre-seeded,
 * not migration-dependent) — a channel with zero tickets is itself a finding,
 * same reasoning as `readTripOptions`'s catalogs.
 * `terminals`: NOT every station — only the ones with a placeholder
 * `CashRegister` that actually carries an order. The importer creates one
 * such register per `TERMINAL_VENTA` it could resolve (a real `Station`,
 * matched by `shortName`), so the station identity is genuine migrated data
 * even though the specific register is a stand-in for the legacy `CAJA_VENTA`
 * (which is never imported) — see `~/server/seeds`'s Boletos step description.
 */
async function readTicketOptions(): Promise<TicketFilterOptions> {
  const [companies, services, channels, registers] = await Promise.all([
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
    db.salesChannel.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    db.cashRegister.findMany({
      where: { orders: { some: {} } },
      select: { station: { select: STATION_SELECT } },
      orderBy: { station: { shortName: 'asc' } },
    }),
  ])

  // One register per station today, but dedupe anyway: the filter is by
  // terminal (station), and the column prints `station.shortName`.
  const terminals = new Map<string, FilterOption>()
  for (const r of registers) {
    if (terminals.has(r.station.id)) continue
    terminals.set(r.station.id, {
      value: r.station.id,
      label: r.station.shortName || r.station.number,
      note: r.station.name,
    })
  }

  return {
    companies: companies.map((c) => ({ value: c.id, label: c.shortName, note: c.key })),
    services: services.map((s) => ({ value: s.id, label: s.shortName, note: s.key })),
    channels: channels.map((c) => ({ value: c.id, label: c.name })),
    terminals: Array.from(terminals.values()),
  }
}

/* ── List ───────────────────────────────────────────────────────────────── */

const TICKET_SELECT = {
  id: true,
  ticketNumber: true,
  status: true,
  totalPrice: true,
  invoiceCode: true,
  createdAt: true,
  passenger: {
    select: {
      name: true,
      // Tipo de pasajero lives here and ONLY here: the importer never sets
      // `TripSeat.passengerTypeId`.
      passengerType: { select: { id: true, key: true, name: true } },
    },
  },
  // `routeId` is `Trip.routeId`, written unconditionally by the importer, so
  // empresa/servicio resolve even for tickets with no seat/trip — no
  // `tripSeat.trip.route` fallback is needed.
  route: {
    select: {
      number: true,
      service: {
        select: {
          id: true,
          shortName: true,
          company: { select: { id: true, shortName: true } },
        },
      },
    },
  },
  tripSeat: {
    select: {
      number: true,
      trip: { select: { id: true } },
    },
  },
  order: {
    select: {
      type: true,
      paymentMethod: true,
      salesChannel: { select: { name: true } },
      cashRegister: { select: { station: { select: STATION_SELECT } } },
    },
  },
} satisfies Prisma.OrderItemSelect

type TicketOrder = (dir: 'asc' | 'desc') => Array<Prisma.OrderItemOrderByWithRelationInput>

/**
 * Every sort ends on `ticketNumber` (`@unique`), stricter than `trips.ts`'s
 * `TRIP_SORT_MAP` (which tiebreaks on the non-unique `departure`): a bulk
 * import repeats `createdAt` by the hundred, and a non-unique `ORDER BY` lets
 * Postgres reshuffle ties between two `OFFSET` pages — one row shows twice,
 * another never shows.
 */
const FOLIO: Prisma.OrderItemOrderByWithRelationInput = { ticketNumber: 'asc' }
const TICKET_BY_SOLD: TicketOrder = (dir) => [{ createdAt: dir }, FOLIO]

const TICKET_SORT_MAP: Record<string, TicketOrder> = {
  folio: (dir) => [{ ticketNumber: dir }],
  sold: TICKET_BY_SOLD,
  // Enum columns order by the Postgres `CREATE TYPE` declaration order, not
  // alphabetically and not by the Spanish label — same as `status`/`type` in
  // `TRIP_SORT_MAP`.
  status: (dir) => [{ status: dir }, FOLIO],
  passenger: (dir) => [{ passenger: { name: dir } }, FOLIO],
  passengerType: (dir) => [{ passenger: { passengerType: { name: dir } } }, FOLIO],
  company: (dir) => [{ route: { service: { company: { shortName: dir } } } }, FOLIO],
  service: (dir) => [{ route: { service: { shortName: dir } } }, FOLIO],
  type: (dir) => [{ order: { type: dir } }, FOLIO],
  payment: (dir) => [{ order: { paymentMethod: dir } }, FOLIO],
  channel: (dir) => [{ order: { salesChannel: { name: dir } } }, FOLIO],
  terminal: (dir) => [{ order: { cashRegister: { station: { shortName: dir } } } }, FOLIO],
  total: (dir) => [{ totalPrice: dir }, FOLIO],
  invoice: (dir) => [{ invoiceCode: { sort: dir, nulls: 'last' } }, FOLIO],
}

export const listTickets = createServerFn({ method: 'GET' })
  .inputValidator((input: TicketSearch) => input)
  .handler(async ({ data }): Promise<TicketsResponse> => {
    try {
      const q = data.q.trim()

      const routeConditions: Prisma.RouteWhereInput = {
        ...(data.service.length ? { serviceId: { in: data.service } } : {}),
        ...(data.company.length ? { service: { companyId: { in: data.company } } } : {}),
      }
      const hasRouteConditions = Object.keys(routeConditions).length > 0

      const orderConditions: Prisma.OrderWhereInput = {
        ...(data.channel.length ? { salesChannelId: { in: data.channel } } : {}),
        ...(data.payment.length ? { paymentMethod: { in: data.payment } } : {}),
        ...(data.type.length ? { type: { in: data.type } } : {}),
        // The column prints `cashRegister.station.shortName`, so the filter
        // keys on the station, not on the placeholder register itself.
        ...(data.terminal.length ? { cashRegister: { stationId: { in: data.terminal } } } : {}),
      }
      const hasOrderConditions = Object.keys(orderConditions).length > 0

      const where: Prisma.OrderItemWhereInput = {
        ...(data.date ? { createdAt: dayBounds(data.date) } : {}),
        ...(data.status.length ? { status: { in: data.status } } : {}),
        // `OrderItem` has no `tripId`: `tripSeat` is the ONLY path to a
        // corrida, and the importer creates a `TripSeat` only when
        // `NO_ASIENTO` is non-null.
        ...(data.trip.length ? { tripSeat: { tripId: { in: data.trip } } } : {}),
        ...(hasRouteConditions ? { route: routeConditions } : {}),
        ...(hasOrderConditions ? { order: orderConditions } : {}),
        ...(q
          ? {
              OR: [
                { ticketNumber: { contains: q, mode: 'insensitive' } },
                { passenger: { name: { contains: q, mode: 'insensitive' } } },
                // `Trip.id` IS the clave de corrida in the migrated data —
                // see the note in `trips.ts`.
                { tripSeat: { trip: { id: { contains: q, mode: 'insensitive' } } } },
              ],
            }
          : {}),
      }

      const select = TICKET_SELECT
      const orderBy = (TICKET_SORT_MAP[data.sort] ?? TICKET_BY_SOLD)(data.dir)

      const [rawRows, total, options] = await Promise.all([
        db.orderItem.findMany({ where, orderBy, select, ...range(data.page, data.perPage) }),
        db.orderItem.count({ where }),
        readTicketOptions(),
      ])

      // Filters can leave fewer pages than the URL asked for: better the last
      // page with data than a blank one — same pattern as `listTrips`.
      const corrected = clampPage(data.page, total, data.perPage)
      const records =
        rawRows.length === 0 && total > 0 && corrected !== data.page
          ? await db.orderItem.findMany({ where, orderBy, select, ...range(corrected, data.perPage) })
          : rawRows
      const page = records === rawRows ? data.page : corrected

      // Tipo de operación / Fecha y hora de operación need the folio's full
      // movement history, the one to-many here — fetched separately, not
      // nested `take: 1`, per `classifyMovements`'s doc comment above.
      const itemIds = records.map((t) => t.id)
      const movementRows = itemIds.length
        ? await db.orderItemStatusHistory.findMany({
            where: { orderItemId: { in: itemIds } },
            select: { orderItemId: true, movementType: true, createdAt: true },
          })
        : []
      const movementsByItem = new Map<string, Array<{ movementType: string; createdAt: Date }>>()
      for (const m of movementRows) {
        const entry = { movementType: m.movementType, createdAt: m.createdAt }
        const list = movementsByItem.get(m.orderItemId)
        if (list) list.push(entry)
        else movementsByItem.set(m.orderItemId, [entry])
      }

      const rows: Array<TicketRow> = records.map((t) => {
        const { operation, operatedAt } = classifyMovements(
          movementsByItem.get(t.id) ?? [],
          t.order.type,
          t.createdAt,
        )
        return {
          id: t.id,
          folio: t.ticketNumber,
          status: t.status,
          operation,
          soldAt: t.createdAt.toISOString(),
          operatedAt: operatedAt.toISOString(),
          passenger: t.passenger?.name ?? null,
          passengerType: t.passenger?.passengerType ?? null,
          company: t.route
            ? { id: t.route.service.company.id, label: t.route.service.company.shortName }
            : null,
          service: t.route ? { id: t.route.service.id, label: t.route.service.shortName } : null,
          trip: t.tripSeat ? { id: t.tripSeat.trip.id } : null,
          route: t.route ? { number: t.route.number } : null,
          type: t.order.type,
          payment: t.order.paymentMethod,
          channel: t.order.salesChannel?.name ?? null,
          terminal: t.order.cashRegister ? station(t.order.cashRegister.station) : null,
          invoiceCode: t.invoiceCode,
          total: t.totalPrice.toString(),
          seat: t.tripSeat?.number ?? null,
        }
      })

      return { ok: true, rows, total, page, options }
    } catch (error) {
      console.error('[tickets] list', error)
      return { ok: false, failure: describeFailure(error) }
    }
  })

/* ── Detail ─────────────────────────────────────────────────────────────── */

export type TicketMovement = {
  id: string
  movementType: string
  createdAt: string
  oldStatus: string | null
  oldTripId: string | null
  oldSeatNumber: number | null
  oldTotalPrice: string | null
  oldOriginShortName: string | null
  oldDestinationShortName: string | null
  oldTicketNumber: string | null
  newTicketNumber: string | null
  reason: string | null
}

export type TicketDetail = {
  id: string
  folio: string
  status: string
  operation: TicketOperation
  soldAt: string
  operatedAt: string
  canceledAt: string | null
  basePrice: string
  tax: string
  discount: string
  totalPrice: string
  isInvoiced: boolean
  invoiceCode: string | null
  isOutbound: boolean | null
  passenger: {
    name: string
    isMainPassenger: boolean
    passengerType: { id: string; key: string; name: string } | null
  } | null
  company: { id: string; name: string } | null
  service: { id: string; name: string } | null
  route: { id: string; number: string; name: string } | null
  origin: StationRef | null
  destination: StationRef | null
  trip: { id: string; departure: string } | null
  seat: number | null
  type: string
  payment: string
  channel: string | null
  terminal: StationRef | null
  orderId: string
  createdAt: string
  updatedAt: string
  movements: Array<TicketMovement>
}

export type TicketResponse = { ok: true; ticket: TicketDetail } | { ok: false; failure: Failure }

/** Keyed on the folio (`ticketNumber`, `@unique`), not the uuid — a folio is
 *  what an analyst has in hand to paste from the legacy report, the same way
 *  `/corridas/$id` is keyed on `Trip.id` (the clave de corrida). */
export const getTicket = createServerFn({ method: 'GET' })
  .inputValidator((input: { folio: string }) => input)
  .handler(async ({ data }): Promise<TicketResponse> => {
    try {
      const t = await db.orderItem.findUnique({
        where: { ticketNumber: data.folio },
        select: {
          id: true,
          ticketNumber: true,
          status: true,
          basePrice: true,
          tax: true,
          discount: true,
          totalPrice: true,
          isInvoiced: true,
          invoiceCode: true,
          isOutbound: true,
          canceledAt: true,
          createdAt: true,
          updatedAt: true,
          orderId: true,
          passenger: {
            select: {
              name: true,
              isMainPassenger: true,
              passengerType: { select: { id: true, key: true, name: true } },
            },
          },
          route: {
            select: {
              id: true,
              number: true,
              name: true,
              service: {
                select: {
                  id: true,
                  shortName: true,
                  company: { select: { id: true, shortName: true } },
                },
              },
            },
          },
          segment: {
            select: {
              originStation: { select: STATION_SELECT },
              destinationStation: { select: STATION_SELECT },
            },
          },
          tripSeat: {
            select: {
              number: true,
              trip: { select: { id: true, departure: true } },
            },
          },
          order: {
            select: {
              type: true,
              paymentMethod: true,
              salesChannel: { select: { name: true } },
              cashRegister: { select: { station: { select: STATION_SELECT } } },
            },
          },
          // One folio, a handful of rows shown in full, in order: no tie
          // hazard here the way the list's separate lookup has to guard for.
          movementHistory: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              movementType: true,
              createdAt: true,
              oldStatus: true,
              oldTripId: true,
              oldSeatNumber: true,
              oldTotalPrice: true,
              oldOriginShortName: true,
              oldDestinationShortName: true,
              oldTicketNumber: true,
              newTicketNumber: true,
              reason: true,
            },
          },
        },
      })

      if (!t) {
        return {
          ok: false,
          failure: {
            title: 'El boleto no existe',
            detail: `No hay ningún boleto con el folio ${data.folio}.`,
            // Mirrors the skip reasons of the backend's `importBoletos`
            // (TRIP_NOT_FOUND, FOLIO_MISSING_SALE_ROW, OPEN_LEG_WITHOUT_OUTBOUND,
            // REFERENCED_OPERATION_EXCLUDED, STATION/SEGMENT_NOT_FOUND).
            suggestion:
              'Es posible que el importador lo haya descartado: su corrida no viene en CORRIDAS_TARJETAS; el folio no tiene fila de venta (VT/VA) propia —todo cambio de horario (HO) y canje (AC) cae aquí, igual que una cancelación sin venta—; es un abierto (VA) sin tramo de ida en su transacción; es FO/FT; o su terminal o tramo no se resolvió. También puede que el folio esté mal copiado.',
          },
        }
      }

      const { operation, operatedAt } = classifyMovements(
        t.movementHistory.map((m) => ({ movementType: m.movementType, createdAt: m.createdAt })),
        t.order.type,
        t.createdAt,
      )

      const ticket: TicketDetail = {
        id: t.id,
        folio: t.ticketNumber,
        status: t.status,
        operation,
        soldAt: t.createdAt.toISOString(),
        operatedAt: operatedAt.toISOString(),
        canceledAt: t.canceledAt ? t.canceledAt.toISOString() : null,
        basePrice: t.basePrice.toString(),
        tax: t.tax.toString(),
        discount: t.discount.toString(),
        totalPrice: t.totalPrice.toString(),
        isInvoiced: t.isInvoiced,
        invoiceCode: t.invoiceCode,
        isOutbound: t.isOutbound,
        passenger: t.passenger
          ? {
              name: t.passenger.name,
              isMainPassenger: t.passenger.isMainPassenger,
              passengerType: t.passenger.passengerType,
            }
          : null,
        company: t.route ? { id: t.route.service.company.id, name: t.route.service.company.shortName } : null,
        service: t.route ? { id: t.route.service.id, name: t.route.service.shortName } : null,
        route: t.route ? { id: t.route.id, number: t.route.number, name: t.route.name } : null,
        origin: t.segment ? station(t.segment.originStation) : null,
        destination: t.segment ? station(t.segment.destinationStation) : null,
        trip: t.tripSeat ? { id: t.tripSeat.trip.id, departure: t.tripSeat.trip.departure.toISOString() } : null,
        seat: t.tripSeat?.number ?? null,
        type: t.order.type,
        payment: t.order.paymentMethod,
        channel: t.order.salesChannel?.name ?? null,
        terminal: t.order.cashRegister ? station(t.order.cashRegister.station) : null,
        orderId: t.orderId,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        movements: t.movementHistory.map((m) => ({
          id: m.id,
          movementType: m.movementType,
          createdAt: m.createdAt.toISOString(),
          oldStatus: m.oldStatus,
          oldTripId: m.oldTripId,
          oldSeatNumber: m.oldSeatNumber,
          oldTotalPrice: m.oldTotalPrice ? m.oldTotalPrice.toString() : null,
          oldOriginShortName: m.oldOriginShortName,
          oldDestinationShortName: m.oldDestinationShortName,
          oldTicketNumber: m.oldTicketNumber,
          newTicketNumber: m.newTicketNumber,
          reason: m.reason,
        })),
      }

      return { ok: true, ticket }
    } catch (error) {
      console.error('[tickets] detail', error)
      return { ok: false, failure: describeFailure(error) }
    }
  })

/* ── Health ─────────────────────────────────────────────────────────────── */

export type TicketHealth = {
  total: number
  withoutTrip: number
  withoutRoute: number
  withoutPassengerType: number
  noCharge: number
}

export type TicketHealthResponse = { ok: true; health: TicketHealth } | { ok: false; failure: Failure }

/**
 * Unfiltered "did the import land?" counts — kept separate from `listTickets`
 * on purpose: they answer a question about the whole import, not the current
 * filter, so folding them in would mean either recomputing them on every
 * filter/sort/page change or showing a stale baseline next to a filtered
 * total. Mirrors `~/server/summary`'s role for the master catalogs.
 */
export const getTicketHealth = createServerFn({ method: 'GET' }).handler(
  async (): Promise<TicketHealthResponse> => {
    try {
      const [total, withoutTrip, withoutRoute, withoutPassengerType, noCharge] = await Promise.all([
        db.orderItem.count(),
        // Index-backed: `tripSeatId` leads `OrderItem_tripSeatId_segmentId_key`.
        db.orderItem.count({ where: { tripSeatId: null } }),
        // Expected to stay 0 — the importer always writes `routeId` and skips
        // rows it can't resolve. A nonzero value means an OrderItem arrived by
        // some other path.
        db.orderItem.count({ where: { routeId: null } }),
        db.orderItem.count({
          where: { OR: [{ passenger: { is: null } }, { passenger: { passengerTypeId: null } }] },
        }),
        // NOT a failure count on its own: `resolvePaymentMethod` sends several
        // legitimate voucher codes here alongside every unrecognized one, and
        // the database can't tell them apart — "sin cobro", never "errores".
        db.orderItem.count({ where: { order: { paymentMethod: 'NO_CHARGE' } } }),
      ])
      return { ok: true, health: { total, withoutTrip, withoutRoute, withoutPassengerType, noCharge } }
    } catch (error) {
      console.error('[tickets] health', error)
      return { ok: false, failure: describeFailure(error) }
    }
  },
)
