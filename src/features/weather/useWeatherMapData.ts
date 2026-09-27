import { useMemo, useRef } from 'react';
import type { InfiniteData } from '@tanstack/react-query';
import type { MapFeatureCollection, WeatherCity, WeatherCurrentResponse } from '@/api/types';
import { rainAmount } from '@/features/rainfall/rainScale';

interface WeatherMapDataInput {
  scope: { parent: string | null };
  isDrilledDown: boolean;
  closeMunicipalView: boolean;
  selectedCode: string | null;
  stateWeather: { data?: WeatherCurrentResponse };
  municipalities: { data?: InfiniteData<WeatherCurrentResponse> };
  nearbyWeather: { data?: WeatherCurrentResponse };
  nationalWeather: { data?: WeatherCurrentResponse };
  selectedWeather: { data?: WeatherCurrentResponse };
  currentWeather?: WeatherCurrentResponse;
  collection?: MapFeatureCollection;
}

/** Une leituras da camada ativa, mantém cidades já vistas e calcula a escala exibida. */
export function useWeatherMapData({
  scope,
  isDrilledDown,
  closeMunicipalView,
  selectedCode,
  stateWeather,
  municipalities,
  nearbyWeather,
  nationalWeather,
  selectedWeather,
  currentWeather,
  collection,
}: WeatherMapDataInput) {
  // Um único histórico por recorte mantém cidades já vistas durante o pan.
  // A leitura mais nova vence; no mesmo horário, a medição vence a estimativa.
  const knownWeatherRef = useRef({ scope: scope.parent, byId: new Map<string, WeatherCity>() });
  const weatherCities = useMemo(() => {
    if (knownWeatherRef.current.scope !== scope.parent) {
      knownWeatherRef.current = { scope: scope.parent, byId: new Map() };
    }
    // A média estadual substitui a capital, mesmo quando seu ponto mais antigo
    // é anterior à leitura da capital. São recortes distintos, não atualizações
    // da mesma medição; no país a consulta já entrega a etapa correta.
    if (!isDrilledDown) return nationalWeather.data?.cities ?? [];
    const { byId } = knownWeatherRef.current;
    const cities =
      stateWeather.data?.cities ?? municipalities.data?.pages.flatMap((page) => page.cities) ?? [];
    const incoming = [
      ...cities,
      ...(closeMunicipalView ? (nearbyWeather.data?.cities ?? []) : []),
      ...(selectedCode?.length === 7 ? (selectedWeather.data?.cities ?? []) : []),
    ];
    for (const city of incoming) {
      if (scope.parent && !city.id.startsWith(scope.parent)) continue;
      const known = byId.get(city.id);
      if (known) {
        const knownAt = Date.parse(known.observedAt);
        const incomingAt = Date.parse(city.observedAt);
        if (
          knownAt > incomingAt ||
          (knownAt === incomingAt && !known.isInferred && city.isInferred)
        )
          continue;
      }
      byId.set(city.id, city);
    }
    return [...byId.values()];
  }, [
    isDrilledDown,
    scope.parent,
    stateWeather.data,
    municipalities.data,
    closeMunicipalView,
    nearbyWeather.data,
    nationalWeather.data,
    selectedCode,
    selectedWeather.data,
  ]);

  const maxRainfall = useMemo(() => {
    if (
      currentWeather?.summary?.maxRainfall !== undefined &&
      currentWeather?.summary?.maxRainfall !== null
    ) {
      return currentWeather.summary.maxRainfall;
    }
    if (!weatherCities.length) return undefined;
    let max = 0;
    for (const c of weatherCities) {
      const val = rainAmount(c);
      if (val > max) max = val;
    }
    return max;
  }, [currentWeather?.summary?.maxRainfall, weatherCities]);

  const { minTemperature, maxTemperature } = useMemo(() => {
    if (
      currentWeather?.summary?.minTemperature !== undefined &&
      currentWeather?.summary?.minTemperature !== null &&
      currentWeather?.summary?.maxTemperature !== undefined &&
      currentWeather?.summary?.maxTemperature !== null
    ) {
      return {
        minTemperature: currentWeather.summary.minTemperature,
        maxTemperature: currentWeather.summary.maxTemperature,
      };
    }
    const valid = weatherCities.filter(
      (c) => c.temperatureC != null && Number.isFinite(c.temperatureC),
    );
    const first = valid[0];
    if (!first) return { minTemperature: undefined, maxTemperature: undefined };
    let min = first.temperatureC;
    let max = first.temperatureC;
    for (const c of valid) {
      if (c.temperatureC < min) min = c.temperatureC;
      if (c.temperatureC > max) max = c.temperatureC;
    }
    return { minTemperature: min, maxTemperature: max };
  }, [
    currentWeather?.summary?.minTemperature,
    currentWeather?.summary?.maxTemperature,
    weatherCities,
  ]);

  const weatherByCode = useMemo(() => {
    const result = new Map(weatherCities.map((city) => [city.id, city]));
    // No mapa do Brasil a leitura é da capital, identificada pela sigla da UF.
    for (const feature of collection?.features ?? []) {
      const abbreviation = feature.properties.abbreviation;
      const city = abbreviation ? result.get(abbreviation) : undefined;
      if (city) result.set(feature.properties.ibgeCode, city);
    }
    return result;
  }, [weatherCities, collection]);
  return {
    weatherCities,
    knownWeather: weatherCities,
    weatherByCode,
    maxRainfall,
    minTemperature,
    maxTemperature,
  };
}
