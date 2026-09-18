import { createServerFn } from '@tanstack/react-start'
import { db, describeFailure } from './db'

/**
 * The viewer's summary page: the state of the migration at a glance.
 *
 * Everything is computed with aggregate counts —never pulling rows into
 * memory— and returned as flat numbers. The Spanish labels live in the screen,
 * not here: this file only counts.
 */

/* ── Catalogs ────────────────────────────────────────────────────────────── */

export const CATALOG_KEYS = [
  'companies',
  'services',
  'stations',
  'routes',
  'segments',
] as const
export type CatalogKey = (typeof CATALOG_KEYS)[number]

export type CatalogCount = {
  /** Records without a soft delete. */
  current: number
  /** Current records with isActive = false. */
  inactive: number
  /** Records with deletedAt. */
  deleted: number
}

/* ── Integrity checks ────────────────────────────────────────────────────── */

export const CHECK_KEYS = [
  'routesWithoutMainSegment',
  'routesWithoutSegments',
  'circularSegments',
  'servicesWithoutRoutes',
  'servicesWithoutStations',
  'stationsWithoutServices',
  'companiesWithoutServices',
  'routesWithoutSalesChannels',
  'routesWithoutPassengerTypes',
] as const
export type CheckKey = (typeof CHECK_KEYS)[number]

/* ── HCM sync ────────────────────────────────────────────────────────────── */

export type HcmCount = {
  /** hcmLastSeenRunId != null — brought in by the sync job. */
  managed: number
  /** hcmLastSeenRunId == null — entered by hand. */
  manual: number
  /** hcmDisabled = true — GER stopped reporting them. */
  disabled: number
}

export type Summary = {
  generatedAt: string
  catalogs: Record<CatalogKey, CatalogCount>
  checks: Record<CheckKey, number>
  hcm: { companies: HcmCount; services: HcmCount }
}

export type SummaryResponse =
  | ({ ok: true } & Summary)
  | { ok: false; failure: ReturnType<typeof describeFailure> }

const CURRENT = { deletedAt: null } as const
const DELETED = { deletedAt: { not: null } } as const

async function countCatalogs(): Promise<Record<CatalogKey, CatalogCount>> {
  const [
    currentCompanies,
    inactiveCompanies,
    deletedCompanies,
    currentServices,
    inactiveServices,
    deletedServices,
    currentStations,
    inactiveStations,
    deletedStations,
    currentRoutes,
    inactiveRoutes,
    deletedRoutes,
    currentSegments,
    inactiveSegments,
    deletedSegments,
  ] = await Promise.all([
    db.company.count({ where: CURRENT }),
    db.company.count({ where: { ...CURRENT, isActive: false } }),
    db.company.count({ where: DELETED }),

    db.service.count({ where: CURRENT }),
    db.service.count({ where: { ...CURRENT, isActive: false } }),
    db.service.count({ where: DELETED }),

    db.station.count({ where: CURRENT }),
    db.station.count({ where: { ...CURRENT, isActive: false } }),
    db.station.count({ where: DELETED }),

    db.route.count({ where: CURRENT }),
    db.route.count({ where: { ...CURRENT, isActive: false } }),
    db.route.count({ where: DELETED }),

    db.segment.count({ where: CURRENT }),
    db.segment.count({ where: { ...CURRENT, isActive: false } }),
    db.segment.count({ where: DELETED }),
  ])

  return {
    companies: { current: currentCompanies, inactive: inactiveCompanies, deleted: deletedCompanies },
    services: { current: currentServices, inactive: inactiveServices, deleted: deletedServices },
    stations: {
      current: currentStations,
      inactive: inactiveStations,
      deleted: deletedStations,
    },
    routes: { current: currentRoutes, inactive: inactiveRoutes, deleted: deletedRoutes },
    segments: { current: currentSegments, inactive: inactiveSegments, deleted: deletedSegments },
  }
}

async function countChecks(): Promise<Record<CheckKey, number>> {
  const [
    routesWithoutMainSegment,
    routesWithoutSegments,
    circularSegments,
    servicesWithoutRoutes,
    servicesWithoutStations,
    stationsWithoutServices,
    companiesWithoutServices,
    routesWithoutSalesChannels,
    routesWithoutPassengerTypes,
  ] = await Promise.all([
    // An active route with no current segment marked as main.
    db.route.count({
      where: {
        ...CURRENT,
        isActive: true,
        segments: { none: { isMain: true, deletedAt: null } },
      },
    }),
    db.route.count({
      where: { ...CURRENT, segments: { none: { deletedAt: null } } },
    }),
    // Column against column: origin and destination point at the same station.
    db.segment.count({
      where: {
        ...CURRENT,
        originStationId: { equals: db.segment.fields.destinationStationId },
      },
    }),
    db.service.count({
      where: { ...CURRENT, routes: { none: { deletedAt: null } } },
    }),
    db.service.count({
      where: { ...CURRENT, stations: { none: { deletedAt: null } } },
    }),
    db.station.count({
      where: { ...CURRENT, services: { none: { deletedAt: null } } },
    }),
    db.company.count({
      where: { ...CURRENT, services: { none: { deletedAt: null } } },
    }),
    // RouteSalesChannel and RoutePassengerType have no soft delete: either the
    // relation row exists or it does not.
    db.route.count({ where: { ...CURRENT, salesChannels: { none: {} } } }),
    db.route.count({ where: { ...CURRENT, passengerTypes: { none: {} } } }),
  ])

  return {
    routesWithoutMainSegment,
    routesWithoutSegments,
    circularSegments,
    servicesWithoutRoutes,
    servicesWithoutStations,
    stationsWithoutServices,
    companiesWithoutServices,
    routesWithoutSalesChannels,
    routesWithoutPassengerTypes,
  }
}

async function countHcm(): Promise<{ companies: HcmCount; services: HcmCount }> {
  const [
    managedCompanies,
    manualCompanies,
    disabledCompanies,
    managedServices,
    manualServices,
    disabledServices,
  ] = await Promise.all([
    db.company.count({ where: { ...CURRENT, hcmLastSeenRunId: { not: null } } }),
    db.company.count({ where: { ...CURRENT, hcmLastSeenRunId: null } }),
    db.company.count({ where: { ...CURRENT, hcmDisabled: true } }),

    db.service.count({ where: { ...CURRENT, hcmLastSeenRunId: { not: null } } }),
    db.service.count({ where: { ...CURRENT, hcmLastSeenRunId: null } }),
    db.service.count({ where: { ...CURRENT, hcmDisabled: true } }),
  ])

  return {
    companies: {
      managed: managedCompanies,
      manual: manualCompanies,
      disabled: disabledCompanies,
    },
    services: {
      managed: managedServices,
      manual: manualServices,
      disabled: disabledServices,
    },
  }
}

/**
 * If the database does not answer, the whole summary page falls back to
 * <ErrorState>: painting cards at zero would lie that the migration is empty.
 */
export const getSummary = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SummaryResponse> => {
    try {
      const [catalogs, checks, hcm] = await Promise.all([
        countCatalogs(),
        countChecks(),
        countHcm(),
      ])
      return { ok: true, generatedAt: new Date().toISOString(), catalogs, checks, hcm }
    } catch (error) {
      console.error('[summary]', error)
      return { ok: false, failure: describeFailure(error) }
    }
  },
)
