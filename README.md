# Visor de migración BCB

Consulta local, de **sólo lectura**, de los catálogos operativos: empresas, servicios, terminales, y
rutas con sus tramos. Sin login ni autenticación: está pensado para correr contra tu base local.

```
pnpm install
cp .env.example .env     # y apunta DATABASE_URL a tu Postgres local
pnpm dev                 # http://localhost:3000
```

## Sólo lectura, con dos candados

Este visor nunca escribe. La garantía no depende de que la interfaz no tenga botones:

1. **En la aplicación** — el cliente Prisma de `src/server/db.ts` lleva una extensión que rechaza
   toda operación que no sea de lectura (`findMany`, `findFirst`, `count`, `aggregate`, `groupBy`…).
   Un `create`, `update`, `delete` o `upsert` lanza `ErrorDeEscrituraBloqueada` antes de salir del
   proceso.
2. **En la base** — se recomienda apuntar `DATABASE_URL` a un usuario con permisos únicamente de
   `SELECT`. El candado de la aplicación sigue valiendo aunque el usuario tuviera permisos de más.

No hay migraciones en este repo. `prisma generate` es lo único que se ejecuta; `db push` y
`migrate` no forman parte de ningún script.

## Stack

| Pieza | Uso |
| --- | --- |
| **pnpm** | gestor de paquetes |
| **TanStack Start** | framework full-stack; las consultas corren en funciones de servidor |
| **TanStack Router** | rutas por archivo y, sobre todo, **el estado de la vista en la URL** |
| **TanStack Table v9** | modelo de columnas de cada manifiesto — en modo manual, ver abajo |
| **Prisma 7** | acceso a datos, con el adaptador `@prisma/adapter-pg` |
| **Tailwind v4** | estilos, sobre tokens semánticos definidos en `src/styles/app.css` |
| **Radix UI** | primitivas sin estilo para popover, pestañas y diálogo |

TanStack Table corre en **modo manual**: la paginación, el orden y el filtrado se siguen resolviendo
en Postgres y el estado sigue viviendo en los parámetros de la URL — eso no cambió. Lo que la
librería aporta es el modelo de columnas: cada manifiesto declara sus columnas una sola vez
(`src/routes/<catálogo>/columns.tsx`), y de ahí salen el encabezado, la celda, el afijo de orden y el
ancho del esqueleto de carga, en vez de mantenerlos sincronizados a mano en tres lugares. El puente
entre la URL y la tabla vive en `src/lib/table-state.ts`; el renderizador compartido, en
`src/components/data-table.tsx`. Tampoco se usa React Query: las cargas pasan por los `loader` del
router.

### El estado vive en la URL

Búsqueda, filtros, orden, página y pestaña activa son parámetros de la dirección. Cualquier pantalla
del visor se puede copiar y pegar, y el que la abra ve exactamente lo mismo — que es justo lo que se
necesita cuando dos personas están cotejando una migración.

## El esquema de Prisma

`prisma/schema.prisma` es una copia del esquema del backend. Se dejó **sin tocar** salvo una línea,
para que puedas reemplazarlo por una versión más nueva sin tener que reescribirlo:

```diff
- moduleFormat    = "cjs"
+ moduleFormat    = "esm"
```

Vite necesita salida ESM. Todo lo demás —incluido `output = "../generated/prisma"`, que desde
`prisma/` cae en `generated/prisma` de este repo— queda igual.

Si traes un esquema nuevo del backend: cópialo, vuelve a cambiar esa línea y corre `pnpm db:generate`.

La configuración del CLI vive en `prisma.config.ts`, porque Prisma 7 ya no lee la url del bloque
`datasource` ni carga `.env` por su cuenta.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | servidor de desarrollo en el puerto 3000 |
| `pnpm build` | compilación de producción |
| `pnpm start` | sirve la compilación (`server.mjs`, puerto 3000 o `PORT`) |
| `pnpm db:generate` | regenera el cliente Prisma a `generated/prisma` |
| `pnpm db:pull --print` | imprime el esquema real de la base, sin escribir nada |
| `pnpm typecheck` | `tsc --noEmit` |

## Cómo está organizado

```
server.mjs                  entrada de producción: sirve dist/client y delega en el manejador
prisma/schema.prisma        esquema (copia del backend, una línea cambiada)
prisma.config.ts            configuración del CLI de Prisma 7
generated/prisma/           cliente generado — ignorado por git
src/
  styles/app.css            tokens del sistema de diseño
  server/
    db.ts                   cliente Prisma de sólo lectura + traducción de fallas
    <sección>.ts            funciones de servidor por catálogo
  routes/                   rutas por archivo de TanStack Router
    <catálogo>/columns.tsx  columnas de TanStack Table de ese manifiesto
  components/
    table.tsx               vocabulario visual: Th, Td, TableRow, RowLink, Pagination…
    data-table.tsx           capa de instancia de tabla: DataTable, HeaderCell, features
  lib/
    table-state.ts          puente entre los parámetros de la URL y la tabla
    format.ts, params.ts    formateadores y validadores de parámetros de URL
.interface-design/system.md el sistema de diseño, escrito
```

## Diseño

La dirección visual está documentada en [`.interface-design/system.md`](.interface-design/system.md)
y se resume así: **un manifiesto de operaciones impreso**. Papel manila, tinta de máquina de
escribir, un solo acento de sello de hule. Todo identificador y toda cifra van en monoespaciada con
cifras tabulares, porque un manifiesto se escribe a máquina y las columnas de números no deben
bailar.

Una decisión que vale la pena señalar: los estados **no** son interruptores. En un visor de sólo
lectura un interruptor miente sobre lo que se puede hacer, así que "Activa" es un punto y una
palabra. Y como casi todo está activo, la norma se mantiene callada: lo que resalta es lo anómalo
—lo inactivo, lo dado de baja, lo que HCM marcó ausente—, que es lo que se está buscando.
