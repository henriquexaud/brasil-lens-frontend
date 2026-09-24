/**
 * Hooks de dados (TanStack Query).
 *
 * Por que uma biblioteca de fetching aqui e não estado global: o produto tem
 * exatamente um tipo de estado difícil — respostas de servidor cacheadas por
 * (indicador, ano, escopo). React Query resolve deduplicação, cache, estados de
 * carregamento e prefetch. Redux resolveria um problema que não existe: não há
 * estado compartilhado complexo no cliente.
 *
 * O estado da *interface* (indicador escolhido, território selecionado) fica em
 * `useState`/hook local, como deve.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useDeferredReady } from '@/lib/useDeferredReady';

import { apiGet } from './client';
import { useCancelWhenDisabled } from './queryLifecycle';
import type {
  ContextListResponse,
  DataContext,
  FireHotspotCollection,
  FireHotspotDetails,
  FireHotspotLocation,
  FireHotspotQuery,
  FireSummary,
  HydroFeatureCollection,
  HydroQuery,
  IndicatorListResponse,
  MapFeatureCollection,
  MapQuery,
  MapValuesResponse,
  TerritoryLevel,
  TerritoryListResponse,
  TerritoryOverview,
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

/**
 * Contextos de dados disponíveis (sociopolítico, clima/ambiente)
 * e os providers registrados em cada um. Metadado do backend,
 * não muda entre ingestões — mesmo `staleTime` longo do catálogo.
 */
export function useContexts() {
  return useQuery({
    queryKey: queryKeys.contexts(),
    queryFn: ({ signal }) => apiGet<ContextListResponse>('/contexts', undefined, signal),
    staleTime: STATIC_DATA_STALE_TIME,
  });
}

export function useIndicators(level?: TerritoryLevel, context?: DataContext, enabled = true) {
  return useQuery({
    queryKey: queryKeys.indicators(level, context),
    queryFn: ({ signal }) =>
      apiGet<IndicatorListResponse>('/indicators', { level, context }, signal),
    enabled,
    staleTime: STATIC_DATA_STALE_TIME,
    // O catálogo do nível/contexto anterior serve de ponte enquanto o novo
    // carrega: sem isso o painel de controles desaparecia e voltava a cada
    // drill-down ou troca de contexto. `isPlaceholderData` permite ao
    // chamador saber que a cobertura temporal ainda é a do nível antigo.
    placeholderData: (previous) => previous,
  });
}

function geometryOptions(
  level: MapQuery['level'],
  parent: string | null,
  lod: 'overview' | 'detail',
) {
  return {
    queryKey: queryKeys.map({ level, parent, lod }),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiGet<MapFeatureCollection>('/map', { level, parent, year: 'latest', lod }, signal),
    staleTime: 30 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
  };
}

function withValues(
  geometry: MapFeatureCollection,
  values: MapValuesResponse,
): MapFeatureCollection {
  const items = Array.isArray(values?.values) ? values.values : [];
  const byCode = new Map(items.map((item) => [item.ibgeCode, item]));
  return {
    ...geometry,
    indicator: values?.indicator ?? null,
    statistics: values?.statistics ?? null,
    classification: values?.classification ?? null,
    features: (geometry?.features ?? []).map((feature) => {
      const item = byCode.get(feature.properties.ibgeCode);
      return {
        ...feature,
        properties: {
          ...feature.properties,
          value: item?.value ?? null,
          normalizedValue: item?.normalizedValue ?? null,
          classIndex: item?.classIndex ?? null,
        },
      };
    }),
  };
}

/**
 * Camada do mapa: malha e valores em consultas separadas.
 *
 * A malha chega primeiro no LOD `overview` — ~6× menor e com diferença abaixo
 * de um pixel nos zooms do Brasil e da UF — e é trocada pela `detail` quando
 * o navegador fica ocioso. Os valores vêm de `/map/values`: trocar indicador
 * ou ano não retransmite a malha, e contornos, clima e coropleta compartilham
 * a mesma consulta de geometria.
 *
 * Enquanto um novo recorte ou indicador carrega, a camada anterior continua
 * visível (`isPlaceholderData`), em vez de o mapa piscar em branco.
 */
export function useMapLayer(query: MapQuery, enabled = true) {
  const { level } = query;
  const parent = query.parent ?? null;
  const indicator = query.indicator ?? null;
  const year = query.year ?? 'latest';
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
  const values = useQuery({
    queryKey: ['map-values', level, parent, indicator, year],
    queryFn: ({ signal }) =>
      apiGet<MapValuesResponse>('/map/values', { level, parent, indicator, year }, signal),
    enabled: enabled && Boolean(indicator),
    staleTime: 30 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    placeholderData: (previousData, previousQuery) => {
      if (!previousData || !previousQuery) return undefined;
      const key = previousQuery.queryKey as unknown[];
      // Só mantém dados anteriores se for exatamente o mesmo escopo e indicador (ex.: trocando ano)
      if (
        key[0] === 'map-values' &&
        key[1] === level &&
        key[2] === parent &&
        key[3] === indicator
      ) {
        return previousData;
      }
      return undefined;
    },
  });

  const geometry = detail.data ?? (overview.isPlaceholderData ? undefined : overview.data);
  const scopeValues =
    values.data &&
    Array.isArray(values.data.values) &&
    values.data.level === level &&
    (values.data.parent ?? null) === parent &&
    (!indicator || values.data.indicator?.key === indicator)
      ? values.data
      : undefined;

  const merged = useMemo(() => {
    if (!geometry) return undefined;
    if (!indicator) return geometry;
    if (scopeValues) return withValues(geometry, scopeValues);
    // Transição de indicador: mantém os polígonos no mapa em tom neutro enquanto busca os novos valores,
    // garantindo que nunca exiba dados ou classificação do indicador antigo.
    return {
      ...geometry,
      indicator: null,
      statistics: null,
      classification: null,
      features: geometry.features.map((feature) => ({
        ...feature,
        properties: {
          ...feature.properties,
          value: null,
          normalizedValue: null,
          classIndex: null,
        },
      })),
    };
  }, [geometry, indicator, scopeValues]);

  const last = useRef<MapFeatureCollection | undefined>(undefined);
  if (
    merged &&
    merged.scope.level === level &&
    (merged.scope.parent ?? null) === parent &&
    (!indicator || merged.indicator?.key === indicator)
  ) {
    last.current = merged;
  }

  const validLast =
    last.current &&
    last.current.scope.level === level &&
    (last.current.scope.parent ?? null) === parent &&
    (!indicator || last.current.indicator?.key === indicator)
      ? last.current
      : undefined;

  const isPendingValues = Boolean(indicator) && !scopeValues;

  return {
    data: merged ?? validLast,
    error: overview.error ?? values.error,
    isFetching: overview.isFetching || values.isFetching,
    isPlaceholderData:
      !merged || (Boolean(indicator) && values.isPlaceholderData) || isPendingValues,
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
  return useQuery({
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
}

/** Definição única da consulta de overview, usada pelo hook e pelo prefetch. */
function overviewQuery(ibgeCode: string, year?: string | number) {
  const effectiveYear = year && year !== 'latest' ? Number(year) : undefined;
  return {
    queryKey: queryKeys.overview(ibgeCode, effectiveYear),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiGet<TerritoryOverview>(
        `/territories/${ibgeCode}/overview`,
        effectiveYear ? { year: effectiveYear } : undefined,
        signal,
      ),
    staleTime: STATIC_DATA_STALE_TIME,
  };
}

export function useTerritoryOverview(ibgeCode: string | null, year?: string | number) {
  return useQuery({
    ...overviewQuery(ibgeCode ?? '', year),
    enabled: Boolean(ibgeCode),
  });
}

/**
 * Prefetch do overview quando o cursor **repousa** sobre um território.
 *
 * O debounce não é refinamento: sem ele, uma varredura do mouse dispara uma
 * requisição por polígono cruzado. Medido sobre um estado com 417 municípios,
 * 40 polígonos atravessados geraram 40 requisições HTTP — um usuário
 * movimentando o cursor casualmente produzia centenas. Esperar o cursor parar
 * reduz a varredura a uma requisição, preservando o clique instantâneo.
 */
export function usePrefetchOverview(delayMs = 180) {
  const queryClient = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return useCallback(
    (ibgeCode: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void queryClient.prefetchQuery(overviewQuery(ibgeCode));
      }, delayMs);
    },
    [queryClient, delayMs],
  );
}

/**
 * Lista de territórios de um nível.
 *
 * Usada para traduzir o `parentCode` de uma visualização salva ("35") no nome
 * que aparece na interface ("São Paulo"). São 27 linhas e ~2 KB, buscados uma
 * vez e reaproveitados: barato o bastante para não valer denormalizar o nome
 * dentro da visualização salva, onde ele poderia envelhecer.
 *
 * `enabled` segue o mesmo padrão de `useMapLayer`: quem não tem nenhuma
 * visualização municipal salva não paga a requisição.
 */
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
  useSavedViews,
  useCreateSavedView,
  useUpdateSavedView,
  useDeleteSavedView,
} from '@/features/views/useSavedViews';
export {
  useFollowedMunicipalities,
  useFollowMunicipality,
  useUnfollowMunicipality,
} from '@/features/follow/useFollowedMunicipalities';
export type { FollowTarget } from '@/features/follow/useFollowedMunicipalities';

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
