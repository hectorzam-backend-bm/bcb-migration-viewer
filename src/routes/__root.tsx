/// <reference types="vite/client" />
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { Rail } from '~/components/shell'
import { ErrorState } from '~/components/states'
import { THEME_SCRIPT } from '~/components/theme'
import { getCatalogCounts } from '~/server/catalogs'
import styles from '~/styles/app.css?url'

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
    links: [{ rel: 'stylesheet', href: styles }],
  }),
  loader: async () => getCatalogCounts(),
  shellComponent: RootDocument,
  component: Shell,
  errorComponent: ({ error, reset }) => (
    <ErrorState
      title="No fue posible cargar el visor"
      detail={error instanceof Error ? error.message : String(error)}
      onRetry={reset}
    />
  ),
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="min-h-dvh">
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function Shell() {
  const { counts } = Route.useLoaderData()

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Rail counts={counts ?? undefined} />
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
