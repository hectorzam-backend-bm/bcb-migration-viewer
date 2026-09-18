import { useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Clave, Hoja, Sello, SelloActividad } from '~/components/base'
import { Encabezado } from '~/components/cascaron'
import { EstadoError, EstadoVacio, ManifiestoCargando } from '~/components/estados'
import { Vinculo } from '~/components/ficha'
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
import { SIN_DATO, entero } from '~/lib/formato'
import {
  DIRECCIONES,
  TAMANOS,
  booleano,
  entero as enteroParametro,
  limpiarBusqueda,
  lista,
  tamanoDePagina,
  texto,
  unoDe,
} from '~/lib/parametros'
import { ORDENES, listarServicios, type BusquedaServicios } from '~/server/servicios'

/* Anchos del esqueleto: el mismo reparto que las ocho columnas del manifiesto. */
const COLUMNAS_CARGANDO = [9, 7, 24, 16, 15, 8, 7, 11]

const POR_OMISION: BusquedaServicios = {
  q: '',
  pagina: 1,
  porPagina: 25,
  orden: 'clave',
  dir: 'asc',
  empresa: [],
  estatus: [],
  anticipado: [],
  bajas: false,
}

const OPCIONES_ESTATUS = [
  { valor: 'activa', etiqueta: 'Activo' },
  { valor: 'inactiva', etiqueta: 'Inactivo' },
]

const OPCIONES_ANTICIPADO = [
  { valor: 'si', etiqueta: 'Permitido' },
  { valor: 'no', etiqueta: 'No permitido' },
]

const OPCIONES_BAJAS = [{ valor: 'incluir', etiqueta: 'Incluir servicios dados de baja' }]

/** Repone los valores por omisión que no viajan en la URL. */
function completar(s: Partial<BusquedaServicios>): BusquedaServicios {
  return { ...POR_OMISION, ...s }
}

export const Route = createFileRoute('/servicios/')({
  // Sólo viaja en la URL lo que el usuario cambió; `completar` repone el resto.
  validateSearch: (entrada: Record<string, unknown>): Partial<BusquedaServicios> =>
    limpiarBusqueda(
      {
        q: texto(entrada.q),
        pagina: enteroParametro(entrada.pagina, 1, 1),
        porPagina: tamanoDePagina(entrada.porPagina),
        orden: unoDe(entrada.orden, ORDENES, 'clave'),
        dir: unoDe(entrada.dir, DIRECCIONES, 'asc'),
        empresa: lista(entrada.empresa),
        estatus: lista(entrada.estatus),
        anticipado: lista(entrada.anticipado),
        bajas: booleano(entrada.bajas),
      },
      POR_OMISION,
    ),
  loaderDeps: ({ search }) => completar(search),
  loader: ({ deps }) => listarServicios({ data: deps }),
  component: Pantalla,
  pendingComponent: () => (
    <>
      <Encabezado titulo="Servicios" renglon="Leyendo el catálogo…" />
      <div className="px-4 sm:px-8 py-6">
        <Hoja className="overflow-hidden py-2">
          <ManifiestoCargando columnas={COLUMNAS_CARGANDO} />
        </Hoja>
      </div>
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <>
      <Encabezado titulo="Servicios" renglon={SIN_DATO} />
      <EstadoError
        titulo="No fue posible leer el catálogo de servicios"
        detalle={error instanceof Error ? error.message : String(error)}
        alReintentar={reset}
      />
    </>
  ),
})

/** `limpiarBusqueda` devuelve sólo lo que el usuario cambió; `validateSearch`
 *  repone los valores por omisión al leer la URL, así que el recorte es seguro. */
function limpio(busqueda: BusquedaServicios): Partial<BusquedaServicios> {
  return limpiarBusqueda(busqueda, POR_OMISION)
}

function Pantalla() {
  const datos = Route.useLoaderData()
  const busqueda = completar(Route.useSearch())
  const navigate = Route.useNavigate()

  /* Todo cambio de filtro o búsqueda devuelve el manifiesto a la primera hoja;
     quien mueve la paginación manda `pagina` explícita y gana. */
  const actualizar = useCallback(
    (cambio: Partial<BusquedaServicios>) => {
      navigate({
        search: (previa) => limpio({ ...completar(previa), pagina: 1, ...cambio }),
        replace: true,
      })
    },
    [navigate],
  )

  const alBuscar = useCallback((q: string) => actualizar({ q }), [actualizar])

  if (!datos.ok) {
    return (
      <>
        <Encabezado titulo="Servicios" renglon={SIN_DATO} />
        <EstadoError {...datos.falla} />
      </>
    )
  }

  const { filas, total, totalCatalogo, pagina, empresas } = datos

  const hayFiltros =
    busqueda.q.trim().length > 0 ||
    busqueda.empresa.length > 0 ||
    busqueda.estatus.length > 0 ||
    busqueda.anticipado.length > 0 ||
    busqueda.bajas

  const renglon =
    total === totalCatalogo
      ? `${entero(total)} servicios`
      : `${entero(total)} de ${entero(totalCatalogo)} servicios`

  function alOrdenar(campo: string) {
    actualizar({
      orden: campo as BusquedaServicios['orden'],
      dir: busqueda.orden === campo && busqueda.dir === 'asc' ? 'desc' : 'asc',
    })
  }

  return (
    <>
      <Encabezado
        acciones={<BotonActualizar />}
        titulo="Servicios"
        renglon={
          <>
            {renglon}
            {busqueda.bajas ? <span className="text-tinta-4"> · con bajas</span> : null}
          </>
        }
      />

      <div className="px-4 sm:px-8 py-6">
        <Hoja className="overflow-hidden">
          <BarraDeFiltros
            hayFiltros={hayFiltros}
            alLimpiar={() =>
              navigate({
                search: () => limpio({ ...POR_OMISION, porPagina: busqueda.porPagina }),
                replace: true,
              })
            }
          >
            <Buscador
              className="w-full max-w-[19rem]"
              valor={busqueda.q}
              alCambiar={alBuscar}
              marcador="Buscar clave, número o nombre…"
            />
            <FiltroLista
              nombre="Empresa"
              buscable
              opciones={empresas}
              seleccion={busqueda.empresa}
              alCambiar={(empresa) => actualizar({ empresa })}
            />
            <FiltroLista
              nombre="Estatus"
              opciones={OPCIONES_ESTATUS}
              seleccion={busqueda.estatus}
              alCambiar={(estatus) => actualizar({ estatus })}
            />
            <FiltroLista
              nombre="Despacho anticipado"
              opciones={OPCIONES_ANTICIPADO}
              seleccion={busqueda.anticipado}
              alCambiar={(anticipado) => actualizar({ anticipado })}
            />
            <FiltroLista
              nombre="Bajas"
              opciones={OPCIONES_BAJAS}
              seleccion={busqueda.bajas ? ['incluir'] : []}
              alCambiar={(seleccion) => actualizar({ bajas: seleccion.includes('incluir') })}
            />
          </BarraDeFiltros>

          {filas.length === 0 ? (
            totalCatalogo === 0 && !hayFiltros ? (
              <EstadoVacio
                titulo="El catálogo de servicios está vacío"
                detalle="La base conectada no tiene servicios migrados. Confirma que DATABASE_URL apunta a la base correcta."
              />
            ) : (
              <EstadoVacio
                titulo="Ningún servicio coincide con los filtros"
                detalle="Ajusta la búsqueda o retira algún filtro para volver a ver el catálogo completo."
                accion={
                  hayFiltros ? (
                    <button
                      type="button"
                      onClick={() =>
                        navigate({
                          search: () => limpio({ ...POR_OMISION, porPagina: busqueda.porPagina }),
                          replace: true,
                        })
                      }
                      className="inline-flex h-8 items-center rounded-chip border border-raya px-3 font-mono text-nota font-medium tracking-[0.08em] text-tinta-2 uppercase transition-[colors,transform] duration-100 hover:border-raya-firme hover:bg-renglon hover:text-tinta active:scale-[0.97]"
                    >
                      Limpiar filtros
                    </button>
                  ) : null
                }
              />
            )
          ) : (
            <Manifiesto etiqueta="Servicios migrados">
              <Cabecera>
                <ThOrden
                  campo="clave"
                  ordenActual={busqueda.orden}
                  direccion={busqueda.dir}
                  alOrdenar={alOrdenar}
                >
                  Clave servicio
                </ThOrden>
                <ThOrden
                  campo="numero"
                  numerica
                  ordenActual={busqueda.orden}
                  direccion={busqueda.dir}
                  alOrdenar={alOrdenar}
                >
                  No. servicio
                </ThOrden>
                <ThOrden
                  campo="nombre"
                  ordenActual={busqueda.orden}
                  direccion={busqueda.dir}
                  alOrdenar={alOrdenar}
                >
                  Nombre del servicio
                </ThOrden>
                <Th>Nombre corto</Th>
                <ThOrden
                  campo="empresa"
                  ordenActual={busqueda.orden}
                  direccion={busqueda.dir}
                  alOrdenar={alOrdenar}
                >
                  Empresa
                </ThOrden>
                <Th numerica>Terminales</Th>
                <ThOrden
                  campo="rutas"
                  numerica
                  ordenActual={busqueda.orden}
                  direccion={busqueda.dir}
                  alOrdenar={alOrdenar}
                >
                  Rutas
                </ThOrden>
                <Th>Estatus</Th>
              </Cabecera>

              <Cuerpo>
                {filas.map((s) => (
                  <Fila key={s.id} atenuada={s.eliminado}>
                    <Td>
                      <EnlaceDeFila to="/servicios/$id" params={{ id: s.id }}>
                        <Clave enfasis>{s.clave || SIN_DATO}</Clave>
                      </EnlaceDeFila>
                    </Td>
                    <Td numerica className="text-tinta-2">
                      {s.numero || SIN_DATO}
                    </Td>
                    <Td>
                      <span className="block max-w-[26rem] truncate" title={s.nombre}>
                        {s.nombre || SIN_DATO}
                      </span>
                    </Td>
                    <Td className="text-tinta-2">{s.nombreCorto || SIN_DATO}</Td>
                    <Td>
                      <Vinculo
                        to="/empresas/$id"
                        params={{ id: s.empresaId }}
                        className="relative z-10"
                      >
                        {s.empresaNombre || s.empresaClave || SIN_DATO}
                      </Vinculo>
                    </Td>
                    <Td numerica>
                      <span className={s.terminales === 0 ? 'text-tinta-4' : undefined}>
                        {entero(s.terminales)}
                      </span>
                    </Td>
                    <Td numerica>
                      <span className={s.rutas === 0 ? 'text-tinta-4' : undefined}>
                        {entero(s.rutas)}
                      </span>
                    </Td>
                    <Td>
                      <span className="flex items-center gap-2">
                        <SelloActividad activa={s.activo} eliminada={s.eliminado} />
                        {s.hcmDesactivado ? (
                          <Sello
                            tono="aviso"
                            titulo="hcmDisabled — la sincronización HCM lo marcó como inhabilitado"
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

          <Paginacion
            pagina={pagina}
            porPagina={busqueda.porPagina}
            total={total}
            tamanos={[...TAMANOS]}
            sustantivo="servicios"
            alCambiarPagina={(p) => actualizar({ pagina: p })}
            alCambiarTamano={(t) => actualizar({ porPagina: t })}
          />
        </Hoja>
      </div>
    </>
  )
}
