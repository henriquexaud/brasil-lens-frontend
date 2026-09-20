import { Fragment, useEffect, useMemo, useState } from 'react';
import { CircleMarker, Pane, Tooltip, useMap } from 'react-leaflet';
import type { WeatherCity } from '@/api/types';
import { colorForTemperature } from '@/features/map/colors';
import { WeatherIcon, weatherShortDescription } from '@/features/weather/conditions';

const ATTRIBUTION =
  'Clima: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>';

export function WeatherLayer({
  cities,
  selectedId,
  municipal,
}: {
  cities: WeatherCity[];
  selectedId?: string;
  municipal: boolean;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useEffect(() => {
    map.attributionControl.addAttribution(ATTRIBUTION);
    const onZoom = () => setZoom(map.getZoom());
    map.on('zoomend', onZoom);
    return () => {
      map.attributionControl.removeAttribution(ATTRIBUTION);
      map.off('zoomend', onZoom);
    };
  }, [map]);

  // Ordena para que o território selecionado fique sempre no topo da pilha visual.
  const sortedCities = useMemo(() => {
    return [...cities].sort((a, b) => {
      if (a.id === selectedId) return 1;
      if (b.id === selectedId) return -1;
      return 0;
    });
  }, [cities, selectedId]);

  // No mapa do Brasil, modo compacto apenas em zoom muito afastado (< 4.8) para evitar sobreposição na costa.
  // No mapa estadual, exibe os pills a partir do zoom 6.0; abaixo disso foca na capital e selecionado.
  const isCompact = !municipal && zoom < 4.8;
  const showAllPills = municipal ? zoom >= 6.0 : true;

  return (
    <Pane name="weather-points" style={{ zIndex: 490, pointerEvents: 'none' }}>
      {sortedCities.map((city, index) => {
        const isSelected = city.id === selectedId;
        const isCapital = !municipal || index === 0;
        const shouldShowPill = isSelected || showAllPills || isCapital;
        const color = colorForTemperature(city.temperatureC);

        if (!shouldShowPill) return null;

        return (
          <Fragment key={city.id}>
            <CircleMarker
              center={[city.latitude, city.longitude]}
              radius={0.1}
              stroke={false}
              fill={false}
              interactive={false}
              pathOptions={{
                opacity: 0,
                fillOpacity: 0,
              }}
            >
              <Tooltip
                permanent
                direction="center"
                offset={[0, 0]}
                className="weather-marker-label"
                interactive={false}
              >
                {municipal ? (
                  <div
                    className={`weather-pill weather-pill-city ${isSelected ? 'is-selected' : ''}`}
                    style={
                      {
                        '--pill-band-color': color,
                        '--stagger': index % 16,
                      } as React.CSSProperties
                    }
                  >
                    <span className="weather-pill-icon">
                      <WeatherIcon code={city.weatherCode} size={13} />
                    </span>
                    <span className="weather-pill-temp">{Math.round(city.temperatureC)}°</span>
                  </div>
                ) : (
                  <div
                    className={`weather-pill ${isSelected ? 'is-selected' : ''} ${isCompact && !isSelected ? 'is-compact' : ''}`}
                    style={{ '--pill-band-color': color } as React.CSSProperties}
                  >
                    <span className="weather-pill-icon">
                      <WeatherIcon code={city.weatherCode} size={14} />
                    </span>
                    <span className="weather-pill-temp">{Math.round(city.temperatureC)}°</span>
                    {(!isCompact || isSelected) && (
                      <span className="weather-pill-desc">
                        {weatherShortDescription(city.weatherCode)}
                      </span>
                    )}
                  </div>
                )}
              </Tooltip>
            </CircleMarker>
          </Fragment>
        );
      })}
    </Pane>
  );
}
