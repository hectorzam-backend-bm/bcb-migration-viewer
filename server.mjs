/**
 * Entrada de producción.
 *
 * `vite build` emite un manejador `fetch` estándar (dist/server/server.js), no un
 * servidor que escuche un puerto. Esta envoltura sirve los archivos estáticos del
 * cliente y le pasa todo lo demás al manejador.
 *
 * Para el uso diario del visor basta `pnpm dev`; esto existe para poder levantar
 * la compilación de producción con `pnpm start`.
 */
// Fuera del servidor de desarrollo nadie lee .env por nosotros.
import 'dotenv/config'
import { serve } from 'srvx'
import { staticMiddleware } from 'srvx/static'
import manejador from './dist/server/server.js'

const puerto = Number(process.env.PORT ?? 3000)

serve({
  port: puerto,
  middleware: [staticMiddleware({ dir: 'dist/client' })],
  fetch: (peticion) => manejador.fetch(peticion),
})

console.log(`Visor de migración escuchando en http://localhost:${puerto}`)
