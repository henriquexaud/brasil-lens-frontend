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
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const frontend = fileURLToPath(new URL('..', import.meta.url));
const scratch = await mkdtemp(join(frontend, 'node_modules', '.progressive-tests-'));
const modulePath = join(scratch, 'harness.mjs');
const compiled = await build({
  stdin: {
    contents: `export { useMunicipalityWeather, useWeatherCurrent, weatherCurrentOptions, useSearchIndex } from './src/api/queries';
    export { Disclosure } from './src/components/Disclosure';`,
    resolveDir: frontend,
    loader: 'tsx',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  alias: { '@': join(frontend, 'src') },
  external: ['react', 'react-dom', '@tanstack/react-query'],
  define: { 'import.meta.env.VITE_API_BASE_URL': '"http://api.test/api/v1"' },
});
await writeFile(modulePath, compiled.outputFiles[0].text);
const {
  Disclosure,
  useWeatherCurrent,
  weatherCurrentOptions,
  useMunicipalityWeather,
  useSearchIndex,
} = await import(pathToFileURL(modulePath).href);
let root, client, requests, respond, idle;
const city = (id) => ({
  id,
  name: `Cidade ${id}`,
  stateAbbreviation: 'SP',
  latitude: -23,
  longitude: -47,
  observedAt: new Date().toISOString(),
  timezone: 'America/Sao_Paulo',
  temperatureC: 24,
  apparentTemperatureC: 25,
  humidityPct: 70,
  windSpeedKmh: 8,
  precipitationMm: 0,
  precipitationIntervalMinutes: 15,
  weatherCode: 0,
  forecast: [],
});
const page = (ids, nextOffset = null) => ({
  source: 'Open-Meteo',
  sourceUrl: 'https://open-meteo.com/',
  fetchedAt: new Date().toISOString(),
  status: 'ok',
  cities: ids.map(city),
  nextOffset,
});
async function tick(ms = 20) {
  await act(() => new Promise((resolve) => setTimeout(resolve, ms)));
}
async function until(check) {
  for (let i = 0; i < 100 && !check(); i++) await tick();
  assert.ok(check(), 'O estado esperado não foi atingido');
}
async function render(component) {
  await act(async () => root.render(h(QueryClientProvider, { client }, component)));
}
async function runIdle() {
  await act(async () => {
    for (const [key, work] of [...idle]) {
      idle.delete(key);
      work();
    }
  });
}

beforeEach(() => {
  requests = [];
  idle = new Map();
  let nextIdle = 0;
  window.requestIdleCallback = (work) => {
    const id = ++nextIdle;
    idle.set(id, work);
    return id;
  };
  window.cancelIdleCallback = (id) => idle.delete(id);
  respond = async () => new Response(JSON.stringify(page(['3509502'])), { status: 200 });
  globalThis.fetch = async (url, options) => {
    requests.push({ url: new URL(url), signal: options?.signal });
    return respond(new URL(url), options);
  };
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  root = createRoot(document.getElementById('root'));
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
});
after(async () => {
  dom.window.close();
  await rm(scratch, { recursive: true, force: true });
});

test('previsão fechada não monta conteúdo nem consulta a API; Escape fecha e devolve foco', async () => {
  function Forecast() {
    useWeatherCurrent('3509502', true, true);
    return h('p', null, 'Previsão carregada');
  }
  await render(h(Disclosure, { title: 'Próximos dias' }, h(Forecast)));
  await tick();
  assert.equal(requests.length, 0);
  assert.equal(document.querySelector('p'), null);
  const details = document.querySelector('details');
  await act(async () => {
    details.open = true;
    details.dispatchEvent(new window.Event('toggle'));
  });
  await until(() => requests.length === 1);
  assert.equal(requests[0].url.searchParams.get('forecast'), 'true');
  await act(async () =>
    details.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
  );
  await tick();
  assert.equal(details.open, false);
  assert.equal(document.activeElement, details.querySelector('summary'));
});

test('lotes esperam o mapa, pausam durante a seleção e aquecem somente condições atuais', async () => {
  function Batch({ ready, pause }) {
    useMunicipalityWeather('35', ready, pause);
    return null;
  }
  respond = async (url) =>
    new Response(
      JSON.stringify(
        url.searchParams.get('offset') === '0' ? page(['3500105'], 16) : page(['3500204'], 32),
      ),
      { status: 200 },
    );
  await render(h(Batch, { ready: false, pause: false }));
  assert.equal(requests.length, 0);
  await render(h(Batch, { ready: true, pause: false }));
  await until(() => client.getQueryData(weatherCurrentOptions('3500105').queryKey));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url.searchParams.get('limit'), '16');
  await render(h(Batch, { ready: true, pause: true }));
  await tick(50);
  await runIdle();
  assert.equal(requests.length, 1, 'não inicia outro lote enquanto a seleção carrega');
  await render(h(Batch, { ready: true, pause: false }));
  await tick(1250);
  await runIdle();
  await until(() => client.getQueryData(weatherCurrentOptions('3500204').queryKey));
  assert.equal(requests.length, 2);
  assert.equal(client.getQueryData(weatherCurrentOptions('3500105', true).queryKey), undefined);
  const cached = await client.fetchQuery(weatherCurrentOptions('3500105'));
  assert.equal(cached.cities[0].temperatureC, 24);
  assert.equal(requests.length, 2, 'selecionar um município já carregado reutiliza o cache');
  await tick(1300);
  await runIdle();
  assert.equal(requests.length, 2, 'pausa após atingir o limite de etapas de cobertura');
});

test('sair do recorte cancela a requisição de fundo em andamento', async () => {
  function Batch({ ready }) {
    useMunicipalityWeather('35', ready, false);
    return null;
  }
  respond = async (_url, options) =>
    new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () =>
        reject(new DOMException('Cancelado', 'AbortError')),
      );
    });
  await render(h(Batch, { ready: true }));
  await until(() => requests.length === 1);
  assert.equal(requests[0].signal.aborted, false);
  await render(h(Batch, { ready: false }));
  assert.equal(requests[0].signal.aborted, true);
});

test('busca não carrega o catálogo enquanto estiver sem foco e antes do mapa', async () => {
  function Search({ enabled }) {
    useSearchIndex(enabled);
    return null;
  }
  respond = async () =>
    new Response(JSON.stringify({ territories: [], pagination: { total: 0 } }), { status: 200 });
  await render(h(Search, { enabled: false }));
  await tick();
  assert.equal(requests.length, 0);
  await render(h(Search, { enabled: true }));
  await until(() => requests.length === 2);
  assert.deepEqual(requests.map((request) => request.url.searchParams.get('level')).sort(), [
    'municipality',
    'state',
  ]);
});
