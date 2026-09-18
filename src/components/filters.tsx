import { useEffect, useId, useMemo, useRef, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '~/lib/cn'
import { integer } from '~/lib/format'

/* ── SearchBox ────────────────────────────────────────────────────────────
   The field is sunken into the sheet, not raised: it receives content.
   Writes to the URL with a delay so the link is always shareable.           */
export function SearchBox({
  value,
  onChange,
  placeholder,
  delay = 250,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  delay?: number
  className?: string
}) {
  const [draft, setDraft] = useState(value)
  const lastEmitted = useRef(value)
  const field = useRef<HTMLInputElement>(null)

  // The URL rules: if it changes from outside (back/forward, clear filters), it is reflected.
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value
      setDraft(value)
    }
  }, [value])

  useEffect(() => {
    if (draft === lastEmitted.current) return
    const id = setTimeout(() => {
      lastEmitted.current = draft
      onChange(draft)
    }, delay)
    return () => clearTimeout(id)
  }, [draft, delay, onChange])

  return (
    <div className={cn('relative', className)}>
      <Search
        size={14}
        strokeWidth={1.75}
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-4"
      />
      <input
        ref={field}
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && draft) {
            e.preventDefault()
            setDraft('')
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          'h-9 w-full rounded-chip border border-rule bg-sunken pr-8 pl-8.5 text-body text-ink',
          'placeholder:text-ink-4 transition-colors duration-100',
          'hover:border-rule-strong focus:border-stamp/50 focus:outline-none',
          '[&::-webkit-search-cancel-button]:hidden',
        )}
      />
      {draft ? (
        <button
          type="button"
          onClick={() => {
            setDraft('')
            field.current?.focus()
          }}
          aria-label="Limpiar búsqueda"
          className="absolute top-1/2 right-1 grid size-7 -translate-y-1/2 place-items-center rounded-chip text-ink-4 transition-colors duration-100 hover:text-ink-2"
        >
          <X size={13} strokeWidth={2} />
        </button>
      ) : null}
    </div>
  )
}

export type Option = { value: string; label: string; note?: string }

/* ── ListFilter ───────────────────────────────────────────────────────────
   Built on Radix Popover: keyboard, focus and collision already solved.
   The panel is the only layer that rises above the paper, and that is why
   it is the only one carrying a shadow.                                     */
export function ListFilter({
  label,
  options,
  selection,
  onChange,
  searchable,
}: {
  label: string
  options: Array<Option>
  selection: Array<string>
  onChange: (selection: Array<string>) => void
  searchable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchId = useId()

  const withSearch = searchable ?? options.length > 8
  const visible = useMemo(() => {
    if (!query.trim()) return options
    const q = query.trim().toLowerCase()
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    )
  }, [options, query])

  const active = selection.length > 0
  const summary =
    selection.length === 0
      ? null
      : selection.length === 1
        ? (options.find((o) => o.value === selection[0])?.label ?? selection[0])
        : `${integer(selection.length)} seleccionados`

  function toggle(value: string) {
    onChange(
      selection.includes(value)
        ? selection.filter((v) => v !== value)
        : [...selection, value],
    )
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setQuery('')
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-9 max-w-[15rem] items-center gap-2 rounded-chip border px-3 text-body',
            'transition-[colors,transform] duration-100 active:scale-[0.98]',
            active
              ? 'border-stamp/40 bg-stamp-wash text-ink'
              : 'border-rule border-dashed bg-transparent text-ink-2 hover:border-rule-strong hover:border-solid hover:bg-row',
          )}
        >
          <span className="shrink-0 font-medium">{label}</span>
          {summary ? (
            <>
              <span className="h-3.5 w-px shrink-0 bg-stamp/30" aria-hidden />
              <span className="truncate font-mono text-data text-stamp">{summary}</span>
            </>
          ) : null}
          <ChevronDown
            size={13}
            strokeWidth={1.75}
            aria-hidden
            className={cn(
              'shrink-0 text-ink-4 transition-transform duration-150',
              open && 'rotate-180',
            )}
          />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            'z-50 w-[17rem] origin-(--radix-popover-content-transform-origin)',
            'rounded-floating border border-rule bg-sheet shadow-raised',
            'data-[state=open]:animate-[emerge_150ms_var(--ease-exit)]',
            'data-[state=closed]:animate-[fade-out_100ms_ease-out]',
          )}
        >
          {withSearch ? (
            <div className="border-b border-rule p-2">
              <label htmlFor={searchId} className="sr-only">
                Buscar en {label}
              </label>
              <input
                id={searchId}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Buscar ${label.toLowerCase()}…`}
                className="h-8 w-full rounded-chip border border-rule bg-sunken px-2.5 text-body text-ink placeholder:text-ink-4 focus:border-stamp/50 focus:outline-none"
              />
            </div>
          ) : null}

          <div className="max-h-[17rem] overflow-y-auto p-1">
            {visible.length === 0 ? (
              <p className="px-2.5 py-6 text-center text-body text-ink-4">
                Sin coincidencias
              </p>
            ) : (
              visible.map((o) => {
                const checked = selection.includes(o.value)
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={checked}
                    onClick={() => toggle(o.value)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-chip px-2 py-1.5 text-left transition-colors duration-75',
                      'hover:bg-row focus-visible:bg-row',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'grid size-[15px] shrink-0 place-items-center rounded-[2px] border transition-colors duration-100',
                        checked
                          ? 'border-stamp bg-stamp text-sheet'
                          : 'border-rule-strong',
                      )}
                    >
                      {checked ? <Check size={10} strokeWidth={3} /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-body text-ink">
                      {o.label}
                    </span>
                    {o.note ? (
                      <span data-numeric className="shrink-0 font-mono text-note text-ink-4">
                        {o.note}
                      </span>
                    ) : null}
                  </button>
                )
              })
            )}
          </div>

          {active ? (
            <div className="border-t border-rule p-1">
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full rounded-chip px-2 py-1.5 text-left font-mono text-note tracking-[0.07em] text-ink-3 uppercase transition-colors duration-75 hover:bg-row hover:text-ink-2"
              >
                Quitar selección
              </button>
            </div>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/* ── FilterBar ────────────────────────────────────────────────────────────
   Control zone: dense and tight, so the manifest below
   breathes by contrast.                                                     */
export function FilterBar({
  children,
  hasFilters,
  onClear,
}: {
  children: React.ReactNode
  hasFilters?: boolean
  onClear?: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-rule px-4 py-3">
      {children}
      {hasFilters && onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-chip px-2.5 font-mono text-note font-medium tracking-[0.07em] text-ink-3 uppercase transition-colors duration-100 hover:bg-row hover:text-ink"
        >
          <X size={12} strokeWidth={2} aria-hidden />
          Limpiar filtros
        </button>
      ) : null}
    </div>
  )
}
