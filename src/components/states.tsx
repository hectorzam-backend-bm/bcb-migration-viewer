import type { ReactNode } from 'react'
import { PlugZap, SearchX, TriangleAlert } from 'lucide-react'
import { cn } from '~/lib/cn'
import { Rule } from './base'

/* ── Empty ────────────────────────────────────────────────────────────────
   Two different empties, and the difference matters: a table with no results
   because of a filter is not the same as a table with no records.           */
export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string
  detail?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <SearchX size={22} strokeWidth={1.25} className="text-ink-4" aria-hidden />
      <h3 className="mt-4 text-heading font-medium text-ink-2">{title}</h3>
      {detail ? (
        <p className="mt-1.5 max-w-sm text-body text-ink-3">{detail}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

/* ── Error ────────────────────────────────────────────────────────────────
   The most likely failure in this viewer is a connection, not code: the
   error screen says what to check, not just that something failed.          */
export function ErrorState({
  title,
  detail,
  suggestion,
  onRetry,
}: {
  title: string
  detail?: string
  suggestion?: string
  onRetry?: () => void
}) {
  const isConnectionError = /conexión|DATABASE_URL|respuesta|credencial/i.test(
    `${title} ${suggestion ?? ''}`,
  )
  const Icon = isConnectionError ? PlugZap : TriangleAlert

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <div className="rounded-sheet border border-rust/25 bg-rust-wash p-6">
        <div className="flex items-start gap-3">
          <Icon size={18} strokeWidth={1.5} className="mt-0.5 shrink-0 text-rust" aria-hidden />
          <div className="min-w-0 flex-1">
            <h3 className="text-heading font-medium text-ink">{title}</h3>
            {suggestion ? (
              <p className="mt-2 text-body text-ink-2">{suggestion}</p>
            ) : null}

            {detail ? (
              <>
                <Rule className="my-4 opacity-60" />
                <pre className="overflow-x-auto font-mono text-note leading-relaxed whitespace-pre-wrap text-ink-3">
                  {detail}
                </pre>
              </>
            ) : null}

            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className={cn(
                  'mt-5 inline-flex h-8 items-center rounded-chip border border-rust/40 px-3',
                  'font-mono text-note font-medium tracking-[0.08em] text-rust uppercase',
                  'transition-[colors,transform] duration-100 hover:bg-rust/10 active:scale-[0.97]',
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

/* ── Skeleton ─────────────────────────────────────────────────────────────
   Very faint pulse: paper does not flicker. Opacity only, never layout.     */
export function SkeletonBar({
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
        'block h-[10px] animate-[heartbeat_1.6s_ease-in-out_infinite] rounded-chip bg-rule',
        className,
      )}
    />
  )
}

export function ManifestSkeleton({
  columns,
  rows = 8,
}: {
  columns: Array<number>
  rows?: number
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="px-4">
      <span className="sr-only">Cargando registros…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-rule-faint py-[13px] last:border-b-0"
          style={{ opacity: 1 - i * 0.075 }}
        >
          {columns.map((width, j) => (
            <SkeletonBar key={j} style={{ width: `${width}%` }} className="shrink-0" />
          ))}
        </div>
      ))}
    </div>
  )
}
