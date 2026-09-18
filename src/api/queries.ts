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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import { apiDelete, apiGet, apiPost, apiPut } from './client';
import type {
  IndicatorListResponse,
  MapFeatureCollection,
  MapQuery,
  SavedView,
  SavedViewInput,
  SavedViewListResponse,
  TerritoryLevel,
  TerritoryListResponse,
  TerritoryOverview,
} from './types';

/** Dados mudam só quando a ingestão roda: cache longo é correto, não preguiça. */
const STATIC_DATA_STALE_TIME = 5 * 60 * 1000;

export const queryKeys = {
  indicators: (level?: TerritoryLevel) => ['indicators', level ?? 'all'] as const,
  map: (query: MapQuery) =>
    [
      'map',
      query.level,
      query.parent ?? null,
      query.indicator ?? null,
      query.year ?? 'latest',
    ] as const,
  overview: (ibgeCode: string) => ['overview', ibgeCode] as const,
  territories: (level: TerritoryLevel) => ['territories', level] as const,
  savedViews: () => ['saved-views'] as const,
};

export function useIndicators(level?: TerritoryLevel) {
  return useQuery({
    queryKey: queryKeys.indicators(level),
    queryFn: ({ signal }) => apiGet<IndicatorListResponse>('/indicators', { level }, signal),
    staleTime: STATIC_DATA_STALE_TIME,
    // O catálogo do nível anterior serve de ponte enquanto o novo carrega:
    // sem isso o painel de controles desaparecia e voltava a cada drill-down.
    // `isPlaceholderData` permite ao chamador saber que a cobertura temporal
    // ainda é a do nível antigo.
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

/** Definição única da consulta de overview, usada pelo hook e pelo prefetch. */
function overviewQuery(ibgeCode: string) {
  return {
    queryKey: queryKeys.overview(ibgeCode),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiGet<TerritoryOverview>(`/territories/${ibgeCode}/overview`, undefined, signal),
    staleTime: STATIC_DATA_STALE_TIME,
  };
}

export function useTerritoryOverview(ibgeCode: string | null) {
  return useQuery({
    ...overviewQuery(ibgeCode ?? ''),
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

export function useSavedViews() {
  return useQuery({
    queryKey: queryKeys.savedViews(),
    queryFn: ({ signal }) => apiGet<SavedViewListResponse>('/views', undefined, signal),
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
