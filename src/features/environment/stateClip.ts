import type { MapFeature } from '@/api/types';

// Fronteira do estado aberto: [[[ [lng, lat], ... ], ...anéis ], ...polígonos].
export type StateGeometry = MapFeature['geometry'];

function inRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Dentro do anel externo e fora dos buracos (a linha do Leaflet e a do PostGIS usam [lng, lat]).
export function pointInState(lng: number, lat: number, geometry: StateGeometry): boolean {
  return geometry.coordinates.some(
    ([outer, ...holes]) =>
      outer !== undefined &&
      inRing(lng, lat, outer) &&
      !holes.some((hole) => inRing(lng, lat, hole)),
  );
}
