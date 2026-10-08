import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/api/client';
import type {
  PoliticalRelease,
  PoliticalValues,
  PoliticalDetail,
  PoliticalSelection,
  TerritoryLevel,
} from '@/api/types';
import { parameters } from './selection';

const FRESHNESS = 5 * 60 * 1000;
export function useCatalog() {
  return useQuery({
    queryKey: ['political', 'catalog'],
    queryFn: ({ signal }) =>
      apiGet<{ releases: PoliticalRelease[] }>('/political/catalog', {}, signal),
    staleTime: FRESHNESS,
  });
}
export function useValues(
  level: TerritoryLevel,
  parent: string | null,
  selection: PoliticalSelection,
  enabled = true,
) {
  const p = parameters(selection);
  return useQuery({
    queryKey: ['political', 'values', level, parent, p],
    queryFn: ({ signal }) =>
      apiGet<PoliticalValues>('/political/values', { level, parent, ...p }, signal),
    staleTime: FRESHNESS,
    gcTime: 30 * 60 * 1000,
    enabled,
  });
}
export function useDetail(code: string, selection: PoliticalSelection, offset = 0, enabled = true) {
  const { year, office, round } = parameters(selection);
  return useQuery({
    queryKey: ['political', 'detail', code, year, office, round, offset],
    queryFn: ({ signal }) =>
      apiGet<PoliticalDetail>(
        `/political/territories/${code}`,
        { year, office, round, offset, limit: 25 },
        signal,
      ),
    staleTime: FRESHNESS,
    enabled,
  });
}
