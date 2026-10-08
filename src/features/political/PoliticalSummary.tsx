import type { ReactNode } from 'react';
import type { PoliticalDetail, PoliticalSelection } from '@/api/types';
import { candidateName, partyColor } from './presentation';
import { metricLabel } from './selection';
import { summaryMetric } from './summary';

export const formatCount = (value: number | null | undefined) =>
  value == null ? 'Sem dados' : value.toLocaleString('pt-BR');

export function PartyDot({ party }: { party: string }) {
  return (
    <span
      className="political-party-dot"
      style={{ backgroundColor: partyColor(party) }}
      aria-hidden="true"
    />
  );
}

export function PoliticalStats({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="indicator-list">
      {rows.map(({ label, value }) => (
        <div className="indicator-row" key={label}>
          <dt className="indicator-label">{label}</dt>
          <dd className="indicator-value">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Highlight({ label, value, note }: { label: string; value: string; note?: ReactNode }) {
  return (
    <div className="featured-indicator">
      <p className="indicator-label">{label}</p>
      <p className={`featured-value${value === 'Sem dados' ? ' is-missing' : ''}`}>{value}</p>
      {note && <p className="source-note">{note}</p>}
    </div>
  );
}

export function PoliticalSummary({
  data,
  selection,
}: {
  data: PoliticalDetail;
  selection: PoliticalSelection;
}) {
  const summary = data.summary!;
  const leader = data.leaders[0];
  if (selection.category === 'representation') {
    return leader && data.leaders.length === 1 ? (
      <Highlight
        label="Eleito no pleito"
        value={candidateName(leader.name)}
        note={
          <>
            <PartyDot party={leader.party} />
            {leader.party}
          </>
        }
      />
    ) : (
      <>
        <Highlight label="Eleitos no pleito" value={formatCount(summary.representatives)} />
        {summary.party && (
          <PoliticalStats
            rows={[
              {
                label: summary.partyTie ? 'Partidos empatados' : 'Partido com mais eleitos',
                value: (
                  <>
                    {!summary.partyTie && (
                      <>
                        <PartyDot party={summary.party} />
                        {summary.party} ·{' '}
                      </>
                    )}
                    {formatCount(summary.partySeats)}
                  </>
                ),
              },
            ]}
          />
        )}
      </>
    );
  }
  if (
    selection.category === 'participation' ||
    ['leader_share', 'margin'].includes(selection.metric)
  ) {
    const metric = summaryMetric(data, selection.metric);
    const participation = selection.category === 'participation';
    return (
      <Highlight
        label={metricLabel(selection.metric)}
        value={
          metric.value === null
            ? 'Sem dados'
            : `${metric.value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${selection.metric === 'margin' ? ' p.p.' : '%'}`
        }
        note={
          participation
            ? metric.count == null
              ? undefined
              : `${formatCount(metric.count)} ${['turnout', 'abstention'].includes(selection.metric) ? 'eleitores' : 'votos'}`
            : summary.candidateTie
              ? 'Empate entre os mais votados'
              : leader && (
                  <>
                    <PartyDot party={leader.party} />
                    {candidateName(leader.name)} · {leader.party}
                  </>
                )
        }
      />
    );
  }
  const party = selection.metric === 'leading_party';
  const tie = party ? summary.partyTie : summary.candidateTie;
  return (
    <Highlight
      label={tie ? 'Empate entre os mais votados' : party ? 'Partido mais votado' : 'Mais votado'}
      value={
        tie
          ? 'Empate'
          : party
            ? (summary.party ?? 'Sem dados')
            : leader
              ? candidateName(leader.name)
              : 'Resultado municipal'
      }
      note={
        party ? (
          <>
            {summary.party && !tie && <PartyDot party={summary.party} />}
            {formatCount(summary.partyVotes)} votos
          </>
        ) : leader && !tie ? (
          <>
            <PartyDot party={leader.party} />
            {leader.party} · {formatCount(leader.votes)} votos
          </>
        ) : !tie ? (
          'Consulte um município para ver os candidatos.'
        ) : undefined
      }
    />
  );
}
