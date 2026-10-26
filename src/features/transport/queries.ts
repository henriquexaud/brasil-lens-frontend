import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiGet } from '@/api/client';
import type {
  TransportCatalog,
  TransportFeatureProperties,
  TransportLayer,
  TransportNetwork,
  TransportSummary,
} from '@/api/types';

// A malha muda só a cada ingestão; a API também guarda as respostas por 24 h.
const FRESHNESS = 60 * 60 * 1000;

export function useTransportCatalog() {
  return useQuery({
    queryKey: ['transport', 'catalog'],
    queryFn: ({ signal }) => apiGet<TransportCatalog>('/transport/catalog', {}, signal),
    staleTime: FRESHNESS,
  });
}

// A chave usa a faixa de detalhe; o zoom real vai junto porque a API recusa a
// camada abaixo do zoom mínimo dela.
export function useTransportNetwork(
  layer: TransportLayer,
  detail: number,
  zoom: number,
  area: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['transport', 'network', layer, detail, area ?? null],
    queryFn: ({ signal }) =>
      apiGet<TransportNetwork>('/transport/network', { layer, zoom, bbox: area }, signal),
    enabled,
    // O traçado anterior fica na tela até o da área nova chegar, sem piscar.
    placeholderData: (previous) => (previous?.metadata.layer === layer ? previous : undefined),
    staleTime: FRESHNESS,
    gcTime: FRESHNESS,
  });
}

export function useTransportSummary(code: string, enabled: boolean) {
  return useQuery({
    queryKey: ['transport', 'summary', code],
    queryFn: ({ signal }) =>
      apiGet<TransportSummary>(`/transport/territories/${encodeURIComponent(code)}`, {}, signal),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: FRESHNESS,
  });
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
