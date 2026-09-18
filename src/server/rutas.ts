import { createServerFn } from '@tanstack/react-start'
import type { Prisma } from '../../generated/prisma/client.ts'
import { db, describirFalla } from './db'

/**
 * Rutas y tramos — la vista principal del visor.
 *
 * Dos listados sobre la misma dirección: la pestaña viva es el parámetro `vista`.
 * El listado plano de tramos es lo que el sistema anterior no tenía y lo que un
 * cotejo de migración necesita: ver los 4 000 tramos sin abrir ruta por ruta.
 */

export type Vista = 'rutas' | 'tramos'

export type BusquedaRutas = {
  vista: Vista
  q: string
  pagina: number
  porPagina: number
  orden: string
  dir: 'asc' | 'desc'
  empresa: Array<string>
  servicio: Array<string>
  recaudacion: Array<string>
  iva: Array<string>
  asientos: Array<string>
  estatus: Array<string>
  ruta: Array<string>
  principal: Array<string>
  venta: Array<string>
  bajas: boolean
}

type Falla = ReturnType<typeof describirFalla>

export type OpcionFiltro = { valor: string; etiqueta: string; nota?: string }

export type OpcionesRutas = {
  empresas: Array<OpcionFiltro>
  servicios: Array<OpcionFiltro>
  rutas: Array<OpcionFiltro>
}

export type Terminal = { id: string; clave: string; nombre: string }

export type FilaRuta = {
  id: string
  numero: string
  nombre: string
  servicio: { id: string; etiqueta: string }
  empresa: { id: string; etiqueta: string }
  origen: Terminal
  destino: Terminal
  tramos: number
  tarifaSencilla: string
  tiempoMinutos: number
  distanciaKm: number | null
  activa: boolean
  eliminada: boolean
}

export type FilaTramo = {
  id: string
  numero: string
  ruta: { id: string; numero: string; nombre: string }
  origen: Terminal
  destino: Terminal
  estanciaMinutos: number
  duracionMinutos: number
  distanciaKm: number | null
  permiteVenta: boolean
  tarifaSencilla: string
  tarifaRedonda: string | null
  principal: boolean
  activa: boolean
  eliminada: boolean
}

export type Conteos = { rutas: number; tramos: number }

export type ListadoRutas =
  | {
      ok: true
      vista: 'rutas'
      filas: Array<FilaRuta>
      total: number
      conteos: Conteos
      opciones: OpcionesRutas
    }
  | {
      ok: true
      vista: 'tramos'
      filas: Array<FilaTramo>
      total: number
      conteos: Conteos
      opciones: OpcionesRutas
    }
  | { ok: false; falla: Falla }

/* ── Utilidades ─────────────────────────────────────────────────────────── */

/** Los números de ruta y de tramo son texto en la base: se ordenan como números. */
function porNumero(a: string, b: string) {
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
}

/** Un filtro Sí/No sólo acota cuando se eligió exactamente una de las dos. */
function siNo(seleccion: Array<string>): boolean | undefined {
  if (seleccion.length !== 1) return undefined
  return seleccion[0] === 'si'
}

function terminal(e: {
  id: string
  number: string
  shortName: string
  name: string
}): Terminal {
  return { id: e.id, clave: e.shortName || e.number, nombre: e.name }
}

const SELECCION_TERMINAL = {
  id: true,
  number: true,
  shortName: true,
  name: true,
} as const

type OrdenRutas = (dir: Prisma.SortOrder) => Array<Prisma.RouteOrderByWithRelationInput>
type OrdenTramos = (dir: Prisma.SortOrder) => Array<Prisma.SegmentOrderByWithRelationInput>

const RUTAS_POR_NUMERO: OrdenRutas = (dir) => [{ number: dir }]
const TRAMOS_POR_RUTA: OrdenTramos = (dir) => [
  { route: { number: dir } },
  { number: 'asc' },
]

const ORDEN_RUTAS: Record<string, OrdenRutas> = {
  numero: RUTAS_POR_NUMERO,
  nombre: (dir) => [{ name: dir }],
  servicio: (dir) => [{ service: { shortName: dir } }, { number: 'asc' }],
  empresa: (dir) => [{ service: { company: { shortName: dir } } }, { number: 'asc' }],
  tramos: (dir) => [{ segments: { _count: dir } }, { number: 'asc' }],
  tarifa: (dir) => [{ priceOneWay: dir }],
  tiempo: (dir) => [{ travelTimeMinutes: dir }],
  distancia: (dir) => [{ distanceKm: dir }],
  estatus: (dir) => [{ isActive: dir }, { number: 'asc' }],
}

const ORDEN_TRAMOS: Record<string, OrdenTramos> = {
  numero: (dir) => [{ number: dir }],
  ruta: TRAMOS_POR_RUTA,
  origen: (dir) => [{ originStation: { shortName: dir } }],
  destino: (dir) => [{ destinationStation: { shortName: dir } }],
  estancia: (dir) => [{ stayTimeMinutes: dir }],
  duracion: (dir) => [{ durationMinutes: dir }],
  distancia: (dir) => [{ distanceKm: dir }],
  venta: (dir) => [{ allowSale: dir }, { route: { number: 'asc' } }],
  tarifa: (dir) => [{ priceOneWay: dir }],
  tarifaRedonda: (dir) => [{ priceRound: dir }],
  principal: (dir) => [{ isMain: dir }, { route: { number: 'asc' } }],
  estatus: (dir) => [{ isActive: dir }, { route: { number: 'asc' } }],
}

/* ── Listado ────────────────────────────────────────────────────────────── */

async function leerOpciones(conRutas: boolean): Promise<OpcionesRutas> {
  const [empresas, servicios, rutas] = await Promise.all([
    db.company.findMany({
      where: { deletedAt: null },
      select: { id: true, key: true, shortName: true, tradeName: true },
      orderBy: { shortName: 'asc' },
    }),
    db.service.findMany({
      where: { deletedAt: null },
      select: { id: true, key: true, shortName: true },
      orderBy: { shortName: 'asc' },
    }),
    conRutas
      ? db.route.findMany({
          where: { deletedAt: null },
          select: { id: true, number: true, name: true },
        })
      : Promise.resolve([]),
  ])

  return {
    empresas: empresas.map((e) => ({
      valor: e.id,
      etiqueta: e.shortName || e.tradeName,
      nota: e.key,
    })),
    servicios: servicios.map((s) => ({
      valor: s.id,
      etiqueta: s.shortName,
      nota: s.key,
    })),
    rutas: rutas
      .slice()
      .sort((a, b) => porNumero(a.number, b.number))
      .map((r) => ({ valor: r.id, etiqueta: r.name, nota: r.number })),
  }
}

export const listarRutas = createServerFn({ method: 'GET' })
  .inputValidator((entrada: BusquedaRutas) => entrada)
  .handler(async ({ data }): Promise<ListadoRutas> => {
    const {
      vista,
      q,
      pagina,
      porPagina,
      orden,
      dir,
      empresa,
      servicio,
      recaudacion,
      iva,
      asientos,
      estatus,
      ruta,
      principal,
      venta,
      bajas,
    } = data

    const consulta = q.trim()
    const activa = estatus.length === 1 ? estatus[0] === 'activa' : undefined
    const skip = Math.max(0, (pagina - 1) * porPagina)

    try {
      const [conteos, opciones] = await Promise.all([
        Promise.all([
          db.route.count({ where: { deletedAt: null } }),
          db.segment.count({ where: { deletedAt: null } }),
        ]).then(([rutasN, tramosN]) => ({ rutas: rutasN, tramos: tramosN })),
        leerOpciones(vista === 'tramos'),
      ])

      if (vista === 'tramos') {
        const where: Prisma.SegmentWhereInput = {
          ...(bajas ? {} : { deletedAt: null, route: { deletedAt: null } }),
          ...(consulta
            ? {
                OR: [
                  { number: { contains: consulta, mode: 'insensitive' } },
                  {
                    originStation: {
                      OR: [
                        { name: { contains: consulta, mode: 'insensitive' } },
                        { shortName: { contains: consulta, mode: 'insensitive' } },
                        { number: { contains: consulta, mode: 'insensitive' } },
                      ],
                    },
                  },
                  {
                    destinationStation: {
                      OR: [
                        { name: { contains: consulta, mode: 'insensitive' } },
                        { shortName: { contains: consulta, mode: 'insensitive' } },
                        { number: { contains: consulta, mode: 'insensitive' } },
                      ],
                    },
                  },
                ],
              }
            : {}),
          ...(ruta.length ? { routeId: { in: ruta } } : {}),
          ...(servicio.length || empresa.length
            ? {
                route: {
                  ...(bajas ? {} : { deletedAt: null }),
                  ...(servicio.length ? { serviceId: { in: servicio } } : {}),
                  ...(empresa.length
                    ? { service: { companyId: { in: empresa } } }
                    : {}),
                },
              }
            : {}),
          ...(siNo(principal) !== undefined ? { isMain: siNo(principal) } : {}),
          ...(siNo(venta) !== undefined ? { allowSale: siNo(venta) } : {}),
          ...(activa !== undefined ? { isActive: activa } : {}),
        }

        const orderBy = (ORDEN_TRAMOS[orden] ?? TRAMOS_POR_RUTA)(dir)

        const [registros, total] = await Promise.all([
          db.segment.findMany({
            where,
            orderBy,
            skip,
            take: porPagina,
            select: {
              id: true,
              number: true,
              stayTimeMinutes: true,
              durationMinutes: true,
              distanceKm: true,
              allowSale: true,
              isMain: true,
              isActive: true,
              deletedAt: true,
              priceOneWay: true,
              priceRound: true,
              route: { select: { id: true, number: true, name: true } },
              originStation: { select: SELECCION_TERMINAL },
              destinationStation: { select: SELECCION_TERMINAL },
            },
          }),
          db.segment.count({ where }),
        ])

        const filas: Array<FilaTramo> = registros.map((t) => ({
          id: t.id,
          numero: t.number,
          ruta: { id: t.route.id, numero: t.route.number, nombre: t.route.name },
          origen: terminal(t.originStation),
          destino: terminal(t.destinationStation),
          estanciaMinutos: t.stayTimeMinutes,
          duracionMinutos: t.durationMinutes,
          distanciaKm: t.distanceKm,
          permiteVenta: t.allowSale,
          tarifaSencilla: t.priceOneWay.toString(),
          tarifaRedonda: t.priceRound === null ? null : t.priceRound.toString(),
          principal: t.isMain,
          activa: t.isActive,
          eliminada: t.deletedAt !== null,
        }))

        return { ok: true, vista: 'tramos', filas, total, conteos, opciones }
      }

      const where: Prisma.RouteWhereInput = {
        ...(bajas ? {} : { deletedAt: null }),
        ...(consulta
          ? {
              OR: [
                { number: { contains: consulta, mode: 'insensitive' } },
                { name: { contains: consulta, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(servicio.length ? { serviceId: { in: servicio } } : {}),
        ...(empresa.length ? { service: { companyId: { in: empresa } } } : {}),
        ...(recaudacion.length
          ? { collectionType: { in: recaudacion as Array<'AUTOMATIC' | 'NORMAL'> } }
          : {}),
        ...(siNo(iva) !== undefined ? { appliedIVA: siNo(iva) } : {}),
        ...(siNo(asientos) !== undefined ? { hasSeatsSelection: siNo(asientos) } : {}),
        ...(activa !== undefined ? { isActive: activa } : {}),
      }

      const orderBy = (ORDEN_RUTAS[orden] ?? RUTAS_POR_NUMERO)(dir)

      const [registros, total] = await Promise.all([
        db.route.findMany({
          where,
          orderBy,
          skip,
          take: porPagina,
          select: {
            id: true,
            number: true,
            name: true,
            priceOneWay: true,
            travelTimeMinutes: true,
            distanceKm: true,
            isActive: true,
            deletedAt: true,
            service: {
              select: {
                id: true,
                key: true,
                shortName: true,
                company: { select: { id: true, key: true, shortName: true } },
              },
            },
            origin: { select: SELECCION_TERMINAL },
            destination: { select: SELECCION_TERMINAL },
            _count: { select: { segments: { where: { deletedAt: null } } } },
          },
        }),
        db.route.count({ where }),
      ])

      const filas: Array<FilaRuta> = registros.map((r) => ({
        id: r.id,
        numero: r.number,
        nombre: r.name,
        servicio: { id: r.service.id, etiqueta: r.service.shortName },
        empresa: { id: r.service.company.id, etiqueta: r.service.company.shortName },
        origen: terminal(r.origin),
        destino: terminal(r.destination),
        tramos: r._count.segments,
        tarifaSencilla: r.priceOneWay.toString(),
        tiempoMinutos: r.travelTimeMinutes,
        distanciaKm: r.distanceKm,
        activa: r.isActive,
        eliminada: r.deletedAt !== null,
      }))

      return { ok: true, vista: 'rutas', filas, total, conteos, opciones }
    } catch (error) {
      console.error('[rutas]', error)
      return { ok: false, falla: describirFalla(error) }
    }
  })

/* ── Detalle ────────────────────────────────────────────────────────────── */

export type TramoDetalle = {
  id: string
  numero: string
  origen: Terminal
  destino: Terminal
  estanciaMinutos: number
  duracionMinutos: number
  distanciaKm: number | null
  permiteVenta: boolean
  tarifaSencilla: string
  tarifaRedonda: string | null
  principal: boolean
  activa: boolean
}

export type DetalleRuta = {
  id: string
  numero: string
  nombre: string
  servicio: { id: string; clave: string; nombre: string }
  empresa: { id: string; clave: string; nombre: string }
  origen: Terminal
  destino: Terminal
  recaudacion: string
  aplicaIva: boolean
  seleccionAsientos: boolean
  unidad: string | null
  activa: boolean
  eliminada: boolean
  tarifaSencilla: string
  tarifaRedonda: string | null
  tiempoMinutos: number
  distanciaKm: number
  estanciaMinutos: number
  canales: Array<{ id: string; nombre: string; activa: boolean; eliminado: boolean }>
  pasajeros: Array<{
    id: string
    clave: string
    nombre: string
    descuento: number
    limite: number | null
    activo: boolean
  }>
  paradas: Array<{ id: string; nombre: string; orden: number; activa: boolean }>
  tramos: Array<TramoDetalle>
  tramosDeBaja: number
}

export type RespuestaDetalle =
  | { ok: true; ruta: DetalleRuta }
  | { ok: false; falla: Falla }

export const obtenerRuta = createServerFn({ method: 'GET' })
  .inputValidator((entrada: { id: string }) => entrada)
  .handler(async ({ data }): Promise<RespuestaDetalle> => {
    try {
      const r = await db.route.findUnique({
        where: { id: data.id },
        select: {
          id: true,
          number: true,
          name: true,
          collectionType: true,
          priceOneWay: true,
          priceRound: true,
          travelTimeMinutes: true,
          distanceKm: true,
          stayTimeMinutes: true,
          appliedIVA: true,
          hasSeatsSelection: true,
          isActive: true,
          deletedAt: true,
          service: {
            select: {
              id: true,
              key: true,
              shortName: true,
              company: { select: { id: true, key: true, shortName: true } },
            },
          },
          origin: { select: SELECCION_TERMINAL },
          destination: { select: SELECCION_TERMINAL },
          unit: { select: { id: true, name: true } },
          salesChannels: {
            select: {
              salesChannel: {
                select: { id: true, name: true, isActive: true, deletedAt: true },
              },
            },
          },
          passengerTypes: {
            select: {
              seatingLimit: true,
              passengerType: {
                select: {
                  id: true,
                  key: true,
                  name: true,
                  discountPercent: true,
                  isActive: true,
                },
              },
            },
          },
          stops: {
            select: { id: true, name: true, order: true, isActive: true },
            orderBy: { order: 'asc' },
          },
          segments: {
            where: { deletedAt: null },
            select: {
              id: true,
              number: true,
              stayTimeMinutes: true,
              durationMinutes: true,
              distanceKm: true,
              allowSale: true,
              isMain: true,
              isActive: true,
              priceOneWay: true,
              priceRound: true,
              originStation: { select: SELECCION_TERMINAL },
              destinationStation: { select: SELECCION_TERMINAL },
            },
          },
          _count: { select: { segments: { where: { NOT: { deletedAt: null } } } } },
        },
      })

      if (!r) {
        return {
          ok: false,
          falla: {
            titulo: 'La ruta no existe',
            detalle: `No hay ninguna ruta con el identificador ${data.id}.`,
            sugerencia:
              'Es posible que el registro se haya eliminado de la base o que el enlace esté mal copiado.',
          },
        }
      }

      const ruta: DetalleRuta = {
        id: r.id,
        numero: r.number,
        nombre: r.name,
        servicio: {
          id: r.service.id,
          clave: r.service.key,
          nombre: r.service.shortName,
        },
        empresa: {
          id: r.service.company.id,
          clave: r.service.company.key,
          nombre: r.service.company.shortName,
        },
        origen: terminal(r.origin),
        destino: terminal(r.destination),
        recaudacion: r.collectionType,
        aplicaIva: r.appliedIVA,
        seleccionAsientos: r.hasSeatsSelection,
        unidad: r.unit?.name ?? null,
        activa: r.isActive,
        eliminada: r.deletedAt !== null,
        tarifaSencilla: r.priceOneWay.toString(),
        tarifaRedonda: r.priceRound === null ? null : r.priceRound.toString(),
        tiempoMinutos: r.travelTimeMinutes,
        distanciaKm: r.distanceKm,
        estanciaMinutos: r.stayTimeMinutes,
        canales: r.salesChannels
          .map((c) => ({
            id: c.salesChannel.id,
            nombre: c.salesChannel.name,
            activa: c.salesChannel.isActive,
            eliminado: c.salesChannel.deletedAt !== null,
          }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
        pasajeros: r.passengerTypes
          .map((p) => ({
            id: p.passengerType.id,
            clave: p.passengerType.key,
            nombre: p.passengerType.name,
            descuento: p.passengerType.discountPercent,
            limite: p.seatingLimit,
            activo: p.passengerType.isActive,
          }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
        paradas: r.stops.map((p) => ({
          id: p.id,
          nombre: p.name,
          orden: p.order,
          activa: p.isActive,
        })),
        tramos: r.segments
          .map((t) => ({
            id: t.id,
            numero: t.number,
            origen: terminal(t.originStation),
            destino: terminal(t.destinationStation),
            estanciaMinutos: t.stayTimeMinutes,
            duracionMinutos: t.durationMinutes,
            distanciaKm: t.distanceKm,
            permiteVenta: t.allowSale,
            tarifaSencilla: t.priceOneWay.toString(),
            tarifaRedonda: t.priceRound === null ? null : t.priceRound.toString(),
            principal: t.isMain,
            activa: t.isActive,
          }))
          .sort((a, b) => porNumero(a.numero, b.numero)),
        tramosDeBaja: r._count.segments,
      }

      return { ok: true, ruta }
    } catch (error) {
      console.error('[ruta]', error)
      return { ok: false, falla: describirFalla(error) }
    }
  })
