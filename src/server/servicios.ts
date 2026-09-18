import { createServerFn } from '@tanstack/react-start'
import type { Prisma } from '@prisma/generated'
import { db, describirFalla } from './db'

/* ── Contrato de la vista ──────────────────────────────────────────────────
   Un servicio pertenece a una empresa y reparte terminales y rutas: el valor
   del visor está en el cruce, así que la lista carga los dos conteos y la
   ficha enlaza a cada entidad relacionada.                                  */

export const ORDENES = ['clave', 'numero', 'nombre', 'empresa', 'rutas'] as const
export type OrdenServicios = (typeof ORDENES)[number]

export const ESTATUS = ['activa', 'inactiva'] as const
export const ANTICIPADO = ['si', 'no'] as const

export type BusquedaServicios = {
  q: string
  pagina: number
  porPagina: number
  orden: OrdenServicios
  dir: 'asc' | 'desc'
  empresa: Array<string>
  estatus: Array<string>
  anticipado: Array<string>
  bajas: boolean
}

type Falla = ReturnType<typeof describirFalla>

export type FilaServicio = {
  id: string
  clave: string
  numero: string
  nombre: string
  nombreCorto: string
  activo: boolean
  eliminado: boolean
  hcmDesactivado: boolean
  despachoAnticipado: boolean
  empresaId: string
  empresaClave: string
  empresaNombre: string
  terminales: number
  rutas: number
}

export type OpcionEmpresa = { valor: string; etiqueta: string; nota?: string }

export type RespuestaServicios =
  | {
      ok: true
      filas: Array<FilaServicio>
      total: number
      totalCatalogo: number
      pagina: number
      empresas: Array<OpcionEmpresa>
    }
  | { ok: false; falla: Falla }

/** Traduce la selección de un FiltroLista de dos valores a un booleano, o a nada. */
function booleanoDeSeleccion(
  seleccion: Array<string>,
  verdadero: string,
  falso: string,
): boolean | undefined {
  const si = seleccion.includes(verdadero)
  const no = seleccion.includes(falso)
  if (si === no) return undefined
  return si
}

function ordenarPor(
  orden: OrdenServicios,
  dir: 'asc' | 'desc',
): Prisma.ServiceOrderByWithRelationInput {
  switch (orden) {
    case 'numero':
      return { number: dir }
    case 'nombre':
      return { fullName: dir }
    case 'empresa':
      return { company: { shortName: dir } }
    case 'rutas':
      return { routes: { _count: dir } }
    default:
      return { key: dir }
  }
}

const CONTEOS_VIGENTES = {
  select: {
    stations: { where: { deletedAt: null } },
    routes: { where: { deletedAt: null } },
  },
} satisfies Prisma.ServiceCountOutputTypeDefaultArgs

export const listarServicios = createServerFn({ method: 'GET' })
  .inputValidator((entrada: BusquedaServicios) => entrada)
  .handler(async ({ data }): Promise<RespuestaServicios> => {
    const q = data.q.trim()

    try {
      const activo = booleanoDeSeleccion(data.estatus, 'activa', 'inactiva')
      const anticipado = booleanoDeSeleccion(data.anticipado, 'si', 'no')

      const where: Prisma.ServiceWhereInput = {
        ...(data.bajas ? {} : { deletedAt: null }),
        ...(data.empresa.length > 0 ? { companyId: { in: data.empresa } } : {}),
        ...(activo === undefined ? {} : { isActive: activo }),
        ...(anticipado === undefined ? {} : { allowEarlyDispatch: anticipado }),
        ...(q
          ? {
              OR: [
                { key: { contains: q, mode: 'insensitive' } },
                { number: { contains: q, mode: 'insensitive' } },
                { fullName: { contains: q, mode: 'insensitive' } },
                { shortName: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      }

      const seleccion = {
        id: true,
        key: true,
        number: true,
        fullName: true,
        shortName: true,
        isActive: true,
        allowEarlyDispatch: true,
        hcmDisabled: true,
        deletedAt: true,
        companyId: true,
        company: { select: { id: true, key: true, shortName: true } },
        _count: CONTEOS_VIGENTES,
      } satisfies Prisma.ServiceSelect

      const orderBy = ordenarPor(data.orden, data.dir)
      const porPagina = data.porPagina

      const [crudas, total, totalCatalogo, empresas] = await Promise.all([
        db.service.findMany({
          where,
          select: seleccion,
          orderBy,
          skip: Math.max(0, (data.pagina - 1) * porPagina),
          take: porPagina,
        }),
        db.service.count({ where }),
        db.service.count({ where: data.bajas ? {} : { deletedAt: null } }),
        db.company.findMany({
          where: { deletedAt: null },
          select: { id: true, key: true, shortName: true },
          orderBy: { shortName: 'asc' },
        }),
      ])

      // Si los filtros dejaron la hoja pedida fuera de rango, se trae la última con datos:
      // mejor el final del manifiesto que una hoja en blanco.
      const ultimas = Math.max(1, Math.ceil(total / porPagina))
      const pagina = Math.min(Math.max(1, data.pagina), ultimas)
      const filas =
        crudas.length === 0 && total > 0
          ? await db.service.findMany({
              where,
              select: seleccion,
              orderBy,
              skip: (pagina - 1) * porPagina,
              take: porPagina,
            })
          : crudas

      return {
        ok: true,
        total,
        totalCatalogo,
        pagina,
        filas: filas.map((s) => ({
          id: s.id,
          clave: s.key,
          numero: s.number,
          nombre: s.fullName,
          nombreCorto: s.shortName,
          activo: s.isActive,
          eliminado: s.deletedAt !== null,
          hcmDesactivado: s.hcmDisabled,
          despachoAnticipado: s.allowEarlyDispatch,
          empresaId: s.companyId,
          empresaClave: s.company.key,
          empresaNombre: s.company.shortName,
          terminales: s._count.stations,
          rutas: s._count.routes,
        })),
        empresas: empresas.map((e) => ({
          valor: e.id,
          etiqueta: e.shortName,
          nota: e.key,
        })),
      }
    } catch (error) {
      console.error('[servicios]', error)
      return { ok: false, falla: describirFalla(error) }
    }
  })

/* ── Ficha ─────────────────────────────────────────────────────────────── */

export type TerminalDeServicio = {
  id: string
  numero: string
  nombreCorto: string
  nombre: string
  tipo: string
  estado: string
  activa: boolean
  eliminada: boolean
}

export type RutaDeServicio = {
  id: string
  numero: string
  nombre: string
  origen: string
  destino: string
  tramos: number
  tarifaSencilla: string
  activa: boolean
  eliminada: boolean
}

export type TipoDePasajero = {
  id: string
  clave: string
  nombre: string
  descripcion: string | null
  descuento: number
  limiteAsientos: number | null
  documentoRequerido: boolean
  tipoDeDocumento: string | null
  activo: boolean
  eliminado: boolean
}

export type Servicio = {
  id: string
  clave: string
  numero: string
  nombre: string
  nombreCorto: string
  cuenta: string | null
  activo: boolean
  eliminado: boolean
  despachoAnticipado: boolean
  hcmDesactivado: boolean
  hcmUltimaCorrida: string | null
  creado: string
  actualizado: string
  dadoDeBaja: string | null
  empresa: {
    id: string
    clave: string
    nombreCorto: string
    nombreComercial: string
    razonSocial: string
    activa: boolean
    eliminada: boolean
  }
  terminales: Array<TerminalDeServicio>
  rutas: Array<RutaDeServicio>
  tiposDePasajero: Array<TipoDePasajero>
}

export type RespuestaServicio =
  | { ok: true; servicio: Servicio }
  | { ok: false; falla: Falla }

export const obtenerServicio = createServerFn({ method: 'GET' })
  .inputValidator((entrada: { id: string }) => entrada)
  .handler(async ({ data }): Promise<RespuestaServicio> => {
    try {
      const s = await db.service.findUnique({
        where: { id: data.id },
        select: {
          id: true,
          key: true,
          number: true,
          fullName: true,
          shortName: true,
          account: true,
          isActive: true,
          allowEarlyDispatch: true,
          hcmDisabled: true,
          hcmLastSeenRunId: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
          company: {
            select: {
              id: true,
              key: true,
              shortName: true,
              tradeName: true,
              legalName: true,
              isActive: true,
              deletedAt: true,
            },
          },
          stations: {
            select: {
              id: true,
              number: true,
              shortName: true,
              name: true,
              type: true,
              isActive: true,
              deletedAt: true,
              state: { select: { name: true } },
            },
            orderBy: { number: 'asc' },
          },
          routes: {
            select: {
              id: true,
              number: true,
              name: true,
              priceOneWay: true,
              isActive: true,
              deletedAt: true,
              origin: { select: { shortName: true } },
              destination: { select: { shortName: true } },
              _count: { select: { segments: { where: { deletedAt: null } } } },
            },
            orderBy: { number: 'asc' },
          },
          passengerTypes: {
            select: {
              id: true,
              key: true,
              name: true,
              description: true,
              discountPercent: true,
              seatingLimit: true,
              requiredDocument: true,
              documentType: true,
              isActive: true,
              deletedAt: true,
            },
            orderBy: { number: 'asc' },
          },
        },
      })

      if (!s) {
        return {
          ok: false,
          falla: {
            titulo: 'No existe ese servicio',
            detalle: `Identificador consultado: ${data.id}`,
            sugerencia:
              'Revisa el identificador en la dirección o vuelve al listado de servicios.',
          },
        }
      }

      return {
        ok: true,
        servicio: {
          id: s.id,
          clave: s.key,
          numero: s.number,
          nombre: s.fullName,
          nombreCorto: s.shortName,
          cuenta: s.account,
          activo: s.isActive,
          eliminado: s.deletedAt !== null,
          despachoAnticipado: s.allowEarlyDispatch,
          hcmDesactivado: s.hcmDisabled,
          hcmUltimaCorrida: s.hcmLastSeenRunId,
          creado: s.createdAt.toISOString(),
          actualizado: s.updatedAt.toISOString(),
          dadoDeBaja: s.deletedAt ? s.deletedAt.toISOString() : null,
          empresa: {
            id: s.company.id,
            clave: s.company.key,
            nombreCorto: s.company.shortName,
            nombreComercial: s.company.tradeName,
            razonSocial: s.company.legalName,
            activa: s.company.isActive,
            eliminada: s.company.deletedAt !== null,
          },
          terminales: s.stations.map((t) => ({
            id: t.id,
            numero: t.number,
            nombreCorto: t.shortName,
            nombre: t.name,
            tipo: t.type,
            estado: t.state.name,
            activa: t.isActive,
            eliminada: t.deletedAt !== null,
          })),
          rutas: s.routes.map((r) => ({
            id: r.id,
            numero: r.number,
            nombre: r.name,
            origen: r.origin.shortName,
            destino: r.destination.shortName,
            tramos: r._count.segments,
            // El Decimal se queda del lado del servidor: al cliente sólo llega texto.
            tarifaSencilla: r.priceOneWay.toString(),
            activa: r.isActive,
            eliminada: r.deletedAt !== null,
          })),
          tiposDePasajero: s.passengerTypes.map((p) => ({
            id: p.id,
            clave: p.key,
            nombre: p.name,
            descripcion: p.description,
            descuento: p.discountPercent,
            limiteAsientos: p.seatingLimit,
            documentoRequerido: p.requiredDocument,
            tipoDeDocumento: p.documentType,
            activo: p.isActive,
            eliminado: p.deletedAt !== null,
          })),
        },
      }
    } catch (error) {
      console.error('[servicio]', error)
      return { ok: false, falla: describirFalla(error) }
    }
  })
