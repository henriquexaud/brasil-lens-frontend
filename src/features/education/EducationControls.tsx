import type { EducationNetwork, Indicator } from '@/api/types';
import { LayerMetadata } from '@/components/LayerMetadata';
import { SegmentedControl } from '@/components/SegmentedControl';
import { NETWORK_OPTIONS, type EducationPreferences } from './education';

export function EducationControls({
  preferences,
  onChange,
  indicator,
}: {
  preferences: EducationPreferences;
  onChange: (next: EducationPreferences) => void;
  indicator?: Indicator;
}) {
  const years = indicator?.availableYears ?? [];
  const latestLabel = indicator?.latestYear
    ? `${indicator.latestYear} · Último`
    : 'Último disponível';
  return (
    <section className="panel-section indicator-controls" aria-label="Rede de ensino no mapa">
      <SegmentedControl
        className="indicator-segmented-control"
        label="Redes de ensino superior"
        value={preferences.network}
        options={NETWORK_OPTIONS}
        onChange={(value) => onChange({ ...preferences, network: value as EducationNetwork })}
      />
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
