import { useEffect, useRef, useState } from 'react'
import { useRouter, useRouterState } from '@tanstack/react-router'
import { RotateCw } from 'lucide-react'
import { cn } from '~/lib/cn'

const HORA = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

/**
 * Relee el catálogo desde la base.
 *
 * Invalida los `loader` del router, así que vuelve a consultar Postgres de
 * verdad — no repinta una caché. Junto al botón queda la hora de la última
 * lectura: en un visor de migración importa saber *de cuándo* es lo que estás
 * viendo, sobre todo si alguien está reimportando datos mientras lo revisas.
 *
 * La hora se sella sólo en el cliente (queda en null durante el render del
 * servidor) para que no haya discrepancia de hidratación.
 */
export function BotonActualizar({
  className,
  mostrarSello = true,
}: {
  className?: string
  /** Se apaga donde el encabezado ya imprime su propia marca de tiempo. */
  mostrarSello?: boolean
}) {
  const router = useRouter()
  const cargando = useRouterState({ select: (s) => s.isLoading })
  const [sello, setSello] = useState<Date | null>(null)
  const estabaCargando = useRef(false)

  // Se sella al terminar cada lectura, incluida la primera.
  useEffect(() => {
    if (estabaCargando.current && !cargando) setSello(new Date())
    estabaCargando.current = cargando
  }, [cargando])

  useEffect(() => {
    setSello((previo) => previo ?? new Date())
  }, [])

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {mostrarSello && sello ? (
        <span data-cifra className="hidden font-mono text-nota text-tinta-3 sm:inline">
          Leído {HORA.format(sello)}
        </span>
      ) : null}

      <button
        type="button"
        onClick={() => void router.invalidate()}
        disabled={cargando}
        aria-label="Volver a leer el catálogo desde la base de datos"
        title="Volver a leer el catálogo desde la base de datos"
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-chip border border-raya px-3',
          'font-mono text-nota font-medium tracking-[0.08em] text-tinta-2 uppercase',
          'transition-[colors,transform] duration-100',
          'hover:border-raya-firme hover:bg-renglon hover:text-tinta',
          'active:scale-[0.97]',
          'disabled:pointer-events-none disabled:text-tinta-3',
        )}
      >
        <RotateCw
          size={13}
          strokeWidth={1.75}
          aria-hidden
          className={cn('shrink-0', cargando && 'animate-[girar_700ms_linear_infinite]')}
        />
        {cargando ? 'Leyendo…' : 'Actualizar'}
      </button>
    </div>
  )
}
