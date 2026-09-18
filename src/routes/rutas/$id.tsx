import { createFileRoute } from '@tanstack/react-router'
import {
  Cifra,
  Clave,
  Dato,
  Hoja,
  Marca,
  Rotulo,
  Sello,
  SelloActividad,
} from '~/components/base'
import { Encabezado, Miga, Migas, SeparadorMiga } from '~/components/cascaron'
import { EstadoError, ManifiestoCargando } from '~/components/estados'
import { Ficha, Rejilla, Vinculo } from '~/components/ficha'
import { Cabecera, Cuerpo, Fila, Manifiesto, Td, Th } from '~/components/tabla'
import { BotonActualizar } from '~/components/actualizar'
import { cn } from '~/lib/cn'
import {
  SIN_DATO,
  TIPO_RECAUDACION,
  entero,
  kilometros,
  minutos,
  moneda,
  plural,
  porcentaje,
} from '~/lib/formato'
import type { DetalleRuta, Terminal, TramoDetalle } from '~/server/rutas'
import { obtenerRuta } from '~/server/rutas'

export const Route = createFileRoute('/rutas/$id')({
  loader: ({ params }) => obtenerRuta({ data: { id: params.id } }),
  component: Pantalla,
  pendingComponent: () => (
    <>
      <Encabezado titulo="Cargando ruta…" renglon={SIN_DATO} />
      <div className="px-4 sm:px-8 py-6">
        <Hoja className="py-2">
          <ManifiestoCargando columnas={[8, 26, 12, 12, 12, 10]} renglones={6} />
        </Hoja>
      </div>
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <EstadoError
      titulo="No fue posible leer la ruta"
      detalle={error instanceof Error ? error.message : String(error)}
      alReintentar={reset}
    />
  ),
})

/* ── Piezas ─────────────────────────────────────────────────────────────── */

function EnlaceTerminal({ terminal }: { terminal: Terminal }) {
  return (
    <Vinculo to="/terminales/$id" params={{ id: terminal.id }}>
      <span className="inline-flex items-baseline gap-2">
        <Clave enfasis>{terminal.clave}</Clave>
        <span className="text-lectura text-tinta-2">{terminal.nombre}</span>
      </span>
    </Vinculo>
  )
}

function SiNo({ valor }: { valor: boolean }) {
  return (
    <span className={cn('font-mono text-dato', valor ? 'text-tinta' : 'text-tinta-3')}>
      {valor ? 'Sí' : 'No'}
    </span>
  )
}

/** Recuadro discreto para los bloques que van sin tabla. */
function Vacia({ children }: { children: string }) {
  return <p className="text-lectura text-tinta-3">{children}</p>
}

/* ── Pantalla ───────────────────────────────────────────────────────────── */

function Pantalla() {
  const datos = Route.useLoaderData()

  if (!datos.ok) {
    return (
      <>
        <Encabezado
          titulo="Ruta"
          migas={
            <Migas>
              <Miga to="/rutas">Rutas y tramos</Miga>
              <SeparadorMiga />
              <span className="text-tinta-2">{SIN_DATO}</span>
            </Migas>
          }
        />
        <EstadoError {...datos.falla} />
      </>
    )
  }

  const r = datos.ruta
  const avisos = revisarIntegridad(r)

  return (
    <>
      <Encabezado
        migas={
          <Migas>
            <Miga to="/rutas">Rutas y tramos</Miga>
            <SeparadorMiga />
            <span className="text-tinta-2">{r.numero}</span>
          </Migas>
        }
        titulo={r.nombre}
        renglon={`${r.numero} · ${r.servicio.nombre} · ${r.empresa.nombre}`}
        acciones={
          <>
            <SelloActividad activa={r.activa} eliminada={r.eliminada} />
            <span aria-hidden className="h-4 w-px bg-raya" />
            <BotonActualizar />
          </>
        }
      />

      <div className="flex flex-col gap-7 px-4 sm:px-8 py-6">
        {/* Fila de cifras: lo que se cotea de un vistazo. */}
        <Hoja>
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 p-5 sm:grid-cols-3 lg:grid-cols-6">
            <Cifra
              rotulo="Tramos"
              valor={entero(r.tramos.length)}
              nota={
                r.tramosDeBaja > 0
                  ? `${plural(r.tramosDeBaja, 'tramo dado de baja', 'tramos dados de baja')} sin mostrar`
                  : undefined
              }
            />
            <Cifra
              rotulo="Tarifa sencilla"
              valor={moneda(r.tarifaSencilla)}
              tono="sello"
            />
            <Cifra rotulo="Tarifa redonda" valor={moneda(r.tarifaRedonda)} />
            <Cifra rotulo="Tiempo de viaje" valor={minutos(r.tiempoMinutos)} />
            <Cifra rotulo="Distancia" valor={kilometros(r.distanciaKm)} />
            <Cifra rotulo="Estancia" valor={minutos(r.estanciaMinutos)} />
          </div>
        </Hoja>

        <Ficha titulo="Información básica">
          <Rejilla columnas={3}>
            <Dato rotulo="Número" mono>
              {r.numero}
            </Dato>
            <Dato rotulo="Nombre" ancho>
              {r.nombre}
            </Dato>
            <Dato rotulo="Empresa">
              <Vinculo to="/empresas/$id" params={{ id: r.empresa.id }}>
                {r.empresa.nombre}
              </Vinculo>
            </Dato>
            <Dato rotulo="Servicio">
              <Vinculo to="/servicios/$id" params={{ id: r.servicio.id }}>
                {r.servicio.nombre}
              </Vinculo>
            </Dato>
            <Dato rotulo="Tipo de recaudación">
              {TIPO_RECAUDACION[r.recaudacion] ?? r.recaudacion ?? SIN_DATO}
            </Dato>
            <Dato rotulo="Origen">
              <EnlaceTerminal terminal={r.origen} />
            </Dato>
            <Dato rotulo="Destino">
              <EnlaceTerminal terminal={r.destino} />
            </Dato>
            <Dato rotulo="Plantilla de unidad">{r.unidad ?? SIN_DATO}</Dato>
            <Dato rotulo="Aplica IVA">
              <SiNo valor={r.aplicaIva} />
            </Dato>
            <Dato rotulo="Selección de asientos">
              <SiNo valor={r.seleccionAsientos} />
            </Dato>
            <Dato rotulo="Estatus">
              <SelloActividad activa={r.activa} eliminada={r.eliminada} />
            </Dato>
          </Rejilla>
        </Ficha>

        <div className="grid items-start gap-7 lg:grid-cols-2">
          <Ficha
            titulo="Canales de venta"
            nota={r.canales.length > 0 ? entero(r.canales.length) : undefined}
          >
            {r.canales.length === 0 ? (
              <Vacia>Sin canales configurados</Vacia>
            ) : (
              <ul className="-my-2 divide-y divide-raya-tenue">
                {r.canales.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-4 py-2">
                    <span className="min-w-0 truncate text-lectura text-tinta">{c.nombre}</span>
                    {c.eliminado ? (
                      <Sello tono="baja">Baja</Sello>
                    ) : c.activa ? null : (
                      <Sello tono="inactiva">Inactivo</Sello>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Ficha>

          <Ficha
            titulo="Tipos de pasajero"
            nota={r.pasajeros.length > 0 ? entero(r.pasajeros.length) : undefined}
          >
            {r.pasajeros.length === 0 ? (
              <Vacia>Sin tipos de pasajero configurados</Vacia>
            ) : (
              <div className="-m-5">
                <Manifiesto etiqueta="Tipos de pasajero de la ruta">
                  <Cabecera>
                    <Th>Tipo</Th>
                    <Th>Clave</Th>
                    <Th numerica>Descuento</Th>
                    <Th numerica>Límite de asientos</Th>
                  </Cabecera>
                  <Cuerpo>
                    {r.pasajeros.map((p) => (
                      <Fila key={p.id} atenuada={!p.activo}>
                        <Td className="text-tinta">{p.nombre}</Td>
                        <Td>
                          <Clave>{p.clave}</Clave>
                        </Td>
                        <Td numerica>{porcentaje(p.descuento)}</Td>
                        <Td numerica className={p.limite === null ? 'text-tinta-3' : undefined}>
                          {p.limite === null ? 'Sin límite' : entero(p.limite)}
                        </Td>
                      </Fila>
                    ))}
                  </Cuerpo>
                </Manifiesto>
              </div>
            )}
          </Ficha>
        </div>

        <LibroDeTramos ruta={r} />

        <Ficha
          titulo="Paradas de cortesía"
          nota={r.paradas.length > 0 ? entero(r.paradas.length) : undefined}
        >
          {r.paradas.length === 0 ? (
            <Vacia>Esta ruta no tiene paradas de cortesía registradas</Vacia>
          ) : (
            <ul className="-my-2 divide-y divide-raya-tenue">
              {r.paradas.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <Clave className="w-8 shrink-0 text-right">{entero(p.orden)}</Clave>
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-lectura',
                      p.activa ? 'text-tinta' : 'text-tinta-3',
                    )}
                  >
                    {p.nombre}
                  </span>
                  {p.activa ? null : <Sello tono="inactiva">Inactiva</Sello>}
                </li>
              ))}
            </ul>
          )}
        </Ficha>

        <Integridad avisos={avisos} />
      </div>
    </>
  )
}

/* ── El libro de tramos: la firma de esta pantalla ──────────────────────── */

function LibroDeTramos({ ruta }: { ruta: DetalleRuta }) {
  const tramos = ruta.tramos
  const conDistancia = tramos.filter((t) => t.distanciaKm !== null)
  const sumaDistancia = conDistancia.reduce((a, t) => a + (t.distanciaKm ?? 0), 0)
  const sumaDuracion = tramos.reduce((a, t) => a + t.duracionMinutos, 0)
  const sumaEstancia = tramos.reduce((a, t) => a + t.estanciaMinutos, 0)

  return (
    <Ficha
      titulo="Tramos"
      nota={
        ruta.tramosDeBaja > 0
          ? `${plural(tramos.length, 'tramo vigente', 'tramos vigentes')} · ${entero(ruta.tramosDeBaja)} de baja sin mostrar`
          : plural(tramos.length, 'tramo', 'tramos')
      }
    >
      {tramos.length === 0 ? (
        <Vacia>
          Esta ruta no tiene ningún tramo migrado. Sin tramos, la ruta no se puede vender.
        </Vacia>
      ) : (
        <div className="-m-5">
          <Manifiesto etiqueta={`Tramos de la ruta ${ruta.numero}`}>
            <Cabecera>
              <Th>No.</Th>
              <Th>Origen → Destino</Th>
              <Th numerica>Estancia</Th>
              <Th numerica>Duración</Th>
              <Th numerica>Distancia</Th>
              <Th>Venta</Th>
              <Th numerica>Tarifa sencilla</Th>
              <Th numerica>Tarifa redonda</Th>
            </Cabecera>
            <Cuerpo>
              {tramos.map((t) => (
                <RenglonDeTramo key={t.id} tramo={t} />
              ))}
            </Cuerpo>
            {/* El corte del manifiesto impreso: raya doble y totales. */}
            <tfoot>
              <tr className="[&>td]:border-t-[3px] [&>td]:border-double [&>td]:border-raya-firme [&>td]:px-3 [&>td]:py-2.5">
                <td className="font-mono text-nota font-medium tracking-[0.085em] text-tinta-3 uppercase">
                  Total
                </td>
                <td className="font-mono text-dato text-tinta-2">
                  {plural(tramos.length, 'tramo', 'tramos')}
                </td>
                <td className="text-right font-mono text-dato font-medium text-tinta">
                  {minutos(sumaEstancia)}
                </td>
                <td className="text-right font-mono text-dato font-medium text-tinta">
                  {minutos(sumaDuracion)}
                </td>
                <td
                  className="text-right font-mono text-dato font-medium text-tinta"
                  title={
                    conDistancia.length === tramos.length
                      ? undefined
                      : `Suma de ${entero(conDistancia.length)} de ${entero(tramos.length)} tramos con distancia registrada`
                  }
                >
                  {kilometros(sumaDistancia)}
                  {conDistancia.length === tramos.length ? null : (
                    <span className="text-tinta-4"> *</span>
                  )}
                </td>
                <td />
                <td />
                <td />
              </tr>
            </tfoot>
          </Manifiesto>
        </div>
      )}
    </Ficha>
  )
}

function RenglonDeTramo({ tramo }: { tramo: TramoDetalle }) {
  return (
    <Fila destacada={tramo.principal} atenuada={!tramo.activa}>
      <Td>
        <span className="inline-flex items-center gap-1.5">
          <Clave enfasis>{tramo.numero}</Clave>
          {tramo.principal ? <Marca /> : null}
        </span>
      </Td>
      <Td>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <Vinculo to="/terminales/$id" params={{ id: tramo.origen.id }}>
            <Clave>{tramo.origen.clave}</Clave>
          </Vinculo>
          <span aria-hidden className="text-tinta-4">
            →
          </span>
          <Vinculo to="/terminales/$id" params={{ id: tramo.destino.id }}>
            <Clave>{tramo.destino.clave}</Clave>
          </Vinculo>
          <span className="ml-1 truncate text-dato text-tinta-3">
            {tramo.origen.nombre} — {tramo.destino.nombre}
          </span>
        </span>
      </Td>
      <Td numerica className="text-tinta-2">
        {minutos(tramo.estanciaMinutos)}
      </Td>
      <Td numerica className="text-tinta-2">
        {minutos(tramo.duracionMinutos)}
      </Td>
      <Td numerica className="text-tinta-2">
        {kilometros(tramo.distanciaKm)}
      </Td>
      <Td>
        <SiNo valor={tramo.permiteVenta} />
      </Td>
      <Td numerica>{moneda(tramo.tarifaSencilla)}</Td>
      <Td numerica className="text-tinta-2">
        {moneda(tramo.tarifaRedonda)}
      </Td>
    </Fila>
  )
}

/* ── Verificación de integridad ─────────────────────────────────────────── */

/**
 * Sólo dos comprobaciones, y ambas son las que un cotejo de migración busca:
 * que exista tramo principal y que su trayecto sea el de la ruta.
 */
function revisarIntegridad(r: DetalleRuta): Array<string> {
  const avisos: Array<string> = []
  const principal = r.tramos.find((t) => t.principal)

  if (r.tramos.length === 0) return avisos

  if (!principal) {
    avisos.push(
      `Ninguno de los ${entero(r.tramos.length)} tramos de esta ruta está marcado como principal (isMain). Sin tramo principal no hay trayecto origen–destino vendible.`,
    )
    return avisos
  }

  if (principal.origen.id !== r.origen.id) {
    avisos.push(
      `El origen de la ruta es ${r.origen.clave} (${r.origen.nombre}), pero el del tramo principal ${principal.numero} es ${principal.origen.clave} (${principal.origen.nombre}).`,
    )
  }
  if (principal.destino.id !== r.destino.id) {
    avisos.push(
      `El destino de la ruta es ${r.destino.clave} (${r.destino.nombre}), pero el del tramo principal ${principal.numero} es ${principal.destino.clave} (${principal.destino.nombre}).`,
    )
  }

  return avisos
}

function Integridad({ avisos }: { avisos: Array<string> }) {
  return (
    <section aria-label="Verificación de integridad" className="pb-2">
      <Rotulo>Verificación de integridad</Rotulo>
      {avisos.length === 0 ? (
        <p className="mt-2 text-dato text-tinta-3">
          El tramo principal coincide con el origen y el destino de la ruta.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {avisos.map((aviso) => (
            <li key={aviso} className="flex items-start gap-2.5">
              <Sello tono="aviso" className="mt-px shrink-0">
                Aviso
              </Sello>
              <span className="text-lectura text-tinta-2">{aviso}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
