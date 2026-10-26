import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/api/client';
import type { IndicatorListResponse, MapValuesResponse, TerritoryLevel } from '@/api/types';

// Mesmo frescor do Socioeconômico: a API publica os dois contextos com 5 min.
const FRESHNESS = 5 * 60 * 1000;

export function useEnvironmentIndicators(level: TerritoryLevel, enabled: boolean) {
  return useQuery({
    queryKey: ['environment', 'indicators', level],
    queryFn: ({ signal }) =>
      apiGet<IndicatorListResponse>(
        '/socioeconomic/indicators',
        { level, context: 'environment' },
        signal,
      ),
    staleTime: FRESHNESS,
    enabled,
  });
}

export function useEnvironmentValues(
  level: TerritoryLevel,
  parent: string | null,
  indicator: string,
  year: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['environment', 'values', level, parent, indicator, year],
    queryFn: ({ signal }) =>
      apiGet<MapValuesResponse>(
        '/socioeconomic/values',
        { level, parent, indicator, year, context: 'environment' },
        signal,
      ),
    staleTime: FRESHNESS,
    gcTime: 30 * 60 * 1000,
    enabled,
  });
}
