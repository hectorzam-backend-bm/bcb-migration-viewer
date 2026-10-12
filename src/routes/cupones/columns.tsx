import { createColumnHelper } from '@tanstack/react-table'
import { KeyText, Stamp } from '~/components/base'
import { RowLink } from '~/components/table'
import { features } from '~/components/data-table'
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_TYPE_LABELS,
  COUPON_STATUS_LABELS,
  DISCOUNT_TYPE_LABELS,
  NO_DATA,
  currency,
  integer,
  percent,
} from '~/lib/format'
import type { CampaignRow } from '~/server/coupons'

/* Every sortable column's id equals a value of CAMPAIGN_SORTS. */

/** Hierarchy by exception: only a running campaign gets the green dot; one
 *  that ran out on its own (expired, exhausted) is what stands out. */
export function CampaignStatusStamp({ status, deleted }: { status: string; deleted?: boolean }) {
  if (deleted) {
    return (
      <Stamp tone="deleted" title="Registro con deletedAt — borrado lógico">
        Baja
      </Stamp>
    )
  }
  const tone = status === 'ON_GOING' ? 'active' : status === 'EXPIRED' || status === 'EXHAUSTED' ? 'warning' : 'inactive'
  return <Stamp tone={tone}>{CAMPAIGN_STATUS_LABELS[status] ?? status}</Stamp>
}

export function CouponStatusStamp({ status }: { status: string }) {
  const tone = status === 'ACTIVE' ? 'active' : status === 'INACTIVE' ? 'inactive' : 'warning'
  return <Stamp tone={tone}>{COUPON_STATUS_LABELS[status] ?? status}</Stamp>
}

/** `discountValue` is an Int whose unit depends on `discountType`. */
export function discountValue(type: string, value: number): string {
  if (type === 'PERCENTAGE') return percent(value)
  if (type === 'FIXED_AMOUNT') return currency(value)
  return integer(value)
}

const helper = createColumnHelper<typeof features, CampaignRow>()

export const campaignColumns = helper.columns([
  helper.accessor('number', {
    header: 'No.',
    meta: { numeric: true, skeletonWidth: 6 },
    cell: ({ row, getValue }) => (
      <RowLink to="/cupones/$id" params={{ id: row.original.id }}>
        <KeyText emphasis>{getValue()}</KeyText>
      </RowLink>
    ),
  }),
  helper.accessor('name', {
    header: 'Nombre del paquete',
    meta: { skeletonWidth: 26 },
    cell: ({ getValue }) => (
      <span className="block max-w-[26rem] truncate" title={getValue()}>
        {getValue() || NO_DATA}
      </span>
    ),
  }),
  helper.accessor('campaignType', {
    header: 'Tipo',
    enableSorting: false, // not in CAMPAIGN_SORTS
    meta: { className: 'text-ink-2', skeletonWidth: 10 },
    cell: ({ getValue }) => CAMPAIGN_TYPE_LABELS[getValue()] ?? getValue(),
  }),
  helper.display({
    id: 'discount',
    header: 'Descuento',
    meta: { className: 'text-ink-2', skeletonWidth: 14 },
    cell: ({ row }) => (
      <>
        {DISCOUNT_TYPE_LABELS[row.original.discountType] ?? row.original.discountType}
        <span className="px-1.5 text-ink-4">·</span>
        <span className="font-mono text-data">
          {discountValue(row.original.discountType, row.original.discountValue)}
        </span>
      </>
    ),
  }),
  helper.accessor('codes', {
    header: 'Cupones',
    meta: { numeric: true, skeletonWidth: 8 },
    cell: ({ getValue }) => integer(getValue()),
  }),
  helper.accessor('uses', {
    header: 'Órdenes con cupón',
    meta: { numeric: true, skeletonWidth: 10 },
    cell: ({ getValue }) => {
      const value = getValue()
      return <span className={value === 0 ? 'text-ink-4' : undefined}>{integer(value)}</span>
    },
  }),
  helper.display({
    id: 'status',
    header: 'Estatus',
    meta: { skeletonWidth: 10 },
    cell: ({ row }) => <CampaignStatusStamp status={row.original.status} />,
  }),
])
