import type { WeatherCity } from '@/api/types';
import { ESTIMATE_DESCRIPTION } from '@/features/weather/EstimateMark';
import {
  formatHumidity,
  HUMIDITY_LEVEL_LABEL,
  humidityColor,
  humidityLevel,
  humidityValue,
} from './humidityScale';

export function HumidityStatusSection({
  city,
  loading = false,
}: {
  city: WeatherCity | undefined;
  loading?: boolean;
}) {
  const value = humidityValue(city);
  if (value == null || !city) {
    return (
      <div className="rain-detail-card is-highlight" role={loading ? 'status' : undefined}>
        <p className="source-note">
          {loading ? 'Consultando umidade…' : 'Umidade não disponível para este local.'}
        </p>
      </div>
    );
  }
  const level = humidityLevel(value);
  return (
    <div className="rain-detail-card is-highlight">
      <div className="rain-detail-header">
        <div className="rain-detail-status">
          <span
            className="rain-layer-dot"
            style={{ backgroundColor: humidityColor(value) }}
            aria-hidden="true"
          />
          <strong>{level ? 'Ar seco' : 'Umidade relativa'}</strong>
        </div>
        {level && (
          <span className="weather-layer-badge badge-humidity">{HUMIDITY_LEVEL_LABEL[level]}</span>
        )}
      </div>
      <div className="rain-metrics-grid">
        <div className="rain-metric">
          <span className="rain-metric-val">
            {city.isInferred ? '≈ ' : ''}
            {formatHumidity(value)}
          </span>
          <span className="rain-metric-lbl">umidade relativa agora</span>
        </div>
      </div>
      {city.isInferred && (
        <p className="source-note" style={{ margin: '4px 0 0' }}>
          ≈ {ESTIMATE_DESCRIPTION}.
        </p>
      )}
    </div>
  );
}
