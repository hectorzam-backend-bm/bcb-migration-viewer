import type { ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import type { LinkProps } from '@tanstack/react-router'
import { Database } from 'lucide-react'
import { cn } from '~/lib/cn'
import { integer } from '~/lib/format'
import { ThemeToggle } from './theme'

export type Counts = {
  companies: number
  services: number
  stations: number
  routes: number
  segments: number
}

const SECTIONS = [
  { to: '/empresas', label: 'Empresas', countKey: 'companies' },
  { to: '/servicios', label: 'Servicios', countKey: 'services' },
  { to: '/terminales', label: 'Terminales', countKey: 'stations' },
  { to: '/rutas', label: 'Rutas y tramos', countKey: 'routes' },
] as const

/* ── Rail ─────────────────────────────────────────────────────────────────
   224 px: navigation serves the content, it does not compete with it. It shares
   the canvas background —a single rule separates it— and carries each catalog's
   live count, because in a migration viewer the number IS the navigation. */
export function Rail({ counts }: { counts?: Counts }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <nav
      aria-label="Catálogos"
      className={cn(
        // On small screens the rail is a top bar: a fixed 224 px width would eat
        // more than half of a phone. From lg it becomes the 224 px column again,
        // which says "navigation serves the content".
        'flex shrink-0 border-rule',
        'w-full flex-row items-center gap-3 overflow-x-auto border-b px-4 py-2',
        'lg:w-56 lg:flex-col lg:items-stretch lg:gap-0 lg:overflow-visible lg:border-r lg:border-b-0 lg:px-0 lg:py-0',
      )}
    >
      <div className="shrink-0 lg:px-4 lg:pt-5 lg:pb-4">
        <Link to="/" className="block rounded-chip focus-visible:outline-offset-4">
          <span className="block font-mono text-data font-semibold tracking-[0.2em] text-stamp uppercase">
            BCB
          </span>
          <span className="mt-0.5 block font-serif text-data text-ink-3">
            Visor de migración
          </span>
        </Link>
      </div>

      <div className="hidden px-3 lg:block">
        <div className="h-px bg-rule" />
      </div>

      <ul className="flex flex-1 flex-row gap-1 lg:flex-col lg:gap-0.5 lg:px-3 lg:py-3">
        {SECTIONS.map((s) => {
          const isActive = pathname === s.to || pathname.startsWith(`${s.to}/`)
          const n = counts?.[s.countKey]
          return (
            <li key={s.to} className="relative">
              <Link
                to={s.to}
                className={cn(
                  'flex items-center gap-2 rounded-chip py-1.5 transition-colors duration-100',
                  'px-2.5 whitespace-nowrap lg:justify-between lg:pr-2 lg:pl-3',
                  isActive
                    ? 'bg-row text-ink'
                    : 'text-ink-2 hover:bg-row/60 hover:text-ink',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'absolute rounded-full bg-stamp transition-opacity duration-150',
                    'inset-x-2 bottom-0 h-[2px] lg:inset-x-auto lg:top-1/2 lg:bottom-auto lg:left-0 lg:h-4 lg:w-[2px] lg:-translate-y-1/2',
                    isActive ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <span className={cn('font-serif text-body', isActive && 'font-medium')}>
                  {s.label}
                </span>
                {n !== undefined ? (
                  <span
                    data-numeric
                    className={cn(
                      'font-mono text-note tabular-nums',
                      isActive ? 'text-ink-3' : 'text-ink-4',
                    )}
                  >
                    {integer(n)}
                  </span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="ml-auto shrink-0 lg:mt-auto lg:ml-0 lg:px-3 lg:pt-3 lg:pb-3">
        <div className="mb-3 hidden h-px bg-rule lg:block" />
        <div className="flex items-center justify-between gap-2 lg:pl-1">
          <span className="hidden min-w-0 items-center gap-1.5 text-ink-3 lg:inline-flex">
            <Database size={12} strokeWidth={1.75} aria-hidden className="shrink-0" />
            <span className="truncate font-mono text-note tracking-[0.04em]">
              sólo lectura
            </span>
          </span>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  )
}

/* ── Page header ──────────────────────────────────────────────────────────
   Serif title, count subtitle in monospace, double rule underneath: the
   header of a printed manifest.                                             */
export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  breadcrumbs?: ReactNode
}) {
  return (
    <header className="px-4 pt-6 pb-0 sm:px-8 sm:pt-7">
      {breadcrumbs ? <div className="mb-3">{breadcrumbs}</div> : null}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-3.5">
        <div className="min-w-0">
          <h1 className="font-serif text-title leading-tight font-semibold text-ink">
            {title}
          </h1>
          {subtitle ? (
            <p data-numeric className="mt-1.5 font-mono text-data text-ink-3">
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className="h-[3px] border-b-[3px] border-double border-rule-strong" aria-hidden />
    </header>
  )
}

/** Breadcrumbs: they only appear on the detail cards. */
export function Breadcrumbs({ children }: { children: ReactNode }) {
  return (
    <nav aria-label="Ruta de navegación" className="flex items-center gap-1.5 font-mono text-note tracking-[0.05em] text-ink-3 uppercase">
      {children}
    </nav>
  )
}

export function Breadcrumb({
  children,
  ...linkProps
}: LinkProps & { children: ReactNode }) {
  return (
    <Link
      {...linkProps}
      className="rounded-chip transition-colors duration-100 hover:text-stamp"
    >
      {children}
    </Link>
  )
}

export function BreadcrumbSeparator() {
  return (
    <span aria-hidden className="text-ink-4">
      /
    </span>
  )
}
