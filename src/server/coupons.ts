import { createServerFn } from '@tanstack/react-start'
import type { Prisma } from '@prisma/generated'
import { db, describeFailure } from './db'
import { clampPage, range } from '~/lib/params'

/* ── View contract ─────────────────────────────────────────────────────────
   A coupon campaign ("paquete de cupones") owns its codes; an order that used
   one keeps an `OrderCoupon` snapshot. The list reads campaigns, the detail
   reads one campaign's rules plus its codes, paginated here because a package
   can generate thousands of them.                                           */

type Failure = ReturnType<typeof describeFailure>

export const CAMPAIGN_SORTS = ['number', 'name', 'codes', 'uses'] as const
export type CampaignSort = (typeof CAMPAIGN_SORTS)[number]

export type CampaignSearch = {
  q: string
  page: number
  perPage: number
  sort: CampaignSort
  dir: 'asc' | 'desc'
}

export type CampaignRow = {
  id: string
  number: number
  name: string
  status: string
  campaignType: string
  discountType: string
  discountValue: number
  codes: number
  /** `OrderCoupon` rows — one per order that used any of its codes. */
  uses: number
}

export type CampaignsResponse =
  | { ok: true; rows: Array<CampaignRow>; total: number; catalogTotal: number; page: number }
  | { ok: false; failure: Failure }

function campaignOrderBy(
  sort: CampaignSort,
  dir: 'asc' | 'desc',
): Prisma.CouponCampaignOrderByWithRelationInput {
  switch (sort) {
    case 'name':
      return { name: dir }
    case 'codes':
      return { coupons: { _count: dir } }
    case 'uses':
      return { orderCoupons: { _count: dir } }
    default:
      return { number: dir }
  }
}

export const listCampaigns = createServerFn({ method: 'GET' })
  .inputValidator((input: CampaignSearch) => input)
  .handler(async ({ data }): Promise<CampaignsResponse> => {
    const q = data.q.trim()
    const number = Number(q)

    try {
      const where: Prisma.CouponCampaignWhereInput = {
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { prefix: { contains: q, mode: 'insensitive' } },
                { coupons: { some: { code: { contains: q, mode: 'insensitive' } } } },
                ...(Number.isInteger(number) ? [{ number }] : []),
              ],
            }
          : {}),
      }

      const [total, catalogTotal] = await Promise.all([
        db.couponCampaign.count({ where }),
        db.couponCampaign.count({ where: { deletedAt: null } }),
      ])
      const page = clampPage(data.page, total, data.perPage)

      const rows = await db.couponCampaign.findMany({
        where,
        orderBy: campaignOrderBy(data.sort, data.dir),
        ...range(page, data.perPage),
        select: {
          id: true,
          number: true,
          name: true,
          status: true,
          campaignType: true,
          discountType: true,
          discountValue: true,
          _count: { select: { coupons: true, orderCoupons: true } },
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
          name: c.name,
          status: c.status,
          campaignType: c.campaignType,
          discountType: c.discountType,
          discountValue: c.discountValue,
          codes: c._count.coupons,
          uses: c._count.orderCoupons,
        })),
      }
    } catch (error) {
      console.error('[coupons]', error)
      return { ok: false, failure: describeFailure(error) }
    }
  })

/* ── Detail ────────────────────────────────────────────────────────────── */

export const CODE_SORTS = ['code', 'uses'] as const
export type CodeSort = (typeof CODE_SORTS)[number]

export type CodeSearch = {
  q: string
  page: number
  perPage: number
  sort: CodeSort
  dir: 'asc' | 'desc'
}

export type CouponCodeRow = {
  id: string
  code: string
  status: string
  currentUses: number
  maxUses: number
}

/** `@db.Date`/`@db.Time` columns come back as UTC instants; they are sent as
 *  plain `YYYY-MM-DD` / `HH:MM` text so no client time zone can shift them. */
export type Validity = {
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  allDays: boolean
  activeDays: Array<string>
}

export type CampaignDetail = {
  id: string
  number: number
  name: string
  description: string | null
  prefix: string | null
  quantityToGenerate: number | null
  status: string
  campaignType: string
  maxUsesPerCode: number
  discountType: string
  discountValue: number
  ticketsPaid: number | null
  ticketLimit: number | null
  discountAppliesTo: string
  discountTicketQuantity: number | null
  tripTypes: Array<string>
  companies: Array<{ id: string; name: string }>
  services: Array<{ id: string; name: string }>
  routes: Array<{ id: string; number: string; name: string }>
  salesChannels: Array<string>
  paymentMethods: Array<string>
  purchasePassengerType: string | null
  deliveryPassengerType: string | null
  purchaseValidity: Validity | null
  oneWayTripValidity: Validity | null
  roundTripValidity: (Validity & { sameDay: boolean }) | null
  codesTotal: number
  /** Codes whose `currentUses` passed their own `maxUses`. */
  codesOverLimit: number
  uses: number
  createdBy: string
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  isDeleted: boolean
}

export type CampaignResponse =
  | {
      ok: true
      campaign: CampaignDetail
      codes: { rows: Array<CouponCodeRow>; total: number; page: number }
    }
  | { ok: false; failure: Failure }

const VALIDITY_SELECT = {
  startDate: true,
  endDate: true,
  startTime: true,
  endTime: true,
  allDays: true,
  activeDays: true,
} as const

function toValidity(v: {
  startDate: Date
  endDate: Date
  startTime: Date
  endTime: Date
  allDays: boolean
  activeDays: Array<string>
}): Validity {
  return {
    startDate: v.startDate.toISOString().slice(0, 10),
    endDate: v.endDate.toISOString().slice(0, 10),
    startTime: v.startTime.toISOString().slice(11, 16),
    endTime: v.endTime.toISOString().slice(11, 16),
    allDays: v.allDays,
    activeDays: v.activeDays,
  }
}

export const getCampaign = createServerFn({ method: 'GET' })
  .inputValidator((input: { id: string; codes: CodeSearch }) => input)
  .handler(async ({ data }): Promise<CampaignResponse> => {
    try {
      const c = await db.couponCampaign.findUnique({
        where: { id: data.id },
        select: {
          id: true,
          number: true,
          name: true,
          description: true,
          prefix: true,
          quantityToGenerate: true,
          status: true,
          campaignType: true,
          maxUsesPerCode: true,
          discountType: true,
          discountValue: true,
          ticketsPaid: true,
          ticketLimit: true,
          discountAppliesTo: true,
          discountTicketQuantity: true,
          tripTypes: true,
          companies: { select: { id: true, shortName: true }, orderBy: { shortName: 'asc' } },
          services: { select: { id: true, fullName: true }, orderBy: { fullName: 'asc' } },
          routes: { select: { id: true, number: true, name: true }, orderBy: { number: 'asc' } },
          salesChannels: { select: { name: true }, orderBy: { name: 'asc' } },
          paymentMethods: { select: { name: true }, orderBy: { name: 'asc' } },
          purchasePassengerType: { select: { name: true } },
          deliveryPassengerType: { select: { name: true } },
          purchaseValidity: { select: VALIDITY_SELECT },
          oneWayTripValidity: { select: VALIDITY_SELECT },
          roundTripValidity: { select: { ...VALIDITY_SELECT, sameDay: true } },
          createdBy: { select: { name: true } },
          updatedBy: { select: { name: true } },
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          _count: { select: { coupons: true, orderCoupons: true } },
        },
      })

      if (!c) {
        return {
          ok: false,
          failure: {
            title: 'No existe esa campaña de cupones',
            detail: `Identificador consultado: ${data.id}`,
            suggestion: 'Revisa el identificador en la dirección o vuelve al listado de cupones.',
          },
        }
      }

      const q = data.codes.q.trim()
      const codeWhere: Prisma.CouponCodeWhereInput = {
        campaignId: c.id,
        ...(q ? { code: { contains: q, mode: 'insensitive' } } : {}),
      }
      const [codesTotal, codesOverLimit] = await Promise.all([
        db.couponCode.count({ where: codeWhere }),
        // Column against column, as in `~/server/summary`.
        db.couponCode.count({
          where: { campaignId: c.id, currentUses: { gt: db.couponCode.fields.maxUses } },
        }),
      ])
      const page = clampPage(data.codes.page, codesTotal, data.codes.perPage)
      const codes = await db.couponCode.findMany({
        where: codeWhere,
        orderBy:
          data.codes.sort === 'uses'
            ? [{ currentUses: data.codes.dir }, { code: 'asc' }]
            : { code: data.codes.dir },
        ...range(page, data.codes.perPage),
        select: { id: true, code: true, status: true, currentUses: true, maxUses: true },
      })

      return {
        ok: true,
        campaign: {
          id: c.id,
          number: c.number,
          name: c.name,
          description: c.description,
          prefix: c.prefix,
          quantityToGenerate: c.quantityToGenerate,
          status: c.status,
          campaignType: c.campaignType,
          maxUsesPerCode: c.maxUsesPerCode,
          discountType: c.discountType,
          discountValue: c.discountValue,
          ticketsPaid: c.ticketsPaid,
          ticketLimit: c.ticketLimit,
          discountAppliesTo: c.discountAppliesTo,
          discountTicketQuantity: c.discountTicketQuantity,
          tripTypes: c.tripTypes,
          companies: c.companies.map((x) => ({ id: x.id, name: x.shortName })),
          services: c.services.map((x) => ({ id: x.id, name: x.fullName })),
          routes: c.routes,
          salesChannels: c.salesChannels.map((x) => x.name),
          paymentMethods: c.paymentMethods.map((x) => x.name),
          purchasePassengerType: c.purchasePassengerType?.name ?? null,
          deliveryPassengerType: c.deliveryPassengerType?.name ?? null,
          purchaseValidity: c.purchaseValidity ? toValidity(c.purchaseValidity) : null,
          oneWayTripValidity: c.oneWayTripValidity ? toValidity(c.oneWayTripValidity) : null,
          roundTripValidity: c.roundTripValidity
            ? { ...toValidity(c.roundTripValidity), sameDay: c.roundTripValidity.sameDay }
            : null,
          codesTotal: c._count.coupons,
          codesOverLimit,
          uses: c._count.orderCoupons,
          createdBy: c.createdBy.name,
          updatedBy: c.updatedBy?.name ?? null,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
          deletedAt: c.deletedAt ? c.deletedAt.toISOString() : null,
          isDeleted: c.deletedAt !== null,
        },
        codes: { rows: codes, total: codesTotal, page },
      }
    } catch (error) {
      console.error('[coupon]', error)
      return { ok: false, failure: describeFailure(error) }
    }
  })
