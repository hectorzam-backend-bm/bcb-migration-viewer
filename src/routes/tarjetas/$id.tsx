import { createFileRoute } from '@tanstack/react-router'
import { createColumnHelper, useTable } from '@tanstack/react-table'
import { Field, Sheet, Stat } from '~/components/base'
import { PageHeader, Breadcrumb, Breadcrumbs, BreadcrumbSeparator } from '~/components/shell'
import { ErrorState, ManifestSkeleton } from '~/components/states'
import { Card, Grid, TextLink } from '~/components/card'
import { RefreshButton } from '~/components/refresh'
import { DataTable, features } from '~/components/data-table'
import {
  COLLECTION_CONCEPT_LABELS,
  NO_DATA,
  currency,
  dateTime,
  integer,
  legacyDateTime,
} from '~/lib/format'
import { getTravelCard, type AmountLine } from '~/server/travel-cards'
import { TripStatus } from '../corridas/columns'
import { TravelCardStatusStamp } from './columns'

/* ── Amount line columns ───────────────────────────────────────────────── */

const lineHelper = createColumnHelper<typeof features, AmountLine>()

const lineColumns = lineHelper.columns([
  lineHelper.accessor('concept', {
    header: 'Concepto',
    cell: ({ getValue }) => COLLECTION_CONCEPT_LABELS[getValue()] ?? getValue(),
  }),
  lineHelper.accessor('quantity', {
    header: 'Boletos',
    meta: { numeric: true },
    cell: ({ getValue }) => {
      const value = getValue()
      return <span className={value === 0 ? 'text-ink-4' : undefined}>{integer(value)}</span>
    },
  }),
  lineHelper.accessor('amount', {
    header: 'Importe',
    meta: { numeric: true },
    cell: ({ getValue }) => {
      const value = getValue()
      return <span className={Number(value) === 0 ? 'text-ink-4' : undefined}>{currency(value)}</span>
    },
  }),
])

export const Route = createFileRoute('/tarjetas/$id')({
  loader: ({ params }) => getTravelCard({ data: { id: params.id } }),
  component: Screen,
  pendingComponent: () => (
    <>
      <PageHeader title="Tarjetas de viaje" subtitle="Leyendo la tarjeta…" />
      <div className="px-4 sm:px-8 py-6">
        <Sheet className="overflow-hidden py-2">
          <ManifestSkeleton columns={[18, 26, 30, 14]} rows={6} />
        </Sheet>
      </div>
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <>
      <PageHeader title="Tarjetas de viaje" subtitle={NO_DATA} />
      <ErrorState
        title="No fue posible leer la tarjeta de viaje"
        detail={error instanceof Error ? error.message : String(error)}
        onRetry={reset}
      />
    </>
  ),
})

function Screen() {
  const data = Route.useLoaderData()

  if (!data.ok) {
    return (
      <>
        <PageHeader
          title="Tarjeta de viaje"
          subtitle={NO_DATA}
          breadcrumbs={
            <Breadcrumbs>
              <Breadcrumb to="/tarjetas">Tarjetas de viaje</Breadcrumb>
            </Breadcrumbs>
          }
        />
        <ErrorState {...data.failure} />
      </>
    )
  }

  const c = data.card
  const amountOf = (concept: string) => c.amountLines.find((l) => l.concept === concept)?.amount ?? null
  const tickets = c.amountLines.reduce((sum, l) => sum + l.quantity, 0)
  const isZero = c.collection !== null && Number(c.collection.expectedAmount) === 0

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Breadcrumbs>
            <Breadcrumb to="/tarjetas">Tarjetas de viaje</Breadcrumb>
            <BreadcrumbSeparator />
            <span className="text-ink-2">No. {c.number}</span>
          </Breadcrumbs>
        }
        title={c.key ? `Tarjeta ${c.key}` : `Tarjeta No. ${c.number}`}
        subtitle={
          <>
            Corrida {c.trip.id}
            <span className="px-1.5 text-ink-4">·</span>
            {legacyDateTime(c.departure)}
          </>
        }
        actions={
          <>
            <TravelCardStatusStamp status={c.status} />
            <span aria-hidden className="h-4 w-px bg-rule" />
            <RefreshButton />
          </>
        }
      />

      <div className="space-y-5 px-4 sm:px-8 py-6">
        <Sheet>
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 p-5 sm:grid-cols-3 lg:grid-cols-6">
            <Stat
              label="Recaudado"
              value={c.collection ? currency(c.collection.expectedAmount) : NO_DATA}
              tone={isZero ? 'amber' : 'stamp'}
            />
            <Stat label="Venta de sistema" value={currency(amountOf('SYSTEM_SALES'))} />
            <Stat label="Venta a bordo" value={currency(amountOf('ONBOARD_SALES'))} />
            <Stat label="Venta manual" value={currency(amountOf('MANUAL_SALES'))} />
            <Stat label="Boletos" value={integer(tickets)} />
            <Stat label="Sueldo del operador" value={currency(c.operatorPaymentAmount)} />
          </div>
        </Sheet>

        <div className="grid gap-5 lg:grid-cols-3">
          <Card title="Corrida" className="lg:col-span-2">
            <Grid columns={2}>
              <Field label="Clave de corrida" mono>
                <span className="inline-flex items-center gap-3">
                  <TextLink to="/corridas/$id" params={{ id: c.trip.id }}>
                    {c.trip.id}
                  </TextLink>
                  <TripStatus status={c.trip.status} isDeleted={c.trip.isDeleted} />
                </span>
              </Field>
              <Field label="Salida" mono>
                {legacyDateTime(c.departure)}
              </Field>
              <Field label="Ruta">
                <TextLink to="/rutas/$id" params={{ id: c.route.id }}>
                  <span className="font-mono text-data tracking-[0.04em]">{c.route.number}</span> {c.route.name}
                </TextLink>
              </Field>
              <Field label="Servicio">
                <TextLink to="/servicios/$id" params={{ id: c.service.id }}>
                  {c.service.name}
                </TextLink>
              </Field>
              <Field label="Operador">
                {c.dispatch ? (
                  <>
                    <span className="font-mono text-data">{c.dispatch.operator.key}</span>
                    <span className="px-1.5 text-ink-4">·</span>
                    {c.dispatch.operator.name}
                  </>
                ) : (
                  <span className="text-ink-4">Sin despacho</span>
                )}
              </Field>
              <Field label="Autobús" mono>
                {c.dispatch ? (
                  <>
                    {c.dispatch.bus.economicNumber}
                    {c.dispatch.bus.isPlaceholder ? (
                      <span
                        className="font-sans text-note text-amber"
                        title="El importador lo creó con datos de relleno: el autobús no existía en la base"
                      >
                        {' '}
                        · de relleno
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="font-sans text-ink-4">Sin despacho</span>
                )}
              </Field>
            </Grid>
          </Card>

          <Card title="Rastro">
            <div className="space-y-5">
              <Field label="Número consecutivo" mono>
                {c.number}
              </Field>
              <Field label="Confirmada" mono>
                {legacyDateTime(c.confirmedAt)}
              </Field>
              <Field label="Recaudada" mono>
                {legacyDateTime(c.collectedAt)}
              </Field>
              {c.cancelledAt ? (
                <Field label="Cancelada" mono>
                  <span className="text-rust">{legacyDateTime(c.cancelledAt)}</span>
                </Field>
              ) : null}
              <Field label="No. de recaudación" mono>
                {c.collection ? (
                  <>
                    {integer(c.collection.collectionNumber)}
                    <span className="font-sans text-ink-3">
                      {' · '}
                      {c.collection.collectedBy ?? 'sin recaudador'}
                    </span>
                  </>
                ) : (
                  NO_DATA
                )}
              </Field>
              <Field label="Actualizada" mono>
                {dateTime(c.updatedAt)}
                {c.updatedBy ? <span className="text-ink-3"> · {c.updatedBy}</span> : null}
              </Field>
              <Field label="Identificador" mono>
                <span className="break-all text-ink-2">{c.id}</span>
              </Field>
            </div>
          </Card>
        </div>

        <Card title="Conceptos de la tarjeta">
          <AmountLinesTable lines={c.amountLines} />
        </Card>
      </div>
    </>
  )
}

function AmountLinesTable({ lines }: { lines: Array<AmountLine> }) {
  const table = useTable({
    features,
    columns: lineColumns,
    data: lines,
    getRowId: (row) => row.concept,
    enableSorting: false,
  })

  if (lines.length === 0) {
    return <p className="text-body text-ink-3">La tarjeta no tiene conceptos en la base.</p>
  }

  return (
    <div className="-m-5">
      <DataTable table={table} label="Conceptos de la tarjeta" />
    </div>
  )
}
