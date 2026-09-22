import { useMemo } from 'react';
import type { WeatherCity } from '@/api/types';
import { Disclosure } from '@/components/Disclosure';
import { ESTIMATE_DESCRIPTION, EstimateMark } from '@/features/weather/EstimateMark';

import { rainAmount, rainColor } from './rainScale';

export interface RainOverviewProps {
  cities?: WeatherCity[];
  ranked?: WeatherCity[];
  onSelect: (city: WeatherCity) => void;
  scopeName?: string;
}

export function RainOverview({
  cities = [],
  ranked: precalculatedRanked,
  onSelect,
  scopeName,
}: RainOverviewProps) {
  const ranked = useMemo(
    () =>
      precalculatedRanked ??
      cities
        .filter((c) => {
          const val = rainAmount(c);
          return val > 0;
        })
        .sort((a, b) => {
          const valA = rainAmount(a);
          const valB = rainAmount(b);
          return valB - valA;
        })
        .slice(0, 5),
    [cities, precalculatedRanked],
  );

  // Onde chove agora, entre as leituras da tela (medidas ou estimadas).
  const rainingNow = cities.filter((city) => city.rainingNow).length;

  if (!ranked.length && !rainingNow) return null;

  const title = scopeName
    ? `Maiores acumulados de chuva · ${scopeName}`
    : 'Maiores acumulados de chuva';

  return (
    <Disclosure title={title} className="rain-ranking">
      {rainingNow > 0 && (
        <p className="rain-live-note">
          <span className="rain-live-dot" aria-hidden="true" />
          Chovendo agora em {rainingNow} de {cities.length}{' '}
          {cities.length === 1 ? 'local' : 'locais'}
        </p>
      )}
      <ol>
        {ranked.map((city) => {
          const rainMm = rainAmount(city);
          return (
            <li key={city.id}>
              <button className="rain-ranking-city" onClick={() => onSelect(city)}>
                <span
                  className="rain-layer-dot"
                  style={{ backgroundColor: rainColor(rainMm) }}
                  aria-hidden="true"
                />
                <span>
                  {city.name} <small>{city.stateAbbreviation}</small>
                </span>
                <strong>
                  <EstimateMark city={city} />
                  {Number(rainMm).toLocaleString('pt-BR', {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}{' '}
                  mm
                </strong>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="source-note">
        Acumulado estimado em 24h · Modelagem numérica e dados de superfície.
        {ranked.some((city) => city.isInferred) && ` ≈ ${ESTIMATE_DESCRIPTION.toLowerCase()}.`}
      </p>
    </Disclosure>
  );
}
