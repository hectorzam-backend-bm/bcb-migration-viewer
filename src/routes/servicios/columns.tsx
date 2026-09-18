import { createColumnHelper } from '@tanstack/react-table'
import { KeyText, Stamp, ActivityStamp } from '~/components/base'
import { TextLink } from '~/components/card'
import { RowLink } from '~/components/table'
import { features } from '~/components/data-table'
import { NO_DATA, integer } from '~/lib/format'
import type { ServiceRow } from '~/server/services'

/* Every sortable column's id equals a value of SERVICE_SORTS; `shortName` and
   `stations` are not in that union, so they stay non-sortable — same as the
   plain `<Th>` they used to render as. */

const helper = createColumnHelper<typeof features, ServiceRow>()

export const serviceColumns = helper.columns([
  helper.accessor('key', {
    header: 'Clave servicio',
    meta: { skeletonWidth: 9 },
    cell: ({ row, getValue }) => (
      <RowLink to="/servicios/$id" params={{ id: row.original.id }}>
        <KeyText emphasis>{getValue() || NO_DATA}</KeyText>
      </RowLink>
    ),
  }),
  helper.accessor('number', {
    header: 'No. servicio',
    meta: { numeric: true, className: 'text-ink-2', skeletonWidth: 7 },
    cell: ({ getValue }) => getValue() || NO_DATA,
  }),
  helper.accessor('name', {
    header: 'Nombre del servicio',
    meta: { skeletonWidth: 24 },
    cell: ({ getValue }) => (
      <span className="block max-w-[26rem] truncate" title={getValue()}>
        {getValue() || NO_DATA}
      </span>
    ),
  }),
  helper.accessor('shortName', {
    header: 'Nombre corto',
    enableSorting: false, // not in SERVICE_SORTS
    meta: { className: 'text-ink-2', skeletonWidth: 16 },
    cell: ({ getValue }) => getValue() || NO_DATA,
  }),
  helper.accessor('companyName', {
    id: 'company',
    header: 'Empresa',
    meta: { skeletonWidth: 15 },
    cell: ({ row }) => (
      <TextLink to="/empresas/$id" params={{ id: row.original.companyId }} className="relative z-10">
        {row.original.companyName || row.original.companyKey || NO_DATA}
      </TextLink>
    ),
  }),
  helper.accessor('stations', {
    header: 'Terminales',
    enableSorting: false, // not in SERVICE_SORTS
    meta: { numeric: true, skeletonWidth: 8 },
    cell: ({ getValue }) => {
      const value = getValue()
      return <span className={value === 0 ? 'text-ink-4' : undefined}>{integer(value)}</span>
    },
  }),
  helper.accessor('routes', {
    header: 'Rutas',
    meta: { numeric: true, skeletonWidth: 7 },
    cell: ({ getValue }) => {
      const value = getValue()
      return <span className={value === 0 ? 'text-ink-4' : undefined}>{integer(value)}</span>
    },
  }),
  helper.display({
    id: 'status',
    header: 'Estatus',
    meta: { skeletonWidth: 11 },
    cell: ({ row }) => (
      <span className="flex items-center gap-2">
        <ActivityStamp active={row.original.isActive} deleted={row.original.isDeleted} />
        {row.original.hcmDisabled ? (
          <Stamp
            tone="warning"
            title="hcmDisabled — la sincronización HCM lo marcó como inhabilitado"
          >
            HCM
          </Stamp>
        ) : null}
      </span>
    ),
  }),
])
