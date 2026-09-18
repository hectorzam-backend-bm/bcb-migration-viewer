import { createFileRoute, useRouter } from '@tanstack/react-router'
import type { LinkProps } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { Stat, KeyText, Sheet, Label, Stamp } from '~/components/base'
import { PageHeader } from '~/components/shell'
import { ErrorState, ManifestSkeleton } from '~/components/states'
import { Block, TextLink } from '~/components/card'
import { TableHead, TableBody, RowLink, TableRow, Manifest, Td, Th } from '~/components/table'
import { RefreshButton } from '~/components/refresh'
import { cn } from '~/lib/cn'
import { integer, dateTime } from '~/lib/format'
import { getSummary, type CatalogKey, type CheckKey } from '~/server/summary'

/* ───────────────────────────────────────────────────────────────────────────
   The viewer's summary page. It is the only screen with a large focal point:
   the rest of the viewer is manifests. It answers the question the analyst
   arrives with —can I trust this migration?— before they open a catalog.
   ─────────────────────────────────────────────────────────────────────────── */

type Catalog = {
  key: CatalogKey
  label: string
  to: LinkProps['to']
  /** What has to be added to the URL to reach THIS listing. */
  search?: Record<string, unknown>
  inactive: string
  deleted: string
}

const CATALOGS: ReadonlyArray<Catalog> = [
  {
    key: 'companies',
    label: 'Empresas',
    to: '/empresas',
    inactive: 'inactivas',
    deleted: 'dadas de baja',
  },
  {
    key: 'services',
    label: 'Servicios',
    to: '/servicios',
    inactive: 'inactivos',
    deleted: 'dados de baja',
  },
  {
    key: 'stations',
    label: 'Terminales',
    to: '/terminales',
    inactive: 'inactivas',
    deleted: 'dadas de baja',
  },
  {
    key: 'routes',
    label: 'Rutas',
    to: '/rutas',
    search: { view: 'routes' },
    inactive: 'inactivas',
    deleted: 'dadas de baja',
  },
  {
    key: 'segments',
    label: 'Tramos',
    to: '/rutas',
    search: { view: 'segments' },
    inactive: 'inactivos',
    deleted: 'dados de baja',
  },
]

type Check = {
  key: CheckKey
  title: string
  explanation: string
  catalog: string
  to: LinkProps['to']
  search?: Record<string, unknown>
}

/* The order of this list is the capture order; the screen reorders it so the
   anomalous rows sit on top. No check links to a filtered listing: today no
   filter expresses these questions, and a link that does not filter lies. */
const CHECKS: ReadonlyArray<Check> = [
  {
    key: 'routesWithoutMainSegment',
    title: 'Rutas activas sin tramo principal',
    explanation:
      'Toda ruta activa debería tener un tramo marcado como principal: el que cubre su origen y su destino. Sin él la ruta no se puede vender completa.',
    catalog: 'Rutas',
    to: '/rutas',
    search: { view: 'routes' },
  },
  {
    key: 'routesWithoutSegments',
    title: 'Rutas sin ningún tramo',
    explanation:
      'La ruta migró, pero no trae tramos vigentes colgando de ella. Quedó como cascarón.',
    catalog: 'Rutas',
    to: '/rutas',
    search: { view: 'routes' },
  },
  {
    key: 'circularSegments',
    title: 'Tramos que salen y llegan a la misma terminal',
    explanation:
      'El origen y el destino del tramo apuntan a la misma terminal: casi siempre es un error de captura arrastrado desde el sistema anterior.',
    catalog: 'Tramos',
    to: '/rutas',
    search: { view: 'segments' },
  },
  {
    key: 'servicesWithoutRoutes',
    title: 'Servicios sin rutas',
    explanation: 'El servicio no tiene ninguna ruta vigente asignada, así que no opera nada.',
    catalog: 'Servicios',
    to: '/servicios',
  },
  {
    key: 'servicesWithoutStations',
    title: 'Servicios sin terminales',
    explanation:
      'El servicio no está asociado a ninguna terminal vigente: no tiene dónde vender ni despachar.',
    catalog: 'Servicios',
    to: '/servicios',
  },
  {
    key: 'stationsWithoutServices',
    title: 'Terminales sin servicios',
    explanation:
      'La terminal existe pero ningún servicio vigente la usa. Puede ser correcto en una terminal recién dada de alta.',
    catalog: 'Terminales',
    to: '/terminales',
  },
  {
    key: 'companiesWithoutServices',
    title: 'Empresas sin servicios',
    explanation: 'La empresa migró sin ningún servicio vigente bajo ella.',
    catalog: 'Empresas',
    to: '/empresas',
  },
  {
    key: 'routesWithoutSalesChannels',
    title: 'Rutas sin canales de venta',
    explanation:
      'Sin al menos un canal asociado, la ruta no aparece en ningún punto de venta: ni taquilla, ni web, ni app.',
    catalog: 'Rutas',
    to: '/rutas',
    search: { view: 'routes' },
  },
  {
    key: 'routesWithoutPassengerTypes',
    title: 'Rutas sin tipos de pasajero',
    explanation:
      'Sin tipos de pasajero no hay tarifa que cotizar: no se puede emitir un boleto de esa ruta.',
    catalog: 'Rutas',
    to: '/rutas',
    search: { view: 'routes' },
  },
]

const HCM_ROWS = [
  { key: 'companies', label: 'Empresas', to: '/empresas', filterable: true },
  { key: 'services', label: 'Servicios', to: '/servicios', filterable: false },
] as const

const LOADING_COLUMNS = [38, 12, 10, 10]

export const Route = createFileRoute('/')({
  loader: () => getSummary(),
  component: SummaryPage,
  pendingComponent: () => (
    <>
      <PageHeader title="Resumen" subtitle="Contando registros…" />
      <div className="px-4 py-6">
        <ManifestSkeleton columns={LOADING_COLUMNS} rows={9} />
      </div>
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <>
      <PageHeader title="Resumen" subtitle="Estado de la migración" />
      <ErrorState
        title="No fue posible construir el resumen"
        detail={error instanceof Error ? error.message : String(error)}
        suggestion="Vuelve a intentarlo; si persiste, revisa la conexión a la base de datos."
        onRetry={reset}
      />
    </>
  ),
})

function SummaryPage() {
  const data = Route.useLoaderData()
  const router = useRouter()

  // If the database did not answer, the whole summary page falls to the error:
  // painting cards at zero would say the migration is empty, a different lie.
  if (!data.ok) {
    return (
      <>
        <PageHeader title="Resumen" subtitle="Estado de la migración" />
        <ErrorState {...data.failure} onRetry={() => router.invalidate()} />
      </>
    )
  }

  const { catalogs, checks, hcm, generatedAt } = data

  const totalCurrent = CATALOGS.reduce((total, c) => total + catalogs[c.key].current, 0)
  const totalInactive = CATALOGS.reduce((total, c) => total + catalogs[c.key].inactive, 0)
  const totalDeleted = CATALOGS.reduce((total, c) => total + catalogs[c.key].deleted, 0)

  // Anomalies on top: first the ones with findings, largest to smallest.
  const rows = CHECKS.map((r) => ({ ...r, count: checks[r.key] })).sort(
    (a, b) => b.count - a.count,
  )
  const withFindings = rows.filter((r) => r.count > 0).length
  const largest = rows[0]

  return (
    <>
      <PageHeader
        actions={<RefreshButton showTimestamp={false} />}
        title="Resumen"
        subtitle={`Estado de la migración · consultado el ${dateTime(generatedAt)}`}
      />

      <div className="px-4 sm:px-8 pt-6 pb-14">
        {/* ── Focal point ─────────────────────────────────────────────── */}
        <Sheet className="grid sm:grid-cols-[1.1fr_1fr]">
          <div className="p-5">
            <Label>Registros vigentes</Label>
            <p
              data-numeric
              className="mt-2 font-mono text-display leading-none font-medium tracking-[-0.015em] text-ink"
            >
              {integer(totalCurrent)}
            </p>
            <p className="mt-3 max-w-[46ch] text-note text-ink-3">
              Suma de los cinco catálogos sin borrado lógico. Incluye{' '}
              <KeyText className="text-note">{integer(totalInactive)}</KeyText> inactivos; quedan
              fuera <KeyText className="text-note">{integer(totalDeleted)}</KeyText> dados de baja.
            </p>
          </div>

          <div className="border-t border-rule p-5 sm:border-t-0 sm:border-l">
            <div className="flex items-start justify-between gap-3">
              <Label>Revisiones con hallazgos</Label>
              <Stamp tone={withFindings > 0 ? 'warning' : 'active'}>
                {withFindings > 0 ? 'Revisar' : 'Limpio'}
              </Stamp>
            </div>
            <p
              data-numeric
              className="mt-2 font-mono text-display leading-none font-medium tracking-[-0.015em] text-ink"
            >
              {integer(withFindings)}
              <span className="text-section text-ink-4"> / {integer(rows.length)}</span>
            </p>
            <p className="mt-3 max-w-[46ch] text-note text-ink-3">
              {withFindings === 0 || largest === undefined ? (
                'Ninguna comprobación de integridad encontró registros fuera de lugar.'
              ) : (
                <>
                  La mayor es «{largest.title.toLowerCase()}», con{' '}
                  <KeyText className="text-note">{integer(largest.count)}</KeyText> registros. El
                  desglose completo está abajo.
                </>
              )}
            </p>
          </div>
        </Sheet>

        {/* ── Catalogs ────────────────────────────────────────────────── */}
        <Block label="Catálogos">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {CATALOGS.map((c) => {
              const count = catalogs[c.key]
              return (
                <Sheet
                  key={c.key}
                  className={cn(
                    'group relative p-4 transition-colors duration-100',
                    'hover:border-rule-strong hover:bg-row/45',
                    'has-focus-visible:border-rule-strong has-focus-visible:bg-row',
                  )}
                >
                  <RowLink
                    to={c.to}
                    search={c.search}
                    className="absolute inset-0 rounded-sheet"
                  >
                    <span className="sr-only">Ver el catálogo de {c.label.toLowerCase()}</span>
                  </RowLink>

                  <ArrowUpRight
                    size={13}
                    strokeWidth={1.75}
                    aria-hidden
                    className={cn(
                      'absolute top-4 right-4 text-ink-4 opacity-0',
                      'transition-[opacity,transform] duration-150',
                      'group-hover:translate-x-px group-hover:opacity-100',
                    )}
                  />

                  <Stat label={c.label} value={integer(count.current)} />

                  <div className="mt-3.5 flex flex-col items-start gap-1">
                    <Breakdown
                      count={count.inactive}
                      label={c.inactive}
                      to={c.to}
                      search={{ ...c.search, status: ['inactive'] }}
                    />
                    <Breakdown
                      count={count.deleted}
                      label={c.deleted}
                      to={c.to}
                      search={{ ...c.search, deleted: true }}
                    />
                  </div>
                </Sheet>
              )
            })}
          </div>
        </Block>

        {/* ── Integrity checks ────────────────────────────────────────── */}
        <Block label="Revisiones de integridad">
          <Sheet className="overflow-hidden">
            <Manifest label="Revisiones de integridad de la migración">
              <TableHead>
                <Th>Revisión</Th>
                <Th>Catálogo</Th>
                <Th numeric>Encontrados</Th>
                <Th>Estado</Th>
              </TableHead>
              <TableBody>
                {rows.map((r) => {
                  const finding = r.count > 0
                  return (
                    <TableRow key={r.key}>
                      <Td>
                        <span
                          className={cn(
                            'block text-body',
                            finding ? 'font-medium text-ink' : 'text-ink-2',
                          )}
                        >
                          {r.title}
                        </span>
                        {/* The measure cap goes on the inner block, not on the cell:
                            a cell with max-width does not constrain the column. */}
                        <span className="mt-0.5 block max-w-[68ch] text-note text-ink-3">
                          {r.explanation}
                        </span>
                      </Td>
                      <Td>
                        <TextLink to={r.to} search={r.search} className="text-data text-ink-2">
                          {r.catalog}
                        </TextLink>
                      </Td>
                      <Td numeric>
                        <span className={finding ? 'font-medium text-ink' : 'text-ink-4'}>
                          {integer(r.count)}
                        </span>
                      </Td>
                      <Td>
                        <Stamp tone={finding ? 'warning' : 'active'}>
                          {finding ? 'Revisar' : 'Limpio'}
                        </Stamp>
                      </Td>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Manifest>
          </Sheet>
        </Block>

        {/* ── HCM sync ────────────────────────────────────────────────── */}
        <Block label="Sincronización HCM">
          <Sheet className="overflow-hidden">
            <Manifest label="Origen de los registros según la sincronización HCM">
              <TableHead>
                <Th>Catálogo</Th>
                <Th numeric>Gestionados por HCM</Th>
                <Th numeric>Capturados a mano</Th>
                <Th numeric>Marcados como desactivados</Th>
              </TableHead>
              <TableBody>
                {HCM_ROWS.map((f) => {
                  const count = hcm[f.key]
                  return (
                    <TableRow key={f.key}>
                      <Td>
                        <TextLink to={f.to} className="text-body text-ink">
                          {f.label}
                        </TextLink>
                      </Td>
                      <Td numeric>
                        <HcmStat
                          count={count.managed}
                          to={f.filterable ? f.to : undefined}
                          search={{ source: ['hcm'] }}
                          title={`${f.label} con hcmLastSeenRunId`}
                        />
                      </Td>
                      <Td numeric>
                        <HcmStat
                          count={count.manual}
                          to={f.filterable ? f.to : undefined}
                          search={{ source: ['manual'] }}
                          title={`${f.label} sin hcmLastSeenRunId`}
                        />
                      </Td>
                      <Td numeric>
                        <span
                          title={`${f.label} con hcmDisabled`}
                          className={count.disabled > 0 ? 'text-amber' : 'text-ink-4'}
                        >
                          {integer(count.disabled)}
                        </span>
                      </Td>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Manifest>
          </Sheet>
          <p className="mt-3 max-w-[78ch] text-note text-ink-3">
            Informativo: estas marcas no cambian el comportamiento del sistema. Un registro
            gestionado por HCM es el que trae <KeyText className="text-note">hcmLastSeenRunId</KeyText>{' '}
            —lo trajo alguna corrida del sincronizador—; los capturados a mano nunca se marcan. La
            última columna cuenta los que el sincronizador marcó con{' '}
            <KeyText className="text-note">hcmDisabled</KeyText> porque GER dejó de reportarlos.
          </p>
        </Block>
      </div>
    </>
  )
}

/* ── Card breakdown ───────────────────────────────────────────────────────
   At zero it does not link: it retreats to the quietest ink and stops being
   a destination. What is worth zero does not deserve a click.              */
function Breakdown({
  count,
  label,
  to,
  search,
}: {
  count: number
  label: string
  to: LinkProps['to']
  search?: Record<string, unknown>
}) {
  if (count === 0) {
    return (
      <span className="text-note text-ink-4">
        <KeyText className="text-note text-ink-4">{integer(count)}</KeyText> {label}
      </span>
    )
  }

  return (
    <TextLink to={to} search={search} className="relative z-10 text-note text-ink-2">
      <KeyText className="text-note">{integer(count)}</KeyText> {label}
    </TextLink>
  )
}

/** Stat in the HCM table: links only when the listing knows how to filter by source. */
function HcmStat({
  count,
  to,
  search,
  title,
}: {
  count: number
  to?: LinkProps['to']
  search?: Record<string, unknown>
  title: string
}) {
  if (to === undefined || count === 0) {
    return (
      <span title={title} className={count === 0 ? 'text-ink-4' : 'text-ink'}>
        {integer(count)}
      </span>
    )
  }

  return (
    <TextLink to={to} search={search} className="text-ink">
      <span title={title}>{integer(count)}</span>
    </TextLink>
  )
}
