import type { ReactNode } from 'react'
import { cn } from '~/lib/cn'

/* ── Hoja ─────────────────────────────────────────────────────────────────
   El contenedor del manifiesto. Sin sombra: el papel no se proyecta sobre
   sí mismo. La separación la hace la raya y el cambio de tinte.            */
export function Hoja({
  className,
  children,
  ...resto
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-hoja border border-raya bg-hoja',
        className,
      )}
      {...resto}
    >
      {children}
    </div>
  )
}

/* ── Sello ────────────────────────────────────────────────────────────────
   Estado de sólo lectura. Deliberadamente NO es un interruptor: nada aquí
   se puede cambiar, y un interruptor mentiría sobre eso.

   Jerarquía por excepción: "Activa" es la norma y se mantiene callada;
   lo anómalo (inactiva, dada de baja, desactivada por HCM) es lo que resalta. */
type Tono = 'activa' | 'inactiva' | 'baja' | 'aviso'

const TONOS: Record<Tono, { punto: string; texto: string; fondo: string }> = {
  activa: { punto: 'bg-verde', texto: 'text-tinta-2', fondo: '' },
  inactiva: {
    punto: 'bg-transparent ring-1 ring-inset ring-tinta-4',
    texto: 'text-tinta-3',
    fondo: '',
  },
  baja: {
    punto: 'bg-oxido',
    texto: 'text-oxido',
    fondo: 'bg-oxido-lavado px-1.5 -mx-1.5 rounded-chip',
  },
  aviso: {
    punto: 'bg-ambar',
    texto: 'text-tinta-2',
    fondo: 'bg-ambar-lavado px-1.5 -mx-1.5 rounded-chip',
  },
}

export function Sello({
  tono,
  children,
  titulo,
  className,
}: {
  tono: Tono
  children: ReactNode
  titulo?: string
  className?: string
}) {
  const t = TONOS[tono]
  return (
    <span
      title={titulo}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap py-0.5 font-mono text-nota font-medium tracking-[0.06em] uppercase',
        t.texto,
        t.fondo,
        className,
      )}
    >
      <span className={cn('size-[5px] shrink-0 rounded-full', t.punto)} aria-hidden />
      {children}
    </span>
  )
}

/** Atajo para el par activo/inactivo que aparece en casi todas las tablas. */
export function SelloActividad({
  activa,
  eliminada,
  className,
}: {
  activa: boolean
  eliminada?: boolean
  className?: string
}) {
  if (eliminada) {
    return (
      <Sello tono="baja" titulo="Registro con deletedAt — borrado lógico" className={className}>
        Baja
      </Sello>
    )
  }
  return (
    <Sello tono={activa ? 'activa' : 'inactiva'} className={className}>
      {activa ? 'Activa' : 'Inactiva'}
    </Sello>
  )
}

/* ── Clave ────────────────────────────────────────────────────────────────
   Todo identificador del sistema —clave de empresa, número de ruta, código
   de terminal— va en monoespaciada con seguimiento abierto. Se leen como en
   un tablero de salidas y se distinguen al instante del texto corrido.      */
export function Clave({
  children,
  enfasis,
  className,
}: {
  children: ReactNode
  enfasis?: boolean
  className?: string
}) {
  return (
    <span
      data-cifra
      className={cn(
        'font-mono text-dato tracking-[0.04em] whitespace-nowrap',
        enfasis ? 'font-medium text-tinta' : 'text-tinta-2',
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ── Rótulo ───────────────────────────────────────────────────────────────
   Etiqueta de campo: versalitas monoespaciadas. Se demota por tamaño, peso
   y color a la vez, para que el dato de al lado sea siempre lo que domina.  */
export function Rotulo({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'block font-mono text-nota font-medium tracking-[0.09em] text-tinta-3 uppercase',
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ── Dato ─────────────────────────────────────────────────────────────────
   Par rótulo/valor de las fichas de detalle.                                */
export function Dato({
  rotulo,
  children,
  mono,
  ancho,
  className,
}: {
  rotulo: string
  children: ReactNode
  mono?: boolean
  ancho?: boolean
  className?: string
}) {
  return (
    <div className={cn(ancho && 'sm:col-span-2', className)}>
      <Rotulo>{rotulo}</Rotulo>
      <div
        data-cifra
        className={cn(
          'mt-1 text-lectura text-tinta',
          mono && 'font-mono text-dato tracking-[0.02em]',
        )}
      >
        {children}
      </div>
    </div>
  )
}

/* ── Cifra ────────────────────────────────────────────────────────────────
   Número destacado de una ficha de resumen. La magnitud manda; la unidad y
   el rótulo se retiran.                                                     */
export function Cifra({
  valor,
  rotulo,
  tono = 'tinta',
  nota,
}: {
  valor: ReactNode
  rotulo: string
  tono?: 'tinta' | 'sello' | 'oxido' | 'ambar'
  nota?: ReactNode
}) {
  return (
    <div>
      <Rotulo>{rotulo}</Rotulo>
      <div
        data-cifra
        className={cn(
          'mt-1.5 font-mono text-titulo leading-none font-medium tracking-[-0.01em]',
          tono === 'tinta' && 'text-tinta',
          tono === 'sello' && 'text-sello',
          tono === 'oxido' && 'text-oxido',
          tono === 'ambar' && 'text-ambar',
        )}
      >
        {valor}
      </div>
      {nota ? <div className="mt-1.5 text-nota text-tinta-3">{nota}</div> : null}
    </div>
  )
}

/* ── Marca ────────────────────────────────────────────────────────────────
   El sello de hule del manifiesto: marca el tramo principal de una ruta.
   Es el único lugar donde el acento aparece como figura y no como texto.    */
export function Marca({ titulo = 'Tramo principal' }: { titulo?: string }) {
  return (
    <span
      title={titulo}
      aria-label={titulo}
      className="inline-flex size-[15px] shrink-0 items-center justify-center rounded-full border border-sello/50 text-[9px] leading-none font-semibold text-sello"
    >
      P
    </span>
  )
}

/* ── Regla ────────────────────────────────────────────────────────────────
   Separador entre bloques. La raya doble es la del encabezado de un
   manifiesto impreso; la sencilla separa renglones.                         */
export function Regla({
  doble,
  className,
}: {
  doble?: boolean
  className?: string
}) {
  return (
    <div
      role="separator"
      className={cn(
        doble
          ? 'h-[3px] border-b-[3px] border-double border-raya-firme'
          : 'h-px bg-raya',
        className,
      )}
    />
  )
}
