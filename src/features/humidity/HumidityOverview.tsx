import { useMemo } from 'react';
import type { WeatherCity } from '@/api/types';
import { Disclosure } from '@/components/Disclosure';
import {
  ESTIMATE_DESCRIPTION,
  EstimateMark,
  isStateAverage,
  STATE_AVERAGE_DESCRIPTION,
} from '@/features/weather/EstimateMark';
import { formatHumidity, humidityColor, humidityLevel, humidityValue } from './humidityScale';

export function HumidityOverview({
  cities,
  onSelect,
  scopeName,
}: {
  cities: WeatherCity[];
  onSelect: (city: WeatherCity) => void;
  scopeName?: string;
}) {
  const { driest, belowAttention, measured } = useMemo(() => {
    const withValue = cities.filter((city) => humidityValue(city) != null);
    return {
      measured: withValue.length,
      belowAttention: withValue.filter((city) => humidityLevel(humidityValue(city)) != null).length,
      driest: [...withValue].sort((a, b) => humidityValue(a)! - humidityValue(b)!).slice(0, 5),
    };
  }, [cities]);

  if (!driest.length) return null;
  const title = scopeName ? `Ar mais seco · ${scopeName}` : 'Ar mais seco';

  return (
    <Disclosure title={title} className="rain-ranking" defaultOpen={false}>
      {belowAttention > 0 && (
        <p className="rain-live-note">
          Até 30% em {belowAttention} de {measured} {measured === 1 ? 'local' : 'locais'}
        </p>
      )}
      <ol>
        {driest.map((city) => {
          const value = humidityValue(city)!;
          return (
            <li key={city.id}>
              <button className="rain-ranking-city" onClick={() => onSelect(city)}>
                <span
                  className="rain-layer-dot"
                  style={{ backgroundColor: humidityColor(value) }}
                  aria-hidden="true"
                />
                <span>
                  {city.name} <small>{city.stateAbbreviation}</small>
                </span>
                <strong>
                  <EstimateMark city={city} />
                  {formatHumidity(value)}
                </strong>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="source-note">
        Umidade relativa do ar agora · Níveis da Defesa Civil: atenção até 30%, alerta até 20% e
        emergência abaixo de 12%.
        {cities.some(isStateAverage) && ` ${STATE_AVERAGE_DESCRIPTION}.`}
        {driest.some((city) => city.isInferred) && ` ≈ ${ESTIMATE_DESCRIPTION.toLowerCase()}.`}
      </p>
    </Disclosure>
  );
}
