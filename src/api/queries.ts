/**
 * Hooks de dados (TanStack Query).
 *
 * Por que uma biblioteca de fetching aqui e não estado global: o produto tem
 * exatamente um tipo de estado difícil — respostas de servidor cacheadas por
 * escopo geográfico. React Query resolve deduplicação, cache, estados de
 * carregamento e prefetch. Redux resolveria um problema que não existe: não há
 * estado compartilhado complexo no cliente.
 *
 * O estado da *interface* (camadas ativas, território selecionado) fica em
 * `useState`/hook local, como deve.
 */
import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';

import { useDeferredReady } from '@/lib/useDeferredReady';

import { apiGet } from './client';
import { useCancelWhenDisabled } from './queryLifecycle';
import type {
  FireHotspotCollection,
  FireHotspotDetails,
  FireHotspotLocation,
  FireHotspotQuery,
  FireSummary,
  HydroFeatureCollection,
  HydroQuery,
  MapFeatureCollection,
  MapQuery,
  TerritoryLevel,
  TerritoryListResponse,
} from './types';

/** Dados mudam só quando a ingestão roda: cache longo é correto, não preguiça. */
const STATIC_DATA_STALE_TIME = 5 * 60 * 1000;
import { queryKeys, FIRE_HOTSPOT_HOURS } from './queryKeys';
export { queryKeys, FIRE_HOTSPOT_HOURS } from './queryKeys';

/* ------------------------------------------------------------ auxiliares --
 *
 * Três disciplinas se repetem nas camadas carregadas em segundo plano: cancelar
 * a requisição quando a camada sai de cena, completar páginas só na ociosidade
 * do navegador e reaproveitar a leitura de um lote no cache de cada cidade.
 */

function geometryOptions(
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

/** Malha territorial progressiva: carrega overview e troca por detail em repouso. */
export function useMapLayer(query: MapQuery, enabled = true) {
  const { level } = query;
  const parent = query.parent ?? null;
  const overview = useQuery({
    ...geometryOptions(level, parent, 'overview'),
    enabled,
    placeholderData: (previous) => previous,
  });
  const upgrade = useDeferredReady(
    `map:${level}:${parent}`,
    enabled && Boolean(overview.data) && !overview.isPlaceholderData,
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

/**
 * Consulta oficial da malha hidrográfica (ANA / SNIRH).
 * Carrega cursos d'água e massas d'água com resolução e detalhes progressivos.
 */
export function useHydrography(query: HydroQuery, enabled = true) {
  const queryKey = queryKeys.hydrography(query);
  useCancelWhenDisabled(queryKey, enabled);
  return useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      apiGet<HydroFeatureCollection>(
        '/hydrography',
        {
          level: query.level,
          parent: query.parent ?? undefined,
          include_water_bodies: query.includeWaterBodies ?? true,
          include_rivers: query.includeRivers ?? true,
          zoom: query.zoom ?? 4,
          bbox: query.bbox,
        },
        signal,
      ),
    enabled,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** A camada só consulta o INPE enquanto ativa; detalhes não entram no carregamento inicial. */
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

/** Os municípios de uma UF já estão no resumo do Brasil: a mesma janela, recortada. */
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
    // O resumo leva segundos na fonte. Enquanto o novo chega, o mapa não apaga:
    // a janela anterior do mesmo recorte continua pintada e, ao abrir uma UF,
    // os municípios dela no resumo do Brasil já pintam o estado.
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

/** Lista de territórios para filtros e navegação geográfica. */
export function useTerritories(level: TerritoryLevel, enabled = true) {
  return useQuery({
    queryKey: queryKeys.territories(level),
    queryFn: ({ signal }) =>
      apiGet<TerritoryListResponse>('/territories', { level, limit: 1000 }, signal),
    enabled,
    staleTime: STATIC_DATA_STALE_TIME,
  });
}

/**
 * Busca de territórios delegada ao backend, que compara nome e sigla sem
 * acento (colunas normalizadas na ingestão) e ordena por relevância.
 */
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
export type {
  FollowTarget,
  SetNotificationsVariables,
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
  snapBbox,
  useViewportWeather,
} from '@/features/weather/queries';
