import { Fragment, useEffect, useState } from 'react';
import { CircleMarker, Pane, Tooltip, useMap } from 'react-leaflet';
import type { WeatherCity } from '@/api/types';
import { colorForTemperature } from '@/features/map/colors';
import { rainColor } from '@/features/rainfall/rainScale';
import { WeatherIcon } from '@/features/weather/conditions';

const ATTRIBUTION =
  'Clima: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>';

export function WeatherLayer({
  cities,
  selectedId,
  municipal,
  mode = 'temperature',
}: {
  cities: WeatherCity[];
  selectedId?: string;
  municipal: boolean;
  mode?: 'temperature' | 'rainfall';
}) {
  const map = useMap();
  const [viewport, setViewport] = useState(() => ({ zoom: map.getZoom(), revision: 0 }));
  const { zoom } = viewport;

  useEffect(() => {
    map.attributionControl?.addAttribution(ATTRIBUTION);
    const onMove = () =>
      setViewport((previous) => ({ zoom: map.getZoom(), revision: previous.revision + 1 }));
    map.on('moveend resize', onMove);
    return () => {
      map.attributionControl?.removeAttribution(ATTRIBUTION);
      map.off('moveend resize', onMove);
    };
  }, [map]);

  const isRain = mode === 'rainfall';

  // Ordena para que o território selecionado fique sempre no topo da pilha visual.
  const sortedCities = (() => {
    const candidates = cities.filter((city) =>
      isRain
        ? city.precipitationSumMm != null || city.precipitationMm != null || city.temperatureC != null
        : city.temperatureC != null && Number.isFinite(city.temperatureC),
    );
    if (municipal) {
      // Todas as cores continuam no mapa; os rótulos disputam espaço, não dados.
      // O município selecionado tem prioridade e os demais reaparecem ao aproximar.
      const size = map.getSize();
      const occupied: Array<{ x: number; y: number }> = [];
      const priority = [...candidates].sort((a, b) => {
        if (a.id === selectedId) return -1;
        if (b.id === selectedId) return 1;
        if (isRain) {
          const rainA = a.precipitationSumMm ?? a.precipitationMm ?? 0;
          const rainB = b.precipitationSumMm ?? b.precipitationMm ?? 0;
          return rainB - rainA;
        }
        return 0;
      });
      const visible = new Set<string>();
      for (const city of priority) {
        const point = map.latLngToContainerPoint([city.latitude, city.longitude]);
        if (point.x < 0 || point.y < 0 || point.x > size.x || point.y > size.y) continue;
        if (
          occupied.some(
            (other) => Math.abs(point.x - other.x) < 96 && Math.abs(point.y - other.y) < 48,
          )
        )
          continue;
        occupied.push(point);
        visible.add(city.id);
      }
      return candidates
        .filter((city) => visible.has(city.id))
        .sort((a, b) => Number(a.id === selectedId) - Number(b.id === selectedId));
    }
    return [...candidates].sort((a, b) => {
      if (a.id === selectedId) return 1;
      if (b.id === selectedId) return -1;
      return 0;
    });
  })();

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

        if (!shouldShowPill) return null;

        const rainVal = city.precipitationSumMm ?? city.precipitationMm ?? 0;
        const color = isRain ? rainColor(rainVal) : colorForTemperature(city.temperatureC);
        const formattedRain =
          rainVal > 0
            ? rainVal >= 10
              ? `${Math.round(rainVal)} mm`
              : `${Number(rainVal).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mm`
            : '0 mm';

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
                    {isRain ? (
                      <>
                        <span
                          className="weather-pill-dot"
                          style={{ backgroundColor: color }}
                          aria-hidden="true"
                        />
                        <span className="weather-pill-temp">{formattedRain}</span>
                      </>
                    ) : (
                      <>
                        <span className="weather-pill-icon">
                          <WeatherIcon code={city.weatherCode} size={13} />
                        </span>
                        <span className="weather-pill-temp">{Math.round(city.temperatureC)}°</span>
                      </>
                    )}
                  </div>
                ) : (
                  <div
                    className={`weather-pill ${isSelected ? 'is-selected' : ''} ${isCompact && !isSelected ? 'is-compact' : ''}`}
                    style={{ '--pill-band-color': color } as React.CSSProperties}
                  >
                    {isRain ? (
                      <>
                        <span
                          className="weather-pill-dot"
                          style={{ backgroundColor: color }}
                          aria-hidden="true"
                        />
                        <span className="weather-pill-temp">{formattedRain}</span>
                      </>
                    ) : (
                      <>
                        <span className="weather-pill-icon">
                          <WeatherIcon code={city.weatherCode} size={14} />
                        </span>
                        <span className="weather-pill-temp">{Math.round(city.temperatureC)}°</span>
                      </>
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
