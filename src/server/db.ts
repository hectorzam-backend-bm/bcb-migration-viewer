import type { PrismaClient as TipoPrismaClient } from '../../generated/prisma/client.ts'

/**
 * Prisma y el driver `pg` se cargan con importación dinámica detrás de
 * `import.meta.env.SSR`.
 *
 * No se usa el marcador `@tanstack/react-start/server-only`: este módulo SÍ es
 * alcanzable desde el grafo del cliente, porque las funciones de servidor viven en
 * módulos compartidos que el navegador necesita para resolver el puente RPC. El
 * marcador haría fallar la compilación en vez de resolver nada.
 *
 * En desarrollo, Vite mete los módulos de `src/server/` en el grafo del cliente
 * (los necesita para resolver las llamadas RPC de las funciones de servidor), así
 * que una importación estática arrastraba `@prisma/adapter-pg` y el cliente
 * generado hasta el navegador, que reventaba con `Buffer is not defined`.
 *
 * `import.meta.env.SSR` es una constante que Vite sustituye en tiempo de
 * compilación: en el cliente la rama queda como código muerto y estas
 * importaciones nunca se evalúan ni se descargan. La carga es ansiosa —no
 * perezosa— a propósito, para que `db.segment.fields` siga siendo una lectura
 * síncrona en los `where` que comparan dos columnas.
 */
const prisma = import.meta.env.SSR
  ? {
      PrismaPg: (await import('@prisma/adapter-pg')).PrismaPg,
      PrismaClient: (await import('../../generated/prisma/client.ts')).PrismaClient,
    }
  : null

function modulos() {
  if (!prisma) {
    throw new Error(
      'El cliente de Prisma sólo existe en el servidor. Esto significa que ' +
        'src/server/db.ts se evaluó en el navegador: revisa quién lo importó.',
    )
  }
  return prisma
}

/**
 * Este visor es de SÓLO LECTURA.
 *
 * Dos candados, a propósito redundantes:
 *  1. Se recomienda apuntar DATABASE_URL a un usuario con permisos únicamente de SELECT.
 *  2. La extensión de abajo rechaza cualquier operación de escritura antes de que salga
 *     de este proceso, aunque el usuario de base de datos tuviera permisos de más.
 */
const OPERACIONES_DE_LECTURA = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'aggregate',
  'groupBy',
  'count',
])

export class ErrorDeEscrituraBloqueada extends Error {
  constructor(operacion: string, modelo: string | undefined) {
    super(
      `Operación de escritura bloqueada: ${modelo ?? 'modelo'}.${operacion}(). ` +
        'Este visor es de sólo lectura.',
    )
    this.name = 'ErrorDeEscrituraBloqueada'
  }
}

export class ErrorDeConexion extends Error {
  readonly sugerencia: string
  constructor(mensaje: string, sugerencia: string) {
    super(mensaje)
    this.name = 'ErrorDeConexion'
    this.sugerencia = sugerencia
  }
}

function construirCliente() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new ErrorDeConexion(
      'Falta DATABASE_URL',
      'Copia .env.example a .env y define la cadena de conexión a tu Postgres local.',
    )
  }

  const { PrismaPg, PrismaClient } = modulos()
  const adapter = new PrismaPg({ connectionString })

  return new PrismaClient({ adapter }).$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!OPERACIONES_DE_LECTURA.has(operation)) {
            throw new ErrorDeEscrituraBloqueada(operation, model)
          }
          return query(args)
        },
      },
    },
  })
}

type Cliente = ReturnType<typeof construirCliente>
export type ClientePrisma = TipoPrismaClient

const global_ = globalThis as unknown as { __prismaVisor?: Cliente }

function obtenerCliente(): Cliente {
  if (!global_.__prismaVisor) {
    global_.__prismaVisor = construirCliente()
  }
  return global_.__prismaVisor
}

/**
 * Se construye al primer uso, no al importar: si falta DATABASE_URL el visor
 * debe poder pintar una pantalla que lo explique, no caerse al arrancar.
 */
export const db = new Proxy({} as Cliente, {
  get(_destino, propiedad) {
    const valor = Reflect.get(obtenerCliente() as object, propiedad)
    return typeof valor === 'function' ? valor.bind(obtenerCliente()) : valor
  },
})

/** Traduce fallas de conexión a algo que la interfaz pueda explicar. */
export function describirFalla(error: unknown): {
  titulo: string
  detalle: string
  sugerencia: string
} {
  if (error instanceof ErrorDeConexion) {
    return { titulo: error.message, detalle: '', sugerencia: error.sugerencia }
  }

  const mensaje = error instanceof Error ? error.message : String(error)

  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(mensaje)) {
    return {
      titulo: 'No hay respuesta de la base de datos',
      detalle: mensaje,
      sugerencia:
        'Verifica que Postgres esté corriendo y que el host y el puerto de DATABASE_URL sean correctos.',
    }
  }
  if (/password authentication failed|role .* does not exist/i.test(mensaje)) {
    return {
      titulo: 'Credenciales rechazadas',
      detalle: mensaje,
      sugerencia: 'Revisa el usuario y la contraseña en DATABASE_URL.',
    }
  }
  if (/database .* does not exist/i.test(mensaje)) {
    return {
      titulo: 'La base de datos no existe',
      detalle: mensaje,
      sugerencia: 'Revisa el nombre de la base al final de DATABASE_URL.',
    }
  }
  if (/relation .* does not exist|does not exist in the current database/i.test(mensaje)) {
    return {
      titulo: 'El esquema no coincide',
      detalle: mensaje,
      sugerencia:
        'La base conectada no tiene las tablas que describe prisma/schema.prisma. Confirma que apuntas a la base migrada.',
    }
  }

  return {
    titulo: 'Error al consultar',
    detalle: mensaje,
    sugerencia: 'Revisa la consola del servidor para el detalle completo.',
  }
}
