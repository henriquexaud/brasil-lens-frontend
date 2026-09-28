import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><div id="root"></div>');
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  IS_REACT_ACT_ENVIRONMENT: true,
});
const { createElement: h, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const frontend = fileURLToPath(new URL('..', import.meta.url));
const scratch = await mkdtemp(join(frontend, 'node_modules', '.map-data-tests-'));
const compiled = await build({
  stdin: {
    contents: `export { useWeatherMapData } from './src/features/weather/useWeatherMapData';
      export { ViewportObserver } from './src/features/map/ViewportObserver';
      export { DiscoveredMosaic } from './src/features/map/discoveredMosaic';`,
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
  plugins: [{
    name: 'map-stub',
    setup(builder) {
      builder.onResolve({ filter: /^react-leaflet$/ }, () => ({ path: 'map', namespace: 'stub' }));
      builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
        contents: 'export const useMap = () => globalThis.testMap;',
      }));
    },
  }],
});
const modulePath = join(scratch, 'harness.mjs');
await writeFile(modulePath, compiled.outputFiles[0].text);
const { useWeatherMapData, ViewportObserver, DiscoveredMosaic } = await import(pathToFileURL(modulePath).href);
let root, result;
const reading = (temperatureC, hour, extra = {}) => ({
  id: '3550308', observedAt: `2026-09-27T${hour}:00:00Z`, temperatureC,
  precipitation48hMm: 0, ...extra,
});
const data = (cities) => ({ cities });
const defaults = {
  scope: { parent: '35' }, isDrilledDown: true, closeMunicipalView: false,
  selectedCode: null, stateWeather: {}, municipalities: {}, nearbyWeather: {},
  nationalWeather: {}, selectedWeather: {},
};

test('mosaico conserva estados visitados e prefere a geometria mais detalhada ao voltar ao Brasil', () => {
  const mosaic = new DiscoveredMosaic();
  const feature = (id, marker) => ({
    type: 'Feature', id,
    properties: { ibgeCode: id, level: 'municipality' },
    geometry: { type: 'MultiPolygon', coordinates: [[[[marker, 0], [1, 0], [1, 1], [marker, 0]]]] },
  });
  const spOverview = feature('3550308', 1);
  const spDetail = feature('3550308', 2);
  const rjDetail = feature('3304557', 3);
  mosaic.addCollection({ scope: { level: 'municipality', parent: '35', lod: 'overview' }, features: [spOverview] }, '35');
  mosaic.addCollection({ scope: { level: 'municipality', parent: '35', lod: 'detail' }, features: [spDetail] }, '35');
  mosaic.addCollection({ scope: { level: 'municipality', parent: '33', lod: 'detail' }, features: [rjDetail] }, '33');
  mosaic.addCollection({ scope: { level: 'municipality', parent: '35', lod: 'overview' }, features: [spOverview] }, '35');
  assert.deepEqual(mosaic.forState('35'), [spDetail]);
  assert.deepEqual(mosaic.all(), [spDetail, rjDetail]);
  assert.equal(mosaic.version, 3);
  assert.deepEqual([...mosaic.versions()], [['35', 2], ['33', 3]]);
});
function WeatherData(props) {
  result = useWeatherMapData({ ...defaults, ...props });
  return null;
}
async function render(props) {
  await act(async () => root.render(h(WeatherData, props)));
}
beforeEach(() => { root = createRoot(document.getElementById('root')); });
afterEach(async () => {
  await act(async () => root.unmount());
  delete globalThis.testMap;
});
after(async () => {
  dom.window.close();
  await rm(scratch, { recursive: true, force: true });
});

test('uma cidade já selecionada recebe a leitura nova do estado, sem restaurar o cache antigo', async () => {
  const old = reading(20, '10');
  await render({ selectedCode: old.id, selectedWeather: { data: data([old]) } });
  assert.equal(result.weatherByCode.get(old.id).temperatureC, 20);
  await render({ stateWeather: { data: data([reading(28, '11')]) } });
  assert.equal(result.weatherByCode.get(old.id).temperatureC, 28);
  assert.equal(result.weatherCities[0].temperatureC, 28);
  await render({ selectedCode: old.id, selectedWeather: { data: data([old]) } });
  assert.equal(result.weatherByCode.get(old.id).temperatureC, 28, 'resposta atrasada não vence');
});

test('histórico climático prioriza medições no mesmo horário e aceita estimativas mais novas', async () => {
  const measured = reading(23, '10');
  await render({ selectedCode: measured.id, selectedWeather: { data: data([measured]) } });
  await render({ stateWeather: { data: data([reading(19, '10', { isInferred: true })]) } });
  assert.equal(result.weatherByCode.get(measured.id).temperatureC, 23);
  await render({ stateWeather: { data: data([reading(30, '11', { isInferred: true })]) } });
  assert.equal(result.weatherByCode.get(measured.id).temperatureC, 30);
  await render({ stateWeather: { data: data([reading(29, '11')]) } });
  assert.equal(result.weatherByCode.get(measured.id).temperatureC, 29);
});

test('histórico preserva cidades fora da janela e limpa todas ao trocar de UF', async () => {
  const city = reading(23, '10');
  await render({ closeMunicipalView: true, nearbyWeather: { data: data([city]) } });
  await render({ closeMunicipalView: true, nearbyWeather: { data: data([]) } });
  assert.equal(result.weatherByCode.size, 1);
  await render({ scope: { parent: '33' }, stateWeather: { data: data([city]) } });
  assert.equal(result.weatherByCode.size, 0);
});

test('média estadual substitui a capital mesmo quando o ponto mais antigo da média é anterior', async () => {
  const props = {
    scope: { parent: null }, isDrilledDown: false, selectedCode: '35',
    collection: { features: [{ properties: { abbreviation: 'SP', ibgeCode: '35' } }] },
  };
  const capital = reading(30, '11', { id: 'SP', name: 'São Paulo' });
  await render({ ...props, nationalWeather: { data: data([capital]) } });
  assert.equal(result.weatherByCode.get('35').temperatureC, 30);
  const average = reading(24, '10', { id: 'SP', name: 'São Paulo', samplePoints: 8 });
  await render({
    ...props, nationalWeather: { data: data([average]) },
    selectedWeather: { data: data([capital]) },
  });
  assert.deepEqual(result.weatherCities, [average]);
  assert.equal(result.weatherByCode.get('35').temperatureC, 24);
  assert.equal(result.weatherByCode.get('35').samplePoints, 8, 'o mapa usa a média, não a capital selecionada');
});

test('movimento pausa o trabalho de fundo imediatamente e publica a nova área ao assentar', async () => {
  const handlers = new Map();
  let west = -48;
  globalThis.testMap = {
    getZoom: () => 8,
    getBounds: () => ({ getWest: () => west, getSouth: () => -24, getEast: () => -46, getNorth: () => -22 }),
    on(events, callback) { for (const event of events.split(' ')) handlers.set(event, callback); },
    off(events) { for (const event of events.split(' ')) handlers.delete(event); },
  };
  const updates = [];
  await act(async () => root.render(h(ViewportObserver, {
    scopeKey: 'municipality:35', onChange: (viewport) => updates.push(viewport),
  })));
  const initialArea = updates[0].bbox;
  assert.equal(updates[0].moving, false);
  handlers.get('movestart')();
  handlers.get('zoomstart')();
  assert.equal(updates.length, 2, 'pan e zoom simultâneos emitem uma pausa');
  assert.equal(updates[1].moving, true);
  assert.equal(updates[1].bbox, initialArea);
  west = -49;
  handlers.get('moveend')();
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(updates.at(-1).moving, false);
  assert.notEqual(updates.at(-1).bbox, initialArea);
  assert.equal(updates.at(-1).scopeKey, 'municipality:35');
  await act(async () => root.render(null));
  assert.equal(handlers.size, 0, 'desmontagem libera todos os ouvintes');
});
