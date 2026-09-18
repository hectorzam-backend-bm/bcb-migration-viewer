import type { ReactNode } from 'react'
import { cn } from '~/lib/cn'

/* ── Sheet ────────────────────────────────────────────────────────────────
   The manifest container. No shadow: paper does not cast onto itself.
   The rule and the change of tint do the separating.                       */
export function Sheet({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-sheet border border-rule bg-sheet',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

/* ── Stamp ────────────────────────────────────────────────────────────────
   Read-only state. Deliberately NOT a switch: nothing here can be
   changed, and a switch would lie about it.

   Hierarchy by exception: "Activa" is the norm and stays quiet; the
   anomalous (inactive, deleted, disabled by HCM) is what stands out.        */
type Tone = 'active' | 'inactive' | 'deleted' | 'warning'

const TONES: Record<Tone, { dot: string; text: string; background: string }> = {
  active: { dot: 'bg-green', text: 'text-ink-2', background: '' },
  inactive: {
    dot: 'bg-transparent ring-1 ring-inset ring-ink-4',
    text: 'text-ink-3',
    background: '',
  },
  deleted: {
    dot: 'bg-rust',
    text: 'text-rust',
    background: 'bg-rust-wash px-1.5 -mx-1.5 rounded-chip',
  },
  warning: {
    dot: 'bg-amber',
    text: 'text-ink-2',
    background: 'bg-amber-wash px-1.5 -mx-1.5 rounded-chip',
  },
}

export function Stamp({
  tone,
  children,
  title,
  className,
}: {
  tone: Tone
  children: ReactNode
  title?: string
  className?: string
}) {
  const t = TONES[tone]
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap py-0.5 font-mono text-note font-medium tracking-[0.06em] uppercase',
        t.text,
        t.background,
        className,
      )}
    >
      <span className={cn('size-[5px] shrink-0 rounded-full', t.dot)} aria-hidden />
      {children}
    </span>
  )
}

/** Shortcut for the active/inactive pair that shows up in almost every table. */
export function ActivityStamp({
  active,
  deleted,
  className,
}: {
  active: boolean
  deleted?: boolean
  className?: string
}) {
  if (deleted) {
    return (
      <Stamp tone="deleted" title="Registro con deletedAt — borrado lógico" className={className}>
        Baja
      </Stamp>
    )
  }
  return (
    <Stamp tone={active ? 'active' : 'inactive'} className={className}>
      {active ? 'Activa' : 'Inactiva'}
    </Stamp>
  )
}

/* ── KeyText ──────────────────────────────────────────────────────────────
   Every identifier in the system —company key, route number, station
   code— goes in monospace with open tracking. They read like a departures
   board and are told apart from running text at a glance.                   */
export function KeyText({
  children,
  emphasis,
  className,
}: {
  children: ReactNode
  emphasis?: boolean
  className?: string
}) {
  return (
    <span
      data-numeric
      className={cn(
        'font-mono text-data tracking-[0.04em] whitespace-nowrap',
        emphasis ? 'font-medium text-ink' : 'text-ink-2',
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ── Label ────────────────────────────────────────────────────────────────
   Field label: monospaced small caps. Demoted by size, weight and color
   at once, so that the datum beside it is always what dominates.            */
export function Label({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'block font-mono text-note font-medium tracking-[0.09em] text-ink-3 uppercase',
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ── Field ────────────────────────────────────────────────────────────────
   Label/value pair of the detail cards.                                     */
export function Field({
  label,
  children,
  mono,
  wide,
  className,
}: {
  label: string
  children: ReactNode
  mono?: boolean
  wide?: boolean
  className?: string
}) {
  return (
    <div className={cn(wide && 'sm:col-span-2', className)}>
      <Label>{label}</Label>
      <div
        data-numeric
        className={cn(
          'mt-1 text-body text-ink',
          mono && 'font-mono text-data tracking-[0.02em]',
        )}
      >
        {children}
      </div>
    </div>
  )
}

/* ── Stat ─────────────────────────────────────────────────────────────────
   Featured number of a summary card. The magnitude rules; the unit and
   the label pull back.                                                      */
export function Stat({
  value,
  label,
  tone = 'ink',
  note,
}: {
  value: ReactNode
  label: string
  tone?: 'ink' | 'stamp' | 'rust' | 'amber'
  note?: ReactNode
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div
        data-numeric
        className={cn(
          'mt-1.5 font-mono text-title leading-none font-medium tracking-[-0.01em]',
          tone === 'ink' && 'text-ink',
          tone === 'stamp' && 'text-stamp',
          tone === 'rust' && 'text-rust',
          tone === 'amber' && 'text-amber',
        )}
      >
        {value}
      </div>
      {note ? <div className="mt-1.5 text-note text-ink-3">{note}</div> : null}
    </div>
  )
}

/* ── MainMark ─────────────────────────────────────────────────────────────
   The rubber stamp of the manifest: it marks the main segment of a route.
   It is the only place where the accent appears as a figure, not as text.   */
export function MainMark({ title = 'Tramo principal' }: { title?: string }) {
  return (
    <span
      title={title}
      aria-label={title}
      className="inline-flex size-[15px] shrink-0 items-center justify-center rounded-full border border-stamp/50 text-[9px] leading-none font-semibold text-stamp"
    >
      P
    </span>
  )
}

/* ── Rule ─────────────────────────────────────────────────────────────────
   Separator between blocks. The double rule is the one from a printed
   manifest's header; the single one separates rows.                         */
export function Rule({
  double,
  className,
}: {
  double?: boolean
  className?: string
}) {
  return (
    <div
      role="separator"
      className={cn(
        double
          ? 'h-[3px] border-b-[3px] border-double border-rule-strong'
          : 'h-px bg-rule',
        className,
      )}
    />
  )
}
