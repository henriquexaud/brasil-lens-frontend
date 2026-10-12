import type { MapFeatureCollection, PoliticalValues } from '@/api/types';
import { TerritoryRanking } from '@/components/TerritoryRanking';
import { isParticipation, metricLabel } from './selection';

export function ParticipationRanking({
  data,
  collection,
  onSelect,
}: {
  data: PoliticalValues;
  collection: MapFeatureCollection;
  onSelect: (code: string) => void;
}) {
  if (!isParticipation(data.metric)) return null;
  return (
    <TerritoryRanking
      key={`${data.year}:${data.office}:${data.round}:${data.metric}:${collection.scope.parent}`}
      title={`${metricLabel(data.metric)} · maiores e menores`}
      values={data.values}
      collection={collection}
      formatValue={(value) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`}
      note={`${data.year} · ${data.round}º turno${data.status === 'partial' ? ' · Resultados parciais' : ''}`}
      onSelect={onSelect}
    />
  );
}
