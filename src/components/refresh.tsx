import { useEffect, useRef, useState } from 'react'
import { useRouter, useRouterState } from '@tanstack/react-router'
import { RotateCw } from 'lucide-react'
import { cn } from '~/lib/cn'

const TIME_FORMAT = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

/**
 * Re-reads the catalog from the database.
 *
 * It invalidates the router's `loader`s, so it really queries Postgres again —
 * it does not repaint a cache. Next to the button sits the time of the last
 * read: in a migration viewer it matters to know *when* what you are looking at
 * is from, above all if someone is re-importing data while you review it.
 *
 * The time is stamped only on the client (it stays null during the server
 * render) so there is no hydration mismatch.
 */
export function RefreshButton({
  className,
  showTimestamp = true,
}: {
  className?: string
  /** Turned off where the header already prints its own timestamp. */
  showTimestamp?: boolean
}) {
  const router = useRouter()
  const isLoading = useRouterState({ select: (s) => s.isLoading })
  const [timestamp, setTimestamp] = useState<Date | null>(null)
  const wasLoading = useRef(false)

  // Stamped at the end of every read, the first one included.
  useEffect(() => {
    if (wasLoading.current && !isLoading) setTimestamp(new Date())
    wasLoading.current = isLoading
  }, [isLoading])

  useEffect(() => {
    setTimestamp((prev) => prev ?? new Date())
  }, [])

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {showTimestamp && timestamp ? (
        <span data-numeric className="hidden font-mono text-note text-ink-3 sm:inline">
          Leído {TIME_FORMAT.format(timestamp)}
        </span>
      ) : null}

      <button
        type="button"
        onClick={() => void router.invalidate()}
        disabled={isLoading}
        aria-label="Volver a leer el catálogo desde la base de datos"
        title="Volver a leer el catálogo desde la base de datos"
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-chip border border-rule px-3',
          'font-mono text-note font-medium tracking-[0.08em] text-ink-2 uppercase',
          'transition-[colors,transform] duration-100',
          'hover:border-rule-strong hover:bg-row hover:text-ink',
          'active:scale-[0.97]',
          'disabled:pointer-events-none disabled:text-ink-3',
        )}
      >
        <RotateCw
          size={13}
          strokeWidth={1.75}
          aria-hidden
          className={cn('shrink-0', isLoading && 'animate-[rotate_700ms_linear_infinite]')}
        />
        {isLoading ? 'Leyendo…' : 'Actualizar'}
      </button>
    </div>
  )
}
