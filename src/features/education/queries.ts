import { keepPreviousData, useQuery, type QueryClient } from '@tanstack/react-query';
import { apiGet } from '@/api/client';
import { loadSessionState } from '@/lib/sessionStorage';
import { CATALOG_GC } from '@/features/socioeconomic/queries';
import { DEFAULT_EDUCATION, indicatorKey, type EducationPreferences } from './education';
import type {
  EducationInstitutionDetail,
  EducationKind,
  EducationNetwork,
  EducationTerritory,
  IndicatorListResponse,
  MapValuesResponse,
  TerritoryLevel,
} from '@/api/types';

// A API publica o Censo com max-age de 5 min, como o Socioeconômico; o dado só
// muda numa nova ingestão.
const FRESHNESS = 5 * 60 * 1000;
const DATA_GC = 30 * 60 * 1000;

function indicatorsOptions(level: TerritoryLevel) {
  return {
    queryKey: ['education', 'indicators', level] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiGet<IndicatorListResponse>(
        '/socioeconomic/indicators',
        { level, context: 'education' },
        signal,
      ),
    staleTime: FRESHNESS,
    gcTime: CATALOG_GC,
  };
}

export function educationValuesOptions(
  level: TerritoryLevel,
  parent: string | null,
  indicator: string,
  year: string,
) {
  return {
    queryKey: ['education', 'values', level, parent, indicator, year] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiGet<MapValuesResponse>(
        '/socioeconomic/values',
        { level, parent, indicator, year, context: 'education' },
        signal,
      ),
    staleTime: FRESHNESS,
    gcTime: DATA_GC,
  };
}

function territoryOptions(
  code: string,
  year: string,
  network: EducationNetwork,
  kind: EducationKind,
) {
  return {
    queryKey: ['education', 'territory', code, year, network, kind] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiGet<EducationTerritory>(
        `/education/territories/${encodeURIComponent(code)}`,
        { year, network, kind },
        signal,
      ),
    staleTime: FRESHNESS,
    gcTime: DATA_GC,
  };
}

export function useEducationIndicators(level: TerritoryLevel) {
  return useQuery(indicatorsOptions(level));
}

export function useEducationValues(
  level: TerritoryLevel,
  parent: string | null,
  indicator: string,
  year: string,
  enabled: boolean,
) {
  return useQuery({ ...educationValuesOptions(level, parent, indicator, year), enabled });
}

export function useEducationTerritory(
  code: string,
  year: string,
  network: EducationNetwork,
  kind: EducationKind,
  enabled: boolean,
) {
  return useQuery({
    ...territoryOptions(code, year, network, kind),
    enabled,
    placeholderData: keepPreviousData,
  });
}

// Mapa e painel de uma escolha de rede, tipo e ano, com as mesmas regras e
// chaves do EducationApp (tipo sem dado volta a Todas; ano sem dado, ao último).
export function prefetchEducationChoice(
  client: QueryClient,
  catalog: IndicatorListResponse,
  level: TerritoryLevel,
  parent: string | null,
  detailCode: string,
  choice: EducationPreferences,
): Promise<unknown> {
  const find = (key: string) => catalog.indicators.find((item) => item.key === key);
  const kind = find(indicatorKey(choice.network, choice.kind))?.latestYear ? choice.kind : 'all';
  const current = find(indicatorKey(choice.network, kind));
  if (!current) return Promise.resolve();
  const year =
    choice.year === 'latest' || current.availableYears.includes(Number(choice.year))
      ? choice.year
      : 'latest';
  return Promise.all([
    client.ensureQueryData(educationValuesOptions(level, parent, current.key, year)),
    client.ensureQueryData(territoryOptions(detailCode, year, choice.network, kind)),
  ]);
}

export async function prefetchEducation(client: QueryClient): Promise<void> {
  const { scope, selectedCode, education = DEFAULT_EDUCATION } = loadSessionState();
  const level = scope?.level ?? 'state';
  const parent = scope?.parent ?? null;
  const catalog = await client.ensureQueryData(indicatorsOptions(level));
  await prefetchEducationChoice(
    client,
    catalog,
    level,
    parent,
    selectedCode ?? parent ?? 'BR',
    education,
  );
}

export function useEducationInstitution(code: number | null, year: string) {
  return useQuery({
    queryKey: ['education', 'institution', code, year],
    queryFn: ({ signal }) =>
      apiGet<EducationInstitutionDetail>(`/education/institutions/${code}`, { year }, signal),
    enabled: code !== null,
    staleTime: FRESHNESS,
    gcTime: DATA_GC,
  });
}
