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
const scratch = await mkdtemp(join(frontend, 'node_modules', '.search-tests-'));
const modulePath = join(scratch, 'harness.mjs');
const compiled = await build({
  stdin: {
    contents: `export { useTerritorySearch } from './src/api/queries';`,
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
const { useTerritorySearch } = await import(pathToFileURL(modulePath).href);

let root;
let queryClient;
let originalFetch;
let requests = [];

async function tick(ms = 20) {
  await act(() => new Promise((resolve) => setTimeout(resolve, ms)));
}

async function until(check) {
  for (let i = 0; i < 50 && !check(); i++) await tick();
  assert.ok(check(), 'O estado esperado não foi atingido');
}

beforeEach(() => {
  root = createRoot(document.getElementById('root'));
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  requests = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return new Response(
      JSON.stringify({
        territories: [
          {
            ibgeCode: '35',
            name: 'São Paulo',
            level: 'state',
            abbreviation: 'SP',
            parent: null,
          },
          {
            ibgeCode: '3550308',
            name: 'São Paulo',
            level: 'municipality',
            abbreviation: null,
            parent: { ibgeCode: '35', name: 'São Paulo', level: 'state' },
          },
        ],
        pagination: { total: 2, limit: 8, offset: 0 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };
});

afterEach(async () => {
  await act(async () => root.unmount());
  queryClient.clear();
  globalThis.fetch = originalFetch;
});

after(async () => {
  dom.window.close();
  await rm(scratch, { recursive: true, force: true });
});

test('useTerritorySearch só consulta o backend quando o termo tem pelo menos 2 caracteres', async () => {
  let result;
  function SearchHarness({ query, enabled }) {
    result = useTerritorySearch(query, enabled);
    return null;
  }

  // 1. Termo com 1 caractere -> desabilitado
  await act(async () => {
    root.render(
      h(QueryClientProvider, { client: queryClient }, h(SearchHarness, { query: 's', enabled: true })),
    );
  });
  await tick();
  assert.equal(requests.length, 0);

  // 2. Termo com 2+ caracteres -> dispara chamada remota com parâmetro search
  await act(async () => {
    root.render(
      h(QueryClientProvider, { client: queryClient }, h(SearchHarness, { query: 'sao paulo', enabled: true })),
    );
  });
  await until(() => requests.length === 1);
  assert.match(requests[0].url, /\/territories\?search=sao\+paulo&limit=8/);
  await until(() => result.data != null);
  assert.equal(result.data.territories.length, 2);
  assert.equal(result.data.territories[0].name, 'São Paulo');
});

