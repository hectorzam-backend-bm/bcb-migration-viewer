import { createServerFn } from '@tanstack/react-start'
import { db, describeFailure } from './db'

export type CatalogCounts = {
  companies: number
  services: number
  stations: number
  routes: number
  segments: number
  trips: number
  tickets: number
}

/** Live rail counts. Excludes soft deletes: the rail counts what is current —
 *  except `tickets` (`OrderItem`), which has no `deletedAt`. A cancelled
 *  boleto is still a migrated one; its status carries that fact. */
export const getCatalogCounts = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ counts: CatalogCounts | null; failure: ReturnType<typeof describeFailure> | null }> => {
    try {
      const [companies, services, stations, routes, segments, trips, tickets] = await Promise.all([
        db.company.count({ where: { deletedAt: null } }),
        db.service.count({ where: { deletedAt: null } }),
        db.station.count({ where: { deletedAt: null } }),
        db.route.count({ where: { deletedAt: null } }),
        db.segment.count({ where: { deletedAt: null } }),
        db.trip.count({ where: { deletedAt: null } }),
        db.orderItem.count(),
      ])
      return { counts: { companies, services, stations, routes, segments, trips, tickets }, failure: null }
    } catch (error) {
      console.error('[counts]', error)
      return { counts: null, failure: describeFailure(error) }
    }
  },
)
