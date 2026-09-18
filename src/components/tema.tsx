import { useEffect, useState } from 'react'
import { Moon, Sun, SunMoon } from 'lucide-react'
import { cn } from '~/lib/cn'

export type Tema = 'sistema' | 'claro' | 'oscuro'
const LLAVE = 'bcb.tema'
const CICLO: Array<Tema> = ['sistema', 'claro', 'oscuro']

const ROTULOS: Record<Tema, string> = {
  sistema: 'Tema del sistema',
  claro: 'Papel claro',
  oscuro: 'Papel bajo lámpara',
}

/** Se inyecta antes de pintar para que no haya destello de tema equivocado. */
export const GUION_TEMA = `(function(){try{var t=localStorage.getItem('${LLAVE}');if(t==='claro'||t==='oscuro'){document.documentElement.setAttribute('data-tema',t)}}catch(e){}})()`

function leer(): Tema {
  try {
    const t = localStorage.getItem(LLAVE)
    if (t === 'claro' || t === 'oscuro') return t
  } catch {
    /* modo privado o almacenamiento bloqueado: se usa el del sistema */
  }
  return 'sistema'
}

export function InterruptorDeTema() {
  const [tema, setTema] = useState<Tema>('sistema')

  useEffect(() => setTema(leer()), [])

  function aplicar(siguiente: Tema) {
    setTema(siguiente)
    const raiz = document.documentElement
    if (siguiente === 'sistema') raiz.removeAttribute('data-tema')
    else raiz.setAttribute('data-tema', siguiente)
    try {
      if (siguiente === 'sistema') localStorage.removeItem(LLAVE)
      else localStorage.setItem(LLAVE, siguiente)
    } catch {
      /* sin persistencia: el cambio vale para esta sesión */
    }
  }

  const Icono = tema === 'claro' ? Sun : tema === 'oscuro' ? Moon : SunMoon

  return (
    <button
      type="button"
      onClick={() => aplicar(CICLO[(CICLO.indexOf(tema) + 1) % CICLO.length]!)}
      title={ROTULOS[tema]}
      aria-label={`${ROTULOS[tema]}. Cambiar tema.`}
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-chip text-tinta-3',
        'transition-[colors,transform] duration-100 hover:bg-renglon hover:text-tinta active:scale-[0.97]',
      )}
    >
      <Icono size={14} strokeWidth={1.75} aria-hidden />
    </button>
  )
}
