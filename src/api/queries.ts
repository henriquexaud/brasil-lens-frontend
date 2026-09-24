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
  type InfiniteData,
  type Query,
  type QueryClient,
  type QueryKey,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { scheduleIdle } from '@/lib/idle';
import { useDeferredReady } from '@/lib/useDeferredReady';

import { apiDelete, apiGet, apiPost, apiPut } from './client';
import type {
  ContextListResponse,
  DataContext,
  FireHotspotCollection,
  FireHotspotDetails,
  FireHotspotLocation,
  FireHotspotQuery,
  FireSummary,
  FollowedMunicipality,
  FollowedMunicipalityListResponse,
  HydroFeatureCollection,
  HydroQuery,
  IndicatorListResponse,
  MapFeatureCollection,
  MapQuery,
  MapValuesResponse,
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
  followedMunicipalities: () => ['me', 'followed-municipalities'] as const,
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
      !merged ||
      (Boolean(indicator) && values.isPlaceholderData) ||
      isPendingValues,
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

/* ------------------------------------------------------ municípios seguidos --
 *
 * Ao contrário das visualizações, estas escritas **são otimistas**: seguir é
 * um alternador de um toque, e esperar o servidor para acender o botão faria
 * o clique parecer perdido. O backend continua sendo a fonte de verdade — a
 * falha desfaz a mudança local e, ao final, a lista é relida do servidor.
 *
 * PUT/DELETE são idempotentes no backend, então repetir o pedido (duplo clique,
 * alternar rápido) nunca vira erro. E todas as escritas dividem um `scope`: o
 * cache muda no clique, mas as requisições saem em fila, na ordem dos cliques —
 * um "seguir" seguido de "deixar" nunca chega invertido ao servidor.
 */

const FOLLOW_MUTATION_KEY = ['me', 'followed-municipalities', 'write'] as const;
const FOLLOWED_PATH = '/me/followed-municipalities';

/**
 * Lista do usuário. Pequena e pessoal: carregada uma vez ao entrar no clima e
 * mantida em cache, para que abrir um município já saiba se ele é seguido.
 */
export function useFollowedMunicipalities(enabled = true) {
  return useQuery({
    queryKey: queryKeys.followedMunicipalities(),
    queryFn: ({ signal }) =>
      apiGet<FollowedMunicipalityListResponse>(FOLLOWED_PATH, undefined, signal),
    enabled,
    staleTime: 60 * 1000,
  });
}

type FollowListSnapshot = { previous: FollowedMunicipalityListResponse | undefined };

/**
 * Ciclo otimista comum a seguir e deixar de seguir: aplica `update` no cache,
 * desfaz em caso de erro e relê a lista quando a *última* escrita em curso
 * termina — reler no meio de uma sequência rápida traria de volta um estado
 * intermediário e faria o botão piscar.
 */
function useOptimisticFollowMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
  update: (list: FollowedMunicipality[], variables: TVariables) => FollowedMunicipality[],
) {
  const queryClient = useQueryClient();
  const key = queryKeys.followedMunicipalities();
  return useMutation<unknown, Error, TVariables, FollowListSnapshot>({
    mutationKey: FOLLOW_MUTATION_KEY,
    scope: { id: FOLLOW_MUTATION_KEY.join('/') },
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<FollowedMunicipalityListResponse>(key);
      queryClient.setQueryData<FollowedMunicipalityListResponse>(key, {
        municipalities: update(previous?.municipalities ?? [], variables),
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: FOLLOW_MUTATION_KEY }) === 1) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

/** O que a interface já sabe do município — só para a linha otimista. */
export type FollowTarget = Omit<FollowedMunicipality, 'followedAt'>;

export function useFollowMunicipality() {
  return useOptimisticFollowMutation(
    (target: FollowTarget) =>
      apiPut<FollowedMunicipality>(`${FOLLOWED_PATH}/${target.municipalityCode}`, undefined),
    (list, target) =>
      list.some((item) => item.municipalityCode === target.municipalityCode)
        ? list
        : [{ ...target, followedAt: new Date().toISOString() }, ...list],
  );
}

export function useUnfollowMunicipality() {
  return useOptimisticFollowMutation(
    (code: string) => apiDelete(`${FOLLOWED_PATH}/${code}`),
    (list, code) => list.filter((item) => item.municipalityCode !== code),
  );
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

/*
 * As condições atuais da Open-Meteo mudam a cada 15 minutos, e o backend
 * guarda cada leitura por esse tempo (a cidade selecionada) ou 30 minutos (as
 * camadas do mapa). Consultar antes disso só traria a mesma resposta: a
 * validade e a próxima atualização saem do horário da própria leitura.
 */
const SELECTED_FRESHNESS_MS = 15 * 60 * 1000;
const MAP_FRESHNESS_MS = 30 * 60 * 1000;
/** Espera mínima entre consultas, igual à do backend depois de cada leitura. */
const MIN_REFRESH_MS = 2 * 60 * 1000;

type WeatherData = WeatherCurrentResponse | InfiniteData<WeatherCurrentResponse>;

/** Quando a leitura mais antiga da resposta deixa de valer (epoch ms). */
function readingExpiry(data: WeatherData | undefined, freshness: number): number {
  const responses = data && 'pages' in data ? data.pages : data ? [data] : [];
  let expiry = Infinity;
  for (const response of responses) {
    const fetchedAt = Date.parse(response.fetchedAt);
    for (const city of response.cities) {
      expiry = Math.min(
        expiry,
        Math.max(Date.parse(city.observedAt) + freshness, fetchedAt + MIN_REFRESH_MS),
      );
    }
  }
  return Number.isFinite(expiry) ? expiry : Date.now() + freshness;
}

/** `staleTime` conta a partir de quando o dado chegou, não de agora. */
function staleUntilExpiry(freshness: number) {
  return (query: Query<WeatherCurrentResponse, Error, WeatherCurrentResponse, QueryKey>) =>
    Math.max(0, readingExpiry(query.state.data, freshness) - query.state.dataUpdatedAt);
}

/** Próxima atualização: quando a leitura vence, nunca antes de dois minutos. */
function refreshAtExpiry<T extends WeatherData>(freshness: number) {
  return (query: { state: { data: T | undefined } }) =>
    Math.max(MIN_REFRESH_MS, readingExpiry(query.state.data, freshness) - Date.now());
}

export function weatherCurrentOptions(territory: string | null, forecast = false) {
  return {
    queryKey: ['weather', forecast ? 'forecast' : 'current', territory ?? 'capitals'],
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiGet<WeatherCurrentResponse>('/weather/current', { territory, forecast }, signal),
    staleTime: staleUntilExpiry(SELECTED_FRESHNESS_MS),
    gcTime: 20 * 60 * 1000,
  };
}

export function useWeatherCurrent(territory: string | null, enabled = true, forecast = false) {
  return useQuery({
    ...weatherCurrentOptions(territory, forecast),
    enabled,
    refetchInterval: enabled ? refreshAtExpiry(SELECTED_FRESHNESS_MS) : false,
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
    staleTime: (query) =>
      Math.max(0, readingExpiry(query.state.data, MAP_FRESHNESS_MS) - query.state.dataUpdatedAt),
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
    staleTime: staleUntilExpiry(MAP_FRESHNESS_MS),
    gcTime: 60 * 60 * 1000,
    refetchInterval: enabled ? refreshAtExpiry(MAP_FRESHNESS_MS) : false,
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

const CAPITALS_KEY = ['weather', 'capitals'];
const STATES_KEY = ['weather', 'states'];

/**
 * Visão nacional em duas etapas, as duas servindo temperatura e chuva — trocar
 * de camada não consulta nada. Primeiro as 27 capitais numa consulta: o mapa já
 * pinta cada estado pela sua capital. Depois, na ociosidade, `/weather/states`:
 * cada UF como a média de pontos espalhados pelo território, ponderada pela
 * área de cada um. A média reaproveita no servidor as capitais já lidas e, em
 * cache, dispensa a primeira etapa. As capitais seguem expostas à parte: a
 * seleção de uma UF mostra a sua capital, não a média.
 */
export function useNationalWeather(enabled: boolean, pause: boolean) {
  const client = useQueryClient();
  useCancelWhenDisabled(CAPITALS_KEY, enabled);
  useCancelWhenDisabled(STATES_KEY, enabled);
  // Lido no render: a consulta da média, logo abaixo, redesenha quando ela chega.
  const averaged = client.getQueryData<WeatherCurrentResponse>(STATES_KEY) !== undefined;
  const capitals = useQuery({
    queryKey: CAPITALS_KEY,
    queryFn: ({ signal }) =>
      apiGet<WeatherCurrentResponse>('/weather/current', { forecast: false }, signal),
    enabled: enabled && !pause && !averaged,
    staleTime: staleUntilExpiry(MAP_FRESHNESS_MS),
    gcTime: 20 * 60 * 1000,
    refetchInterval: enabled && !averaged ? refreshAtExpiry(MAP_FRESHNESS_MS) : false,
    refetchOnWindowFocus: false,
  });
  const refine = useDeferredReady(
    'weather:states',
    enabled && (averaged || capitals.data !== undefined || capitals.isError),
  );
  const states = useQuery({
    queryKey: STATES_KEY,
    queryFn: ({ signal }) => apiGet<WeatherCurrentResponse>('/weather/states', undefined, signal),
    enabled: refine && !pause,
    staleTime: staleUntilExpiry(MAP_FRESHNESS_MS),
    gcTime: 20 * 60 * 1000,
    refetchInterval: enabled ? refreshAtExpiry(MAP_FRESHNESS_MS) : false,
    refetchOnWindowFocus: false,
  });
  const data = states.data ?? capitals.data;
  return {
    data,
    capitals: capitals.data,
    /** Os estados já são médias, não mais as capitais. */
    averaged: states.data !== undefined,
    error: states.data ? states.error : (states.error ?? capitals.error),
    isError: !data && (states.isError || capitals.isError),
    isFetching: capitals.isFetching || states.isFetching,
    /** A segunda etapa ainda vai chegar. */
    isRefining: enabled && !pause && !states.data && !states.isError,
  };
}

/**
 * Grade da medição no zoom próximo, a mesma do backend: uma leitura por célula
 * de 0,5° no zoom 8, de 0,25° no 9 e por município a partir do 10.
 */
function weatherGridStep(zoom: number): number {
  return zoom <= 8 ? 0.5 : zoom === 9 ? 0.25 : 0.1;
}

/** Arredonda a área para fora, na grade: arrastar dentro dela reaproveita a consulta. */
export function snapBbox(bbox: string, step: number): string {
  const [west = 0, south = 0, east = 0, north = 0] = bbox.split(',').map(Number);
  const floor = (value: number) => Math.floor(value / step) * step;
  const ceil = (value: number) => Math.ceil(value / step) * step;
  return [floor(west), floor(south), ceil(east), ceil(north)]
    .map((value) => value.toFixed(2))
    .join(',');
}

/**
 * Condições da área visível, restritas ao estado se informado: o backend mede
 * uma cidade por célula (todas, de perto) e estima as vizinhas. Só as leituras
 * medidas aquecem o cache de cada cidade.
 */
export function useViewportWeather(
  bbox: string | undefined,
  parent: string | null | undefined,
  zoom: number,
  enabled: boolean,
  pause: boolean,
) {
  const client = useQueryClient();
  // Acima do 10 a medição já é por município: a mesma consulta serve.
  const scale = Math.min(Math.floor(zoom), 10);
  const area = bbox ? snapBbox(bbox, weatherGridStep(scale)) : undefined;
  const queryKey = ['weather', 'viewport', parent ?? 'all', scale, area];
  useCancelWhenDisabled(queryKey, enabled);
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      apiGet<WeatherCurrentResponse>(
        '/weather/viewport',
        { bbox: area, parent: parent ?? undefined, zoom: scale },
        signal,
      ),
    enabled: enabled && Boolean(area) && !pause,
    staleTime: staleUntilExpiry(MAP_FRESHNESS_MS),
    gcTime: 20 * 60 * 1000,
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
