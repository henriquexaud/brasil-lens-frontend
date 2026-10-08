import type {
  PoliticalValues,
  PoliticalMetric,
  PoliticalDetail,
  PoliticalSelection,
} from '@/api/types';
import { ScaleLegend } from '@/components/ScaleLegend';
import { categorical, numericBands, partyColor } from './presentation';
import { voteShares } from './summary';
import { candidateName } from './presentation';
import { metricLabel } from './selection';

export function Legend({
  data,
  metric,
  loading,
  detail,
  selection,
}: {
  data?: PoliticalValues;
  metric: PoliticalMetric;
  loading: boolean;
  detail?: PoliticalDetail;
  selection?: PoliticalSelection;
}) {
  const shares =
    metric === 'leading_candidate' && detail && selection ? voteShares(detail, selection) : null;
  if (shares) {
    const sameParty = shares.leaders[0]!.party === shares.leaders[1]!.party;
    const labels = shares.leaders.map((candidate) => {
      const percent = `${candidate.percent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
      return {
        label: `${sameParty || !candidate.party ? candidateName(candidate.name) : candidate.party} ${percent}`,
        name: `${candidateName(candidate.name)} (${candidate.party}) · ${percent} dos votos válidos`,
        color: partyColor(candidate.party),
      };
    });
    return (
      <ScaleLegend
        key={`${detail!.ibgeCode}:${detail!.year}:${detail!.office}:${detail!.round}:${metric}`}
        title={metricLabel(metric)}
        unit="% válidos"
        bands={shares.leaders.map((candidate, index) => ({
          color: labels[index]!.color,
          label: labels[index]!.label,
          name: labels[index]!.name,
          weight: candidate.balancePercent,
        }))}
        labels={labels}
        ticks={[]}
        notice={detail!.status === 'partial' ? `${detail!.year} · resultados parciais` : undefined}
      />
    );
  }
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
