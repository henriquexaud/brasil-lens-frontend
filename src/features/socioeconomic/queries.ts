import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/api/client';
import type {
  IndicatorListResponse,
  MapValuesResponse,
  TerritoryLevel,
  TerritoryOverview,
} from '@/api/types';

const FRESHNESS = 5 * 60 * 1000;

export function valuesOptions(
  level: TerritoryLevel,
  parent: string | null,
  indicator: string,
  year: string,
) {
  return {
    queryKey: ['socioeconomic', 'values', level, parent, indicator, year] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiGet<MapValuesResponse>(
        '/socioeconomic/values',
        { level, parent, indicator, year },
        signal,
      ),
    staleTime: FRESHNESS,
    gcTime: 30 * 60 * 1000,
  };
}

export function useIndicators(level: TerritoryLevel) {
  return useQuery({
    queryKey: ['socioeconomic', 'indicators', level],
    queryFn: ({ signal }) =>
      apiGet<IndicatorListResponse>('/socioeconomic/indicators', { level }, signal),
    staleTime: FRESHNESS,
  });
}

export function useValues(
  level: TerritoryLevel,
  parent: string | null,
  indicator: string,
  year: string,
  enabled = true,
) {
  return useQuery({ ...valuesOptions(level, parent, indicator, year), enabled });
}

export function useOverview(code: string, year: string, enabled = true) {
  return useQuery({
    queryKey: ['socioeconomic', 'territory', code, year],
    queryFn: ({ signal }) =>
      apiGet<TerritoryOverview>(`/socioeconomic/territories/${code}`, { year }, signal),
    staleTime: FRESHNESS,
    enabled,
  });
}
