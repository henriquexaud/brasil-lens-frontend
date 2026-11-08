import type { Place, RouteProfile } from '@/api/types';

// Origem, até cinco paradas e destino: o mesmo teto da API.
export const MAX_WAYPOINTS = 7;

export interface Waypoint {
  /** Estável durante a edição: chave do campo e do marcador. */
  key: string;
  label: string;
  detail: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Ponto vindo do GPS do aparelho ("Minha localização"). */
  device?: boolean;
}

export interface RoutePlan {
  waypoints: Waypoint[];
  profile: RouteProfile;
}

let nextKey = 0;
export function emptyWaypoint(): Waypoint {
  return { key: `w${++nextKey}`, label: '', detail: null, latitude: null, longitude: null };
}

export function emptyPlan(): RoutePlan {
  return { waypoints: [emptyWaypoint(), emptyWaypoint()], profile: 'car' };
}

export function hasPoint(waypoint: Waypoint): boolean {
  return waypoint.latitude !== null && waypoint.longitude !== null;
}

export function fromPlace(key: string, place: Place): Waypoint {
  return {
    key,
    label: place.name,
    detail: place.detail,
    latitude: place.latitude,
    longitude: place.longitude,
  };
}

export type PlanAction =
  | { type: 'set'; index: number; waypoint: Omit<Waypoint, 'key'> }
  | { type: 'clear'; index: number }
  | {
      type: 'label';
      key: string;
      latitude: number;
      longitude: number;
      label: string;
      detail: string | null;
    }
  | { type: 'addStop'; waypoint?: Waypoint }
  | { type: 'remove'; index: number }
  | { type: 'reverse' }
  | { type: 'profile'; profile: RouteProfile }
  | { type: 'reset' };

export function planReducer(plan: RoutePlan, action: PlanAction): RoutePlan {
  const waypoints = plan.waypoints;
  switch (action.type) {
    case 'set':
      return {
        ...plan,
        waypoints: waypoints.map((item, i) =>
          i === action.index ? { ...action.waypoint, key: item.key } : item,
        ),
      };
    case 'label':
      // O endereço chega depois do ponto: só vale se o ponto ainda for o mesmo.
      return {
        ...plan,
        waypoints: waypoints.map((item) =>
          item.key === action.key &&
          item.latitude === action.latitude &&
          item.longitude === action.longitude
            ? { ...item, label: action.label, detail: action.detail }
            : item,
        ),
      };
    case 'clear':
      return {
        ...plan,
        waypoints: waypoints.map((item, i) =>
          i === action.index ? { ...emptyWaypoint(), key: item.key } : item,
        ),
      };
    case 'addStop':
      if (waypoints.length >= MAX_WAYPOINTS) return plan;
      // A parada nova entra antes do destino, como nos apps de mapa.
      return {
        ...plan,
        waypoints: [
          ...waypoints.slice(0, -1),
          action.waypoint ?? emptyWaypoint(),
          ...waypoints.slice(-1),
        ],
      };
    case 'remove':
      if (waypoints.length <= 2) return planReducer(plan, { type: 'clear', index: action.index });
      return { ...plan, waypoints: waypoints.filter((_, i) => i !== action.index) };
    case 'reverse':
      return { ...plan, waypoints: [...waypoints].reverse() };
    case 'profile':
      return { ...plan, profile: action.profile };
    case 'reset':
      return { ...emptyPlan(), profile: plan.profile };
  }
}

/** Pontos preenchidos, na ordem da viagem, no formato da API (`lat,lon;…`). */
export function routePoints(plan: RoutePlan): string | null {
  const points = plan.waypoints.filter(hasPoint);
  if (points.length < 2) return null;
  return points
    .map((item) => `${item.latitude!.toFixed(5)},${item.longitude!.toFixed(5)}`)
    .join(';');
}

/** Polyline do Google/OSRM; a API manda com precisão 6. */
export function decodePolyline(encoded: string, precision = 6): [number, number][] {
  const factor = 10 ** precision;
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;
  while (index < encoded.length) {
    for (const axis of [0, 1]) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && index < encoded.length);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lon += delta;
    }
    points.push([lat / factor, lon / factor]);
  }
  return points;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  return `${km < 10 ? km.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : Math.round(km).toLocaleString('pt-BR')} km`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const h = hours % 24;
    return h ? `${days} d ${h} h` : `${days} d`;
  }
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export const PROFILE_LABELS: Record<RouteProfile, string> = {
  car: 'Carro',
  bike: 'Bicicleta',
  foot: 'A pé',
};

/** Centro da vista para ordenar endereços por proximidade; longe demais, não ajuda. */
export function searchBias(
  bbox: string | undefined,
  zoom: number,
  device: { latitude: number; longitude: number } | null,
): { latitude: number; longitude: number } | null {
  if (device) return { latitude: device.latitude, longitude: device.longitude };
  if (!bbox || zoom < 7) return null;
  const [west = NaN, south = NaN, east = NaN, north = NaN] = bbox.split(',').map(Number);
  if ([west, south, east, north].some((value) => !Number.isFinite(value))) return null;
  return { latitude: (south + north) / 2, longitude: (west + east) / 2 };
}
