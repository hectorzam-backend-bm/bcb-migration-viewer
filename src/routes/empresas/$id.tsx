import { createFileRoute, notFound } from '@tanstack/react-router'
import { createColumnHelper, useTable } from '@tanstack/react-table'
import { Stat, KeyText, Field, Sheet, Rule, Stamp, ActivityStamp } from '~/components/base'
import { PageHeader, Breadcrumb, Breadcrumbs, BreadcrumbSeparator } from '~/components/shell'
import { SkeletonBar, ErrorState, EmptyState } from '~/components/states'
import { Card, Grid, TextLink } from '~/components/card'
import { RefreshButton } from '~/components/refresh'
import { RowLink } from '~/components/table'
import { DataTable, features } from '~/components/data-table'
import { NO_DATA, integer, dateTime, plural } from '~/lib/format'
import { getCompany, type CompanyService } from '~/server/companies'

const serviceHelper = createColumnHelper<typeof features, CompanyService>()

const serviceColumns = serviceHelper.columns([
  serviceHelper.accessor('key', {
    header: 'Clave',
    cell: ({ row, getValue }) => (
      <RowLink to="/servicios/$id" params={{ id: row.original.id }} className="inline-block">
        <KeyText emphasis>{getValue()}</KeyText>
      </RowLink>
    ),
  }),
  serviceHelper.accessor('number', {
    header: 'Número',
    meta: { numeric: true, className: 'text-ink-2' },
    cell: ({ getValue }) => getValue() || NO_DATA,
  }),
  serviceHelper.accessor('name', {
    header: 'Nombre',
    meta: { className: 'text-ink' },
    cell: ({ getValue }) => getValue() || NO_DATA,
  }),
  serviceHelper.display({
    id: 'status',
    header: 'Estatus',
    cell: ({ row }) => (
      <ActivityStamp active={row.original.isActive} deleted={row.original.isDeleted} />
    ),
  }),
])

/** Stable empty fallback: a fresh `[]` on every render would invalidate the
 *  table's data reference for nothing. */
const NO_SERVICES: Array<CompanyService> = []

/* ───────────────────────────────────────────────────────────────────────────
   Company card. The detail is worth what it links to: every service leads
   to its own, and the scope block says how much catalog hangs off here.
   ─────────────────────────────────────────────────────────────────────────── */

export const Route = createFileRoute('/empresas/$id')({
  loader: async ({ params }) => {
    const result = await getCompany({ data: { id: params.id } })
    if (result.ok && result.company === null) throw notFound()
    return result
  },
  component: Screen,
  pendingComponent: CardSkeleton,
  notFoundComponent: () => (
    <>
      <PageHeader
        title="Empresa no encontrada"
        breadcrumbs={
          <Breadcrumbs>
            <Breadcrumb to="/empresas">Empresas</Breadcrumb>
            <BreadcrumbSeparator />
            <span className="text-ink-4">?</span>
          </Breadcrumbs>
        }
      />
      <EmptyState
        title="No existe una empresa con ese identificador"
        detail="El registro pudo borrarse de la base o la dirección está mal copiada. Vuelve al catálogo para buscarla por clave."
      />
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <ErrorState
      title="No fue posible leer la ficha de la empresa"
      detail={error instanceof Error ? error.message : String(error)}
      onRetry={reset}
    />
  ),
})

function CardSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="px-4 sm:px-8 pt-7">
      <span className="sr-only">Cargando la ficha de la empresa…</span>
      <SkeletonBar className="h-[22px] w-64" />
      <Rule double className="mt-5" />
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Sheet className="p-5 lg:col-span-2">
          <div className="grid gap-5 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ opacity: 1 - i * 0.1 }}>
                <SkeletonBar className="h-[8px] w-20" />
                <SkeletonBar className="mt-2 w-40" />
              </div>
            ))}
          </div>
        </Sheet>
        <Sheet className="p-5">
          <div className="grid gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ opacity: 1 - i * 0.15 }}>
                <SkeletonBar className="h-[8px] w-24" />
                <SkeletonBar className="mt-2 h-[20px] w-16" />
              </div>
            ))}
          </div>
        </Sheet>
      </div>
    </div>
  )
}

function Screen() {
  const result = Route.useLoaderData()
  const company = result.ok ? result.company : null

  // Hooks run unconditionally, before the early returns below. No sorting,
  // filtering or pagination here — `enableSorting: false` keeps the shared
  // `features`' sort affordance from showing up on a table that has none.
  const table = useTable({
    features,
    columns: serviceColumns,
    data: company?.services ?? NO_SERVICES,
    getRowId: (row) => row.id,
    enableSorting: false,
  })

  if (!result.ok) {
    return (
      <>
        <PageHeader title="Empresa" subtitle={NO_DATA} />
        <ErrorState {...result.failure} />
      </>
    )
  }

  if (!company) return null

  const deletedServices = company.services.filter((s) => s.isDeleted).length

  return (
    <>
      <PageHeader
        actions={<RefreshButton />}
        title={company.tradeName}
        breadcrumbs={
          <Breadcrumbs>
            <Breadcrumb to="/empresas">Empresas</Breadcrumb>
            <BreadcrumbSeparator />
            <span className="text-ink-2">{company.key}</span>
          </Breadcrumbs>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <KeyText emphasis>{company.key}</KeyText>
            <span aria-hidden className="text-ink-4">
              ·
            </span>
            <ActivityStamp active={company.isActive} deleted={company.isDeleted} />
            {company.hcmDisabled ? (
              <Stamp
                tone="warning"
                title="HCM la reportó ausente o con estatus N. Es meramente informativo: no afecta el funcionamiento del sistema."
              >
                HCM
              </Stamp>
            ) : null}
          </span>
        }
      />

      <div className="px-4 sm:px-8 py-6">
        <div className="grid gap-5 lg:grid-cols-3">
          <Card title="Identificación" className="lg:col-span-2">
            <Grid columns={2}>
              <Field label="Clave" mono>
                {company.key || NO_DATA}
              </Field>
              <Field label="Nombre corto">{company.shortName || NO_DATA}</Field>
              <Field label="Nombre comercial">
                {company.tradeName || NO_DATA}
              </Field>
              <Field label="Razón social">{company.legalName || NO_DATA}</Field>
              <Field label="Estatus">
                <ActivityStamp
                  active={company.isActive}
                  deleted={company.isDeleted}
                />
              </Field>
              <Field label="Identificador" mono>
                <span className="break-all text-ink-3">{company.id}</span>
              </Field>
            </Grid>
          </Card>

          <Card title="Alcance" note="registros vigentes">
            <div className="grid gap-5 sm:grid-cols-3 lg:grid-cols-1">
              <Stat
                label="Servicios"
                value={integer(company.scope.services)}
                note={
                  deletedServices > 0
                    ? `${plural(deletedServices, 'servicio dado de baja', 'servicios dados de baja')}, fuera del conteo`
                    : 'Servicios sin borrado lógico'
                }
              />
              <Stat
                label="Terminales alcanzadas"
                value={integer(company.scope.stations)}
                note="Distintas, a través de sus servicios"
              />
              <Stat
                label="Rutas"
                value={integer(company.scope.routes)}
                note="De todos sus servicios vigentes"
              />
            </div>
          </Card>
        </div>

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
          <Card title="Sincronización HCM">
            <Grid columns={2}>
              <Field label="Marca de ausencia">
                {company.hcmDisabled ? (
                  <Stamp tone="warning">Reportada ausente</Stamp>
                ) : (
                  <span className="text-ink-2">Sin marca</span>
                )}
              </Field>
              <Field label="Origen del registro">
                <span className="text-ink-2">
                  {company.syncedByHcm
                    ? 'Sincronizada por HCM'
                    : 'Creada a mano'}
                </span>
              </Field>
              <Field label="Última corrida que la trajo" mono wide>
                {company.hcmRunId ? (
                  <span className="break-all">{company.hcmRunId}</span>
                ) : (
                  <span className="text-ink-4">{NO_DATA}</span>
                )}
              </Field>
            </Grid>
            <Rule className="my-4" />
            <p className="text-data leading-relaxed text-ink-3">
              Estos dos campos son <strong className="font-medium">meramente
              informativos</strong> y no alteran el funcionamiento del sistema. Los
              escribe únicamente la sincronización con HCM, nunca el CRUD: una
              empresa sin corrida registrada se capturó a mano y jamás debe
              marcarse como ausente.
            </p>
          </Card>

          <Card title="Rastro">
            <Grid columns={2}>
              <Field label="Creado" mono>
                {dateTime(company.createdAt)}
              </Field>
              <Field label="Creado por">
                {company.createdBy ?? (
                  <span className="text-ink-4">{NO_DATA}</span>
                )}
              </Field>
              <Field label="Última actualización" mono>
                {dateTime(company.updatedAt)}
              </Field>
              <Field label="Actualizado por">
                {company.updatedBy ?? (
                  <span className="text-ink-4">{NO_DATA}</span>
                )}
              </Field>
              {company.deletedAt ? (
                <Field label="Dada de baja" mono wide>
                  <span className="text-rust">{dateTime(company.deletedAt)}</span>
                </Field>
              ) : null}
            </Grid>
          </Card>
        </div>

        <Card
          title="Servicios"
          note={plural(company.services.length, 'servicio', 'servicios')}
          className="mt-5"
        >
          <div className="-m-5">
            {company.services.length === 0 ? (
              <EmptyState
                title="Esta empresa migró sin servicios asociados"
                detail="No hay ningún registro de Service que apunte a esta empresa. En el sistema anterior la empresa existía, pero ningún servicio quedó ligado a ella."
              />
            ) : (
              <DataTable
                table={table}
                label={`Servicios de ${company.tradeName}`}
                rowProps={(row) => ({ dimmed: row.original.isDeleted })}
              />
            )}
          </div>
        </Card>

        <p className="mt-5 text-data text-ink-3">
          <TextLink to="/servicios" search={{ company: [company.id] }}>
            Ver estos servicios en el catálogo completo
          </TextLink>
        </p>
      </div>
    </>
  )
}
