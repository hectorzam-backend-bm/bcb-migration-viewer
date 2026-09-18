import type { ReactNode } from 'react'
import * as RadixTabs from '@radix-ui/react-tabs'
import { Link } from '@tanstack/react-router'
import type { LinkProps } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'
import { cn } from '~/lib/cn'
import { Sheet, Label } from './base'

/* ── Card ─────────────────────────────────────────────────────────────────
   The detail sheet. A data grid with real air between blocks: the control
   zone is tight, the card breathes.                                         */
export function Card({
  title,
  note,
  children,
  actions,
  className,
}: {
  title: string
  note?: ReactNode
  children: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <Sheet className={cn('overflow-hidden', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule px-5 py-3.5">
        <h2 className="font-serif text-heading font-medium text-ink">{title}</h2>
        {note ? (
          <span data-numeric className="font-mono text-note text-ink-3">
            {note}
          </span>
        ) : null}
        {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </Sheet>
  )
}

/** Grid of label/value pairs. Two columns on wide screens. */
export function Grid({
  columns = 2,
  children,
}: {
  columns?: 2 | 3 | 4
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'grid gap-x-8 gap-y-5',
        columns === 2 && 'sm:grid-cols-2',
        columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        columns === 4 && 'sm:grid-cols-2 lg:grid-cols-4',
      )}
    >
      {children}
    </div>
  )
}

/** Labelled block inside a long card. */
export function Block({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('mt-7 first:mt-0', className)}>
      <Label className="mb-3">{label}</Label>
      {children}
    </section>
  )
}

/* ── TextLink ─────────────────────────────────────────────────────────────
   A read-only viewer is worth what it links to. The accent is reserved for
   the link's active state, not its resting state.                           */
export function TextLink({
  children,
  className,
  ...linkProps
}: LinkProps & { children: ReactNode; className?: string }) {
  return (
    <Link
      {...linkProps}
      className={cn(
        'rounded-chip underline decoration-rule-strong decoration-from-font underline-offset-[3px]',
        'transition-colors duration-100 hover:text-stamp hover:decoration-stamp/50',
        className,
      )}
    >
      {children}
    </Link>
  )
}

/** Link to a destination outside the viewer (Google Maps, for example). */
export function ExternalTextLink({
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
      className="inline-flex items-center gap-1.5 rounded-chip underline decoration-rule-strong decoration-from-font underline-offset-[3px] transition-colors duration-100 hover:text-stamp hover:decoration-stamp/50"
    >
      <span className="min-w-0 truncate">{children}</span>
      <ExternalLink size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-ink-4" />
    </a>
  )
}

/* ── Tabs ─────────────────────────────────────────────────────────────────
   Built on Radix Tabs: arrows, focus and roles already come solved. The
   indicator is an accent rule under the live tab, not a box.                */
export function Tabs({
  value,
  onChange,
  options,
  children,
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string; count?: number }>
  children: ReactNode
}) {
  return (
    <RadixTabs.Root value={value} onValueChange={onChange}>
      <RadixTabs.List className="flex items-end gap-1 border-b border-rule px-4">
        {options.map((o) => (
          <RadixTabs.Trigger
            key={o.value}
            value={o.value}
            className={cn(
              'group relative -mb-px inline-flex items-center gap-2 px-3 py-2.5 transition-colors duration-100',
              'text-ink-2 hover:text-ink data-[state=active]:text-ink',
            )}
          >
            <span className="font-serif text-body group-data-[state=active]:font-medium">
              {o.label}
            </span>
            {o.count !== undefined ? (
              <span data-numeric className="font-mono text-note text-ink-4">
                {o.count}
              </span>
            ) : null}
            <span
              aria-hidden
              className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-stamp opacity-0 transition-opacity duration-150 group-data-[state=active]:opacity-100"
            />
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {children}
    </RadixTabs.Root>
  )
}

export function Tab({ value, children }: { value: string; children: ReactNode }) {
  return (
    <RadixTabs.Content value={value} className="focus-visible:outline-none">
      {children}
    </RadixTabs.Content>
  )
}
