import { useQuery, type QueryClient } from '@tanstack/react-query';
import { apiGet } from '@/api/client';
import { loadSessionState } from '@/lib/sessionStorage';
import { yearForIndicator } from './indicatorCategories';
import type {
  IndicatorContext,
  IndicatorListResponse,
  MapValuesResponse,
  TerritoryLevel,
  TerritoryOverview,
} from '@/api/types';

const FRESHNESS = 5 * 60 * 1000;
// Catálogos são pequenos e quase nunca mudam: ficam no cache entre visitas ao
// contexto, e a volta pinta direto enquanto revalida.
export const CATALOG_GC = 60 * 60 * 1000;

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

function indicatorsOptions(level: TerritoryLevel) {
  return {
    queryKey: ['socioeconomic', 'indicators', level] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiGet<IndicatorListResponse>('/socioeconomic/indicators', { level }, signal),
    staleTime: FRESHNESS,
    gcTime: CATALOG_GC,
  };
}

export function useIndicators(level: TerritoryLevel) {
  return useQuery(indicatorsOptions(level));
}

// O que o contexto pinta primeiro no recorte salvo, com as mesmas chaves do
// SocioeconomicApp: a troca de contexto já encontra o mapa pronto.
export async function prefetchSocioeconomic(client: QueryClient): Promise<void> {
  const { scope, socioeconomic } = loadSessionState();
  const level = scope?.level ?? 'state';
  const catalog = await client.ensureQueryData(indicatorsOptions(level));
  const current = catalog.indicators.find(
    (item) => item.key === (socioeconomic?.indicatorKey ?? 'population'),
  );
  if (!current) return;
  const year = yearForIndicator(current, socioeconomic?.year ?? 'latest');
  await client.ensureQueryData(valuesOptions(level, scope?.parent ?? null, current.key, year));
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

export function useOverview(
  code: string,
  year: string,
  enabled = true,
  context: IndicatorContext = 'socioeconomic',
) {
  return useQuery({
    queryKey: ['socioeconomic', 'territory', code, year, context],
    queryFn: ({ signal }) =>
      apiGet<TerritoryOverview>(
        `/socioeconomic/territories/${code}`,
        context === 'socioeconomic' ? { year } : { year, context },
        signal,
      ),
    staleTime: FRESHNESS,
    gcTime: 30 * 60 * 1000,
    enabled,
  });
}
