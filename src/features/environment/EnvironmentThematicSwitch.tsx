import type { FireHotspotCollection } from '@/api/types';
import { LayerMetadata } from '@/components/LayerMetadata';
import { SegmentedControl } from '@/components/SegmentedControl';
import { FireMetadata } from '@/features/fire/FireMetadata';
import type { EnvironmentLayer } from '@/lib/sessionStorage';
import { INDICATOR_LAYERS } from './layers';

// Do estoque para a perda: Florestas, a Perda anual (PRODES), os Alertas recentes (DETER) e o Fogo.
const OPTIONS: { value: EnvironmentLayer; label: string }[] = [
  { value: 'forest', label: INDICATOR_LAYERS.forest.label },
  { value: 'deforestation', label: INDICATOR_LAYERS.deforestation.label },
  { value: 'alerts', label: INDICATOR_LAYERS.alerts.label },
  { value: 'fire', label: 'Fogo' },
];

export function EnvironmentThematicSwitch({
  layer,
  onChange,
  years,
  year,
  onYearChange,
  resolvedYear,
  fireHotspots,
  fireLoading,
  fireError,
  scopeName,
  alertsLabel,
  onIntent,
}: {
  layer: EnvironmentLayer;
  onChange: (layer: EnvironmentLayer) => void;
  onIntent?: (layer: EnvironmentLayer) => void;
  years: number[];
  year: string;
  onYearChange: (year: string) => void;
  resolvedYear: number | null;
  fireHotspots?: FireHotspotCollection;
  fireLoading: boolean;
  fireError: boolean;
  scopeName?: string;
  // "14 dias até 16/10/2026": a janela dos alertas, no lugar do seletor de ano.
  alertsLabel?: string;
}) {
  const indicator =
    layer === 'deforestation' || layer === 'alerts' || layer === 'forest'
      ? INDICATOR_LAYERS[layer]
      : null;
  const latest = years.length ? Math.max(...years) : resolvedYear;
  const latestLabel = latest ? `${latest} · Último` : 'Último disponível';
  return (
    <div className="weather-thematic-selector">
      <SegmentedControl
        label="Visualização temática do mapa"
        options={OPTIONS.map((option) => ({ ...option, onIntent: () => onIntent?.(option.value) }))}
        value={layer === 'none' ? null : layer}
        allowDeselect
        onChange={(value) => onChange((value as EnvironmentLayer | null) ?? 'none')}
      />
      {indicator && (
        <LayerMetadata sources={[indicator.source]} unit={indicator.unit}>
          {layer === 'alerts' ? (
            <span className="indicator-year-label">{alertsLabel ?? 'Carregando…'}</span>
          ) : years.length > 1 ? (
            <select
              className="indicator-year-select"
              aria-label="Ano de referência"
              value={year}
              onChange={(event) => onYearChange(event.target.value)}
            >
              <option value="latest">{latestLabel}</option>
              {[...years]
                .sort((a, b) => b - a)
                .map((item) => (
                  <option key={item} value={String(item)}>
                    {item}
                  </option>
                ))}
            </select>
          ) : (
            <span className="indicator-year-label">
              {years.length ? latestLabel : 'Carregando…'}
            </span>
          )}
        </LayerMetadata>
      )}
      {layer === 'fire' && (
        <FireMetadata
          fireHotspots={fireHotspots}
          loading={fireLoading}
          error={fireError}
          scopeName={scopeName}
        />
      )}
    </div>
  );
}
