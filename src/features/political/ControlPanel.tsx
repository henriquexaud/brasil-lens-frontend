import type {
  PoliticalMetric,
  PoliticalOffice,
  PoliticalRelease,
  PoliticalSelection,
} from '@/api/types';
import { SegmentedControl } from '@/components/SegmentedControl';
import { LayerMetadata } from '@/components/LayerMetadata';
import { Select } from '@/components/Select';
import { electionRefreshInterval } from './liveElection';
import { useElectionWindow } from './useElectionWindow';
import { isExecutive, latestSelection, METRICS, OFFICES, normalizeSelection } from './selection';

export function ControlPanel({
  selection,
  releases,
  onChange,
}: {
  selection: PoliticalSelection;
  releases: PoliticalRelease[];
  onChange: (s: PoliticalSelection) => void;
}) {
  const change = (patch: Partial<PoliticalSelection>) => {
    const next = { ...selection, ...patch };
    onChange(
      normalizeSelection(
        patch.office || patch.category ? latestSelection(next, releases) : next,
        releases,
      ),
    );
  };
  const window = useElectionWindow();
  const release = releases.find((r) => r.year === selection.year);
  const rounds = release?.contests.find((c) => c.office === selection.office)?.rounds ?? [];
  const years = releases
    .filter(
      (r) =>
        selection.category === 'participation' ||
        r.contests.some((c) => c.office === selection.office),
    )
    .sort((a, b) => b.year - a.year);
  const office = OFFICES.find((o) => o.value === selection.office);
  const branch = isExecutive(selection.office) ? 'executive' : 'legislative';
  const participationGroup = ['blank_votes', 'null_votes', 'invalid_votes'].includes(
    selection.metric,
  )
    ? 'invalid_votes'
    : selection.metric;
  const groups = [...new Set(OFFICES.map((o) => o.group))];
  return (
    <section className="indicator-controls" aria-label="Dados políticos">
      <SegmentedControl
        className="indicator-segmented-control"
        label="Categoria política"
        value={selection.category}
        options={[
          { value: 'elections', label: 'Eleições' },
          { value: 'representation', label: 'Cargos' },
          { value: 'participation', label: 'Participação' },
        ]}
        onChange={(value) => {
          if (value) change({ category: value as PoliticalSelection['category'] });
        }}
      />
      <div className="indicator-pills-row" role="group" aria-label="Subcategoria política">
        {selection.category === 'elections' &&
          groups.map((group) => (
            <button
              key={group}
              type="button"
              className={`indicator-pill-btn ${office?.group === group ? 'is-active' : ''}`}
              aria-pressed={office?.group === group}
              onClick={() => {
                const target = OFFICES.find((o) => o.group === group)!;
                change({
                  office: target.value,
                  metric: isExecutive(target.value) ? 'leading_candidate' : 'leading_party',
                });
              }}
            >
              {group}
            </button>
          ))}
        {selection.category === 'representation' &&
          [
            { value: 'executive', label: 'Executivo' },
            { value: 'legislative', label: 'Legislativo' },
          ].map((b) => (
            <button
              type="button"
              key={b.value}
              className={`indicator-pill-btn ${branch === b.value ? 'is-active' : ''}`}
              aria-pressed={branch === b.value}
              onClick={() => change({ office: b.value === 'executive' ? 'president' : 'senator' })}
            >
              {b.label}
            </button>
          ))}
        {selection.category === 'participation' &&
          METRICS.filter((m) => ['turnout', 'abstention', 'invalid_votes'].includes(m.value)).map(
            (m) => (
              <button
                type="button"
                key={m.value}
                className={`indicator-pill-btn ${participationGroup === m.value ? 'is-active' : ''}`}
                aria-pressed={participationGroup === m.value}
                onClick={() => change({ metric: m.value })}
              >
                {m.label}
              </button>
            ),
          )}
      </div>
      <div className="political-options">
        {(selection.category === 'representation' || office?.group === 'Deputados') &&
          selection.category !== 'participation' && (
            <Select
              id="political-office"
              label="Cargo"
              hideLabel
              value={selection.office}
              options={OFFICES.filter((o) =>
                selection.category === 'representation'
                  ? isExecutive(o.value) === (branch === 'executive')
                  : o.group === 'Deputados',
              )}
              onChange={(value) => change({ office: value as PoliticalOffice })}
            />
          )}
        {selection.category === 'elections' && (
          <Select
            id="political-metric"
            label="Visualização"
            hideLabel
            value={selection.metric}
            options={METRICS.slice(0, 4)}
            onChange={(value) => change({ metric: value as PoliticalMetric })}
          />
        )}
        {selection.category === 'participation' && participationGroup === 'invalid_votes' && (
          <Select
            id="political-invalid"
            label="Visualização de votos inválidos"
            hideLabel
            value={selection.metric}
            options={METRICS.filter((m) =>
              ['invalid_votes', 'blank_votes', 'null_votes'].includes(m.value),
            )}
            onChange={(value) => change({ metric: value as PoliticalMetric })}
          />
        )}
      </div>
      <LayerMetadata
        sources={[
          {
            label: 'TSE',
            description: `${release?.note ?? 'Dados oficiais do Tribunal Superior Eleitoral.'}${release?.status === 'partial' ? ' Resultado parcial.' : ''}${release?.updatedAt ? ` Publicação: ${new Date(release.updatedAt).toLocaleString('pt-BR')}.` : ''}`,
          },
        ]}
        unit={
          selection.category === 'participation'
            ? ['turnout', 'abstention'].includes(selection.metric)
              ? '% do eleitorado'
              : '% dos votos'
            : undefined
        }
      >
        <div className="political-period">
          <select
            className="indicator-year-select"
            disabled={!years.length}
            aria-label="Ano da eleição"
            value={selection.year}
            onChange={(event) => change({ year: Number(event.target.value) })}
          >
            {years.map((r) => (
              <option key={r.year} value={r.year}>
                {r.year}
              </option>
            ))}
          </select>
          {selection.category !== 'representation' && rounds.length > 0 && (
            <select
              className="indicator-year-select"
              aria-label="Turno"
              value={selection.round}
              onChange={(event) => change({ round: Number(event.target.value) })}
            >
              {rounds.map((round) => (
                <option key={round} value={round}>
                  {round}º turno
                </option>
              ))}
            </select>
          )}
        </div>
      </LayerMetadata>
      {electionRefreshInterval(window, selection, release?.status) && release && (
        <p className="source-note" role="status">
          Parcial · em andamento
          {release.updatedAt &&
            ` · ${new Date(release.updatedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
        </p>
      )}
    </section>
  );
}
