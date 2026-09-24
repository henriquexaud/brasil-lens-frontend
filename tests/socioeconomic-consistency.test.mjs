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
const scratch = await mkdtemp(join(frontend, 'node_modules', '.socioeconomic-tests-'));
const modulePath = join(scratch, 'harness.mjs');

const compiled = await build({
  stdin: {
    contents: `
      export { useMapLayer } from './src/api/queries';
      export { Legend } from './src/features/map/Legend';
      export { SavedViewsPanel, defaultViewName } from './src/features/views/SavedViewsPanel';
    `,
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
const { useMapLayer, Legend, SavedViewsPanel, defaultViewName } = await import(pathToFileURL(modulePath).href);

after(async () => {
  dom.window.close();
  await rm(scratch, { recursive: true, force: true });
});

let root, client, requests, respond;

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  requests = [];
  respond = async () => new Response('{}');
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const req = { url, signal: init.signal };
    requests.push(req);
    return respond(url, init);
  };
  dom.window.document.getElementById('root')?.remove();
  const next = dom.window.document.createElement('div');
  next.id = 'root';
  dom.window.document.body.appendChild(next);
  root = createRoot(next);
});

afterEach(async () => {
  if (root) {
    await act(async () => root.unmount());
  }
  client?.clear();
});

async function tick(ms = 20) {
  await act(() => new Promise((resolve) => setTimeout(resolve, ms)));
}

async function until(check) {
  for (let i = 0; i < 100 && !check(); i++) await tick();
  assert.ok(check(), 'Estado esperado não foi atingido');
}

async function render(component) {
  await act(async () => root.render(h(QueryClientProvider, { client }, component)));
}

test('trocar indicador de População para PIB per capita não vaza dados nem classificação antigos', async () => {

  const stateFeature = (code) => ({
    type: 'Feature',
    id: code,
    properties: {
      ibgeCode: code,
      name: code === '35' ? 'São Paulo' : 'Rio de Janeiro',
      level: 'state',
      abbreviation: code === '35' ? 'SP' : 'RJ',
      parentCode: null,
      parentName: null,
      value: null,
      normalizedValue: null,
      classIndex: null,
    },
    geometry: {
      type: 'MultiPolygon',
      coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]]],
    },
  });

  respond = async (url) => {
    if (url.pathname.endsWith('/map/values')) {
      const ind = url.searchParams.get('indicator');
      if (ind === 'population') {
        return new Response(
          JSON.stringify({
            level: 'state',
            parent: null,
            indicator: {
              key: 'population',
              name: 'População',
              unit: 'people',
              decimalPlaces: 0,
              year: 2022,
              requestedYear: 'latest',
              availableYears: [2010, 2022],
            },
            statistics: { min: 10, max: 46000000, mean: 5000000, median: 3000000, count: 2, missing: 0 },
            classification: { method: 'quantile', breaks: [2000000, 46000000], classes: 2 },
            values: [
              { ibgeCode: '35', value: 46000000, normalizedValue: 1, classIndex: 1 },
              { ibgeCode: '33', value: 16000000, normalizedValue: 0.35, classIndex: 0 },
            ],
          }),
        );
      }
      if (ind === 'gdp_per_capita') {
        // Simula um delay pequeno para testar a transição
        await new Promise((r) => setTimeout(r, 60));
        return new Response(
          JSON.stringify({
            level: 'state',
            parent: null,
            indicator: {
              key: 'gdp_per_capita',
              name: 'PIB per capita',
              unit: 'BRL',
              decimalPlaces: 2,
              year: 2021,
              requestedYear: 'latest',
              availableYears: [2021],
            },
            statistics: { min: 20000, max: 58000, mean: 35000, median: 30000, count: 2, missing: 0 },
            classification: { method: 'quantile', breaks: [30000, 58000], classes: 2 },
            values: [
              { ibgeCode: '35', value: 58000, normalizedValue: 1, classIndex: 1 },
              { ibgeCode: '33', value: 42000, normalizedValue: 0.7, classIndex: 0 },
            ],
          }),
        );
      }
    }
    return new Response(
      JSON.stringify({
        type: 'FeatureCollection',
        scope: { level: 'state', parent: null, lod: 'overview', count: 2 },
        indicator: null,
        statistics: null,
        classification: null,
        features: [stateFeature('35'), stateFeature('33')],
      }),
    );
  };

  let hookResult;
  function TestComp({ indicator }) {
    hookResult = useMapLayer({ level: 'state', indicator });
    return null;
  }

  // 1. Carrega população
  await render(h(TestComp, { indicator: 'population' }));
  await until(() => hookResult.data?.features[0].properties.value === 46000000);
  assert.equal(hookResult.data.indicator.key, 'population');
  assert.equal(hookResult.data.features[0].properties.value, 46000000);
  assert.equal(hookResult.isPlaceholderData, false);

  // 2. Muda para PIB per capita
  await render(h(TestComp, { indicator: 'gdp_per_capita' }));

  // Durante a transição, NÃO deve exibir 46000000 como valor do novo indicador!
  // O valor deve ser null (geometria neutra) e isPlaceholderData true
  assert.notEqual(
    hookResult.data?.features[0].properties.value,
    46000000,
    'Não pode exibir o valor de população após trocar para PIB per capita',
  );
  assert.equal(hookResult.data?.indicator, null, 'Indicador deve ser null durante transição de indicador');

  // 3. Após a resposta do PIB per capita chegar:
  await until(() => hookResult.data?.features[0].properties.value === 58000);
  assert.equal(hookResult.data.indicator.key, 'gdp_per_capita');
  assert.equal(hookResult.data.indicator.unit, 'BRL');
  assert.equal(hookResult.data.features[0].properties.value, 58000);
  assert.equal(hookResult.isPlaceholderData, false);
});

test('Legend exibe estado de loading sem piscar "Sem dados" ao trocar indicador', async () => {
  const indicator = {
    key: 'gdp_per_capita',
    name: 'PIB per capita',
    unit: 'BRL',
    decimalPlaces: 2,
    year: 2021,
    requestedYear: 'latest',
    availableYears: [2021],
  };

  // Quando loading=true e classification=null, deve exibir a barra de loading e não a mensagem "Sem dados"
  await render(
    h(Legend, {
      indicator,
      classification: null,
      statistics: null,
      loading: true,
    }),
  );

  const html = dom.window.document.getElementById('root')?.innerHTML ?? '';
  assert.ok(html.includes('PIB per capita'), 'Deve exibir o nome do novo indicador');
  assert.ok(html.includes('legend-ramp is-loading'), 'Deve conter classe de carregamento da legenda');
  assert.ok(!html.includes('Sem dados para este recorte'), 'Não deve exibir texto falso de sem dados durante loading');
});

test('defaultViewName gera nomes sequenciais Visualização 1, Visualização 2...', () => {
  assert.equal(defaultViewName([]), 'Visualização 1');
  assert.equal(defaultViewName([{ name: 'Visualização 1' }]), 'Visualização 2');
  assert.equal(
    defaultViewName([{ name: 'Visualização 1' }, { name: 'Visualização 2' }]),
    'Visualização 3',
  );
  assert.equal(
    defaultViewName([{ name: 'Visualização 1' }, { name: 'Outro Nome' }]),
    'Visualização 2',
  );
  assert.equal(
    defaultViewName([{ name: 'Visualização 1' }, { name: 'Visualização 3' }]),
    'Visualização 4',
  );
});

test('SavedViewsPanel abre com nome padrão Visualização 1 e permite editar', async () => {
  respond = async (url) => {
    if (url.pathname.endsWith('/views')) {
      return new Response(JSON.stringify({ views: [] }));
    }
    return new Response('{}');
  };

  const current = {
    level: 'state',
    parentCode: null,
    indicatorKey: 'population',
    year: '2022',
  };
  const indicators = [
    { key: 'population', name: 'População', unit: 'people', availableYears: [2022] },
  ];

  await render(
    h(SavedViewsPanel, {
      current,
      currentParentName: null,
      indicators,
      onApply: () => {},
    }),
  );

  const rootEl = dom.window.document.getElementById('root');
  assert.ok(rootEl?.textContent?.includes('Visualizações salvas'));

  // Abre os detalhes
  const details = rootEl.querySelector('details');
  assert.ok(details);
  await act(async () => {
    details.open = true;
    details.dispatchEvent(new dom.window.Event('toggle'));
  });

  // Clica no botão "Salvar visualização atual"
  const saveBtn = rootEl.querySelector('.views-save-btn');
  assert.ok(saveBtn);
  await act(async () => {
    saveBtn.click();
  });

  // Verifica que o campo de texto foi aberto com valor inicial "Visualização 1"
  const input = rootEl.querySelector('#saved-view-name');
  assert.ok(input, 'Input de nova visualização deve existir');
  assert.equal(input.value, 'Visualização 1', 'Nome padrão deve ser Visualização 1');

  // Verifica que o usuário pode editar o valor
  await act(async () => {
    input.value = 'Meu Mapa Customizado';
    input.dispatchEvent(new dom.window.Event('change'));
  });
});
