import { createFileRoute } from '@tanstack/react-router'
import { Clave, Dato, Hoja, Marca, Rotulo, SelloActividad } from '~/components/base'
import { Encabezado, Miga, Migas, SeparadorMiga } from '~/components/cascaron'
import { EstadoError, EstadoVacio, ManifiestoCargando } from '~/components/estados'
import { Ficha, Pestana, Pestanas, Rejilla, VinculoExterno } from '~/components/ficha'
import { BotonActualizar } from '~/components/actualizar'
import {
  Cabecera,
  Cuerpo,
  EnlaceDeFila,
  Fila,
  Manifiesto,
  Td,
  Th,
} from '~/components/tabla'
import {
  SIN_DATO,
  TIPO_TERMINAL,
  coordenada,
  entero as enteroFmt,
  fecha,
  fechaHora,
  kilometros,
  minutos,
  moneda,
} from '~/lib/formato'
import { limpiarBusqueda, unoDe } from '~/lib/parametros'
import {
  obtenerTerminal,
  type ArchivoTerminal,
  type RutaDeTerminal,
} from '~/server/terminales'

const PESTANAS = ['servicios', 'salidas', 'llegadas', 'tramos'] as const
type PestanaTerminal = (typeof PESTANAS)[number]

/** Opcional a propósito: la pestaña por omisión no se escribe en la dirección. */
type BusquedaTerminal = { pestana?: PestanaTerminal }

export const Route = createFileRoute('/terminales/$id')({
  validateSearch: (entrada: Record<string, unknown>): BusquedaTerminal =>
    limpiarBusqueda(
      { pestana: unoDe(entrada.pestana, PESTANAS, 'servicios') },
      { pestana: 'servicios' },
    ),
  loader: ({ params }) => obtenerTerminal({ data: { id: params.id } }),
  component: Pantalla,
  pendingComponent: () => (
    <>
      <Encabezado titulo="Terminal" renglon="Leyendo la ficha…" />
      <div className="px-4 sm:px-8 py-6">
        <Hoja className="overflow-hidden py-2">
          <ManifiestoCargando columnas={[12, 26, 20, 14, 10]} renglones={6} />
        </Hoja>
      </div>
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <>
      <Encabezado titulo="Terminal" />
      <EstadoError
        titulo="No fue posible leer la ficha de la terminal"
        detalle={error instanceof Error ? error.message : String(error)}
        alReintentar={reset}
      />
    </>
  ),
})

/* ── Piezas locales ───────────────────────────────────────────────────────── */

/** Bytes a KB/MB: el peso de un archivo se lee mejor redondeado. */
function pesoDeArchivo(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return SIN_DATO
  if (bytes < 1024) return `${enteroFmt(bytes)} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`
}

function Fotografia({ rotulo, archivo }: { rotulo: string; archivo: ArchivoTerminal }) {
  return (
    <div>
      <Rotulo>{rotulo}</Rotulo>
      <div className="mt-1 min-w-0">
        <VinculoExterno href={archivo.url}>{archivo.nombre}</VinculoExterno>
      </div>
      <p data-cifra className="mt-1 font-mono text-nota text-tinta-3">
        {archivo.tipo} <span className="text-tinta-4">·</span> {pesoDeArchivo(archivo.bytes)}
      </p>
    </div>
  )
}

/** Par origen → destino; la terminal de la ficha va en tinta plena. */
function Trayecto({
  origen,
  destino,
  actual,
}: {
  origen: { id: string; numero: string; nombreCorto: string }
  destino: { id: string; numero: string; nombreCorto: string }
  actual: string
}) {
  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <span
        className={tintaDelExtremo(origen.id === actual)}
        title={`Terminal ${origen.numero}`}
      >
        {origen.nombreCorto}
      </span>
      <span aria-hidden className="text-tinta-4">
        →
      </span>
      <span
        className={tintaDelExtremo(destino.id === actual)}
        title={`Terminal ${destino.numero}`}
      >
        {destino.nombreCorto}
      </span>
    </span>
  )
}

function tintaDelExtremo(actual: boolean) {
  return actual
    ? 'font-mono text-dato font-medium text-tinta'
    : 'font-mono text-dato text-tinta-3'
}

function TablaDeRutas({
  rutas,
  columnaExtremo,
  extremo,
  vacio,
}: {
  rutas: Array<RutaDeTerminal>
  columnaExtremo: string
  extremo: (r: RutaDeTerminal) => { numero: string; nombreCorto: string }
  vacio: string
}) {
  if (rutas.length === 0) {
    return <EstadoVacio titulo={vacio} />
  }
  return (
    <Manifiesto etiqueta={columnaExtremo}>
      <Cabecera>
        <Th>No. ruta</Th>
        <Th>Nombre</Th>
        <Th>{columnaExtremo}</Th>
        <Th>Servicio</Th>
        <Th numerica>Tiempo</Th>
        <Th numerica>Distancia</Th>
        <Th numerica>Tarifa sencilla</Th>
        <Th>Estatus</Th>
      </Cabecera>
      <Cuerpo>
        {rutas.map((r) => {
          const otro = extremo(r)
          return (
            <Fila key={r.id} atenuada={r.baja}>
              <Td>
                <EnlaceDeFila to="/rutas/$id" params={{ id: r.id }}>
                  <Clave enfasis>{r.numero}</Clave>
                </EnlaceDeFila>
              </Td>
              <Td>
                <span className="block max-w-[24rem] truncate text-tinta-2" title={r.nombre}>
                  {r.nombre}
                </span>
              </Td>
              <Td>
                <span className="font-mono text-dato whitespace-nowrap text-tinta-2">
                  {otro.numero} <span className="text-tinta-4">·</span> {otro.nombreCorto}
                </span>
              </Td>
              <Td>
                <span className="font-mono text-dato whitespace-nowrap text-tinta-2">
                  {r.servicio.numero} <span className="text-tinta-4">·</span>{' '}
                  {r.servicio.nombreCorto}
                </span>
              </Td>
              <Td numerica>{minutos(r.minutos)}</Td>
              <Td numerica>{kilometros(r.kilometros)}</Td>
              <Td numerica>{moneda(r.tarifaSencilla)}</Td>
              <Td>
                <SelloActividad activa={r.activa} eliminada={r.baja} />
              </Td>
            </Fila>
          )
        })}
      </Cuerpo>
    </Manifiesto>
  )
}

/* ── Pantalla ─────────────────────────────────────────────────────────────── */

function Pantalla() {
  const datos = Route.useLoaderData()
  const pestana = Route.useSearch().pestana ?? 'servicios'
  const navigate = Route.useNavigate()

  if (!datos.ok) {
    return (
      <>
        <Encabezado
          titulo="Terminal"
          migas={
            <Migas>
              <Miga to="/terminales">Terminales</Miga>
            </Migas>
          }
        />
        <EstadoError {...datos.falla} />
      </>
    )
  }

  const { terminal: t, salidas, llegadas, tramos } = datos

  const hayCoordenadas =
    Number.isFinite(t.latitud) &&
    Number.isFinite(t.longitud) &&
    (t.latitud !== 0 || t.longitud !== 0)
  const mapa = hayCoordenadas
    ? `https://www.google.com/maps/search/?api=1&query=${t.latitud},${t.longitud}`
    : null

  function irAPestana(valor: string) {
    void navigate({
      search: () =>
        limpiarBusqueda(
          { pestana: unoDe(valor, PESTANAS, 'servicios') },
          { pestana: 'servicios' },
        ),
      replace: true,
    })
  }

  return (
    <>
      <Encabezado
        migas={
          <Migas>
            <Miga to="/terminales">Terminales</Miga>
            <SeparadorMiga />
            <span className="text-tinta-2">{t.numero}</span>
          </Migas>
        }
        titulo={t.nombre}
        renglon={
          <>
            <span className="text-tinta-2">{t.numero}</span>
            <span className="text-tinta-4"> · </span>
            {t.nombreCorto}
          </>
        }
        acciones={
          <>
            <SelloActividad activa={t.activa} eliminada={t.baja} />
            <span aria-hidden className="h-4 w-px bg-raya" />
            <BotonActualizar />
          </>
        }
      />

      <div className="px-4 sm:px-8 py-6">
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <Ficha titulo="Identificación">
            <Rejilla columnas={2}>
              <Dato rotulo="No. terminal" mono>
                {t.numero}
              </Dato>
              <Dato rotulo="Nombre corto" mono>
                {t.nombreCorto}
              </Dato>
              <Dato rotulo="Nombre completo" ancho>
                {t.nombre}
              </Dato>
              <Dato rotulo="Tipo">{TIPO_TERMINAL[t.tipo] ?? t.tipo}</Dato>
              <Dato rotulo="Estatus">
                <SelloActividad activa={t.activa} eliminada={t.baja} />
              </Dato>
            </Rejilla>
          </Ficha>

          <Ficha titulo="Ubicación">
            <Rejilla columnas={2}>
              <Dato rotulo="Dirección" ancho>
                {t.direccion ?? <span className="text-tinta-4">{SIN_DATO}</span>}
              </Dato>
              <Dato rotulo="Estado de la república">
                {t.estado ?? <span className="text-tinta-4">{SIN_DATO}</span>}
              </Dato>
              <Dato rotulo="Teléfono" mono>
                {t.telefono ?? <span className="text-tinta-4">{SIN_DATO}</span>}
              </Dato>
              <Dato rotulo="Latitud" mono>
                {hayCoordenadas ? (
                  coordenada(t.latitud)
                ) : (
                  <span className="text-tinta-4">{SIN_DATO}</span>
                )}
              </Dato>
              <Dato rotulo="Longitud" mono>
                {hayCoordenadas ? (
                  coordenada(t.longitud)
                ) : (
                  <span className="text-tinta-4">{SIN_DATO}</span>
                )}
              </Dato>
              <Dato rotulo="Mapa" ancho>
                {mapa || t.urlGoogle ? (
                  <div className="flex flex-col items-start gap-1.5">
                    {mapa ? (
                      <VinculoExterno href={mapa}>Abrir en Google Maps</VinculoExterno>
                    ) : null}
                    {t.urlGoogle ? (
                      <VinculoExterno href={t.urlGoogle}>{t.urlGoogle}</VinculoExterno>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-tinta-4">{SIN_DATO}</span>
                )}
              </Dato>
            </Rejilla>
          </Ficha>
        </div>

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
          <Ficha
            titulo="Fotografías"
            nota={
              t.fachada || t.isometrico
                ? `${[t.fachada, t.isometrico].filter(Boolean).length} de 2`
                : undefined
            }
          >
            {t.fachada || t.isometrico ? (
              <Rejilla columnas={2}>
                {t.fachada ? <Fotografia rotulo="Fachada" archivo={t.fachada} /> : null}
                {t.isometrico ? (
                  <Fotografia rotulo="Isométrico" archivo={t.isometrico} />
                ) : null}
              </Rejilla>
            ) : (
              <p className="text-lectura text-tinta-3">
                Sin fotografías registradas para esta terminal.
              </p>
            )}
          </Ficha>

          <Ficha
            titulo="Donaciones"
            nota={t.donaciones.length > 0 ? `${enteroFmt(t.donaciones.length)}` : undefined}
          >
            {t.donaciones.length === 0 ? (
              <p className="text-lectura text-tinta-3">
                Sin activaciones de donativo registradas.
              </p>
            ) : (
              <ul>
                {t.donaciones.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-raya-tenue py-2 first:pt-0 last:border-b-0 last:pb-0"
                  >
                    <span data-cifra className="font-mono text-dato text-tinta-2">
                      {fecha(d.inicio)} <span className="text-tinta-4">→</span> {fecha(d.fin)}
                    </span>
                    <SelloActividad activa={d.activa} />
                  </li>
                ))}
              </ul>
            )}
          </Ficha>
        </div>

        <Hoja className="mt-5 overflow-hidden">
          <Pestanas
            valor={pestana}
            alCambiar={irAPestana}
            opciones={[
              { valor: 'servicios', rotulo: 'Servicios', conteo: t.servicios.length },
              { valor: 'salidas', rotulo: 'Rutas que salen de aquí', conteo: salidas.length },
              { valor: 'llegadas', rotulo: 'Rutas que llegan', conteo: llegadas.length },
              { valor: 'tramos', rotulo: 'Tramos', conteo: tramos.length },
            ]}
          >
            <Pestana valor="servicios">
              {t.servicios.length === 0 ? (
                <EstadoVacio
                  titulo="Sin servicios asociados"
                  detalle="Esta terminal no está dada de alta en ningún servicio, por lo que tampoco se le puede deducir una empresa."
                />
              ) : (
                <Manifiesto etiqueta="Servicios de la terminal">
                  <Cabecera>
                    <Th>No. servicio</Th>
                    <Th>Clave</Th>
                    <Th>Nombre corto</Th>
                    <Th>Nombre completo</Th>
                    <Th>Empresa</Th>
                    <Th>Estatus</Th>
                  </Cabecera>
                  <Cuerpo>
                    {t.servicios.map((s) => (
                      <Fila key={s.id} atenuada={s.baja}>
                        <Td>
                          <EnlaceDeFila to="/servicios/$id" params={{ id: s.id }}>
                            <Clave enfasis>{s.numero}</Clave>
                          </EnlaceDeFila>
                        </Td>
                        <Td>
                          <Clave>{s.clave}</Clave>
                        </Td>
                        <Td>
                          <span className="font-mono text-dato whitespace-nowrap text-tinta">
                            {s.nombreCorto}
                          </span>
                        </Td>
                        <Td>
                          <span
                            className="block max-w-[24rem] truncate text-tinta-2"
                            title={s.nombreCompleto}
                          >
                            {s.nombreCompleto}
                          </span>
                        </Td>
                        <Td>
                          <span className="whitespace-nowrap text-tinta-2">
                            <span className="font-mono text-dato text-tinta-3">
                              {s.empresa.clave}
                            </span>{' '}
                            {s.empresa.nombreCorto}
                          </span>
                        </Td>
                        <Td>
                          <SelloActividad activa={s.activo} eliminada={s.baja} />
                        </Td>
                      </Fila>
                    ))}
                  </Cuerpo>
                </Manifiesto>
              )}
            </Pestana>

            <Pestana valor="salidas">
              <TablaDeRutas
                rutas={salidas}
                columnaExtremo="Destino"
                extremo={(r) => r.destino}
                vacio="Ninguna ruta sale de esta terminal"
              />
            </Pestana>

            <Pestana valor="llegadas">
              <TablaDeRutas
                rutas={llegadas}
                columnaExtremo="Origen"
                extremo={(r) => r.origen}
                vacio="Ninguna ruta llega a esta terminal"
              />
            </Pestana>

            <Pestana valor="tramos">
              {tramos.length === 0 ? (
                <EstadoVacio
                  titulo="Sin tramos que toquen esta terminal"
                  detalle="Ningún tramo la usa como origen ni como destino."
                />
              ) : (
                <Manifiesto etiqueta="Tramos que tocan la terminal">
                  <Cabecera>
                    <Th>No. tramo</Th>
                    <Th>Ruta</Th>
                    <Th>Trayecto</Th>
                    <Th numerica>Tarifa sencilla</Th>
                    <Th>Estatus</Th>
                  </Cabecera>
                  <Cuerpo>
                    {tramos.map((s) => (
                      <Fila key={s.id} atenuada={s.baja}>
                        <Td>
                          <span className="flex items-center gap-2">
                            <Clave enfasis>{s.numero}</Clave>
                            {s.principal ? <Marca /> : null}
                          </span>
                        </Td>
                        <Td>
                          <EnlaceDeFila to="/rutas/$id" params={{ id: s.ruta.id }}>
                            <span className="flex items-baseline gap-2 whitespace-nowrap">
                              <Clave enfasis>{s.ruta.numero}</Clave>
                              <span className="max-w-[20rem] truncate text-tinta-2">
                                {s.ruta.nombre}
                              </span>
                            </span>
                          </EnlaceDeFila>
                        </Td>
                        <Td>
                          <Trayecto origen={s.origen} destino={s.destino} actual={t.id} />
                        </Td>
                        <Td numerica>{moneda(s.tarifaSencilla)}</Td>
                        <Td>
                          <SelloActividad activa={s.activo} eliminada={s.baja} />
                        </Td>
                      </Fila>
                    ))}
                  </Cuerpo>
                </Manifiesto>
              )}
            </Pestana>
          </Pestanas>
        </Hoja>

        <Ficha titulo="Rastro" className="mt-5">
          <Rejilla columnas={4}>
            <Dato rotulo="Identificador" mono>
              {t.id}
            </Dato>
            <Dato rotulo="Alta" mono>
              {fechaHora(t.creadaEn)}
              <span className="mt-1 block font-sans text-nota text-tinta-3">
                {t.creadaPor ?? SIN_DATO}
              </span>
            </Dato>
            <Dato rotulo="Última edición" mono>
              {fechaHora(t.actualizadaEn)}
              <span className="mt-1 block font-sans text-nota text-tinta-3">
                {t.actualizadaPor ?? SIN_DATO}
              </span>
            </Dato>
            <Dato rotulo="Baja" mono>
              {t.eliminadaEn ? (
                <span className="text-oxido">{fechaHora(t.eliminadaEn)}</span>
              ) : (
                <span className="text-tinta-4">{SIN_DATO}</span>
              )}
            </Dato>
          </Rejilla>
        </Ficha>
      </div>
    </>
  )
}
