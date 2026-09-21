import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getFeatureCentroid,
  interpolateSingleMunicipalWeather,
  interpolateStateWeather,
  mergeWeatherWithPrecedence,
} from '../src/features/weather/spatialInterpolation.ts';

test('getFeatureCentroid calcula corretamente o centro de polígonos GeoJSON', () => {
  const feature = {
    type: 'Feature',
    id: '3550308',
    properties: { ibgeCode: '3550308', name: 'São Paulo' },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-46.8, -23.7],
          [-46.4, -23.7],
          [-46.4, -23.4],
          [-46.8, -23.4],
          [-46.8, -23.7],
        ],
      ],
    },
  };

  const centroid = getFeatureCentroid(feature);
  assert.ok(centroid);
  assert.equal(centroid[0], -23.55);
  assert.equal(centroid[1], -46.6);
});

test('interpolateSingleMunicipalWeather aplica IDW e vizinho mais próximo', () => {
  const stations = [
    {
      id: 'cityA',
      name: 'Cidade A',
      latitude: -23.0,
      longitude: -46.0,
      temperatureC: 20.0,
      weatherCode: 1,
    },
    {
      id: 'cityB',
      name: 'Cidade B',
      latitude: -23.0,
      longitude: -47.0,
      temperatureC: 30.0,
      weatherCode: 2,
    },
  ];

  // Município bem no meio entre Cidade A (20°C) e Cidade B (30°C)
  const targetMid = {
    id: 'targetMid',
    name: 'Cidade Meio',
    latitude: -23.0,
    longitude: -46.5,
  };

  const estimatedMid = interpolateSingleMunicipalWeather(targetMid, stations, 'SP');
  assert.ok(estimatedMid);
  assert.equal(estimatedMid.isInferred, true);
  // No ponto médio simétrico, o IDW deve resultar em 25°C
  assert.equal(estimatedMid.temperatureC, 25.0);

  // Município muito próximo da Cidade A (-46.01) deve ter temperatura ~20°C e código 1
  const targetNearA = {
    id: 'targetNearA',
    name: 'Cidade Próxima A',
    latitude: -23.0,
    longitude: -46.01,
  };
  const estimatedNearA = interpolateSingleMunicipalWeather(targetNearA, stations, 'SP');
  assert.ok(estimatedNearA);
  assert.ok(estimatedNearA.temperatureC < 21.0);
  assert.equal(estimatedNearA.weatherCode, 1);
});

test('interpolateStateWeather preenche 100% dos municípios não medidos', () => {
  const features = [
    {
      type: 'Feature',
      id: '3500105',
      properties: { ibgeCode: '3500105', name: 'Adamantina' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[-51.1, -21.7], [-51.0, -21.7], [-51.0, -21.6], [-51.1, -21.6], [-51.1, -21.7]]],
      },
    },
    {
      type: 'Feature',
      id: '3500204',
      properties: { ibgeCode: '3500204', name: 'Adolfo' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[-49.7, -21.3], [-49.6, -21.3], [-49.6, -21.2], [-49.7, -21.2], [-49.7, -21.3]]],
      },
    },
  ];

  const realCity = {
    id: '3550308',
    name: 'São Paulo',
    stateAbbreviation: 'SP',
    latitude: -23.55,
    longitude: -46.63,
    timezone: 'America/Sao_Paulo',
    observedAt: new Date().toISOString(),
    temperatureC: 22.5,
    apparentTemperatureC: 23.0,
    humidityPct: 65,
    windSpeedKmh: 10,
    precipitationMm: 0,
    precipitationIntervalMinutes: 15,
    weatherCode: 0,
    forecast: [],
    isInferred: false,
  };

  const estimatedMap = interpolateStateWeather(features, [realCity], 'SP');
  assert.equal(estimatedMap.size, 2);
  assert.ok(estimatedMap.has('3500105'));
  assert.ok(estimatedMap.has('3500204'));
  assert.equal(estimatedMap.get('3500105').isInferred, true);
  assert.equal(estimatedMap.get('3500105').temperatureC, 22.5);
});

test('mergeWeatherWithPrecedence garante que dados reais nunca são sobrescritos por estimativas', () => {
  const realCity = {
    id: '3550308',
    name: 'São Paulo',
    stateAbbreviation: 'SP',
    latitude: -23.55,
    longitude: -46.63,
    timezone: 'America/Sao_Paulo',
    observedAt: new Date().toISOString(),
    temperatureC: 22.0,
    apparentTemperatureC: 22.0,
    humidityPct: 60,
    windSpeedKmh: 5,
    precipitationMm: 0,
    precipitationIntervalMinutes: 15,
    weatherCode: 0,
    forecast: [],
    isInferred: false,
  };

  const estimatedCity = {
    ...realCity,
    temperatureC: 99.9, // Valor absurdo para testar se sobrescreve
    isInferred: true,
  };

  const baseMap = new Map([['3550308', realCity]]);

  // 1. Tentar sobrescrever dado real com estimativa -> DEVE MANTER O REAL (22°C)
  const afterEstimate = mergeWeatherWithPrecedence(baseMap, [estimatedCity]);
  assert.equal(afterEstimate.get('3550308').temperatureC, 22.0);
  assert.equal(afterEstimate.get('3550308').isInferred, false);

  // 2. Substituir estimativa por dado real -> DEVE ATUALIZAR PARA O REAL
  const estimatedMap = new Map([['3550308', estimatedCity]]);
  const afterReal = mergeWeatherWithPrecedence(estimatedMap, [realCity]);
  assert.equal(afterReal.get('3550308').temperatureC, 22.0);
  assert.equal(afterReal.get('3550308').isInferred, false);
});

test('refinamento progressivo: momento 1 (amostra inicial) -> momento 2 (lotes) -> momento 3 (final)', () => {
  const features = [
    { type: 'Feature', id: '1', properties: { ibgeCode: '1', name: 'Cidade 1' }, geometry: { type: 'Polygon', coordinates: [[[-46, -23], [-45.9, -23], [-45.9, -22.9], [-46, -23]]] } },
    { type: 'Feature', id: '2', properties: { ibgeCode: '2', name: 'Cidade 2' }, geometry: { type: 'Polygon', coordinates: [[[-47, -23], [-46.9, -23], [-46.9, -22.9], [-47, -23]]] } },
    { type: 'Feature', id: '3', properties: { ibgeCode: '3', name: 'Cidade 3' }, geometry: { type: 'Polygon', coordinates: [[[-48, -23], [-47.9, -23], [-47.9, -22.9], [-48, -23]]] } },
  ];

  const city1 = { id: '1', name: 'Cidade 1', stateAbbreviation: 'SP', latitude: -22.95, longitude: -45.95, temperatureC: 24, weatherCode: 1, isInferred: false };
  const city2 = { id: '2', name: 'Cidade 2', stateAbbreviation: 'SP', latitude: -22.95, longitude: -46.95, temperatureC: 26, weatherCode: 2, isInferred: false };
  const city3 = { id: '3', name: 'Cidade 3', stateAbbreviation: 'SP', latitude: -22.95, longitude: -47.95, temperatureC: 28, weatherCode: 0, isInferred: false };

  // Momento 1: Resposta imediata com apenas a Cidade 1 disponível
  let currentMap = new Map([['1', city1]]);
  const estimatedBatch1 = interpolateStateWeather(features, [city1], 'SP');
  currentMap = mergeWeatherWithPrecedence(currentMap, estimatedBatch1);

  // Todo o território está coberto (1 real, 2 estimados)
  assert.equal(currentMap.size, 3);
  assert.equal(currentMap.get('1').isInferred, false);
  assert.equal(currentMap.get('2').isInferred, true);
  assert.equal(currentMap.get('3').isInferred, true);

  // Momento 2: Chegada do segundo lote (Cidade 2)
  currentMap = mergeWeatherWithPrecedence(currentMap, [city2]);
  const estimatedBatch2 = interpolateStateWeather(features, [city1, city2], 'SP');
  currentMap = mergeWeatherWithPrecedence(currentMap, estimatedBatch2);

  assert.equal(currentMap.size, 3);
  assert.equal(currentMap.get('1').isInferred, false);
  assert.equal(currentMap.get('2').isInferred, false); // Agora é real!
  assert.equal(currentMap.get('3').isInferred, true);  // Continua estimado

  // Momento 3: Estado final (Cidade 3 chega)
  currentMap = mergeWeatherWithPrecedence(currentMap, [city3]);
  assert.equal(currentMap.size, 3);
  assert.equal(currentMap.get('1').isInferred, false);
  assert.equal(currentMap.get('2').isInferred, false);
  assert.equal(currentMap.get('3').isInferred, false); // Todos agora são reais!
  assert.equal(currentMap.get('3').temperatureC, 28);
});

