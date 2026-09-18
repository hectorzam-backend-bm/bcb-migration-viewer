import { createFileRoute } from '@tanstack/react-router'
import { Clave, Dato, Hoja, Sello, SelloActividad } from '~/components/base'
import { Encabezado, Miga, Migas, SeparadorMiga } from '~/components/cascaron'
import { EstadoError, EstadoVacio, ManifiestoCargando } from '~/components/estados'
import { Ficha, Pestana, Pestanas, Rejilla, Vinculo } from '~/components/ficha'
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
import { SIN_DATO, TIPO_TERMINAL, entero, fechaHora, moneda, porcentaje } from '~/lib/formato'
import { limpiarBusqueda, unoDe } from '~/lib/parametros'
import { obtenerServicio, type Servicio } from '~/server/servicios'

const FICHAS = ['terminales', 'rutas', 'pasajeros'] as const
type Solapa = (typeof FICHAS)[number]
type BusquedaServicio = { ficha: Solapa }

const POR_OMISION: BusquedaServicio = { ficha: 'terminales' }

export const Route = createFileRoute('/servicios/$id')({
  validateSearch: (entrada: Record<string, unknown>): BusquedaServicio => ({
    ficha: unoDe(entrada.ficha, FICHAS, 'terminales'),
  }),
  loader: ({ params }) => obtenerServicio({ data: { id: params.id } }),
  component: Pantalla,
  pendingComponent: () => (
    <>
      <Encabezado titulo="Servicio" renglon="Leyendo la ficha…" />
      <div className="px-4 sm:px-8 py-6">
        <Hoja className="overflow-hidden py-2">
          <ManifiestoCargando columnas={[18, 26, 30, 14]} renglones={6} />
        </Hoja>
      </div>
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <>
      <Encabezado titulo="Servicio" renglon={SIN_DATO} />
      <EstadoError
        titulo="No fue posible leer la ficha del servicio"
        detalle={error instanceof Error ? error.message : String(error)}
        alReintentar={reset}
      />
    </>
  ),
})

function Pantalla() {
  const datos = Route.useLoaderData()
  const { ficha } = Route.useSearch()
  const navigate = Route.useNavigate()

  if (!datos.ok) {
    return (
      <>
        <Encabezado
          titulo="Servicio"
          renglon={SIN_DATO}
          migas={
            <Migas>
              <Miga to="/servicios">Servicios</Miga>
            </Migas>
          }
        />
        <EstadoError {...datos.falla} />
      </>
    )
  }

  const s = datos.servicio

  function alCambiarFicha(valor: string) {
    navigate({
      search: () =>
        limpiarBusqueda(
          { ficha: unoDe(valor, FICHAS, 'terminales') },
          POR_OMISION,
        ) as BusquedaServicio,
      replace: true,
    })
  }

  return (
    <>
      <Encabezado
        migas={
          <Migas>
            <Miga to="/servicios">Servicios</Miga>
            <SeparadorMiga />
            <span className="text-tinta-2">{s.clave || SIN_DATO}</span>
          </Migas>
        }
        titulo={s.nombre}
        renglon={
          <>
            {s.clave || SIN_DATO}
            <span className="px-1.5 text-tinta-4">·</span>
            No. {s.numero || SIN_DATO}
          </>
        }
        acciones={
          <>
            <SelloActividad activa={s.activo} eliminada={s.eliminado} />
            {s.hcmDesactivado ? (
              <Sello tono="aviso" titulo="hcmDisabled — marca informativa de la sincronización HCM">
                HCM
              </Sello>
            ) : null}
            <span aria-hidden className="h-4 w-px bg-raya" />
            <BotonActualizar />
          </>
        }
      />

      <div className="space-y-5 px-4 sm:px-8 py-6">
        <Ficha titulo="Identificación">
          <Rejilla columnas={2}>
            <Dato rotulo="Clave servicio" mono>
              {s.clave || SIN_DATO}
            </Dato>
            <Dato rotulo="No. servicio" mono>
              {s.numero || SIN_DATO}
            </Dato>
            <Dato rotulo="Nombre del servicio" ancho>
              {s.nombre || SIN_DATO}
            </Dato>
            <Dato rotulo="Nombre corto">{s.nombreCorto || SIN_DATO}</Dato>
            <Dato rotulo="Cuenta" mono>
              {s.cuenta ?? SIN_DATO}
            </Dato>
            <Dato rotulo="Estatus">
              <SelloActividad activa={s.activo} eliminada={s.eliminado} />
            </Dato>
            <Dato rotulo="Despacho anticipado">
              {s.despachoAnticipado ? 'Sí' : 'No'}
            </Dato>
          </Rejilla>
        </Ficha>

        <div className="grid gap-5 lg:grid-cols-3">
          <FichaEmpresa empresa={s.empresa} />

          <Ficha titulo="Sincronización HCM" nota="informativo">
            <div className="space-y-5">
              <Dato rotulo="Marca HCM">
                {s.hcmDesactivado ? (
                  <Sello tono="aviso">Inhabilitado por HCM</Sello>
                ) : (
                  <span className="text-tinta-2">Sin marca</span>
                )}
              </Dato>
              <Dato rotulo="Última corrida vista" mono>
                {s.hcmUltimaCorrida ?? SIN_DATO}
              </Dato>
              <Dato rotulo="Origen del registro">
                {s.hcmUltimaCorrida === null ? 'Alta manual' : 'Gestionado por HCM'}
              </Dato>
            </div>
            <p className="mt-6 text-nota leading-relaxed text-tinta-3">
              Estas marcas son informativas: no alteran el funcionamiento del sistema.
            </p>
          </Ficha>

          <Ficha titulo="Rastro">
            <div className="space-y-5">
              <Dato rotulo="Creado" mono>
                {fechaHora(s.creado)}
              </Dato>
              <Dato rotulo="Actualizado" mono>
                {fechaHora(s.actualizado)}
              </Dato>
              <Dato rotulo="Dado de baja" mono>
                {s.dadoDeBaja ? (
                  <span className="text-oxido">{fechaHora(s.dadoDeBaja)}</span>
                ) : (
                  SIN_DATO
                )}
              </Dato>
              <Dato rotulo="Identificador" mono>
                <span className="break-all text-tinta-2">{s.id}</span>
              </Dato>
            </div>
          </Ficha>
        </div>

        <Hoja className="overflow-hidden">
          <Pestanas
            valor={ficha}
            alCambiar={alCambiarFicha}
            opciones={[
              { valor: 'terminales', rotulo: 'Terminales', conteo: s.terminales.length },
              { valor: 'rutas', rotulo: 'Rutas', conteo: s.rutas.length },
              {
                valor: 'pasajeros',
                rotulo: 'Tipos de pasajero',
                conteo: s.tiposDePasajero.length,
              },
            ]}
          >
            <Pestana valor="terminales">
              <TablaTerminales terminales={s.terminales} />
            </Pestana>
            <Pestana valor="rutas">
              <TablaRutas rutas={s.rutas} />
            </Pestana>
            <Pestana valor="pasajeros">
              <TablaPasajeros tipos={s.tiposDePasajero} />
            </Pestana>
          </Pestanas>
        </Hoja>
      </div>
    </>
  )
}

/* ── Empresa ───────────────────────────────────────────────────────────────
   El cruce importa más que el dato: la clave y el nombre comercial llevan al
   expediente de la empresa. El sello sólo aparece si la empresa es anómala. */
function FichaEmpresa({ empresa }: { empresa: Servicio['empresa'] }) {
  const anomala = empresa.eliminada || !empresa.activa

  return (
    <Ficha titulo="Empresa">
      <div className="space-y-5">
        <Dato rotulo="Clave">
          <Vinculo to="/empresas/$id" params={{ id: empresa.id }}>
            <Clave enfasis>{empresa.clave || SIN_DATO}</Clave>
          </Vinculo>
        </Dato>
        <Dato rotulo="Nombre comercial">
          <span className="flex flex-wrap items-center gap-2">
            <Vinculo to="/empresas/$id" params={{ id: empresa.id }}>
              {empresa.nombreComercial || empresa.nombreCorto || SIN_DATO}
            </Vinculo>
            {anomala ? (
              <SelloActividad activa={empresa.activa} eliminada={empresa.eliminada} />
            ) : null}
          </span>
        </Dato>
        <Dato rotulo="Razón social">
          <span className="text-tinta-2">{empresa.razonSocial || SIN_DATO}</span>
        </Dato>
      </div>
    </Ficha>
  )
}

/* ── Pestañas ──────────────────────────────────────────────────────────── */

function TablaTerminales({ terminales }: { terminales: Servicio['terminales'] }) {
  if (terminales.length === 0) {
    return (
      <EstadoVacio
        titulo="Sin terminales asociadas"
        detalle="Este servicio no tiene ninguna terminal ligada en la base migrada."
      />
    )
  }

  return (
    <Manifiesto etiqueta="Terminales del servicio">
      <Cabecera>
        <Th numerica>Número</Th>
        <Th>Nombre corto</Th>
        <Th>Nombre</Th>
        <Th>Tipo</Th>
        <Th>Estado</Th>
        <Th>Estatus</Th>
      </Cabecera>
      <Cuerpo>
        {terminales.map((t) => (
          <Fila key={t.id} atenuada={t.eliminada}>
            <Td numerica>
              <EnlaceDeFila to="/terminales/$id" params={{ id: t.id }}>
                <Clave enfasis>{t.numero || SIN_DATO}</Clave>
              </EnlaceDeFila>
            </Td>
            <Td className="text-tinta-2">{t.nombreCorto || SIN_DATO}</Td>
            <Td>
              <span className="block max-w-[24rem] truncate" title={t.nombre}>
                {t.nombre || SIN_DATO}
              </span>
            </Td>
            <Td className="text-tinta-2">{TIPO_TERMINAL[t.tipo] ?? t.tipo ?? SIN_DATO}</Td>
            <Td className="text-tinta-2">{t.estado || SIN_DATO}</Td>
            <Td>
              <SelloActividad activa={t.activa} eliminada={t.eliminada} />
            </Td>
          </Fila>
        ))}
      </Cuerpo>
    </Manifiesto>
  )
}

function TablaRutas({ rutas }: { rutas: Servicio['rutas'] }) {
  if (rutas.length === 0) {
    return (
      <EstadoVacio
        titulo="Sin rutas registradas"
        detalle="Este servicio no tiene ninguna ruta ligada en la base migrada."
      />
    )
  }

  return (
    <Manifiesto etiqueta="Rutas del servicio">
      <Cabecera>
        <Th numerica>Número</Th>
        <Th>Nombre</Th>
        <Th>Origen → destino</Th>
        <Th numerica>Tramos</Th>
        <Th numerica>Tarifa sencilla</Th>
        <Th>Estatus</Th>
      </Cabecera>
      <Cuerpo>
        {rutas.map((r) => (
          <Fila key={r.id} atenuada={r.eliminada}>
            <Td numerica>
              <EnlaceDeFila to="/rutas/$id" params={{ id: r.id }}>
                <Clave enfasis>{r.numero || SIN_DATO}</Clave>
              </EnlaceDeFila>
            </Td>
            <Td>
              <span className="block max-w-[22rem] truncate" title={r.nombre}>
                {r.nombre || SIN_DATO}
              </span>
            </Td>
            <Td>
              <span className="font-mono text-dato text-tinta-2">
                {r.origen || SIN_DATO}
                <span className="px-1.5 text-tinta-4">→</span>
                {r.destino || SIN_DATO}
              </span>
            </Td>
            <Td numerica>
              <span className={r.tramos === 0 ? 'text-tinta-4' : undefined}>
                {entero(r.tramos)}
              </span>
            </Td>
            <Td numerica>{moneda(r.tarifaSencilla)}</Td>
            <Td>
              <SelloActividad activa={r.activa} eliminada={r.eliminada} />
            </Td>
          </Fila>
        ))}
      </Cuerpo>
    </Manifiesto>
  )
}

function TablaPasajeros({ tipos }: { tipos: Servicio['tiposDePasajero'] }) {
  if (tipos.length === 0) {
    return (
      <EstadoVacio
        titulo="Sin tipos de pasajero asignados"
        detalle="Este servicio no tiene ningún tipo de pasajero ligado en la base migrada."
      />
    )
  }

  return (
    <Manifiesto etiqueta="Tipos de pasajero del servicio">
      <Cabecera>
        <Th>Clave</Th>
        <Th>Nombre</Th>
        <Th numerica>Descuento</Th>
        <Th numerica>Límite de asientos</Th>
        <Th>Documento requerido</Th>
        <Th>Estatus</Th>
      </Cabecera>
      <Cuerpo>
        {tipos.map((p) => (
          <Fila key={p.id} atenuada={p.eliminado}>
            <Td>
              <Clave enfasis>{p.clave || SIN_DATO}</Clave>
            </Td>
            <Td>
              <span className="block max-w-[22rem] truncate" title={p.descripcion ?? p.nombre}>
                {p.nombre || SIN_DATO}
              </span>
            </Td>
            <Td numerica>
              <span className={p.descuento === 0 ? 'text-tinta-4' : undefined}>
                {porcentaje(p.descuento)}
              </span>
            </Td>
            <Td numerica>
              {p.limiteAsientos === null ? (
                <span className="text-tinta-4" title="Sin límite">
                  {SIN_DATO}
                </span>
              ) : (
                entero(p.limiteAsientos)
              )}
            </Td>
            <Td className="text-tinta-2">
              {p.documentoRequerido
                ? p.tipoDeDocumento
                  ? `Sí · ${p.tipoDeDocumento}`
                  : 'Sí'
                : 'No'}
            </Td>
            <Td>
              <SelloActividad activa={p.activo} eliminada={p.eliminado} />
            </Td>
          </Fila>
        ))}
      </Cuerpo>
    </Manifiesto>
  )
}
