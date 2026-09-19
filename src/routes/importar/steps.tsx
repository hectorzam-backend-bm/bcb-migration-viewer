import { plural } from '~/lib/format'
import type { ImportStatus, ImportStep } from '~/server/seeds'

/**
 * The 7 steps of the wizard, in the order the backend requires. This table is
 * the single source of truth `index.tsx` walks to render the strip and each
 * panel — see `~/server/seeds`'s `IMPORT_STEPS` for the matching field names
 * each upload step forwards.
 */

export type SlotKey = 'stations' | 'routes' | 'segments' | 'services' | 'tariffs' | 'corridas' | 'limits'

export type Slot = { key: SlotKey; label: string; legacyFile: string }

export type StepStatus = { done: boolean; note: string }

/** Which bundled JSON restore a `kind: 'restore'` step runs — see
 *  `~/server/restore`'s `restoreCatalog`/`restoreUnits`. */
export type RestoreTarget = 'catalog' | 'units'

export type StepDef = {
  kind: 'clean' | 'restore' | 'upload'
  title: string
  description: string
  /** Only for kind: 'upload' — the key `runImport` expects in its `step` field. */
  importStep?: ImportStep
  /** Only for kind: 'upload' — one dropzone per entry. */
  slots?: ReadonlyArray<Slot>
  /** Only for kind: 'restore'. */
  restoreTarget?: RestoreTarget
  status: (s: ImportStatus) => StepStatus
}

export const STEPS: ReadonlyArray<StepDef> = [
  {
    kind: 'clean',
    title: 'Limpiar base',
    description:
      'Borra empresas, servicios, terminales, rutas, tramos, corridas, unidades, autobuses, operadores, clientes y órdenes. No borra el catálogo de estados.',
    status: () => ({ done: false, note: 'Paso opcional — sólo si vas a reimportar desde cero.' }),
  },
  {
    kind: 'restore',
    title: 'Empresas y servicios',
    description:
      'Llegan por el sync de HCM, fuera de este visor — pero esa vía no crea nada aquí, así que si la base se limpió, este paso las restaura desde el respaldo incluido en el visor.',
    restoreTarget: 'catalog',
    status: (s) =>
      s.companies > 0 && s.services > 0
        ? { done: true, note: `${plural(s.companies, 'empresa', 'empresas')} · ${plural(s.services, 'servicio', 'servicios')}` }
        : { done: false, note: 'Faltan empresas o servicios por sincronizar.' },
  },
  {
    kind: 'upload',
    title: 'Terminales',
    description:
      'Sube estados.csv, rutas.csv y tramos.csv. Sólo se crean las terminales que rutas o tramos usan como origen o destino.',
    importStep: 'stations',
    slots: [
      { key: 'stations', label: 'Estados', legacyFile: 'estados.csv' },
      { key: 'routes', label: 'Rutas', legacyFile: 'rutas.csv' },
      { key: 'segments', label: 'Tramos', legacyFile: 'tramos.csv' },
    ],
    status: (s) =>
      s.stations > 0
        ? { done: true, note: plural(s.stations, 'terminal', 'terminales') }
        : { done: false, note: 'Sin terminales todavía.' },
  },
  {
    kind: 'upload',
    title: 'Rutas',
    description: 'Sube rutas.csv y servicios.csv. Requiere que ya existan terminales.',
    importStep: 'routes',
    slots: [
      { key: 'routes', label: 'Rutas', legacyFile: 'rutas.csv' },
      { key: 'services', label: 'Servicios', legacyFile: 'servicios.csv' },
    ],
    status: (s) =>
      s.routes > 0 ? { done: true, note: plural(s.routes, 'ruta', 'rutas') } : { done: false, note: 'Sin rutas todavía.' },
  },
  {
    kind: 'upload',
    title: 'Tramos',
    description: 'Sube tramos.csv y rutas.csv. Requiere que ya existan rutas.',
    importStep: 'segments',
    slots: [
      { key: 'segments', label: 'Tramos', legacyFile: 'tramos.csv' },
      { key: 'routes', label: 'Rutas', legacyFile: 'rutas.csv' },
    ],
    status: (s) =>
      s.segments > 0
        ? { done: true, note: plural(s.segments, 'tramo', 'tramos') }
        : { done: false, note: 'Sin tramos todavía.' },
  },
  {
    kind: 'upload',
    title: 'Tarifas',
    description: 'Sube tramosTarifa.csv. Sólo actualiza rutas y tramos existentes — nunca crea filas nuevas.',
    importStep: 'tariffs',
    slots: [{ key: 'tariffs', label: 'Tarifas por tramo', legacyFile: 'tramosTarifa.csv' }],
    status: (s) =>
      s.routesWithTariff > 0
        ? { done: true, note: `${plural(s.routesWithTariff, 'ruta', 'rutas')} con tarifa` }
        : { done: false, note: 'Ninguna ruta tiene tarifa todavía.' },
  },
  {
    kind: 'restore',
    title: 'Unidades',
    description:
      'No hay ninguna vía en el API para recrear unidades — este paso las restaura desde el respaldo incluido, con un nivel (deck) por unidad. Asignar una a las rutas es opcional y queda aparte, abajo.',
    restoreTarget: 'units',
    status: (s) =>
      s.units > 0 && s.unitDecks > 0
        ? { done: true, note: `${plural(s.units, 'unidad', 'unidades')} · ${plural(s.unitDecks, 'nivel', 'niveles')}` }
        : { done: false, note: 'Sin unidades todavía.' },
  },
  {
    kind: 'upload',
    title: 'Corridas',
    description:
      'Sube CORRIDAS_TARJETAS.csv y LIMITE_PASAJERO.csv. Bloqueado hasta que todas las rutas tengan una unidad asignada.',
    importStep: 'trips',
    slots: [
      { key: 'corridas', label: 'Corridas', legacyFile: 'CORRIDAS_TARJETAS.csv' },
      { key: 'limits', label: 'Límites de pasajero', legacyFile: 'LIMITE_PASAJERO.csv' },
    ],
    status: (s) =>
      s.trips > 0 ? { done: true, note: plural(s.trips, 'corrida', 'corridas') } : { done: false, note: 'Sin corridas todavía.' },
  },
]
