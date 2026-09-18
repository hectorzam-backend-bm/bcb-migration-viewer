import { createServerFn } from '@tanstack/react-start'
import type { Prisma } from '@prisma/generated'
import { db, describirFalla } from './db'
import { paginaValida, rango } from '~/lib/parametros'

/**
 * Terminales — lectura del catálogo Station y de sus cruces (servicios, empresas,
 * rutas de origen y destino, tramos). Nada de esto escribe: el cliente de Prisma
 * rechaza cualquier operación que no sea de lectura.
 */

export const ORDENES_TERMINAL = ['numero', 'nombreCorto', 'nombre', 'estado'] as const
export type OrdenTerminal = (typeof ORDENES_TERMINAL)[number]

export const ESTATUS_TERMINAL = ['activa', 'inactiva'] as const
export const TIPOS_TERMINAL = ['SALE', 'SCALE'] as const

export type BusquedaTerminales = {
  q: string
  pagina: number
  porPagina: number
  orden: OrdenTerminal
  dir: 'asc' | 'desc'
  empresa: Array<string>
  servicio: Array<string>
  tipo: Array<string>
  estado: Array<string>
  estatus: Array<string>
  bajas: boolean
}

type Falla = ReturnType<typeof describirFalla>

export type OpcionCatalogo = { valor: string; etiqueta: string; nota?: string }

export type OpcionesTerminales = {
  empresas: Array<OpcionCatalogo>
  servicios: Array<OpcionCatalogo>
  estados: Array<OpcionCatalogo>
}

export type ServicioBreve = { id: string; numero: string; nombreCorto: string }
export type EmpresaBreve = { id: string; clave: string; nombreCorto: string }

export type FilaTerminal = {
  id: string
  numero: string
  nombreCorto: string
  nombre: string
  tipo: string
  estado: string | null
  servicios: Array<ServicioBreve>
  empresas: Array<EmpresaBreve>
  activa: boolean
  baja: boolean
}

export type RespuestaTerminales =
  | {
      ok: true
      filas: Array<FilaTerminal>
      total: number
      pagina: number
      opciones: OpcionesTerminales
    }
  | { ok: false; falla: Falla }

function esTipoDeTerminal(valor: string): valor is 'SALE' | 'SCALE' {
  return valor === 'SALE' || valor === 'SCALE'
}

function ordenarPor(
  orden: OrdenTerminal,
  dir: 'asc' | 'desc',
): Array<Prisma.StationOrderByWithRelationInput> {
  switch (orden) {
    case 'nombreCorto':
      return [{ shortName: dir }]
    case 'nombre':
      return [{ name: dir }]
    case 'estado':
      return [{ state: { name: dir } }, { number: 'asc' }]
    default:
      return [{ number: dir }]
  }
}

/* ── Lista ────────────────────────────────────────────────────────────────── */

export const listarTerminales = createServerFn({ method: 'GET' })
  .inputValidator((entrada: BusquedaTerminales) => entrada)
  .handler(async ({ data }): Promise<RespuestaTerminales> => {
    try {
      const q = data.q.trim()
      const condiciones: Array<Prisma.StationWhereInput> = []

      if (q) {
        condiciones.push({
          OR: [
            { number: { contains: q, mode: 'insensitive' } },
            { shortName: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { address: { contains: q, mode: 'insensitive' } },
          ],
        })
      }
      if (data.empresa.length > 0) {
        condiciones.push({ services: { some: { companyId: { in: data.empresa } } } })
      }
      if (data.servicio.length > 0) {
        condiciones.push({ services: { some: { id: { in: data.servicio } } } })
      }
      const tipos = data.tipo.filter(esTipoDeTerminal)
      if (tipos.length > 0) {
        condiciones.push({ type: { in: tipos } })
      }
      if (data.estado.length > 0) {
        condiciones.push({ stateId: { in: data.estado } })
      }
      const estatus = data.estatus.filter(
        (e): e is 'activa' | 'inactiva' => e === 'activa' || e === 'inactiva',
      )
      // Seleccionar los dos estatus equivale a no filtrar.
      if (estatus.length === 1) {
        condiciones.push({ isActive: estatus[0] === 'activa' })
      }

      const donde: Prisma.StationWhereInput = {
        ...(data.bajas ? {} : { deletedAt: null }),
        ...(condiciones.length > 0 ? { AND: condiciones } : {}),
      }

      // Los servicios dados de baja sólo aparecen cuando el visor muestra bajas.
      const servicios = {
        where: data.bajas ? {} : { deletedAt: null },
        orderBy: [{ number: 'asc' as const }],
        select: {
          id: true,
          number: true,
          shortName: true,
          company: { select: { id: true, key: true, shortName: true } },
        },
      }

      const seleccion = {
        id: true,
        number: true,
        shortName: true,
        name: true,
        type: true,
        isActive: true,
        deletedAt: true,
        state: { select: { name: true } },
        services: servicios,
      } as const

      const orderBy = ordenarPor(data.orden, data.dir)
      const [crudas, total, empresas, catalogoServicios, estados] = await Promise.all([
        db.station.findMany({
          where: donde,
          select: seleccion,
          orderBy,
          ...rango(data.pagina, data.porPagina),
        }),
        db.station.count({ where: donde }),
        db.company.findMany({
          where: { deletedAt: null },
          select: { id: true, key: true, shortName: true },
          orderBy: [{ shortName: 'asc' }],
        }),
        db.service.findMany({
          where: { deletedAt: null },
          select: { id: true, number: true, shortName: true },
          orderBy: [{ number: 'asc' }],
        }),
        db.state.findMany({ select: { id: true, name: true }, orderBy: [{ name: 'asc' }] }),
      ])

      // Si el filtro dejó menos hojas de las pedidas, se vuelve por la última con datos.
      const pagina = paginaValida(data.pagina, total, data.porPagina)
      const registros =
        pagina === data.pagina
          ? crudas
          : await db.station.findMany({
              where: donde,
              select: seleccion,
              orderBy,
              ...rango(pagina, data.porPagina),
            })

      const filas: Array<FilaTerminal> = registros.map((e) => {
        const vistas = new Set<string>()
        const empresasDeLaTerminal: Array<EmpresaBreve> = []
        for (const s of e.services) {
          if (vistas.has(s.company.key)) continue
          vistas.add(s.company.key)
          empresasDeLaTerminal.push({
            id: s.company.id,
            clave: s.company.key,
            nombreCorto: s.company.shortName,
          })
        }

        return {
          id: e.id,
          numero: e.number,
          nombreCorto: e.shortName,
          nombre: e.name,
          tipo: e.type,
          estado: e.state?.name ?? null,
          servicios: e.services.map((s) => ({
            id: s.id,
            numero: s.number,
            nombreCorto: s.shortName,
          })),
          empresas: empresasDeLaTerminal,
          activa: e.isActive,
          baja: e.deletedAt !== null,
        }
      })

      return {
        ok: true,
        filas,
        total,
        pagina,
        opciones: {
          empresas: empresas.map((c) => ({
            valor: c.id,
            etiqueta: c.shortName,
            nota: c.key,
          })),
          servicios: catalogoServicios.map((s) => ({
            valor: s.id,
            etiqueta: `${s.number} · ${s.shortName}`,
          })),
          estados: estados.map((s) => ({ valor: s.id, etiqueta: s.name })),
        },
      }
    } catch (error) {
      console.error('[terminales:listar]', error)
      return { ok: false, falla: describirFalla(error) }
    }
  })

/* ── Detalle ──────────────────────────────────────────────────────────────── */

export type ArchivoTerminal = {
  id: string
  nombre: string
  url: string
  tipo: string
  bytes: number
}

export type DonacionTerminal = {
  id: string
  inicio: string
  fin: string
  activa: boolean
}

export type ServicioDeTerminal = {
  id: string
  numero: string
  clave: string
  nombreCorto: string
  nombreCompleto: string
  activo: boolean
  baja: boolean
  empresa: { id: string; clave: string; nombreCorto: string }
}

export type EstacionBreve = { id: string; numero: string; nombreCorto: string }

export type RutaDeTerminal = {
  id: string
  numero: string
  nombre: string
  activa: boolean
  baja: boolean
  origen: EstacionBreve
  destino: EstacionBreve
  servicio: ServicioBreve
  tarifaSencilla: string
  minutos: number
  kilometros: number
}

export type TramoDeTerminal = {
  id: string
  numero: string
  principal: boolean
  activo: boolean
  baja: boolean
  ruta: { id: string; numero: string; nombre: string }
  origen: EstacionBreve
  destino: EstacionBreve
  tarifaSencilla: string
}

export type Terminal = {
  id: string
  numero: string
  nombreCorto: string
  nombre: string
  direccion: string | null
  latitud: number
  longitud: number
  urlGoogle: string | null
  telefono: string | null
  tipo: string
  estado: string | null
  activa: boolean
  baja: boolean
  creadaEn: string
  actualizadaEn: string
  eliminadaEn: string | null
  creadaPor: string | null
  actualizadaPor: string | null
  fachada: ArchivoTerminal | null
  isometrico: ArchivoTerminal | null
  donaciones: Array<DonacionTerminal>
  servicios: Array<ServicioDeTerminal>
}

export type RespuestaTerminal =
  | {
      ok: true
      terminal: Terminal
      salidas: Array<RutaDeTerminal>
      llegadas: Array<RutaDeTerminal>
      tramos: Array<TramoDeTerminal>
    }
  | { ok: false; falla: Falla }

const ESTACION_BREVE = { select: { id: true, number: true, shortName: true } } as const

const RUTA_SELECT = {
  id: true,
  number: true,
  name: true,
  isActive: true,
  deletedAt: true,
  priceOneWay: true,
  travelTimeMinutes: true,
  distanceKm: true,
  origin: ESTACION_BREVE,
  destination: ESTACION_BREVE,
  service: { select: { id: true, number: true, shortName: true } },
} as const

function comoArchivo(
  archivo: { id: string; name: string; url: string; mimetype: string; size: number } | null,
): ArchivoTerminal | null {
  if (!archivo) return null
  return {
    id: archivo.id,
    nombre: archivo.name,
    url: archivo.url,
    tipo: archivo.mimetype,
    bytes: archivo.size,
  }
}

function comoRuta(r: {
  id: string
  number: string
  name: string
  isActive: boolean
  deletedAt: Date | null
  priceOneWay: { toString(): string }
  travelTimeMinutes: number
  distanceKm: number
  origin: { id: string; number: string; shortName: string }
  destination: { id: string; number: string; shortName: string }
  service: { id: string; number: string; shortName: string }
}): RutaDeTerminal {
  return {
    id: r.id,
    numero: r.number,
    nombre: r.name,
    activa: r.isActive,
    baja: r.deletedAt !== null,
    origen: { id: r.origin.id, numero: r.origin.number, nombreCorto: r.origin.shortName },
    destino: {
      id: r.destination.id,
      numero: r.destination.number,
      nombreCorto: r.destination.shortName,
    },
    servicio: {
      id: r.service.id,
      numero: r.service.number,
      nombreCorto: r.service.shortName,
    },
    tarifaSencilla: r.priceOneWay.toString(),
    minutos: r.travelTimeMinutes,
    kilometros: r.distanceKm,
  }
}

export const obtenerTerminal = createServerFn({ method: 'GET' })
  .inputValidator((entrada: { id: string }) => entrada)
  .handler(async ({ data }): Promise<RespuestaTerminal> => {
    try {
      const [registro, salidas, llegadas, tramos] = await Promise.all([
        db.station.findUnique({
          where: { id: data.id },
          select: {
            id: true,
            number: true,
            shortName: true,
            name: true,
            address: true,
            latitude: true,
            longitude: true,
            googleUrl: true,
            phone: true,
            type: true,
            isActive: true,
            deletedAt: true,
            createdAt: true,
            updatedAt: true,
            state: { select: { name: true } },
            createdBy: { select: { name: true } },
            updatedBy: { select: { name: true } },
            facadePhoto: {
              select: { id: true, name: true, url: true, mimetype: true, size: true },
            },
            isometricPhoto: {
              select: { id: true, name: true, url: true, mimetype: true, size: true },
            },
            activeDonations: {
              select: { id: true, startDate: true, endDate: true, isActive: true },
              orderBy: [{ startDate: 'desc' }],
            },
            services: {
              orderBy: [{ number: 'asc' }],
              select: {
                id: true,
                number: true,
                key: true,
                shortName: true,
                fullName: true,
                isActive: true,
                deletedAt: true,
                company: { select: { id: true, key: true, shortName: true } },
              },
            },
          },
        }),
        db.route.findMany({
          where: { originId: data.id },
          select: RUTA_SELECT,
          orderBy: [{ number: 'asc' }],
        }),
        db.route.findMany({
          where: { destinationId: data.id },
          select: RUTA_SELECT,
          orderBy: [{ number: 'asc' }],
        }),
        db.segment.findMany({
          where: {
            OR: [{ originStationId: data.id }, { destinationStationId: data.id }],
          },
          select: {
            id: true,
            number: true,
            isMain: true,
            isActive: true,
            deletedAt: true,
            priceOneWay: true,
            originStation: ESTACION_BREVE,
            destinationStation: ESTACION_BREVE,
            route: { select: { id: true, number: true, name: true } },
          },
          orderBy: [{ route: { number: 'asc' } }, { number: 'asc' }],
        }),
      ])

      if (!registro) {
        return {
          ok: false,
          falla: {
            titulo: 'No existe esa terminal',
            detalle: data.id,
            sugerencia:
              'El identificador no corresponde a ningún registro de la base conectada. Vuelve al listado de terminales.',
          },
        }
      }

      const terminal: Terminal = {
        id: registro.id,
        numero: registro.number,
        nombreCorto: registro.shortName,
        nombre: registro.name,
        direccion: registro.address,
        latitud: registro.latitude,
        longitud: registro.longitude,
        urlGoogle: registro.googleUrl,
        telefono: registro.phone,
        tipo: registro.type,
        estado: registro.state?.name ?? null,
        activa: registro.isActive,
        baja: registro.deletedAt !== null,
        creadaEn: registro.createdAt.toISOString(),
        actualizadaEn: registro.updatedAt.toISOString(),
        eliminadaEn: registro.deletedAt ? registro.deletedAt.toISOString() : null,
        creadaPor: registro.createdBy?.name ?? null,
        actualizadaPor: registro.updatedBy?.name ?? null,
        fachada: comoArchivo(registro.facadePhoto),
        isometrico: comoArchivo(registro.isometricPhoto),
        donaciones: registro.activeDonations.map((d) => ({
          id: d.id,
          inicio: d.startDate.toISOString(),
          fin: d.endDate.toISOString(),
          activa: d.isActive,
        })),
        servicios: registro.services.map((s) => ({
          id: s.id,
          numero: s.number,
          clave: s.key,
          nombreCorto: s.shortName,
          nombreCompleto: s.fullName,
          activo: s.isActive,
          baja: s.deletedAt !== null,
          empresa: {
            id: s.company.id,
            clave: s.company.key,
            nombreCorto: s.company.shortName,
          },
        })),
      }

      return {
        ok: true,
        terminal,
        salidas: salidas.map(comoRuta),
        llegadas: llegadas.map(comoRuta),
        tramos: tramos.map((t) => ({
          id: t.id,
          numero: t.number,
          principal: t.isMain,
          activo: t.isActive,
          baja: t.deletedAt !== null,
          ruta: { id: t.route.id, numero: t.route.number, nombre: t.route.name },
          origen: {
            id: t.originStation.id,
            numero: t.originStation.number,
            nombreCorto: t.originStation.shortName,
          },
          destino: {
            id: t.destinationStation.id,
            numero: t.destinationStation.number,
            nombreCorto: t.destinationStation.shortName,
          },
          tarifaSencilla: t.priceOneWay.toString(),
        })),
      }
    } catch (error) {
      console.error('[terminales:detalle]', error)
      return { ok: false, falla: describirFalla(error) }
    }
  })
