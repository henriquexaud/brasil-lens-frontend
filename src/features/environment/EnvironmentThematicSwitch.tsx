import { Listbox } from '@/components/Listbox';
import type { FireHotspotCollection } from '@/api/types';
import { LayerMetadata } from '@/components/LayerMetadata';
import { SegmentedControl } from '@/components/SegmentedControl';
import { FireMetadata } from '@/features/fire/FireMetadata';
import type { EnvironmentLayer } from '@/lib/sessionStorage';
import { INDICATOR_LAYERS } from './layers';

// Do estoque para a perda: Florestas, a Perda (desmatamento) e o Fogo.
const OPTIONS: { value: EnvironmentLayer; label: string }[] = [
  { value: 'forest', label: INDICATOR_LAYERS.forest.label },
  { value: 'deforestation', label: INDICATOR_LAYERS.deforestation.label },
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
}) {
  const indicator =
    layer === 'deforestation' || layer === 'forest' ? INDICATOR_LAYERS[layer] : null;
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
          {years.length > 1 ? (
            <Listbox
              variant="inline"
              label="Ano de referência"
              value={String(year)}
              options={[
                { value: 'latest', label: latestLabel },
                ...[...years]
                  .sort((a, b) => b - a)
                  .map((item) => ({ value: String(item), label: String(item) })),
              ]}
              onChange={(next) => onYearChange(next)}
            />
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
