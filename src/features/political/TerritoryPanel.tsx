import { useState } from 'react';
import type { PoliticalSelection } from '@/api/types';
import { ErrorMessage } from '@/components/Feedback';
import { Disclosure } from '@/components/Disclosure';
import { DrillDownButton } from '@/components/DrillDownButton';
import { useDetail } from './queries';
import { officeLabel } from './selection';
import { candidateName } from './presentation';
import { CandidateVotes } from './CandidateVotes';
import {
  formatCount as count,
  PartyDot,
  PoliticalStats,
  PoliticalSummary,
} from './PoliticalSummary';

function Representatives({ code, selection }: { code: string; selection: PoliticalSelection }) {
  const [offset, setOffset] = useState(0);
  const query = useDetail(code, selection, offset);
  if (query.error) return <ErrorMessage error={query.error} />;
  if (!query.data) return <p role="status">Carregando eleitos…</p>;
  return (
    <>
      <PoliticalStats
        rows={query.data.representatives.map((candidate) => ({
          label: candidateName(candidate.name),
          value: (
            <>
              <PartyDot party={candidate.party} />
              {candidate.party}
            </>
          ),
        }))}
      />
      {query.data.representativeTotal > 25 && (
        <div className="political-pagination">
          <button
            type="button"
            className="text-button"
            disabled={offset === 0}
            onClick={() => setOffset((o) => o - 25)}
          >
            Anterior
          </button>
          <span>
            {offset + 1}–{Math.min(offset + 25, query.data.representativeTotal)} de{' '}
            {count(query.data.representativeTotal)}
          </span>
          <button
            type="button"
            className="text-button"
            disabled={offset + 25 >= query.data.representativeTotal}
            onClick={() => setOffset((o) => o + 25)}
          >
            Próximos
          </button>
        </div>
      )}
    </>
  );
}
export function TerritoryPanel({
  code,
  selection,
  enabled,
  onClose,
  onDrillDown,
}: {
  code: string;
  selection: PoliticalSelection;
  enabled: boolean;
  onClose?: () => void;
  onDrillDown: (code: string, name: string) => void;
}) {
  const query = useDetail(code, selection, 0, enabled);
  const data = query.data;
  const representative = selection.category === 'representation';
  const summary = data?.summary;
  const showCandidateVotes =
    selection.category === 'elections' &&
    selection.metric !== 'leading_party' &&
    (data?.leaders.length ?? 0) > 1;
  const emphasizeLeader =
    showCandidateVotes && selection.metric === 'leading_candidate' && !summary?.candidateTie;
  return (
    <section className="panel-section territory-detail" aria-label="Resumo político do território">
      {onClose && (
        <header className="detail-header">
          <div>
            <p className="detail-kicker">
              {(data?.level ??
                (code.length === 7 ? 'municipality' : code === 'BR' ? 'country' : 'state')) ===
              'municipality'
                ? 'Município'
                : (data?.level ?? (code === 'BR' ? 'country' : 'state')) === 'state'
                  ? 'Estado'
                  : 'País'}
            </p>
            <h2 className="detail-title">{data?.name ?? 'Carregando…'}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Fechar seleção"
            onClick={onClose}
          >
            ×
          </button>
        </header>
      )}
      {query.error ? (
        <>
          <ErrorMessage error={query.error} />
          <button className="text-button" type="button" onClick={() => void query.refetch()}>
            Tentar novamente
          </button>
        </>
      ) : (
        <>
          {selection.category === 'participation' && (
            <p className="source-note">{officeLabel(selection.office)}</p>
          )}
          {!data ? (
            <p role="status">Carregando dados…</p>
          ) : !summary ? (
            <p className="featured-value is-missing">Sem dados para este território</p>
          ) : (
            <>
              {!emphasizeLeader && <PoliticalSummary data={data} selection={selection} />}
              {showCandidateVotes && (
                <CandidateVotes data={data} emphasizeLeader={emphasizeLeader} />
              )}
              {!representative && (
                <Disclosure title="Mais detalhes" className="territory-details">
                  <PoliticalStats
                    rows={[
                      { label: 'Eleitorado', value: count(summary.eligible) },
                      { label: 'Comparecimento', value: count(summary.turnout) },
                      { label: 'Abstenção', value: count(summary.abstention) },
                      { label: 'Votos válidos', value: count(summary.validVotes) },
                      { label: 'Brancos', value: count(summary.blankVotes) },
                      { label: 'Nulos', value: count(summary.nullVotes) },
                    ]}
                  />
                  {selection.category === 'elections' &&
                    selection.metric === 'leading_party' &&
                    data.leaders.length > 1 && (
                      <>
                        <p className="political-detail-label">Dois mais votados</p>
                        <PoliticalStats
                          rows={data.leaders.map((candidate) => ({
                            label: candidateName(candidate.name),
                            value: (
                              <>
                                <PartyDot party={candidate.party} />
                                {candidate.party} · {count(candidate.votes)}
                              </>
                            ),
                          }))}
                        />
                      </>
                    )}
                </Disclosure>
              )}
              {representative && (
                <Disclosure title="Ver eleitos">
                  <Representatives code={code} selection={selection} />
                </Disclosure>
              )}
            </>
          )}
          {data?.level === 'state' && (
            <DrillDownButton onClick={() => onDrillDown(code, data.name)} />
          )}
        </>
      )}
    </section>
  );
}
