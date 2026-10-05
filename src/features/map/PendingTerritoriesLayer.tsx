import { GeoJSON as LeafletGeoJSON, type Path, type PolylineOptions } from 'leaflet';
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

import type { MapFeature } from '@/api/types';

const PANE = 'territory-pending';

type PendingPath = Path & { feature?: MapFeature };

// Skeleton dos territórios que ainda esperam o dado da camada. Fica num pane
// próprio porque o pulso anima a opacidade do pane inteiro: animar cada path no
// pane dos territórios repintaria a malha toda a cada quadro.
export function PendingTerritoriesLayer({
  features,
  municipal,
}: {
  features: MapFeature[];
  municipal: boolean;
}) {
  const map = useMap();
  const groupRef = useRef<LeafletGeoJSON | null>(null);
  const layersRef = useRef(new Map<string, PendingPath>());

  useEffect(() => {
    const pane = map.getPane(PANE) ?? map.createPane(PANE);
    pane.style.zIndex = '422';
    pane.style.pointerEvents = 'none';
    const layers = layersRef.current;
    const group = new LeafletGeoJSON(undefined, {
      pane: PANE,
      interactive: false,
      style: {
        smoothFactor: 0,
        // No estado, sem divisas: o skeleton pulsa como uma peça só.
        stroke: !municipal,
        color: 'var(--map-boundary, #ffffff)',
        weight: 0.85,
        opacity: 0.7,
        fillColor: 'var(--map-pending, #cbd5e1)',
        fillOpacity: 0.75,
        className: 'territory-pending-shape',
      } as PolylineOptions,
      onEachFeature: (feature, layer) =>
        layers.set((feature as MapFeature).properties.ibgeCode, layer as PendingPath),
    });
    group.addTo(map);
    groupRef.current = group;
    return () => {
      group.remove();
      groupRef.current = null;
      layers.clear();
    };
  }, [map, municipal]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const layers = layersRef.current;
    const wanted = new Map(features.map((feature) => [feature.properties.ibgeCode, feature]));
    for (const [code, layer] of layers) {
      const feature = wanted.get(code);
      if (feature && layer.feature === feature) continue;
      layers.delete(code);
      group.removeLayer(layer);
    }
    for (const [code, feature] of wanted) {
      if (!layers.has(code)) group.addData(feature);
    }
    map.getPane(PANE)?.classList.toggle('is-idle', wanted.size === 0);
  }, [map, features, municipal]);

  return null;
}
