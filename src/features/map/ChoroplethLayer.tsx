/** GeoJSON from the API; interaction changes presentation only. */
import type { Feature, Geometry } from 'geojson';
import { Path, type GeoJSON as LeafletGeoJSON, type PathOptions } from 'leaflet';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { GeoJSON } from 'react-leaflet';

import type { MapFeatureCollection, MapFeatureProperties } from '@/api/types';
import { formatValue } from '@/lib/format';

import { BORDER_COLOR, HOVER_COLOR, SELECTED_COLOR, colorForClass } from './colors';

interface Props {
  collection: MapFeatureCollection;
  onSelect: (ibgeCode: string) => void;
  onHover?: (ibgeCode: string) => void;
  selectedCode: string | null;
}

type TerritoryFeature = Feature<Geometry, MapFeatureProperties>;

// textContent keeps API names and units as text, including accents and symbols.
function tooltipContent(properties: MapFeatureProperties, collection: MapFeatureCollection) {
  const content = document.createElement('div');
  const add = (className: string, text: string) => {
    const line = document.createElement('span');
    line.className = className;
    line.textContent = text;
    content.append(line);
  };
  add('tooltip-name', properties.name);
  if (properties.parentName) add('tooltip-meta', properties.parentName);
  if (collection.indicator) {
    const { unit, decimalPlaces } = collection.indicator;
    add(
      properties.value === null ? 'tooltip-value is-missing' : 'tooltip-value',
      formatValue(properties.value, unit, decimalPlaces),
    );
  }
  return content;
}

export function ChoroplethLayer(props: Props) {
  const { collection } = props;
  const layerKey = [
    collection.scope.level,
    collection.scope.parent ?? 'root',
    collection.indicator?.key ?? 'none',
    collection.indicator?.year ?? 'none',
  ].join(':');

  return <Territories key={layerKey} {...props} />;
}

function Territories({ collection, onSelect, onHover, selectedCode }: Props) {
  const layerRef = useRef<LeafletGeoJSON>(null);
  const municipal = collection.scope.level === 'municipality';
  const selectedFeature = useMemo(
    () => collection.features.find((feature) => feature.properties.ibgeCode === selectedCode),
    [collection, selectedCode],
  );

  const style = useCallback(
    (feature?: TerritoryFeature): PathOptions => ({
      color: BORDER_COLOR,
      weight: municipal ? 0.4 : 0.75,
      opacity: municipal ? 0.55 : 0.8,
      fillOpacity: feature?.properties.classIndex == null ? 0.35 : 0.68,
      fillColor: colorForClass(feature?.properties.classIndex ?? null, collection.classification),
      className: 'territory-shape',
    }),
    [collection, municipal],
  );

  // Rebind native events when selection changes: GeoJSON's onEachFeature only
  // runs on creation and otherwise captures a stale selectedCode in its closure.
  useEffect(() => {
    const cleanups: Array<() => void> = [];
    layerRef.current?.eachLayer((layer) => {
      if (!(layer instanceof Path)) return;
      const feature = (layer as Path & { feature: TerritoryFeature }).feature;
      const properties = feature.properties;
      const selected = properties.ibgeCode === selectedCode;
      layer.bindTooltip(tooltipContent(properties, collection), {
        sticky: true,
        className: 'map-tooltip',
        offset: [12, 0],
        opacity: 1,
      });
      const enter = () => {
        if (!selected)
          layer.setStyle({ color: HOVER_COLOR, weight: municipal ? 1.2 : 1.5, opacity: 0.9 });
        onHover?.(properties.ibgeCode);
      };
      const leave = () => layer.setStyle(style(feature));
      const click = () => onSelect(properties.ibgeCode);
      const focus = () => {
        enter();
        layer.openTooltip();
      };
      const blur = () => {
        leave();
        layer.closeTooltip();
      };
      const keydown = (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          click();
        }
      };
      const element = layer.getElement();
      element?.setAttribute('tabindex', '0');
      element?.setAttribute('role', 'button');
      element?.setAttribute('aria-label', properties.name);
      element?.setAttribute('aria-pressed', String(selected));
      element?.addEventListener('focus', focus);
      element?.addEventListener('blur', blur);
      element?.addEventListener('keydown', keydown as EventListener);
      // Do not reorder the interactive SVG on hover: it can cancel the click.
      layer.on({ mouseover: enter, mouseout: leave, click });
      cleanups.push(() => {
        layer.off({ mouseover: enter, mouseout: leave, click });
        layer.unbindTooltip();
        element?.removeEventListener('focus', focus);
        element?.removeEventListener('blur', blur);
        element?.removeEventListener('keydown', keydown as EventListener);
      });
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [collection, onHover, onSelect, selectedCode, style, municipal]);

  return (
    <>
      <GeoJSON ref={layerRef} data={collection} style={style} />
      {selectedFeature && (
        <>
          <GeoJSON
            key={`${selectedCode}:halo`}
            data={selectedFeature}
            pane="territory-selection"
            interactive={false}
            style={{ fill: false, color: '#ffffff', weight: 4.5, opacity: 0.8 }}
          />
          <GeoJSON
            key={`${selectedCode}:outline`}
            data={selectedFeature}
            pane="territory-selection"
            interactive={false}
            style={{ fill: false, color: SELECTED_COLOR, weight: 1.8, opacity: 0.95 }}
          />
        </>
      )}
    </>
  );
}
