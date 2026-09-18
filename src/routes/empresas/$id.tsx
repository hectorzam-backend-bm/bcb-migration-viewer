import { createFileRoute, notFound } from '@tanstack/react-router'
import { Cifra, Clave, Dato, Hoja, Regla, Sello, SelloActividad } from '~/components/base'
import { Encabezado, Miga, Migas, SeparadorMiga } from '~/components/cascaron'
import { Barra, EstadoError, EstadoVacio } from '~/components/estados'
import { Ficha, Rejilla, Vinculo } from '~/components/ficha'
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
import { SIN_DATO, entero, fechaHora, plural } from '~/lib/formato'
import { obtenerEmpresa } from '~/server/empresas'

/* ───────────────────────────────────────────────────────────────────────────
   Ficha de empresa. El detalle vale por lo que enlaza: cada servicio lleva
   al suyo, y el bloque de alcance dice cuánto catálogo cuelga de aquí.
   ─────────────────────────────────────────────────────────────────────────── */

export const Route = createFileRoute('/empresas/$id')({
  loader: async ({ params }) => {
    const resultado = await obtenerEmpresa({ data: { id: params.id } })
    if (resultado.ok && resultado.empresa === null) throw notFound()
    return resultado
  },
  component: Pantalla,
  pendingComponent: FichaCargando,
  notFoundComponent: () => (
    <>
      <Encabezado
        titulo="Empresa no encontrada"
        migas={
          <Migas>
            <Miga to="/empresas">Empresas</Miga>
            <SeparadorMiga />
            <span className="text-tinta-4">?</span>
          </Migas>
        }
      />
      <EstadoVacio
        titulo="No existe una empresa con ese identificador"
        detalle="El registro pudo borrarse de la base o la dirección está mal copiada. Vuelve al catálogo para buscarla por clave."
      />
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <EstadoError
      titulo="No fue posible leer la ficha de la empresa"
      detalle={error instanceof Error ? error.message : String(error)}
      alReintentar={reset}
    />
  ),
})

function FichaCargando() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="px-4 sm:px-8 pt-7">
      <span className="sr-only">Cargando la ficha de la empresa…</span>
      <Barra className="h-[22px] w-64" />
      <Regla doble className="mt-5" />
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Hoja className="p-5 lg:col-span-2">
          <div className="grid gap-5 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ opacity: 1 - i * 0.1 }}>
                <Barra className="h-[8px] w-20" />
                <Barra className="mt-2 w-40" />
              </div>
            ))}
          </div>
        </Hoja>
        <Hoja className="p-5">
          <div className="grid gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ opacity: 1 - i * 0.15 }}>
                <Barra className="h-[8px] w-24" />
                <Barra className="mt-2 h-[20px] w-16" />
              </div>
            ))}
          </div>
        </Hoja>
      </div>
    </div>
  )
}

function Pantalla() {
  const resultado = Route.useLoaderData()

  if (!resultado.ok) {
    return (
      <>
        <Encabezado titulo="Empresa" renglon={SIN_DATO} />
        <EstadoError {...resultado.falla} />
      </>
    )
  }

  const empresa = resultado.empresa
  if (!empresa) return null

  const serviciosDeBaja = empresa.servicios.filter((s) => s.eliminada).length

  return (
    <>
      <Encabezado
        acciones={<BotonActualizar />}
        titulo={empresa.nombreComercial}
        migas={
          <Migas>
            <Miga to="/empresas">Empresas</Miga>
            <SeparadorMiga />
            <span className="text-tinta-2">{empresa.clave}</span>
          </Migas>
        }
        renglon={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Clave enfasis>{empresa.clave}</Clave>
            <span aria-hidden className="text-tinta-4">
              ·
            </span>
            <SelloActividad activa={empresa.activa} eliminada={empresa.eliminada} />
            {empresa.hcmDesactivada ? (
              <Sello
                tono="aviso"
                titulo="HCM la reportó ausente o con estatus N. Es meramente informativo: no afecta el funcionamiento del sistema."
              >
                HCM
              </Sello>
            ) : null}
          </span>
        }
      />

      <div className="px-4 sm:px-8 py-6">
        <div className="grid gap-5 lg:grid-cols-3">
          <Ficha titulo="Identificación" className="lg:col-span-2">
            <Rejilla columnas={2}>
              <Dato rotulo="Clave" mono>
                {empresa.clave || SIN_DATO}
              </Dato>
              <Dato rotulo="Nombre corto">{empresa.nombreCorto || SIN_DATO}</Dato>
              <Dato rotulo="Nombre comercial">
                {empresa.nombreComercial || SIN_DATO}
              </Dato>
              <Dato rotulo="Razón social">{empresa.razonSocial || SIN_DATO}</Dato>
              <Dato rotulo="Estatus">
                <SelloActividad
                  activa={empresa.activa}
                  eliminada={empresa.eliminada}
                />
              </Dato>
              <Dato rotulo="Identificador" mono>
                <span className="break-all text-tinta-3">{empresa.id}</span>
              </Dato>
            </Rejilla>
          </Ficha>

          <Ficha titulo="Alcance" nota="registros vigentes">
            <div className="grid gap-5 sm:grid-cols-3 lg:grid-cols-1">
              <Cifra
                rotulo="Servicios"
                valor={entero(empresa.alcance.servicios)}
                nota={
                  serviciosDeBaja > 0
                    ? `${plural(serviciosDeBaja, 'servicio dado de baja', 'servicios dados de baja')}, fuera del conteo`
                    : 'Servicios sin borrado lógico'
                }
              />
              <Cifra
                rotulo="Terminales alcanzadas"
                valor={entero(empresa.alcance.terminales)}
                nota="Distintas, a través de sus servicios"
              />
              <Cifra
                rotulo="Rutas"
                valor={entero(empresa.alcance.rutas)}
                nota="De todos sus servicios vigentes"
              />
            </div>
          </Ficha>
        </div>

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
          <Ficha titulo="Sincronización HCM">
            <Rejilla columnas={2}>
              <Dato rotulo="Marca de ausencia">
                {empresa.hcmDesactivada ? (
                  <Sello tono="aviso">Reportada ausente</Sello>
                ) : (
                  <span className="text-tinta-2">Sin marca</span>
                )}
              </Dato>
              <Dato rotulo="Origen del registro">
                <span className="text-tinta-2">
                  {empresa.sincronizadaPorHcm
                    ? 'Sincronizada por HCM'
                    : 'Creada a mano'}
                </span>
              </Dato>
              <Dato rotulo="Última corrida que la trajo" mono ancho>
                {empresa.hcmRunId ? (
                  <span className="break-all">{empresa.hcmRunId}</span>
                ) : (
                  <span className="text-tinta-4">{SIN_DATO}</span>
                )}
              </Dato>
            </Rejilla>
            <Regla className="my-4" />
            <p className="text-dato leading-relaxed text-tinta-3">
              Estos dos campos son <strong className="font-medium">meramente
              informativos</strong> y no alteran el funcionamiento del sistema. Los
              escribe únicamente la sincronización con HCM, nunca el CRUD: una
              empresa sin corrida registrada se capturó a mano y jamás debe
              marcarse como ausente.
            </p>
          </Ficha>

          <Ficha titulo="Rastro">
            <Rejilla columnas={2}>
              <Dato rotulo="Creado" mono>
                {fechaHora(empresa.creadoEn)}
              </Dato>
              <Dato rotulo="Creado por">
                {empresa.creadoPor ?? (
                  <span className="text-tinta-4">{SIN_DATO}</span>
                )}
              </Dato>
              <Dato rotulo="Última actualización" mono>
                {fechaHora(empresa.actualizadoEn)}
              </Dato>
              <Dato rotulo="Actualizado por">
                {empresa.actualizadoPor ?? (
                  <span className="text-tinta-4">{SIN_DATO}</span>
                )}
              </Dato>
              {empresa.eliminadoEn ? (
                <Dato rotulo="Dada de baja" mono ancho>
                  <span className="text-oxido">{fechaHora(empresa.eliminadoEn)}</span>
                </Dato>
              ) : null}
            </Rejilla>
          </Ficha>
        </div>

        <Ficha
          titulo="Servicios"
          nota={plural(empresa.servicios.length, 'servicio', 'servicios')}
          className="mt-5"
        >
          <div className="-m-5">
            {empresa.servicios.length === 0 ? (
              <EstadoVacio
                titulo="Esta empresa migró sin servicios asociados"
                detalle="No hay ningún registro de Service que apunte a esta empresa. En el sistema anterior la empresa existía, pero ningún servicio quedó ligado a ella."
              />
            ) : (
              <Manifiesto etiqueta={`Servicios de ${empresa.nombreComercial}`}>
                <Cabecera>
                  <Th>Clave</Th>
                  <Th>Número</Th>
                  <Th>Nombre</Th>
                  <Th>Estatus</Th>
                </Cabecera>
                <Cuerpo>
                  {empresa.servicios.map((servicio) => (
                    <Fila key={servicio.id} atenuada={servicio.eliminada}>
                      <Td>
                        <EnlaceDeFila
                          to="/servicios/$id"
                          params={{ id: servicio.id }}
                          className="inline-block"
                        >
                          <Clave enfasis>{servicio.clave}</Clave>
                        </EnlaceDeFila>
                      </Td>
                      <Td numerica className="text-tinta-2">
                        {servicio.numero || SIN_DATO}
                      </Td>
                      <Td className="text-tinta">{servicio.nombre || SIN_DATO}</Td>
                      <Td>
                        <SelloActividad
                          activa={servicio.activa}
                          eliminada={servicio.eliminada}
                        />
                      </Td>
                    </Fila>
                  ))}
                </Cuerpo>
              </Manifiesto>
            )}
          </div>
        </Ficha>

        <p className="mt-5 text-dato text-tinta-3">
          <Vinculo to="/servicios" search={{ empresa: [empresa.id] }}>
            Ver estos servicios en el catálogo completo
          </Vinculo>
        </p>
      </div>
    </>
  )
}
