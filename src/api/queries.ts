import {
  hashKey,
  keepPreviousData,
  useIsFetching,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useRef } from 'react';

import { coversArea, hydroArea } from '@/features/map/viewport';
import { useDeferredReady } from '@/lib/useDeferredReady';

import { apiGet } from './client';
import { queryKeys, FIRE_HOTSPOT_HOURS } from './queryKeys';
import { useCancelWhenDisabled } from './queryLifecycle';
import type {
  FireHotspotCollection,
  FireHotspotDetails,
  FireHotspotLocation,
  FireHotspotQuery,
  FireSummary,
  HydroFeatureCollection,
  MapFeatureCollection,
  MapQuery,
  TerritoryListResponse,
} from './types';

export { FIRE_HOTSPOT_HOURS } from './queryKeys';

export function geometryOptions(
  level: MapQuery['level'],
  parent: string | null,
  lod: 'overview' | 'detail',
) {
  return {
    queryKey: queryKeys.map({ level, parent, lod }),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiGet<MapFeatureCollection>('/map', { level, parent, lod }, signal),
    staleTime: 30 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
  };
}

export function useMapLayer(query: Omit<MapQuery, 'lod'>) {
  const { level } = query;
  const parent = query.parent ?? null;
  const overview = useQuery({
    ...geometryOptions(level, parent, 'overview'),
    placeholderData: (previous) => previous,
  });
  const upgrade = useDeferredReady(
    `map:${level}:${parent}`,
    Boolean(overview.data) && !overview.isPlaceholderData,
  );
  const detail = useQuery({ ...geometryOptions(level, parent, 'detail'), enabled: upgrade });
  const data = detail.data ?? (overview.isPlaceholderData ? undefined : overview.data);
  return {
    data,
    error: overview.error ?? detail.error,
    isFetching: overview.isFetching || detail.isFetching,
    isPlaceholderData: !data || overview.isPlaceholderData,
  };
}

// Rios e lagos quase não mudam e são a camada de menor prioridade. Uma área já
// carregada nesse detalhe que cubra a vista é reaproveitada, só uma requisição
// corre por vez e nenhuma é abortada: o servidor termina o trabalho na ANA de
// qualquer jeito, então a resposta fica no cache em vez de ser descartada.
export function useHydrography(detail: number, bbox: string | undefined, enabled: boolean) {
  const client = useQueryClient();
  const loaded = bbox
    ? client
        .getQueryCache()
        .findAll({ queryKey: ['hydrography', detail] })
        .map((query) => query.queryKey[2])
        .find((area): area is string => typeof area === 'string' && coversArea(area, bbox))
    : undefined;
  const area = loaded ?? hydroArea(detail, bbox);
  const queryKey = queryKeys.hydrography(detail, area);
  const hash = hashKey(queryKey);
  // Só as outras contam: a própria, ao falhar, voltaria a se habilitar e refaria em laço.
  const busy =
    useIsFetching({ queryKey: ['hydrography'], predicate: (query) => query.queryHash !== hash }) >
    0;
  return useQuery({
    queryKey,
    queryFn: () => apiGet<HydroFeatureCollection>('/hydrography', { zoom: detail, bbox: area }),
    enabled: enabled && !busy,
    placeholderData: keepPreviousData,
    staleTime: (query) => (query.state.data?.metadata.status === 'partial' ? 60_000 : Infinity),
    gcTime: 60 * 60 * 1000,
  });
}

export function useFireHotspots(query: FireHotspotQuery, enabled = true) {
  const queryKey = queryKeys.fireHotspots(query);
  useCancelWhenDisabled(queryKey, enabled);
  return useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      apiGet<FireHotspotCollection>(
        '/fire-hotspots',
        {
          level: query.level,
          parent: query.parent,
          hours: query.hours ?? FIRE_HOTSPOT_HOURS,
        },
        signal,
      ),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchInterval: enabled ? 10 * 60 * 1000 : false,
    refetchOnWindowFocus: true,
  });
}

export function useFireHotspotDetails(
  query: FireHotspotQuery,
  location: FireHotspotLocation | null,
) {
  return useQuery({
    queryKey: [...queryKeys.fireHotspots(query), 'identify', location],
    queryFn: ({ signal }) =>
      apiGet<FireHotspotDetails>(
        '/fire-hotspots/identify',
        {
          level: query.level,
          parent: query.parent,
          hours: query.hours ?? FIRE_HOTSPOT_HOURS,
          ...location,
        },
        signal,
      ),
    enabled: Boolean(location),
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

function stateFireSummary(summary: FireSummary, parent: string): FireSummary {
  return {
    ...summary,
    municipalities: summary.municipalities.filter((item) => item.ibgeCode.startsWith(parent)),
    states: summary.states.filter((item) => item.ibgeCode === parent),
    rankedMunicipalities: undefined,
  };
}

export function useFireSummary(query: FireHotspotQuery, at: string | undefined, enabled: boolean) {
  const queryKey = [...queryKeys.fireHotspots(query), 'summary', at];
  const hours = query.hours ?? FIRE_HOTSPOT_HOURS;
  useCancelWhenDisabled(queryKey, enabled);
  const result = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      apiGet<FireSummary>(
        '/fire-hotspots/summary',
        {
          level: query.level,
          parent: query.parent,
          hours,
          at,
        },
        signal,
      ),
    enabled: enabled && Boolean(at),
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    placeholderData: (previous, previousQuery) => {
      const [, level, parent, previousHours] = previousQuery?.queryKey ?? [];
      if (!previous || previousHours !== hours) return undefined;
      if (level === query.level && parent === (query.parent ?? null)) return previous;
      return level === 'country' && query.level === 'state' && query.parent
        ? stateFireSummary(previous, query.parent)
        : undefined;
    },
  });

  const lastValidRef = useRef<FireSummary | undefined>(undefined);
  const lastScopeRef = useRef<string>('');
  const currentScope = `${query.level}:${query.parent ?? 'BR'}`;

  if (lastScopeRef.current !== currentScope) {
    lastScopeRef.current = currentScope;
    if (result.data) {
      lastValidRef.current = result.data;
    } else if (lastValidRef.current && query.level === 'state' && query.parent) {
      lastValidRef.current = stateFireSummary(lastValidRef.current, query.parent);
    } else {
      lastValidRef.current = undefined;
    }
  } else if (result.data) {
    lastValidRef.current = result.data;
  }

  const effectiveData = result.data ?? lastValidRef.current;

  return {
    ...result,
    data: effectiveData,
  };
}

export function useTerritorySearch(query: string, enabled = true, limit = 8) {
  const clean = query.trim();
  return useQuery({
    queryKey: ['territories', 'search', clean, limit] as const,
    queryFn: ({ signal }) =>
      apiGet<TerritoryListResponse>('/territories', { search: clean, limit }, signal),
    enabled: enabled && clean.length >= 2,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

export {
  useFollowedMunicipalities,
  useFollowMunicipality,
  useUnfollowMunicipality,
  useSetMunicipalityNotifications,
} from '@/features/follow/useFollowedMunicipalities';
export {
  weatherCurrentOptions,
  useWeatherCurrent,
  useMunicipalityWeather,
  useUserStateWeather,
  useWeatherAlerts,
  useVisibleMunicipalities,
  useSelectedBoundary,
  useNationalWeather,
  useViewportWeather,
} from '@/features/weather/queries';
