import type { ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import type { LinkProps } from '@tanstack/react-router'
import { Database } from 'lucide-react'
import { cn } from '~/lib/cn'
import { entero } from '~/lib/formato'
import { InterruptorDeTema } from './tema'

export type Conteos = {
  empresas: number
  servicios: number
  terminales: number
  rutas: number
  tramos: number
}

const SECCIONES = [
  { a: '/empresas', rotulo: 'Empresas', llave: 'empresas' },
  { a: '/servicios', rotulo: 'Servicios', llave: 'servicios' },
  { a: '/terminales', rotulo: 'Terminales', llave: 'terminales' },
  { a: '/rutas', rotulo: 'Rutas y tramos', llave: 'rutas' },
] as const

/* ── Riel ─────────────────────────────────────────────────────────────────
   224 px: la navegación sirve al contenido, no compite con él. Comparte el
   fondo del lienzo —una raya basta para separarla— y lleva el conteo vivo de
   cada catálogo, porque en un visor de migración el número ES la navegación. */
export function Riel({ conteos }: { conteos?: Conteos }) {
  const ruta = useRouterState({ select: (s) => s.location.pathname })

  return (
    <nav
      aria-label="Catálogos"
      className={cn(
        // En pantallas chicas el riel es una barra superior: 224 px de ancho fijo
        // se comerían más de la mitad de un teléfono. A partir de lg vuelve a ser
        // la columna de 224 px, que dice "la navegación sirve al contenido".
        'flex shrink-0 border-raya',
        'w-full flex-row items-center gap-3 overflow-x-auto border-b px-4 py-2',
        'lg:w-56 lg:flex-col lg:items-stretch lg:gap-0 lg:overflow-visible lg:border-r lg:border-b-0 lg:px-0 lg:py-0',
      )}
    >
      <div className="shrink-0 lg:px-4 lg:pt-5 lg:pb-4">
        <Link to="/" className="block rounded-chip focus-visible:outline-offset-4">
          <span className="block font-mono text-dato font-semibold tracking-[0.2em] text-sello uppercase">
            BCB
          </span>
          <span className="mt-0.5 block font-serif text-dato text-tinta-3">
            Visor de migración
          </span>
        </Link>
      </div>

      <div className="hidden px-3 lg:block">
        <div className="h-px bg-raya" />
      </div>

      <ul className="flex flex-1 flex-row gap-1 lg:flex-col lg:gap-0.5 lg:px-3 lg:py-3">
        {SECCIONES.map((s) => {
          const activa = ruta === s.a || ruta.startsWith(`${s.a}/`)
          const n = conteos?.[s.llave]
          return (
            <li key={s.a} className="relative">
              <Link
                to={s.a}
                className={cn(
                  'flex items-center gap-2 rounded-chip py-1.5 transition-colors duration-100',
                  'px-2.5 whitespace-nowrap lg:justify-between lg:pr-2 lg:pl-3',
                  activa
                    ? 'bg-renglon text-tinta'
                    : 'text-tinta-2 hover:bg-renglon/60 hover:text-tinta',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'absolute rounded-full bg-sello transition-opacity duration-150',
                    'inset-x-2 bottom-0 h-[2px] lg:inset-x-auto lg:top-1/2 lg:bottom-auto lg:left-0 lg:h-4 lg:w-[2px] lg:-translate-y-1/2',
                    activa ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <span className={cn('font-serif text-lectura', activa && 'font-medium')}>
                  {s.rotulo}
                </span>
                {n !== undefined ? (
                  <span
                    data-cifra
                    className={cn(
                      'font-mono text-nota tabular-nums',
                      activa ? 'text-tinta-3' : 'text-tinta-4',
                    )}
                  >
                    {entero(n)}
                  </span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="ml-auto shrink-0 lg:mt-auto lg:ml-0 lg:px-3 lg:pt-3 lg:pb-3">
        <div className="mb-3 hidden h-px bg-raya lg:block" />
        <div className="flex items-center justify-between gap-2 lg:pl-1">
          <span className="hidden min-w-0 items-center gap-1.5 text-tinta-3 lg:inline-flex">
            <Database size={12} strokeWidth={1.75} aria-hidden className="shrink-0" />
            <span className="truncate font-mono text-nota tracking-[0.04em]">
              sólo lectura
            </span>
          </span>
          <InterruptorDeTema />
        </div>
      </div>
    </nav>
  )
}

/* ── Encabezado de sección ────────────────────────────────────────────────
   Título en serif, renglón de conteo en monoespaciada, raya doble debajo:
   el encabezado de un manifiesto impreso.                                   */
export function Encabezado({
  titulo,
  renglon,
  acciones,
  migas,
}: {
  titulo: ReactNode
  renglon?: ReactNode
  acciones?: ReactNode
  migas?: ReactNode
}) {
  return (
    <header className="px-4 pt-6 pb-0 sm:px-8 sm:pt-7">
      {migas ? <div className="mb-3">{migas}</div> : null}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-3.5">
        <div className="min-w-0">
          <h1 className="font-serif text-titulo leading-tight font-semibold text-tinta">
            {titulo}
          </h1>
          {renglon ? (
            <p data-cifra className="mt-1.5 font-mono text-dato text-tinta-3">
              {renglon}
            </p>
          ) : null}
        </div>
        {acciones ? <div className="flex shrink-0 items-center gap-2">{acciones}</div> : null}
      </div>
      <div className="h-[3px] border-b-[3px] border-double border-raya-firme" aria-hidden />
    </header>
  )
}

/** Migas de pan: sólo aparecen en las fichas de detalle. */
export function Migas({ children }: { children: ReactNode }) {
  return (
    <nav aria-label="Ruta de navegación" className="flex items-center gap-1.5 font-mono text-nota tracking-[0.05em] text-tinta-3 uppercase">
      {children}
    </nav>
  )
}

export function Miga({
  children,
  ...enlace
}: LinkProps & { children: ReactNode }) {
  return (
    <Link
      {...enlace}
      className="rounded-chip transition-colors duration-100 hover:text-sello"
    >
      {children}
    </Link>
  )
}

export function SeparadorMiga() {
  return (
    <span aria-hidden className="text-tinta-4">
      /
    </span>
  )
}
