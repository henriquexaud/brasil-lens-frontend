/**
 * Alertas oficiais (INMET + CEMADEN) com alto contraste sobre a escala térmica.
 * Uma única camada — a origem aparece dentro de cada alerta, nunca como controle
 * separado (ver WeatherOptions). Renderizados no pane zIndex 450 (sobre a
 * coropleta), sem interceptar a navegação territorial.
 */
import { useMemo } from 'react';
import { GeoJSON, Pane } from 'react-leaflet';

import type { WeatherAlertCollection } from '@/api/types';
import { getAlertStyle, SEVERITY_RANK } from './alertStyles';

export function AlertsLayer({
  collection,
  muted = false,
}: {
  collection: WeatherAlertCollection | undefined;
  muted?: boolean;
}) {
  // Severidade mais importante que a fonte na tela: quando dois alertas se
  // sobrepõem (um aviso do INMET e um risco do CEMADEN na mesma área, por
  // exemplo — os dois continuam distintos, nunca fundidos), o mais severo
  // desenha por último e fica visualmente por cima. `SEVERITY_RANK` é menor
  // para mais severo, então do maior rank para o menor desenha nessa ordem.
  const orderedFeatures = useMemo(() => {
    const features = collection?.features ?? [];
    return [...features].sort(
      (a, b) =>
        SEVERITY_RANK[getAlertStyle(b.properties).tier] -
        SEVERITY_RANK[getAlertStyle(a.properties).tier],
    );
  }, [collection]);

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
