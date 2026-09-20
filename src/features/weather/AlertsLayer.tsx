/**
 * Avisos meteorológicos oficiais (INMET) com alto contraste sobre a escala térmica.
 * Renderizados no pane zIndex 450 (sobre a coropleta), sem interceptar a navegação territorial.
 */
import { GeoJSON, Pane } from 'react-leaflet';

import type { WeatherAlertCollection } from '@/api/types';
import { getAlertStyle } from './alertStyles';

export function AlertsLayer({ collection }: { collection: WeatherAlertCollection | undefined }) {
  return (
    <Pane name="weather-alerts" style={{ zIndex: 450, pointerEvents: 'none' }}>
      {collection?.features.map((feature) => {
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
              opacity: style.strokeOpacity,
              fillColor: style.fillColor,
              fillOpacity: style.fillOpacity,
              className: 'weather-alert-shape',
            }}
          />
        );
      })}
    </Pane>
  );
}
