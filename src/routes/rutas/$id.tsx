import { createFileRoute } from '@tanstack/react-router'
import {
  Stat,
  KeyText,
  Field,
  Sheet,
  MainMark,
  Label,
  Stamp,
  ActivityStamp,
} from '~/components/base'
import { PageHeader, Breadcrumb, Breadcrumbs, BreadcrumbSeparator } from '~/components/shell'
import { ErrorState, ManifestSkeleton } from '~/components/states'
import { Card, Grid, TextLink } from '~/components/card'
import { TableHead, TableBody, TableRow, Manifest, Td, Th } from '~/components/table'
import { RefreshButton } from '~/components/refresh'
import { cn } from '~/lib/cn'
import {
  NO_DATA,
  COLLECTION_TYPE_LABELS,
  integer,
  kilometers,
  minutes,
  currency,
  plural,
  percent,
} from '~/lib/format'
import type { RouteDetail, StationRef, SegmentDetail } from '~/server/routes'
import { getRoute } from '~/server/routes'

export const Route = createFileRoute('/rutas/$id')({
  loader: ({ params }) => getRoute({ data: { id: params.id } }),
  component: Screen,
  pendingComponent: () => (
    <>
      <PageHeader title="Cargando ruta…" subtitle={NO_DATA} />
      <div className="px-4 sm:px-8 py-6">
        <Sheet className="py-2">
          <ManifestSkeleton columns={[8, 26, 12, 12, 12, 10]} rows={6} />
        </Sheet>
      </div>
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <ErrorState
      title="No fue posible leer la ruta"
      detail={error instanceof Error ? error.message : String(error)}
      onRetry={reset}
    />
  ),
})

/* ── Pieces ─────────────────────────────────────────────────────────────── */

function StationLink({ station }: { station: StationRef }) {
  return (
    <TextLink to="/terminales/$id" params={{ id: station.id }}>
      <span className="inline-flex items-baseline gap-2">
        <KeyText emphasis>{station.key}</KeyText>
        <span className="text-body text-ink-2">{station.name}</span>
      </span>
    </TextLink>
  )
}

function YesNo({ value }: { value: boolean }) {
  return (
    <span className={cn('font-mono text-data', value ? 'text-ink' : 'text-ink-3')}>
      {value ? 'Sí' : 'No'}
    </span>
  )
}

/** Discreet box for the blocks that go without a table. */
function EmptyNote({ children }: { children: string }) {
  return <p className="text-body text-ink-3">{children}</p>
}

/* ── Screen ─────────────────────────────────────────────────────────────── */

function Screen() {
  const data = Route.useLoaderData()

  if (!data.ok) {
    return (
      <>
        <PageHeader
          title="Ruta"
          breadcrumbs={
            <Breadcrumbs>
              <Breadcrumb to="/rutas">Rutas y tramos</Breadcrumb>
              <BreadcrumbSeparator />
              <span className="text-ink-2">{NO_DATA}</span>
            </Breadcrumbs>
          }
        />
        <ErrorState {...data.failure} />
      </>
    )
  }

  const routeDetail = data.route
  const warnings = checkIntegrity(routeDetail)

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Breadcrumbs>
            <Breadcrumb to="/rutas">Rutas y tramos</Breadcrumb>
            <BreadcrumbSeparator />
            <span className="text-ink-2">{routeDetail.number}</span>
          </Breadcrumbs>
        }
        title={routeDetail.name}
        subtitle={`${routeDetail.number} · ${routeDetail.service.name} · ${routeDetail.company.name}`}
        actions={
          <>
            <ActivityStamp active={routeDetail.isActive} deleted={routeDetail.isDeleted} />
            <span aria-hidden className="h-4 w-px bg-rule" />
            <RefreshButton />
          </>
        }
      />

      <div className="flex flex-col gap-7 px-4 sm:px-8 py-6">
        {/* Row of stats: what gets checked at a glance. */}
        <Sheet>
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 p-5 sm:grid-cols-3 lg:grid-cols-6">
            <Stat
              label="Tramos"
              value={integer(routeDetail.segments.length)}
              note={
                routeDetail.deletedSegments > 0
                  ? `${plural(routeDetail.deletedSegments, 'tramo dado de baja', 'tramos dados de baja')} sin mostrar`
                  : undefined
              }
            />
            <Stat
              label="Tarifa sencilla"
              value={currency(routeDetail.priceOneWay)}
              tone="stamp"
            />
            <Stat label="Tarifa redonda" value={currency(routeDetail.priceRound)} />
            <Stat label="Tiempo de viaje" value={minutes(routeDetail.travelTimeMinutes)} />
            <Stat label="Distancia" value={kilometers(routeDetail.distanceKm)} />
            <Stat label="Estancia" value={minutes(routeDetail.stayTimeMinutes)} />
          </div>
        </Sheet>

        <Card title="Información básica">
          <Grid columns={3}>
            <Field label="Número" mono>
              {routeDetail.number}
            </Field>
            <Field label="Nombre" wide>
              {routeDetail.name}
            </Field>
            <Field label="Empresa">
              <TextLink to="/empresas/$id" params={{ id: routeDetail.company.id }}>
                {routeDetail.company.name}
              </TextLink>
            </Field>
            <Field label="Servicio">
              <TextLink to="/servicios/$id" params={{ id: routeDetail.service.id }}>
                {routeDetail.service.name}
              </TextLink>
            </Field>
            <Field label="Tipo de recaudación">
              {COLLECTION_TYPE_LABELS[routeDetail.collectionType] ??
                routeDetail.collectionType ??
                NO_DATA}
            </Field>
            <Field label="Origen">
              <StationLink station={routeDetail.origin} />
            </Field>
            <Field label="Destino">
              <StationLink station={routeDetail.destination} />
            </Field>
            <Field label="Plantilla de unidad">{routeDetail.unit ?? NO_DATA}</Field>
            <Field label="Aplica IVA">
              <YesNo value={routeDetail.appliedIva} />
            </Field>
            <Field label="Selección de asientos">
              <YesNo value={routeDetail.hasSeatsSelection} />
            </Field>
            <Field label="Estatus">
              <ActivityStamp active={routeDetail.isActive} deleted={routeDetail.isDeleted} />
            </Field>
          </Grid>
        </Card>

        <div className="grid items-start gap-7 lg:grid-cols-2">
          <Card
            title="Canales de venta"
            note={
              routeDetail.salesChannels.length > 0
                ? integer(routeDetail.salesChannels.length)
                : undefined
            }
          >
            {routeDetail.salesChannels.length === 0 ? (
              <EmptyNote>Sin canales configurados</EmptyNote>
            ) : (
              <ul className="-my-2 divide-y divide-rule-faint">
                {routeDetail.salesChannels.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-4 py-2">
                    <span className="min-w-0 truncate text-body text-ink">{c.name}</span>
                    {c.isDeleted ? (
                      <Stamp tone="deleted">Baja</Stamp>
                    ) : c.isActive ? null : (
                      <Stamp tone="inactive">Inactivo</Stamp>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Tipos de pasajero"
            note={
              routeDetail.passengerTypes.length > 0
                ? integer(routeDetail.passengerTypes.length)
                : undefined
            }
          >
            {routeDetail.passengerTypes.length === 0 ? (
              <EmptyNote>Sin tipos de pasajero configurados</EmptyNote>
            ) : (
              <div className="-m-5">
                <Manifest label="Tipos de pasajero de la ruta">
                  <TableHead>
                    <Th>Tipo</Th>
                    <Th>Clave</Th>
                    <Th numeric>Descuento</Th>
                    <Th numeric>Límite de asientos</Th>
                  </TableHead>
                  <TableBody>
                    {routeDetail.passengerTypes.map((p) => (
                      <TableRow key={p.id} dimmed={!p.isActive}>
                        <Td className="text-ink">{p.name}</Td>
                        <Td>
                          <KeyText>{p.key}</KeyText>
                        </Td>
                        <Td numeric>{percent(p.discountPercent)}</Td>
                        <Td numeric className={p.seatingLimit === null ? 'text-ink-3' : undefined}>
                          {p.seatingLimit === null ? 'Sin límite' : integer(p.seatingLimit)}
                        </Td>
                      </TableRow>
                    ))}
                  </TableBody>
                </Manifest>
              </div>
            )}
          </Card>
        </div>

        <SegmentLedger routeDetail={routeDetail} />

        <Card
          title="Paradas de cortesía"
          note={routeDetail.stops.length > 0 ? integer(routeDetail.stops.length) : undefined}
        >
          {routeDetail.stops.length === 0 ? (
            <EmptyNote>Esta ruta no tiene paradas de cortesía registradas</EmptyNote>
          ) : (
            <ul className="-my-2 divide-y divide-rule-faint">
              {routeDetail.stops.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <KeyText className="w-8 shrink-0 text-right">{integer(p.order)}</KeyText>
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-body',
                      p.isActive ? 'text-ink' : 'text-ink-3',
                    )}
                  >
                    {p.name}
                  </span>
                  {p.isActive ? null : <Stamp tone="inactive">Inactiva</Stamp>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <IntegrityCheck warnings={warnings} />
      </div>
    </>
  )
}

/* ── The segment ledger: this screen's signature ────────────────────────── */

function SegmentLedger({ routeDetail }: { routeDetail: RouteDetail }) {
  const segments = routeDetail.segments
  const withDistance = segments.filter((t) => t.distanceKm !== null)
  const totalDistance = withDistance.reduce((a, t) => a + (t.distanceKm ?? 0), 0)
  const totalDuration = segments.reduce((a, t) => a + t.durationMinutes, 0)
  const totalStay = segments.reduce((a, t) => a + t.stayTimeMinutes, 0)

  return (
    <Card
      title="Tramos"
      note={
        routeDetail.deletedSegments > 0
          ? `${plural(segments.length, 'tramo vigente', 'tramos vigentes')} · ${integer(routeDetail.deletedSegments)} de baja sin mostrar`
          : plural(segments.length, 'tramo', 'tramos')
      }
    >
      {segments.length === 0 ? (
        <EmptyNote>
          Esta ruta no tiene ningún tramo migrado. Sin tramos, la ruta no se puede vender.
        </EmptyNote>
      ) : (
        <div className="-m-5">
          <Manifest label={`Tramos de la ruta ${routeDetail.number}`}>
            <TableHead>
              <Th>No.</Th>
              <Th>Origen → Destino</Th>
              <Th numeric>Estancia</Th>
              <Th numeric>Duración</Th>
              <Th numeric>Distancia</Th>
              <Th>Venta</Th>
              <Th numeric>Tarifa sencilla</Th>
              <Th numeric>Tarifa redonda</Th>
            </TableHead>
            <TableBody>
              {segments.map((t) => (
                <SegmentLine key={t.id} segment={t} />
              ))}
            </TableBody>
            {/* The printed manifest's cut: double rule and totals. */}
            <tfoot>
              <tr className="[&>td]:border-t-[3px] [&>td]:border-double [&>td]:border-rule-strong [&>td]:px-3 [&>td]:py-2.5">
                <td className="font-mono text-note font-medium tracking-[0.085em] text-ink-3 uppercase">
                  Total
                </td>
                <td className="font-mono text-data text-ink-2">
                  {plural(segments.length, 'tramo', 'tramos')}
                </td>
                <td className="text-right font-mono text-data font-medium text-ink">
                  {minutes(totalStay)}
                </td>
                <td className="text-right font-mono text-data font-medium text-ink">
                  {minutes(totalDuration)}
                </td>
                <td
                  className="text-right font-mono text-data font-medium text-ink"
                  title={
                    withDistance.length === segments.length
                      ? undefined
                      : `Suma de ${integer(withDistance.length)} de ${integer(segments.length)} tramos con distancia registrada`
                  }
                >
                  {kilometers(totalDistance)}
                  {withDistance.length === segments.length ? null : (
                    <span className="text-ink-4"> *</span>
                  )}
                </td>
                <td />
                <td />
                <td />
              </tr>
            </tfoot>
          </Manifest>
        </div>
      )}
    </Card>
  )
}

function SegmentLine({ segment }: { segment: SegmentDetail }) {
  return (
    <TableRow highlighted={segment.isMain} dimmed={!segment.isActive}>
      <Td>
        <span className="inline-flex items-center gap-1.5">
          <KeyText emphasis>{segment.number}</KeyText>
          {segment.isMain ? <MainMark /> : null}
        </span>
      </Td>
      <Td>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <TextLink to="/terminales/$id" params={{ id: segment.origin.id }}>
            <KeyText>{segment.origin.key}</KeyText>
          </TextLink>
          <span aria-hidden className="text-ink-4">
            →
          </span>
          <TextLink to="/terminales/$id" params={{ id: segment.destination.id }}>
            <KeyText>{segment.destination.key}</KeyText>
          </TextLink>
          <span className="ml-1 truncate text-data text-ink-3">
            {segment.origin.name} — {segment.destination.name}
          </span>
        </span>
      </Td>
      <Td numeric className="text-ink-2">
        {minutes(segment.stayTimeMinutes)}
      </Td>
      <Td numeric className="text-ink-2">
        {minutes(segment.durationMinutes)}
      </Td>
      <Td numeric className="text-ink-2">
        {kilometers(segment.distanceKm)}
      </Td>
      <Td>
        <YesNo value={segment.allowSale} />
      </Td>
      <Td numeric>{currency(segment.priceOneWay)}</Td>
      <Td numeric className="text-ink-2">
        {currency(segment.priceRound)}
      </Td>
    </TableRow>
  )
}

/* ── Integrity check ────────────────────────────────────────────────────── */

/**
 * Only two checks, and both are the ones a migration cross-check looks for:
 * that a main segment exists and that its station pair is the route's.
 */
function checkIntegrity(routeDetail: RouteDetail): Array<string> {
  const warnings: Array<string> = []
  const main = routeDetail.segments.find((t) => t.isMain)

  if (routeDetail.segments.length === 0) return warnings

  if (!main) {
    warnings.push(
      `Ninguno de los ${integer(routeDetail.segments.length)} tramos de esta ruta está marcado como principal (isMain). Sin tramo principal no hay trayecto origen–destino vendible.`,
    )
    return warnings
  }

  if (main.origin.id !== routeDetail.origin.id) {
    warnings.push(
      `El origen de la ruta es ${routeDetail.origin.key} (${routeDetail.origin.name}), pero el del tramo principal ${main.number} es ${main.origin.key} (${main.origin.name}).`,
    )
  }
  if (main.destination.id !== routeDetail.destination.id) {
    warnings.push(
      `El destino de la ruta es ${routeDetail.destination.key} (${routeDetail.destination.name}), pero el del tramo principal ${main.number} es ${main.destination.key} (${main.destination.name}).`,
    )
  }

  return warnings
}

function IntegrityCheck({ warnings }: { warnings: Array<string> }) {
  return (
    <section aria-label="Verificación de integridad" className="pb-2">
      <Label>Verificación de integridad</Label>
      {warnings.length === 0 ? (
        <p className="mt-2 text-data text-ink-3">
          El tramo principal coincide con el origen y el destino de la ruta.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {warnings.map((warning) => (
            <li key={warning} className="flex items-start gap-2.5">
              <Stamp tone="warning" className="mt-px shrink-0">
                Aviso
              </Stamp>
              <span className="text-body text-ink-2">{warning}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
