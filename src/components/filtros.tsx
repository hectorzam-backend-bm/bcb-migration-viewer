import { useEffect, useId, useMemo, useRef, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '~/lib/cn'
import { entero } from '~/lib/formato'

/* ── Buscador ─────────────────────────────────────────────────────────────
   El campo va hundido respecto a la hoja, no elevado: recibe contenido.
   Escribe a la URL con retardo para que el enlace sea siempre compartible.  */
export function Buscador({
  valor,
  alCambiar,
  marcador,
  retardo = 250,
  className,
}: {
  valor: string
  alCambiar: (valor: string) => void
  marcador: string
  retardo?: number
  className?: string
}) {
  const [borrador, setBorrador] = useState(valor)
  const ultimoEmitido = useRef(valor)
  const campo = useRef<HTMLInputElement>(null)

  // La URL manda: si cambia desde fuera (atrás/adelante, limpiar filtros), se refleja.
  useEffect(() => {
    if (valor !== ultimoEmitido.current) {
      ultimoEmitido.current = valor
      setBorrador(valor)
    }
  }, [valor])

  useEffect(() => {
    if (borrador === ultimoEmitido.current) return
    const id = setTimeout(() => {
      ultimoEmitido.current = borrador
      alCambiar(borrador)
    }, retardo)
    return () => clearTimeout(id)
  }, [borrador, retardo, alCambiar])

  return (
    <div className={cn('relative', className)}>
      <Search
        size={14}
        strokeWidth={1.75}
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-4"
      />
      <input
        ref={campo}
        type="search"
        value={borrador}
        onChange={(e) => setBorrador(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && borrador) {
            e.preventDefault()
            setBorrador('')
          }
        }}
        placeholder={marcador}
        aria-label={marcador}
        className={cn(
          'h-9 w-full rounded-chip border border-raya bg-hundido pr-8 pl-8.5 text-lectura text-tinta',
          'placeholder:text-tinta-4 transition-colors duration-100',
          'hover:border-raya-firme focus:border-sello/50 focus:outline-none',
          '[&::-webkit-search-cancel-button]:hidden',
        )}
      />
      {borrador ? (
        <button
          type="button"
          onClick={() => {
            setBorrador('')
            campo.current?.focus()
          }}
          aria-label="Limpiar búsqueda"
          className="absolute top-1/2 right-1 grid size-7 -translate-y-1/2 place-items-center rounded-chip text-tinta-4 transition-colors duration-100 hover:text-tinta-2"
        >
          <X size={13} strokeWidth={2} />
        </button>
      ) : null}
    </div>
  )
}

export type Opcion = { valor: string; etiqueta: string; nota?: string }

/* ── Filtro de lista ──────────────────────────────────────────────────────
   Se compone sobre Radix Popover: teclado, foco y colisión ya resueltos.
   El panel es la única capa que se eleva sobre el papel, y por eso es la
   única que lleva sombra.                                                   */
export function FiltroLista({
  nombre,
  opciones,
  seleccion,
  alCambiar,
  buscable,
}: {
  nombre: string
  opciones: Array<Opcion>
  seleccion: Array<string>
  alCambiar: (seleccion: Array<string>) => void
  buscable?: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const [consulta, setConsulta] = useState('')
  const idBusqueda = useId()

  const conBusqueda = buscable ?? opciones.length > 8
  const visibles = useMemo(() => {
    if (!consulta.trim()) return opciones
    const q = consulta.trim().toLowerCase()
    return opciones.filter(
      (o) =>
        o.etiqueta.toLowerCase().includes(q) || o.valor.toLowerCase().includes(q),
    )
  }, [opciones, consulta])

  const activo = seleccion.length > 0
  const resumen =
    seleccion.length === 0
      ? null
      : seleccion.length === 1
        ? (opciones.find((o) => o.valor === seleccion[0])?.etiqueta ?? seleccion[0])
        : `${entero(seleccion.length)} seleccionados`

  function alternar(valor: string) {
    alCambiar(
      seleccion.includes(valor)
        ? seleccion.filter((v) => v !== valor)
        : [...seleccion, valor],
    )
  }

  return (
    <Popover.Root
      open={abierto}
      onOpenChange={(o) => {
        setAbierto(o)
        if (!o) setConsulta('')
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-9 max-w-[15rem] items-center gap-2 rounded-chip border px-3 text-lectura',
            'transition-[colors,transform] duration-100 active:scale-[0.98]',
            activo
              ? 'border-sello/40 bg-sello-lavado text-tinta'
              : 'border-raya border-dashed bg-transparent text-tinta-2 hover:border-raya-firme hover:border-solid hover:bg-renglon',
          )}
        >
          <span className="shrink-0 font-medium">{nombre}</span>
          {resumen ? (
            <>
              <span className="h-3.5 w-px shrink-0 bg-sello/30" aria-hidden />
              <span className="truncate font-mono text-dato text-sello">{resumen}</span>
            </>
          ) : null}
          <ChevronDown
            size={13}
            strokeWidth={1.75}
            aria-hidden
            className={cn(
              'shrink-0 text-tinta-4 transition-transform duration-150',
              abierto && 'rotate-180',
            )}
          />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            'z-50 w-[17rem] origin-(--radix-popover-content-transform-origin)',
            'rounded-flotante border border-raya bg-hoja shadow-alzada',
            'data-[state=open]:animate-[surgir_150ms_var(--ease-salida)]',
            'data-[state=closed]:animate-[desvanecer_100ms_ease-out]',
          )}
        >
          {conBusqueda ? (
            <div className="border-b border-raya p-2">
              <label htmlFor={idBusqueda} className="sr-only">
                Buscar en {nombre}
              </label>
              <input
                id={idBusqueda}
                autoFocus
                value={consulta}
                onChange={(e) => setConsulta(e.target.value)}
                placeholder={`Buscar ${nombre.toLowerCase()}…`}
                className="h-8 w-full rounded-chip border border-raya bg-hundido px-2.5 text-lectura text-tinta placeholder:text-tinta-4 focus:border-sello/50 focus:outline-none"
              />
            </div>
          ) : null}

          <div className="max-h-[17rem] overflow-y-auto p-1">
            {visibles.length === 0 ? (
              <p className="px-2.5 py-6 text-center text-lectura text-tinta-4">
                Sin coincidencias
              </p>
            ) : (
              visibles.map((o) => {
                const marcada = seleccion.includes(o.valor)
                return (
                  <button
                    key={o.valor}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={marcada}
                    onClick={() => alternar(o.valor)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-chip px-2 py-1.5 text-left transition-colors duration-75',
                      'hover:bg-renglon focus-visible:bg-renglon',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'grid size-[15px] shrink-0 place-items-center rounded-[2px] border transition-colors duration-100',
                        marcada
                          ? 'border-sello bg-sello text-hoja'
                          : 'border-raya-firme',
                      )}
                    >
                      {marcada ? <Check size={10} strokeWidth={3} /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-lectura text-tinta">
                      {o.etiqueta}
                    </span>
                    {o.nota ? (
                      <span data-cifra className="shrink-0 font-mono text-nota text-tinta-4">
                        {o.nota}
                      </span>
                    ) : null}
                  </button>
                )
              })
            )}
          </div>

          {activo ? (
            <div className="border-t border-raya p-1">
              <button
                type="button"
                onClick={() => alCambiar([])}
                className="w-full rounded-chip px-2 py-1.5 text-left font-mono text-nota tracking-[0.07em] text-tinta-3 uppercase transition-colors duration-75 hover:bg-renglon hover:text-tinta-2"
              >
                Quitar selección
              </button>
            </div>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/* ── Barra de filtros ─────────────────────────────────────────────────────
   Zona de control: densa y apretada, para que el manifiesto de abajo
   respire por contraste.                                                    */
export function BarraDeFiltros({
  children,
  hayFiltros,
  alLimpiar,
}: {
  children: React.ReactNode
  hayFiltros?: boolean
  alLimpiar?: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-raya px-4 py-3">
      {children}
      {hayFiltros && alLimpiar ? (
        <button
          type="button"
          onClick={alLimpiar}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-chip px-2.5 font-mono text-nota font-medium tracking-[0.07em] text-tinta-3 uppercase transition-colors duration-100 hover:bg-renglon hover:text-tinta"
        >
          <X size={12} strokeWidth={2} aria-hidden />
          Limpiar filtros
        </button>
      ) : null}
    </div>
  )
}
