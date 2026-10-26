import type { FireHotspotCollection } from '@/api/types';
import { LayerMetadata } from '@/components/LayerMetadata';
import { StatusBadge } from '@/components/StatusBadge';

export function FireMetadata({
  fireHotspots,
  loading = false,
  error = false,
  scopeName,
}: {
  fireHotspots?: FireHotspotCollection;
  loading?: boolean;
  error?: boolean;
  scopeName?: string;
}) {
  const stale = fireHotspots?.metadata.status === 'stale' || error;
  return (
    <LayerMetadata
      sources={[
        {
          label: 'INPE',
          description: 'Programa Queimadas: focos detectados nas últimas 48 horas.',
        },
      ]}
      unit="48h"
    >
      <StatusBadge tone={fireHotspots ? (stale ? 'warning' : 'fire') : error ? 'error' : 'neutral'}>
        {fireHotspots
          ? `${fireHotspots.metadata.hotspotCount.toLocaleString('pt-BR')} focos · ${scopeName ?? 'Brasil'}${stale ? ' · anterior' : ''}`
          : error
            ? 'Indisponível'
            : loading
              ? 'Carregando…'
              : 'Sem dados'}
      </StatusBadge>
    </LayerMetadata>
  );
}
