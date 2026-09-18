/**
 * Legenda da coropleta.
 *
 * Os intervalos vêm da API (`classification.breaks`); aqui só associamos cada
 * classe a uma cor e formatamos o rótulo.
 *
 * Forma escolhida: uma faixa contínua de amostras com rótulos apenas nos
 * extremos. Listar os cinco intervalos em linhas separadas ocupava um bloco de
 * texto permanente ao lado do mapa; o intervalo exato de cada classe continua
 * acessível ao passar o cursor sobre a amostra.
 */
import type { MapClassification, MapIndicatorMeta, MapStatistics } from '@/api/types';
import { formatCompact, unitLabel } from '@/lib/format';

import { NO_DATA_COLOR, classColors } from './colors';

interface Props {
  indicator: MapIndicatorMeta | null;
  classification: MapClassification | null;
  statistics: MapStatistics | null;
}

export function Legend({ indicator, classification, statistics }: Props) {
  if (!indicator) return null;
  if (!classification || !statistics) {
    return (
      <figure className="legend" aria-label={`Legenda de ${indicator.name}`}>
        <figcaption className="legend-title">{indicator.name}</figcaption>
        <div className="legend-missing">
          <span className="legend-step" style={{ background: NO_DATA_COLOR }} />
          Sem dados para este recorte
        </div>
      </figure>
    );
  }

  const colors = classColors(classification.classes);
  const lowerBounds = [statistics.min, ...classification.breaks.slice(0, -1)];
  const unit = unitLabel(indicator.unit);

  return (
    <figure className="legend" aria-label={`Legenda de ${indicator.name}`}>
      <figcaption className="legend-title">
        {indicator.name}
        <span className="legend-meta">
          {indicator.year !== null && indicator.year}
          {indicator.year !== null && unit && ' · '}
          {unit}
        </span>
      </figcaption>

      <div className="legend-ramp" role="list">
        {classification.breaks.map((upper, index) => (
          <span
            key={upper}
            role="listitem"
            className="legend-step"
            style={{ background: colors[index] }}
            title={`${formatCompact(lowerBounds[index] ?? statistics.min)} a ${formatCompact(upper)}`}
          />
        ))}
      </div>

      <div className="legend-bounds">
        <span>{formatCompact(statistics.min)}</span>
        <span>{formatCompact(statistics.max)}</span>
      </div>

      {statistics.missing > 0 && (
        <div className="legend-missing">
          <span className="legend-step" style={{ background: NO_DATA_COLOR }} />
          {statistics.missing} sem dado
        </div>
      )}
    </figure>
  );
}
