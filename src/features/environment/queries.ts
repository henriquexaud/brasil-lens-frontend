import { useQuery, type QueryClient } from '@tanstack/react-query';
import { apiGet } from '@/api/client';
import { loadSessionState } from '@/lib/sessionStorage';
import { CATALOG_GC } from '@/features/socioeconomic/queries';
import { INDICATOR_LAYERS, type IndicatorLayer } from './layers';
import type {
  DeforestationAlerts,
  IndicatorListResponse,
  MapValuesResponse,
  TerritoryLevel,
} from '@/api/types';

// Mesmo frescor do Socioeconômico: a API publica os dois contextos com 5 min.
const FRESHNESS = 5 * 60 * 1000;

function indicatorsOptions(level: TerritoryLevel) {
  return {
    queryKey: ['environment', 'indicators', level] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiGet<IndicatorListResponse>(
        '/socioeconomic/indicators',
        { level, context: 'environment' },
        signal,
      ),
    staleTime: FRESHNESS,
    gcTime: CATALOG_GC,
  };
}

function valuesOptions(
  level: TerritoryLevel,
  parent: string | null,
  indicator: string,
  year: string,
) {
  return {
    queryKey: ['environment', 'values', level, parent, indicator, year] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiGet<MapValuesResponse>(
        '/socioeconomic/values',
        { level, parent, indicator, year, context: 'environment' },
        signal,
      ),
    staleTime: FRESHNESS,
    gcTime: 30 * 60 * 1000,
  };
}

// Alertas do DETER: a API guarda a janela por 2 h e manda `max-age` de 10 min.
export function useDeforestationAlerts(enabled: boolean) {
  return useQuery({
    queryKey: ['environment', 'alerts'] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiGet<DeforestationAlerts>('/deforestation-alerts', undefined, signal),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled,
  });
}

export function useEnvironmentIndicators(level: TerritoryLevel, enabled: boolean) {
  return useQuery({ ...indicatorsOptions(level), enabled });
}

export function useEnvironmentValues(
  level: TerritoryLevel,
  parent: string | null,
  indicator: string,
  year: string,
  enabled: boolean,
) {
  return useQuery({ ...valuesOptions(level, parent, indicator, year), enabled });
}

// Valores mais recentes de Florestas ou Desmatamento no recorte salvo, com as
// chaves de `useEnvironmentIndicator`. Sem `layer`, a aba salva; Fogo e
// "nenhuma" não têm o que adiantar aqui.
export async function prefetchEnvironment(
  client: QueryClient,
  layer?: IndicatorLayer,
): Promise<void> {
  const { scope, environmentLayer = 'forest' } = loadSessionState();
  const target =
    layer ??
    (environmentLayer === 'forest' || environmentLayer === 'deforestation'
      ? environmentLayer
      : null);
  if (!target) return;
  const key = INDICATOR_LAYERS[target].indicatorKey;
  const level = scope?.level ?? 'state';
  // Cada aba abre no ano mais recente, então os valores não esperam o catálogo.
  await Promise.all([
    client.ensureQueryData(indicatorsOptions(level)),
    client.ensureQueryData(valuesOptions(level, scope?.parent ?? null, key, 'latest')),
  ]);
}
