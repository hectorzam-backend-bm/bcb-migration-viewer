import type { PrismaClient as GeneratedPrismaClient } from '../../generated/prisma/client.ts'

/**
 * Prisma and the `pg` driver are loaded with a dynamic import behind
 * `import.meta.env.SSR`.
 *
 * The `@tanstack/react-start/server-only` marker is not used: this module IS
 * reachable from the client graph, because server functions live in shared
 * modules that the browser needs in order to resolve the RPC bridge. The marker
 * would break the build instead of fixing anything.
 *
 * In development, Vite pulls the `src/server/` modules into the client graph
 * (it needs them to resolve the RPC calls of the server functions), so a static
 * import dragged `@prisma/adapter-pg` and the generated client all the way to
 * the browser, which blew up with `Buffer is not defined`.
 *
 * `import.meta.env.SSR` is a constant that Vite substitutes at build time: on
 * the client the branch is left as dead code and these imports are never
 * evaluated nor downloaded. The load is eager —not lazy— on purpose, so that
 * `db.segment.fields` stays a synchronous read in the `where` clauses that
 * compare two columns.
 */
const prisma = import.meta.env.SSR
  ? {
      PrismaPg: (await import('@prisma/adapter-pg')).PrismaPg,
      PrismaClient: (await import('../../generated/prisma/client.ts')).PrismaClient,
    }
  : null

function requirePrismaModules() {
  if (!prisma) {
    throw new Error(
      'The Prisma client only exists on the server. This means that ' +
        'src/server/db.ts was evaluated in the browser: check who imported it.',
    )
  }
  return prisma
}

/**
 * This viewer is READ-ONLY, with one deliberate exception: `dbWrite` below.
 *
 * Two locks on `db`, redundant on purpose:
 *  1. DATABASE_URL should point at a user with SELECT-only permissions.
 *  2. The extension below rejects any write operation before it leaves this
 *     process, even if the database user happened to have extra permissions.
 *
 * `dbWrite` is the raw client, with neither lock. It exists because `/importar`'s
 * JSON restore step (`src/server/restore.ts`, the only module that imports it)
 * writes `Company`/`Service`/`Unit`/`UnitDeck` directly: those four tables have
 * no unauthenticated API to proxy to (unlike the CSV steps in `seeds.ts`), and
 * `/seeds/clean` deletes all four with nothing in the backend able to restore
 * them. `db` and `dbWrite` share one connection pool — `getRaw()` is built once.
 */
const READ_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'aggregate',
  'groupBy',
  'count',
])

export class BlockedWriteError extends Error {
  constructor(operation: string, model: string | undefined) {
    super(
      `Blocked write operation: ${model ?? 'model'}.${operation}(). ` +
        'This viewer is read-only.',
    )
    this.name = 'BlockedWriteError'
  }
}

export class ConnectionError extends Error {
  readonly suggestion: string
  constructor(message: string, suggestion: string) {
    super(message)
    this.name = 'ConnectionError'
    this.suggestion = suggestion
  }
}

function buildRawClient() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new ConnectionError(
      'Falta DATABASE_URL',
      'Copia .env.example a .env y define la cadena de conexión a tu Postgres local.',
    )
  }

  const { PrismaPg, PrismaClient } = requirePrismaModules()
  const adapter = new PrismaPg({ connectionString })

  return new PrismaClient({ adapter })
}

function lockClient(raw: RawClient) {
  return raw.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!READ_OPERATIONS.has(operation)) {
            throw new BlockedWriteError(operation, model)
          }
          return query(args)
        },
      },
    },
  })
}

type RawClient = ReturnType<typeof buildRawClient>
type LockedClient = ReturnType<typeof lockClient>
export type PrismaClientType = GeneratedPrismaClient

const global_ = globalThis as unknown as { __prismaRaw?: RawClient; __prismaLocked?: LockedClient }

function getRaw(): RawClient {
  if (!global_.__prismaRaw) {
    global_.__prismaRaw = buildRawClient()
  }
  return global_.__prismaRaw
}

function getLocked(): LockedClient {
  if (!global_.__prismaLocked) {
    global_.__prismaLocked = lockClient(getRaw())
  }
  return global_.__prismaLocked
}

/**
 * Built on first use, not on import: if DATABASE_URL is missing the viewer must
 * be able to paint a screen that explains it, not crash at startup.
 */
export const db = new Proxy({} as LockedClient, {
  get(_target, property) {
    const value = Reflect.get(getLocked() as object, property)
    return typeof value === 'function' ? value.bind(getLocked()) : value
  },
})

/** See the file header. Only `src/server/restore.ts` may import this. */
export const dbWrite = new Proxy({} as RawClient, {
  get(_target, property) {
    const value = Reflect.get(getRaw() as object, property)
    return typeof value === 'function' ? value.bind(getRaw()) : value
  },
})

/** Translates connection failures into something the interface can explain. */
export function describeFailure(error: unknown): {
  title: string
  detail: string
  suggestion: string
} {
  if (error instanceof ConnectionError) {
    return { title: error.message, detail: '', suggestion: error.suggestion }
  }

  const message = error instanceof Error ? error.message : String(error)

  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(message)) {
    return {
      title: 'No hay respuesta de la base de datos',
      detail: message,
      suggestion:
        'Verifica que Postgres esté corriendo y que el host y el puerto de DATABASE_URL sean correctos.',
    }
  }
  if (/password authentication failed|role .* does not exist/i.test(message)) {
    return {
      title: 'Credenciales rechazadas',
      detail: message,
      suggestion: 'Revisa el usuario y la contraseña en DATABASE_URL.',
    }
  }
  if (/database .* does not exist/i.test(message)) {
    return {
      title: 'La base de datos no existe',
      detail: message,
      suggestion: 'Revisa el nombre de la base al final de DATABASE_URL.',
    }
  }
  if (/relation .* does not exist|does not exist in the current database/i.test(message)) {
    return {
      title: 'El esquema no coincide',
      detail: message,
      suggestion:
        'La base conectada no tiene las tablas que describe prisma/schema.prisma. Confirma que apuntas a la base migrada.',
    }
  }

  return {
    title: 'Error al consultar',
    detail: message,
    suggestion: 'Revisa la consola del servidor para el detalle completo.',
  }
}
