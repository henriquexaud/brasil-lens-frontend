import type { PlaceCatalog, PlaceLayerInfo } from '@/api/types';
import { LayerMetadata } from '@/components/LayerMetadata';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Select } from '@/components/Select';
import { formatCount, type PlaceTab } from './places';

// Até aqui as categorias cabem em botões; acima, viram uma lista.
const MAX_PILLS = 3;

export function PlacesControls({
  tabs,
  tab,
  onTab,
  layer,
  category,
  onCategory,
  catalog,
}: {
  tabs: PlaceTab[];
  tab: PlaceTab;
  onTab: (key: string) => void;
  layer?: PlaceLayerInfo;
  category: string | null;
  onCategory: (category: string | null) => void;
  catalog?: PlaceCatalog;
}) {
  const categories = tab.species ? [] : (layer?.categories ?? []);
  const source = catalog?.sources.find((item) => item.key === layer?.source);
  return (
    <section className="panel-section indicator-controls" aria-label={tab.title}>
      {tabs.length > 1 && (
        <SegmentedControl
          className="indicator-segmented-control"
          label="Camadas"
          value={tab.key}
          options={tabs.map((item) => ({ value: item.key, label: item.label }))}
          onChange={(value) => value && onTab(value)}
        />
      )}
      {categories.length > 1 && categories.length <= MAX_PILLS && (
        <div className="indicator-pills-row" role="group" aria-label={`Filtro de ${tab.many}`}>
          {[{ key: null, label: tab.all }, ...categories].map((option) => {
            const active = option.key === category;
            return (
              <button
                key={option.key ?? 'all'}
                type="button"
                className={`indicator-pill-btn ${active ? 'is-active' : ''}`}
                aria-pressed={active}
                onClick={() => onCategory(option.key)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
      {categories.length > MAX_PILLS && (
        <div className="places-category">
          <Select
            id={`places-category-${tab.key}`}
            label={`Filtro de ${tab.many}`}
            hideLabel
            value={category ?? ''}
            options={[
              { value: '', label: tab.all },
              ...categories.map((item) => ({
                value: item.key,
                label: `${item.label} · ${formatCount(item.count)}`,
              })),
            ]}
            onChange={(value) => onCategory(value || null)}
          />
        </div>
      )}
      <LayerMetadata
        sources={source ? [{ label: source.label, description: source.description }] : []}
        unit={tab.species ? 'limites' : layer?.hasShapes ? 'áreas' : 'locais'}
      >
        <span className="indicator-year-label">{source?.edition ?? ''}</span>
      </LayerMetadata>
    </section>
  );
}
