import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { ErrorState, EmptyState } from './components/states'

export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 10_000,
    defaultStaleTime: 15_000,
    scrollRestoration: true,
    defaultErrorComponent: ({ error }) => (
      <ErrorState
        title="Algo falló en esta vista"
        detail={error instanceof Error ? error.message : String(error)}
      />
    ),
    defaultNotFoundComponent: () => (
      <EmptyState
        title="Esa página no existe"
        detail="Revisa la dirección o vuelve a un catálogo desde el riel de la izquierda."
      />
    ),
  })
}
