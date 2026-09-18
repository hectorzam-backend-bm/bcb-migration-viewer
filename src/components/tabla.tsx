import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import {
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import type { LinkProps } from '@tanstack/react-router'
import { cn } from '~/lib/cn'
import { entero } from '~/lib/formato'

/* El manifiesto: una tabla reglada. Sin zebra —la raya fina ya guía el ojo—
   y sin bordes verticales, que cortarían el renglón en pedazos.            */

export function Manifiesto({
  children,
  className,
  etiqueta,
}: {
  children: ReactNode
  className?: string
  etiqueta: string
}) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table
        aria-label={etiqueta}
        className="w-full border-collapse text-lectura"
      >
        {children}
      </table>
    </div>
  )
}

export function Cabecera({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-hoja">
      <tr className="[&>th]:border-b-[3px] [&>th]:border-double [&>th]:border-raya-firme">
        {children}
      </tr>
    </thead>
  )
}

type AlineacionProps = { numerica?: boolean }

export function Th({
  children,
  className,
  numerica,
  ...resto
}: ThHTMLAttributes<HTMLTableCellElement> & AlineacionProps) {
  return (
    <th
      scope="col"
      className={cn(
        'px-3 py-2.5 text-left align-bottom font-mono text-nota font-medium tracking-[0.085em] text-tinta-3 uppercase',
        numerica && 'text-right',
        className,
      )}
      {...resto}
    >
      {children}
    </th>
  )
}

/** Encabezado que ordena. El indicador sólo aparece en la columna activa. */
export function ThOrden({
  children,
  campo,
  ordenActual,
  direccion,
  alOrdenar,
  numerica,
  className,
}: {
  children: ReactNode
  campo: string
  ordenActual: string
  direccion: 'asc' | 'desc'
  alOrdenar: (campo: string) => void
  numerica?: boolean
  className?: string
}) {
  const activa = ordenActual === campo
  return (
    <Th numerica={numerica} className={cn('p-0', className)} aria-sort={activa ? (direccion === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => alOrdenar(campo)}
        className={cn(
          'group flex w-full items-center gap-1.5 px-3 py-2.5 font-mono text-nota font-medium tracking-[0.085em] uppercase transition-colors duration-100',
          'hover:text-tinta focus-visible:text-tinta',
          numerica && 'justify-end',
          activa ? 'text-tinta' : 'text-tinta-3',
        )}
      >
        {children}
        <ArrowUp
          size={11}
          strokeWidth={2.25}
          aria-hidden
          className={cn(
            'shrink-0 transition-[opacity,transform] duration-150',
            activa
              ? cn('opacity-100', direccion === 'desc' && 'rotate-180')
              : 'opacity-0 group-hover:opacity-40',
          )}
        />
      </button>
    </Th>
  )
}

export function Cuerpo({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>
}

export function Fila({
  children,
  className,
  destacada,
  atenuada,
  ...resto
}: React.HTMLAttributes<HTMLTableRowElement> & {
  destacada?: boolean
  atenuada?: boolean
}) {
  return (
    <tr
      className={cn(
        'relative border-b border-raya-tenue transition-colors duration-100 last:border-b-0',
        'hover:bg-renglon has-focus-visible:bg-renglon',
        destacada && 'bg-sello-lavado/45',
        atenuada && 'text-tinta-3',
        className,
      )}
      {...resto}
    >
      {children}
    </tr>
  )
}

export function Td({
  children,
  className,
  numerica,
  ...resto
}: TdHTMLAttributes<HTMLTableCellElement> & AlineacionProps) {
  return (
    <td
      className={cn(
        'px-3 py-2.5 align-middle',
        numerica && 'text-right font-mono text-dato',
        className,
      )}
      {...resto}
    >
      {children}
    </td>
  )
}

/**
 * Enlace que cubre todo el renglón sin anidar controles: un solo elemento
 * enfocable por fila, y el resto de las celdas siguen siendo seleccionables.
 */
export function EnlaceDeFila({
  children,
  className,
  ...enlace
}: LinkProps & { children: ReactNode; className?: string }) {
  return (
    <Link
      {...enlace}
      className={cn(
        'after:absolute after:inset-0 after:content-[""] hover:text-sello focus-visible:outline-none',
        className,
      )}
    >
      {children}
    </Link>
  )
}

/* ── Pie del manifiesto: conteo y paginación ─────────────────────────────── */

function BotonPagina({
  children,
  disabled,
  onClick,
  etiqueta,
}: {
  children: ReactNode
  disabled?: boolean
  onClick: () => void
  etiqueta: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      title={etiqueta}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-chip border border-raya text-tinta-2 transition-[colors,transform] duration-100',
        'hover:border-raya-firme hover:bg-renglon hover:text-tinta active:scale-[0.97]',
        'disabled:pointer-events-none disabled:border-raya-tenue disabled:text-tinta-4',
      )}
    >
      {children}
    </button>
  )
}

export function Paginacion({
  pagina,
  porPagina,
  total,
  alCambiarPagina,
  alCambiarTamano,
  tamanos = [25, 50, 100],
  sustantivo = 'registros',
}: {
  pagina: number
  porPagina: number
  total: number
  alCambiarPagina: (pagina: number) => void
  alCambiarTamano: (tamano: number) => void
  tamanos?: Array<number>
  sustantivo?: string
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1
  const hasta = Math.min(pagina * porPagina, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-raya px-4 py-3">
      <p data-cifra className="font-mono text-dato text-tinta-3">
        {total === 0 ? (
          `Sin ${sustantivo}`
        ) : (
          <>
            <span className="text-tinta-2">
              {entero(desde)}–{entero(hasta)}
            </span>{' '}
            de <span className="text-tinta-2">{entero(total)}</span> {sustantivo}
          </>
        )}
      </p>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 font-mono text-nota tracking-[0.06em] text-tinta-3 uppercase">
          Por hoja
          {/* Select nativo —teclado y accesibilidad gratis— pero sin el control del
              sistema operativo encima del papel: se le quita la apariencia y se le
              pone la misma galleta que el resto de los controles. */}
          <span className="relative inline-flex items-center">
            <select
              value={porPagina}
              onChange={(e) => alCambiarTamano(Number(e.target.value))}
              className={cn(
                'h-8 appearance-none rounded-chip border border-raya bg-hundido py-0 pr-6 pl-2',
                'font-mono text-dato text-tinta transition-colors duration-100',
                'hover:border-raya-firme focus:border-sello/50 focus:outline-none',
              )}
            >
              {tamanos.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              strokeWidth={1.75}
              aria-hidden
              className="pointer-events-none absolute right-1.5 text-tinta-4"
            />
          </span>
        </label>

        <div className="flex items-center gap-1.5">
          <BotonPagina etiqueta="Primera hoja" disabled={pagina <= 1} onClick={() => alCambiarPagina(1)}>
            <ChevronsLeft size={15} strokeWidth={1.75} />
          </BotonPagina>
          <BotonPagina etiqueta="Hoja anterior" disabled={pagina <= 1} onClick={() => alCambiarPagina(pagina - 1)}>
            <ChevronLeft size={15} strokeWidth={1.75} />
          </BotonPagina>

          <span data-cifra className="min-w-[5.5rem] text-center font-mono text-dato text-tinta-2">
            {entero(pagina)} <span className="text-tinta-4">/</span> {entero(paginas)}
          </span>

          <BotonPagina etiqueta="Hoja siguiente" disabled={pagina >= paginas} onClick={() => alCambiarPagina(pagina + 1)}>
            <ChevronRight size={15} strokeWidth={1.75} />
          </BotonPagina>
          <BotonPagina etiqueta="Última hoja" disabled={pagina >= paginas} onClick={() => alCambiarPagina(paginas)}>
            <ChevronsRight size={15} strokeWidth={1.75} />
          </BotonPagina>
        </div>
      </div>
    </div>
  )
}
