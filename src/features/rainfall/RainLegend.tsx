import { RAIN_SCALE_STOPS } from './rainScale';

const RAIN_LEGEND_LABELS = ['0', '2', '10', '25', '50', '75', '100+'];

export function RainLegend({
  loading = false,
  error = false,
}: {
  loading?: boolean;
  error?: boolean;
}) {
  return (
    <figure
      className="legend weather-legend rain-legend"
      aria-label="Acumulado de chuva em 24 horas"
    >
      <figcaption className="weather-legend-header">
        <span className="weather-legend-title">Chuva acumulada</span>
        <span className="weather-legend-unit">mm / 24h</span>
      </figcaption>
      <div className="rain-legend-ramp" role="list" aria-label="Escala de volume de chuva">
        {RAIN_SCALE_STOPS.map((stop) => (
          <span
            key={stop.color}
            role="listitem"
            className="rain-legend-step"
            style={{ backgroundColor: stop.color }}
            title={`${stop.label} acumulados`}
          />
        ))}
      </div>
      <div className="rain-legend-bounds">
        {RAIN_LEGEND_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      {(loading || error) && (
        <p className="weather-legend-notice" role="status">
          {error ? 'Dados de chuva indisponíveis' : 'Atualizando precipitação…'}
        </p>
      )}
    </figure>
  );
}
