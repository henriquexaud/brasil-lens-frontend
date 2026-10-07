import type { Feature, FeatureCollection, Geometry, MultiPolygon } from 'geojson';
import type { PolylineOptions } from 'leaflet';
import { useCallback, useMemo } from 'react';
import { GeoJSON, Pane } from 'react-leaflet';
import type { FireMunicipality, MapFeature, MapFeatureProperties, WeatherCity } from '@/api/types';
import type { FireMode } from '@/features/fire/fireDensity';
import { mosaicColor } from './mosaicColor';

interface Props {
  features: MapFeature[];
  version: number;
  versions: Map<string, number>;
  visible: boolean;
  completeStates: Set<string>;
  weatherByCode?: Map<string, WeatherCity>;
  fireByCode?: Map<string, FireMunicipality>;
  fireMode?: FireMode;
  rainMode?: boolean;
  climateMode?: boolean;
}

// Visual-only overlay: the state polygon below keeps selection and drill-down intact.
export function DiscoveredMosaicLayer({
  features,
  version,
  versions,
  visible,
  completeStates,
  weatherByCode,
  fireByCode,
  fireMode,
  rainMode,
  climateMode,
}: Props) {
  const byState = useMemo(() => {
    const groups = new Map<string, MapFeature[]>();
    for (const feature of features) {
      const stateCode = feature.properties.ibgeCode.slice(0, 2);
      const state = groups.get(stateCode) ?? [];
      state.push(feature);
      groups.set(stateCode, state);
    }
    return groups;
  }, [features]);

  const style = useCallback(
    (feature: Feature<Geometry, MapFeatureProperties> | undefined): PolylineOptions => {
      const code = feature?.properties.ibgeCode ?? '';
      const stateCode = code.slice(0, 2);
      const weather = weatherByCode?.get(code) ?? weatherByCode?.get(stateCode);
      const fire = fireByCode?.get(code) ?? fireByCode?.get(stateCode);
      const solid = mosaicColor({
        weather,
        fire,
        fireMode,
        rainMode,
        climateMode,
        complete: completeStates.has(stateCode),
      });
      return {
        smoothFactor: 0,
        color: solid,
        weight: 0.5,
        opacity: 1,
        fillColor: solid,
        fillOpacity: 1,
        className: 'discovered-mosaic-shape',
      };
    },
    [weatherByCode, fireByCode, fireMode, rainMode, climateMode, completeStates],
  );

  if (!visible || features.length === 0) return null;

  return (
    <Pane name="discovered-mosaic" style={{ zIndex: 420, pointerEvents: 'none' }}>
      {[...byState].map(([stateCode, stateFeatures]) => {
        const collection: FeatureCollection<MultiPolygon, MapFeatureProperties> = {
          type: 'FeatureCollection',
          features: stateFeatures,
        };
        return (
          <GeoJSON
            key={`${stateCode}:${versions.get(stateCode) ?? version}`}
            data={collection}
            interactive={false}
            style={style}
          />
        );
      })}
    </Pane>
  );
}
