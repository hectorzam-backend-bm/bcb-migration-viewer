# Sistema — Visor de migración BCB

Dirección elegida: **manifiesto de operaciones en papel**. Idioma de la interfaz: **español**.
Aplicación de **sólo lectura**: nada se crea, edita ni borra desde aquí.

## Intención

- **Quién**: analista de migración, en su escritorio, cotejando catálogos migrados contra lo que
  decía el sistema anterior.
- **Qué debe lograr**: escanear, comparar y confiar. Encontrar la fila rara.
- **Qué debe sentirse**: un manifiesto impreso — callado, exacto, con autoridad. Nada que sugiera
  que se puede tocar.

## Mundo y firma

- Mundo de color: papel manila, tinta de máquina de escribir, sello de hule, señalética verde de
  carretera, óxido del sello de baja.
- **Firma**: el *renglón del manifiesto* — identificadores y cifras en monoespaciada con seguimiento
  abierto, sobre papel reglado con rayas finas y una **raya doble** bajo cada encabezado. En el
  detalle de ruta, la firma es el **libro de tramos**: el tramo principal lleva el sello `P`.
- Defaults rechazados: tarjeta gris + acento azul + Inter; interruptores para un estado que no se
  puede cambiar; tabla anidada dentro de una fila expandible; cuatro pantallas CRUD sin enlazar.

## Profundidad — UNA sola estrategia

Rayas finas y tinte de superficie. **Cero sombras sobre el papel.** `shadow-alzada` se usa
exclusivamente en capas que de verdad flotan: popovers y diálogos. Nunca en tarjetas ni tablas.

## Superficies (tres pasos, mismo matiz cálido)

| Token | Uso |
| --- | --- |
| `bg-papel` | lienzo y riel de navegación (comparten fondo; los separa una raya) |
| `bg-hoja` | tablas, fichas, paneles flotantes |
| `bg-renglon` | hover de fila, ítem de navegación activo |
| `bg-hundido` | campos de entrada — van **más oscuros** que su entorno, reciben contenido |

Rayas: `border-raya` (estándar), `border-raya-tenue` (entre renglones), `border-raya-firme`
(encabezado, énfasis). Siempre alfa baja, nunca un hex sólido.

## Tinta — cuatro niveles

`text-tinta` (dato) · `text-tinta-2` (apoyo) · `text-tinta-3` (rótulo, metadato) ·
`text-tinta-4` (desactivado, marcador de ausencia).

## Color con significado

Un solo acento: `sello` (rojo de sello de hule), ~10 % de la superficie. Se usa en: marcador de
navegación activa, tramo principal, hover de enlace, casilla marcada, anillo de foco.
Semánticos: `verde` = activa · `ambar` = aviso/HCM · `oxido` = baja (borrado lógico).
**Jerarquía por excepción**: "Activa" es la norma y se mantiene callada (punto olivo + `text-tinta-2`);
lo anómalo es lo que resalta. Nunca 50 insignias verdes gritando en una tabla.

## Tipografía

- `font-serif` (IBM Plex Serif) — títulos, rótulos de navegación, títulos de ficha.
- `font-sans` (IBM Plex Sans) — texto corrido, controles.
- `font-mono` (IBM Plex Mono) — **todo** identificador, clave, cifra, tarifa, fecha y conteo.
  Un manifiesto se escribe a máquina: el dato *es* monoespaciado.

Escala 1.25 sobre base 14, redondeada a píxel: `text-nota` 11 · `text-dato` 12 · `text-lectura` 14 ·
`text-rubro` 16 · `text-seccion` 18 · `text-titulo` 22 · `text-portada` 28.
Jerarquía con tres palancas a la vez — tamaño, peso y color — nunca sólo tamaño.
Rótulos: mono 11, `tracking-[0.09em]`, versalitas, `text-tinta-3`.

## Espaciado y densidad

Base 4 px. Renglón de tabla: `px-3 py-2.5` (≈36 px de alto). Zona de control (filtros, paginación):
apretada, `px-4 py-3`. Ficha de detalle: `p-5`, bloques separados `mt-7`. Encabezado de sección:
`px-8 pt-7`. La zona de control aprieta para que el manifiesto respire por contraste.

## Radios

`rounded-chip` 2 px (controles, insignias) · `rounded-hoja` 4 px (hojas, tablas) ·
`rounded-flotante` 6 px (popovers). Radios cortos: esto es un formulario impreso.

## Movimiento

Sólo `transform` y `opacity`, nunca `transition: all`. Colores 100 ms; popovers 150 ms con
`--ease-salida`. `active:scale-[0.97]` en todo botón. Se respeta `prefers-reduced-motion`.

## Componentes ya construidos — ÚSALOS, no los reinventes

`~/components/base` → `Hoja` · `Sello` · `SelloActividad` · `Clave` · `Rotulo` · `Dato` · `Cifra` ·
`Marca` · `Regla`
`~/components/tabla` → `Manifiesto` · `Cabecera` · `Th` · `ThOrden` · `Cuerpo` · `Fila` · `Td` ·
`EnlaceDeFila` · `Paginacion`
`~/components/filtros` → `Buscador` · `FiltroLista` · `BarraDeFiltros` · tipo `Opcion`
`~/components/estados` → `EstadoVacio` · `EstadoError` · `ManifiestoCargando` · `Barra`
`~/components/ficha` → `Ficha` · `Rejilla` · `Bloque` · `Vinculo` · `VinculoExterno` · `Pestanas` · `Pestana`
`~/components/cascaron` → `Encabezado` · `Migas` · `Miga` · `SeparadorMiga` · `Riel`
`~/lib/formato` → `moneda` `entero` `minutos` `kilometros` `porcentaje` `fecha` `fechaHora`
`coordenada` `plural` `SIN_DATO` `TIPO_TERMINAL` `TIPO_RECAUDACION` `TIPO_BOLETO`
`~/lib/parametros` → `texto` `entero` `booleano` `lista` `unoDe` `tamanoDePagina` `limpiarBusqueda`
`rango` `paginaValida` `DIRECCIONES` `TAMANOS`
`~/lib/cn` → `cn`

## Reglas de datos

- Toda celda sin valor imprime `SIN_DATO` (`—`), nunca queda en blanco.
- Todo número pasa por `~/lib/formato`; las columnas numéricas van a la derecha y son tabulares.
- `Decimal` de Prisma **nunca** cruza la frontera del servidor: se convierte con `.toString()`
  dentro de la función de servidor.
- El estado de la vista (búsqueda, filtros, orden, página) vive en la URL, no en `useState`.
- Todo error de consulta se traduce con `describirFalla` y se pinta con `EstadoError`.

## Estados obligatorios

Cada vista implementa: carga (`ManifiestoCargando`), vacío por filtro (distinto de vacío por
catálogo sin registros), error, y hover/foco en cada elemento interactivo.
