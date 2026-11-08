import { keepPreviousData, useQuery, type QueryClient } from '@tanstack/react-query';
import { apiGet } from '@/api/client';
import type { Place, PlaceSearch, RouteProfile, RouteResult } from '@/api/types';

const HOUR = 60 * 60 * 1000;
export const MIN_PLACE_QUERY = 3;

// A proximidade só ordena os resultados; arredondada como na API, para o cache bater.
function bias(near: { latitude: number; longitude: number } | null) {
  return near
    ? {
        latitude: Math.round(near.latitude * 10) / 10,
        longitude: Math.round(near.longitude * 10) / 10,
      }
    : {};
}

export function usePlaceSearch(
  query: string,
  near: { latitude: number; longitude: number } | null,
  enabled: boolean,
) {
  const params = bias(near);
  return useQuery({
    queryKey: [
      'transport',
      'places',
      query.toLowerCase(),
      params.latitude ?? null,
      params.longitude ?? null,
    ],
    queryFn: ({ signal }) =>
      apiGet<PlaceSearch>('/transport/places', { q: query, ...params }, signal),
    enabled: enabled && query.length >= MIN_PLACE_QUERY,
    staleTime: HOUR,
    gcTime: HOUR,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function reversePlace(queryClient: QueryClient, latitude: number, longitude: number) {
  const lat = Math.round(latitude * 1e4) / 1e4;
  const lon = Math.round(longitude * 1e4) / 1e4;
  return queryClient.fetchQuery({
    queryKey: ['transport', 'reverse', lat, lon],
    queryFn: ({ signal }) =>
      apiGet<Place | null>('/transport/places/reverse', { latitude: lat, longitude: lon }, signal),
    staleTime: HOUR,
  });
}

export function territoryPoint(queryClient: QueryClient, code: string) {
  return queryClient.fetchQuery({
    queryKey: ['transport', 'territory-point', code],
    queryFn: ({ signal }) =>
      apiGet<Place>(`/transport/territories/${encodeURIComponent(code)}/point`, {}, signal),
    staleTime: 24 * HOUR,
  });
}

export function useRoute(profile: RouteProfile, points: string | null) {
  return useQuery({
    queryKey: ['transport', 'route', profile, points],
    queryFn: ({ signal }) =>
      apiGet<RouteResult>('/transport/route', { profile, points: points! }, signal),
    enabled: points !== null,
    staleTime: HOUR,
    gcTime: HOUR,
    // Ao arrastar um ponto, a linha anterior fica até a nova chegar.
    placeholderData: keepPreviousData,
    retry: false,
  });
}
