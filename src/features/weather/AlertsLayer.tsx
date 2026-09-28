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
  const shapes = useMemo(() => {
    const features = collection?.features ?? [];
    const filtered = stateCode
      ? features.filter((feature) => isAlertInState(feature, stateCode))
      : features;

    return filtered
      .map((feature) => ({ feature, alert: getAlertStyle(feature.properties) }))
      .sort((a, b) => SEVERITY_RANK[b.alert.tier] - SEVERITY_RANK[a.alert.tier])
      .map(({ feature, alert }) => ({
        feature,
        style: {
          color: alert.strokeColor,
          weight: alert.strokeWeight,
          dashArray: alert.strokeDashArray,
          opacity: muted ? 0.35 : alert.strokeOpacity,
          fillColor: alert.fillColor,
          fillOpacity: muted ? 0 : alert.fillOpacity,
          className: 'weather-alert-shape',
        },
      }));
  }, [collection, stateCode, muted]);

  return (
    <Pane name="weather-alerts" style={{ zIndex: 450, pointerEvents: 'none' }}>
      {shapes.map(({ feature, style }) => (
        <GeoJSON
          key={`${feature.id}:${feature.properties.expires}`}
          data={feature}
          interactive={false}
          style={style}
        />
      ))}
    </Pane>
  );
}
