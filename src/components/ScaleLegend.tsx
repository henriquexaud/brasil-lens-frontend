import { useState } from 'react';

export interface LegendBand {
  color: string;
  label: string;
  name: string;
}

export interface LegendTick {
  label: string;
  percent: number;
}

interface Props {
  title: string;
  unit: string;
  bands: readonly LegendBand[];
  ticks: readonly LegendTick[];
  notice?: string;
  loading?: boolean;
  unavailable?: boolean;
}

export function ScaleLegend({
  title,
  unit,
  bands,
  ticks,
  notice,
  loading = false,
  unavailable = false,
}: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeBand = activeIndex === null ? null : bands[activeIndex];

  return (
    <figure className="legend scale-legend" aria-label={`Legenda de ${title}`}>
      <figcaption className="scale-legend-header">
        <span className="scale-legend-title" title={title}>
          {title}
        </span>
        {activeBand && !loading && !unavailable ? (
          <span className="scale-legend-active-badge" title={activeBand.name}>
            <span
              className="scale-legend-active-dot"
              style={{ backgroundColor: activeBand.color }}
            />
            <span className="scale-legend-active-text">{activeBand.name}</span>
          </span>
        ) : (
          <span className="scale-legend-unit">{unit}</span>
        )}
      </figcaption>
      <div
        className="scale-legend-bar"
        role="group"
        aria-label={`${title}: escala de ${bands.length} cores${loading ? ', carregando' : ''}`}
        aria-busy={loading}
        onMouseLeave={() => setActiveIndex(null)}
      >
        {bands.map((band, index) => (
          <button
            key={index}
            type="button"
            className={`scale-legend-segment${activeIndex === index ? ' is-active' : ''}`}
            style={{ backgroundColor: loading || unavailable ? 'var(--map-neutral)' : band.color }}
            title={band.name}
            aria-label={band.name}
            aria-pressed={activeIndex === index}
            disabled={loading || unavailable}
            onClick={() => setActiveIndex((current) => (current === index ? null : index))}
            onMouseEnter={() => setActiveIndex(index)}
            onFocus={() => setActiveIndex(index)}
            onBlur={() => setActiveIndex(null)}
          />
        ))}
      </div>
      <div className="scale-legend-bounds">
        {ticks.map((tick, index) => (
          <span
            key={index}
            className={`scale-legend-tick-bound${tick.percent === 0 ? ' is-start' : tick.percent === 100 ? ' is-end' : ''}`}
            style={{ left: `${tick.percent}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>
      {notice && (
        <p className="scale-legend-notice" role="status">
          {notice}
        </p>
      )}
    </figure>
  );
}
