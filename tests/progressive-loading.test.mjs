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
    contents: `export { useMunicipalityWeather, useWeatherCurrent, weatherCurrentOptions, useSearchIndex, useFireHotspots, useFireHotspotDetails, useFireSummary, useHydrography, useViewportWeather, useCapitalsWeather, useVisibleMunicipalities, useSelectedBoundary } from './src/api/queries';
    export { useDeferredReady } from './src/lib/useDeferredReady';
    export { Disclosure } from './src/components/Disclosure';
    export { LocationButton } from './src/features/search/LocationButton';`,
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
  useFireHotspots,
  useFireHotspotDetails,
  useFireSummary,
  useHydrography,
  useDeferredReady,
  useViewportWeather,
  useCapitalsWeather,
  useVisibleMunicipalities,
  useSelectedBoundary,
  LocationButton,
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
        url.searchParams.get('offset') === '0' ? page(['3500105'], 16) :
          url.searchParams.get('offset') === '16' ? page(['3500204'], 32) : page(['3500303']),
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
  await until(() => client.getQueryData(weatherCurrentOptions('3500303').queryKey));
  assert.equal(requests.length, 3, 'continua além das antigas duas etapas');
  await tick(400); await runIdle();
  assert.equal(requests.length, 3, 'encerra quando não há próxima página');
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

test('focos só consultam metadados quando ativos; detalhes esperam o clique', async () => {
  function Fire({ enabled, location }) {
    useFireHotspots({ level: 'state', parent: '15' }, enabled);
    useFireHotspotDetails({ level: 'state', parent: '15' }, location);
    return null;
  }
  respond = async () =>
    new Response(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [],
        metadata: { hotspotCount: 0 },
        matchedCount: 0,
      }),
      { status: 200 },
    );
  await render(h(Fire, { enabled: false, location: null }));
  await tick();
  assert.equal(requests.length, 0);
  await render(h(Fire, { enabled: true, location: null }));
  await until(() => requests.length === 1);
  assert.equal(requests[0].url.pathname, '/api/v1/fire-hotspots');
  assert.equal(requests[0].url.searchParams.get('parent'), '15');
  assert.equal(requests[0].url.searchParams.get('hours'), '24');
  await render(
    h(Fire, {
      enabled: true,
      location: {
        latitude: -2.46,
        longitude: -49.21,
        tolerance: 0.01,
        at: '2026-09-20T00:00:00Z',
      },
    }),
  );
  await until(() => requests.length === 2);
  assert.equal(requests[1].url.pathname, '/api/v1/fire-hotspots/identify');
  assert.equal(requests[1].url.searchParams.get('at'), '2026-09-20T00:00:00Z');
});

test('sair da camada cancela INPE e trocar de estado não reapresenta o recorte anterior', async () => {
  let visible;
  function Fire({ enabled, parent }) {
    visible = useFireHotspots({ level: 'state', parent }, enabled).data;
    return null;
  }
  respond = async () =>
    new Response(JSON.stringify({ metadata: { parentCode: '15' }, features: [] }), { status: 200 });
  await render(h(Fire, { enabled: true, parent: '15' }));
  await until(() => visible?.metadata.parentCode === '15');
  respond = async (_url, options) =>
    new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () =>
        reject(new DOMException('Cancelado', 'AbortError')),
      );
    });
  await render(h(Fire, { enabled: true, parent: '35' }));
  await until(() => requests.length === 2);
  assert.equal(visible, undefined);
  await render(h(Fire, { enabled: false, parent: '35' }));
  assert.equal(requests[1].signal.aborted, true);
});


test('hidrografia espera os dados principais e idle; não reutiliza geometrias de outro zoom', async () => {
  let visible;
  function Hydro({ primarySettled, zoom = 4 }) {
    const ready = useDeferredReady(`hydro:${zoom}`, primarySettled);
    visible = useHydrography({ level: 'country', zoom, bbox: '-60,-20,-40,0', includeWaterBodies: false }, ready).data;
    return null;
  }
  respond = async () => new Response(JSON.stringify({ features: [], metadata: { level: 'country' } }), { status: 200 });
  await render(h(Hydro, { primarySettled: false }));
  await tick(200); await runIdle();
  assert.equal(requests.length, 0);
  await render(h(Hydro, { primarySettled: true }));
  await tick(200);
  assert.equal(requests.length, 0, 'espera a agenda de baixa prioridade');
  await runIdle(); await until(() => requests.length === 1 && visible);
  assert.equal(requests[0].url.searchParams.get('zoom'), '4');
  assert.equal(requests[0].url.searchParams.get('include_water_bodies'), 'false');
  await render(h(Hydro, { primarySettled: true, zoom: 8 }));
  assert.equal(visible, undefined, 'não mantém rios de outra escala ou viewport');
});

test('resumo de fogo espera o período dos metadados e cancela ao desligar a camada', async () => {
  function Summary({ at, enabled }) { useFireSummary({ level: 'country' }, at, enabled); return null; }
  respond = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Cancelado', 'AbortError')));
  });
  await render(h(Summary, { enabled: true })); await tick();
  assert.equal(requests.length, 0);
  await render(h(Summary, { enabled: true, at: '2026-09-20T10:00:00Z' }));
  await until(() => requests.length === 1);
  assert.equal(requests[0].url.searchParams.get('at'), '2026-09-20T10:00:00Z');
  await render(h(Summary, { enabled: false, at: '2026-09-20T10:00:00Z' }));
  assert.equal(requests[0].signal.aborted, true);
});


test('localização só pede permissão após clique e resolve o município sem geocoder externo', async () => {
  let gpsCalls = 0, located;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: {
    getCurrentPosition(resolve) { gpsCalls++; resolve({ coords: { latitude: -23.55, longitude: -46.63 } }); },
  } } });
  respond = async (url, options) => {
    assert.equal(url.pathname, '/api/v1/territories/locate');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { latitude: -23.55, longitude: -46.63 });
    return new Response(JSON.stringify({ ibgeCode: '3550308', name: 'São Paulo', parent: { ibgeCode: '35', name: 'São Paulo' } }), { status: 200 });
  };
  await render(h(LocationButton, { onLocated: (value) => { located = value; } }));
  assert.equal(gpsCalls, 0);
  assert.equal(requests.length, 0);
  await act(async () => document.querySelector('button[aria-label="Minha localização"]').click());
  await until(() => located);
  assert.equal(gpsCalls, 1);
  assert.equal(located.territory.ibgeCode, '3550308');
  assert.equal(located.latitude, -23.55);
});

test('permissão de localização negada mantém busca disponível e não consulta API', async () => {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: {
    getCurrentPosition(_resolve, reject) { reject({ code: 1 }); },
  } } });
  await render(h(LocationButton, { onLocated: () => assert.fail('não pode navegar sem localização') }));
  await act(async () => document.querySelector('button').click());
  assert.match(document.querySelector('[role="alert"]').textContent, /Permita.*ou use a busca/);
  assert.equal(requests.length, 0);
  assert.equal(document.querySelector('button').disabled, false);
});

test('zoom próximo carrega automaticamente todos os lotes visíveis e aquece seleção', async () => {
  let response;
  function Viewport({ bbox, enabled }) {
    response = useViewportWeather(bbox, enabled, false);
    return null;
  }
  respond = async (url) => new Response(JSON.stringify(url.searchParams.get('offset') === '0' ? page(['3550308'], 20) : page(['3548708'])), { status: 200 });
  await render(h(Viewport, { bbox: '-47,-24,-46,-23', enabled: false }));
  await tick(); assert.equal(requests.length, 0);
  await render(h(Viewport, { bbox: '-47,-24,-46,-23', enabled: true }));
  await until(() => response.data?.pages.length === 1);
  await tick(220); await runIdle();
  await until(() => response.data?.pages.length === 2);
  assert.equal(response.hasNextPage, false);
  assert.ok(client.getQueryData(weatherCurrentOptions('3548708').queryKey));
  assert.ok(requests.every((r) => r.url.pathname.endsWith('/weather/viewport')));
  assert.ok(requests.every((r) => !r.url.searchParams.has('forecast')));
});

test('zoom próximo na visualização de estado envia parent e restringe a busca de viewport ao estado ativo', async () => {
  let response;
  function ViewportWithParent({ bbox, parent, enabled }) {
    response = useViewportWeather(bbox, parent, enabled, false);
    return null;
  }
  respond = async (url) => new Response(JSON.stringify(page(['3550308'])), { status: 200 });
  await render(h(ViewportWithParent, { bbox: '-47,-24,-46,-23', parent: '35', enabled: true }));
  await until(() => response.data?.pages.length === 1);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url.pathname, '/api/v1/weather/viewport');
  assert.equal(requests[0].url.searchParams.get('parent'), '35');
  assert.equal(requests[0].url.searchParams.get('bbox'), '-47,-24,-46,-23');
});

test('capitais aparecem por lote e carregamento nacional pausa para a seleção', async () => {
  let result;
  function Capitals({ pause = false, enabled = true }) {
    result = useCapitalsWeather(enabled, pause);
    return null;
  }
  respond = async (url) => new Response(JSON.stringify(
    page([url.searchParams.get('offset') === '0' ? 'SP' : 'RJ'],
      url.searchParams.get('offset') === '0' ? 6 : null),
  ));
  await render(h(Capitals));
  await until(() => result.data?.cities.length === 1);
  assert.equal(requests[0].url.pathname, '/api/v1/weather/capitals');
  await render(h(Capitals, { pause: true }));
  await tick(280); await runIdle();
  assert.equal(requests.length, 1);
  await render(h(Capitals));
  await tick(280); await runIdle();
  await until(() => result.data?.cities.length === 2);
  assert.deepEqual(result.data.cities.map((c) => c.id), ['SP', 'RJ']);
  assert.equal(result.hasNextPage, false);
});

test('malha oficial chega em páginas, preserva contornos e cancela o viewport antigo', async () => {
  let result;
  const boundary = (id) => ({ id, type: 'Feature', properties: { ibgeCode: id },
    geometry: { type: 'MultiPolygon', coordinates: [[[[-47.123456789, -23], [-47, -23], [-47, -22], [-47.123456789, -23]]]] } });
  function Boundaries({ bbox, parent = '35', enabled = true, pause = false }) {
    result = useVisibleMunicipalities(bbox, enabled, parent, pause);
    return null;
  }
  respond = async (url) => new Response(JSON.stringify({
    type: 'FeatureCollection', scope: { level: 'municipality', lod: 'canonical', parent: '35' },
    features: [boundary(url.searchParams.get('offset') === '0' ? '3500105' : '3500204')],
    nextOffset: url.searchParams.get('offset') === '0' ? 24 : null,
  }));
  await render(h(Boundaries));
  await until(() => result.data?.features.length === 1);
  const first = result.data.features[0];
  await render(h(Boundaries, { pause: true }));
  await tick(100); await runIdle();
  assert.equal(requests.length, 1);
  await render(h(Boundaries));
  await tick(100); await runIdle();
  await until(() => result.data?.features.length === 2);
  assert.equal(result.data.features[0], first);
  assert.equal(first.geometry.coordinates[0][0][0][0], -47.123456789);
  assert.equal(result.data.scope.lod, 'canonical');
  respond = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Cancelado', 'AbortError')));
  });
  await render(h(Boundaries, { bbox: '-48,-24,-46,-22' }));
  await until(() => requests.length === 3);
  assert.equal(requests[2].url.searchParams.get('parent'), '35');
  assert.equal(result.data.features[0], first, 'mantém desenho enquanto o próximo viewport carrega');
  await render(h(Boundaries, { bbox: '-49,-24,-47,-22' }));
  await until(() => requests.length === 4);
  assert.equal(requests[2].signal.aborted, true);
  await render(h(Boundaries, { parent: '31', enabled: false }));
  assert.equal(result.data, undefined, 'não apresenta uma UF como se fosse outra');
});
