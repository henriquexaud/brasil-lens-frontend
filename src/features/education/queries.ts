import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiGet } from '@/api/client';
import type {
  EducationInstitutionDetail,
  EducationNetwork,
  EducationTerritory,
  IndicatorListResponse,
  MapValuesResponse,
  TerritoryLevel,
} from '@/api/types';

// A API publica o Censo com max-age de 5 min, como o Socioeconômico; o dado só
// muda numa nova ingestão.
const FRESHNESS = 5 * 60 * 1000;

export function useEducationIndicators(level: TerritoryLevel) {
  return useQuery({
    queryKey: ['education', 'indicators', level],
    queryFn: ({ signal }) =>
      apiGet<IndicatorListResponse>(
        '/socioeconomic/indicators',
        { level, context: 'education' },
        signal,
      ),
    staleTime: FRESHNESS,
  });
}

export function useEducationValues(
  level: TerritoryLevel,
  parent: string | null,
  indicator: string,
  year: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['education', 'values', level, parent, indicator, year],
    queryFn: ({ signal }) =>
      apiGet<MapValuesResponse>(
        '/socioeconomic/values',
        { level, parent, indicator, year, context: 'education' },
        signal,
      ),
    staleTime: FRESHNESS,
    gcTime: 30 * 60 * 1000,
    enabled,
  });
}

export function useEducationTerritory(
  code: string,
  year: string,
  network: EducationNetwork,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['education', 'territory', code, year, network],
    queryFn: ({ signal }) =>
      apiGet<EducationTerritory>(
        `/education/territories/${encodeURIComponent(code)}`,
        { year, network },
        signal,
      ),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: FRESHNESS,
  });
}

export function useEducationInstitution(code: number | null, year: string) {
  return useQuery({
    queryKey: ['education', 'institution', code, year],
    queryFn: ({ signal }) =>
      apiGet<EducationInstitutionDetail>(`/education/institutions/${code}`, { year }, signal),
    enabled: code !== null,
    staleTime: FRESHNESS,
  });
}
