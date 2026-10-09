import { createFileRoute } from '@tanstack/react-router'
import { createColumnHelper, useTable } from '@tanstack/react-table'
import { Field, KeyText, Sheet, Stat } from '~/components/base'
import { PageHeader, Breadcrumb, Breadcrumbs, BreadcrumbSeparator } from '~/components/shell'
import { ErrorState, ManifestSkeleton } from '~/components/states'
import { Card, Grid, Block, TextLink } from '~/components/card'
import { RefreshButton } from '~/components/refresh'
import { DataTable, features } from '~/components/data-table'
import { TicketStatus, YesNo } from './columns'
import {
  NO_DATA,
  ORDER_MOVEMENT_LABELS,
  PAYMENT_METHOD_LABELS,
  TICKET_OPERATION_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_TYPE_LABELS,
  currency,
  dateTime,
  dayLabelFull,
  integer,
  legacyDateTime,
  legacyDay,
  time,
} from '~/lib/format'
import type { TicketDetail, TicketMovement } from '~/server/tickets'
import { getTicket } from '~/server/tickets'

export const Route = createFileRoute('/boletos/$id')({
  loader: ({ params }) => getTicket({ data: { folio: params.id } }),
  component: Screen,
  pendingComponent: () => (
    <>
      <PageHeader title="Cargando boleto…" subtitle={NO_DATA} />
      <div className="px-4 sm:px-8 py-6">
        <Sheet className="py-2">
          <ManifestSkeleton columns={[10, 20, 12, 12, 12, 10]} rows={5} />
        </Sheet>
      </div>
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <ErrorState
      title="No fue posible leer el boleto"
      detail={error instanceof Error ? error.message : String(error)}
      onRetry={reset}
    />
  ),
})

/* ── Movement history table ─────────────────────────────────────────────── */

/* Los campos `old*` de `OrderItemStatusHistory` son una FOTOGRAFÍA en texto del
   momento del movimiento, no llaves foráneas vigentes — por eso ninguna celda
   de aquí enlaza a /terminales ni a /corridas: enlazar una foto a la fila viva
   de hoy sería afirmar que son lo mismo. Los folios sí enlazan: un folio es
   único y no cambia, y seguirlo es la única forma de recorrer una cadena de
   cambios/canjes (folio anterior ↔ folio nuevo). */
const movementHelper = createColumnHelper<typeof features, TicketMovement>()

function FolioLink({ folio }: { folio: string | null }) {
  if (!folio) return NO_DATA
  return (
    <TextLink to="/boletos/$id" params={{ id: folio }}>
      <KeyText>{folio}</KeyText>
    </TextLink>
  )
}

const movementColumns = movementHelper.columns([
  movementHelper.accessor('movementType', {
    header: 'Movimiento',
    cell: ({ getValue }) => ORDER_MOVEMENT_LABELS[getValue()] ?? getValue(),
  }),
  movementHelper.accessor('createdAt', {
    header: 'Fecha',
    meta: { className: 'text-ink-2' },
    cell: ({ getValue }) => (
      <span className="font-mono text-data">{legacyDateTime(getValue())}</span>
    ),
  }),
  movementHelper.accessor('oldStatus', {
    header: 'Estatus anterior',
    cell: ({ getValue }) => {
      const value = getValue()
      return value ? <TicketStatus status={value} /> : NO_DATA
    },
  }),
  movementHelper.display({
    id: 'endpoints',
    header: 'Origen → destino anteriores',
    cell: ({ row }) => {
      const { oldOriginShortName: o, oldDestinationShortName: d } = row.original
      if (!o && !d) return NO_DATA
      return (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <KeyText>{o ?? NO_DATA}</KeyText>
          <span aria-hidden className="text-ink-4">
            →
          </span>
          <KeyText>{d ?? NO_DATA}</KeyText>
        </span>
      )
    },
  }),
  movementHelper.accessor('oldTripId', {
    header: 'Corrida ant.',
    cell: ({ getValue }) => {
      const value = getValue()
      return value ? <KeyText>{value}</KeyText> : NO_DATA
    },
  }),
  movementHelper.accessor('oldSeatNumber', {
    header: 'Asiento ant.',
    meta: { numeric: true },
    cell: ({ getValue }) => integer(getValue()),
  }),
  movementHelper.accessor('oldTotalPrice', {
    header: 'Total ant.',
    meta: { numeric: true, className: 'text-ink-2' },
    cell: ({ getValue }) => currency(getValue()),
  }),
  movementHelper.accessor('oldTicketNumber', {
    header: 'Folio ant.',
    cell: ({ getValue }) => <FolioLink folio={getValue()} />,
  }),
  movementHelper.accessor('newTicketNumber', {
    header: 'Folio nuevo',
    cell: ({ getValue }) => <FolioLink folio={getValue()} />,
  }),
  movementHelper.accessor('reason', {
    header: 'Motivo',
    meta: { className: 'text-ink-3' },
    cell: ({ getValue }) => getValue() ?? NO_DATA,
  }),
])

/* ── Screen ─────────────────────────────────────────────────────────────── */

const NO_MOVEMENTS: Array<TicketMovement> = []

function Screen() {
  const data = Route.useLoaderData()

  // Hooks run unconditionally, before the `!data.ok` early return below.
  const movementsTable = useTable({
    features,
    columns: movementColumns,
    data: data.ok ? data.ticket.movements : NO_MOVEMENTS,
    getRowId: (row) => row.id,
    enableSorting: false,
  })

  if (!data.ok) {
    return (
      <>
        <PageHeader
          title="Boleto"
          breadcrumbs={
            <Breadcrumbs>
              <Breadcrumb to="/boletos">Boletos</Breadcrumb>
              <BreadcrumbSeparator />
              <span className="text-ink-2">{NO_DATA}</span>
            </Breadcrumbs>
          }
        />
        <ErrorState {...data.failure} />
      </>
    )
  }

  const ticket: TicketDetail = data.ticket

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Breadcrumbs>
            <Breadcrumb to="/boletos">Boletos</Breadcrumb>
            <BreadcrumbSeparator />
            <span className="text-ink-2">{ticket.folio}</span>
          </Breadcrumbs>
        }
        title={`Boleto ${ticket.folio}`}
        subtitle={`${legacyDateTime(ticket.soldAt)}${ticket.service ? ` · ${ticket.service.name}` : ''}${ticket.company ? ` · ${ticket.company.name}` : ''}`}
        actions={
          <>
            <TicketStatus status={ticket.status} />
            <span aria-hidden className="h-4 w-px bg-rule" />
            <RefreshButton />
          </>
        }
      />

      <div className="flex flex-col gap-7 px-4 sm:px-8 py-6">
        <Sheet>
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 p-5 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Total" value={currency(ticket.totalPrice)} tone="stamp" />
            <Stat label="Tarifa base" value={currency(ticket.basePrice)} />
            <Stat label="IVA" value={currency(ticket.tax)} />
            <Stat label="Descuento" value={currency(ticket.discount)} />
            <Stat
              label="Asiento"
              value={ticket.seat === null ? NO_DATA : integer(ticket.seat)}
              tone={ticket.seat === null ? 'amber' : 'ink'}
            />
            <Stat label="Tipo" value={TICKET_TYPE_LABELS[ticket.type] ?? ticket.type} />
          </div>
        </Sheet>

        <Card title="Venta">
          <Grid columns={3}>
            <Field label="Folio" mono>
              <KeyText emphasis>{ticket.folio}</KeyText>
            </Field>
            <Field label="Tipo de operación">{TICKET_OPERATION_LABELS[ticket.operation] ?? ticket.operation}</Field>
            <Field label="Forma de pago">{PAYMENT_METHOD_LABELS[ticket.payment] ?? ticket.payment}</Field>
            {/* Instantes reales, desplazados +6h en el origen — ver
                `LEGACY_OFFSET_HOURS` en `~/lib/format`. `legacyDateTime` ya
                hace el ajuste; nunca `dateTime` (asume un instante sin
                desplazar) para estos dos campos. */}
            <Field label="Fecha y hora de venta" mono>
              {legacyDateTime(ticket.soldAt)}
            </Field>
            <Field label="Fecha y hora de operación" mono>
              {legacyDateTime(ticket.operatedAt)}
            </Field>
            <Field label="Canal de venta">{ticket.channel ?? NO_DATA}</Field>
            <Field label="Terminal de venta">
              {ticket.terminal ? (
                <TextLink to="/terminales/$id" params={{ id: ticket.terminal.id }}>
                  {ticket.terminal.key} · {ticket.terminal.name}
                </TextLink>
              ) : (
                NO_DATA
              )}
            </Field>
            <Field label="Facturado" mono>
              {ticket.invoiceCode ? <KeyText>{ticket.invoiceCode}</KeyText> : NO_DATA}
            </Field>
            <Field label="Orden" mono>
              <span className="text-ink-3">{ticket.orderId}</span>
            </Field>
          </Grid>
        </Card>

        <Card title="Viaje">
          <Grid columns={3}>
            <Field label="Corrida" mono>
              {ticket.trip ? (
                <TextLink to="/corridas/$id" params={{ id: ticket.trip.id }}>
                  {ticket.trip.id}
                </TextLink>
              ) : (
                <span className="text-amber">{NO_DATA}</span>
              )}
            </Field>
            <Field label="Ruta">
              {ticket.route ? (
                <TextLink to="/rutas/$id" params={{ id: ticket.route.id }}>
                  {ticket.route.number} · {ticket.route.name}
                </TextLink>
              ) : (
                NO_DATA
              )}
            </Field>
            <Field label="Servicio">
              {ticket.service ? (
                <TextLink to="/servicios/$id" params={{ id: ticket.service.id }}>
                  {ticket.service.name}
                </TextLink>
              ) : (
                NO_DATA
              )}
            </Field>
            <Field label="Empresa">
              {ticket.company ? (
                <TextLink to="/empresas/$id" params={{ id: ticket.company.id }}>
                  {ticket.company.name}
                </TextLink>
              ) : (
                NO_DATA
              )}
            </Field>
            <Field label="Origen">
              {ticket.origin ? (
                <TextLink to="/terminales/$id" params={{ id: ticket.origin.id }}>
                  {ticket.origin.key} · {ticket.origin.name}
                </TextLink>
              ) : (
                NO_DATA
              )}
            </Field>
            <Field label="Destino">
              {ticket.destination ? (
                <TextLink to="/terminales/$id" params={{ id: ticket.destination.id }}>
                  {ticket.destination.key} · {ticket.destination.name}
                </TextLink>
              ) : (
                NO_DATA
              )}
            </Field>
            {/* `trip.departure` es un horario de pared, no un instante — usa
                `time`/`legacyDay` (corregidos, ver `LEGACY_OFFSET_HOURS`),
                nunca `legacyDateTime`/`dateTime` ni `.slice(0, 10)` (día UTC,
                un día tarde desde las 18:00) para este campo. */}
            <Field label="Salida planeada" mono>
              {ticket.trip ? `${time(ticket.trip.departure)} · ${dayLabelFull(legacyDay(ticket.trip.departure))}` : NO_DATA}
            </Field>
            <Field label="Sentido">
              <YesNo value={ticket.isOutbound === null ? null : ticket.isOutbound} />
            </Field>
          </Grid>
        </Card>

        <Card title="Pasajero">
          {ticket.passenger ? (
            <Grid columns={3}>
              <Field label="Nombre">{ticket.passenger.name}</Field>
              <Field label="Tipo de pasajero">
                {ticket.passenger.passengerType ? (
                  <span className="inline-flex items-baseline gap-1.5">
                    <KeyText>{ticket.passenger.passengerType.key}</KeyText>
                    <span className="text-ink-2">{ticket.passenger.passengerType.name}</span>
                  </span>
                ) : (
                  NO_DATA
                )}
              </Field>
              <Field label="Pasajero principal">
                <YesNo value={ticket.passenger.isMainPassenger} />
              </Field>
            </Grid>
          ) : (
            <p className="text-body text-ink-3">Este boleto no tiene un pasajero migrado.</p>
          )}
        </Card>

        <Block label="No llegó con la migración" className="pb-2">
          <p className="max-w-[80ch] text-body text-ink-3">
            El correo y el teléfono del comprador, el asesor que hizo la venta y su clave de usuario, la caja real y
            el número de corte no vienen en boletos.csv: el importador nunca los escribe. La caja que la orden sí
            trae es una caja de relleno que el propio importador creó para poder guardar la venta, no la del sistema
            anterior. El monto de descuento llega siempre en $0.00 por la misma razón: un cero aquí no significa
            «sin descuento», significa «no se leyó».
          </p>
          <p className="mt-3 max-w-[80ch] text-body text-ink-3">
            La tarifa base y el IVA tampoco son los del sistema anterior: el importador no lee SUBTOTAL ni IVA de
            boletos.csv; guarda el total como tarifa base y calcula el IVA a partir del total, redondeado a pesos. El
            estatus «Viajó» lo pone el importador a todo boleto vendido con corrida —no lee BOLETOS_ABORDADOS.csv—, así
            que no prueba que el pasajero abordó, y la hora de abordaje no se migra.
          </p>
        </Block>

        <Card
          title="Historial de movimientos"
          note={ticket.movements.length > 0 ? `${ticket.movements.length} movimiento${ticket.movements.length === 1 ? '' : 's'}` : undefined}
        >
          {ticket.movements.length === 0 ? (
            <p className="text-body text-ink-3">
              Este boleto no tiene movimientos migrados. El importador escribe uno por boleto (el de la venta), así
              que un historial vacío aquí es una fila que no lo recibió.
            </p>
          ) : (
            <div className="-m-5">
              <DataTable table={movementsTable} label={`Movimientos del boleto ${ticket.folio}`} />
            </div>
          )}
        </Card>

        <Card title="Auditoría">
          <Grid columns={2}>
            <Field label="Creado" mono>
              {dateTime(ticket.createdAt)}
            </Field>
            <Field label="Actualizado" mono>
              {dateTime(ticket.updatedAt)}
            </Field>
          </Grid>
        </Card>
      </div>
    </>
  )
}
