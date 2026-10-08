import { useEffect } from 'react';
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
import { electionRefreshInterval } from './liveElection';
import { useElectionWindow } from './useElectionWindow';

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
  const window = useElectionWindow();
  const query = useQuery({
    queryKey: ['political', 'detail', code, year, office, round, offset],
    queryFn: ({ signal }) =>
      apiGet<PoliticalDetail>(
        `/political/territories/${code}`,
        { year, office, round, offset, limit: 25 },
        signal,
      ),
    staleTime: FRESHNESS,
    refetchInterval: (query) =>
      electionRefreshInterval(window, selection, query.state.data?.status),
    refetchIntervalInBackground: false,
    enabled,
  });
  const live = enabled && Boolean(electionRefreshInterval(window, selection, query.data?.status));
  const { refetch } = query;
  useEffect(() => {
    if (live) void refetch({ cancelRefetch: false });
  }, [live, refetch]);
  return query;
}
