import type { ReactNode } from 'react'
import { PlugZap, SearchX, TriangleAlert } from 'lucide-react'
import { cn } from '~/lib/cn'
import { Regla } from './base'

/* ── Vacío ────────────────────────────────────────────────────────────────
   Dos vacíos distintos, y la diferencia importa: una tabla sin resultados
   por un filtro no es lo mismo que una tabla sin registros.                 */
export function EstadoVacio({
  titulo,
  detalle,
  accion,
}: {
  titulo: string
  detalle?: string
  accion?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <SearchX size={22} strokeWidth={1.25} className="text-tinta-4" aria-hidden />
      <h3 className="mt-4 text-rubro font-medium text-tinta-2">{titulo}</h3>
      {detalle ? (
        <p className="mt-1.5 max-w-sm text-lectura text-tinta-3">{detalle}</p>
      ) : null}
      {accion ? <div className="mt-5">{accion}</div> : null}
    </div>
  )
}

/* ── Error ────────────────────────────────────────────────────────────────
   El fallo más probable de este visor es de conexión, no de código: la
   pantalla de error dice qué revisar, no sólo que algo falló.               */
export function EstadoError({
  titulo,
  detalle,
  sugerencia,
  alReintentar,
}: {
  titulo: string
  detalle?: string
  sugerencia?: string
  alReintentar?: () => void
}) {
  const esConexion = /conexión|DATABASE_URL|respuesta|credencial/i.test(
    `${titulo} ${sugerencia ?? ''}`,
  )
  const Icono = esConexion ? PlugZap : TriangleAlert

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <div className="rounded-hoja border border-oxido/25 bg-oxido-lavado p-6">
        <div className="flex items-start gap-3">
          <Icono size={18} strokeWidth={1.5} className="mt-0.5 shrink-0 text-oxido" aria-hidden />
          <div className="min-w-0 flex-1">
            <h3 className="text-rubro font-medium text-tinta">{titulo}</h3>
            {sugerencia ? (
              <p className="mt-2 text-lectura text-tinta-2">{sugerencia}</p>
            ) : null}

            {detalle ? (
              <>
                <Regla className="my-4 opacity-60" />
                <pre className="overflow-x-auto font-mono text-nota leading-relaxed whitespace-pre-wrap text-tinta-3">
                  {detalle}
                </pre>
              </>
            ) : null}

            {alReintentar ? (
              <button
                type="button"
                onClick={alReintentar}
                className={cn(
                  'mt-5 inline-flex h-8 items-center rounded-chip border border-oxido/40 px-3',
                  'font-mono text-nota font-medium tracking-[0.08em] text-oxido uppercase',
                  'transition-[colors,transform] duration-100 hover:bg-oxido/10 active:scale-[0.97]',
                )}
              >
                Reintentar
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Esqueleto ────────────────────────────────────────────────────────────
   Pulso muy tenue: el papel no parpadea. Sólo opacidad, nunca layout.       */
export function Barra({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <span
      aria-hidden
      style={style}
      className={cn(
        'block h-[10px] animate-[latido_1.6s_ease-in-out_infinite] rounded-chip bg-raya',
        className,
      )}
    />
  )
}

export function ManifiestoCargando({
  columnas,
  renglones = 8,
}: {
  columnas: Array<number>
  renglones?: number
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="px-4">
      <span className="sr-only">Cargando registros…</span>
      {Array.from({ length: renglones }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-raya-tenue py-[13px] last:border-b-0"
          style={{ opacity: 1 - i * 0.075 }}
        >
          {columnas.map((ancho, j) => (
            <Barra key={j} style={{ width: `${ancho}%` }} className="shrink-0" />
          ))}
        </div>
      ))}
    </div>
  )
}
