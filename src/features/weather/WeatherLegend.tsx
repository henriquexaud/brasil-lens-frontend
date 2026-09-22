import { useState } from 'react';
import { TEMPERATURE_SCALE, type TemperatureBand } from '@/features/map/colors';

const TEMPERATURE_TICKS = [
  { label: '0°', percent: (100 / 9) * 1 },
  { label: '10°', percent: (100 / 9) * 3 },
  { label: '20°', percent: (100 / 9) * 5 },
  { label: '30°', percent: (100 / 9) * 7 },
];

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
      <div className="weather-legend-bounds">
        {TEMPERATURE_TICKS.map((tick) => (
          <span
            key={tick.label}
            className="weather-legend-tick-bound"
            style={{ left: `${tick.percent}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>
      {notice && (
        <p className="weather-legend-notice" role="status">
          {notice}
        </p>
      )}
    </figure>
  );
}
