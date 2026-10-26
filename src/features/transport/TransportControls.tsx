import type { TransportCatalog } from '@/api/types';
import { LayerMetadata } from '@/components/LayerMetadata';
import { SegmentedControl } from '@/components/SegmentedControl';
import {
  ROAD_OPTIONS,
  TAB_OPTIONS,
  lineLayer,
  type TransportPreferences,
  type TransportTab,
} from './layers';

export function TransportControls({
  preferences,
  onChange,
  catalog,
  zoom,
}: {
  preferences: TransportPreferences;
  onChange: (next: TransportPreferences) => void;
  catalog?: TransportCatalog;
  zoom: number;
}) {
  const layer = lineLayer(preferences);
  const info = catalog?.layers.find((item) => item.key === layer);
  const source = catalog?.sources.find((item) => item.key === info?.source);
  const hidden = info !== undefined && zoom < info.minZoom;
  return (
    <section className="panel-section indicator-controls" aria-label="Malha de transporte">
      <SegmentedControl
        className="indicator-segmented-control"
        label="Modos de transporte"
        value={preferences.tab}
        options={TAB_OPTIONS}
        onChange={(value) => onChange({ ...preferences, tab: value as TransportTab })}
      />
      {preferences.tab === 'roads' && (
        <div className="indicator-pills-row" role="group" aria-label="Tipos de rodovia">
          {ROAD_OPTIONS.map((option) => {
            const active = option.value === preferences.roads;
            return (
              <button
                key={option.value}
                type="button"
                className={`indicator-pill-btn ${active ? 'is-active' : ''}`}
                aria-pressed={active}
                title={option.title}
                onClick={() => onChange({ ...preferences, roads: option.value })}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
      <LayerMetadata
        sources={[
          {
            label: source?.label ?? (info?.source === 'dnit' ? 'DNIT' : 'IBGE'),
            description: source?.description,
          },
        ]}
        unit="traçado"
      >
        <span className="indicator-year-label">
          {hidden ? 'Aproxime o mapa' : (source?.edition ?? '')}
        </span>
      </LayerMetadata>
    </section>
  );
}
