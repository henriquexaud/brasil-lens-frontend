import type { FireHotspotQuery, HydroQuery, MapQuery, TerritoryLevel } from './types';

/** Janela curta reduz o payload e mantém o mapa alinhado com o uso recente. */
export const FIRE_HOTSPOT_HOURS = 24;

export const queryKeys = {
  map: (query: MapQuery) =>
    [
      'map',
      query.level,
      query.parent ?? null,
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
  territories: (level: TerritoryLevel) => ['territories', level] as const,
  followedMunicipalities: () => ['me', 'followed-municipalities'] as const,
  weatherAlerts: () => ['weather', 'alerts'] as const,
};
