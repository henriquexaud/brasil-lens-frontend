import type { FireHotspotQuery, MapQuery } from './types';

export const FIRE_HOTSPOT_HOURS = 48;

export const queryKeys = {
  map: (query: MapQuery) => ['map', query.level, query.parent ?? null, query.lod ?? null] as const,
  hydrography: (detail: number, area: string | undefined) =>
    ['hydrography', detail, area ?? null] as const,
  fireHotspots: (query: FireHotspotQuery) =>
    [
      'fire-hotspots',
      query.level,
      query.parent ?? null,
      query.hours ?? FIRE_HOTSPOT_HOURS,
    ] as const,
  followedMunicipalities: (userId: string | null) =>
    ['me', userId, 'followed-municipalities'] as const,
  weatherAlerts: () => ['weather', 'alerts'] as const,
};
