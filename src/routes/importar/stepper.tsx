import { useEffect, useRef } from 'react'
import { Check, Lock } from 'lucide-react'
import { cn } from '~/lib/cn'

/**
 * The step strip. Chips stay clickable even when blocked — the whole point of
 * a blocked step is that you can open it and read why (see `index.tsx`'s
 * trips gate). `aria-current="step"` — not `aria-pressed`, which is a toggle's
 * ARIA state, not a position in a sequence.
 */
export function Stepper({
  titles,
  current,
  doneFlags,
  blockedIndex,
  onSelect,
}: {
  titles: ReadonlyArray<string>
  current: number
  doneFlags: ReadonlyArray<boolean>
  blockedIndex: number | null
  onSelect: (index: number) => void
}) {
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([])

  // Below `lg` the strip scrolls horizontally; on a 7-step strip the current
  // chip can land off-screen (observed on step 7 at phone width), leaving the
  // only visible indicator the text line above. Bring it into view instead.
  useEffect(() => {
    chipRefs.current[current]?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [current])

  return (
    <nav aria-label="Pasos de la importación" className="border-b border-rule">
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
        <span className="font-serif text-body font-medium text-ink">{titles[current] ?? ''}</span>
        <span data-numeric className="font-mono text-note text-ink-3">
          Paso {current + 1} de {titles.length}
        </span>
      </div>
      <ol className="flex gap-1 overflow-x-auto px-4 pb-3">
        {titles.map((title, i) => {
          const isCurrent = i === current
          const isBlocked = i === blockedIndex
          const isDone = doneFlags[i] ?? false
          return (
            <li key={title} className="shrink-0">
              <button
                ref={(el) => {
                  chipRefs.current[i] = el
                }}
                type="button"
                aria-current={isCurrent ? 'step' : undefined}
                title={`Paso ${i + 1} · ${title}${isBlocked ? ' — bloqueado' : isDone ? ' — con datos en la base' : ''}`}
                onClick={() => onSelect(i)}
                className={cn(
                  'flex items-center gap-2 rounded-chip border px-3 py-1.5',
                  'transition-[colors,transform] duration-100 active:scale-[0.97]',
                  isCurrent
                    ? 'border-stamp/60 bg-stamp-wash'
                    : isBlocked
                      ? 'border-rule-faint border-dashed hover:bg-row'
                      : isDone
                        ? 'border-rule hover:bg-row'
                        : 'border-transparent hover:bg-row',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'grid size-[18px] shrink-0 place-items-center rounded-full border font-mono text-[10px] font-semibold tabular-nums',
                    isCurrent
                      ? 'border-stamp bg-stamp text-sheet'
                      : isBlocked
                        ? 'border-rule-strong text-ink-4'
                        : isDone
                          ? 'border-green/50 text-green'
                          : 'border-rule-strong text-ink-4',
                  )}
                >
                  {isBlocked ? (
                    <Lock size={9} strokeWidth={2} />
                  ) : isDone ? (
                    <Check size={11} strokeWidth={3} />
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={cn(
                    'font-serif text-body whitespace-nowrap',
                    isCurrent ? 'font-medium text-ink' : isBlocked ? 'text-ink-4' : 'text-ink-2',
                  )}
                >
                  {title}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
