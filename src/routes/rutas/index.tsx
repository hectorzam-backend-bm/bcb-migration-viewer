import { createFileRoute } from '@tanstack/react-router'
import { Clave, Hoja, Marca, SelloActividad } from '~/components/base'
import { Encabezado } from '~/components/cascaron'
import { EstadoError, EstadoVacio, ManifiestoCargando } from '~/components/estados'
import { Pestana, Pestanas, Vinculo } from '~/components/ficha'
import type { Opcion } from '~/components/filtros'
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
import {
  SIN_DATO,
  TIPO_RECAUDACION,
  entero,
  kilometros,
  minutos,
  moneda,
} from '~/lib/formato'
import {
  DIRECCIONES,
  TAMANOS,
  booleano,
  limpiarBusqueda,
  lista,
  entero as enteroDeUrl,
  tamanoDePagina,
  texto,
  unoDe,
} from '~/lib/parametros'
import type { BusquedaRutas, FilaRuta, FilaTramo, Vista } from '~/server/rutas'
import { listarRutas } from '~/server/rutas'

const VISTAS = ['rutas', 'tramos'] as const

const ORDENES = [
  'numero',
  'nombre',
  'servicio',
  'empresa',
  'tramos',
  'tarifa',
  'tiempo',
  'distancia',
  'estatus',
  'ruta',
  'origen',
  'destino',
  'estancia',
  'duracion',
  'tarifaRedonda',
  'venta',
  'principal',
] as const

function ordenPorOmision(vista: Vista) {
  return vista === 'tramos' ? 'ruta' : 'numero'
}

function porOmision(vista: Vista): BusquedaRutas {
  return {
    vista: 'rutas',
    q: '',
    pagina: 1,
    porPagina: TAMANOS[0],
    orden: ordenPorOmision(vista),
    dir: 'asc',
    empresa: [],
    servicio: [],
    recaudacion: [],
    iva: [],
    asientos: [],
    estatus: [],
    ruta: [],
    principal: [],
    venta: [],
    bajas: false,
  }
}

/** Repone los valores por omisión de la pestaña que no viajan en la URL. */
function completar(s: Partial<BusquedaRutas>): BusquedaRutas {
  const vista = s.vista ?? 'rutas'
  return { ...porOmision(vista), ...s, vista }
}

export const Route = createFileRoute('/rutas/')({
  // Sólo viaja en la URL lo que el usuario cambió; `completar` repone el resto.
  // Los valores por omisión dependen de la pestaña (cada vista ordena distinto),
  // por eso el recorte se hace contra `porOmision(vista)` y no contra una constante.
  validateSearch: (entrada: Record<string, unknown>): Partial<BusquedaRutas> => {
    const vista = unoDe(entrada.vista, VISTAS, 'rutas')
    const completa: BusquedaRutas = {
      vista,
      q: texto(entrada.q),
      pagina: enteroDeUrl(entrada.pagina, 1, 1),
      porPagina: tamanoDePagina(entrada.porPagina),
      orden: unoDe(entrada.orden, ORDENES, ordenPorOmision(vista)),
      dir: unoDe(entrada.dir, DIRECCIONES, 'asc'),
      empresa: lista(entrada.empresa),
      servicio: lista(entrada.servicio),
      recaudacion: lista(entrada.recaudacion),
      iva: lista(entrada.iva),
      asientos: lista(entrada.asientos),
      estatus: lista(entrada.estatus),
      ruta: lista(entrada.ruta),
      principal: lista(entrada.principal),
      venta: lista(entrada.venta),
      bajas: booleano(entrada.bajas),
    }
    return limpiarBusqueda(completa, porOmision(vista))
  },
  loaderDeps: ({ search }) => completar(search),
  loader: ({ deps }) => listarRutas({ data: deps }),
  component: Pantalla,
  pendingComponent: () => (
    <>
      <Encabezado titulo="Rutas y tramos" renglon="Cargando…" />
      <div className="px-4 sm:px-8 py-6">
        <Hoja className="py-2">
          <ManifiestoCargando columnas={[6, 20, 10, 10, 18, 6, 10, 8]} />
        </Hoja>
      </div>
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <EstadoError
      titulo="No fue posible leer las rutas"
      detalle={error instanceof Error ? error.message : String(error)}
      alReintentar={reset}
    />
  ),
})

/* ── Controles ──────────────────────────────────────────────────────────── */

const SI_NO: Array<Opcion> = [
  { valor: 'si', etiqueta: 'Sí' },
  { valor: 'no', etiqueta: 'No' },
]

const ESTATUS: Array<Opcion> = [
  { valor: 'activa', etiqueta: 'Activa' },
  { valor: 'inactiva', etiqueta: 'Inactiva' },
]

const RECAUDACION: Array<Opcion> = Object.entries(TIPO_RECAUDACION).map(
  ([valor, etiqueta]) => ({ valor, etiqueta }),
)

/**
 * Filtro de una sola pieza: no es un interruptor de datos, es un modificador de
 * la consulta. Se dibuja como las demás pastillas de la barra para que la zona
 * de control lea como una sola familia.
 */
function Alternador({
  nombre,
  encendido,
  alCambiar,
  titulo,
}: {
  nombre: string
  encendido: boolean
  alCambiar: (encendido: boolean) => void
  titulo?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={encendido}
      title={titulo}
      onClick={() => alCambiar(!encendido)}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-chip border px-3 text-lectura',
        'transition-[colors,transform] duration-100 active:scale-[0.98]',
        encendido
          ? 'border-sello/40 bg-sello-lavado font-medium text-tinta'
          : 'border-raya border-dashed bg-transparent text-tinta-2 hover:border-raya-firme hover:border-solid hover:bg-renglon',
      )}
    >
      {nombre}
    </button>
  )
}

/** Par de terminales con la flecha del manifiesto entre ellas. */
function Trayecto({
  origen,
  destino,
}: {
  origen: { id: string; clave: string; nombre: string }
  destino: { id: string; clave: string; nombre: string }
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap"
      title={`${origen.nombre} → ${destino.nombre}`}
    >
      <Vinculo to="/terminales/$id" params={{ id: origen.id }} className="relative">
        <Clave>{origen.clave}</Clave>
      </Vinculo>
      <span aria-hidden className="text-tinta-4">
        →
      </span>
      <Vinculo to="/terminales/$id" params={{ id: destino.id }} className="relative">
        <Clave>{destino.clave}</Clave>
      </Vinculo>
    </span>
  )
}

function Si({ valor }: { valor: boolean }) {
  return (
    <span className={cn('font-mono text-dato', valor ? 'text-tinta-2' : 'text-tinta-4')}>
      {valor ? 'Sí' : 'No'}
    </span>
  )
}

/* ── Pantalla ───────────────────────────────────────────────────────────── */

function Pantalla() {
  const datos = Route.useLoaderData()
  const busqueda = completar(Route.useSearch())
  const navigate = Route.useNavigate()
  const { vista } = busqueda

  function irA(cambio: Partial<BusquedaRutas>) {
    navigate({
      search: (previo) => {
        const siguiente = { ...completar(previo), ...cambio }
        return limpiarBusqueda(siguiente, porOmision(siguiente.vista))
      },
      replace: true,
    })
  }

  function ordenar(campo: string) {
    irA({
      orden: campo,
      dir: busqueda.orden === campo && busqueda.dir === 'asc' ? 'desc' : 'asc',
      pagina: 1,
    })
  }

  function cambiarVista(valor: string) {
    const nueva = unoDe(valor, VISTAS, 'rutas')
    if (nueva === vista) return
    irA({
      vista: nueva,
      pagina: 1,
      orden: ordenPorOmision(nueva),
      dir: 'asc',
      // Los filtros propios de la otra pestaña no aplican aquí.
      ...(nueva === 'rutas'
        ? { ruta: [], principal: [], venta: [] }
        : { recaudacion: [], iva: [], asientos: [] }),
    })
  }

  if (!datos.ok) {
    return (
      <>
        <Encabezado titulo="Rutas y tramos" renglon={SIN_DATO} />
        <EstadoError {...datos.falla} />
      </>
    )
  }

  const { conteos, opciones, total } = datos
  const sustantivo = vista === 'rutas' ? 'rutas' : 'tramos'
  const enCatalogo = vista === 'rutas' ? conteos.rutas : conteos.tramos

  const hayFiltros =
    busqueda.q.trim().length > 0 ||
    busqueda.empresa.length > 0 ||
    busqueda.servicio.length > 0 ||
    busqueda.estatus.length > 0 ||
    busqueda.bajas ||
    (vista === 'rutas'
      ? busqueda.recaudacion.length > 0 ||
        busqueda.iva.length > 0 ||
        busqueda.asientos.length > 0
      : busqueda.ruta.length > 0 ||
        busqueda.principal.length > 0 ||
        busqueda.venta.length > 0)

  function limpiar() {
    irA({
      q: '',
      pagina: 1,
      empresa: [],
      servicio: [],
      recaudacion: [],
      iva: [],
      asientos: [],
      estatus: [],
      ruta: [],
      principal: [],
      venta: [],
      bajas: false,
    })
  }

  const vacio =
    total === 0 ? (
      hayFiltros ? (
        <EstadoVacio
          titulo={`Ningún registro coincide`}
          detalle={`No hay ${sustantivo} que cumplan con la búsqueda y los filtros de esta hoja.`}
          accion={
            <button
              type="button"
              onClick={limpiar}
              className="inline-flex h-8 items-center rounded-chip border border-raya px-3 font-mono text-nota font-medium tracking-[0.08em] text-tinta-2 uppercase transition-[colors,transform] duration-100 hover:border-raya-firme hover:bg-renglon hover:text-tinta active:scale-[0.97]"
            >
              Limpiar filtros
            </button>
          }
        />
      ) : (
        <EstadoVacio
          titulo={
            vista === 'rutas'
              ? 'El catálogo de rutas está vacío'
              : 'No hay tramos registrados'
          }
          detalle={
            vista === 'rutas'
              ? 'La base conectada no tiene ninguna ruta migrada todavía.'
              : 'Ninguna ruta de la base conectada tiene tramos migrados todavía.'
          }
        />
      )
    ) : null

  return (
    <>
      <Encabezado
        acciones={<BotonActualizar />}
        titulo="Rutas y tramos"
        renglon={
          hayFiltros
            ? `${entero(total)} de ${entero(enCatalogo)} ${sustantivo}`
            : `${entero(enCatalogo)} ${sustantivo} en el catálogo`
        }
      />

      <div className="px-4 sm:px-8 py-6">
        <Hoja className="overflow-hidden">
          <Pestanas
            valor={vista}
            alCambiar={cambiarVista}
            opciones={[
              { valor: 'rutas', rotulo: 'Rutas', conteo: conteos.rutas },
              { valor: 'tramos', rotulo: 'Tramos', conteo: conteos.tramos },
            ]}
          >
            <Pestana valor={vista}>
              <BarraDeFiltros hayFiltros={hayFiltros} alLimpiar={limpiar}>
                <Buscador
                  className="w-full max-w-72"
                  valor={busqueda.q}
                  marcador={
                    vista === 'rutas'
                      ? 'Buscar por número o nombre de ruta…'
                      : 'Buscar por número de tramo o terminal…'
                  }
                  alCambiar={(q) => irA({ q, pagina: 1 })}
                />

                <FiltroLista
                  nombre="Empresa"
                  opciones={opciones.empresas}
                  seleccion={busqueda.empresa}
                  alCambiar={(empresa) => irA({ empresa, pagina: 1 })}
                />
                <FiltroLista
                  nombre="Servicio"
                  opciones={opciones.servicios}
                  seleccion={busqueda.servicio}
                  alCambiar={(servicio) => irA({ servicio, pagina: 1 })}
                />

                {vista === 'rutas' ? (
                  <>
                    <FiltroLista
                      nombre="Recaudación"
                      opciones={RECAUDACION}
                      seleccion={busqueda.recaudacion}
                      alCambiar={(recaudacion) => irA({ recaudacion, pagina: 1 })}
                    />
                    <FiltroLista
                      nombre="Aplica IVA"
                      opciones={SI_NO}
                      seleccion={busqueda.iva}
                      alCambiar={(iva) => irA({ iva, pagina: 1 })}
                    />
                    <FiltroLista
                      nombre="Selección de asientos"
                      opciones={SI_NO}
                      seleccion={busqueda.asientos}
                      alCambiar={(asientos) => irA({ asientos, pagina: 1 })}
                    />
                  </>
                ) : (
                  <>
                    <FiltroLista
                      nombre="Ruta"
                      opciones={opciones.rutas}
                      seleccion={busqueda.ruta}
                      alCambiar={(ruta) => irA({ ruta, pagina: 1 })}
                      buscable
                    />
                    <FiltroLista
                      nombre="Principal"
                      opciones={SI_NO}
                      seleccion={busqueda.principal}
                      alCambiar={(principal) => irA({ principal, pagina: 1 })}
                    />
                    <FiltroLista
                      nombre="Permitir venta"
                      opciones={SI_NO}
                      seleccion={busqueda.venta}
                      alCambiar={(venta) => irA({ venta, pagina: 1 })}
                    />
                  </>
                )}

                <FiltroLista
                  nombre="Estatus"
                  opciones={ESTATUS}
                  seleccion={busqueda.estatus}
                  alCambiar={(estatus) => irA({ estatus, pagina: 1 })}
                />
                <Alternador
                  nombre="Incluir bajas"
                  encendido={busqueda.bajas}
                  titulo="Muestra también los registros con borrado lógico (deletedAt)"
                  alCambiar={(bajas) => irA({ bajas, pagina: 1 })}
                />
              </BarraDeFiltros>

              {vacio ??
                (datos.vista === 'rutas' ? (
                  <TablaRutas
                    filas={datos.filas}
                    orden={busqueda.orden}
                    dir={busqueda.dir}
                    alOrdenar={ordenar}
                  />
                ) : (
                  <TablaTramos
                    filas={datos.filas}
                    orden={busqueda.orden}
                    dir={busqueda.dir}
                    alOrdenar={ordenar}
                  />
                ))}

              <Paginacion
                pagina={busqueda.pagina}
                porPagina={busqueda.porPagina}
                total={total}
                sustantivo={sustantivo}
                tamanos={[...TAMANOS]}
                alCambiarPagina={(pagina) => irA({ pagina })}
                alCambiarTamano={(porPagina) => irA({ porPagina, pagina: 1 })}
              />
            </Pestana>
          </Pestanas>
        </Hoja>
      </div>
    </>
  )
}

/* ── Manifiesto de rutas ────────────────────────────────────────────────── */

type PropsOrden = {
  orden: string
  dir: 'asc' | 'desc'
  alOrdenar: (campo: string) => void
}

function TablaRutas({ filas, orden, dir, alOrdenar }: PropsOrden & { filas: Array<FilaRuta> }) {
  const comun = { ordenActual: orden, direccion: dir, alOrdenar }
  return (
    <Manifiesto etiqueta="Rutas">
      <Cabecera>
        <ThOrden campo="numero" {...comun}>
          No.
        </ThOrden>
        <ThOrden campo="nombre" {...comun}>
          Nombre
        </ThOrden>
        <ThOrden campo="servicio" {...comun}>
          Servicio
        </ThOrden>
        <ThOrden campo="empresa" {...comun}>
          Empresa
        </ThOrden>
        <Th>Origen → Destino</Th>
        <ThOrden campo="tramos" numerica {...comun}>
          Tramos
        </ThOrden>
        <ThOrden campo="tarifa" numerica {...comun}>
          Tarifa sencilla
        </ThOrden>
        <ThOrden campo="tiempo" numerica {...comun}>
          Tiempo
        </ThOrden>
        <ThOrden campo="distancia" numerica {...comun}>
          Distancia
        </ThOrden>
        <ThOrden campo="estatus" {...comun}>
          Estatus
        </ThOrden>
      </Cabecera>
      <Cuerpo>
        {filas.map((f) => (
          <Fila key={f.id} atenuada={f.eliminada}>
            <Td>
              <EnlaceDeFila to="/rutas/$id" params={{ id: f.id }}>
                <Clave enfasis>{f.numero}</Clave>
              </EnlaceDeFila>
            </Td>
            <Td className="max-w-[24rem] truncate text-tinta">{f.nombre}</Td>
            <Td>
              <Vinculo
                to="/servicios/$id"
                params={{ id: f.servicio.id }}
                className="relative text-lectura text-tinta-2"
              >
                {f.servicio.etiqueta}
              </Vinculo>
            </Td>
            <Td>
              <Vinculo
                to="/empresas/$id"
                params={{ id: f.empresa.id }}
                className="relative text-lectura text-tinta-2"
              >
                {f.empresa.etiqueta}
              </Vinculo>
            </Td>
            <Td>
              <Trayecto origen={f.origen} destino={f.destino} />
            </Td>
            <Td numerica className={f.tramos === 0 ? 'text-ambar' : undefined}>
              {entero(f.tramos)}
            </Td>
            <Td numerica>{moneda(f.tarifaSencilla)}</Td>
            <Td numerica className="text-tinta-2">
              {minutos(f.tiempoMinutos)}
            </Td>
            <Td numerica className="text-tinta-2">
              {kilometros(f.distanciaKm)}
            </Td>
            <Td>
              <SelloActividad activa={f.activa} eliminada={f.eliminada} />
            </Td>
          </Fila>
        ))}
      </Cuerpo>
    </Manifiesto>
  )
}

/* ── Manifiesto plano de tramos ─────────────────────────────────────────── */

function TablaTramos({ filas, orden, dir, alOrdenar }: PropsOrden & { filas: Array<FilaTramo> }) {
  const comun = { ordenActual: orden, direccion: dir, alOrdenar }
  return (
    <Manifiesto etiqueta="Tramos">
      <Cabecera>
        <ThOrden campo="numero" {...comun}>
          No.
        </ThOrden>
        <ThOrden campo="ruta" {...comun}>
          Ruta
        </ThOrden>
        <Th>Origen → Destino</Th>
        <ThOrden campo="estancia" numerica {...comun}>
          Estancia
        </ThOrden>
        <ThOrden campo="duracion" numerica {...comun}>
          Duración
        </ThOrden>
        <ThOrden campo="distancia" numerica {...comun}>
          Distancia
        </ThOrden>
        <ThOrden campo="venta" {...comun}>
          Venta
        </ThOrden>
        <ThOrden campo="tarifa" numerica {...comun}>
          Tarifa sencilla
        </ThOrden>
        <ThOrden campo="tarifaRedonda" numerica {...comun}>
          Tarifa redonda
        </ThOrden>
        <ThOrden campo="principal" {...comun}>
          Principal
        </ThOrden>
        <ThOrden campo="estatus" {...comun}>
          Estatus
        </ThOrden>
      </Cabecera>
      <Cuerpo>
        {filas.map((f) => (
          <Fila key={f.id} destacada={f.principal} atenuada={f.eliminada || !f.activa}>
            <Td>
              <Clave enfasis>{f.numero}</Clave>
            </Td>
            <Td className="max-w-[22rem]">
              <EnlaceDeFila to="/rutas/$id" params={{ id: f.ruta.id }}>
                <span className="inline-flex items-baseline gap-2">
                  <Clave enfasis>{f.ruta.numero}</Clave>
                  <span className="truncate text-lectura text-tinta-2">{f.ruta.nombre}</span>
                </span>
              </EnlaceDeFila>
            </Td>
            <Td>
              <Trayecto origen={f.origen} destino={f.destino} />
            </Td>
            <Td numerica className="text-tinta-2">
              {minutos(f.estanciaMinutos)}
            </Td>
            <Td numerica className="text-tinta-2">
              {minutos(f.duracionMinutos)}
            </Td>
            <Td numerica className="text-tinta-2">
              {kilometros(f.distanciaKm)}
            </Td>
            <Td>
              <Si valor={f.permiteVenta} />
            </Td>
            <Td numerica>{moneda(f.tarifaSencilla)}</Td>
            <Td numerica className="text-tinta-2">
              {moneda(f.tarifaRedonda)}
            </Td>
            <Td>{f.principal ? <Marca /> : <span className="text-tinta-4">{SIN_DATO}</span>}</Td>
            <Td>
              <SelloActividad activa={f.activa} eliminada={f.eliminada} />
            </Td>
          </Fila>
        ))}
      </Cuerpo>
    </Manifiesto>
  )
}
