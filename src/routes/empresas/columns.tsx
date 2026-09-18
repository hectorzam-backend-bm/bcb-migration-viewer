import { createColumnHelper } from '@tanstack/react-table'
import { KeyText, Stamp, ActivityStamp } from '~/components/base'
import { TextLink } from '~/components/card'
import { RowLink } from '~/components/table'
import { features } from '~/components/data-table'
import { NO_DATA, integer } from '~/lib/format'
import type { CompanyRow } from '~/server/companies'

/* Every column's id equals a value of COMPANY_SORTS (or, for legalName and
   status, is left non-sortable): the id is the same string the server's
   buildOrderBy already switches on, so no separate mapping is needed. */

const helper = createColumnHelper<typeof features, CompanyRow>()

export const companyColumns = helper.columns([
  helper.accessor('key', {
    header: 'Clave',
    meta: { skeletonWidth: 9 },
    cell: ({ row, getValue }) => (
      <RowLink to="/empresas/$id" params={{ id: row.original.id }} className="inline-block">
        <KeyText emphasis>{getValue()}</KeyText>
      </RowLink>
    ),
  }),
  helper.accessor('shortName', {
    header: 'Nombre corto',
    meta: { className: 'text-ink-2', skeletonWidth: 14 },
    cell: ({ getValue }) => getValue() || NO_DATA,
  }),
  helper.accessor('tradeName', {
    header: 'Nombre comercial',
    meta: { className: 'text-ink', skeletonWidth: 22 },
    cell: ({ getValue }) => (
      // The truncation goes on a span: with `table-layout: auto` a max-width
      // on the cell is only a suggestion.
      <span className="block max-w-[20rem] truncate">{getValue() || NO_DATA}</span>
    ),
  }),
  helper.accessor('legalName', {
    header: 'Razón social',
    enableSorting: false, // not in COMPANY_SORTS
    meta: { className: 'text-ink-3', skeletonWidth: 28 },
    cell: ({ getValue }) => (
      <span className="block max-w-[22rem] truncate" title={getValue()}>
        {getValue() || NO_DATA}
      </span>
    ),
  }),
  helper.accessor('services', {
    header: 'Servicios',
    meta: { numeric: true, skeletonWidth: 8 },
    cell: ({ row, getValue }) => {
      const value = getValue()
      // Zero is a value, not an absence: it is printed, dimmed and without a
      // link. `—` would mean "unknown".
      if (value === 0) return <span className="text-ink-4">{integer(0)}</span>
      // Above the link that covers the row: crossing into the services
      // catalog is what the viewer is worth.
      return (
        <TextLink to="/servicios" search={{ company: [row.original.id] }} className="relative z-10 text-ink">
          {integer(value)}
        </TextLink>
      )
    },
  }),
  helper.display({
    id: 'status',
    header: 'Estatus',
    meta: { skeletonWidth: 10 },
    cell: ({ row }) => (
      <span className="flex items-center gap-2">
        <ActivityStamp active={row.original.isActive} deleted={row.original.isDeleted} />
        {row.original.hcmDisabled ? (
          <Stamp
            tone="warning"
            title="HCM la reportó ausente o con estatus N. Es meramente informativo: no afecta el funcionamiento del sistema."
          >
            HCM
          </Stamp>
        ) : null}
      </span>
    ),
  }),
])
