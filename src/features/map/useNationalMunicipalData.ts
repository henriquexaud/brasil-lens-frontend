import { hashKey, isCancelledError, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { geometryOptions } from '@/api/queries';
import type { MapFeatureCollection, WeatherCity, WeatherCurrentResponse } from '@/api/types';
import { mergeWeatherCities } from '@/features/weather/mergeWeatherCities';
import { seedCityWeather, stateWeatherOptions } from '@/features/weather/queries';
import { scheduleIdle } from '@/lib/idle';

export interface NationalMesh {
  states: MapFeatureCollection;
  municipalities: MapFeatureCollection[];
}

export interface NationalMunicipalWeather {
  mesh: NationalMesh;
  byCode: Map<string, WeatherCity>;
  responses: WeatherCurrentResponse[];
  stale: boolean;
}

interface Input {
  states?: MapFeatureCollection;
  enabled: boolean;
  weatherEnabled: boolean;
  weatherRevision?: string;
}

export function useNationalMunicipalData({
  states,
  enabled,
  weatherEnabled,
  weatherRevision,
}: Input) {
  const client = useQueryClient();
  const [mesh, setMesh] = useState<NationalMesh>();
  const [weather, setWeather] = useState<NationalMunicipalWeather>();
  const [weatherError, setWeatherError] = useState<unknown>();
  const [meshError, setMeshError] = useState<unknown>();
  const [retryRevision, setRetryRevision] = useState(0);
  const inFlight = useRef<Promise<unknown>>();
  const failures = useRef(new Set<string>());
  const stateKey =
    states?.features
      .map((feature) => feature.properties.ibgeCode)
      .sort()
      .join(',') ?? '';
  const codes = useMemo(() => (stateKey ? stateKey.split(',') : []), [stateKey]);

  useEffect(
    () =>
      client.getQueryCache().subscribe((event) => {
        if (event.type !== 'updated' || event.action.type !== 'invalidate') return;
        const [domain, kind] = event.query.queryKey;
        if (
          (domain === 'weather' && kind === 'state') ||
          (domain === 'map' && kind === 'municipality')
        ) {
          failures.current.delete(event.query.queryHash);
          setRetryRevision((value) => value + 1);
        }
      }),
    [client],
  );

  useEffect(() => {
    if (!enabled || !states || codes.length === 0) return;
    let stopped = false;
    let cancelIdle: (() => void) | undefined;
    let index = 0;
    let loadingWeather = false;
    let completeMesh: NationalMesh;
    const municipalities: MapFeatureCollection[] = [];
    const responses: WeatherCurrentResponse[] = [];
    let pendingKey: QueryKey | undefined;

    const checkFailure = (queryKey: QueryKey) => {
      const cached = client.getQueryState(queryKey);
      // A pause/resume must not turn a failed background request into a retry loop.
      if (
        failures.current.has(hashKey(queryKey)) ||
        (cached?.status === 'error' && !cached.isInvalidated)
      )
        throw cached?.error ?? new Error('Não foi possível completar os dados municipais.');
    };
    const schedule = () => {
      if (!stopped)
        cancelIdle = scheduleIdle(() => {
          void step();
        });
    };
    const step = async () => {
      try {
        if (inFlight.current) await inFlight.current.catch(() => {});
        if (stopped) return;
        const parent = codes[index];
        if (!parent) return;
        if (!loadingWeather) {
          const detail = client.getQueryData<MapFeatureCollection>(
            geometryOptions('municipality', parent, 'detail').queryKey,
          );
          const options = geometryOptions('municipality', parent, detail ? 'detail' : 'overview');
          pendingKey = options.queryKey;
          checkFailure(options.queryKey);
          const request = client.fetchQuery({ ...options, retry: false });
          inFlight.current = request;
          const collection = await request;
          if (stopped) return;
          if (
            collection.scope.parent !== parent ||
            collection.scope.level !== 'municipality' ||
            collection.features.length !== collection.scope.count ||
            collection.features.length === 0
          )
            throw new Error('A malha municipal ainda não está completa.');
          municipalities.push(collection);
        } else {
          const options = stateWeatherOptions(parent);
          pendingKey = options.queryKey;
          checkFailure(options.queryKey);
          const request = client.fetchQuery({ ...options, retry: false });
          inFlight.current = request;
          const response = await request;
          seedCityWeather(
            client,
            response,
            response.cities.filter((city) => !city.isInferred),
          );
          if (stopped) return;
          const byCode = new Map(response.cities.map((city) => [city.id, city]));
          if (
            !completeMesh.municipalities[index]!.features.every((feature) =>
              byCode.has(feature.properties.ibgeCode),
            )
          )
            throw new Error('Os dados municipais ainda não estão completos.');
          responses.push(response);
        }
        index += 1;
        if (index === codes.length) {
          if (!loadingWeather) {
            completeMesh = { states, municipalities };
            setMeshError(undefined);
            setMesh((previous) =>
              previous?.states === states &&
              previous.municipalities.length === municipalities.length &&
              previous.municipalities.every((collection, i) => collection === municipalities[i])
                ? previous
                : completeMesh,
            );
            if (!weatherEnabled) return;
            loadingWeather = true;
            index = 0;
          } else {
            const byCode = new Map<string, WeatherCity>();
            for (const response of responses) mergeWeatherCities(byCode, response.cities);
            // Selection and viewport queries may already contain newer measurements.
            for (const [key, cached] of client.getQueriesData<WeatherCurrentResponse>({
              queryKey: ['weather'],
            })) {
              if (['current', 'viewport'].includes(String(key[1])) && cached?.cities)
                mergeWeatherCities(
                  byCode,
                  cached.cities.filter((city) => byCode.has(city.id)),
                );
            }
            setWeather((previous) =>
              previous?.mesh.states === states &&
              previous.responses.length === responses.length &&
              previous.responses.every((response, i) => response === responses[i]) &&
              previous.mesh.municipalities.every(
                (collection, i) => collection === municipalities[i],
              ) &&
              [...byCode].every(([code, city]) => previous.byCode.get(code) === city)
                ? previous
                : {
                    mesh: completeMesh,
                    byCode,
                    responses,
                    stale: responses.some((response) => response.status === 'stale'),
                  },
            );
            setWeatherError(undefined);
            return;
          }
        }
        schedule();
      } catch (failure) {
        if (isCancelledError(failure)) return;
        if (pendingKey) {
          failures.current.add(hashKey(pendingKey));
          // Consume this refresh attempt so a later explicit invalidation can
          // signal a new retry even when TanStack retains an older cached value.
          client
            .getQueryCache()
            .find({ queryKey: pendingKey, exact: true })
            ?.setState({ isInvalidated: false });
        }
        if (!stopped && loadingWeather) setWeatherError(failure);
        if (!stopped && !loadingWeather) setMeshError(failure);
      } finally {
        inFlight.current = undefined;
      }
    };
    schedule();
    return () => {
      stopped = true;
      cancelIdle?.();
    };
  }, [client, codes, enabled, states, weatherEnabled, weatherRevision, retryRevision]);

  return { mesh, weather, weatherError, meshError };
}
