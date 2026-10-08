import { useState } from 'react';
import type { PoliticalSelection } from '@/api/types';
import { ErrorMessage } from '@/components/Feedback';
import { Disclosure } from '@/components/Disclosure';
import { DrillDownButton } from '@/components/DrillDownButton';
import { useDetail } from './queries';
import { officeLabel } from './selection';
import { candidateName, partyColor } from './presentation';

const count = (value: number | null | undefined) =>
  value == null ? 'Sem dados' : value.toLocaleString('pt-BR');
function PartyDot({ party }: { party: string }) {
  return (
    <span
      className="political-party-dot"
      style={{ backgroundColor: partyColor(party) }}
      aria-hidden="true"
    />
  );
}
function Representatives({ code, selection }: { code: string; selection: PoliticalSelection }) {
  const [offset, setOffset] = useState(0);
  const query = useDetail(code, selection, offset);
  if (query.error) return <ErrorMessage error={query.error} />;
  if (!query.data) return <p role="status">Carregando eleitos…</p>;
  return (
    <>
      <dl className="indicator-list">
        {query.data.representatives.map((candidate) => (
          <div key={candidate.id} className="indicator-row">
            <dt className="indicator-label">{candidateName(candidate.name)}</dt>
            <dd className="indicator-value">
              <PartyDot party={candidate.party} />
              {candidate.party} · {candidate.number}
            </dd>
          </div>
        ))}
      </dl>
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
  const leadingParty = selection.metric === 'leading_party';
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
          <p className="source-note">
            {officeLabel(selection.office)} · {selection.year}
            {representative ? ' · Eleitos no pleito' : ` · ${selection.round}º turno`}
          </p>
          {!data ? (
            <p role="status">Carregando dados…</p>
          ) : !summary ? (
            <p className="featured-value is-missing">Sem dados para este território</p>
          ) : (
            <>
              {(selection.category === 'elections' ||
                (representative && data.leaders.length === 1)) && (
                <div className="featured-indicator">
                  <p className="detail-kicker">
                    {representative
                      ? 'Eleito no pleito'
                      : leadingParty
                        ? 'Partido mais votado'
                        : summary.candidateTie
                          ? 'Empate entre os mais votados'
                          : 'Mais votado no recorte'}
                  </p>
                  <p className="featured-value">
                    {leadingParty
                      ? summary.partyTie
                        ? 'Empate'
                        : (summary.party ?? 'Sem dados')
                      : !representative && summary.candidateTie
                        ? 'Empate'
                        : data.leaders[0]
                          ? candidateName(data.leaders[0].name)
                          : 'Resultado municipal'}
                  </p>
                  <p className="source-note">
                    {leadingParty && summary.party && <PartyDot party={summary.party} />}
                    {!leadingParty && data.leaders[0] && <PartyDot party={data.leaders[0].party} />}
                    {leadingParty
                      ? `${count(summary.partyVotes)} votos`
                      : data.leaders[0]
                        ? representative
                          ? `${data.leaders[0].party} · ${data.leaders[0].number}`
                          : `${data.leaders[0].party} · ${count(data.leaders[0].votes)} votos`
                        : 'Candidatos concorrem em circunscrições diferentes. Consulte um município.'}
                  </p>
                </div>
              )}
              <dl className="indicator-list">
                {(representative
                  ? [
                      ['Eleitos no pleito', summary.representatives],
                      [
                        `${summary.partyTie ? 'Empate · ' : ''}${summary.party ?? 'Partido'} · eleitos`,
                        summary.partySeats,
                      ],
                    ]
                  : [
                      ['Eleitorado', summary.eligible],
                      ['Comparecimento', summary.turnout],
                      ['Abstenção', summary.abstention],
                      ['Votos válidos', summary.validVotes],
                      ['Brancos', summary.blankVotes],
                      ['Nulos', summary.nullVotes],
                    ]
                ).map(([label, value]) => (
                  <div className="indicator-row" key={String(label)}>
                    <dt className="indicator-label">{label}</dt>
                    <dd className="indicator-value">{count(value as number | null | undefined)}</dd>
                  </div>
                ))}
              </dl>
              {representative && (
                <Disclosure title="Ver eleitos">
                  <Representatives code={code} selection={selection} />
                </Disclosure>
              )}
              {!representative && data.leaders.length > 1 && (
                <Disclosure title="Mais votados">
                  <p className="source-note">Dois candidatos mais votados neste recorte.</p>
                  <dl className="indicator-list">
                    {data.leaders.map((candidate) => (
                      <div className="indicator-row" key={candidate.id}>
                        <dt className="indicator-label">
                          {candidateName(candidate.name)} · {candidate.party}
                        </dt>
                        <dd className="indicator-value">
                          <PartyDot party={candidate.party} />
                          {count(candidate.votes)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </Disclosure>
              )}
            </>
          )}
          <Disclosure title="Sobre estes dados">
            <p className="source-note">{data?.note}</p>
            <p className="source-note">
              Percentuais de comparecimento e abstenção usam o eleitorado; brancos e nulos usam o
              total de votos do cargo. Percentual do líder e margem usam votos válidos. Para o
              Senado em 2026, cada eleitor pode dar dois votos. As divisas são as da malha atual do
              IBGE.
            </p>
            {representative && (
              <p className="source-note">
                Cargos estaduais representam a UF; Presidência representa o país. No município, são
                mostrados os eleitos da sua circunscrição. Senado inclui apenas as vagas disputadas
                neste pleito.
              </p>
            )}
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
