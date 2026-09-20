import { useState } from 'react';
import { TEMPERATURE_SCALE, type TemperatureBand } from '@/features/map/colors';

export function WeatherLegend({ notice }: { municipal?: boolean; notice?: string }) {
  const [activeBand, setActiveBand] = useState<TemperatureBand | null>(null);

  const toggleBand = (band: TemperatureBand) => {
    setActiveBand((current) => (current?.label === band.label ? null : band));
  };

  return (
    <figure className="legend weather-legend" aria-label="Escala de temperatura em graus Celsius">
      <figcaption className="weather-legend-header">
        <span className="weather-legend-title">Temperatura</span>
        {activeBand ? (
          <span className="weather-legend-active-badge">
            <span
              className="weather-legend-active-dot"
              style={{ backgroundColor: activeBand.color }}
            />
            <span className="weather-legend-active-text">{activeBand.name}</span>
          </span>
        ) : (
          <span className="weather-legend-unit">°C</span>
        )}
      </figcaption>
      <div
        className="weather-legend-bar"
        role="img"
        aria-label="Escala de temperatura em 9 faixas"
        onMouseLeave={() => setActiveBand(null)}
      >
        {TEMPERATURE_SCALE.map((band) => {
          const isActive = activeBand?.label === band.label;
          return (
            <div
              key={band.label}
              className={`weather-legend-segment ${isActive ? 'is-active' : ''}`}
              style={{ backgroundColor: band.color }}
              title={`${band.name}: ${band.label}`}
              onClick={() => toggleBand(band)}
              onMouseEnter={() => setActiveBand(band)}
            />
          );
        })}
      </div>
      <div className="weather-legend-ticks">
        {TEMPERATURE_SCALE.map((band) => {
          const isActive = activeBand?.label === band.label;
          return (
            <span
              key={band.label}
              className={`weather-legend-tick ${isActive ? 'is-active' : ''}`}
              onClick={() => toggleBand(band)}
              onMouseEnter={() => setActiveBand(band)}
              onMouseLeave={() => setActiveBand(null)}
            >
              <span className="weather-legend-pip" />
              <span className="weather-legend-tick-text">
                {band.label.endsWith('°') ? (
                  <>
                    {band.label.slice(0, -1)}
                    <span className="weather-legend-deg">°</span>
                  </>
                ) : (
                  band.label
                )}
              </span>
            </span>
          );
        })}
      </div>
      {notice && (
        <p className="weather-legend-notice" role="status">
          {notice}
        </p>
      )}
    </figure>
  );
}
