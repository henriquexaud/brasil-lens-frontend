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
import {
  hashKey,
  type QueryClient,
  type QueryKey,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { scheduleIdle } from '@/lib/idle';

import { apiDelete, apiGet, apiPost, apiPut } from './client';
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
  SavedView,
  SavedViewInput,
  SavedViewListResponse,
  TerritoryLevel,
  TerritoryListResponse,
  TerritoryOverview,
  WeatherAlertCollection,
  WeatherCity,
  WeatherCurrentResponse,
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
    [
      'fire-hotspots',
      query.level,
      query.parent ?? null,
      query.hours ?? FIRE_HOTSPOT_HOURS,
    ] as const,
  overview: (ibgeCode: string, year?: string | number) =>
    ['overview', ibgeCode, year ?? 'latest'] as const,
  territories: (level: TerritoryLevel) => ['territories', level] as const,
  savedViews: () => ['saved-views'] as const,
  weatherAlerts: () => ['weather', 'alerts'] as const,
};

/* ------------------------------------------------------------ auxiliares --
 *
 * Três disciplinas se repetem nas camadas carregadas em segundo plano: cancelar
 * a requisição quando a camada sai de cena, completar páginas só na ociosidade
 * do navegador e reaproveitar a leitura de um lote no cache de cada cidade.
 */

/**
 * Cancela a requisição em voo quando a consulta é desligada ou deixa a tela.
 *
 * A chave entra nas dependências pelo hash: um array novo a cada render não
 * pode reexecutar o efeito — e cancelar — sem que a chave tenha mudado. O
 * `JSON.parse` reconstrói uma chave com o mesmo hash, que é o que o filtro
 * `exact` compara.
 */
function useCancelWhenDisabled(queryKey: QueryKey, enabled: boolean) {
  const client = useQueryClient();
  const hash = hashKey(queryKey);
  useEffect(() => {
    const filters = { queryKey: JSON.parse(hash) as QueryKey, exact: true };
    if (!enabled) void client.cancelQueries(filters);
    return () => {
      void client.cancelQueries(filters);
    };
  }, [client, enabled, hash]);
}

interface PagedQueryState {
  hasNextPage: boolean;
  isFetching: boolean;
  isError: boolean;
  fetchNextPage: () => Promise<unknown>;
}

/** Completa as páginas seguintes na ociosidade, uma por vez, enquanto `active`. */
function useIdleNextPage(
  { hasNextPage, isFetching, isError, fetchNextPage }: PagedQueryState,
  active: boolean,
  pageCount: number,
  delay: number,
) {
  useEffect(() => {
    if (!active || !hasNextPage || isFetching || isError) return;
    return scheduleIdle(() => {
      void fetchNextPage();
    }, delay);
  }, [active, hasNextPage, isFetching, isError, fetchNextPage, pageCount, delay]);
}

/**
 * Aquece o cache individual de cada cidade com a leitura do lote: a seleção
 * aparece sem nova ida à rede. Nunca sobrescreve uma leitura mais recente.
 */
function seedCityWeather(
  client: QueryClient,
  response: WeatherCurrentResponse,
  cities: WeatherCity[] = response.cities,
) {
  const updatedAt = Date.parse(response.fetchedAt);
  for (const city of cities) {
    const key = weatherCurrentOptions(city.id).queryKey;
    if ((client.getQueryState(key)?.dataUpdatedAt ?? 0) >= updatedAt) continue;
    client.setQueryData(key, { ...response, cities: [city], nextOffset: null }, { updatedAt });
  }
}

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

export function useFireSummary(query: FireHotspotQuery, at: string | undefined, enabled: boolean) {
  const queryKey = [...queryKeys.fireHotspots(query), 'summary', at];
  useCancelWhenDisabled(queryKey, enabled);
  return useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      apiGet<FireSummary>(
        '/fire-hotspots/summary',
        {
          level: query.level,
          parent: query.parent,
          hours: query.hours ?? FIRE_HOTSPOT_HOURS,
          at,
        },
        signal,
      ),
    enabled: enabled && Boolean(at),
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
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
 * — um alerta pode ser atualizado pelo scheduler do backend a qualquer
 * momento (ver `app/jobs/weather_scheduler.py`) e as condições atuais vêm da
 * Open-Meteo. `staleTime` estático faria a tela nunca perceber isso;
 * `refetchInterval` é o desvio deliberado do padrão "dado só muda na
 * ingestão" que o resto deste arquivo documenta. `enabled` mantém o polling
 * fora do ar enquanto o contexto Clima não está em tela — a mesma disciplina
 * de `useMapLayer` para não pagar rede à toa.
 */
const WEATHER_POLL_INTERVAL_MS = 90 * 1000;
/** Municípios por lote de condições atuais (o backend aceita até 60). */
const COVERAGE_STAGE_LIMIT = 16;

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

/** Capital e cobertura regional primeiro; depois completa o estado durante a ociosidade. */
export function useMunicipalityWeather(parent: string | null, enabled: boolean, pause: boolean) {
  const client = useQueryClient();
  const queryKey = ['weather', 'municipalities', parent, COVERAGE_STAGE_LIMIT];
  useCancelWhenDisabled(queryKey, enabled);
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ signal, pageParam }) =>
      apiGet<WeatherCurrentResponse>(
        '/weather/municipalities',
        { parent, offset: pageParam, limit: COVERAGE_STAGE_LIMIT },
        signal,
      ),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    enabled: enabled && Boolean(parent) && !pause,
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    for (const page of query.data?.pages ?? []) seedCityWeather(client, page);
  }, [client, query.data]);
  const pageCount = query.data?.pages.length ?? 0;
  useIdleNextPage(query, enabled && !pause && Boolean(parent), pageCount, 350);

  return {
    ...query,
    isCoverageComplete: !query.hasNextPage && pageCount > 0,
  };
}

/**
 * O estado inteiro em uma requisição: uma amostra medida e os demais
 * municípios interpolados no servidor. Só as leituras medidas aquecem o cache
 * de cada cidade — uma estimativa não pode se passar pela condição atual do
 * município quando ele for selecionado.
 */
export function useUserStateWeather(parent: string | null, enabled: boolean) {
  const client = useQueryClient();
  const queryKey = ['weather', 'state', parent];
  useCancelWhenDisabled(queryKey, enabled);
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => apiGet<WeatherCurrentResponse>('/weather/state', { parent }, signal),
    enabled: enabled && Boolean(parent),
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!query.data) return;
    seedCityWeather(
      client,
      query.data,
      query.data.cities.filter((city) => !city.isInferred),
    );
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

export function useWeatherAlerts(enabled = true) {
  return useQuery({
    queryKey: queryKeys.weatherAlerts(),
    queryFn: ({ signal }) => apiGet<WeatherAlertCollection>('/weather/alerts', undefined, signal),
    enabled,
    // Religar a camada ou trocar de recorte não refaz a consulta antes do
    // próximo ciclo de atualização.
    staleTime: WEATHER_POLL_INTERVAL_MS,
    refetchInterval: WEATHER_POLL_INTERVAL_MS,
    placeholderData: (previous) => previous,
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
  const queryKey = ['municipal-boundaries', parent, bbox ?? null];
  useCancelWhenDisabled(queryKey, enabled);
  const query = useInfiniteQuery({
    queryKey,
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
    // Mantém apenas contornos oficiais do mesmo estado durante um deslocamento.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === parent ? previous : undefined,
  });
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
  const pageCount = query.data?.pages.length ?? 0;
  useIdleNextPage(query, enabled && !pause && !query.isPlaceholderData, pageCount, 80);
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
  const queryKey = ['weather', 'capitals-progressive'];
  useCancelWhenDisabled(queryKey, enabled);
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ signal, pageParam }) =>
      apiGet<WeatherCurrentResponse>('/weather/capitals', { offset: pageParam, limit: 6 }, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    enabled: enabled && !pause,
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    refetchInterval: enabled ? 5 * 60 * 1000 : false,
    refetchOnWindowFocus: false,
  });
  const pageCount = query.data?.pages.length ?? 0;
  useIdleNextPage(query, enabled && !pause, pageCount, 250);
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
  parent: string | null | undefined,
  enabled: boolean,
  pause: boolean,
) {
  const client = useQueryClient();
  const queryKey = ['weather', 'viewport', parent ?? 'all', bbox];
  useCancelWhenDisabled(queryKey, enabled);
  const query = useInfiniteQuery({
    queryKey,
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
    refetchOnWindowFocus: false,
  });
  useIdleNextPage(query, enabled && !pause, query.data?.pages.length ?? 0, 200);
  useEffect(() => {
    for (const page of query.data?.pages ?? []) seedCityWeather(client, page);
  }, [client, query.data]);
  return query;
}
