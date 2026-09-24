import type { DataContext, FireHotspotQuery, HydroQuery, MapQuery, TerritoryLevel } from './types';

/** Janela curta reduz o payload e mantém o mapa alinhado com o uso recente. */
export const FIRE_HOTSPOT_HOURS = 24;

export const queryKeys = {
  contexts: () => ['contexts'] as const,
  indicators: (level?: TerritoryLevel, context?: DataContext) =>
    ['indicators', level ?? 'all', context ?? 'all'] as const,
  map: (query: MapQuery) =>
    [
      'map',
      query.level,
      query.parent ?? null,
      query.indicator ?? null,
      query.year ?? 'latest',
      query.lod ?? null,
    ] as const,
  hydrography: (query: HydroQuery) =>
    [
      'hydrography',
      query.level,
      query.parent ?? null,
      query.includeWaterBodies ?? true,
      query.includeRivers ?? true,
      query.zoom ?? 4,
      query.bbox,
    ] as const,
  fireHotspots: (query: FireHotspotQuery) =>
    [
      'fire-hotspots',
      query.level,
      query.parent ?? null,
      query.hours ?? FIRE_HOTSPOT_HOURS,
    ] as const,
  overview: (ibgeCode: string, year?: string | number) =>
    ['overview', ibgeCode, year ?? 'latest'] as const,
  territories: (level: TerritoryLevel) => ['territories', level] as const,
  savedViews: () => ['saved-views'] as const,
  followedMunicipalities: () => ['me', 'followed-municipalities'] as const,
  weatherAlerts: () => ['weather', 'alerts'] as const,
};
