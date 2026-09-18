import { createColumnHelper } from '@tanstack/react-table'
import { KeyText, ActivityStamp } from '~/components/base'
import { RowLink } from '~/components/table'
import { features } from '~/components/data-table'
import { NO_DATA, STATION_TYPE_LABELS } from '~/lib/format'
import type { StationRow } from '~/server/stations'

/* Only `number`, `shortName`, `name` and `state` are in STATION_SORTS; `type`,
   `services`, `companies` and the status column stay non-sortable — same as
   the plain `<Th>` they used to render as. */

/** Up to two values in the row; the rest collapses into "+N" and lives in the title. */
function Summary({ values, empty }: { values: Array<string>; empty: string }) {
  if (values.length === 0) {
    return (
      <span className="text-ink-4" title={empty}>
        {NO_DATA}
      </span>
    )
  }
  const visible = values.slice(0, 2)
  const rest = values.length - visible.length
  return (
    <span className="flex items-center gap-2" title={values.join('\n')}>
      {visible.map((v) => (
        <span
          key={v}
          className="border-l border-rule pl-2 font-mono text-data whitespace-nowrap text-ink-2 first:border-l-0 first:pl-0"
        >
          {v}
        </span>
      ))}
      {rest > 0 ? (
        <span
          data-numeric
          className="shrink-0 rounded-chip bg-row px-1 font-mono text-note text-ink-3"
        >
          +{rest}
        </span>
      ) : null}
    </span>
  )
}

const helper = createColumnHelper<typeof features, StationRow>()

export const stationColumns = helper.columns([
  helper.accessor('number', {
    header: 'No. terminal',
    meta: { skeletonWidth: 7 },
    cell: ({ row, getValue }) => (
      <RowLink to="/terminales/$id" params={{ id: row.original.id }}>
        <KeyText emphasis>{getValue()}</KeyText>
      </RowLink>
    ),
  }),
  helper.accessor('shortName', {
    header: 'Nombre corto',
    meta: { skeletonWidth: 12 },
    cell: ({ getValue }) => (
      <span className="font-mono text-data tracking-[0.04em] text-ink">{getValue()}</span>
    ),
  }),
  helper.accessor('name', {
    header: 'Nombre completo',
    meta: { skeletonWidth: 22 },
    cell: ({ getValue }) => (
      <span className="block max-w-[26rem] truncate text-ink-2" title={getValue()}>
        {getValue()}
      </span>
    ),
  }),
  helper.accessor('type', {
    header: 'Tipo',
    enableSorting: false, // not in STATION_SORTS
    meta: { skeletonWidth: 8 },
    cell: ({ getValue }) => {
      const value = getValue()
      return <span className="whitespace-nowrap text-ink-2">{STATION_TYPE_LABELS[value] ?? value}</span>
    },
  }),
  helper.accessor('state', {
    header: 'Estado',
    meta: { skeletonWidth: 13 },
    cell: ({ getValue }) => {
      const value = getValue()
      return (
        <span className="whitespace-nowrap text-ink-2">
          {value ?? <span className="text-ink-4">{NO_DATA}</span>}
        </span>
      )
    },
  }),
  helper.accessor('services', {
    header: 'Servicios',
    enableSorting: false, // not in STATION_SORTS
    meta: { skeletonWidth: 16 },
    cell: ({ getValue }) => (
      <Summary
        values={getValue().map((s) => `${s.number} · ${s.shortName}`)}
        empty="Sin servicios asociados"
      />
    ),
  }),
  helper.accessor('companies', {
    header: 'Empresas',
    enableSorting: false, // not in STATION_SORTS
    meta: { skeletonWidth: 12 },
    cell: ({ getValue }) => (
      <Summary
        values={getValue().map((e) => e.shortName)}
        empty="Sin empresa deducible: la terminal no tiene servicios"
      />
    ),
  }),
  helper.display({
    id: 'status',
    header: 'Estatus',
    meta: { skeletonWidth: 8 },
    cell: ({ row }) => (
      <ActivityStamp active={row.original.isActive} deleted={row.original.isDeleted} />
    ),
  }),
])
