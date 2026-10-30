import type { TransportCatalog } from '@/api/types';
import { LayerMetadata, type DataSource } from '@/components/LayerMetadata';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ROAD_OPTIONS, TAB_OPTIONS, type TransportPreferences, type TransportTab } from './layers';

export function TransportControls({
  preferences,
  onChange,
  catalog,
  onWaterwaysIntent,
}: {
  preferences: TransportPreferences;
  onChange: (next: TransportPreferences) => void;
  catalog?: TransportCatalog;
  onWaterwaysIntent?: () => void;
}) {
  const source = (key: 'osm' | 'ibge'): DataSource | null => {
    const item = catalog?.sources.find((entry) => entry.key === key);
    return item
      ? { label: key === 'osm' ? 'OSM' : item.label, description: item.description }
      : null;
  };
  // O traçado de vias e trilhos é do OpenStreetMap; hidrovias e portos, do IBGE.
  const map = preferences.tab === 'waterways' ? source('ibge') : source('osm');
  const edition = catalog?.sources.find(
    (entry) => entry.key === (preferences.tab === 'waterways' ? 'ibge' : 'osm'),
  )?.edition;
  return (
    <section className="panel-section indicator-controls" aria-label="Malha de transporte">
      <SegmentedControl
        className="indicator-segmented-control"
        label="Modos de transporte"
        value={preferences.tab}
        options={TAB_OPTIONS.map((option) =>
          option.value === 'waterways' ? { ...option, onIntent: onWaterwaysIntent } : option,
        )}
        onChange={(value) => onChange({ ...preferences, tab: value as TransportTab })}
      />
      {preferences.tab === 'roads' && (
        <div className="indicator-pills-row" role="group" aria-label="Rodovias no mapa">
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
      <LayerMetadata sources={map ? [map] : []} unit="traçado">
        <span className="indicator-year-label">{edition ?? ''}</span>
      </LayerMetadata>
    </section>
  );
}
