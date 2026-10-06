import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { disposeHarness, installDom, loadModule } from './helpers/harness.mjs';

installDom();
const { createElement: h, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { queryKeys, FIRE_HOTSPOT_HOURS, useCancelWhenDisabled, useIdleNextPage } = await loadModule(`
  export { queryKeys, FIRE_HOTSPOT_HOURS } from './src/api/queryKeys';
  export { useCancelWhenDisabled, useIdleNextPage } from './src/api/queryLifecycle';
`);

after(disposeHarness);

let root;
let client;
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = undefined;
  client?.clear();
});

async function mount(element) {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(h(QueryClientProvider, { client }, element)));
}

const waitFor = async (predicate, ms = 1000) => {
  const limit = Date.now() + ms;
  while (!predicate()) {
    assert.ok(Date.now() < limit, 'condição não foi atendida a tempo');
    await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
  }
};

test('chaves de consulta incluem escopo, nível e LOD, e normalizam o que falta', () => {
  assert.deepEqual(queryKeys.map({ level: 'state' }), ['map', 'state', null, null]);
  assert.deepEqual(
    queryKeys.map({ level: 'municipality', parent: '35', lod: 'detail' }),
    ['map', 'municipality', '35', 'detail'],
  );
  assert.notDeepEqual(
    queryKeys.map({ level: 'municipality', parent: '35', lod: 'overview' }),
    queryKeys.map({ level: 'municipality', parent: '35', lod: 'detail' }),
    'overview e detail não podem compartilhar cache',
  );
  assert.deepEqual(queryKeys.hydrography(8, undefined), ['hydrography', 8, null]);
  assert.deepEqual(queryKeys.hydrography(8, '1,2,3,4'), ['hydrography', 8, '1,2,3,4']);
  assert.deepEqual(
    queryKeys.fireHotspots({ level: 'country' }),
    ['fire-hotspots', 'country', null, FIRE_HOTSPOT_HOURS],
    'sem `hours`, a chave usa a janela padrão da API',
  );
  assert.notDeepEqual(
    queryKeys.fireHotspots({ level: 'country', hours: 24 }),
    queryKeys.fireHotspots({ level: 'country' }),
  );
  assert.deepEqual(queryKeys.followedMunicipalities('alice'), ['me', 'alice', 'followed-municipalities']);
  assert.notDeepEqual(queryKeys.followedMunicipalities('alice'), queryKeys.followedMunicipalities('bob'));
  assert.deepEqual(queryKeys.weatherAlerts(), ['weather', 'alerts']);
});

function Cancel({ queryKey, enabled }) {
  useCancelWhenDisabled(queryKey, enabled);
  return null;
}

function startFetch(queryKey) {
  const state = { aborted: false };
  client
    .fetchQuery({
      queryKey,
      queryFn: ({ signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener('abort', () => {
            state.aborted = true;
            reject(new Error('abortada'));
          });
        }),
    })
    .catch(() => {});
  return state;
}

test('consulta desligada é cancelada, e a ligada continua correndo', async () => {
  await mount(h(Cancel, { queryKey: ['a'], enabled: true }));
  const running = startFetch(['a']);
  await act(async () => {});
  assert.equal(running.aborted, false);

  await act(async () => root.render(h(QueryClientProvider, { client }, h(Cancel, { queryKey: ['a'], enabled: false }))));
  assert.equal(running.aborted, true);
});

test('montar já desligada cancela a consulta que estava em andamento', async () => {
  await mount(null);
  const running = startFetch(['a']);
  await act(async () => {});
  assert.equal(running.aborted, false);

  await act(async () => root.render(h(QueryClientProvider, { client }, h(Cancel, { queryKey: ['a'], enabled: false }))));
  assert.equal(running.aborted, true);
});

test('desmontar cancela a consulta em andamento só da chave observada, não as que a estendem', async () => {
  await mount(h(Cancel, { queryKey: ['a'], enabled: true }));
  const mine = startFetch(['a']);
  const other = startFetch(['a', 'filha']);
  await act(async () => {});

  await act(async () => root.unmount());
  root = undefined;

  assert.equal(mine.aborted, true);
  assert.equal(other.aborted, false, "cancelamento é exato: ['a'] não derruba ['a', 'filha']");
  client.cancelQueries();
});

function Idle({ state, active = true, delay = 1, pageCount = 1 }) {
  useIdleNextPage(state, active, pageCount, delay);
  return null;
}

const paged = (extra = {}) => {
  const calls = { n: 0 };
  return {
    calls,
    state: {
      hasNextPage: true,
      isFetching: false,
      isError: false,
      fetchNextPage: () => { calls.n += 1; return Promise.resolve(); },
      ...extra,
    },
  };
};

test('próxima página carrega quando o navegador está ocioso', async () => {
  const { state, calls } = paged();
  await mount(h(Idle, { state }));
  await waitFor(() => calls.n === 1);
});

test('não pede a próxima página sem página, em erro, buscando ou inativo', async () => {
  for (const [name, extra, active] of [
    ['sem próxima página', { hasNextPage: false }, true],
    ['em erro', { isError: true }, true],
    ['já buscando', { isFetching: true }, true],
    ['camada inativa', {}, false],
  ]) {
    const { state, calls } = paged(extra);
    await mount(h(Idle, { state, active }));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 40)));
    assert.equal(calls.n, 0, name);
    await act(async () => root.unmount());
    root = undefined;
  }
});

test('desmontar antes do tempo ocioso cancela o pedido agendado', async () => {
  const { state, calls } = paged();
  await mount(h(Idle, { state, delay: 30 }));
  await act(async () => root.unmount());
  root = undefined;
  await act(async () => new Promise((resolve) => setTimeout(resolve, 60)));
  assert.equal(calls.n, 0);
});

test('cada página nova reagenda o pedido da seguinte', async () => {
  const { state, calls } = paged();
  await mount(h(Idle, { state, pageCount: 1 }));
  await waitFor(() => calls.n === 1);
  await act(async () => root.render(h(QueryClientProvider, { client }, h(Idle, { state, pageCount: 2 }))));
  await waitFor(() => calls.n === 2);
});
