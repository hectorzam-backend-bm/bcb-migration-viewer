import { createFileRoute } from '@tanstack/react-router'
import { KeyText, Field, Sheet, Stamp, ActivityStamp } from '~/components/base'
import { PageHeader, Breadcrumb, Breadcrumbs, BreadcrumbSeparator } from '~/components/shell'
import { ErrorState, EmptyState, ManifestSkeleton } from '~/components/states'
import { Card, Tab, Tabs, Grid, TextLink } from '~/components/card'
import { RefreshButton } from '~/components/refresh'
import {
  TableHead,
  TableBody,
  RowLink,
  TableRow,
  Manifest,
  Td,
  Th,
} from '~/components/table'
import { NO_DATA, STATION_TYPE_LABELS, integer, dateTime, currency, percent } from '~/lib/format'
import { stripDefaults, oneOf } from '~/lib/params'
import { getService, type ServiceDetail } from '~/server/services'

const TABS = ['stations', 'routes', 'passengers'] as const
type TabId = (typeof TABS)[number]
type ServiceDetailSearch = { tab: TabId }

const DEFAULTS: ServiceDetailSearch = { tab: 'stations' }

export const Route = createFileRoute('/servicios/$id')({
  validateSearch: (input: Record<string, unknown>): ServiceDetailSearch => ({
    tab: oneOf(input.tab, TABS, 'stations'),
  }),
  loader: ({ params }) => getService({ data: { id: params.id } }),
  component: Screen,
  pendingComponent: () => (
    <>
      <PageHeader title="Servicio" subtitle="Leyendo la ficha…" />
      <div className="px-4 sm:px-8 py-6">
        <Sheet className="overflow-hidden py-2">
          <ManifestSkeleton columns={[18, 26, 30, 14]} rows={6} />
        </Sheet>
      </div>
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <>
      <PageHeader title="Servicio" subtitle={NO_DATA} />
      <ErrorState
        title="No fue posible leer la ficha del servicio"
        detail={error instanceof Error ? error.message : String(error)}
        onRetry={reset}
      />
    </>
  ),
})

function Screen() {
  const data = Route.useLoaderData()
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()

  if (!data.ok) {
    return (
      <>
        <PageHeader
          title="Servicio"
          subtitle={NO_DATA}
          breadcrumbs={
            <Breadcrumbs>
              <Breadcrumb to="/servicios">Servicios</Breadcrumb>
            </Breadcrumbs>
          }
        />
        <ErrorState {...data.failure} />
      </>
    )
  }

  const s = data.service

  function onTabChange(value: string) {
    navigate({
      search: () =>
        stripDefaults(
          { tab: oneOf(value, TABS, 'stations') },
          DEFAULTS,
        ) as ServiceDetailSearch,
      replace: true,
    })
  }

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Breadcrumbs>
            <Breadcrumb to="/servicios">Servicios</Breadcrumb>
            <BreadcrumbSeparator />
            <span className="text-ink-2">{s.key || NO_DATA}</span>
          </Breadcrumbs>
        }
        title={s.name}
        subtitle={
          <>
            {s.key || NO_DATA}
            <span className="px-1.5 text-ink-4">·</span>
            No. {s.number || NO_DATA}
          </>
        }
        actions={
          <>
            <ActivityStamp active={s.isActive} deleted={s.isDeleted} />
            {s.hcmDisabled ? (
              <Stamp tone="warning" title="hcmDisabled — marca informativa de la sincronización HCM">
                HCM
              </Stamp>
            ) : null}
            <span aria-hidden className="h-4 w-px bg-rule" />
            <RefreshButton />
          </>
        }
      />

      <div className="space-y-5 px-4 sm:px-8 py-6">
        <Card title="Identificación">
          <Grid columns={2}>
            <Field label="Clave servicio" mono>
              {s.key || NO_DATA}
            </Field>
            <Field label="No. servicio" mono>
              {s.number || NO_DATA}
            </Field>
            <Field label="Nombre del servicio" wide>
              {s.name || NO_DATA}
            </Field>
            <Field label="Nombre corto">{s.shortName || NO_DATA}</Field>
            <Field label="Cuenta" mono>
              {s.account ?? NO_DATA}
            </Field>
            <Field label="Estatus">
              <ActivityStamp active={s.isActive} deleted={s.isDeleted} />
            </Field>
            <Field label="Despacho anticipado">
              {s.allowEarlyDispatch ? 'Sí' : 'No'}
            </Field>
          </Grid>
        </Card>

        <div className="grid gap-5 lg:grid-cols-3">
          <CompanyDetail company={s.company} />

          <Card title="Sincronización HCM" note="informativo">
            <div className="space-y-5">
              <Field label="Marca HCM">
                {s.hcmDisabled ? (
                  <Stamp tone="warning">Inhabilitado por HCM</Stamp>
                ) : (
                  <span className="text-ink-2">Sin marca</span>
                )}
              </Field>
              <Field label="Última corrida vista" mono>
                {s.hcmLastRunId ?? NO_DATA}
              </Field>
              <Field label="Origen del registro">
                {s.hcmLastRunId === null ? 'Alta manual' : 'Gestionado por HCM'}
              </Field>
            </div>
            <p className="mt-6 text-note leading-relaxed text-ink-3">
              Estas marcas son informativas: no alteran el funcionamiento del sistema.
            </p>
          </Card>

          <Card title="Rastro">
            <div className="space-y-5">
              <Field label="Creado" mono>
                {dateTime(s.createdAt)}
              </Field>
              <Field label="Actualizado" mono>
                {dateTime(s.updatedAt)}
              </Field>
              <Field label="Dado de baja" mono>
                {s.deletedAt ? (
                  <span className="text-rust">{dateTime(s.deletedAt)}</span>
                ) : (
                  NO_DATA
                )}
              </Field>
              <Field label="Identificador" mono>
                <span className="break-all text-ink-2">{s.id}</span>
              </Field>
            </div>
          </Card>
        </div>

        <Sheet className="overflow-hidden">
          <Tabs
            value={tab}
            onChange={onTabChange}
            options={[
              { value: 'stations', label: 'Terminales', count: s.stations.length },
              { value: 'routes', label: 'Rutas', count: s.routes.length },
              {
                value: 'passengers',
                label: 'Tipos de pasajero',
                count: s.passengerTypes.length,
              },
            ]}
          >
            <Tab value="stations">
              <StationsTable stations={s.stations} />
            </Tab>
            <Tab value="routes">
              <RoutesTable routes={s.routes} />
            </Tab>
            <Tab value="passengers">
              <PassengersTable types={s.passengerTypes} />
            </Tab>
          </Tabs>
        </Sheet>
      </div>
    </>
  )
}

/* ── Company ───────────────────────────────────────────────────────────────
   The cross-reference matters more than the field: the key and the trade name
   lead to the company's record. The stamp only shows if the company is anomalous. */
function CompanyDetail({ company }: { company: ServiceDetail['company'] }) {
  const isAnomalous = company.isDeleted || !company.isActive

  return (
    <Card title="Empresa">
      <div className="space-y-5">
        <Field label="Clave">
          <TextLink to="/empresas/$id" params={{ id: company.id }}>
            <KeyText emphasis>{company.key || NO_DATA}</KeyText>
          </TextLink>
        </Field>
        <Field label="Nombre comercial">
          <span className="flex flex-wrap items-center gap-2">
            <TextLink to="/empresas/$id" params={{ id: company.id }}>
              {company.tradeName || company.shortName || NO_DATA}
            </TextLink>
            {isAnomalous ? (
              <ActivityStamp active={company.isActive} deleted={company.isDeleted} />
            ) : null}
          </span>
        </Field>
        <Field label="Razón social">
          <span className="text-ink-2">{company.legalName || NO_DATA}</span>
        </Field>
      </div>
    </Card>
  )
}

/* ── Tabs ──────────────────────────────────────────────────────────────── */

function StationsTable({ stations }: { stations: ServiceDetail['stations'] }) {
  if (stations.length === 0) {
    return (
      <EmptyState
        title="Sin terminales asociadas"
        detail="Este servicio no tiene ninguna terminal ligada en la base migrada."
      />
    )
  }

  return (
    <Manifest label="Terminales del servicio">
      <TableHead>
        <Th numeric>Número</Th>
        <Th>Nombre corto</Th>
        <Th>Nombre</Th>
        <Th>Tipo</Th>
        <Th>Estado</Th>
        <Th>Estatus</Th>
      </TableHead>
      <TableBody>
        {stations.map((t) => (
          <TableRow key={t.id} dimmed={t.isDeleted}>
            <Td numeric>
              <RowLink to="/terminales/$id" params={{ id: t.id }}>
                <KeyText emphasis>{t.number || NO_DATA}</KeyText>
              </RowLink>
            </Td>
            <Td className="text-ink-2">{t.shortName || NO_DATA}</Td>
            <Td>
              <span className="block max-w-[24rem] truncate" title={t.name}>
                {t.name || NO_DATA}
              </span>
            </Td>
            <Td className="text-ink-2">{STATION_TYPE_LABELS[t.type] ?? t.type ?? NO_DATA}</Td>
            <Td className="text-ink-2">{t.state || NO_DATA}</Td>
            <Td>
              <ActivityStamp active={t.isActive} deleted={t.isDeleted} />
            </Td>
          </TableRow>
        ))}
      </TableBody>
    </Manifest>
  )
}

function RoutesTable({ routes }: { routes: ServiceDetail['routes'] }) {
  if (routes.length === 0) {
    return (
      <EmptyState
        title="Sin rutas registradas"
        detail="Este servicio no tiene ninguna ruta ligada en la base migrada."
      />
    )
  }

  return (
    <Manifest label="Rutas del servicio">
      <TableHead>
        <Th numeric>Número</Th>
        <Th>Nombre</Th>
        <Th>Origen → destino</Th>
        <Th numeric>Tramos</Th>
        <Th numeric>Tarifa sencilla</Th>
        <Th>Estatus</Th>
      </TableHead>
      <TableBody>
        {routes.map((r) => (
          <TableRow key={r.id} dimmed={r.isDeleted}>
            <Td numeric>
              <RowLink to="/rutas/$id" params={{ id: r.id }}>
                <KeyText emphasis>{r.number || NO_DATA}</KeyText>
              </RowLink>
            </Td>
            <Td>
              <span className="block max-w-[22rem] truncate" title={r.name}>
                {r.name || NO_DATA}
              </span>
            </Td>
            <Td>
              <span className="font-mono text-data text-ink-2">
                {r.origin || NO_DATA}
                <span className="px-1.5 text-ink-4">→</span>
                {r.destination || NO_DATA}
              </span>
            </Td>
            <Td numeric>
              <span className={r.segments === 0 ? 'text-ink-4' : undefined}>
                {integer(r.segments)}
              </span>
            </Td>
            <Td numeric>{currency(r.priceOneWay)}</Td>
            <Td>
              <ActivityStamp active={r.isActive} deleted={r.isDeleted} />
            </Td>
          </TableRow>
        ))}
      </TableBody>
    </Manifest>
  )
}

function PassengersTable({ types }: { types: ServiceDetail['passengerTypes'] }) {
  if (types.length === 0) {
    return (
      <EmptyState
        title="Sin tipos de pasajero asignados"
        detail="Este servicio no tiene ningún tipo de pasajero ligado en la base migrada."
      />
    )
  }

  return (
    <Manifest label="Tipos de pasajero del servicio">
      <TableHead>
        <Th>Clave</Th>
        <Th>Nombre</Th>
        <Th numeric>Descuento</Th>
        <Th numeric>Límite de asientos</Th>
        <Th>Documento requerido</Th>
        <Th>Estatus</Th>
      </TableHead>
      <TableBody>
        {types.map((p) => (
          <TableRow key={p.id} dimmed={p.isDeleted}>
            <Td>
              <KeyText emphasis>{p.key || NO_DATA}</KeyText>
            </Td>
            <Td>
              <span className="block max-w-[22rem] truncate" title={p.description ?? p.name}>
                {p.name || NO_DATA}
              </span>
            </Td>
            <Td numeric>
              <span className={p.discountPercent === 0 ? 'text-ink-4' : undefined}>
                {percent(p.discountPercent)}
              </span>
            </Td>
            <Td numeric>
              {p.seatingLimit === null ? (
                <span className="text-ink-4" title="Sin límite">
                  {NO_DATA}
                </span>
              ) : (
                integer(p.seatingLimit)
              )}
            </Td>
            <Td className="text-ink-2">
              {p.requiredDocument
                ? p.documentType
                  ? `Sí · ${p.documentType}`
                  : 'Sí'
                : 'No'}
            </Td>
            <Td>
              <ActivityStamp active={p.isActive} deleted={p.isDeleted} />
            </Td>
          </TableRow>
        ))}
      </TableBody>
    </Manifest>
  )
}
