import type { EducationKind, EducationNetwork, Indicator } from '@/api/types';
import { LayerMetadata } from '@/components/LayerMetadata';
import { SegmentedControl } from '@/components/SegmentedControl';
import {
  KIND_OPTIONS,
  NETWORK_OPTIONS,
  indicatorKey,
  type EducationPreferences,
} from './education';

export function EducationControls({
  preferences,
  onChange,
  indicators,
}: {
  preferences: EducationPreferences;
  onChange: (next: EducationPreferences) => void;
  indicators?: Indicator[];
}) {
  const find = (network: EducationNetwork, kind: EducationKind) =>
    indicators?.find((item) => item.key === indicatorKey(network, kind));
  const indicator = find(preferences.network, preferences.kind);
  // Só aparece o tipo que a rede tem: não há instituto estadual nem municipal.
  const kinds = KIND_OPTIONS.filter(
    (option) => option.value === 'all' || find(preferences.network, option.value)?.latestYear,
  );
  const years = indicator?.availableYears ?? [];
  const latestLabel = indicator?.latestYear
    ? `${indicator.latestYear} · Último`
    : 'Último disponível';
  return (
    <section className="panel-section indicator-controls" aria-label="Rede de ensino no mapa">
      <SegmentedControl
        className="indicator-segmented-control"
        label="Redes públicas de ensino superior"
        value={preferences.network}
        options={NETWORK_OPTIONS}
        onChange={(value) => {
          const network = value as EducationNetwork;
          const kind = find(network, preferences.kind)?.latestYear ? preferences.kind : 'all';
          onChange({ ...preferences, network, kind });
        }}
      />
      {kinds.length > 2 && (
        <div className="indicator-pills-row" role="group" aria-label="Tipo de instituição">
          {kinds.map((option) => {
            const active = option.value === preferences.kind;
            return (
              <button
                key={option.value}
                type="button"
                className={`indicator-pill-btn ${active ? 'is-active' : ''}`}
                aria-pressed={active}
                title={option.title}
                onClick={() => onChange({ ...preferences, kind: option.value })}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
      <LayerMetadata
        sources={[{ label: 'INEP', description: indicator?.description ?? undefined }]}
        unit="matrículas presenciais"
      >
        {years.length > 1 ? (
          <select
            id="year"
            className="indicator-year-select"
            aria-label="Ano do Censo"
            value={preferences.year}
            onChange={(event) => onChange({ ...preferences, year: event.target.value })}
          >
            <option value="latest">{latestLabel}</option>
            {[...years]
              .sort((a, b) => b - a)
              .map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
          </select>
        ) : (
          <span className="indicator-year-label">{years.length ? latestLabel : 'Sem dados'}</span>
        )}
      </LayerMetadata>
    </section>
  );
}
