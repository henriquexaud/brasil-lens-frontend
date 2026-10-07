import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { disposeHarness, installDom, loadModule } from './helpers/harness.mjs';

const dom = installDom();
const { createElement: h, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const {
  useNationalMunicipalData, geometryOptions, stateWeatherOptions,
  weatherCurrentOptions, useUserStateWeather, mosaicColor,
} = await loadModule(`
  export { useNationalMunicipalData } from './src/features/map/useNationalMunicipalData';
  export { geometryOptions } from './src/api/queries';
  export { stateWeatherOptions, weatherCurrentOptions, useUserStateWeather } from './src/features/weather/queries';
  export { mosaicColor } from './src/features/map/mosaicColor';
`, { stubs: {
  '@/api/client': 'export const apiGet = (...args) => globalThis.apiGet(...args); export const apiDelete = apiGet, apiPost = apiGet, apiPut = apiGet;',
  './client': 'export const apiGet = (...args) => globalThis.apiGet(...args);',
  '@/lib/idle': `export const scheduleIdle = (work) => {
    const key = ++globalThis.nextIdle;
    globalThis.idle.set(key, work);
    return () => globalThis.idle.delete(key);
  };`,
} });

let root, client, result, calls, respond;
const city = (id, extra = {}) => ({
  id, observedAt: new Date().toISOString(), temperatureC: 24,
  precipitation48hMm: 0, isInferred: false, ...extra,
});
const response = (cities, extra = {}) => ({
  source: 'Open-Meteo', fetchedAt: new Date().toISOString(),
  status: 'ok', cities, nextOffset: null, ...extra,
});
const feature = (id) => ({ type: 'Feature', id, properties: { ibgeCode: id, level: id.length === 2 ? 'state' : 'municipality' } });
const mesh = (parent, lod = 'overview') => ({
  scope: { parent, level: 'municipality', lod, count: 2 },
  features: [feature(`${parent}00001`), feature(`${parent}00002`)],
});
const states = { scope: { level: 'state' }, features: [feature('35'), feature('33')], bbox: [-74, -34, -34, 6] };
const props = { states, enabled: true, weatherEnabled: true, weatherRevision: 'initial' };
function National(input) { result = useNationalMunicipalData({ ...props, ...input }); return null; }
async function render(input = {}) {
  await act(async () => root.render(h(QueryClientProvider, { client }, h(National, input))));
}
async function tick() { await act(async () => new Promise((resolve) => setTimeout(resolve, 5))); }
async function next() {
  const [key, work] = [...globalThis.idle][0] ?? [];
  assert.ok(work, 'etapa ociosa agendada');
  globalThis.idle.delete(key);
  await act(async () => work());
  await tick();
}
async function drain() {
  for (let i = 0; i < 30 && globalThis.idle.size; i++) await next();
  assert.equal(globalThis.idle.size, 0);
}
beforeEach(() => {
  calls = [];
  globalThis.idle = new Map();
  globalThis.nextIdle = 0;
  respond = async (path, params) => path === '/map' ? mesh(params.parent) : response([
    city(`${params.parent}00001`), city(`${params.parent}00002`, { isInferred: true }),
  ]);
  globalThis.apiGet = (path, params, signal) => {
    calls.push({ path, params, signal });
    return respond(path, params, signal);
  };
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  root = createRoot(document.getElementById('root'));
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); });
after(async () => { dom.window.close(); await disposeHarness(); });

test('Brasil só publica os dados após todas as UFs; clima e chuva usam a rota amostrada do estado', async () => {
  await render({ enabled: false });
  assert.equal(globalThis.idle.size, 0);
  await render();
  assert.equal(calls.length, 0, 'a carga inicial tem prioridade');
  await next(); assert.equal(result.mesh, undefined);
  await next(); assert.equal(result.mesh.municipalities.length, 2);
  assert.equal(result.weather, undefined);
  await next(); assert.equal(result.weather, undefined, 'nenhuma publicação parcial');
  await next(); assert.equal(result.weather.byCode.size, 4);
  assert.deepEqual(calls.map((call) => call.path), ['/map', '/map', '/weather/state', '/weather/state']);
  assert.equal(result.weather.byCode.get('3500002').isInferred, true);
  assert.ok(client.getQueryData(weatherCurrentOptions('3500001').queryKey));
  assert.equal(client.getQueryData(weatherCurrentOptions('3500002').queryKey), undefined, 'estimativa não se torna medição na seleção');
  const count = calls.length;
  function State() { useUserStateWeather('35', true); return null; }
  await act(async () => root.render(h(QueryClientProvider, { client }, h(State))));
  await tick();
  assert.equal(calls.length, count, 'abrir a UF reaproveita a leitura antecipada');
});

test('focos carregam somente a malha e reaproveitam o resumo nacional; nenhum clima é consultado', async () => {
  await render({ weatherEnabled: false });
  await drain();
  assert.equal(result.mesh.municipalities.length, 2);
  assert.equal(result.weather, undefined);
  assert.deepEqual(calls.map((call) => call.path), ['/map', '/map']);
});

test('pausar preserva a resposta em voo no cache e retomar não duplica nem paraleliza a fila', async () => {
  let release;
  const original = respond;
  respond = (path, params) => new Promise((resolve) => { release = () => resolve(original(path, params)); });
  await render();
  await next();
  assert.equal(calls.length, 1);
  await render({ enabled: false });
  assert.equal(calls[0].signal.aborted, false);
  assert.equal(globalThis.idle.size, 0);
  await render();
  await next();
  assert.equal(calls.length, 1, 'nova fila espera a resposta anterior');
  respond = original;
  await act(async () => release());
  await tick();
  await drain();
  assert.equal(calls.length, 4);
  assert.equal(result.weather.byCode.size, 4);
});

test('malha detalhada, leituras frescas e medições mais novas são reaproveitadas', async () => {
  for (const parent of ['33', '35']) {
    client.setQueryData(geometryOptions('municipality', parent, 'detail').queryKey, mesh(parent, 'detail'));
    client.setQueryData(stateWeatherOptions(parent).queryKey, response([
      city(`${parent}00001`), city(`${parent}00002`, { isInferred: true }),
    ]));
  }
  const measured = city('3500002', { temperatureC: 29 });
  client.setQueryData(weatherCurrentOptions(measured.id).queryKey, response([measured]));
  await render(); await drain();
  assert.equal(calls.length, 0);
  assert.equal(result.mesh.municipalities[0].scope.lod, 'detail');
  assert.equal(result.weather.byCode.get(measured.id), measured);
});

test('falha conserva o mosaico anterior, não cria loops ou fallback por município, e invalidação permite retomar', async () => {
  await render(); await drain();
  const complete = result.weather;
  let failed = false;
  const original = respond;
  respond = async (path, params) => {
    if (path === '/weather/state' && params.parent === '35') { failed = true; throw new Error('Cota da fonte esgotada.'); }
    return original(path, params);
  };
  await act(async () => client.invalidateQueries({ queryKey: ['weather', 'state'], refetchType: 'none' }));
  await drain();
  assert.equal(failed, true);
  assert.equal(result.weather, complete);
  assert.match(result.weatherError.message, /Cota/);
  const count = calls.length;
  await render({ enabled: false }); await render(); await drain();
  assert.equal(calls.length, count);
  respond = original;
  await act(async () => client.invalidateQueries({ queryKey: ['weather', 'state'], refetchType: 'none' }));
  await drain();
  assert.equal(result.weatherError, undefined);
  assert.notEqual(result.weather, complete);
});

test('dados incompletos impedem publicação; fallback antigo continua sinalizado como stale', async () => {
  respond = async (path, params) => path === '/map' ? mesh(params.parent) : response([city(`${params.parent}00001`)]);
  await render(); await drain();
  assert.equal(result.weather, undefined);
  assert.match(result.weatherError.message, /completos/);
  respond = async (path, params) => path === '/map' ? mesh(params.parent) : response([
    city(`${params.parent}00001`), city(`${params.parent}00002`, { isInferred: true }),
  ], { status: 'stale' });
  await act(async () => client.invalidateQueries({ queryKey: ['weather', 'state'], refetchType: 'none' }));
  await drain();
  assert.equal(result.weather.stale, true);
});

test('falha de malha preserva a carga inicial e uma nova invalidação permite completar o país', async () => {
  const original = respond;
  respond = async (path, params) => {
    if (path === '/map' && params.parent === '35') throw new Error('Malha indisponível.');
    return original(path, params);
  };
  await render(); await drain();
  assert.equal(result.mesh, undefined);
  assert.equal(result.weather, undefined);
  assert.match(result.meshError.message, /Malha/);
  const count = calls.length;
  await render({ enabled: false }); await render(); await drain();
  assert.equal(calls.length, count);
  respond = original;
  await act(async () => client.invalidateQueries({ queryKey: ['map', 'municipality'], refetchType: 'none' }));
  await drain();
  assert.equal(result.meshError, undefined);
  assert.equal(result.weather.byCode.size, 4);
});

test('cache vencido é renovado e não substitui uma seleção mais recente por uma amostra antiga', async () => {
  const oldAt = new Date(Date.now() - 31 * 60_000).toISOString();
  for (const parent of ['33', '35']) {
    client.setQueryData(geometryOptions('municipality', parent, 'overview').queryKey, mesh(parent));
    client.setQueryData(stateWeatherOptions(parent).queryKey, response([
      city(`${parent}00001`, { observedAt: oldAt }), city(`${parent}00002`, { observedAt: oldAt }),
    ], { fetchedAt: oldAt }), { updatedAt: Date.parse(oldAt) });
  }
  const futureCity = city('3500001', { observedAt: new Date(Date.now() + 60_000).toISOString(), temperatureC: 31 });
  client.setQueryData(weatherCurrentOptions(futureCity.id).queryKey, response([futureCity]));
  await render(); await drain();
  assert.deepEqual(calls.map((call) => call.path), ['/weather/state', '/weather/state']);
  assert.equal(result.weather.byCode.get(futureCity.id), futureCity);
  assert.equal(client.getQueryData(weatherCurrentOptions(futureCity.id).queryKey).cities[0], futureCity);
});

test('mosaico usa as escalas existentes e mantém ausência diferente de zero', () => {
  assert.match(mosaicColor({ weather: city('3500001'), climateMode: true }), /#FFF5A6 68%/);
  assert.match(mosaicColor({ weather: city('3500001'), rainMode: true }), /12%/);
  assert.notEqual(mosaicColor({ weather: city('3500001'), rainMode: true }), mosaicColor({ rainMode: true }));
  assert.match(mosaicColor({ fire: { density: 0 }, fireMode: 'territorial' }), /68%/);
  assert.match(mosaicColor({ fire: { density: null }, fireMode: 'territorial' }), /35%/);
  assert.match(mosaicColor({ fire: { density: 1 }, fireMode: 'points' }), /45%/);
});
