import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { RotateCw, TriangleAlert } from 'lucide-react'
import { Label, Rule, Sheet, Stamp, Stat } from '~/components/base'
import { PageHeader } from '~/components/shell'
import { ErrorState, SkeletonBar } from '~/components/states'
import { RefreshButton } from '~/components/refresh'
import { cn } from '~/lib/cn'
import { NO_DATA, integer, plural } from '~/lib/format'
import { integerParam, stripDefaults } from '~/lib/params'
import { cleanDatabase, getImportStatus, runImport } from '~/server/seeds'
import type { ImportReport, ImportStatus } from '~/server/seeds'
import { assignUnitToRoutes, restoreCatalog, restoreUnits } from '~/server/restore'
import { STEPS } from './steps'
import type { SlotKey, StepDef } from './steps'
import { Stepper } from './stepper'
import { FileDrop } from './dropzone'
import { ReportPanel } from './report'

/**
 * `/importar` — a step-by-step wizard over the backend's `/seeds/*` endpoints
 * (see `~/server/seeds`). This is the one screen in the viewer that writes
 * anything, and even here the writing happens in the backend API, never in
 * this app's Prisma client: `src/server/db.ts`'s read-only lock is untouched.
 *
 * Order is advisory except for the trips step: uploading corridas before
 * every route has a unit silently produces trips with 0 seats (this is what
 * happened to the 5,014 trips already in the local DB), so that one step is
 * a hard gate, not just a suggestion.
 */

type SeedsFailure = { title: string; detail: string; suggestion: string }

type RunState =
  | { status: 'running' }
  | { status: 'done'; report?: ImportReport; message?: string }
  | { status: 'failed'; failure: SeedsFailure }

/** Every run keyed by step index, plus the one fixed key for the units step's
 *  optional assign action — the only run in the wizard that isn't itself a
 *  step. */
type RunKey = number | 'assign'

const DEFAULT_SEARCH = { paso: 0 }

function pruneSearch(paso: number): Partial<typeof DEFAULT_SEARCH> {
  return stripDefaults({ paso }, DEFAULT_SEARCH)
}

export const Route = createFileRoute('/importar/')({
  validateSearch: (input: Record<string, unknown>): Partial<typeof DEFAULT_SEARCH> =>
    pruneSearch(integerParam(input.paso, 0, 0, STEPS.length - 1)),
  loader: () => getImportStatus(),
  component: Screen,
  pendingComponent: () => (
    <>
      <PageHeader title="Importar" subtitle="Leyendo el estado de la base…" />
      <div className="px-4 sm:px-8 py-6">
        <Sheet className="space-y-3 p-5">
          <SkeletonBar className="w-1/3" />
          <SkeletonBar className="w-full" />
          <SkeletonBar className="w-2/3" />
        </Sheet>
      </div>
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <>
      <PageHeader title="Importar" subtitle={NO_DATA} />
      <ErrorState
        title="No fue posible leer el estado de la importación"
        detail={error instanceof Error ? error.message : String(error)}
        onRetry={reset}
      />
    </>
  ),
})

/** The house secondary-button recipe, copied verbatim from `refresh.tsx` —
 *  this page does not introduce a shared `Button`. */
const ACTION_BUTTON_CLASS = cn(
  'inline-flex h-9 items-center gap-2 rounded-chip border border-rule px-3',
  'font-mono text-note font-medium tracking-[0.08em] text-ink-2 uppercase',
  'transition-[colors,transform] duration-100',
  'hover:border-rule-strong hover:bg-row hover:text-ink',
  'active:scale-[0.97]',
  'disabled:pointer-events-none disabled:text-ink-3',
)

const DANGER_BUTTON_CLASS = cn(
  'inline-flex h-9 items-center rounded-chip border border-rust/40 px-3',
  'font-mono text-note font-medium tracking-[0.08em] text-rust uppercase',
  'transition-[colors,transform] duration-100 hover:bg-rust/10 active:scale-[0.97]',
  'disabled:pointer-events-none disabled:border-rule-faint disabled:text-ink-4',
)

/** The `ErrorState` rust-wash card, without its `mx-auto max-w-lg px-6 py-16`
 *  centering wrapper — that spacing is for a full page, not a nested panel. */
function RunFailure({ failure, onRetry }: { failure: SeedsFailure; onRetry: () => void }) {
  return (
    <div className="mt-4 rounded-sheet border border-rust/25 bg-rust-wash p-4">
      <div className="flex items-start gap-3">
        <TriangleAlert size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-rust" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-body font-medium text-ink">{failure.title}</h3>
          {failure.suggestion ? <p className="mt-1.5 text-body text-ink-2">{failure.suggestion}</p> : null}
          {failure.detail ? (
            <pre className="mt-2 overflow-x-auto font-mono text-note leading-relaxed whitespace-pre-wrap text-ink-3">
              {failure.detail}
            </pre>
          ) : null}
          <button type="button" onClick={onRetry} className={cn(DANGER_BUTTON_CLASS, 'mt-3 h-8')}>
            Reintentar
          </button>
        </div>
      </div>
    </div>
  )
}

function CleanPanel({ def, run, onClean }: { def: StepDef; run: RunState | undefined; onClean: () => void }) {
  const [word, setWord] = useState('')
  const isRunning = run?.status === 'running'
  const isReady = word === 'LIMPIAR'

  return (
    <div aria-busy={isRunning}>
      <p className="max-w-[70ch] text-body text-ink-2">{def.description}</p>

      <div className="mt-5 rounded-sheet border border-rust/30 p-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (isReady) onClean()
          }}
        >
          <div>
            <label
              htmlFor="clean-confirm"
              className="block font-mono text-note font-medium tracking-[0.09em] text-ink-3 uppercase"
            >
              Escribe LIMPIAR para confirmar
            </label>
            <input
              id="clean-confirm"
              value={word}
              onChange={(e) => setWord(e.target.value.toUpperCase())}
              autoComplete="off"
              spellCheck={false}
              disabled={isRunning}
              placeholder="LIMPIAR"
              className={cn(
                'mt-1.5 h-9 w-48 rounded-chip border border-rule bg-sunken px-2.5',
                'font-mono text-body tracking-[0.12em] text-ink placeholder:text-ink-4',
                'transition-colors duration-100 hover:border-rule-strong focus:border-rust/60 focus:outline-none',
              )}
            />
          </div>
          {isReady ? (
            <button type="submit" disabled={isRunning} className={DANGER_BUTTON_CLASS}>
              {isRunning ? (
                <span className="inline-flex items-center gap-2">
                  <RotateCw size={13} strokeWidth={1.75} aria-hidden className="animate-[rotate_700ms_linear_infinite]" />
                  Limpiando…
                </span>
              ) : (
                'Limpiar la base'
              )}
            </button>
          ) : (
            <span title="Escribe LIMPIAR para habilitar el botón">
              <button type="button" disabled className={DANGER_BUTTON_CLASS}>
                Limpiar la base
              </button>
            </span>
          )}
        </form>
      </div>

      {run?.status === 'done' ? <p className="mt-4 text-body text-ink-2">{run.message}</p> : null}
      {run?.status === 'failed' ? <RunFailure failure={run.failure} onRetry={onClean} /> : null}
    </div>
  )
}

/**
 * Serves both `restoreTarget`s: "Empresas y servicios" (`catalog`) and
 * "Unidades" (`units`). The assign control is `units`-only and optional —
 * restoring units does not assign them to anything by itself.
 */
function RestorePanel({
  def,
  status,
  run,
  onRestore,
  assign,
}: {
  def: StepDef
  status: ImportStatus
  run: RunState | undefined
  onRestore: () => void
  assign?: {
    unitId: string
    onUnitChange: (unitId: string) => void
    run: RunState | undefined
    onAssign: () => void
  }
}) {
  const { done, note } = def.status(status)
  const isRunning = run?.status === 'running'
  const isAssigning = assign?.run?.status === 'running'

  return (
    <div aria-busy={isRunning}>
      <p className="max-w-[70ch] text-body text-ink-2">{def.description}</p>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        {def.restoreTarget === 'units' ? (
          <>
            <Stat value={integer(status.units)} label="Unidades" />
            <Stat value={integer(status.unitDecks)} label="Niveles" />
          </>
        ) : (
          <>
            <Stat value={integer(status.companies)} label="Empresas" />
            <Stat value={integer(status.services)} label="Servicios" />
          </>
        )}
      </div>

      <Rule className="my-5" />

      <div className="flex flex-wrap items-center gap-3">
        <Stamp tone={done ? 'active' : 'warning'}>{done ? 'Listo' : 'Faltan'}</Stamp>
        <span className="text-body text-ink-2">{note}</span>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onRestore} disabled={isRunning} className={ACTION_BUTTON_CLASS}>
          {isRunning ? (
            <span className="inline-flex items-center gap-2">
              <RotateCw size={13} strokeWidth={1.75} aria-hidden className="animate-[rotate_700ms_linear_infinite]" />
              Restaurando…
            </span>
          ) : (
            'Restaurar desde el respaldo'
          )}
        </button>
        <span className="text-note text-ink-3">
          {def.restoreTarget === 'units' ? 'Unit.json y UnitDeck.json' : 'Company.json y Service.json'}, incluidos en
          el visor.
        </span>
      </div>

      {run?.status === 'done' && run.report ? <ReportPanel title={def.title} report={run.report} /> : null}
      {run?.status === 'failed' ? <RunFailure failure={run.failure} onRetry={onRestore} /> : null}

      {assign ? (
        <div className="mt-6 border-t border-rule pt-5">
          <Label>Asignar una unidad a las rutas sin unidad</Label>
          <p className="mt-2 max-w-[68ch] text-body text-ink-2">
            Atajo de migración, no una decisión de negocio: asigna la misma unidad a las{' '}
            {integer(status.routesWithoutUnit)} rutas que todavía no tienen una, para poder avanzar al paso de
            Corridas. Puedes reasignarlas después, ruta por ruta, en el panel de administración.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <select
              value={assign.unitId}
              onChange={(e) => assign.onUnitChange(e.target.value)}
              disabled={isAssigning || status.unitOptions.length === 0}
              className={cn(
                'h-9 rounded-chip border border-rule bg-sunken px-2.5',
                'font-mono text-body text-ink',
                'transition-colors duration-100 hover:border-rule-strong focus:border-stamp/60 focus:outline-none',
                'disabled:pointer-events-none disabled:text-ink-4',
              )}
            >
              <option value="">Elige una unidad…</option>
              {status.unitOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {plural(u.capacity, 'asiento', 'asientos')}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={assign.onAssign}
              disabled={!assign.unitId || isAssigning || status.routesWithoutUnit === 0}
              className={ACTION_BUTTON_CLASS}
            >
              {isAssigning ? (
                <span className="inline-flex items-center gap-2">
                  <RotateCw size={13} strokeWidth={1.75} aria-hidden className="animate-[rotate_700ms_linear_infinite]" />
                  Asignando…
                </span>
              ) : (
                `Asignar a las ${integer(status.routesWithoutUnit)} rutas sin unidad`
              )}
            </button>
          </div>

          {assign.run?.status === 'done' && assign.run.report ? (
            <ReportPanel title="Asignación de unidad" report={assign.run.report} />
          ) : null}
          {assign.run?.status === 'failed' ? <RunFailure failure={assign.run.failure} onRetry={assign.onAssign} /> : null}
        </div>
      ) : null}
    </div>
  )
}

function TripsGate({ status }: { status: ImportStatus }) {
  const withUnit = status.routes - status.routesWithoutUnit
  // `routesWithoutUnit > 0` alone is vacuously false on an empty Route table
  // (nothing to lack a unit) — a freshly cleaned base would otherwise read as
  // "Listo" while `import/trips` would actually reject it with
  // NO_ROUTES_IMPORTED. No routes at all is its own blocked state.
  const noRoutes = status.routes === 0
  const blocked = noRoutes || status.routesWithoutUnit > 0

  return (
    <div className="mb-5 rounded-sheet border border-rule p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Label>Rutas con unidad asignada</Label>
          <p
            data-numeric
            className="mt-2 font-mono text-display leading-none font-medium tracking-[-0.01em] text-ink"
          >
            {integer(withUnit)}
            <span className="text-section text-ink-4"> / {integer(status.routes)}</span>
          </p>
        </div>
        <Stamp tone={blocked ? 'warning' : 'active'}>{blocked ? 'Bloqueado' : 'Listo'}</Stamp>
      </div>
      <p className="mt-3 max-w-[68ch] text-body text-ink-2">
        {noRoutes
          ? 'Todavía no hay rutas importadas — sube primero el paso de Rutas.'
          : blocked
            ? 'Cada ruta necesita una unidad asignada antes de poder crear sus corridas: la unidad define el acomodo de asientos de cada viaje. El paso de Unidades tiene una asignación rápida, o asígnalas una por una en el panel de administración — luego vuelve a leer.'
            : 'Todas las rutas tienen unidad asignada — el importador puede calcular el aforo de cada corrida.'}
      </p>
    </div>
  )
}

function UploadPanel({
  def,
  pool,
  onFile,
  run,
  onSubmit,
  disabledReason,
}: {
  def: StepDef
  pool: Partial<Record<SlotKey, File>>
  onFile: (key: SlotKey, file: File) => void
  run: RunState | undefined
  onSubmit: () => void
  disabledReason: string | null
}) {
  const slots = def.slots ?? []
  const allFilled = slots.length > 0 && slots.every((s) => pool[s.key])
  const isRunning = run?.status === 'running'
  const canSubmit = allFilled && !isRunning && !disabledReason

  return (
    <div aria-busy={isRunning}>
      <p className="max-w-[70ch] text-body text-ink-2">{def.description}</p>

      <div className={cn('mt-5 grid gap-4', slots.length > 1 && 'sm:grid-cols-2')}>
        {slots.map((slot) => (
          <FileDrop
            key={slot.key}
            slot={slot}
            file={pool[slot.key] ?? null}
            disabled={isRunning}
            onFile={(file) => onFile(slot.key, file)}
          />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {disabledReason ? (
          <span title={disabledReason}>
            <button type="button" disabled className={ACTION_BUTTON_CLASS}>
              Importar
            </button>
          </span>
        ) : (
          <button type="button" onClick={onSubmit} disabled={!canSubmit} className={ACTION_BUTTON_CLASS}>
            {isRunning ? (
              <>
                <RotateCw size={13} strokeWidth={1.75} aria-hidden className="animate-[rotate_700ms_linear_infinite]" />
                Importando…
              </>
            ) : (
              'Importar'
            )}
          </button>
        )}
        {isRunning ? (
          <span role="status" aria-live="polite" className="text-note text-ink-3">
            El API responde hasta terminar de procesar el archivo completo — con archivos grandes puede tardar.
          </span>
        ) : null}
      </div>

      {run?.status === 'done' && run.report ? <ReportPanel title={def.title} report={run.report} /> : null}
      {run?.status === 'failed' ? <RunFailure failure={run.failure} onRetry={onSubmit} /> : null}
    </div>
  )
}

function Screen() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()

  const [pool, setPool] = useState<Partial<Record<SlotKey, File>>>({})
  const [runs, setRuns] = useState<Partial<Record<RunKey, RunState>>>({})
  const [selectedUnitId, setSelectedUnitId] = useState('')

  if (!data.ok) {
    return (
      <>
        <PageHeader title="Importar" subtitle={NO_DATA} />
        <ErrorState {...data.failure} onRetry={() => router.invalidate()} />
      </>
    )
  }

  const status = data.status
  const paso = search.paso ?? 0
  const currentDef = STEPS[paso]

  if (!currentDef) {
    return (
      <>
        <PageHeader title="Importar" subtitle={NO_DATA} />
        <ErrorState title="Paso de importación inválido" suggestion="Vuelve a /importar." />
      </>
    )
  }

  const doneFlags = STEPS.map((s) => s.status(status).done)
  const tripsIndex = STEPS.findIndex((s) => s.importStep === 'trips')
  // Mirrors `TripsGate`'s own `blocked`: no routes at all is blocked too, not
  // just "some routes lack a unit" — see the comment there.
  const isTripsBlocked = status.routes === 0 || status.routesWithoutUnit > 0
  const blockedIndex = isTripsBlocked ? tripsIndex : null
  const doneCount = doneFlags.filter(Boolean).length
  const currentRun = runs[paso]

  function goToStep(index: number) {
    navigate({ search: () => pruneSearch(index), replace: true })
  }

  async function runClean() {
    setRuns({ 0: { status: 'running' } })
    const result = await cleanDatabase()
    // A successful clean invalidates every other step's report, not just this
    // one's — the DB it described no longer exists. Replacing the whole map
    // (not merging into it) is what actually clears steps 2–6's stale receipts.
    setRuns(
      result.ok
        ? { 0: { status: 'done', message: result.message } }
        : (r) => ({ ...r, 0: { status: 'failed', failure: result.failure } }),
    )
    if (result.ok) await router.invalidate()
  }

  async function runUpload(def: StepDef, index: number) {
    if (!def.importStep || !def.slots) return
    const form = new FormData()
    form.set('step', def.importStep)
    for (const slot of def.slots) {
      const file = pool[slot.key]
      if (!file) return
      form.append(slot.key, file)
    }

    setRuns((r) => ({ ...r, [index]: { status: 'running' } }))
    const result = await runImport({ data: form })
    setRuns((r) => ({
      ...r,
      [index]: result.ok ? { status: 'done', report: result.report } : { status: 'failed', failure: result.failure },
    }))
    if (result.ok) await router.invalidate()
  }

  async function runRestore(def: StepDef, index: number) {
    if (!def.restoreTarget) return
    const restore = def.restoreTarget === 'catalog' ? restoreCatalog : restoreUnits

    setRuns((r) => ({ ...r, [index]: { status: 'running' } }))
    const result = await restore()
    setRuns((r) => ({
      ...r,
      [index]: result.ok ? { status: 'done', report: result.report } : { status: 'failed', failure: result.failure },
    }))
    if (result.ok) await router.invalidate()
  }

  async function runAssign() {
    if (!selectedUnitId) return
    setRuns((r) => ({ ...r, assign: { status: 'running' } }))
    const result = await assignUnitToRoutes({ data: { unitId: selectedUnitId } })
    setRuns((r) => ({
      ...r,
      assign: result.ok ? { status: 'done', report: result.report } : { status: 'failed', failure: result.failure },
    }))
    if (result.ok) await router.invalidate()
  }

  return (
    <>
      <PageHeader
        title="Importar"
        subtitle={
          <>
            {doneCount} de {STEPS.length} pasos con datos en la base
            {blockedIndex !== null ? <span className="text-amber"> · Corridas bloqueado</span> : null}
          </>
        }
        actions={<RefreshButton />}
      />

      <div className="px-4 sm:px-8 py-6">
        <Sheet className="overflow-hidden">
          <Stepper
            titles={STEPS.map((s) => s.title)}
            current={paso}
            doneFlags={doneFlags}
            blockedIndex={blockedIndex}
            onSelect={goToStep}
          />

          <div className="p-5">
            {currentDef.kind === 'clean' ? (
              <CleanPanel def={currentDef} run={currentRun} onClean={runClean} />
            ) : currentDef.kind === 'restore' ? (
              <RestorePanel
                def={currentDef}
                status={status}
                run={currentRun}
                onRestore={() => runRestore(currentDef, paso)}
                assign={
                  currentDef.restoreTarget === 'units'
                    ? { unitId: selectedUnitId, onUnitChange: setSelectedUnitId, run: runs.assign, onAssign: runAssign }
                    : undefined
                }
              />
            ) : (
              <>
                {paso === tripsIndex ? <TripsGate status={status} /> : null}
                <UploadPanel
                  def={currentDef}
                  pool={pool}
                  onFile={(key, file) => setPool((p) => ({ ...p, [key]: file }))}
                  run={currentRun}
                  onSubmit={() => runUpload(currentDef, paso)}
                  disabledReason={
                    paso === tripsIndex && isTripsBlocked
                      ? status.routes === 0
                        ? 'Bloqueado: todavía no hay rutas importadas'
                        : `Bloqueado: ${integer(status.routesWithoutUnit)} de ${integer(status.routes)} rutas sin unidad — revisa el paso de Unidades`
                      : null
                  }
                />
              </>
            )}
          </div>
        </Sheet>

        {Object.keys(pool).length > 0 ? (
          <p className="mt-3 text-note text-ink-4">
            Los archivos viven sólo en esta pestaña; si recargas hay que volver a soltarlos. Los conteos de arriba vienen
            de la base.
          </p>
        ) : null}
      </div>
    </>
  )
}
