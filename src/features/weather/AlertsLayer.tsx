import { useMemo } from 'react';
import { GeoJSON, Pane } from 'react-leaflet';

import type { WeatherAlertCollection } from '@/api/types';
import { getAlertStyle, SEVERITY_RANK } from './alertStyles';
import { isAlertInState } from './alertUtils';

export function AlertsLayer({
  collection,
  muted = false,
  stateCode = null,
}: {
  collection: WeatherAlertCollection | undefined;
  muted?: boolean;
  stateCode?: string | null;
}) {
  const orderedFeatures = useMemo(() => {
    const features = collection?.features ?? [];
    const filtered = stateCode
      ? features.filter((feature) => isAlertInState(feature, stateCode))
      : features;

    return [...filtered].sort(
      (a, b) =>
        SEVERITY_RANK[getAlertStyle(b.properties).tier] -
        SEVERITY_RANK[getAlertStyle(a.properties).tier],
    );
  }, [collection, stateCode]);

  return (
    <Pane name="weather-alerts" style={{ zIndex: 450, pointerEvents: 'none' }}>
      {orderedFeatures.map((feature) => {
        const style = getAlertStyle(feature.properties);
        return (
          <GeoJSON
            key={`${feature.id}:${feature.properties.expires}`}
            data={feature}
            interactive={false}
            style={{
              color: style.strokeColor,
              weight: style.strokeWeight,
              dashArray: style.strokeDashArray,
              opacity: muted ? 0.35 : style.strokeOpacity,
              fillColor: style.fillColor,
              fillOpacity: muted ? 0 : style.fillOpacity,
              className: 'weather-alert-shape',
            }}
          />
        );
      })}
    </Pane>
  );
}
