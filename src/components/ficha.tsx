import type { ReactNode } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { Link } from '@tanstack/react-router'
import type { LinkProps } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'
import { cn } from '~/lib/cn'
import { Hoja, Rotulo } from './base'

/* ── Ficha ────────────────────────────────────────────────────────────────
   La hoja de detalle. Rejilla de datos con aire real entre bloques: la zona
   de control es apretada, la ficha respira.                                 */
export function Ficha({
  titulo,
  nota,
  children,
  acciones,
  className,
}: {
  titulo: string
  nota?: ReactNode
  children: ReactNode
  acciones?: ReactNode
  className?: string
}) {
  return (
    <Hoja className={cn('overflow-hidden', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-raya px-5 py-3.5">
        <h2 className="font-serif text-rubro font-medium text-tinta">{titulo}</h2>
        {nota ? (
          <span data-cifra className="font-mono text-nota text-tinta-3">
            {nota}
          </span>
        ) : null}
        {acciones ? <div className="ml-auto flex items-center gap-2">{acciones}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </Hoja>
  )
}

/** Rejilla de pares rótulo/valor. Dos columnas en pantallas anchas. */
export function Rejilla({
  columnas = 2,
  children,
}: {
  columnas?: 2 | 3 | 4
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'grid gap-x-8 gap-y-5',
        columnas === 2 && 'sm:grid-cols-2',
        columnas === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        columnas === 4 && 'sm:grid-cols-2 lg:grid-cols-4',
      )}
    >
      {children}
    </div>
  )
}

/** Bloque con rótulo dentro de una ficha larga. */
export function Bloque({
  rotulo,
  children,
  className,
}: {
  rotulo: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('mt-7 first:mt-0', className)}>
      <Rotulo className="mb-3">{rotulo}</Rotulo>
      {children}
    </section>
  )
}

/* ── Vínculo ──────────────────────────────────────────────────────────────
   Un visor de sólo lectura vale por lo que enlaza. El acento se reserva para
   el estado activo del enlace, no para su reposo.                           */
export function Vinculo({
  children,
  className,
  ...enlace
}: LinkProps & { children: ReactNode; className?: string }) {
  return (
    <Link
      {...enlace}
      className={cn(
        'rounded-chip underline decoration-raya-firme decoration-from-font underline-offset-[3px]',
        'transition-colors duration-100 hover:text-sello hover:decoration-sello/50',
        className,
      )}
    >
      {children}
    </Link>
  )
}

/** Enlace a un destino fuera del visor (Google Maps, por ejemplo). */
export function VinculoExterno({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-1.5 rounded-chip underline decoration-raya-firme decoration-from-font underline-offset-[3px] transition-colors duration-100 hover:text-sello hover:decoration-sello/50"
    >
      <span className="min-w-0 truncate">{children}</span>
      <ExternalLink size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-tinta-4" />
    </a>
  )
}

/* ── Pestañas ─────────────────────────────────────────────────────────────
   Sobre Radix Tabs: flechas, foco y roles ya vienen resueltos. El indicador
   es una raya del acento bajo la pestaña viva, no una caja.                 */
export function Pestanas({
  valor,
  alCambiar,
  opciones,
  children,
}: {
  valor: string
  alCambiar: (valor: string) => void
  opciones: Array<{ valor: string; rotulo: string; conteo?: number }>
  children: ReactNode
}) {
  return (
    <Tabs.Root value={valor} onValueChange={alCambiar}>
      <Tabs.List className="flex items-end gap-1 border-b border-raya px-4">
        {opciones.map((o) => (
          <Tabs.Trigger
            key={o.valor}
            value={o.valor}
            className={cn(
              'group relative -mb-px inline-flex items-center gap-2 px-3 py-2.5 transition-colors duration-100',
              'text-tinta-2 hover:text-tinta data-[state=active]:text-tinta',
            )}
          >
            <span className="font-serif text-lectura group-data-[state=active]:font-medium">
              {o.rotulo}
            </span>
            {o.conteo !== undefined ? (
              <span data-cifra className="font-mono text-nota text-tinta-4">
                {o.conteo}
              </span>
            ) : null}
            <span
              aria-hidden
              className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-sello opacity-0 transition-opacity duration-150 group-data-[state=active]:opacity-100"
            />
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {children}
    </Tabs.Root>
  )
}

export function Pestana({ valor, children }: { valor: string; children: ReactNode }) {
  return (
    <Tabs.Content value={valor} className="focus-visible:outline-none">
      {children}
    </Tabs.Content>
  )
}
