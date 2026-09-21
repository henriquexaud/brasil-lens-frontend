import { useMemo } from 'react';
import type { WeatherCity } from '@/api/types';
import { Disclosure } from '@/components/Disclosure';
import { ESTIMATE_DESCRIPTION, EstimateMark } from '@/features/weather/EstimateMark';

import { rainColor } from './rainScale';

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
          const val = c.precipitationSumMm ?? c.precipitationMm ?? 0;
          return val > 0;
        })
        .sort((a, b) => {
          const valA = a.precipitationSumMm ?? a.precipitationMm ?? 0;
          const valB = b.precipitationSumMm ?? b.precipitationMm ?? 0;
          return valB - valA;
        })
        .slice(0, 5),
    [cities, precalculatedRanked],
  );

  if (!ranked.length) return null;

  const title = scopeName
    ? `Maiores acumulados de chuva · ${scopeName}`
    : 'Maiores acumulados de chuva';

  return (
    <Disclosure title={title} className="rain-ranking">
      <ol>
        {ranked.map((city) => {
          const rainMm = city.precipitationSumMm ?? city.precipitationMm ?? 0;
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
