/**
 * Server entry — TanStack Start's default one, plus a guard for requests the
 * browser has already given up on.
 *
 * Hovering a link preloads its route (`defaultPreload: 'intent'` in
 * `router.tsx`); navigating away or reloading while that request is in flight
 * closes the connection. Start then rethrows the abort on purpose
 * (`createStartHandler`: `if (signal.aborted) throw signal.reason`), and the
 * dev server logs every one as an unhandled 500 `AbortError` — noise that
 * buries real errors. Nobody is waiting for that response anymore, so answer
 * it with an empty 499 (nginx's "client closed request") instead.
 *
 * Anything thrown while the client is still connected is rethrown untouched.
 */
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import { createServerEntry } from '@tanstack/react-start/server-entry'

const handler = createStartHandler(defaultStreamHandler)

export default createServerEntry({
  async fetch(request, opts) {
    try {
      return await handler(request, opts)
    } catch (error) {
      if (request.signal.aborted) return new Response(null, { status: 499 })
      throw error
    }
  },
})
