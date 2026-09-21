import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  Element: dom.window.Element,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });

const { createElement: h, act } = await import('react');
const { createRoot } = await import('react-dom/client');

const frontend = fileURLToPath(new URL('..', import.meta.url));
const scratch = await mkdtemp(join(frontend, 'node_modules', '.climate-tests-'));
const compiled = await build({
  stdin: {
    contents: `export { ClimateOverview } from './src/features/weather/ClimateOverview';`,
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
const path = join(scratch, 'climate.mjs');
await writeFile(path, compiled.outputFiles[0].text);
const { ClimateOverview } = await import(pathToFileURL(path).href);

let root;

beforeEach(() => {
  root = createRoot(document.getElementById('root'));
});

afterEach(async () => {
  await act(async () => root.unmount());
});

after(async () => {
  dom.window.close();
  await rm(scratch, { recursive: true, force: true });
});

test('ClimateOverview renderiza capitais mais quentes e mais frias em visão nacional', async () => {
  const capitals = [
    { id: 'MT', name: 'Cuiabá', temperatureC: 36.4, stateAbbreviation: 'MT' },
    { id: 'RR', name: 'Boa Vista', temperatureC: 34.1, stateAbbreviation: 'RR' },
    { id: 'TO', name: 'Palmas', temperatureC: 33.8, stateAbbreviation: 'TO' },
    { id: 'DF', name: 'Brasília', temperatureC: 25.0, stateAbbreviation: 'DF' },
    { id: 'SP', name: 'São Paulo', temperatureC: 19.5, stateAbbreviation: 'SP' },
    { id: 'RS', name: 'Porto Alegre', temperatureC: 15.2, stateAbbreviation: 'RS' },
    { id: 'PR', name: 'Curitiba', temperatureC: 13.7, stateAbbreviation: 'PR' },
  ];

  let selectedCity = null;

  await act(async () =>
    root.render(
      h(ClimateOverview, {
        cities: capitals,
        onSelect: (c) => {
          selectedCity = c;
        },
        isDrilledDown: false,
      }),
    ),
  );

  const summary = document.querySelector('.disclosure-trigger span');
  assert.ok(summary);
  assert.equal(summary.textContent, 'Capital mais quente e capital mais fria');

  // Abre o disclosure
  const details = document.querySelector('details');
  assert.ok(details);
  await act(async () => {
    details.open = true;
    details.dispatchEvent(new dom.window.Event('toggle'));
  });

  const headers = document.querySelectorAll('.climate-ranking-header');
  assert.equal(headers.length, 2);
  assert.match(headers[0].textContent, /Capital mais quente/);
  assert.match(headers[1].textContent, /Capital mais fria/);

  const cityButtons = document.querySelectorAll('.climate-ranking-city');
  assert.ok(cityButtons.length >= 2);

  // Mais quente: Cuiabá com 36°C
  assert.match(cityButtons[0].textContent, /Cuiabá/);
  assert.match(cityButtons[0].textContent, /36°C/);

  // Clica na cidade mais quente
  await act(async () => cityButtons[0].click());
  assert.equal(selectedCity?.name, 'Cuiabá');
  assert.equal(selectedCity?.id, 'MT');
});

test('ClimateOverview renderiza título customizado para estado em visão drilldown', async () => {
  const stateCities = [
    { id: '3543402', name: 'Ribeirão Preto', temperatureC: 31.2, stateAbbreviation: 'SP' },
    { id: '3509502', name: 'Campinas', temperatureC: 24.1, stateAbbreviation: 'SP' },
    { id: '3509700', name: 'Campos do Jordão', temperatureC: 14.8, stateAbbreviation: 'SP' },
  ];

  await act(async () =>
    root.render(
      h(ClimateOverview, {
        cities: stateCities,
        onSelect: () => {},
        scopeName: 'São Paulo',
        isDrilledDown: true,
      }),
    ),
  );

  const summary = document.querySelector('.disclosure-trigger span');
  assert.ok(summary);
  assert.equal(summary.textContent, 'Cidade mais quente e mais fria · São Paulo');

  // Abre o disclosure
  const details = document.querySelector('details');
  assert.ok(details);
  await act(async () => {
    details.open = true;
    details.dispatchEvent(new dom.window.Event('toggle'));
  });

  const headers = document.querySelectorAll('.climate-ranking-header');
  assert.equal(headers.length, 2);
  assert.match(headers[0].textContent, /Mais quente/);
  assert.match(headers[1].textContent, /Mais fria/);
});

test('ClimateOverview retorna null quando não há cidades com temperatura válida', async () => {
  await act(async () =>
    root.render(
      h(ClimateOverview, {
        cities: [],
        onSelect: () => {},
        isDrilledDown: false,
      }),
    ),
  );

  assert.equal(document.querySelector('.climate-ranking'), null);
});

test('ClimateOverview renderiza dados pré-calculados do servidor sem precisar processar cidades', async () => {
  const hottest = [{ id: 'MT', name: 'Cuiabá', temperatureC: 38.5, stateAbbreviation: 'MT' }];
  const coldest = [{ id: 'PR', name: 'Curitiba', temperatureC: 12.0, stateAbbreviation: 'PR' }];

  await act(async () =>
    root.render(
      h(ClimateOverview, {
        hottest,
        coldest,
        onSelect: () => {},
        isDrilledDown: false,
      }),
    ),
  );

  const details = document.querySelector('details');
  assert.ok(details);
  await act(async () => {
    details.open = true;
    details.dispatchEvent(new dom.window.Event('toggle'));
  });

  const cityButtons = document.querySelectorAll('.climate-ranking-city');
  assert.equal(cityButtons.length, 2);
  assert.match(cityButtons[0].textContent, /Cuiabá/);
  assert.match(cityButtons[0].textContent, /39°C/);
  assert.match(cityButtons[1].textContent, /Curitiba/);
  assert.match(cityButtons[1].textContent, /12°C/);
});


