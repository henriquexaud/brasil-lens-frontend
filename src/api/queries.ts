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
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { scheduleIdle } from '@/lib/idle';

import { buildSearchIndex, type SearchableTerritory } from '@/lib/searchIndex';

import { apiDelete, apiGet, apiPost, apiPut } from './client';
import type {
  ContextListResponse,
  DataContext,
  IndicatorListResponse,
  MapFeatureCollection,
  MapQuery,
  SavedView,
  SavedViewInput,
  SavedViewListResponse,
  TerritoryLevel,
  TerritoryListResponse,
  TerritoryOverview,
  TerritorySummary,
  WeatherAlertCollection,
  WeatherCurrentResponse,
  WeatherSourcesResponse,
  WeatherStationCollection,
  HydroFeatureCollection,
  HydroQuery,
  FireHotspotCollection,
  FireSummary,
  FireHotspotQuery,
  FireHotspotDetails,
  FireHotspotLocation,
} from './types';

/** Dados mudam só quando a ingestão roda: cache longo é correto, não preguiça. */
const STATIC_DATA_STALE_TIME = 5 * 60 * 1000;
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
    ['fire-hotspots', query.level, query.parent ?? null, query.hours ?? FIRE_HOTSPOT_HOURS] as const,
  overview: (ibgeCode: string, year?: string | number) =>
    ['overview', ibgeCode, year ?? 'latest'] as const,
  territories: (level: TerritoryLevel) => ['territories', level] as const,
  searchIndex: () => ['search-index'] as const,
  savedViews: () => ['saved-views'] as const,
  weatherStations: () => ['weather', 'stations'] as const,
  weatherAlerts: () => ['weather', 'alerts'] as const,
  weatherSources: () => ['weather', 'sources'] as const,
};

/**
 * Contextos de dados disponíveis (sociopolítico, clima/ambiente,
 * biodiversidade) e os providers registrados em cada um. Metadado do backend,
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

export function useMapLayer(query: MapQuery, enabled = true) {
  return useQuery({
    queryKey: queryKeys.map(query),
    queryFn: ({ signal }) =>
      apiGet<MapFeatureCollection>(
        '/map',
        {
          level: query.level,
          parent: query.parent,
          indicator: query.indicator,
          year: query.year ?? 'latest',
          lod: query.lod,
        },
        signal,
      ),
    enabled,
    staleTime: 30 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    // Mantém a camada anterior visível enquanto a nova carrega, em vez de
    // piscar o mapa em branco a cada troca de indicador.
    placeholderData: (previous) => previous,
  });
}

/**
 * Consulta oficial da malha hidrográfica (ANA / SNIRH).
 * Carrega cursos d'água e massas d'água com resolução e detalhes progressivos.
 */
export function useHydrography(query: HydroQuery, enabled = true) {
  const client = useQueryClient();
  const { level, parent, zoom, bbox, includeWaterBodies, includeRivers } = query;
  useEffect(() => {
    const key = queryKeys.hydrography({
      level,
      parent,
      zoom,
      bbox,
      includeWaterBodies,
      includeRivers,
    });
    if (!enabled) void client.cancelQueries({ queryKey: key, exact: true });
    return () => {
      void client.cancelQueries({ queryKey: key, exact: true });
    };
  }, [client, enabled, level, parent, zoom, bbox, includeWaterBodies, includeRivers]);
  return useQuery({
    queryKey: queryKeys.hydrography(query),
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
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/** A camada só consulta o INPE enquanto ativa; detalhes não entram no carregamento inicial. */
export function useFireHotspots(query: FireHotspotQuery, enabled = true) {
  const client = useQueryClient();
  const { level, parent, hours } = query;
  useEffect(() => {
    const key = queryKeys.fireHotspots({ level, parent, hours });
    if (!enabled) void client.cancelQueries({ queryKey: key, exact: true });
    return () => {
      void client.cancelQueries({ queryKey: key, exact: true });
    };
  }, [client, enabled, level, parent, hours]);
  return useQuery({
    queryKey: queryKeys.fireHotspots(query),
    queryFn: ({ signal }) =>
      apiGet<FireHotspotCollection>(
        '/fire-hotspots',
        {
          level,
          parent,
          hours: hours ?? FIRE_HOTSPOT_HOURS,
        },
        signal,
      ),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchInterval: enabled ? 10 * 60 * 1000 : false,
    refetchOnWindowFocus: true,
    retry: 1,
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
    retry: 1,
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

/** Maior página que a API aceita por requisição (`Query(ge=1, le=1000)`). */
const SEARCH_PAGE_SIZE = 1000;

function toSearchable(row: TerritorySummary): SearchableTerritory {
  return {
    ibgeCode: row.ibgeCode,
    name: row.name,
    level: row.level,
    abbreviation: row.abbreviation,
    parentCode: row.parent?.ibgeCode ?? null,
    parentName: row.parent?.name ?? null,
  };
}

/**
 * Todos os municípios, paginados — são ~5.600, e a API limita a 1000 por
 * página. As páginas seguintes (offset conhecido de antemão pelo `total` da
 * primeira) saem em paralelo: é uma tela cheia de nomes, não uma corrente de
 * dependências.
 */
async function fetchAllMunicipalities(signal?: AbortSignal): Promise<TerritorySummary[]> {
  const first = await apiGet<TerritoryListResponse>(
    '/territories',
    { level: 'municipality', limit: SEARCH_PAGE_SIZE, offset: 0 },
    signal,
  );
  const remaining: Promise<TerritoryListResponse>[] = [];
  for (let offset = SEARCH_PAGE_SIZE; offset < first.pagination.total; offset += SEARCH_PAGE_SIZE) {
    remaining.push(
      apiGet<TerritoryListResponse>(
        '/territories',
        { level: 'municipality', limit: SEARCH_PAGE_SIZE, offset },
        signal,
      ),
    );
  }
  const rest = await Promise.all(remaining);
  return [first, ...rest].flatMap((page) => page.territories);
}

/**
 * Índice de busca: todo estado e todo município, uma vez só.
 *
 * A busca por nome que a API já tem (`/territories?search=`) é um `ILIKE` que
 * não ignora acento — "sao paulo" não encontra "São Paulo" (ver
 * `@/lib/searchIndex`). Resolver isso no cliente, contra o catálogo inteiro,
 * evita mexer no banco por um problema de comparação de texto: 27 estados e
 * ~5.600 municípios cabem tranquilos em memória e a busca fica instantânea, a
 * cada tecla, sem round-trip.
 *
 * `staleTime` bem mais longo que o das outras projeções: isso muda apenas
 * quando o IBGE cria ou funde um município, evento raro o bastante para não
 * merecer refetch dentro da mesma sessão.
 */
export function useSearchIndex(enabled = true) {
  return useQuery({
    queryKey: queryKeys.searchIndex(),
    enabled,
    queryFn: async ({ signal }) => {
      const [statesRes, municipalities] = await Promise.all([
        apiGet<TerritoryListResponse>('/territories', { level: 'state', limit: 1000 }, signal),
        fetchAllMunicipalities(signal),
      ]);
      const rows = [...statesRes.territories, ...municipalities];
      return buildSearchIndex(rows.map(toSearchable));
    },
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Busca remota de territórios delegada ao backend.
 * O backend realiza a filtragem insensível a acentos e a ordenação por relevância.
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

/* --------------------------------------------------------- visualizações --
 *
 * As quatro operações do CRUD de visualizações salvas, os únicos pontos em que
 * o frontend escreve no backend. Diferente das projeções de leitura, estas não
 * têm `staleTime`: a lista muda a cada escrita do próprio usuário.
 *
 * Nenhuma escrita é otimista. As três mutações terminam do mesmo jeito —
 * invalidando a lista — porque o que a interface deve mostrar depois de gravar
 * é o que o banco aceitou, não o que o formulário propôs.
 */

export function useSavedViews(enabled = true) {
  return useQuery({
    queryKey: queryKeys.savedViews(),
    queryFn: ({ signal }) => apiGet<SavedViewListResponse>('/views', undefined, signal),
    enabled,
  });
}

/** `onSuccess` comum às três mutações: relê a lista a partir do servidor. */
function useRefreshSavedViews() {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.savedViews() }),
    [queryClient],
  );
}

export function useCreateSavedView() {
  const refresh = useRefreshSavedViews();
  return useMutation({
    mutationFn: (input: SavedViewInput) => apiPost<SavedView>('/views', input),
    onSuccess: refresh,
  });
}

export function useUpdateSavedView() {
  const refresh = useRefreshSavedViews();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SavedViewInput }) =>
      apiPut<SavedView>(`/views/${id}`, input),
    onSuccess: refresh,
  });
}

export function useDeleteSavedView() {
  const refresh = useRefreshSavedViews();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/views/${id}`),
    onSuccess: refresh,
  });
}

/* ------------------------------------------------------------------ clima --
 *
 * Diferente de tudo acima: o dado muda sozinho, sem nenhuma ação do usuário
 * — uma estação ou um alerta pode ser atualizado pelo scheduler do backend a
 * qualquer momento (ver `app/jobs/weather_scheduler.py`). `staleTime` estático
 * faria a tela nunca perceber isso; `refetchInterval` é o desvio deliberado
 * do padrão "dado só muda na ingestão" que o resto deste arquivo documenta.
 * `enabled` mantém o polling fora do ar enquanto o contexto Clima não está
 * em tela — a mesma disciplina de `useMapLayer` para não pagar rede à toa.
 */
const WEATHER_POLL_INTERVAL_MS = 90 * 1000;

export function weatherCurrentOptions(territory: string | null, forecast = false) {
  return {
    queryKey: ['weather', forecast ? 'forecast' : 'current', territory ?? 'capitals'],
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiGet<WeatherCurrentResponse>('/weather/current', { territory, forecast }, signal),
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
  };
}

export function useWeatherCurrent(territory: string | null, enabled = true, forecast = false) {
  return useQuery({
    ...weatherCurrentOptions(territory, forecast),
    enabled,
    refetchInterval: enabled ? 5 * 60 * 1000 : false,
    refetchOnWindowFocus: true,
  });
}

export const COVERAGE_STAGE_LIMIT = 16;
export const MAX_COVERAGE_STAGES = Infinity;

/** Capital e cobertura regional primeiro; depois completa o estado durante a ociosidade. */
export function useMunicipalityWeather(
  parent: string | null,
  enabled: boolean,
  pause: boolean,
  stageLimit = COVERAGE_STAGE_LIMIT,
  maxStages = MAX_COVERAGE_STAGES,
) {
  const client = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: ['weather', 'municipalities', parent, stageLimit],
    queryFn: ({ signal, pageParam }) =>
      apiGet<WeatherCurrentResponse>(
        '/weather/municipalities',
        { parent, offset: pageParam, limit: stageLimit },
        signal,
      ),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    enabled: enabled && Boolean(parent) && !pause,
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  useEffect(() => {
    for (const page of query.data?.pages ?? []) {
      const updatedAt = Date.parse(page.fetchedAt);
      for (const city of page.cities) {
        const key = weatherCurrentOptions(city.id).queryKey;
        if ((client.getQueryState(key)?.dataUpdatedAt ?? 0) >= updatedAt) continue;
        client.setQueryData(key, { ...page, cities: [city], nextOffset: null }, { updatedAt });
      }
    }
  }, [client, query.data]);
  useEffect(() => {
    const key = ['weather', 'municipalities', parent, stageLimit];
    if (!enabled) void client.cancelQueries({ queryKey: key, exact: true });
    return () => {
      void client.cancelQueries({ queryKey: key, exact: true });
    };
  }, [client, parent, enabled, stageLimit]);
  const { fetchNextPage, hasNextPage, isFetching, isError, data } = query;
  const pageCount = data?.pages.length ?? 0;
  const reachedMaxStages = pageCount >= maxStages;
  const shouldFetchNext =
    enabled &&
    !pause &&
    Boolean(parent) &&
    hasNextPage &&
    !isFetching &&
    !isError &&
    !reachedMaxStages;

  useEffect(() => {
    if (!shouldFetchNext) return;
    return scheduleIdle(() => {
      void fetchNextPage();
    }, 350);
  }, [shouldFetchNext, fetchNextPage, pageCount]);

  const totalCoverageCities = data?.pages.reduce((acc, p) => acc + p.cities.length, 0) ?? 0;

  return {
    ...query,
    stage: Math.min(maxStages, Math.max(1, pageCount + (isFetching ? 1 : 0))),
    completedStages: pageCount,
    maxStages,
    isCoverageComplete: reachedMaxStages || (!hasNextPage && pageCount > 0),
    totalCoverageCities,
  };
}

export function useUserStateWeather(parent: string | null, enabled: boolean) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['weather', 'state', parent],
    queryFn: ({ signal }) =>
      apiGet<WeatherCurrentResponse>('/weather/state', { parent }, signal),
    enabled: enabled && Boolean(parent),
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  useEffect(() => {
    if (!query.data) return;
    const updatedAt = Date.parse(query.data.fetchedAt);
    for (const city of query.data.cities) {
      const key = weatherCurrentOptions(city.id).queryKey;
      if ((client.getQueryState(key)?.dataUpdatedAt ?? 0) >= updatedAt) continue;
      client.setQueryData(key, { ...query.data, cities: [city], nextOffset: null }, { updatedAt });
    }
  }, [client, query.data]);

  return query;
}

export function usePrefetchWeatherCurrent() {
  const client = useQueryClient();
  const cancel = useRef<(() => void) | undefined>();
  useEffect(() => () => cancel.current?.(), []);
  return useCallback(
    (code: string) => {
      cancel.current?.();
      cancel.current = scheduleIdle(() => {
        void client.prefetchQuery(weatherCurrentOptions(code));
      });
    },
    [client],
  );
}

export function useWeatherStations(enabled = true) {
  return useQuery({
    queryKey: queryKeys.weatherStations(),
    queryFn: ({ signal }) =>
      apiGet<WeatherStationCollection>('/weather/stations', undefined, signal),
    enabled,
    refetchInterval: WEATHER_POLL_INTERVAL_MS,
    placeholderData: (previous) => previous,
  });
}

export function useWeatherAlerts(enabled = true) {
  return useQuery({
    queryKey: queryKeys.weatherAlerts(),
    queryFn: ({ signal }) => apiGet<WeatherAlertCollection>('/weather/alerts', undefined, signal),
    enabled,
    refetchInterval: WEATHER_POLL_INTERVAL_MS,
    placeholderData: (previous) => previous,
  });
}

export function useWeatherSources(enabled = true) {
  return useQuery({
    queryKey: queryKeys.weatherSources(),
    queryFn: ({ signal }) => apiGet<WeatherSourcesResponse>('/weather/sources', undefined, signal),
    enabled,
    refetchInterval: WEATHER_POLL_INTERVAL_MS,
    placeholderData: (previous) => previous,
  });
}

export function useFireSummary(query: FireHotspotQuery, at: string | undefined, enabled: boolean) {
  const client = useQueryClient();
  const { level, parent, hours } = query;
  useEffect(() => {
    const key = [...queryKeys.fireHotspots({ level, parent, hours }), 'summary', at];
    if (!enabled) void client.cancelQueries({ queryKey: key, exact: true });
    return () => {
      void client.cancelQueries({ queryKey: key, exact: true });
    };
  }, [client, level, parent, hours, at, enabled]);
  return useQuery({
    queryKey: [...queryKeys.fireHotspots(query), 'summary', at],
    queryFn: ({ signal }) =>
      apiGet<FireSummary>(
        '/fire-hotspots/summary',
        {
          level,
          parent,
          hours: hours ?? FIRE_HOTSPOT_HOURS,
          at,
        },
        signal,
      ),
    enabled: enabled && Boolean(at),
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}

/** Páginas oficiais adicionadas sem esperar a malha inteira do estado. */
export function useVisibleMunicipalities(
  bbox: string | undefined,
  enabled: boolean,
  parent: string | null = null,
  pause = false,
) {
  const client = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: ['municipal-boundaries', parent, bbox ?? null],
    queryFn: ({ signal, pageParam }) =>
      apiGet<MapFeatureCollection>(
        '/weather/municipal-boundaries',
        // O bbox reduz a área, mas o pai continua obrigatório: sem ele, uma
        // janela que atravessa a divisa traz municípios de outras UFs.
        { bbox, parent, offset: pageParam, limit: 24 },
        signal,
      ),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    enabled: enabled && Boolean(bbox || parent) && !pause,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    // Mantém apenas contornos oficiais do mesmo estado durante um deslocamento.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === parent ? previous : undefined,
  });
  useEffect(() => {
    const key = ['municipal-boundaries', parent, bbox ?? null];
    if (!enabled) void client.cancelQueries({ queryKey: key, exact: true });
    return () => {
      void client.cancelQueries({ queryKey: key, exact: true });
    };
  }, [client, enabled, parent, bbox]);
  useEffect(() => {
    if (query.isPlaceholderData) return;
    for (const page of query.data?.pages ?? []) {
      for (const feature of page.features) {
        const key = ['municipal-boundary', feature.id];
        if ((client.getQueryState(key)?.dataUpdatedAt ?? 0) >= query.dataUpdatedAt) continue;
        client.setQueryData(
          key,
          {
            ...page,
            features: [feature],
            scope: { ...page.scope, count: 1 },
            nextOffset: null,
          },
          { updatedAt: query.dataUpdatedAt },
        );
      }
    }
  }, [client, query.data, query.dataUpdatedAt, query.isPlaceholderData]);
  const { fetchNextPage, hasNextPage, isFetching, isError, isPlaceholderData } = query;
  const pageCount = query.data?.pages.length ?? 0;
  useEffect(() => {
    if (!enabled || pause || !hasNextPage || isFetching || isError || isPlaceholderData) return;
    return scheduleIdle(() => {
      void fetchNextPage();
    }, 80);
  }, [
    enabled,
    pause,
    hasNextPage,
    isFetching,
    isError,
    isPlaceholderData,
    fetchNextPage,
    pageCount,
  ]);
  const data = useMemo(() => {
    const first = query.data?.pages[0];
    if (!first) return undefined;
    const features = query.data!.pages.flatMap((page) => page.features);
    return {
      ...first,
      scope: { ...first.scope, parent, count: features.length },
      features,
      nextOffset: query.data!.pages.at(-1)?.nextOffset,
    };
  }, [query.data, parent]);
  return { ...query, data };
}

/** A busca/seleção não espera a fila de municípios chegar até ela. */
export function useSelectedBoundary(code: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['municipal-boundary', code],
    queryFn: ({ signal }) =>
      apiGet<MapFeatureCollection>('/weather/municipal-boundaries', { code, limit: 1 }, signal),
    enabled: enabled && code?.length === 7,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** Mostra as primeiras capitais e completa a visão nacional em segundo plano. */
export function useCapitalsWeather(enabled: boolean, pause: boolean) {
  const query = useInfiniteQuery({
    queryKey: ['weather', 'capitals-progressive'],
    queryFn: ({ signal, pageParam }) =>
      apiGet<WeatherCurrentResponse>('/weather/capitals', { offset: pageParam, limit: 6 }, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    enabled: enabled && !pause,
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    refetchInterval: enabled ? 5 * 60 * 1000 : false,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const client = useQueryClient();
  useEffect(() => {
    const key = ['weather', 'capitals-progressive'];
    if (!enabled) void client.cancelQueries({ queryKey: key, exact: true });
    return () => {
      void client.cancelQueries({ queryKey: key, exact: true });
    };
  }, [client, enabled]);
  const { fetchNextPage, hasNextPage, isFetching, isError } = query;
  const pageCount = query.data?.pages.length ?? 0;
  useEffect(() => {
    if (!enabled || pause || !hasNextPage || isFetching || isError) return;
    return scheduleIdle(() => {
      void fetchNextPage();
    }, 250);
  }, [enabled, pause, hasNextPage, isFetching, isError, fetchNextPage, pageCount]);
  const data = useMemo(() => {
    const first = query.data?.pages[0];
    if (!first) return undefined;
    return {
      ...first,
      cities: query.data!.pages.flatMap((page) => page.cities),
      status: query.data!.pages.some((page) => page.status === 'stale')
        ? ('stale' as const)
        : first.status,
    };
  }, [query.data]);
  return { ...query, data };
}

/** Condições atuais de todos os municípios visíveis, começando pelo centro do mapa, restritas ao estado se informado. */
export function useViewportWeather(
  bbox: string | undefined,
  parentOrEnabled: string | null | boolean = null,
  enabledOrPause: boolean = true,
  maybePause = false,
) {
  const isLegacySignature = typeof parentOrEnabled === 'boolean';
  const parent = isLegacySignature ? null : parentOrEnabled;
  const enabled = isLegacySignature ? parentOrEnabled : enabledOrPause;
  const pause = isLegacySignature ? enabledOrPause : maybePause;

  const client = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: ['weather', 'viewport', parent ?? 'all', bbox],
    queryFn: ({ signal, pageParam }) =>
      apiGet<WeatherCurrentResponse>(
        '/weather/viewport',
        { bbox, parent: parent ?? undefined, offset: pageParam, limit: 20 },
        signal,
      ),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    enabled: enabled && Boolean(bbox) && !pause,
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    const key = ['weather', 'viewport', parent ?? 'all', bbox];
    if (!enabled) void client.cancelQueries({ queryKey: key, exact: true });
    return () => {
      void client.cancelQueries({ queryKey: key, exact: true });
    };
  }, [client, parent, bbox, enabled]);
  const { data, isFetching, hasNextPage, isError, fetchNextPage } = query;
  useEffect(() => {
    if (!enabled || pause || !hasNextPage || isFetching || isError) return;
    return scheduleIdle(() => {
      void fetchNextPage();
    }, 200);
  }, [enabled, pause, hasNextPage, isFetching, isError, fetchNextPage, data?.pages.length]);
  useEffect(() => {
    for (const page of data?.pages ?? [])
      for (const city of page.cities) {
        const key = weatherCurrentOptions(city.id).queryKey;
        const updatedAt = Date.parse(page.fetchedAt);
        if ((client.getQueryState(key)?.dataUpdatedAt ?? 0) < updatedAt)
          client.setQueryData(key, { ...page, cities: [city], nextOffset: null }, { updatedAt });
      }
  }, [client, data]);
  return query;
}
