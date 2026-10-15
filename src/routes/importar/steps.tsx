import { plural } from '~/lib/format'
import type { ImportStatus, ImportStep } from '~/server/seeds'

/**
 * The wizard's steps, in the order the backend requires. This table is
 * the single source of truth `index.tsx` walks to render the strip and each
 * panel — see `~/server/seeds`'s `IMPORT_STEPS` for the matching field names
 * each upload step forwards.
 */

export type SlotKey =
  | 'stations'
  | 'routes'
  | 'segments'
  | 'services'
  | 'tariffs'
  | 'corridas'
  | 'limits'
  | 'boletos'
  | 'abordados'
  | 'cupones'

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
  {
    kind: 'upload',
    title: 'Tarjetas de viaje',
    description:
      'Sube el mismo CORRIDAS_TARJETAS.csv del paso de Corridas. Crea una tarjeta por corrida, ya recaudada en su FECHA_RECAUDACION: el folio impreso, la venta de sistema, a bordo y manual, el monto recaudado, el sueldo del operador y el despacho (operador y autobús) de la corrida. Una corrida que ya tiene tarjeta se descarta. Bloqueado hasta que existan corridas.',
    importStep: 'travelCards',
    slots: [{ key: 'corridas', label: 'Corridas', legacyFile: 'CORRIDAS_TARJETAS.csv' }],
    status: (s) =>
      s.travelCards > 0
        ? { done: true, note: plural(s.travelCards, 'tarjeta', 'tarjetas') }
        : { done: false, note: 'Sin tarjetas todavía.' },
  },
  {
    kind: 'upload',
    title: 'Boletos',
    description:
      'Sube boletos.csv y BOLETOS_ABORDADOS.csv. Crea las órdenes, los boletos, sus pasajeros, los asientos de cada corrida y un movimiento por boleto. BOLETOS_ABORDADOS.csv decide el estatus: un folio listado ahí queda «Viajó» con su hora de abordaje; uno con corrida ya pasada que no aparece, «No viajó». También marca como abordados los boletos de entregas anteriores, así que las entregas se suben en orden. Bloqueado hasta que existan corridas y tipos de pasajero — el paso de Corridas crea ambos. El importador no lee el correo, el teléfono, el asesor, la caja real, el corte ni el descuento: esos campos quedan vacíos en el visor.',
    importStep: 'boletos',
    slots: [
      { key: 'boletos', label: 'Boletos', legacyFile: 'boletos.csv' },
      { key: 'abordados', label: 'Boletos abordados', legacyFile: 'BOLETOS_ABORDADOS.csv' },
    ],
    status: (s) =>
      s.tickets > 0
        ? { done: true, note: `${plural(s.tickets, 'boleto', 'boletos')} · ${plural(s.orders, 'orden', 'órdenes')}` }
        : { done: false, note: 'Sin boletos todavía.' },
  },
  {
    kind: 'upload',
    title: 'Cupones',
    description:
      'Sube BOLETOS_CUPONES.csv de la misma entrega, después de sus boletos. Liga cada folio a su clave de cupón bajo la campaña «Cupones legado ER». El archivo no trae descuento ni precio original, así que el cupón queda en 0 % y no cambia ningún precio. Una orden conserva un solo cupón: si ya tiene uno, el folio se descarta. Bloqueado hasta que existan boletos.',
    importStep: 'cupones',
    slots: [{ key: 'cupones', label: 'Cupones', legacyFile: 'BOLETOS_CUPONES.csv' }],
    status: (s) =>
      s.orderCoupons > 0
        ? { done: true, note: plural(s.orderCoupons, 'orden con cupón', 'órdenes con cupón') }
        : { done: false, note: 'Sin cupones todavía.' },
  },
]
