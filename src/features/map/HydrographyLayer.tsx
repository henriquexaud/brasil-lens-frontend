/** Hidrografia auxiliar: geometria simplificada por escala e nenhum bloqueio da navegação. */
import type { Feature, Geometry } from 'geojson';
import type { Layer, LeafletMouseEvent } from 'leaflet';
import { useCallback } from 'react';
import { GeoJSON, Pane } from 'react-leaflet';
import type { HydroFeatureCollection, HydroFeatureProperties } from '@/api/types';
import { formatDrainageArea, getHydroStyle } from './hydroStyles';

export function HydrographyLayer({
  collection,
  fireActive = false,
  zoom = 4,
}: {
  collection: HydroFeatureCollection | undefined;
  fireActive?: boolean;
  zoom?: number;
}) {
  const onEachFeature = useCallback(
    (feature: Feature<Geometry, HydroFeatureProperties>, layer: Layer) => {
      const props = feature.properties;
      const el = document.createElement('div');
      el.className = 'hydro-tooltip-content';
      const add = (className: string, text: string) => {
        const span = document.createElement('span');
        span.className = className;
        span.textContent = text;
        el.appendChild(span);
      };
      add('tooltip-name', props.name);
      const isRiver = props.category === 'river';
      add(
        'tooltip-meta',
        isRiver ? 'Curso d’água · ANA' : `${props.bodyType ?? 'Corpo d’água'} · ANA`,
      );
      const area = formatDrainageArea(isRiver ? props.drainageAreaKm2 : (props.areaKm2 ?? null));
      if (area) add('tooltip-meta', `${isRiver ? 'Bacia a montante' : 'Área'}: ${area} km²`);
      const forward = (event: LeafletMouseEvent) => {
        const original = event.originalEvent;
        if (!original || !document.elementsFromPoint) return;
        const territory = document
          .elementsFromPoint(original.clientX, original.clientY)
          .find((element) => element.classList.contains('territory-shape'));
        territory?.dispatchEvent(new MouseEvent(event.type, original));
      };
      layer.on({
        mousedown: (event: LeafletMouseEvent) => event.originalEvent?.preventDefault(),
        click: forward,
        dblclick: forward,
      });
      layer.bindTooltip(el, {
        sticky: true,
        className: 'map-tooltip hydro-tooltip',
        direction: 'top',
      });
    },
    [],
  );
  if (!collection?.features.length) return null;
  const interactive = zoom >= 8 && !fireActive;
  return (
    <Pane name="hydrography" style={{ zIndex: 425, pointerEvents: interactive ? 'auto' : 'none' }}>
      <GeoJSON
        key={`${collection.metadata.level}:${collection.metadata.parentCode}:${collection.bbox}:${zoom}:${interactive}:${collection.features.map((f) => f.id).join(',')}`}
        data={collection}
        interactive={interactive}
        style={(feature) =>
          getHydroStyle(feature!.properties as HydroFeatureProperties, fireActive)
        }
        onEachFeature={interactive ? onEachFeature : undefined}
      />
    </Pane>
  );
}
