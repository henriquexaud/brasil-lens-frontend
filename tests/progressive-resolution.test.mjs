import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  Event: dom.window.Event,
  IS_REACT_ACT_ENVIRONMENT: true,
});

const { createElement: h, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const frontend = fileURLToPath(new URL('..', import.meta.url));
const scratch = await mkdtemp(join(frontend, 'node_modules', '.prog-res-tests-'));
const modulePath = join(scratch, 'hook.mjs');

const compiled = await build({
  stdin: {
    contents: `export { useProgressiveStateWeather, clearStateWeatherCacheForTesting } from './src/features/weather/useProgressiveStateWeather';`,
    resolveDir: frontend,
    loader: 'tsx',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  alias: { '@': join(frontend, 'src') },
  external: ['react', 'react-dom'],
});
await writeFile(modulePath, compiled.outputFiles[0].text);

const { useProgressiveStateWeather, clearStateWeatherCacheForTesting } = await import(pathToFileURL(modulePath).href);

let root;

beforeEach(() => {
  clearStateWeatherCacheForTesting();
  root = createRoot(document.getElementById('root'));
});

afterEach(async () => {
  await act(async () => root.unmount());
});

after(async () => {
  dom.window.close();
  await rm(scratch, { recursive: true, force: true });
});

test('useProgressiveStateWeather refina a resolução e temperatura estimada a cada novo lote de cidades reais', async () => {
  const stateFeatures = [
    {
      type: 'Feature',
      id: '35001',
      properties: { ibgeCode: '35001', name: 'Cidade Oeste' },
      geometry: { type: 'Polygon', coordinates: [[[-50.0, -22.0], [-49.9, -22.0], [-49.9, -21.9], [-50.0, -22.0]]] },
    },
    {
      type: 'Feature',
      id: '35002',
      properties: { ibgeCode: '35002', name: 'Cidade Centro' },
      geometry: { type: 'Polygon', coordinates: [[[-48.0, -22.0], [-47.9, -22.0], [-47.9, -21.9], [-48.0, -22.0]]] },
    },
    {
      type: 'Feature',
      id: '35003',
      properties: { ibgeCode: '35003', name: 'Cidade Leste' },
      geometry: { type: 'Polygon', coordinates: [[[-46.0, -22.0], [-45.9, -22.0], [-45.9, -21.9], [-46.0, -22.0]]] },
    },
  ];

  const cityOeste = {
    id: '35001',
    name: 'Cidade Oeste',
    stateAbbreviation: 'SP',
    latitude: -21.95,
    longitude: -49.95,
    temperatureC: 32.0,
    weatherCode: 0,
    observedAt: new Date().toISOString(),
    timezone: 'America/Sao_Paulo',
    forecast: [],
    isInferred: false,
  };

  const cityLeste = {
    id: '35003',
    name: 'Cidade Leste',
    stateAbbreviation: 'SP',
    latitude: -21.95,
    longitude: -45.95,
    temperatureC: 20.0,
    weatherCode: 1,
    observedAt: new Date().toISOString(),
    timezone: 'America/Sao_Paulo',
    forecast: [],
    isInferred: false,
  };

  const cityCentro = {
    id: '35002',
    name: 'Cidade Centro',
    stateAbbreviation: 'SP',
    latitude: -21.95,
    longitude: -47.95,
    temperatureC: 25.4,
    weatherCode: 2,
    observedAt: new Date().toISOString(),
    timezone: 'America/Sao_Paulo',
    forecast: [],
    isInferred: false,
  };

  let hookResult;
  function TestHarness({ realCities, isCoverageComplete }) {
    hookResult = useProgressiveStateWeather({
      stateCode: '35',
      stateFeatures,
      realCities,
      isCoverageComplete,
      enabled: true,
    });
    return null;
  }

  // Momento 1: Lote 1 chega apenas com Cidade Oeste (32°C)
  await act(async () => {
    root.render(h(TestHarness, { realCities: [cityOeste], isCoverageComplete: false }));
  });

  assert.equal(hookResult.totalCount, 3);
  assert.equal(hookResult.realCount, 1);
  assert.equal(hookResult.inferredCount, 2);
  assert.equal(hookResult.stage, 'immediate');

  // Cidade Oeste é real
  assert.equal(hookResult.weatherByCode.get('35001').isInferred, false);
  assert.equal(hookResult.weatherByCode.get('35001').temperatureC, 32.0);

  // Cidade Centro e Leste são estimadas a partir de Cidade Oeste (~32°C)
  assert.equal(hookResult.weatherByCode.get('35002').isInferred, true);
  assert.equal(hookResult.weatherByCode.get('35002').temperatureC, 32.0);

  // Momento 2: Lote 2 chega em segundo plano adicionando Cidade Leste (20°C)
  // Agora temos estações em extremos opostos. A estimativa da Cidade Centro DEVE REFINAR para ~26°C!
  await act(async () => {
    root.render(h(TestHarness, { realCities: [cityOeste, cityLeste], isCoverageComplete: false }));
  });

  assert.equal(hookResult.realCount, 2);
  assert.equal(hookResult.inferredCount, 1);
  // Cidade Leste virou real
  assert.equal(hookResult.weatherByCode.get('35003').isInferred, false);
  assert.equal(hookResult.weatherByCode.get('35003').temperatureC, 20.0);

  // A Cidade Centro CONTINUA estimada, mas sua temperatura FOI REFINADA!
  // Em vez de 32°C bruto do primeiro momento, o IDW agora pondera com a nova estação de 20°C
  const centroTempRefinada = hookResult.weatherByCode.get('35002').temperatureC;
  assert.ok(
    centroTempRefinada < 32.0 && centroTempRefinada > 20.0,
    `Estimativa deve ser refinada pela nova estação: esperado entre 20 e 32, obtido ${centroTempRefinada}`,
  );
  assert.equal(hookResult.weatherByCode.get('35002').isInferred, true);

  // Momento 3: Lote final chega com a medição real da Cidade Centro (25.4°C)
  await act(async () => {
    root.render(h(TestHarness, { realCities: [cityOeste, cityLeste, cityCentro], isCoverageComplete: true }));
  });

  assert.equal(hookResult.realCount, 3);
  assert.equal(hookResult.inferredCount, 0);
  assert.equal(hookResult.stage, 'final');
  assert.equal(hookResult.weatherByCode.get('35002').isInferred, false);
  assert.equal(hookResult.weatherByCode.get('35002').temperatureC, 25.4);
});

test('useProgressiveStateWeather restringe todo cálculo e estimativa estritamente dentro do estado ativo', async () => {
  const mixedFeatures = [
    {
      type: 'Feature',
      id: '35001',
      properties: { ibgeCode: '35001', name: 'Cidade de SP' },
      geometry: { type: 'Polygon', coordinates: [[[-47.0, -23.0], [-46.9, -23.0], [-46.9, -22.9], [-47.0, -23.0]]] },
    },
    {
      type: 'Feature',
      id: '33001',
      properties: { ibgeCode: '33001', name: 'Cidade do RJ' },
      geometry: { type: 'Polygon', coordinates: [[[-43.0, -22.0], [-42.9, -22.0], [-42.9, -21.9], [-43.0, -22.0]]] },
    },
  ];

  const citySP = {
    id: '35001',
    name: 'Cidade de SP',
    stateAbbreviation: 'SP',
    latitude: -22.95,
    longitude: -46.95,
    temperatureC: 28.0,
    weatherCode: 0,
    observedAt: new Date().toISOString(),
    timezone: 'America/Sao_Paulo',
    forecast: [],
    isInferred: false,
  };

  const cityRJ = {
    id: '33001',
    name: 'Cidade do RJ',
    stateAbbreviation: 'RJ',
    latitude: -21.95,
    longitude: -42.95,
    temperatureC: 35.0,
    weatherCode: 0,
    observedAt: new Date().toISOString(),
    timezone: 'America/Sao_Paulo',
    forecast: [],
    isInferred: false,
  };

  let hookResult;
  function TestHarness({ realCities }) {
    hookResult = useProgressiveStateWeather({
      stateCode: '35',
      stateFeatures: mixedFeatures,
      realCities,
      isCoverageComplete: false,
      enabled: true,
    });
    return null;
  }

  await act(async () => {
    root.render(h(TestHarness, { realCities: [citySP, cityRJ] }));
  });

  // Somente a feição de SP ('35') deve ser contabilizada no totalCount
  assert.equal(hookResult.totalCount, 1);
  // Somente a cidade de SP ('35') deve ser medida
  assert.equal(hookResult.realCount, 1);
  assert.equal(hookResult.inferredCount, 0);
  // Não pode conter cidades do RJ ('33')
  assert.equal(hookResult.weatherByCode.has('33001'), false);
  assert.equal(hookResult.weatherByCode.has('35001'), true);
  assert.ok(hookResult.measuredCities.every((c) => c.id.startsWith('35')));
});


