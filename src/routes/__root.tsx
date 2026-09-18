/// <reference types="vite/client" />
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { Riel } from '~/components/cascaron'
import { EstadoError } from '~/components/estados'
import { GUION_TEMA } from '~/components/tema'
import { obtenerConteos } from '~/server/catalogos'
import estilos from '~/styles/app.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Visor de migración · BCB' },
      {
        name: 'description',
        content: 'Consulta de sólo lectura de empresas, servicios, terminales y rutas.',
      },
      { name: 'color-scheme', content: 'light dark' },
    ],
    links: [{ rel: 'stylesheet', href: estilos }],
  }),
  loader: async () => obtenerConteos(),
  shellComponent: Documento,
  component: Cascaron,
  errorComponent: ({ error, reset }) => (
    <EstadoError
      titulo="No fue posible cargar el visor"
      detalle={error instanceof Error ? error.message : String(error)}
      alReintentar={reset}
    />
  ),
})

function Documento({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <script dangerouslySetInnerHTML={{ __html: GUION_TEMA }} />
        <HeadContent />
      </head>
      <body className="min-h-dvh">
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function Cascaron() {
  const { conteos } = Route.useLoaderData()

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Riel conteos={conteos ?? undefined} />
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
