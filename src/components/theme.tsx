import { useEffect, useState } from 'react'
import { Moon, Sun, SunMoon } from 'lucide-react'
import { cn } from '~/lib/cn'

export type Theme = 'system' | 'light' | 'dark'
const STORAGE_KEY = 'bcb.theme'
const THEME_CYCLE: Array<Theme> = ['system', 'light', 'dark']

const LABELS: Record<Theme, string> = {
  system: 'Tema del sistema',
  light: 'Papel claro',
  dark: 'Papel bajo lámpara',
}

/** Injected before paint so there is no flash of the wrong theme. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}})()`

function readStoredTheme(): Theme {
  try {
    const t = localStorage.getItem(STORAGE_KEY)
    if (t === 'light' || t === 'dark') return t
  } catch {
    /* private mode or blocked storage: the system one is used */
  }
  return 'system'
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')

  useEffect(() => setTheme(readStoredTheme()), [])

  function applyTheme(next: Theme) {
    setTheme(next)
    const root = document.documentElement
    if (next === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', next)
    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* no persistence: the change holds for this session */
    }
  }

  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : SunMoon

  return (
    <button
      type="button"
      onClick={() => applyTheme(THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length]!)}
      title={LABELS[theme]}
      aria-label={`${LABELS[theme]}. Cambiar tema.`}
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-chip text-ink-3',
        'transition-[colors,transform] duration-100 hover:bg-row hover:text-ink active:scale-[0.97]',
      )}
    >
      <Icon size={14} strokeWidth={1.75} aria-hidden />
    </button>
  )
}
