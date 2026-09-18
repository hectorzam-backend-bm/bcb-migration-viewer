/**
 * Production entry point.
 *
 * `vite build` emits a standard `fetch` handler (dist/server/server.js), not a
 * server that listens on a port. This wrapper serves the client's static files
 * and hands everything else to the handler.
 *
 * For day-to-day use of the viewer `pnpm dev` is enough; this exists to be able
 * to run the production build with `pnpm start`.
 */
// Outside the dev server nobody reads .env for us.
import 'dotenv/config'
import { serve } from 'srvx'
import { staticMiddleware } from 'srvx/static'
import handler from './dist/server/server.js'

const port = Number(process.env.PORT ?? 3000)

serve({
  port,
  middleware: [staticMiddleware({ dir: 'dist/client' })],
  fetch: (request) => handler.fetch(request),
})

console.log(`Migration viewer listening on http://localhost:${port}`)
