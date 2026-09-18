import { createServerFn } from '@tanstack/react-start'
import { paginaValida, rango } from '~/lib/parametros'
import { db, describirFalla } from './db'

/* ───────────────────────────────────────────────────────────────────────────
   Empresas — consultas de sólo lectura.

   Nada de lo que sale de aquí es un objeto de Prisma: cada `select` es
   explícito y toda fecha se serializa con `.toISOString()` antes de cruzar la
   frontera del servidor. Company no tiene columnas Decimal, pero la regla se
   mantiene igual para que el contrato sea uniforme en todo el visor.
   ─────────────────────────────────────────────────────────────────────────── */

export const ORDENES_EMPRESA = [
  'clave',
  'nombreCorto',
  'nombreComercial',
  'servicios',
  'alta',
] as const
export type OrdenEmpresa = (typeof ORDENES_EMPRESA)[number]

export const ESTATUS_EMPRESA = ['activa', 'inactiva'] as const
export type EstatusEmpresa = (typeof ESTATUS_EMPRESA)[number]

/** Origen del registro: lo trajo el sync de HCM o lo capturó alguien por CRUD. */
export const ORIGEN_EMPRESA = ['hcm', 'manual'] as const
export type OrigenEmpresa = (typeof ORIGEN_EMPRESA)[number]

export type FiltroEmpresas = {
  q: string
  pagina: number
  porPagina: number
  orden: OrdenEmpresa
  dir: 'asc' | 'desc'
  estatus: Array<EstatusEmpresa>
  origen: Array<OrigenEmpresa>
  bajas: boolean
}

export type Falla = ReturnType<typeof describirFalla>

export type RenglonEmpresa = {
  id: string
  clave: string
  nombreCorto: string
  nombreComercial: string
  razonSocial: string
  activa: boolean
  eliminada: boolean
  /** HCM reportó la empresa ausente o inactiva. Meramente informativo. */
  hcmDesactivada: boolean
  /** La gestiona el sync de HCM (hcmLastSeenRunId != null), no el CRUD. */
  sincronizadaPorHcm: boolean
  servicios: number
  alta: string
}

export type RespuestaEmpresas =
  | { ok: true; filas: Array<RenglonEmpresa>; total: number; pagina: number }
  | { ok: false; falla: Falla }

function construirWhere(data: FiltroEmpresas) {
  const q = data.q.trim()

  // Con las dos opciones marcadas (o ninguna) el filtro no discrimina nada.
  const soloActivas =
    data.estatus.length === 1 ? data.estatus[0] === 'activa' : undefined
  const soloHcm = data.origen.length === 1 ? data.origen[0] === 'hcm' : undefined

  return {
    ...(data.bajas ? {} : { deletedAt: null }),
    ...(soloActivas === undefined ? {} : { isActive: soloActivas }),
    ...(soloHcm === undefined
      ? {}
      : { hcmLastSeenRunId: soloHcm ? { not: null } : null }),
    ...(q
      ? {
          OR: [
            { key: { contains: q, mode: 'insensitive' as const } },
            { shortName: { contains: q, mode: 'insensitive' as const } },
            { tradeName: { contains: q, mode: 'insensitive' as const } },
            { legalName: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }
}

function construirOrden(orden: OrdenEmpresa, dir: 'asc' | 'desc') {
  switch (orden) {
    case 'nombreCorto':
      return { shortName: dir }
    case 'nombreComercial':
      return { tradeName: dir }
    case 'servicios':
      return { services: { _count: dir } }
    case 'alta':
      return { createdAt: dir }
    default:
      return { key: dir }
  }
}

/** `as const` a propósito: conserva los literales `true` para que Prisma
    infiera la forma exacta del resultado y no un registro genérico. */
function seleccionDeLista(incluirBajas: boolean) {
  return {
    id: true,
    key: true,
    shortName: true,
    tradeName: true,
    legalName: true,
    isActive: true,
    deletedAt: true,
    createdAt: true,
    hcmDisabled: true,
    hcmLastSeenRunId: true,
    _count: {
      select: { services: { where: { deletedAt: incluirBajas ? undefined : null } } },
    },
  } as const
}

type CrudaDeLista = {
  id: string
  key: string
  shortName: string
  tradeName: string
  legalName: string
  isActive: boolean
  deletedAt: Date | null
  createdAt: Date
  hcmDisabled: boolean
  hcmLastSeenRunId: string | null
  _count: { services: number }
}

function aRenglon(c: CrudaDeLista): RenglonEmpresa {
  return {
    id: c.id,
    clave: c.key,
    nombreCorto: c.shortName,
    nombreComercial: c.tradeName,
    razonSocial: c.legalName,
    activa: c.isActive,
    eliminada: c.deletedAt !== null,
    hcmDesactivada: c.hcmDisabled,
    sincronizadaPorHcm: c.hcmLastSeenRunId !== null,
    servicios: c._count.services,
    alta: c.createdAt.toISOString(),
  }
}

export const listarEmpresas = createServerFn({ method: 'GET' })
  .inputValidator((entrada: FiltroEmpresas) => entrada)
  .handler(async ({ data }): Promise<RespuestaEmpresas> => {
    try {
      const where = construirWhere(data)
      const orderBy = construirOrden(data.orden, data.dir)
      const select = seleccionDeLista(data.bajas)

      const [crudas, total] = await Promise.all([
        db.company.findMany({
          where,
          orderBy,
          select,
          ...rango(data.pagina, data.porPagina),
        }),
        db.company.count({ where }),
      ])

      // Los filtros pueden dejar menos hojas de las que pedía la URL: mejor la
      // última hoja con datos que una hoja en blanco.
      const corregida = paginaValida(data.pagina, total, data.porPagina)
      if (crudas.length === 0 && total > 0 && corregida !== data.pagina) {
        const rescate = await db.company.findMany({
          where,
          orderBy,
          select,
          ...rango(corregida, data.porPagina),
        })
        return { ok: true, pagina: corregida, total, filas: rescate.map(aRenglon) }
      }

      return { ok: true, pagina: data.pagina, total, filas: crudas.map(aRenglon) }
    } catch (error) {
      console.error('[empresas] listar', error)
      return { ok: false, falla: describirFalla(error) }
    }
  })

/* ── Detalle ─────────────────────────────────────────────────────────────── */

export type ServicioDeEmpresa = {
  id: string
  clave: string
  numero: string
  nombre: string
  activa: boolean
  eliminada: boolean
}

export type FichaEmpresa = {
  id: string
  clave: string
  nombreCorto: string
  nombreComercial: string
  razonSocial: string
  activa: boolean
  eliminada: boolean
  hcmDesactivada: boolean
  hcmRunId: string | null
  sincronizadaPorHcm: boolean
  creadoEn: string
  actualizadoEn: string
  eliminadoEn: string | null
  creadoPor: string | null
  actualizadoPor: string | null
  servicios: Array<ServicioDeEmpresa>
  alcance: { servicios: number; terminales: number; rutas: number }
}

export type RespuestaEmpresa =
  | { ok: true; empresa: FichaEmpresa | null }
  | { ok: false; falla: Falla }

export const obtenerEmpresa = createServerFn({ method: 'GET' })
  .inputValidator((entrada: { id: string }) => entrada)
  .handler(async ({ data }): Promise<RespuestaEmpresa> => {
    try {
      const cruda = await db.company.findUnique({
        where: { id: data.id },
        select: {
          id: true,
          key: true,
          shortName: true,
          tradeName: true,
          legalName: true,
          isActive: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
          hcmDisabled: true,
          hcmLastSeenRunId: true,
          createdBy: { select: { name: true } },
          updatedBy: { select: { name: true } },
          services: {
            orderBy: { key: 'asc' },
            select: {
              id: true,
              key: true,
              number: true,
              fullName: true,
              isActive: true,
              deletedAt: true,
            },
          },
        },
      })

      if (!cruda) return { ok: true, empresa: null }

      // Alcance por agregación: se cuenta en la base, no se traen filas.
      const [servicios, terminales, rutas] = await Promise.all([
        db.service.count({ where: { companyId: cruda.id, deletedAt: null } }),
        db.station.count({
          where: {
            deletedAt: null,
            services: { some: { companyId: cruda.id, deletedAt: null } },
          },
        }),
        db.route.count({
          where: {
            deletedAt: null,
            service: { companyId: cruda.id, deletedAt: null },
          },
        }),
      ])

      return {
        ok: true,
        empresa: {
          id: cruda.id,
          clave: cruda.key,
          nombreCorto: cruda.shortName,
          nombreComercial: cruda.tradeName,
          razonSocial: cruda.legalName,
          activa: cruda.isActive,
          eliminada: cruda.deletedAt !== null,
          hcmDesactivada: cruda.hcmDisabled,
          hcmRunId: cruda.hcmLastSeenRunId,
          sincronizadaPorHcm: cruda.hcmLastSeenRunId !== null,
          creadoEn: cruda.createdAt.toISOString(),
          actualizadoEn: cruda.updatedAt.toISOString(),
          eliminadoEn: cruda.deletedAt ? cruda.deletedAt.toISOString() : null,
          creadoPor: cruda.createdBy?.name ?? null,
          actualizadoPor: cruda.updatedBy?.name ?? null,
          servicios: cruda.services.map((s) => ({
            id: s.id,
            clave: s.key,
            numero: s.number,
            nombre: s.fullName,
            activa: s.isActive,
            eliminada: s.deletedAt !== null,
          })),
          alcance: { servicios, terminales, rutas },
        },
      }
    } catch (error) {
      console.error('[empresas] detalle', error)
      return { ok: false, falla: describirFalla(error) }
    }
  })
