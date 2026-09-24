import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [userSelectedCities, setUserSelectedCities] = useState<Map<string, WeatherCity>>(
    () => new Map(),
  );

  // Limpa as cidades manuais ao trocar de estado ou voltar ao mapa nacional
  useEffect(() => {
    setUserSelectedCities(new Map());
  }, [scope.parent]);

  // Mantém no mapa qualquer município que for consultado/selecionado pelo usuário
  useEffect(() => {
    if (isDrilledDown && selectedCode?.length === 7 && selectedWeather.data?.cities?.length) {
      setUserSelectedCities((prev) => {
        const incoming = selectedWeather.data?.cities ?? [];
        let hasChanges = false;
        for (const c of incoming) {
          if (prev.get(c.id) !== c) {
            hasChanges = true;
            break;
          }
        }
        if (!hasChanges) return prev;
        const next = new Map(prev);
        for (const c of incoming) {
          next.set(c.id, c);
        }
        return next;
      });
    }
  }, [isDrilledDown, selectedCode, selectedWeather.data]);

  const weatherCities = useMemo(() => {
    const cities = isDrilledDown
      ? (stateWeather.data?.cities ??
        municipalities.data?.pages.flatMap((page) => page.cities) ??
        [])
      : (nationalWeather.data?.cities ?? []);
    const byId = new Map(cities.map((city) => [city.id, city]));
    if (closeMunicipalView) {
      for (const city of nearbyWeather.data?.cities ?? []) byId.set(city.id, city);
    }
    if (isDrilledDown) {
      for (const c of userSelectedCities.values()) {
        byId.set(c.id, c);
      }
    }
    // Um município selecionado traz a sua própria leitura. Uma UF traz a da
    // capital, que não substitui a média do estado no mapa.
    if (selectedCode?.length === 7) {
      for (const c of selectedWeather.data?.cities ?? []) {
        byId.set(c.id, c);
      }
    }
    const all = [...byId.values()];
    if (isDrilledDown && scope.parent) {
      return all.filter((c) => c.id.startsWith(scope.parent!));
    }
    return all;
  }, [
    isDrilledDown,
    scope.parent,
    stateWeather.data,
    municipalities.data,
    closeMunicipalView,
    nearbyWeather.data,
    nationalWeather.data,
    userSelectedCities,
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

  // Leituras ficam guardadas por cidade dentro do recorte: a janela de
  // viewport muda durante o pan/zoom e sua resposta pode chegar vazia por um
  // instante, e uma cidade não deve perder a cor só porque saiu da janela.
  // Uma estimativa (interpolada no servidor) nunca substitui uma medição já
  // recebida para o mesmo horário ou mais recente.
  const knownWeatherRef = useRef({ scope: scope.parent, byId: new Map<string, WeatherCity>() });
  const knownWeather = useMemo(() => {
    if (knownWeatherRef.current.scope !== scope.parent) {
      knownWeatherRef.current = { scope: scope.parent, byId: new Map() };
    }
    const { byId } = knownWeatherRef.current;
    for (const city of weatherCities) {
      const known = byId.get(city.id);
      const keepMeasured =
        city.isInferred &&
        known &&
        !known.isInferred &&
        Date.parse(known.observedAt) >= Date.parse(city.observedAt);
      if (!keepMeasured) byId.set(city.id, city);
    }
    return [...byId.values()];
  }, [scope.parent, weatherCities]);
  const weatherByCode = useMemo(() => {
    const result = new Map(knownWeather.map((city) => [city.id, city]));
    // No mapa do Brasil a leitura é da capital, identificada pela sigla da UF.
    for (const feature of collection?.features ?? []) {
      const abbreviation = feature.properties.abbreviation;
      const city = abbreviation ? result.get(abbreviation) : undefined;
      if (city) result.set(feature.properties.ibgeCode, city);
    }
    return result;
  }, [knownWeather, collection]);
  return {
    weatherCities,
    knownWeather,
    weatherByCode,
    maxRainfall,
    minTemperature,
    maxTemperature,
  };
}
