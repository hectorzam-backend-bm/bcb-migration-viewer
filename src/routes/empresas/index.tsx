import { createFileRoute } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { Clave, Sello, SelloActividad } from '~/components/base'
import { Encabezado } from '~/components/cascaron'
import { EstadoError, EstadoVacio, ManifiestoCargando } from '~/components/estados'
import { BarraDeFiltros, Buscador, FiltroLista } from '~/components/filtros'
import type { Opcion } from '~/components/filtros'
import { Vinculo } from '~/components/ficha'
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
import { SIN_DATO, entero, plural } from '~/lib/formato'
import {
  DIRECCIONES,
  booleano,
  entero as enteroParam,
  limpiarBusqueda,
  lista,
  tamanoDePagina,
  texto,
  unoDe,
} from '~/lib/parametros'
import {
  ESTATUS_EMPRESA,
  ORDENES_EMPRESA,
  ORIGEN_EMPRESA,
  listarEmpresas,
} from '~/server/empresas'
import type {
  EstatusEmpresa,
  FiltroEmpresas,
  OrigenEmpresa,
} from '~/server/empresas'

/* ───────────────────────────────────────────────────────────────────────────
   El manifiesto de empresas. Todo el estado de la vista —búsqueda, filtros,
   orden y hoja— vive en la dirección, de modo que la pantalla exacta se pega
   en un chat y el otro ve lo mismo.
   ─────────────────────────────────────────────────────────────────────────── */

type Busqueda = FiltroEmpresas

const POR_OMISION: Busqueda = {
  q: '',
  pagina: 1,
  porPagina: 25,
  orden: 'clave',
  dir: 'asc',
  estatus: [],
  origen: [],
  bajas: false,
}

/** Filtra una lista de la URL dejando sólo los valores que el catálogo admite. */
function listaDe<const T extends ReadonlyArray<string>>(
  valor: unknown,
  validas: T,
): Array<T[number]> {
  return lista(valor).filter((v): v is T[number] =>
    (validas as ReadonlyArray<string>).includes(v),
  )
}

const OPCIONES_ESTATUS: Array<Opcion> = [
  { valor: 'activa', etiqueta: 'Activa' },
  { valor: 'inactiva', etiqueta: 'Inactiva' },
]

const OPCIONES_ORIGEN: Array<Opcion> = [
  { valor: 'hcm', etiqueta: 'Sincronizada por HCM' },
  { valor: 'manual', etiqueta: 'Creada a mano' },
]

/** Repone los valores por omisión que no viajan en la URL. */
function completar(s: Partial<Busqueda>): Busqueda {
  return { ...POR_OMISION, ...s }
}

export const Route = createFileRoute('/empresas/')({
  // Sólo viaja en la URL lo que el usuario cambió: si `validateSearch` devolviera
  // el objeto completo, entrar a /empresas dejaría la barra con
  // `?q=&pagina=1&porPagina=25&…` encima. `completar` repone los valores por
  // omisión para el loader y para la vista, que siempre los reciben completos.
  validateSearch: (entrada: Record<string, unknown>): Partial<Busqueda> =>
    limpiarBusqueda(
      {
        q: texto(entrada.q),
        pagina: enteroParam(entrada.pagina, 1, 1),
        porPagina: tamanoDePagina(entrada.porPagina),
        orden: unoDe(entrada.orden, ORDENES_EMPRESA, 'clave'),
        dir: unoDe(entrada.dir, DIRECCIONES, 'asc'),
        estatus: listaDe(entrada.estatus, ESTATUS_EMPRESA),
        origen: listaDe(entrada.origen, ORIGEN_EMPRESA),
        bajas: booleano(entrada.bajas),
      },
      POR_OMISION,
    ),
  loaderDeps: ({ search }) => completar(search),
  loader: ({ deps }) => listarEmpresas({ data: deps }),
  component: Pantalla,
  pendingComponent: () => <ManifiestoCargando columnas={[9, 14, 22, 28, 8, 10]} />,
  errorComponent: ({ error, reset }) => (
    <EstadoError
      titulo="No fue posible leer el catálogo de empresas"
      detalle={error instanceof Error ? error.message : String(error)}
      alReintentar={reset}
    />
  ),
})

/* ── Casilla ──────────────────────────────────────────────────────────────
   "Incluir bajas" no es una lista de opciones sino un sí/no, y un popover
   para una sola casilla sería una puerta de más. Se compone con los mismos
   tokens del disparador de FiltroLista para que la barra lea pareja.        */
function Casilla({
  marcada,
  alCambiar,
  children,
  titulo,
}: {
  marcada: boolean
  alCambiar: (marcada: boolean) => void
  children: React.ReactNode
  titulo?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcada}
      title={titulo}
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
      {children}
    </button>
  )
}

function Pantalla() {
  const resultado = Route.useLoaderData()
  const busqueda = completar(Route.useSearch())
  const navigate = Route.useNavigate()

  function actualizar(cambios: Partial<Busqueda>) {
    navigate({
      search: (previo) =>
        limpiarBusqueda({ ...completar(previo), ...cambios }, POR_OMISION),
      replace: true,
    })
  }

  function ordenar(campo: string) {
    actualizar({
      orden: campo as Busqueda['orden'],
      dir: busqueda.orden === campo && busqueda.dir === 'asc' ? 'desc' : 'asc',
      pagina: 1,
    })
  }

  const hayFiltros =
    busqueda.q.trim().length > 0 ||
    busqueda.estatus.length > 0 ||
    busqueda.origen.length > 0 ||
    busqueda.bajas

  if (!resultado.ok) {
    return (
      <>
        <Encabezado titulo="Empresas" renglon={SIN_DATO} />
        <EstadoError {...resultado.falla} />
      </>
    )
  }

  const { filas, total, pagina } = resultado

  return (
    <>
      <Encabezado
        acciones={<BotonActualizar />}
        titulo="Empresas"
        renglon={
          hayFiltros
            ? `${plural(total, 'empresa', 'empresas')} con los filtros aplicados`
            : plural(total, 'empresa migrada', 'empresas migradas')
        }
      />

      <div className="px-4 sm:px-8 py-6">
        <div className="overflow-hidden rounded-hoja border border-raya bg-hoja">
          <BarraDeFiltros
            hayFiltros={hayFiltros}
            alLimpiar={() =>
              actualizar({ q: '', estatus: [], origen: [], bajas: false, pagina: 1 })
            }
          >
            <Buscador
              className="w-64"
              valor={busqueda.q}
              marcador="Buscar clave, nombre o razón social"
              alCambiar={(q) => actualizar({ q, pagina: 1 })}
            />
            <FiltroLista
              nombre="Estatus"
              opciones={OPCIONES_ESTATUS}
              seleccion={busqueda.estatus}
              alCambiar={(seleccion) =>
                actualizar({
                  estatus: seleccion as Array<EstatusEmpresa>,
                  pagina: 1,
                })
              }
            />
            <FiltroLista
              nombre="Origen"
              opciones={OPCIONES_ORIGEN}
              seleccion={busqueda.origen}
              alCambiar={(seleccion) =>
                actualizar({ origen: seleccion as Array<OrigenEmpresa>, pagina: 1 })
              }
            />
            <Casilla
              marcada={busqueda.bajas}
              titulo="Muestra también las empresas con borrado lógico (deletedAt)"
              alCambiar={(bajas) => actualizar({ bajas, pagina: 1 })}
            >
              Incluir bajas
            </Casilla>
          </BarraDeFiltros>

          {filas.length === 0 ? (
            hayFiltros ? (
              <EstadoVacio
                titulo="Ninguna empresa coincide"
                detalle="Ajusta la búsqueda o retira los filtros para ver el catálogo completo."
                accion={
                  <button
                    type="button"
                    onClick={() =>
                      actualizar({
                        q: '',
                        estatus: [],
                        origen: [],
                        bajas: false,
                        pagina: 1,
                      })
                    }
                    className="inline-flex h-8 items-center rounded-chip border border-raya px-3 font-mono text-nota font-medium tracking-[0.08em] text-tinta-2 uppercase transition-[colors,transform] duration-100 hover:border-raya-firme hover:bg-renglon hover:text-tinta active:scale-[0.97]"
                  >
                    Limpiar filtros
                  </button>
                }
              />
            ) : (
              <EstadoVacio
                titulo="El catálogo de empresas está vacío"
                detalle="La base conectada no tiene ninguna empresa migrada. Confirma que DATABASE_URL apunta a la base correcta."
              />
            )
          ) : (
            <Manifiesto etiqueta="Empresas migradas">
              <Cabecera>
                <ThOrden
                  campo="clave"
                  ordenActual={busqueda.orden}
                  direccion={busqueda.dir}
                  alOrdenar={ordenar}
                >
                  Clave
                </ThOrden>
                <ThOrden
                  campo="nombreCorto"
                  ordenActual={busqueda.orden}
                  direccion={busqueda.dir}
                  alOrdenar={ordenar}
                >
                  Nombre corto
                </ThOrden>
                <ThOrden
                  campo="nombreComercial"
                  ordenActual={busqueda.orden}
                  direccion={busqueda.dir}
                  alOrdenar={ordenar}
                >
                  Nombre comercial
                </ThOrden>
                <Th>Razón social</Th>
                <ThOrden
                  campo="servicios"
                  numerica
                  ordenActual={busqueda.orden}
                  direccion={busqueda.dir}
                  alOrdenar={ordenar}
                >
                  Servicios
                </ThOrden>
                <Th>Estatus</Th>
              </Cabecera>

              <Cuerpo>
                {filas.map((fila) => (
                  <Fila key={fila.id} atenuada={fila.eliminada}>
                    <Td>
                      <EnlaceDeFila
                        to="/empresas/$id"
                        params={{ id: fila.id }}
                        className="inline-block"
                      >
                        <Clave enfasis>{fila.clave}</Clave>
                      </EnlaceDeFila>
                    </Td>
                    <Td className="text-tinta-2">{fila.nombreCorto || SIN_DATO}</Td>
                    <Td className="text-tinta">
                      {/* El recorte va en un span: con `table-layout: auto`
                          un max-width sobre la celda es sólo una sugerencia. */}
                      <span className="block max-w-[20rem] truncate">
                        {fila.nombreComercial || SIN_DATO}
                      </span>
                    </Td>
                    <Td className="text-tinta-3">
                      <span
                        className="block max-w-[22rem] truncate"
                        title={fila.razonSocial}
                      >
                        {fila.razonSocial || SIN_DATO}
                      </span>
                    </Td>
                    <Td numerica>
                      {fila.servicios === 0 ? (
                        // Cero es un dato, no una ausencia: se imprime, atenuado
                        // y sin enlace. `—` significaría "se desconoce".
                        <span className="text-tinta-4">{entero(0)}</span>
                      ) : (
                        // Por encima del enlace que cubre el renglón: el cruce
                        // con el catálogo de servicios es el valor del visor.
                        <Vinculo
                          to="/servicios"
                          search={{ empresa: [fila.id] }}
                          className="relative z-10 text-tinta"
                        >
                          {entero(fila.servicios)}
                        </Vinculo>
                      )}
                    </Td>
                    <Td>
                      <span className="flex items-center gap-2">
                        <SelloActividad
                          activa={fila.activa}
                          eliminada={fila.eliminada}
                        />
                        {fila.hcmDesactivada ? (
                          <Sello
                            tono="aviso"
                            titulo="HCM la reportó ausente o con estatus N. Es meramente informativo: no afecta el funcionamiento del sistema."
                          >
                            HCM
                          </Sello>
                        ) : null}
                      </span>
                    </Td>
                  </Fila>
                ))}
              </Cuerpo>
            </Manifiesto>
          )}

          {filas.length > 0 ? (
            <Paginacion
              pagina={pagina}
              porPagina={busqueda.porPagina}
              total={total}
              sustantivo="empresas"
              alCambiarPagina={(p) => actualizar({ pagina: p })}
              alCambiarTamano={(t) => actualizar({ porPagina: t, pagina: 1 })}
            />
          ) : null}
        </div>
      </div>
    </>
  )
}
