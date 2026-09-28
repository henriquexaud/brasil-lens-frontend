import {
  type InfiniteData,
  type Query,
  type QueryClient,
  type QueryKey,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { apiGet } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { useCancelWhenDisabled, useIdleNextPage } from '@/api/queryLifecycle';
import type {
  MapFeatureCollection,
  WeatherAlertCollection,
  WeatherCity,
  WeatherCurrentResponse,
} from '@/api/types';
import { snapBbox } from '@/features/map/viewport';
import { useDeferredReady } from '@/lib/useDeferredReady';

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

const WEATHER_POLL_INTERVAL_MS = 90 * 1000;
const COVERAGE_STAGE_LIMIT = 16;

const SELECTED_FRESHNESS_MS = 15 * 60 * 1000;
const MAP_FRESHNESS_MS = 30 * 60 * 1000;
const MIN_REFRESH_MS = 2 * 60 * 1000;

type WeatherData = WeatherCurrentResponse | InfiniteData<WeatherCurrentResponse>;

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

function staleUntilExpiry(freshness: number) {
  return (query: Query<WeatherCurrentResponse, Error, WeatherCurrentResponse, QueryKey>) =>
    Math.max(0, readingExpiry(query.state.data, freshness) - query.state.dataUpdatedAt);
}

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
    staleTime: WEATHER_POLL_INTERVAL_MS,
    refetchInterval: WEATHER_POLL_INTERVAL_MS,
    placeholderData: (previous) => previous,
  });
}

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
        { bbox, parent, offset: pageParam, limit: 24 },
        signal,
      ),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    enabled: enabled && Boolean(bbox || parent) && !pause,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
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

export function useSelectedBoundary(code: string | null) {
  return useQuery({
    queryKey: ['municipal-boundary', code],
    queryFn: ({ signal }) =>
      apiGet<MapFeatureCollection>('/weather/municipal-boundaries', { code, limit: 1 }, signal),
    enabled: code?.length === 7,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

const CAPITALS_KEY = ['weather', 'capitals'];
const STATES_KEY = ['weather', 'states'];

export function useNationalWeather(enabled: boolean, pause: boolean) {
  const client = useQueryClient();
  useCancelWhenDisabled(CAPITALS_KEY, enabled);
  useCancelWhenDisabled(STATES_KEY, enabled);
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
    averaged: states.data !== undefined,
    error: states.data ? states.error : (states.error ?? capitals.error),
    isError: !data && (states.isError || capitals.isError),
    isFetching: capitals.isFetching || states.isFetching,
    isRefining: enabled && !pause && !states.data && !states.isError,
  };
}

function weatherGridStep(zoom: number): number {
  return zoom <= 8 ? 0.5 : zoom === 9 ? 0.25 : 0.1;
}

export function useViewportWeather(
  bbox: string | undefined,
  parent: string | null | undefined,
  zoom: number,
  enabled: boolean,
  pause: boolean,
) {
  const client = useQueryClient();
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
    // Keeps the panel steady between pans; never shows another state's area.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === (parent ?? 'all') ? previous : undefined,
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
