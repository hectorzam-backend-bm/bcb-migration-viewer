import { createServerFn } from '@tanstack/react-start'
import type { Prisma } from '@prisma/generated'
import { db, describeFailure } from './db'
import { clampPage, range } from '~/lib/params'

/* ── View contract ─────────────────────────────────────────────────────────
   One travel card ("tarjeta de viaje") per trip. The legacy ones come from
   `/seeds/import/travel-cards` (CORRIDAS_TARJETAS.csv), always COLLECTED:
   seven amount lines (only the three sales concepts carry legacy data), one
   collection with the collected amount, and the trip's `TripDispatch`.
   `departure`/`confirmedAt`/`collectedAt` are legacy-shifted instants — see
   `~/lib/format`'s `LEGACY_OFFSET_HOURS`.                                   */

type Failure = ReturnType<typeof describeFailure>

export const TRAVEL_CARD_SORTS = ['key', 'departure', 'collected', 'amount'] as const
export type TravelCardSort = (typeof TRAVEL_CARD_SORTS)[number]

export type TravelCardSearch = {
  q: string
  page: number
  perPage: number
  sort: TravelCardSort
  dir: 'asc' | 'desc'
}

export type TravelCardRow = {
  id: string
  number: string
  key: string | null
  status: string
  departure: string
  collectedAt: string | null
  trip: { id: string; isDeleted: boolean }
  route: { id: string; number: string; name: string }
  /** `TravelCardCollection.expectedAmount`; null while the card is not collected. */
  collectedAmount: string | null
}

export type TravelCardsResponse =
  | { ok: true; rows: Array<TravelCardRow>; total: number; catalogTotal: number; page: number }
  | { ok: false; failure: Failure }

function travelCardOrderBy(
  sort: TravelCardSort,
  dir: 'asc' | 'desc',
): Array<Prisma.TravelCardOrderByWithRelationInput> {
  switch (sort) {
    case 'key':
      return [{ key: { sort: dir, nulls: 'last' } }]
    case 'collected':
      return [{ collectedAt: { sort: dir, nulls: 'last' } }, { departure: 'asc' }]
    case 'amount':
      return [{ collection: { expectedAmount: dir } }, { departure: 'asc' }]
    default:
      return [{ departure: dir }, { tripId: 'asc' }]
  }
}

export const listTravelCards = createServerFn({ method: 'GET' })
  .inputValidator((input: TravelCardSearch) => input)
  .handler(async ({ data }): Promise<TravelCardsResponse> => {
    const q = data.q.trim()

    try {
      const where: Prisma.TravelCardWhereInput = q
        ? {
            OR: [
              { key: { contains: q, mode: 'insensitive' } },
              { number: q },
              { tripId: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}

      const [total, catalogTotal] = await Promise.all([db.travelCard.count({ where }), db.travelCard.count()])
      const page = clampPage(data.page, total, data.perPage)

      const rows = await db.travelCard.findMany({
        where,
        orderBy: travelCardOrderBy(data.sort, data.dir),
        ...range(page, data.perPage),
        select: {
          id: true,
          number: true,
          key: true,
          status: true,
          departure: true,
          collectedAt: true,
          trip: {
            select: {
              id: true,
              deletedAt: true,
              route: { select: { id: true, number: true, name: true } },
            },
          },
          collection: { select: { expectedAmount: true } },
        },
      })

      return {
        ok: true,
        total,
        catalogTotal,
        page,
        rows: rows.map((c) => ({
          id: c.id,
          number: c.number,
          key: c.key,
          status: c.status,
          departure: c.departure.toISOString(),
          collectedAt: c.collectedAt ? c.collectedAt.toISOString() : null,
          trip: { id: c.trip.id, isDeleted: c.trip.deletedAt !== null },
          route: c.trip.route,
          collectedAmount: c.collection ? c.collection.expectedAmount.toString() : null,
        })),
      }
    } catch (error) {
      console.error('[travel-cards]', error)
      return { ok: false, failure: describeFailure(error) }
    }
  })

/* ── Detail ────────────────────────────────────────────────────────────── */

export type AmountLine = { concept: string; quantity: number; amount: string }

export type TravelCardDetail = {
  id: string
  number: string
  key: string | null
  status: string
  departure: string
  confirmedAt: string | null
  collectedAt: string | null
  cancelledAt: string | null
  operatorPaymentAmount: string | null
  trip: { id: string; status: string; isDeleted: boolean }
  route: { id: string; number: string; name: string }
  service: { id: string; name: string }
  /** From `TripDispatch` — the operator/bus snapshot cuts and PDFs read. */
  dispatch: {
    operator: { key: string; name: string }
    bus: { economicNumber: string; isPlaceholder: boolean }
  } | null
  amountLines: Array<AmountLine>
  collection: {
    collectionNumber: number
    expectedAmount: string
    collectedBy: string | null
    createdAt: string
  } | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export type TravelCardResponse = { ok: true; card: TravelCardDetail } | { ok: false; failure: Failure }

/** The app's own order of `CollectionConcept`, the one the card prints. */
const CONCEPT_ORDER = [
  'SYSTEM_SALES',
  'ONBOARD_SALES',
  'MANUAL_SALES',
  'PREPAID_TICKETS',
  'PREPAID_RECHARGES',
  'PREPAID_SALES',
  'PENALTY',
]

export const getTravelCard = createServerFn({ method: 'GET' })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }): Promise<TravelCardResponse> => {
    try {
      const c = await db.travelCard.findUnique({
        where: { id: data.id },
        select: {
          id: true,
          number: true,
          key: true,
          status: true,
          departure: true,
          confirmedAt: true,
          collectedAt: true,
          cancelledAt: true,
          operatorPaymentAmount: true,
          createdAt: true,
          updatedAt: true,
          updatedBy: { select: { name: true } },
          trip: {
            select: {
              id: true,
              status: true,
              deletedAt: true,
              route: {
                select: {
                  id: true,
                  number: true,
                  name: true,
                  service: { select: { id: true, shortName: true } },
                },
              },
              tripDispatch: {
                select: {
                  operator: { select: { key: true, name: true } },
                  bus: { select: { economicNumber: true, serialNumber: true } },
                },
              },
            },
          },
          amountLines: { select: { concept: true, quantity: true, amount: true } },
          collection: {
            select: {
              collectionNumber: true,
              expectedAmount: true,
              createdAt: true,
              collectedBy: { select: { name: true } },
            },
          },
        },
      })

      if (!c) {
        return {
          ok: false,
          failure: {
            title: 'No existe esa tarjeta de viaje',
            detail: `Identificador consultado: ${data.id}`,
            suggestion: 'Revisa el identificador en la dirección o vuelve al listado de tarjetas.',
          },
        }
      }

      const dispatch = c.trip.tripDispatch

      return {
        ok: true,
        card: {
          id: c.id,
          number: c.number,
          key: c.key,
          status: c.status,
          departure: c.departure.toISOString(),
          confirmedAt: c.confirmedAt ? c.confirmedAt.toISOString() : null,
          collectedAt: c.collectedAt ? c.collectedAt.toISOString() : null,
          cancelledAt: c.cancelledAt ? c.cancelledAt.toISOString() : null,
          operatorPaymentAmount: c.operatorPaymentAmount ? c.operatorPaymentAmount.toString() : null,
          trip: { id: c.trip.id, status: c.trip.status, isDeleted: c.trip.deletedAt !== null },
          route: { id: c.trip.route.id, number: c.trip.route.number, name: c.trip.route.name },
          service: { id: c.trip.route.service.id, name: c.trip.route.service.shortName },
          dispatch: dispatch
            ? {
                operator: dispatch.operator,
                bus: {
                  economicNumber: dispatch.bus.economicNumber,
                  // `importTrips` creates a bus it can't match with this serial.
                  isPlaceholder: dispatch.bus.serialNumber.startsWith('LEGACY-'),
                },
              }
            : null,
          amountLines: c.amountLines
            .map((l) => ({ concept: l.concept, quantity: l.quantity, amount: l.amount.toString() }))
            .sort((a, b) => CONCEPT_ORDER.indexOf(a.concept) - CONCEPT_ORDER.indexOf(b.concept)),
          collection: c.collection
            ? {
                collectionNumber: c.collection.collectionNumber,
                expectedAmount: c.collection.expectedAmount.toString(),
                collectedBy: c.collection.collectedBy?.name ?? null,
                createdAt: c.collection.createdAt.toISOString(),
              }
            : null,
          updatedBy: c.updatedBy?.name ?? null,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        },
      }
    } catch (error) {
      console.error('[travel-card]', error)
      return { ok: false, failure: describeFailure(error) }
    }
  })
