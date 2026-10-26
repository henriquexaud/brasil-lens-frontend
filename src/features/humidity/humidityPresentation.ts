import type { WeatherCity } from '@/api/types';
import type { TerritoryPresentation } from '@/features/map/TerritoryPresentation';
import { isStateAverage } from '@/features/weather/EstimateMark';
import {
  formatHumidity,
  HUMIDITY_LEVEL_LABEL,
  humidityColor,
  humidityLevel,
  humidityValue,
} from './humidityScale';

// A umidade vem na mesma leitura do clima (Open-Meteo, sem chamada extra) e é
// pintada como apresentação por código, o mesmo caminho dos indicadores.
export function humidityPresentation(
  byCode: ReadonlyMap<string, WeatherCity>,
  revision: string,
): TerritoryPresentation {
  const colors = new Map<string, string>();
  const values = new Set<string>();
  const tooltips = new Map<string, { value: string; meta: string }>();
  for (const [code, city] of byCode) {
    const value = humidityValue(city);
    if (value == null) continue;
    colors.set(code, humidityColor(value));
    values.add(code);
    const level = humidityLevel(value);
    const notes = [
      'Umidade relativa do ar',
      ...(level ? [HUMIDITY_LEVEL_LABEL[level]] : []),
      ...(city.isInferred
        ? ['estimado']
        : isStateAverage(city)
          ? [`média de ${city.samplePoints} pontos`]
          : []),
    ];
    tooltips.set(code, {
      value: `${city.isInferred ? '≈ ' : ''}${formatHumidity(value)}`,
      meta: notes.join(' · '),
    });
  }
  return { key: `humidity:${revision}`, colors, values, tooltips };
}
