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
    contents: `export { useMunicipalityWeather, useUserStateWeather, useWeatherCurrent, weatherCurrentOptions, useFireHotspots, useFireHotspotDetails, useFireSummary, useHydrography, useViewportWeather, useNationalWeather, useVisibleMunicipalities, useSelectedBoundary, useMapLayer } from './src/api/queries';
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
  useUserStateWeather,
  useFireHotspots,
  useFireHotspotDetails,
  useFireSummary,
  useHydrography,
  useDeferredReady,
  useViewportWeather,
  useNationalWeather,
  useVisibleMunicipalities,
  useSelectedBoundary,
  useMapLayer,
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

test('clima do estado só aquece o cache das cidades medidas, nunca das estimadas', async () => {
  function State() {
    useUserStateWeather('35', true);
    return null;
  }
  const measured = city('3550308');
  const inferred = { ...city('3509502'), isInferred: true };
  respond = async () =>
    new Response(JSON.stringify({ ...page([]), cities: [measured, inferred] }), { status: 200 });
  await render(h(State));
  await until(() => client.getQueryData(weatherCurrentOptions('3550308').queryKey));
  assert.equal(requests[0].url.pathname, '/api/v1/weather/state');
  assert.equal(client.getQueryData(weatherCurrentOptions('3509502').queryKey), undefined);
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

test('resumo de fogo não apaga o mapa: nova janela e UF aberta reaproveitam o anterior', async () => {
  let result;
  function Summary({ query, at }) {
    result = useFireSummary(query, at, true);
    return null;
  }
  const fire = (ibgeCode, count) => ({ ibgeCode, name: ibgeCode, state: 'SP', count, density: count });
  let release;
  respond = async (url) => {
    if (url.searchParams.get('at') !== '2026-09-20T10:00:00Z') {
      await new Promise((resolve) => { release = resolve; });
    }
    return new Response(JSON.stringify({
      windowStart: '2026-09-19T10:00:00Z', windowEnd: url.searchParams.get('at'), hours: 24, total: 3,
      municipalities: [fire('3550308', 2), fire('3304557', 1)],
      states: [fire('35', 2), fire('33', 1)],
      rankedMunicipalities: [fire('3550308', 2), fire('3304557', 1)],
      unassignedCount: 0, areaSource: 'IBGE',
    }));
  };
  const brazil = { level: 'country' };
  await render(h(Summary, { query: brazil, at: '2026-09-20T10:00:00Z' }));
  await until(() => result.data);

  // A janela seguinte do Brasil: o mapa segue pintado com a anterior.
  await render(h(Summary, { query: brazil, at: '2026-09-20T10:10:00Z' }));
  await until(() => release);
  assert.equal(result.isPlaceholderData, true);
  assert.equal(result.data.windowEnd, '2026-09-20T10:00:00Z');
  release(); release = undefined;
  await until(() => !result.isPlaceholderData);

  // Abrir São Paulo: os municípios dele no resumo do Brasil pintam na hora.
  await render(h(Summary, { query: { level: 'state', parent: '35' }, at: undefined }));
  assert.equal(result.isPlaceholderData, true);
  assert.deepEqual(result.data.municipalities.map((m) => m.ibgeCode), ['3550308']);
  assert.deepEqual(result.data.states.map((s) => s.ibgeCode), ['35']);
  assert.equal(result.data.rankedMunicipalities, undefined, 'o ranking é refeito com a UF');
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

test('zoom próximo traz a área numa consulta na grade do zoom e aquece só as medições', async () => {
  let response;
  function Viewport({ bbox, zoom = 8, enabled }) {
    response = useViewportWeather(bbox, null, zoom, enabled, false);
    return null;
  }
  respond = async () => {
    const body = page(['3550308', '3548708']);
    body.cities[1].isInferred = true;
    return new Response(JSON.stringify(body), { status: 200 });
  };
  await render(h(Viewport, { bbox: '-47.13,-23.94,-46.02,-23.11', enabled: false }));
  await tick(); assert.equal(requests.length, 0);
  await render(h(Viewport, { bbox: '-47.13,-23.94,-46.02,-23.11', enabled: true }));
  await until(() => response.data?.cities.length === 2);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url.pathname, '/api/v1/weather/viewport');
  assert.equal(requests[0].url.searchParams.get('bbox'), '-47.50,-24.00,-46.00,-23.00');
  assert.equal(requests[0].url.searchParams.get('zoom'), '8');
  assert.ok(!requests[0].url.searchParams.has('forecast'));
  assert.ok(client.getQueryData(weatherCurrentOptions('3550308').queryKey), 'medida aquece a seleção');
  assert.equal(client.getQueryData(weatherCurrentOptions('3548708').queryKey), undefined, 'estimativa não');

  // Arrastar dentro da mesma célula reaproveita a consulta; o zoom 12 usa a de 10.
  await render(h(Viewport, { bbox: '-47.4,-23.9,-46.1,-23.05', enabled: true }));
  await tick();
  assert.equal(requests.length, 1);
  await render(h(Viewport, { bbox: '-46.63,-23.6,-46.5,-23.5', zoom: 12, enabled: true }));
  await until(() => requests.length === 2);
  assert.equal(requests[1].url.searchParams.get('zoom'), '10');
  assert.equal(requests[1].url.searchParams.get('bbox'), '-46.70,-23.60,-46.50,-23.50');
});

test('zoom próximo na visualização de estado envia parent e restringe a busca de viewport ao estado ativo', async () => {
  let response;
  function ViewportWithParent({ bbox, parent, enabled }) {
    response = useViewportWeather(bbox, parent, 9, enabled, false);
    return null;
  }
  respond = async () => new Response(JSON.stringify(page(['3550308'])), { status: 200 });
  await render(h(ViewportWithParent, { bbox: '-47,-24,-46,-23', parent: '35', enabled: true }));
  await until(() => response.data?.cities.length === 1);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url.pathname, '/api/v1/weather/viewport');
  assert.equal(requests[0].url.searchParams.get('parent'), '35');
  assert.equal(requests[0].url.searchParams.get('bbox'), '-47.00,-24.00,-46.00,-23.00');
});

test('condições atuais só voltam à rede quando a leitura vence', async () => {
  let age = 0;
  respond = async () => {
    const body = page(['3509502']);
    const then = new Date(Date.now() - age).toISOString();
    body.fetchedAt = then;
    body.cities[0].observedAt = then;
    return new Response(JSON.stringify(body), { status: 200 });
  };
  function Selected() {
    useWeatherCurrent('3509502', true);
    return null;
  }
  await render(h(Selected));
  await until(() => requests.length === 1);
  await render(null);
  await render(h(Selected));
  await tick();
  assert.equal(requests.length, 1, 'a leitura de agora vale 15 minutos');

  age = 20 * 60 * 1000;
  await render(null);
  client.clear();
  await render(h(Selected));
  await until(() => requests.length === 2);
  await render(null);
  await render(h(Selected));
  await until(() => requests.length === 3);
});

test('Brasil: capitais numa consulta, depois a média dos estados; a seleção pausa', async () => {
  let result;
  function National({ pause = false, enabled = true }) {
    result = useNationalWeather(enabled, pause);
    return null;
  }
  respond = async (url) => {
    const body = page(['SP', 'RJ']);
    if (url.pathname.endsWith('/weather/states')) {
      body.cities = body.cities.map((item) => ({ ...item, samplePoints: 4 }));
    }
    return new Response(JSON.stringify(body));
  };
  await render(h(National));
  await until(() => result.data?.cities.length === 2);
  assert.equal(requests[0].url.pathname, '/api/v1/weather/current');
  assert.equal(requests[0].url.searchParams.get('forecast'), 'false');
  assert.equal(result.averaged, false);
  assert.equal(result.isRefining, true);

  // A seleção pausa a segunda etapa.
  await render(h(National, { pause: true }));
  await tick(220); await runIdle();
  assert.equal(requests.length, 1);
  await render(h(National));
  await tick(220); await runIdle();
  await until(() => result.averaged);
  assert.equal(requests[1].url.pathname, '/api/v1/weather/states');
  assert.equal(result.data.cities[0].samplePoints, 4);
  assert.equal(result.capitals.cities[0].samplePoints, undefined, 'a seleção usa a capital');
  assert.equal(result.isRefining, false);

  // Com a média em cache, voltar ao Brasil não pede nada: nem as capitais.
  await render(h(National, { enabled: false }));
  await render(h(National));
  await tick(220); await runIdle();
  assert.equal(requests.length, 2);
  assert.equal(result.data.cities[0].samplePoints, 4);
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

test('mapa pinta a malha leve, troca pela detalhada na ociosidade e busca valores à parte', async () => {
  const feature = (code, lod) => ({
    type: 'Feature', id: code,
    properties: { ibgeCode: code, name: code, level: 'state', abbreviation: code, parentCode: null, parentName: null, value: null, normalizedValue: null, classIndex: null },
    geometry: { type: 'MultiPolygon', coordinates: [[[[0, 0], [1, lod === 'detail' ? 0.5 : 0], [1, 1], [0, 0]]]] },
  });
  respond = async (url) => {
    if (url.pathname.endsWith('/map/values')) {
      const year = url.searchParams.get('year');
      return new Response(JSON.stringify({
        level: 'state', parent: null,
        indicator: { key: 'population', name: 'População', unit: 'people', decimalPlaces: 0, year: year === 'latest' ? 2022 : Number(year), requestedYear: year, availableYears: [2010, 2022] },
        statistics: null, classification: null,
        values: [{ ibgeCode: '35', value: year === 'latest' ? 46 : 41, normalizedValue: 1, classIndex: 4 }],
      }));
    }
    const lod = url.searchParams.get('lod');
    return new Response(JSON.stringify({
      type: 'FeatureCollection', scope: { level: 'state', parent: null, lod, count: 1 },
      indicator: null, statistics: null, classification: null, features: [feature('35', lod)],
    }));
  };
  let layer, outline;
  function Map({ year }) {
    layer = useMapLayer({ level: 'state', indicator: 'population', year });
    outline = useMapLayer({ level: 'state', year: 'latest' });
    return null;
  }
  await render(h(Map, { year: 'latest' }));
  await until(() => layer.data?.features[0].properties.value === 46);
  const paths = () => requests.map((r) => `${r.url.pathname}?${r.url.searchParams.get('lod') ?? r.url.searchParams.get('year')}`);
  assert.deepEqual(paths().sort(), ['/api/v1/map/values?latest', '/api/v1/map?overview']);
  assert.equal(layer.data.scope.lod, 'overview');
  assert.equal(outline.data.features[0].geometry, layer.data.features[0].geometry, 'contorno e coropleta dividem a malha');
  assert.equal(layer.isPlaceholderData, false);

  await tick(220); await runIdle();
  await until(() => layer.data?.scope.lod === 'detail');
  assert.equal(requests.filter((r) => r.url.pathname.endsWith('/map')).length, 2);
  assert.equal(layer.data.features[0].properties.value, 46);

  // Trocar o ano só busca os valores; a malha e o desenho anterior ficam.
  await render(h(Map, { year: '2010' }));
  assert.equal(layer.data.features[0].properties.value, 46);
  assert.equal(layer.isPlaceholderData, true);
  await until(() => layer.data?.features[0].properties.value === 41);
  assert.equal(layer.isPlaceholderData, false);
  assert.deepEqual(paths().slice(3), ['/api/v1/map/values?2010']);
});

test('Brasil com a primeira etapa fora do ar ainda tenta a média dos estados', async () => {
  let result;
  function National() {
    result = useNationalWeather(true, false);
    return null;
  }
  respond = async (url) =>
    url.pathname.endsWith('/weather/states')
      ? new Response(JSON.stringify(page(['SP'])))
      : new Response(JSON.stringify({ error: { code: 'not_found', message: 'x' } }), { status: 404 });
  await render(h(National));
  await until(() => result.isError);
  await tick(220); await runIdle();
  await until(() => result.averaged);
  assert.deepEqual(requests.map((r) => r.url.pathname), ['/api/v1/weather/current', '/api/v1/weather/states']);
  assert.equal(result.error, null);
});
