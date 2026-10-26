import { useMemo } from 'react';
import type { WeatherCity } from '@/api/types';
import { humidityPresentation } from './humidityPresentation';

// Apresentações da aba Umidade: o recorte atual e, no Brasil, o mosaico
// municipal já preparado para o clima. Identidade estável por leitura.
export function useHumidityPresentation({
  active,
  weatherByCode,
  nationalByCode,
  revision,
}: {
  active: boolean;
  weatherByCode: ReadonlyMap<string, WeatherCity>;
  nationalByCode?: ReadonlyMap<string, WeatherCity>;
  revision?: string;
}) {
  const presentation = useMemo(
    () => (active ? humidityPresentation(weatherByCode, `scope:${weatherByCode.size}`) : undefined),
    [active, weatherByCode],
  );
  const nationalPresentation = useMemo(
    () =>
      active && nationalByCode
        ? humidityPresentation(nationalByCode, `national:${revision ?? ''}`)
        : undefined,
    [active, nationalByCode, revision],
  );
  return { presentation, nationalPresentation };
}
