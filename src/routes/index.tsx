import { createFileRoute, useRouter } from '@tanstack/react-router'
import type { LinkProps } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { Cifra, Clave, Hoja, Rotulo, Sello } from '~/components/base'
import { Encabezado } from '~/components/cascaron'
import { EstadoError, ManifiestoCargando } from '~/components/estados'
import { Bloque, Vinculo } from '~/components/ficha'
import { Cabecera, Cuerpo, EnlaceDeFila, Fila, Manifiesto, Td, Th } from '~/components/tabla'
import { BotonActualizar } from '~/components/actualizar'
import { cn } from '~/lib/cn'
import { entero, fechaHora } from '~/lib/formato'
import { obtenerResumen, type ClaveCatalogo, type ClaveRevision } from '~/server/resumen'

/* ───────────────────────────────────────────────────────────────────────────
   La portada del visor. Es la única pantalla con un punto focal grande: el
   resto del visor son manifiestos. Responde a la pregunta con la que llega el
   analista —¿puedo confiar en esta migración?— antes de que abra un catálogo.
   ─────────────────────────────────────────────────────────────────────────── */

type Catalogo = {
  clave: ClaveCatalogo
  rotulo: string
  a: LinkProps['to']
  /** Lo que hay que añadir a la dirección para llegar a ESTE listado. */
  busqueda?: Record<string, unknown>
  inactivos: string
  bajas: string
}

const CATALOGOS: ReadonlyArray<Catalogo> = [
  {
    clave: 'empresas',
    rotulo: 'Empresas',
    a: '/empresas',
    inactivos: 'inactivas',
    bajas: 'dadas de baja',
  },
  {
    clave: 'servicios',
    rotulo: 'Servicios',
    a: '/servicios',
    inactivos: 'inactivos',
    bajas: 'dados de baja',
  },
  {
    clave: 'terminales',
    rotulo: 'Terminales',
    a: '/terminales',
    inactivos: 'inactivas',
    bajas: 'dadas de baja',
  },
  {
    clave: 'rutas',
    rotulo: 'Rutas',
    a: '/rutas',
    busqueda: { vista: 'rutas' },
    inactivos: 'inactivas',
    bajas: 'dadas de baja',
  },
  {
    clave: 'tramos',
    rotulo: 'Tramos',
    a: '/rutas',
    busqueda: { vista: 'tramos' },
    inactivos: 'inactivos',
    bajas: 'dados de baja',
  },
]

type Revision = {
  clave: ClaveRevision
  titulo: string
  explicacion: string
  catalogo: string
  a: LinkProps['to']
  busqueda?: Record<string, unknown>
}

/* El orden de esta lista es el de captura; la pantalla la reordena para que lo
   anómalo quede arriba. Ninguna revisión enlaza a un listado filtrado: hoy
   ningún filtro expresa estas preguntas, y un enlace que no filtra miente. */
const REVISIONES: ReadonlyArray<Revision> = [
  {
    clave: 'rutasSinTramoPrincipal',
    titulo: 'Rutas activas sin tramo principal',
    explicacion:
      'Toda ruta activa debería tener un tramo marcado como principal: el que cubre su origen y su destino. Sin él la ruta no se puede vender completa.',
    catalogo: 'Rutas',
    a: '/rutas',
    busqueda: { vista: 'rutas' },
  },
  {
    clave: 'rutasSinTramos',
    titulo: 'Rutas sin ningún tramo',
    explicacion:
      'La ruta migró, pero no trae tramos vigentes colgando de ella. Quedó como cascarón.',
    catalogo: 'Rutas',
    a: '/rutas',
    busqueda: { vista: 'rutas' },
  },
  {
    clave: 'tramosEnCirculo',
    titulo: 'Tramos que salen y llegan a la misma terminal',
    explicacion:
      'El origen y el destino del tramo apuntan a la misma terminal: casi siempre es un error de captura arrastrado desde el sistema anterior.',
    catalogo: 'Tramos',
    a: '/rutas',
    busqueda: { vista: 'tramos' },
  },
  {
    clave: 'serviciosSinRutas',
    titulo: 'Servicios sin rutas',
    explicacion: 'El servicio no tiene ninguna ruta vigente asignada, así que no opera nada.',
    catalogo: 'Servicios',
    a: '/servicios',
  },
  {
    clave: 'serviciosSinTerminales',
    titulo: 'Servicios sin terminales',
    explicacion:
      'El servicio no está asociado a ninguna terminal vigente: no tiene dónde vender ni despachar.',
    catalogo: 'Servicios',
    a: '/servicios',
  },
  {
    clave: 'terminalesSinServicios',
    titulo: 'Terminales sin servicios',
    explicacion:
      'La terminal existe pero ningún servicio vigente la usa. Puede ser correcto en una terminal recién dada de alta.',
    catalogo: 'Terminales',
    a: '/terminales',
  },
  {
    clave: 'empresasSinServicios',
    titulo: 'Empresas sin servicios',
    explicacion: 'La empresa migró sin ningún servicio vigente bajo ella.',
    catalogo: 'Empresas',
    a: '/empresas',
  },
  {
    clave: 'rutasSinCanales',
    titulo: 'Rutas sin canales de venta',
    explicacion:
      'Sin al menos un canal asociado, la ruta no aparece en ningún punto de venta: ni taquilla, ni web, ni app.',
    catalogo: 'Rutas',
    a: '/rutas',
    busqueda: { vista: 'rutas' },
  },
  {
    clave: 'rutasSinTiposDePasajero',
    titulo: 'Rutas sin tipos de pasajero',
    explicacion:
      'Sin tipos de pasajero no hay tarifa que cotizar: no se puede emitir un boleto de esa ruta.',
    catalogo: 'Rutas',
    a: '/rutas',
    busqueda: { vista: 'rutas' },
  },
]

const FILAS_HCM = [
  { clave: 'empresas', rotulo: 'Empresas', a: '/empresas', filtrable: true },
  { clave: 'servicios', rotulo: 'Servicios', a: '/servicios', filtrable: false },
] as const

const COLUMNAS_CARGANDO = [38, 12, 10, 10]

export const Route = createFileRoute('/')({
  loader: () => obtenerResumen(),
  component: Portada,
  pendingComponent: () => (
    <>
      <Encabezado titulo="Resumen" renglon="Contando registros…" />
      <div className="px-4 py-6">
        <ManifiestoCargando columnas={COLUMNAS_CARGANDO} renglones={9} />
      </div>
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <>
      <Encabezado titulo="Resumen" renglon="Estado de la migración" />
      <EstadoError
        titulo="No fue posible construir el resumen"
        detalle={error instanceof Error ? error.message : String(error)}
        sugerencia="Vuelve a intentarlo; si persiste, revisa la conexión a la base de datos."
        alReintentar={reset}
      />
    </>
  ),
})

function Portada() {
  const datos = Route.useLoaderData()
  const router = useRouter()

  // Si la base no respondió, la portada entera cae al error: pintar tarjetas en
  // cero diría que la migración está vacía, que es una mentira distinta.
  if (!datos.ok) {
    return (
      <>
        <Encabezado titulo="Resumen" renglon="Estado de la migración" />
        <EstadoError {...datos.falla} alReintentar={() => router.invalidate()} />
      </>
    )
  }

  const { catalogos, revisiones, hcm, generadoEn } = datos

  const totalVigentes = CATALOGOS.reduce((suma, c) => suma + catalogos[c.clave].vigentes, 0)
  const totalInactivos = CATALOGOS.reduce((suma, c) => suma + catalogos[c.clave].inactivos, 0)
  const totalBajas = CATALOGOS.reduce((suma, c) => suma + catalogos[c.clave].bajas, 0)

  // Lo anómalo arriba: primero lo que tiene hallazgos, de mayor a menor.
  const filas = REVISIONES.map((r) => ({ ...r, conteo: revisiones[r.clave] })).sort(
    (a, b) => b.conteo - a.conteo,
  )
  const conHallazgos = filas.filter((r) => r.conteo > 0).length
  const mayor = filas[0]

  return (
    <>
      <Encabezado
        acciones={<BotonActualizar mostrarSello={false} />}
        titulo="Resumen"
        renglon={`Estado de la migración · consultado el ${fechaHora(generadoEn)}`}
      />

      <div className="px-4 sm:px-8 pt-6 pb-14">
        {/* ── Punto focal ─────────────────────────────────────────────── */}
        <Hoja className="grid sm:grid-cols-[1.1fr_1fr]">
          <div className="p-5">
            <Rotulo>Registros vigentes</Rotulo>
            <p
              data-cifra
              className="mt-2 font-mono text-portada leading-none font-medium tracking-[-0.015em] text-tinta"
            >
              {entero(totalVigentes)}
            </p>
            <p className="mt-3 max-w-[46ch] text-nota text-tinta-3">
              Suma de los cinco catálogos sin borrado lógico. Incluye{' '}
              <Clave className="text-nota">{entero(totalInactivos)}</Clave> inactivos; quedan
              fuera <Clave className="text-nota">{entero(totalBajas)}</Clave> dados de baja.
            </p>
          </div>

          <div className="border-t border-raya p-5 sm:border-t-0 sm:border-l">
            <div className="flex items-start justify-between gap-3">
              <Rotulo>Revisiones con hallazgos</Rotulo>
              <Sello tono={conHallazgos > 0 ? 'aviso' : 'activa'}>
                {conHallazgos > 0 ? 'Revisar' : 'Limpio'}
              </Sello>
            </div>
            <p
              data-cifra
              className="mt-2 font-mono text-portada leading-none font-medium tracking-[-0.015em] text-tinta"
            >
              {entero(conHallazgos)}
              <span className="text-seccion text-tinta-4"> / {entero(filas.length)}</span>
            </p>
            <p className="mt-3 max-w-[46ch] text-nota text-tinta-3">
              {conHallazgos === 0 || mayor === undefined ? (
                'Ninguna comprobación de integridad encontró registros fuera de lugar.'
              ) : (
                <>
                  La mayor es «{mayor.titulo.toLowerCase()}», con{' '}
                  <Clave className="text-nota">{entero(mayor.conteo)}</Clave> registros. El
                  desglose completo está abajo.
                </>
              )}
            </p>
          </div>
        </Hoja>

        {/* ── Catálogos ───────────────────────────────────────────────── */}
        <Bloque rotulo="Catálogos">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {CATALOGOS.map((c) => {
              const conteo = catalogos[c.clave]
              return (
                <Hoja
                  key={c.clave}
                  className={cn(
                    'group relative p-4 transition-colors duration-100',
                    'hover:border-raya-firme hover:bg-renglon/45',
                    'has-focus-visible:border-raya-firme has-focus-visible:bg-renglon',
                  )}
                >
                  <EnlaceDeFila
                    to={c.a}
                    search={c.busqueda}
                    className="absolute inset-0 rounded-hoja"
                  >
                    <span className="sr-only">Ver el catálogo de {c.rotulo.toLowerCase()}</span>
                  </EnlaceDeFila>

                  <ArrowUpRight
                    size={13}
                    strokeWidth={1.75}
                    aria-hidden
                    className={cn(
                      'absolute top-4 right-4 text-tinta-4 opacity-0',
                      'transition-[opacity,transform] duration-150',
                      'group-hover:translate-x-px group-hover:opacity-100',
                    )}
                  />

                  <Cifra rotulo={c.rotulo} valor={entero(conteo.vigentes)} />

                  <div className="mt-3.5 flex flex-col items-start gap-1">
                    <Desglose
                      conteo={conteo.inactivos}
                      etiqueta={c.inactivos}
                      a={c.a}
                      busqueda={{ ...c.busqueda, estatus: ['inactiva'] }}
                    />
                    <Desglose
                      conteo={conteo.bajas}
                      etiqueta={c.bajas}
                      a={c.a}
                      busqueda={{ ...c.busqueda, bajas: true }}
                    />
                  </div>
                </Hoja>
              )
            })}
          </div>
        </Bloque>

        {/* ── Revisiones de integridad ────────────────────────────────── */}
        <Bloque rotulo="Revisiones de integridad">
          <Hoja className="overflow-hidden">
            <Manifiesto etiqueta="Revisiones de integridad de la migración">
              <Cabecera>
                <Th>Revisión</Th>
                <Th>Catálogo</Th>
                <Th numerica>Encontrados</Th>
                <Th>Estado</Th>
              </Cabecera>
              <Cuerpo>
                {filas.map((r) => {
                  const hallazgo = r.conteo > 0
                  return (
                    <Fila key={r.clave}>
                      <Td>
                        <span
                          className={cn(
                            'block text-lectura',
                            hallazgo ? 'font-medium text-tinta' : 'text-tinta-2',
                          )}
                        >
                          {r.titulo}
                        </span>
                        {/* El tope de medida va en el bloque interior, no en la celda:
                            una celda con max-width no acota la columna. */}
                        <span className="mt-0.5 block max-w-[68ch] text-nota text-tinta-3">
                          {r.explicacion}
                        </span>
                      </Td>
                      <Td>
                        <Vinculo to={r.a} search={r.busqueda} className="text-dato text-tinta-2">
                          {r.catalogo}
                        </Vinculo>
                      </Td>
                      <Td numerica>
                        <span className={hallazgo ? 'font-medium text-tinta' : 'text-tinta-4'}>
                          {entero(r.conteo)}
                        </span>
                      </Td>
                      <Td>
                        <Sello tono={hallazgo ? 'aviso' : 'activa'}>
                          {hallazgo ? 'Revisar' : 'Limpio'}
                        </Sello>
                      </Td>
                    </Fila>
                  )
                })}
              </Cuerpo>
            </Manifiesto>
          </Hoja>
        </Bloque>

        {/* ── Sincronización HCM ──────────────────────────────────────── */}
        <Bloque rotulo="Sincronización HCM">
          <Hoja className="overflow-hidden">
            <Manifiesto etiqueta="Origen de los registros según la sincronización HCM">
              <Cabecera>
                <Th>Catálogo</Th>
                <Th numerica>Gestionados por HCM</Th>
                <Th numerica>Capturados a mano</Th>
                <Th numerica>Marcados como desactivados</Th>
              </Cabecera>
              <Cuerpo>
                {FILAS_HCM.map((f) => {
                  const conteo = hcm[f.clave]
                  return (
                    <Fila key={f.clave}>
                      <Td>
                        <Vinculo to={f.a} className="text-lectura text-tinta">
                          {f.rotulo}
                        </Vinculo>
                      </Td>
                      <Td numerica>
                        <CifraHcm
                          conteo={conteo.gestionados}
                          a={f.filtrable ? f.a : undefined}
                          busqueda={{ origen: ['hcm'] }}
                          titulo={`${f.rotulo} con hcmLastSeenRunId`}
                        />
                      </Td>
                      <Td numerica>
                        <CifraHcm
                          conteo={conteo.manuales}
                          a={f.filtrable ? f.a : undefined}
                          busqueda={{ origen: ['manual'] }}
                          titulo={`${f.rotulo} sin hcmLastSeenRunId`}
                        />
                      </Td>
                      <Td numerica>
                        <span
                          title={`${f.rotulo} con hcmDisabled`}
                          className={conteo.desactivados > 0 ? 'text-ambar' : 'text-tinta-4'}
                        >
                          {entero(conteo.desactivados)}
                        </span>
                      </Td>
                    </Fila>
                  )
                })}
              </Cuerpo>
            </Manifiesto>
          </Hoja>
          <p className="mt-3 max-w-[78ch] text-nota text-tinta-3">
            Informativo: estas marcas no cambian el comportamiento del sistema. Un registro
            gestionado por HCM es el que trae <Clave className="text-nota">hcmLastSeenRunId</Clave>{' '}
            —lo trajo alguna corrida del sincronizador—; los capturados a mano nunca se marcan. La
            última columna cuenta los que el sincronizador marcó con{' '}
            <Clave className="text-nota">hcmDisabled</Clave> porque GER dejó de reportarlos.
          </p>
        </Bloque>
      </div>
    </>
  )
}

/* ── Desglose de una tarjeta ──────────────────────────────────────────────
   En cero no enlaza: se retira a la tinta más callada y deja de ser un
   destino. Lo que vale cero no merece un clic.                             */
function Desglose({
  conteo,
  etiqueta,
  a,
  busqueda,
}: {
  conteo: number
  etiqueta: string
  a: LinkProps['to']
  busqueda?: Record<string, unknown>
}) {
  if (conteo === 0) {
    return (
      <span className="text-nota text-tinta-4">
        <Clave className="text-nota text-tinta-4">{entero(conteo)}</Clave> {etiqueta}
      </span>
    )
  }

  return (
    <Vinculo to={a} search={busqueda} className="relative z-10 text-nota text-tinta-2">
      <Clave className="text-nota">{entero(conteo)}</Clave> {etiqueta}
    </Vinculo>
  )
}

/** Cifra de la tabla HCM: enlaza sólo cuando el listado sabe filtrar por origen. */
function CifraHcm({
  conteo,
  a,
  busqueda,
  titulo,
}: {
  conteo: number
  a?: LinkProps['to']
  busqueda?: Record<string, unknown>
  titulo: string
}) {
  if (a === undefined || conteo === 0) {
    return (
      <span title={titulo} className={conteo === 0 ? 'text-tinta-4' : 'text-tinta'}>
        {entero(conteo)}
      </span>
    )
  }

  return (
    <Vinculo to={a} search={busqueda} className="text-tinta">
      <span title={titulo}>{entero(conteo)}</span>
    </Vinculo>
  )
}
