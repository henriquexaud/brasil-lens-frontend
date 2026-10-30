import { useEffect } from 'react';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { apiGet } from '@/api/client';
import { loadSessionState } from '@/lib/sessionStorage';
import { CATALOG_GC } from '@/features/socioeconomic/queries';
import type {
  PoliticalRelease,
  PoliticalValues,
  PoliticalDetail,
  PoliticalSelection,
  TerritoryLevel,
} from '@/api/types';
import { DEFAULT_SELECTION, latestSelection, normalizeSelection, parameters } from './selection';
import { electionRefreshInterval } from './liveElection';
import { useElectionWindow } from './useElectionWindow';

const FRESHNESS = 5 * 60 * 1000;
const DATA_GC = 30 * 60 * 1000;
const catalogOptions = {
  queryKey: ['political', 'catalog'] as const,
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    apiGet<{ releases: PoliticalRelease[] }>('/political/catalog', {}, signal),
  staleTime: FRESHNESS,
  gcTime: CATALOG_GC,
};
function valuesOptions(
  level: TerritoryLevel,
  parent: string | null,
  selection: PoliticalSelection,
) {
  const p = parameters(selection);
  return {
    queryKey: ['political', 'values', level, parent, p] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiGet<PoliticalValues>('/political/values', { level, parent, ...p }, signal),
    staleTime: FRESHNESS,
    gcTime: DATA_GC,
  };
}
function detailOptions(code: string, selection: PoliticalSelection, offset: number) {
  const { year, office, round } = parameters(selection);
  return {
    queryKey: ['political', 'detail', code, year, office, round, offset] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiGet<PoliticalDetail>(
        `/political/territories/${code}`,
        { year, office, round, offset, limit: 25 },
        signal,
      ),
    staleTime: FRESHNESS,
    gcTime: DATA_GC,
  };
}
export function useCatalog() {
  return useQuery(catalogOptions);
}
export function useValues(
  level: TerritoryLevel,
  parent: string | null,
  selection: PoliticalSelection,
  enabled = true,
) {
  return useQuery({ ...valuesOptions(level, parent, selection), enabled });
}
// Mapa e painel do recorte salvo, na edição mais recente como o PoliticalApp
// abre (`latestSelection` e `normalizeSelection`).
export async function prefetchPolitical(client: QueryClient): Promise<void> {
  const { scope, selectedCode, political = DEFAULT_SELECTION } = loadSessionState();
  const { releases } = await client.ensureQueryData(catalogOptions);
  const selection = normalizeSelection(latestSelection(political, releases), releases);
  if (!releases.some((item) => item.year === selection.year)) return;
  const parent = scope?.parent ?? null;
  await Promise.all([
    client.ensureQueryData(valuesOptions(scope?.level ?? 'state', parent, selection)),
    client.ensureQueryData(detailOptions(selectedCode ?? parent ?? 'BR', selection, 0)),
  ]);
}
export function useDetail(code: string, selection: PoliticalSelection, offset = 0, enabled = true) {
  const window = useElectionWindow();
  const query = useQuery({
    ...detailOptions(code, selection, offset),
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
