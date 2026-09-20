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
import { useCallback, useEffect, useRef } from 'react';
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
} from './types';

/** Dados mudam só quando a ingestão roda: cache longo é correto, não preguiça. */
const STATIC_DATA_STALE_TIME = 5 * 60 * 1000;

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
    ] as const,
  hydrography: (query: HydroQuery) =>
    ['hydrography', query.level, query.parent ?? null, query.includeWaterBodies ?? true] as const,
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
        },
        signal,
      ),
    enabled,
    staleTime: STATIC_DATA_STALE_TIME,
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
  return useQuery({
    queryKey: queryKeys.hydrography(query),
    queryFn: ({ signal }) =>
      apiGet<HydroFeatureCollection>(
        '/hydrography',
        {
          level: query.level,
          parent: query.parent ?? undefined,
          include_water_bodies: query.includeWaterBodies ?? true,
        },
        signal,
      ),
    enabled,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    placeholderData: (previous) => previous,
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
export const MAX_COVERAGE_STAGES = 2;

/**
 * Carrega a cobertura inicial do estado em etapas discretas (máx. 2 etapas).
 * Após cobrir a área representativa, pausa o carregamento contínuo para evitar
 * sobrecarga e poluição visual. Municípios adicionais carregam sob demanda
 * quando selecionados pelo usuário.
 */
export function useMunicipalityWeather(
  parent: string | null,
  enabled: boolean,
  pause: boolean,
  stageLimit = COVERAGE_STAGE_LIMIT,
  maxStages = MAX_COVERAGE_STAGES,
) {
  const client = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: ['weather', 'municipalities', parent],
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
    gcTime: 20 * 60 * 1000,
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
    const key = ['weather', 'municipalities', parent];
    if (!enabled) void client.cancelQueries({ queryKey: key, exact: true });
    return () => {
      void client.cancelQueries({ queryKey: key, exact: true });
    };
  }, [client, parent, enabled]);
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
    }, 1200);
  }, [shouldFetchNext, fetchNextPage]);

  const totalCoverageCities =
    data?.pages.reduce((acc, p) => acc + p.cities.length, 0) ?? 0;

  return {
    ...query,
    stage: Math.min(maxStages, Math.max(1, pageCount + (isFetching ? 1 : 0))),
    completedStages: pageCount,
    maxStages,
    isCoverageComplete: reachedMaxStages || (!hasNextPage && pageCount > 0),
    totalCoverageCities,
  };
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
