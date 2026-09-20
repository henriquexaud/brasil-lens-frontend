import { useEffect, useState } from 'react';

interface Props {
  isFetching: boolean;
  stage: number;
  maxStages: number;
  isComplete: boolean;
  totalCities: number;
}

export function WeatherStageBadge({
  isFetching,
  stage,
  maxStages,
  isComplete,
  totalCities,
}: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (isFetching) {
      setVisible(true);
    } else if (isComplete && totalCities > 0) {
      const timer = window.setTimeout(() => setVisible(false), 4000);
      return () => window.clearTimeout(timer);
    }
  }, [isFetching, isComplete, totalCities]);

  if (!visible) return null;

  return (
    <div
      className={`weather-stage-badge ${isFetching ? 'is-loading' : 'is-ready'}`}
      role="status"
      aria-live="polite"
    >
      {isFetching ? (
        <>
          <span className="weather-stage-dot" aria-hidden="true" />
          <span>
            Carregando clima regional · Etapa {stage} de {maxStages}…
          </span>
        </>
      ) : (
        <>
          <span className="weather-stage-check" aria-hidden="true">
            ✓
          </span>
          <span>
            {totalCities} cidades de referência carregadas · Clique em qualquer município para ver
            o clima
          </span>
        </>
      )}
    </div>
  );
}

