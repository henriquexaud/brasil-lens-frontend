import { useState } from 'react';
import type { PoliticalSelection } from '@/api/types';
import { ErrorMessage } from '@/components/Feedback';
import { Disclosure } from '@/components/Disclosure';
import { DrillDownButton } from '@/components/DrillDownButton';
import { useDetail } from './queries';
import { officeLabel } from './selection';
import { candidateName } from './presentation';
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
  return (
    <section className="panel-section territory-detail" aria-label="Resumo político do território">
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
        {onClose && (
          <button
            type="button"
            className="icon-button"
            aria-label="Fechar seleção"
            onClick={onClose}
          >
            ×
          </button>
        )}
      </header>
      {query.error ? (
        <>
          <ErrorMessage error={query.error} />
          <button className="text-button" type="button" onClick={() => void query.refetch()}>
            Tentar novamente
          </button>
        </>
      ) : (
        <>
          <p className="source-note">{officeLabel(selection.office)}</p>
          {!data ? (
            <p role="status">Carregando dados…</p>
          ) : !summary ? (
            <p className="featured-value is-missing">Sem dados para este território</p>
          ) : (
            <>
              <PoliticalSummary data={data} selection={selection} />
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
                  {selection.category === 'elections' && data.leaders.length > 1 && (
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
          <Disclosure title="Sobre estes dados">
            <p className="source-note">{data?.note}</p>
            <p className="source-note">
              {representative
                ? 'Eleitos neste pleito na circunscrição do território. Presidência representa o país; cargos estaduais representam a UF. Senado inclui somente as vagas disputadas.'
                : selection.category === 'participation'
                  ? ['turnout', 'abstention'].includes(selection.metric)
                    ? 'Percentual calculado sobre o eleitorado.'
                    : 'Percentual calculado sobre o total de votos do cargo.'
                  : 'Percentual do líder e margem calculados sobre os votos válidos. São mostrados os dois candidatos mais votados do recorte.'}
            </p>
            {selection.office === 'senator' && selection.year === 2026 && !representative && (
              <p className="source-note">
                Cada eleitor pode dar dois votos para o Senado neste pleito.
              </p>
            )}
            <p className="source-note">Divisas da malha atual do IBGE.</p>
            {data?.updatedAt && (
              <p className="source-note">
                Publicação do TSE: {new Date(data.updatedAt).toLocaleString('pt-BR')}
              </p>
            )}
          </Disclosure>
          {data?.level === 'state' && (
            <DrillDownButton onClick={() => onDrillDown(code, data.name)} />
          )}
        </>
      )}
    </section>
  );
}
