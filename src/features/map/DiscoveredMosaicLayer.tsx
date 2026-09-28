import type { Feature, FeatureCollection, Geometry, MultiPolygon } from 'geojson';
import type { PolylineOptions } from 'leaflet';
import { useCallback, useMemo } from 'react';
import { GeoJSON, Pane } from 'react-leaflet';
import type { FireMunicipality, MapFeature, MapFeatureProperties, WeatherCity } from '@/api/types';
import { densityColor, type FireMode } from '@/features/fire/fireDensity';
import { rainAmount, rainColor } from '@/features/rainfall/rainScale';
import { colorForTemperature } from './colors';

interface Props {
  features: MapFeature[];
  version: number;
  versions: Map<string, number>;
  revealStateCode?: string | null;
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
  revealStateCode,
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
      let fillColor = '#f1f5f9';
      let fillOpacity = 0.08;
      if (fireMode) {
        fillColor = fire?.density != null ? densityColor(fire.density) : '#edf0ee';
        fillOpacity = fire?.density != null ? (fireMode === 'points' ? 0.45 : 0.68) : 0.35;
      } else if (rainMode) {
        const amount = weather ? rainAmount(weather) : 0;
        fillColor = rainColor(amount);
        fillOpacity = amount > 0 ? 0.72 : 0.12;
      } else if (climateMode) {
        const temperature = weather?.temperatureC;
        fillColor = temperature != null ? colorForTemperature(temperature) : '#f1f5f9';
        fillOpacity = temperature != null ? 0.68 : 0.18;
      }
      return {
        smoothFactor: 0,
        stroke: false,
        fillColor,
        fillOpacity: completeStates.has(stateCode) ? fillOpacity : 1,
        className:
          revealStateCode === stateCode
            ? 'discovered-mosaic-shape is-revealing'
            : 'discovered-mosaic-shape',
      };
    },
    [weatherByCode, fireByCode, fireMode, rainMode, climateMode, completeStates, revealStateCode],
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
