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
const scratch = await mkdtemp(join(frontend, 'node_modules', '.follow-tests-'));
const modulePath = join(scratch, 'harness.mjs');

const compiled = await build({
  stdin: {
    contents: `export { FollowedMunicipalitiesPanel } from './src/features/follow/FollowedMunicipalitiesPanel';`,
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
const { FollowedMunicipalitiesPanel } = await import(pathToFileURL(modulePath).href);

after(async () => {
  dom.window.close();
  await rm(scratch, { recursive: true, force: true });
});

const SAO_PAULO = {
  municipalityCode: '3550308',
  name: 'São Paulo',
  stateCode: '35',
  stateName: 'São Paulo',
  stateAbbreviation: 'SP',
};

let root, client, requests, server;

/** Backend em memória: a lista do usuário é a fonte de verdade. */
function fakeServer({ failWrites = false } = {}) {
  const followed = new Map();
  return {
    followed,
    failWrites,
    async handle(url, init) {
      const method = init.method ?? 'GET';
      const path = url.pathname.replace('/api/v1', '');
      if (path === '/me/followed-municipalities' && method === 'GET') {
        return Response.json({ municipalities: [...followed.values()] });
      }
      const code = path.split('/').pop();
      if (this.failWrites) {
        return Response.json(
          { error: { code: 'internal_error', message: 'Falha ao gravar.' } },
          { status: 500 },
        );
      }
      if (method === 'PUT') {
        const item = { ...SAO_PAULO, municipalityCode: code, followedAt: '2026-09-23T12:00:00Z' };
        followed.set(code, item);
        return Response.json(item, { status: 201 });
      }
      if (method === 'DELETE') {
        followed.delete(code);
        return new Response(null, { status: 204 });
      }
      return new Response('{}', { status: 404 });
    },
  };
}

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  requests = [];
  server = fakeServer();
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    requests.push(`${init.method ?? 'GET'} ${url.pathname}`);
    return server.handle(url, init);
  };
  dom.window.document.getElementById('root')?.remove();
  const next = dom.window.document.createElement('div');
  next.id = 'root';
  dom.window.document.body.appendChild(next);
  root = createRoot(next);
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  client?.clear();
});

async function tick(ms = 20) {
  await act(() => new Promise((resolve) => setTimeout(resolve, ms)));
}

async function until(check) {
  for (let i = 0; i < 100 && !check(); i++) await tick();
  assert.ok(check(), 'Estado esperado não foi atingido');
}

async function render(props) {
  await act(async () =>
    root.render(
      h(
        QueryClientProvider,
        { client },
        h(FollowedMunicipalitiesPanel, { onOpen: () => {}, ...props }),
      ),
    ),
  );
}

const $ = (selector) => dom.window.document.querySelector(selector);
const followButton = () => $('.follow-btn');

test('fora de um município não há botão de seguir, só o estado vazio', async () => {
  await render({ current: null });
  await until(() => $('.views-empty-state'));
  assert.equal(followButton(), null);
  assert.equal($('details').open, false, 'a seção começa recolhida como as visualizações');
});

test('seguir é otimista e a lista é confirmada pelo servidor', async () => {
  await render({ current: SAO_PAULO });
  assert.equal($('details').open, true, 'entrar num município abre a seção');
  await until(() => followButton() && !followButton().disabled);
  assert.equal(followButton().getAttribute('aria-pressed'), 'false');
  assert.match(followButton().textContent, /Seguir\s*São Paulo/);

  await act(async () => followButton().click());
  // Muda no clique, antes de o PUT responder.
  assert.equal(followButton().getAttribute('aria-pressed'), 'true');
  assert.match(followButton().textContent, /Seguindo/);

  await until(() => requests.filter((r) => r.startsWith('GET')).length >= 2);
  assert.ok(requests.includes('PUT /api/v1/me/followed-municipalities/3550308'));
  assert.ok(server.followed.has('3550308'));
  assert.equal($('.views-count-badge').textContent, '1');
  assert.ok($('.views-item.is-current'), 'o município aberto é destacado na lista');

  // Com a releitura do primeiro clique ainda em voo, o otimista espera o
  // `cancelQueries` — alguns microtasks, não a resposta do DELETE.
  await act(async () => followButton().click());
  await until(() => followButton().getAttribute('aria-pressed') === 'false');
  await until(() => requests.some((r) => r.startsWith('DELETE')));
  await until(() => !server.followed.has('3550308'));
});

test('falha ao seguir desfaz a mudança e mostra o erro', async () => {
  server.failWrites = true;
  await render({ current: SAO_PAULO });
  await until(() => followButton() && !followButton().disabled);

  await act(async () => followButton().click());
  await until(() => $('.notice-error'));
  assert.equal(followButton().getAttribute('aria-pressed'), 'false');
  assert.match($('.notice-error').textContent, /Falha ao gravar/);
  assert.equal($('.views-count-badge'), null);
});

test('reabrir um município já seguido mostra "Seguindo" a partir do backend', async () => {
  server.followed.set('3550308', { ...SAO_PAULO, followedAt: '2026-09-20T12:00:00Z' });
  await render({ current: SAO_PAULO });
  await until(() => followButton()?.getAttribute('aria-pressed') === 'true');
  assert.equal(requests.filter((r) => r.startsWith('PUT')).length, 0);
});

test('alternar rápido envia as escritas na ordem dos cliques', async () => {
  await render({ current: SAO_PAULO });
  await until(() => followButton() && !followButton().disabled);

  await act(async () => followButton().click());
  await act(async () => followButton().click());
  await until(() => followButton().getAttribute('aria-pressed') === 'false');

  await until(() => requests.some((r) => r.startsWith('DELETE')));
  const writes = requests.filter((r) => !r.startsWith('GET')).map((r) => r.split(' ')[0]);
  assert.deepEqual(writes, ['PUT', 'DELETE']);
  await until(() => requests.filter((r) => r.startsWith('GET')).length >= 2);
  assert.equal(server.followed.size, 0);
  assert.equal(followButton().getAttribute('aria-pressed'), 'false');
});
