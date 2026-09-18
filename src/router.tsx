import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { EstadoError, EstadoVacio } from './components/estados'

export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 10_000,
    defaultStaleTime: 15_000,
    scrollRestoration: true,
    defaultErrorComponent: ({ error }) => (
      <EstadoError
        titulo="Algo falló en esta vista"
        detalle={error instanceof Error ? error.message : String(error)}
      />
    ),
    defaultNotFoundComponent: () => (
      <EstadoVacio
        titulo="Esa página no existe"
        detalle="Revisa la dirección o vuelve a un catálogo desde el riel de la izquierda."
      />
    ),
  })
}
