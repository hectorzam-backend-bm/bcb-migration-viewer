import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '~/lib/cn'
import { NO_DATA, integer, monthLabel, plural } from '~/lib/format'
import { parseIsoDate } from '~/server/trips'
import type { TripDayCount } from '~/server/trips'

/** Single-letter Spanish weekday header — D(omingo) L(unes) M(artes)
 *  M(iércoles) J(ueves) V(iernes) S(ábado). Martes and Miércoles share a
 *  letter on purpose: the day number below always disambiguates. */
const WEEKDAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

function weekdayLetter(dateIso: string): string {
  const { year, month, day } = parseIsoDate(dateIso)
  const index = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return WEEKDAY_LETTERS[index] ?? ''
}

const BAR_HEIGHT = 26

/**
 * The manifest's signature: the day is the unit, not a filter. Each cell
 * plots real weight — a bar sized by that day's trip count, never a
 * fabricated split — so the strip reads as a small histogram of the month,
 * not just a row of buttons. `‹ ›` move by month, `Ir a fecha` jumps anywhere
 * via the native date picker, and `Hoy` always reaches the real calendar
 * date, even into a month the migration never touched — that gap is itself
 * worth seeing, not hidden.
 */
export function DayStrip({
  days,
  selected,
  today,
  monthAnchor,
  onSelect,
  onPrevMonth,
  onNextMonth,
  onToday,
}: {
  days: Array<TripDayCount>
  selected: string
  today: string
  monthAnchor: string
  onSelect: (date: string) => void
  onPrevMonth: () => void
  onNextMonth: () => void
  onToday: () => void
}) {
  const max = Math.max(1, ...days.map((d) => d.count))
  const monthTotal = days.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className="border-b border-rule">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className="font-serif text-body font-medium text-ink">
            {/* `capitalize` would title-case every word ("Agosto De 2026") —
                Spanish only capitalizes the first letter of the phrase. */}
            {monthLabel(monthAnchor).replace(/^\p{L}/u, (c) => c.toUpperCase())}
          </span>
          <div
            className={cn(
              'relative inline-flex h-7 items-center gap-1.5 rounded-chip border border-rule border-dashed px-2.5',
              'font-mono text-note font-medium tracking-[0.06em] text-ink-2 uppercase transition-colors duration-100',
              'hover:border-rule-strong hover:border-solid hover:bg-row',
            )}
          >
            <CalendarDays size={12} strokeWidth={1.75} aria-hidden />
            Ir a fecha
            <input
              type="date"
              value={selected}
              onChange={(e) => {
                if (e.target.value) onSelect(e.target.value)
              }}
              aria-label="Ir a una fecha específica"
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span data-numeric className="font-mono text-note text-ink-3">
            {plural(monthTotal, 'corrida', 'corridas')} en el mes
          </span>
          <button
            type="button"
            onClick={onToday}
            className="inline-flex h-7 items-center rounded-chip border border-rule px-2.5 font-mono text-note font-medium tracking-[0.07em] text-ink-2 uppercase transition-[colors,transform] duration-100 hover:border-rule-strong hover:bg-row hover:text-ink active:scale-[0.97]"
          >
            Hoy
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Mes anterior"
              onClick={onPrevMonth}
              className="inline-flex size-7 items-center justify-center rounded-chip text-ink-3 transition-colors duration-100 hover:bg-row hover:text-ink"
            >
              <ChevronLeft size={15} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              aria-label="Mes siguiente"
              onClick={onNextMonth}
              className="inline-flex size-7 items-center justify-center rounded-chip text-ink-3 transition-colors duration-100 hover:bg-row hover:text-ink"
            >
              <ChevronRight size={15} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto px-4 pb-2">
        {days.map((day) => {
          const isSelected = day.date === selected
          const isToday = day.date === today
          const hasTrips = day.count > 0
          const barHeight = hasTrips ? Math.max(3, Math.round((day.count / max) * BAR_HEIGHT)) : 2

          return (
            <button
              key={day.date}
              type="button"
              aria-pressed={isSelected}
              title={isToday ? `Hoy · ${integer(day.count)}` : undefined}
              onClick={() => onSelect(day.date)}
              className={cn(
                'flex shrink-0 flex-col items-center gap-1 rounded-chip border px-2.5 pt-1.5 pb-2',
                'transition-[colors,transform] duration-100 active:scale-[0.97]',
                isSelected
                  ? 'border-stamp/60 bg-stamp-wash'
                  : isToday
                    ? 'border-ink-3 hover:bg-row'
                    : 'border-transparent hover:bg-row',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'font-mono text-[10px] font-medium tracking-[0.06em] uppercase',
                  isSelected ? 'text-stamp' : 'text-ink-4',
                )}
              >
                {weekdayLetter(day.date)}
              </span>
              <span
                className={cn(
                  'font-mono text-data font-semibold tabular-nums',
                  isSelected ? 'text-ink' : hasTrips ? 'text-ink-2' : 'text-ink-4',
                )}
              >
                {Number(day.date.slice(8, 10))}
              </span>
              <span
                aria-hidden
                className={cn('w-3 rounded-full', hasTrips ? 'bg-green' : 'bg-rule-strong')}
                style={{ height: barHeight }}
              />
              <span
                data-numeric
                className={cn(
                  'font-mono text-note tabular-nums',
                  isSelected ? 'text-stamp' : 'text-ink-4',
                )}
              >
                {hasTrips ? integer(day.count) : NO_DATA}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-4 px-4 pb-3">
        <span className="inline-flex items-center gap-1.5 font-mono text-note text-ink-3">
          <span className="size-2 rounded-full bg-green" aria-hidden />
          Con corridas
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-note text-ink-4">
          <span className="size-2 rounded-full bg-rule-strong" aria-hidden />
          Sin datos
        </span>
      </div>
    </div>
  )
}
