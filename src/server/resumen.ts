import { createServerFn } from '@tanstack/react-start'
import { db, describirFalla } from './db'

/**
 * Portada del visor: el estado de la migración de un vistazo.
 *
 * Todo se calcula con conteos agregados —nunca trayendo filas a memoria— y se
 * devuelve como cifras planas. Los rótulos en español viven en la pantalla, no
 * aquí: este archivo sólo cuenta.
 */

/* ── Catálogos ───────────────────────────────────────────────────────────── */

export const CLAVES_CATALOGO = [
  'empresas',
  'servicios',
  'terminales',
  'rutas',
  'tramos',
] as const
export type ClaveCatalogo = (typeof CLAVES_CATALOGO)[number]

export type ConteoCatalogo = {
  /** Registros sin borrado lógico. */
  vigentes: number
  /** Vigentes con isActive = false. */
  inactivos: number
  /** Registros con deletedAt. */
  bajas: number
}

/* ── Revisiones de integridad ────────────────────────────────────────────── */

export const CLAVES_REVISION = [
  'rutasSinTramoPrincipal',
  'rutasSinTramos',
  'tramosEnCirculo',
  'serviciosSinRutas',
  'serviciosSinTerminales',
  'terminalesSinServicios',
  'empresasSinServicios',
  'rutasSinCanales',
  'rutasSinTiposDePasajero',
] as const
export type ClaveRevision = (typeof CLAVES_REVISION)[number]

/* ── Sincronización HCM ──────────────────────────────────────────────────── */

export type ConteoHcm = {
  /** hcmLastSeenRunId != null — los trae el sincronizador. */
  gestionados: number
  /** hcmLastSeenRunId == null — capturados a mano. */
  manuales: number
  /** hcmDisabled = true — GER dejó de reportarlos. */
  desactivados: number
}

export type Resumen = {
  generadoEn: string
  catalogos: Record<ClaveCatalogo, ConteoCatalogo>
  revisiones: Record<ClaveRevision, number>
  hcm: { empresas: ConteoHcm; servicios: ConteoHcm }
}

export type RespuestaResumen =
  | ({ ok: true } & Resumen)
  | { ok: false; falla: ReturnType<typeof describirFalla> }

const VIGENTE = { deletedAt: null } as const
const DADO_DE_BAJA = { deletedAt: { not: null } } as const

async function contarCatalogos(): Promise<Record<ClaveCatalogo, ConteoCatalogo>> {
  const [
    empresasVigentes,
    empresasInactivas,
    empresasBajas,
    serviciosVigentes,
    serviciosInactivos,
    serviciosBajas,
    terminalesVigentes,
    terminalesInactivas,
    terminalesBajas,
    rutasVigentes,
    rutasInactivas,
    rutasBajas,
    tramosVigentes,
    tramosInactivos,
    tramosBajas,
  ] = await Promise.all([
    db.company.count({ where: VIGENTE }),
    db.company.count({ where: { ...VIGENTE, isActive: false } }),
    db.company.count({ where: DADO_DE_BAJA }),

    db.service.count({ where: VIGENTE }),
    db.service.count({ where: { ...VIGENTE, isActive: false } }),
    db.service.count({ where: DADO_DE_BAJA }),

    db.station.count({ where: VIGENTE }),
    db.station.count({ where: { ...VIGENTE, isActive: false } }),
    db.station.count({ where: DADO_DE_BAJA }),

    db.route.count({ where: VIGENTE }),
    db.route.count({ where: { ...VIGENTE, isActive: false } }),
    db.route.count({ where: DADO_DE_BAJA }),

    db.segment.count({ where: VIGENTE }),
    db.segment.count({ where: { ...VIGENTE, isActive: false } }),
    db.segment.count({ where: DADO_DE_BAJA }),
  ])

  return {
    empresas: { vigentes: empresasVigentes, inactivos: empresasInactivas, bajas: empresasBajas },
    servicios: { vigentes: serviciosVigentes, inactivos: serviciosInactivos, bajas: serviciosBajas },
    terminales: {
      vigentes: terminalesVigentes,
      inactivos: terminalesInactivas,
      bajas: terminalesBajas,
    },
    rutas: { vigentes: rutasVigentes, inactivos: rutasInactivas, bajas: rutasBajas },
    tramos: { vigentes: tramosVigentes, inactivos: tramosInactivos, bajas: tramosBajas },
  }
}

async function contarRevisiones(): Promise<Record<ClaveRevision, number>> {
  const [
    rutasSinTramoPrincipal,
    rutasSinTramos,
    tramosEnCirculo,
    serviciosSinRutas,
    serviciosSinTerminales,
    terminalesSinServicios,
    empresasSinServicios,
    rutasSinCanales,
    rutasSinTiposDePasajero,
  ] = await Promise.all([
    // Una ruta activa sin ningún tramo vigente marcado como principal.
    db.route.count({
      where: {
        ...VIGENTE,
        isActive: true,
        segments: { none: { isMain: true, deletedAt: null } },
      },
    }),
    db.route.count({
      where: { ...VIGENTE, segments: { none: { deletedAt: null } } },
    }),
    // Comparación columna contra columna: origen y destino apuntan a la misma terminal.
    db.segment.count({
      where: {
        ...VIGENTE,
        originStationId: { equals: db.segment.fields.destinationStationId },
      },
    }),
    db.service.count({
      where: { ...VIGENTE, routes: { none: { deletedAt: null } } },
    }),
    db.service.count({
      where: { ...VIGENTE, stations: { none: { deletedAt: null } } },
    }),
    db.station.count({
      where: { ...VIGENTE, services: { none: { deletedAt: null } } },
    }),
    db.company.count({
      where: { ...VIGENTE, services: { none: { deletedAt: null } } },
    }),
    // RouteSalesChannel y RoutePassengerType no tienen borrado lógico: o existe el
    // renglón de la relación o no existe.
    db.route.count({ where: { ...VIGENTE, salesChannels: { none: {} } } }),
    db.route.count({ where: { ...VIGENTE, passengerTypes: { none: {} } } }),
  ])

  return {
    rutasSinTramoPrincipal,
    rutasSinTramos,
    tramosEnCirculo,
    serviciosSinRutas,
    serviciosSinTerminales,
    terminalesSinServicios,
    empresasSinServicios,
    rutasSinCanales,
    rutasSinTiposDePasajero,
  }
}

async function contarHcm(): Promise<{ empresas: ConteoHcm; servicios: ConteoHcm }> {
  const [
    empresasGestionadas,
    empresasManuales,
    empresasDesactivadas,
    serviciosGestionados,
    serviciosManuales,
    serviciosDesactivados,
  ] = await Promise.all([
    db.company.count({ where: { ...VIGENTE, hcmLastSeenRunId: { not: null } } }),
    db.company.count({ where: { ...VIGENTE, hcmLastSeenRunId: null } }),
    db.company.count({ where: { ...VIGENTE, hcmDisabled: true } }),

    db.service.count({ where: { ...VIGENTE, hcmLastSeenRunId: { not: null } } }),
    db.service.count({ where: { ...VIGENTE, hcmLastSeenRunId: null } }),
    db.service.count({ where: { ...VIGENTE, hcmDisabled: true } }),
  ])

  return {
    empresas: {
      gestionados: empresasGestionadas,
      manuales: empresasManuales,
      desactivados: empresasDesactivadas,
    },
    servicios: {
      gestionados: serviciosGestionados,
      manuales: serviciosManuales,
      desactivados: serviciosDesactivados,
    },
  }
}

/**
 * Si la base no responde, la portada entera cae a <EstadoError>: pintar
 * tarjetas en cero mentiría diciendo que la migración está vacía.
 */
export const obtenerResumen = createServerFn({ method: 'GET' }).handler(
  async (): Promise<RespuestaResumen> => {
    try {
      const [catalogos, revisiones, hcm] = await Promise.all([
        contarCatalogos(),
        contarRevisiones(),
        contarHcm(),
      ])
      return { ok: true, generadoEn: new Date().toISOString(), catalogos, revisiones, hcm }
    } catch (error) {
      console.error('[resumen]', error)
      return { ok: false, falla: describirFalla(error) }
    }
  },
)
