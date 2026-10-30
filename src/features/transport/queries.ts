import { keepPreviousData, useQuery, type QueryClient } from '@tanstack/react-query';
import { apiGet } from '@/api/client';
import { loadSessionState } from '@/lib/sessionStorage';
import type {
  TransportCatalog,
  TransportFeatureProperties,
  TransportLayer,
  TransportNetwork,
  TransportSummary,
} from '@/api/types';

// A malha muda só a cada ingestão; a API também guarda as respostas por 24 h.
const FRESHNESS = 60 * 60 * 1000;

const catalogOptions = {
  queryKey: ['transport', 'catalog'] as const,
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    apiGet<TransportCatalog>('/transport/catalog', {}, signal),
  staleTime: FRESHNESS,
  gcTime: FRESHNESS,
};

// A chave usa a faixa de detalhe; o zoom real vai junto porque a API recusa a
// camada abaixo do zoom mínimo dela.
export function networkOptions(
  layer: TransportLayer,
  detail: number,
  zoom: number,
  area: string | undefined,
) {
  return {
    queryKey: ['transport', 'network', layer, detail, area ?? null] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiGet<TransportNetwork>('/transport/network', { layer, zoom, bbox: area }, signal),
    staleTime: FRESHNESS,
    gcTime: FRESHNESS,
  };
}

function summaryOptions(code: string) {
  return {
    queryKey: ['transport', 'summary', code] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiGet<TransportSummary>(`/transport/territories/${encodeURIComponent(code)}`, {}, signal),
    staleTime: FRESHNESS,
    gcTime: FRESHNESS,
  };
}

export const PORTS = ['port', 4, 4, undefined] as const;

export function useTransportCatalog() {
  return useQuery(catalogOptions);
}

export function useTransportNetwork(
  layer: TransportLayer,
  detail: number,
  zoom: number,
  area: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    ...networkOptions(layer, detail, zoom, area),
    enabled,
    // O traçado anterior fica na tela até o da área nova chegar, sem piscar.
    placeholderData: (previous) => (previous?.metadata.layer === layer ? previous : undefined),
  });
}

export function useTransportSummary(code: string, enabled: boolean) {
  return useQuery({ ...summaryOptions(code), enabled, placeholderData: keepPreviousData });
}

// Catálogo (URL dos tiles) e painel do recorte salvo; na aba Hidrovias, também
// os portos, que vêm todos de uma vez.
export async function prefetchTransport(client: QueryClient): Promise<void> {
  const { scope, selectedCode, transport } = loadSessionState();
  await Promise.all([
    client.ensureQueryData(catalogOptions),
    client.ensureQueryData(summaryOptions(selectedCode ?? scope?.parent ?? 'BR')),
    transport?.tab === 'waterways' && client.ensureQueryData(networkOptions(...PORTS)),
  ]);
}

export interface TransportLocation {
  latitude: number;
  longitude: number;
  tolerance: number;
}

export function useTransportIdentify(layer: TransportLayer, location: TransportLocation | null) {
  return useQuery({
    queryKey: ['transport', 'identify', layer, location],
    queryFn: ({ signal }) =>
      apiGet<{ feature: TransportFeatureProperties | null }>(
        '/transport/identify',
        { layer, ...location },
        signal,
      ),
    enabled: Boolean(location),
    staleTime: FRESHNESS,
  });
}
