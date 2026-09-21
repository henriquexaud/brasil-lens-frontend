import { FIRE_COLORS } from './fireDensity';

const FIRE_LEGEND_LABELS = ['0', '1', '5', '10', '25', '50+'];

export function FireLegend({
  loading,
  error,
  hours = 24,
}: {
  loading: boolean;
  error: boolean;
  hours?: number;
}) {
  return (
    <figure
      className="legend weather-legend fire-legend"
      aria-label="Intensidade das detecções de calor"
    >
      <figcaption className="weather-legend-header">
        <span className="weather-legend-title">Focos / 1.000 km²</span>
        <span className="weather-legend-unit">{hours}h</span>
      </figcaption>
      <div className="fire-legend-ramp" role="list" aria-label="Densidade de focos">
        {FIRE_COLORS.map((color, index) => (
          <span
            key={color}
            role="listitem"
            className="fire-legend-step"
            style={{ backgroundColor: color }}
            title={`${FIRE_LEGEND_LABELS[index]} focos / 1.000 km²`}
          />
        ))}
      </div>
      <div className="fire-legend-bounds">
        {FIRE_LEGEND_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      {(loading || error) && (
        <p className="weather-legend-notice" role="status">
          {error ? 'Resumo de focos indisponível' : 'Atualizando densidade…'}
        </p>
      )}
    </figure>
  );
}
