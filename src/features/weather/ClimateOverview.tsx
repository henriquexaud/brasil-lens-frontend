import { useMemo } from 'react';
import type { WeatherCity } from '@/api/types';
import { Disclosure } from '@/components/Disclosure';
import { colorForTemperature } from '@/features/map/colors';

import { ESTIMATE_DESCRIPTION, EstimateMark } from './EstimateMark';

export interface ClimateOverviewProps {
  cities?: WeatherCity[];
  hottest?: WeatherCity[];
  coldest?: WeatherCity[];
  onSelect: (city: WeatherCity) => void;
  scopeName?: string;
  isDrilledDown?: boolean;
}

export function ClimateOverview({
  cities = [],
  hottest: precalculatedHottest,
  coldest: precalculatedColdest,
  onSelect,
  scopeName,
  isDrilledDown = false,
}: ClimateOverviewProps) {
  const { hottest, coldest } = useMemo<{ hottest: WeatherCity[]; coldest: WeatherCity[] }>(() => {
    if (precalculatedHottest && precalculatedColdest) {
      return { hottest: precalculatedHottest, coldest: precalculatedColdest };
    }
    const valid = cities.filter((c) => c.temperatureC != null && Number.isFinite(c.temperatureC));
    const first = valid[0];
    if (!first) {
      return { hottest: [], coldest: [] };
    }

    const sortedDesc = [...valid].sort((a, b) => b.temperatureC - a.temperatureC);
    if (valid.length === 1) {
      return { hottest: [first], coldest: [] };
    }

    const second = sortedDesc[1];
    if (valid.length === 2 && second) {
      return { hottest: [first], coldest: [second] };
    }

    // Para 3 ou mais cidades, seleciona até 3 mais quentes e até 3 mais frias sem sobreposição
    const maxPerGroup = Math.min(3, Math.floor(valid.length / 2) || 1);
    const topHottest = sortedDesc.slice(0, maxPerGroup);
    const hottestIds = new Set(topHottest.map((c) => c.id));

    const sortedAsc = [...valid].sort((a, b) => a.temperatureC - b.temperatureC);
    const topColdest = sortedAsc.filter((c) => !hottestIds.has(c.id)).slice(0, maxPerGroup);

    return { hottest: topHottest, coldest: topColdest };
  }, [cities, precalculatedHottest, precalculatedColdest]);

  if (!hottest.length && !coldest.length) {
    return null;
  }

  const hasEstimate = [...hottest, ...coldest].some((city) => city.isInferred);
  const title = isDrilledDown
    ? scopeName
      ? `Cidade mais quente e mais fria · ${scopeName}`
      : 'Cidade mais quente e mais fria'
    : 'Capital mais quente e capital mais fria';

  return (
    <Disclosure title={title} className="climate-ranking">
      <div className="climate-ranking-groups">
        {hottest.length > 0 && (
          <div className="climate-ranking-group">
            <div className="climate-ranking-header heat">
              <span>Mais quentes</span>
            </div>
            <ol>
              {hottest.map((city) => (
                <li key={`hot-${city.id}`}>
                  <button
                    type="button"
                    className="climate-ranking-city"
                    onClick={() => onSelect(city)}
                  >
                    <span
                      className="climate-layer-dot"
                      style={{ backgroundColor: colorForTemperature(city.temperatureC) }}
                      aria-hidden="true"
                    />
                    <span>
                      {city.name}{' '}
                      <small>
                        {city.stateAbbreviation ?? (city.id.length === 2 ? city.id : '')}
                      </small>
                    </span>
                    <strong>
                      <EstimateMark city={city} />
                      {Math.round(city.temperatureC) || 0}°C
                    </strong>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}

        {coldest.length > 0 && (
          <div className="climate-ranking-group">
            <div className="climate-ranking-header cold">
              <span>Mais frias</span>
            </div>
            <ol>
              {coldest.map((city) => (
                <li key={`cold-${city.id}`}>
                  <button
                    type="button"
                    className="climate-ranking-city"
                    onClick={() => onSelect(city)}
                  >
                    <span
                      className="climate-layer-dot"
                      style={{ backgroundColor: colorForTemperature(city.temperatureC) }}
                      aria-hidden="true"
                    />
                    <span>
                      {city.name}{' '}
                      <small>
                        {city.stateAbbreviation ?? (city.id.length === 2 ? city.id : '')}
                      </small>
                    </span>
                    <strong>
                      <EstimateMark city={city} />
                      {Math.round(city.temperatureC) || 0}°C
                    </strong>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      <p className="source-note">
        Leituras e previsão horária · Modelagem numérica Open-Meteo e dados de superfície.
        {hasEstimate && ` ≈ ${ESTIMATE_DESCRIPTION.toLowerCase()}.`}
      </p>
    </Disclosure>
  );
}
