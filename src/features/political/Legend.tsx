import type { PoliticalValues, PoliticalMetric } from '@/api/types';
import { ScaleLegend } from '@/components/ScaleLegend';
import { categorical, numericBands, partyColor } from './presentation';
import { metricLabel } from './selection';

export function Legend({
  data,
  metric,
  loading,
}: {
  data?: PoliticalValues;
  metric: PoliticalMetric;
  loading: boolean;
}) {
  const parties = [
    ...new Set(
      data?.values.filter((v) => v.value !== null && !v.tie && v.party).map((v) => v.party!) ?? [],
    ),
  ].sort();
  const quantitativeBands = numericBands(metric);
  const bands = categorical(metric)
    ? parties.map((party) => ({ color: partyColor(party), label: party, name: party }))
    : quantitativeBands;
  const available = data?.values.some((v) => v.value !== null) ?? false;
  if (available && categorical(metric) && !parties.length) return null;
  return (
    <ScaleLegend
      key={`${data?.year}:${data?.office}:${data?.round}:${metric}`}
      title={metricLabel(metric)}
      unit={categorical(metric) ? 'Partidos' : metric === 'margin' ? 'p.p.' : '%'}
      bands={
        bands.length
          ? bands
          : [{ color: 'var(--map-neutral)', label: 'Sem dados', name: 'Sem dados' }]
      }
      ticks={
        categorical(metric)
          ? []
          : [
              { label: '0', percent: 0 },
              ...[2, 5, 8].map((index) => ({
                label: quantitativeBands[index]!.lower.toLocaleString('pt-BR'),
                percent: index * 10,
              })),
              { label: '100', percent: 100 },
            ]
      }
      notice={
        !available
          ? loading
            ? 'Carregando dados…'
            : 'Sem dados para este recorte'
          : data?.status === 'partial'
            ? `${data.year} · resultados parciais`
            : undefined
      }
      loading={loading && !available}
      unavailable={!available}
    />
  );
}
