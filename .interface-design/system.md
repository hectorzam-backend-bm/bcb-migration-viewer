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

## Corridas — adiciones (2026-09)

Nota: las entradas de arriba nombran componentes en español (`Sello`, `Clave`…) de
antes del commit que tradujo los identificadores a inglés; los nombres reales hoy son
`Stamp`, `KeyText`, etc. No se corrigió ese desfase al añadir esto — solo se documenta
lo nuevo, con los nombres reales actuales.

- **Firma nueva — `DayStrip`** (`src/routes/corridas/day-strip.tsx`, no compartido):
  el día es la unidad, no un filtro. Tira de chips por día con su conteo en mono;
  `‹ ›` mueve por mes, `Hoy` salta al día real aunque esté fuera de lo migrado.
- **Firma nueva — la banda sin migrar**: `ColumnMeta.groupStart` (nuevo campo en
  `src/components/data-table.tsx`) abre un `border-l border-rule` antes de una
  columna, agrupando visualmente las columnas que nunca llegaron con la migración
  (Operador, Autobús, Planeación, Despacho, Capacidad) en `text-ink-4`.
- **Regla de datos — horarios de corrida vs. instantes reales**: `Trip.departure` /
  `dispatchedAt` / `arrival` / `realDepartureAt` / `realArrivalAt` son valores de
  horario "de pared" sin zona horaria real; el driver `pg` los interpreta como UTC.
  Sus formateadores (`time`, `dayLabel`, `dayLabelFull`, `monthLabel` en
  `~/lib/format`) fijan `timeZone: 'UTC'` — nunca uses `date`/`dateTime` (sin fijar)
  para ellos. `createdAt`/`updatedAt` sí son instantes reales y siguen usando
  `date`/`dateTime` tal cual.
- `~/lib/params` ganó `isoDate` (valida `YYYY-MM-DD`).
- El identificador legado ("clave de corrida") no desapareció en la migración: es
  literalmente `Trip.id` (nunca un uuid) — verificado contra las 5,014 filas.

## Importar — adiciones (2026-09)

`/importar` es la única excepción a la primera línea de este documento ("nada que sugiera que se
puede tocar"): un asistente por pasos que sube CSV y los reenvía al backend de origen. La excepción
está acotada a esa ruta — ningún otro catálogo gana un botón de escritura. Dentro de `/importar` hay
dos vías: los 5 pasos de CSV escriben por HTTP, vía el backend (`src/server/seeds.ts`); los pasos de
Empresas/servicios y Unidades restauran desde un respaldo JSON incluido en el visor y sí escriben
aquí, directo con Prisma (`src/server/restore.ts`) — la única pantalla donde eso es cierto.

- **Firma nueva — la tira de pasos** (`src/routes/importar/stepper.tsx`, no compartida, mismo
  criterio que `DayStrip`): chips con estado hecho / actual / bloqueado / pendiente. El estado
  `actual` siempre gana el color (acento `sello`), igual que en `DayStrip`; lo bloqueado se lee por
  el candado dentro del chip y por el texto alrededor, no por robarle el color a `actual`.
- **Firma nueva — la zona de soltado** (`src/routes/importar/dropzone.tsx`): `bg-hundido` con borde
  punteado, como cualquier campo de entrada. Una zona por archivo, nunca una zona múltiple con
  adivinanza de nombres — cada slot tiene un destino sin ambigüedad.
- **Excepción a "el estado vive en la URL"**: los `File` elegidos no sobreviven una recarga (no son
  serializables), así que viven en `useState`, no en la URL. Sólo el paso actual (`?paso=`) viaja en
  la dirección. Al recargar, los archivos se pierden pero los conteos —que sí vienen de la base—
  no; la pantalla es honesta sobre cuál de los dos es la fuente de verdad.
- **Bloqueado no es error**: el paso de Corridas se pinta en tono `ambar` (aviso), nunca `oxido`
  (falla), cuando faltan rutas por asignar unidad — es el estado por defecto de una base recién
  migrada, no una falla del asistente.
- Ningún `Button` compartido nuevo: los botones de `/importar` reusan el recetario que ya vivía
  pegado en `refresh.tsx` y `states.tsx`, copiado tal cual.
- **Firma nueva — el `<select>` de unidades** (paso Unidades, dentro de `index.tsx`): el primer
  elemento nativo de formulario del visor que no es texto ni archivo. Mismas superficies que el
  input de confirmación de Limpiar base (`bg-hundido`, `border-regla`, foco en `sello/60`) para que
  no se lea como un componente distinto, sólo como otro tipo de campo.
- **Atajo de migración, dicho en voz alta**: la asignación masiva de unidad a rutas (misma
  pantalla) es una decisión que el asistente toma por conveniencia, no una regla de negocio. El
  texto junto al botón lo dice explícitamente — no se disfraza de flujo normal.

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
