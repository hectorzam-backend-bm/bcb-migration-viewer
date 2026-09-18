import { useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { Clave, Hoja, SelloActividad } from '~/components/base'
import { Encabezado } from '~/components/cascaron'
import { EstadoError, EstadoVacio, ManifiestoCargando } from '~/components/estados'
import { BarraDeFiltros, Buscador, FiltroLista } from '~/components/filtros'
import { BotonActualizar } from '~/components/actualizar'
import {
  Cabecera,
  Cuerpo,
  EnlaceDeFila,
  Fila,
  Manifiesto,
  Paginacion,
  Td,
  Th,
  ThOrden,
} from '~/components/tabla'
import { cn } from '~/lib/cn'
import { SIN_DATO, TIPO_TERMINAL, plural } from '~/lib/formato'
import {
  DIRECCIONES,
  TAMANOS,
  booleano,
  entero,
  limpiarBusqueda,
  lista,
  tamanoDePagina,
  texto,
  unoDe,
  type Direccion,
} from '~/lib/parametros'
import {
  ESTATUS_TERMINAL,
  ORDENES_TERMINAL,
  TIPOS_TERMINAL,
  listarTerminales,
  type BusquedaTerminales,
} from '~/server/terminales'

/**
 * Dos formas del mismo estado:
 *  · `BusquedaEnURL` es lo que se escribe en la dirección — todo opcional y las
 *    listas en una sola cadena separada por comas, para que el enlace se pueda
 *    leer y pegar. El enrutador reescribe la URL con lo que devuelve
 *    `validateSearch`: si devolviera el objeto completo, cada visita quedaría con
 *    `?q=&pagina=1&porPagina=25&…` encima.
 *  · `BusquedaTerminales` es lo que consume la función de servidor, ya completo.
 */
type BusquedaEnURL = {
  q?: string
  pagina?: number
  porPagina?: number
  orden?: (typeof ORDENES_TERMINAL)[number]
  dir?: Direccion
  empresa?: string
  servicio?: string
  tipo?: string
  estado?: string
  estatus?: string
  bajas?: boolean
}

const POR_OMISION_EN_URL = {
  q: '',
  pagina: 1,
  porPagina: TAMANOS[0],
  orden: 'numero',
  dir: 'asc',
  empresa: '',
  servicio: '',
  tipo: '',
  estado: '',
  estatus: '',
  bajas: false,
} satisfies Required<BusquedaEnURL>

/** Rellena los valores por omisión: la vista y el servidor siempre reciben todo. */
function completar(s: BusquedaEnURL): BusquedaTerminales {
  return {
    q: s.q ?? POR_OMISION_EN_URL.q,
    pagina: s.pagina ?? POR_OMISION_EN_URL.pagina,
    porPagina: s.porPagina ?? POR_OMISION_EN_URL.porPagina,
    orden: s.orden ?? 'numero',
    dir: s.dir ?? 'asc',
    empresa: lista(s.empresa),
    servicio: lista(s.servicio),
    tipo: lista(s.tipo),
    estado: lista(s.estado),
    estatus: lista(s.estatus),
    bajas: s.bajas ?? POR_OMISION_EN_URL.bajas,
  }
}

/** Quita de la dirección todo lo que ya es el valor por omisión. */
function aURL(b: BusquedaTerminales): BusquedaEnURL {
  return limpiarBusqueda(
    {
      q: b.q.trim(),
      pagina: b.pagina,
      porPagina: b.porPagina,
      orden: b.orden,
      dir: b.dir,
      empresa: b.empresa.join(','),
      servicio: b.servicio.join(','),
      tipo: b.tipo.join(','),
      estado: b.estado.join(','),
      estatus: b.estatus.join(','),
      bajas: b.bajas,
    },
    POR_OMISION_EN_URL,
  )
}

export const Route = createFileRoute('/terminales/')({
  validateSearch: (entrada: Record<string, unknown>): BusquedaEnURL =>
    aURL({
      q: texto(entrada.q),
      pagina: entero(entrada.pagina, 1, 1),
      porPagina: tamanoDePagina(entrada.porPagina),
      orden: unoDe(entrada.orden, ORDENES_TERMINAL, 'numero'),
      dir: unoDe(entrada.dir, DIRECCIONES, 'asc'),
      empresa: lista(entrada.empresa),
      servicio: lista(entrada.servicio),
      tipo: lista(entrada.tipo),
      estado: lista(entrada.estado),
      estatus: lista(entrada.estatus),
      bajas: booleano(entrada.bajas),
    }),
  loaderDeps: ({ search }) => completar(search),
  loader: ({ deps }) => listarTerminales({ data: deps }),
  component: Pantalla,
  pendingComponent: () => (
    <>
      <Encabezado titulo="Terminales" renglon="Leyendo el catálogo…" />
      <div className="px-4 sm:px-8 py-6">
        <Hoja className="overflow-hidden py-2">
          <ManifiestoCargando columnas={[7, 12, 22, 8, 13, 16, 12, 8]} />
        </Hoja>
      </div>
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <>
      <Encabezado titulo="Terminales" />
      <EstadoError
        titulo="No fue posible leer el catálogo de terminales"
        detalle={error instanceof Error ? error.message : String(error)}
        alReintentar={reset}
      />
    </>
  ),
})

/* ── Controles locales ────────────────────────────────────────────────────── */

/** Casilla de la barra de filtros. No es un interruptor de datos: filtra la vista. */
function Casilla({
  nombre,
  marcada,
  alCambiar,
}: {
  nombre: string
  marcada: boolean
  alCambiar: (marcada: boolean) => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcada}
      onClick={() => alCambiar(!marcada)}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-chip border px-3 text-lectura',
        'transition-[colors,transform] duration-100 active:scale-[0.98]',
        marcada
          ? 'border-sello/40 bg-sello-lavado text-tinta'
          : 'border-raya border-dashed bg-transparent text-tinta-2 hover:border-raya-firme hover:border-solid hover:bg-renglon',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid size-[15px] shrink-0 place-items-center rounded-[2px] border transition-colors duration-100',
          marcada ? 'border-sello bg-sello text-hoja' : 'border-raya-firme',
        )}
      >
        {marcada ? <Check size={10} strokeWidth={3} /> : null}
      </span>
      <span className="font-medium whitespace-nowrap">{nombre}</span>
    </button>
  )
}

/** Hasta dos valores en el renglón; el resto se resume en "+N" y vive en el title. */
function Resumen({ valores, vacio }: { valores: Array<string>; vacio: string }) {
  if (valores.length === 0) {
    return (
      <span className="text-tinta-4" title={vacio}>
        {SIN_DATO}
      </span>
    )
  }
  const visibles = valores.slice(0, 2)
  const resto = valores.length - visibles.length
  return (
    <span className="flex items-center gap-2" title={valores.join('\n')}>
      {visibles.map((v) => (
        <span
          key={v}
          className="border-l border-raya pl-2 font-mono text-dato whitespace-nowrap text-tinta-2 first:border-l-0 first:pl-0"
        >
          {v}
        </span>
      ))}
      {resto > 0 ? (
        <span
          data-cifra
          className="shrink-0 rounded-chip bg-renglon px-1 font-mono text-nota text-tinta-3"
        >
          +{resto}
        </span>
      ) : null}
    </span>
  )
}

/* ── Pantalla ─────────────────────────────────────────────────────────────── */

function Pantalla() {
  const datos = Route.useLoaderData()
  const busqueda = completar(Route.useSearch())
  const navigate = Route.useNavigate()

  const cambiar = useCallback(
    (parche: Partial<BusquedaTerminales>, reiniciarPagina = true) => {
      void navigate({
        search: (prev) =>
          aURL({
            ...completar(prev),
            ...parche,
            ...(reiniciarPagina ? { pagina: 1 } : {}),
          }),
        replace: true,
      })
    },
    [navigate],
  )

  const alBuscar = useCallback((q: string) => cambiar({ q }), [cambiar])

  const hayFiltros =
    busqueda.q.trim() !== '' ||
    busqueda.empresa.length > 0 ||
    busqueda.servicio.length > 0 ||
    busqueda.tipo.length > 0 ||
    busqueda.estado.length > 0 ||
    busqueda.estatus.length > 0 ||
    busqueda.bajas

  if (!datos.ok) {
    return (
      <>
        <Encabezado titulo="Terminales" />
        <EstadoError {...datos.falla} />
      </>
    )
  }

  const { filas, total, pagina, opciones } = datos

  function alOrdenar(campo: string) {
    const mismo = busqueda.orden === campo
    cambiar({
      orden: unoDe(campo, ORDENES_TERMINAL, 'numero'),
      dir: mismo && busqueda.dir === 'asc' ? 'desc' : 'asc',
    })
  }

  return (
    <>
      <Encabezado
        acciones={<BotonActualizar />}
        titulo="Terminales"
        renglon={
          hayFiltros
            ? `${plural(total, 'terminal', 'terminales')} con los filtros aplicados`
            : plural(total, 'terminal en el catálogo', 'terminales en el catálogo')
        }
      />

      <div className="px-4 sm:px-8 py-6">
        <Hoja className="overflow-hidden">
          <BarraDeFiltros
            hayFiltros={hayFiltros}
            alLimpiar={() =>
              cambiar({
                q: '',
                empresa: [],
                servicio: [],
                tipo: [],
                estado: [],
                estatus: [],
                bajas: false,
              })
            }
          >
            <Buscador
              valor={busqueda.q}
              alCambiar={alBuscar}
              marcador="Buscar por número, nombre o dirección…"
              className="w-full max-w-[22rem]"
            />
            <FiltroLista
              nombre="Empresa"
              opciones={opciones.empresas}
              seleccion={busqueda.empresa}
              alCambiar={(empresa) => cambiar({ empresa })}
            />
            <FiltroLista
              nombre="Servicio"
              opciones={opciones.servicios}
              seleccion={busqueda.servicio}
              alCambiar={(servicio) => cambiar({ servicio })}
            />
            <FiltroLista
              nombre="Tipo"
              opciones={TIPOS_TERMINAL.map((t) => ({
                valor: t,
                etiqueta: TIPO_TERMINAL[t] ?? t,
              }))}
              seleccion={busqueda.tipo}
              alCambiar={(tipo) => cambiar({ tipo })}
            />
            <FiltroLista
              nombre="Estado"
              opciones={opciones.estados}
              seleccion={busqueda.estado}
              alCambiar={(estado) => cambiar({ estado })}
            />
            <FiltroLista
              nombre="Estatus"
              opciones={ESTATUS_TERMINAL.map((e) => ({
                valor: e,
                etiqueta: e === 'activa' ? 'Activa' : 'Inactiva',
              }))}
              seleccion={busqueda.estatus}
              alCambiar={(estatus) => cambiar({ estatus })}
            />
            <Casilla
              nombre="Incluir bajas"
              marcada={busqueda.bajas}
              alCambiar={(bajas) => cambiar({ bajas })}
            />
          </BarraDeFiltros>

          {filas.length === 0 ? (
            hayFiltros ? (
              <EstadoVacio
                titulo="Ninguna terminal coincide"
                detalle="Ningún registro cumple con la búsqueda y los filtros activos. Prueba con menos criterios."
              />
            ) : (
              <EstadoVacio
                titulo="El catálogo de terminales está vacío"
                detalle="La base conectada no tiene terminales vigentes. Si esperabas registros, revisa que apuntes a la base migrada."
              />
            )
          ) : (
            <Manifiesto etiqueta="Catálogo de terminales">
              <Cabecera>
                <ThOrden
                  campo="numero"
                  ordenActual={busqueda.orden}
                  direccion={busqueda.dir}
                  alOrdenar={alOrdenar}
                >
                  No. terminal
                </ThOrden>
                <ThOrden
                  campo="nombreCorto"
                  ordenActual={busqueda.orden}
                  direccion={busqueda.dir}
                  alOrdenar={alOrdenar}
                >
                  Nombre corto
                </ThOrden>
                <ThOrden
                  campo="nombre"
                  ordenActual={busqueda.orden}
                  direccion={busqueda.dir}
                  alOrdenar={alOrdenar}
                >
                  Nombre completo
                </ThOrden>
                <Th>Tipo</Th>
                <ThOrden
                  campo="estado"
                  ordenActual={busqueda.orden}
                  direccion={busqueda.dir}
                  alOrdenar={alOrdenar}
                >
                  Estado
                </ThOrden>
                <Th>Servicios</Th>
                <Th>Empresas</Th>
                <Th>Estatus</Th>
              </Cabecera>
              <Cuerpo>
                {filas.map((f) => (
                  <Fila key={f.id} atenuada={f.baja}>
                    <Td>
                      <EnlaceDeFila to="/terminales/$id" params={{ id: f.id }}>
                        <Clave enfasis>{f.numero}</Clave>
                      </EnlaceDeFila>
                    </Td>
                    <Td>
                      <span className="font-mono text-dato tracking-[0.04em] text-tinta">
                        {f.nombreCorto}
                      </span>
                    </Td>
                    <Td>
                      <span className="block max-w-[26rem] truncate text-tinta-2" title={f.nombre}>
                        {f.nombre}
                      </span>
                    </Td>
                    <Td>
                      <span className="whitespace-nowrap text-tinta-2">
                        {TIPO_TERMINAL[f.tipo] ?? f.tipo}
                      </span>
                    </Td>
                    <Td>
                      <span className="whitespace-nowrap text-tinta-2">
                        {f.estado ?? <span className="text-tinta-4">{SIN_DATO}</span>}
                      </span>
                    </Td>
                    <Td>
                      <Resumen
                        valores={f.servicios.map((s) => `${s.numero} · ${s.nombreCorto}`)}
                        vacio="Sin servicios asociados"
                      />
                    </Td>
                    <Td>
                      <Resumen
                        valores={f.empresas.map((e) => e.nombreCorto)}
                        vacio="Sin empresa deducible: la terminal no tiene servicios"
                      />
                    </Td>
                    <Td>
                      <SelloActividad activa={f.activa} eliminada={f.baja} />
                    </Td>
                  </Fila>
                ))}
              </Cuerpo>
            </Manifiesto>
          )}

          <Paginacion
            pagina={pagina}
            porPagina={busqueda.porPagina}
            total={total}
            sustantivo="terminales"
            tamanos={[...TAMANOS]}
            alCambiarPagina={(p) => cambiar({ pagina: p }, false)}
            alCambiarTamano={(t) => cambiar({ porPagina: t })}
          />
        </Hoja>
      </div>
    </>
  )
}
