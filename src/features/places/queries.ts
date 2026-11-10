import { keepPreviousData, useQuery, type QueryClient } from '@tanstack/react-query';
import { apiGet } from '@/api/client';
import { loadSessionState } from '@/lib/sessionStorage';
import type {
  PlaceAreas,
  PlaceCatalog,
  PlaceContext,
  PlaceDetail,
  PlaceLayer,
  PlacePoints,
  PlaceSummary,
  PlaceValues,
  SpeciesGroup,
  SpeciesSummary,
} from '@/api/types';
import { PLACE_CONTEXTS, defaultPreferences } from './places';

// Os lugares mudam só a cada ingestão; a API também guarda as respostas por 24 h.
const FRESHNESS = 60 * 60 * 1000;
// Os registros de espécies vêm do GBIF sob demanda e mudam devagar.
const SPECIES_FRESHNESS = 6 * 60 * 60 * 1000;

function catalogOptions(context: PlaceContext) {
  return {
    queryKey: ['places', 'catalog', context] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiGet<PlaceCatalog>('/places/catalog', { context }, signal),
    staleTime: FRESHNESS,
    gcTime: FRESHNESS,
  };
}

function valuesOptions(layer: PlaceLayer, category: string | null, parent: string | null) {
  return {
    queryKey: ['places', 'values', layer, category, parent] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiGet<PlaceValues>(
        '/places/values',
        {
          layer,
          level: parent ? 'municipality' : 'state',
          category: category ?? undefined,
          parent: parent ?? undefined,
        },
        signal,
      ),
    staleTime: FRESHNESS,
    gcTime: FRESHNESS,
  };
}

function summaryOptions(code: string, layer: PlaceLayer, category: string | null) {
  return {
    queryKey: ['places', 'summary', code, layer, category] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiGet<PlaceSummary>(
        `/places/territories/${encodeURIComponent(code)}`,
        { layer, category: category ?? undefined },
        signal,
      ),
    staleTime: FRESHNESS,
    gcTime: FRESHNESS,
  };
}

function areasOptions(
  layer: PlaceLayer,
  category: string | null,
  detail: number,
  zoom: number,
  area: string | undefined,
) {
  return {
    queryKey: ['places', 'areas', layer, category, detail, area ?? null] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiGet<PlaceAreas>(
        '/places/areas',
        { layer, zoom, bbox: area, category: category ?? undefined },
        signal,
      ),
    staleTime: FRESHNESS,
    gcTime: FRESHNESS,
  };
}

export function usePlaceCatalog(context: PlaceContext) {
  return useQuery(catalogOptions(context));
}

export function usePlaceValues(
  layer: PlaceLayer,
  category: string | null,
  parent: string | null,
  enabled: boolean,
) {
  return useQuery({
    ...valuesOptions(layer, category, parent),
    enabled,
    // Trocar de categoria mantém o mapa pintado até a contagem nova chegar.
    placeholderData: (previous) =>
      previous?.layer === layer && previous.parent === parent ? previous : undefined,
  });
}

export function usePlacePoints(
  layer: PlaceLayer,
  category: string | null,
  area: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['places', 'points', layer, category, area ?? null],
    queryFn: ({ signal }) =>
      apiGet<PlacePoints>(
        '/places/points',
        { layer, bbox: area, category: category ?? undefined },
        signal,
      ),
    enabled: enabled && Boolean(area),
    staleTime: FRESHNESS,
    gcTime: 10 * 60 * 1000,
    placeholderData: (previous) => (previous?.layer === layer ? previous : undefined),
  });
}

export function usePlaceAreas(
  layer: PlaceLayer,
  category: string | null,
  detail: number,
  zoom: number,
  area: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    ...areasOptions(layer, category, detail, zoom, area),
    enabled,
    placeholderData: (previous) => (previous?.layer === layer ? previous : undefined),
  });
}

export function usePlaceSummary(
  code: string,
  layer: PlaceLayer,
  category: string | null,
  enabled: boolean,
) {
  return useQuery({
    ...summaryOptions(code, layer, category),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function usePlaceDetail(id: number | null) {
  return useQuery({
    queryKey: ['places', 'item', id],
    queryFn: ({ signal }) => apiGet<PlaceDetail>(`/places/items/${id}`, {}, signal),
    enabled: id !== null,
    staleTime: FRESHNESS,
  });
}

export function useSpecies(code: string, group: SpeciesGroup, enabled: boolean) {
  return useQuery({
    queryKey: ['places', 'species', code, group],
    queryFn: ({ signal }) =>
      apiGet<SpeciesSummary>(`/places/species/${encodeURIComponent(code)}`, { group }, signal),
    enabled,
    staleTime: SPECIES_FRESHNESS,
    gcTime: SPECIES_FRESHNESS,
    retry: false,
  });
}

// Catálogo, pintura do recorte e painel da seleção salvos; as áreas do desenho
// nacional entram quando a aba é de áreas. As espécies ficam de fora: dependem
// de uma fonte externa.
export function prefetchPlaces(context: PlaceContext) {
  return async (client: QueryClient): Promise<void> => {
    const { scope, selectedCode, places } = loadSessionState();
    const preferences = places?.[context] ?? defaultPreferences(context);
    const tabs = PLACE_CONTEXTS[context].tabs;
    const tab = tabs.find((item) => item.key === preferences.tab) ?? tabs[0]!;
    const category = preferences.categories[tab.key] ?? null;
    const catalog = await client.ensureQueryData(catalogOptions(context));
    const layer = catalog.layers.find((item) => item.key === tab.layer);
    const valid = layer?.categories.some((item) => item.key === category) ? category : null;
    await Promise.all([
      client.ensureQueryData(
        summaryOptions(selectedCode ?? scope?.parent ?? 'BR', tab.layer, valid),
      ),
      layer?.hasShapes
        ? client.ensureQueryData(areasOptions(tab.layer, valid, 4, 4, undefined))
        : client.ensureQueryData(valuesOptions(tab.layer, valid, scope?.parent ?? null)),
    ]);
  };
}
