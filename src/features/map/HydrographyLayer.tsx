import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { GeoJSON as LeafletGeoJSON, Polyline, type Layer, type LeafletMouseEvent } from 'leaflet';
import { useCallback, useEffect, useRef } from 'react';
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
  const layerRef = useRef<LeafletGeoJSON>(null);
  const renderedCollection = useRef(collection);
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

  useEffect(() => {
    const group = layerRef.current;
    if (!group || !collection || renderedCollection.current === collection) return;

    const remaining = new Map(collection.features.map((feature) => [String(feature.id), feature]));
    group.eachLayer((layer) => {
      const current = (layer as Layer & { feature?: Feature<Geometry, HydroFeatureProperties> })
        .feature;
      const next = current && remaining.get(String(current.id));
      if (!next) {
        group.removeLayer(layer);
        return;
      }
      remaining.delete(String(current.id));
      const nextLayer = LeafletGeoJSON.geometryToLayer(next);
      if (layer instanceof Polyline && nextLayer instanceof Polyline) {
        layer.setLatLngs(nextLayer.getLatLngs());
        layer.feature = next;
        layer.setStyle(getHydroStyle(next.properties, fireActive));
      } else {
        group.removeLayer(layer);
        remaining.set(String(next.id), next);
      }
    });
    group.addData({
      type: 'FeatureCollection',
      features: [...remaining.values()],
    } as FeatureCollection<Geometry, HydroFeatureProperties>);
    renderedCollection.current = collection;
  }, [collection, fireActive]);

  if (!collection?.features.length) return null;
  const interactive = zoom >= 8 && !fireActive;
  return (
    <Pane name="hydrography" style={{ zIndex: 425, pointerEvents: interactive ? 'auto' : 'none' }}>
      <GeoJSON
        ref={layerRef}
        data={collection}
        interactive
        style={(feature) =>
          getHydroStyle(feature!.properties as HydroFeatureProperties, fireActive)
        }
        onEachFeature={onEachFeature}
      />
    </Pane>
  );
}
