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
  SVGElement: dom.window.SVGElement,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
dom.window.SVGSVGElement.prototype.createSVGRect = () => ({});
dom.window.matchMedia = () => ({ matches: true });
const { createElement: h, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { MapContainer, useMap } = await import('react-leaflet');
const { latLng, point } = (await import('leaflet')).default;
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const frontend = fileURLToPath(new URL('..', import.meta.url));
const scratch = await mkdtemp(join(frontend, 'node_modules', '.fire-tests-'));
const compiled = await build({
  stdin: {
    contents: `export { FireHotspotsLayer } from './src/features/fire/FireHotspotsLayer'; export { formatFireValue, formatFireDate } from './src/features/fire/fireStyles'; export { ChoroplethLayer } from './src/features/map/ChoroplethLayer'; export { densityColor } from './src/features/fire/fireDensity'; export { colorForTemperature } from './src/features/map/colors';`,
    resolveDir: frontend,
    loader: 'tsx',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  alias: { '@': join(frontend, 'src') },
  external: ['react', 'react-dom', 'react-leaflet', 'leaflet', '@tanstack/react-query'],
  define: { 'import.meta.env.VITE_API_BASE_URL': '"http://api.test/api/v1"' },
});
const path = join(scratch, 'fire.mjs');
await writeFile(path, compiled.outputFiles[0].text);
const {
  FireHotspotsLayer,
  formatFireValue,
  formatFireDate,
  ChoroplethLayer,
  densityColor,
  colorForTemperature,
} = await import(pathToFileURL(path).href);
let root, client, map, requests;
function CaptureMap() {
  map = useMap();
  return null;
}
const query = { level: 'country' };
const collection = {
  type: 'FeatureCollection',
  features: [],
  metadata: {
    level: 'country',
    parentCode: null,
    hours: 24,
    hotspotCount: 10000,
    status: 'ok',
    windowEnd: '2026-09-20T08:00:00Z',
    cqlFilter: 'id_0=33',
    wmsUrl: 'https://inpe.test/wms',
    wmsLayer: 'bdqueimadas:focos',
    sourceUrl: 'https://data.inpe.br/queimadas/',
  },
};
const feature = {
  type: 'Feature',
  id: 'inpe:1',
  geometry: { type: 'Point', coordinates: [-54, -11] },
  properties: {
    id: 'inpe:1',
    municipality: 'Marcelândia',
    state: 'MATO GROSSO',
    detectedAt: '2026-09-20T07:50:00Z',
    satellite: 'GOES-19',
    frp: 233.5,
    fireRisk: null,
    precipitationMm: null,
    daysWithoutRain: null,
    biome: 'Amazônia',
  },
};
async function tick(ms = 30) {
  await act(() => new Promise((resolve) => setTimeout(resolve, ms)));
}
async function render() {
  await act(async () =>
    root.render(
      h(
        QueryClientProvider,
        { client },
        h(
          MapContainer,
          { center: [-11, -54], zoom: 9, zoomControl: false, doubleClickZoom: false },
          h(CaptureMap),
          h(FireHotspotsLayer, { collection, query, onMapError: () => {} }),
        ),
      ),
    ),
  );
}
beforeEach(() => {
  requests = [];
  globalThis.fetch = async (url) => {
    requests.push(new URL(url));
    return new Response(
      JSON.stringify({ type: 'FeatureCollection', matchedCount: 63, features: [feature] }),
      { status: 200 },
    );
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

test('camada WMS preserva filtro e um clique carrega o popup sem criar milhares de marcadores', async () => {
  await render();
  assert.equal(requests.length, 0);
  const tile = document.querySelector('.leaflet-fire-hotspots-pane img');
  assert.ok(tile);
  assert.equal(new URL(tile.src).searchParams.get('CQL_FILTER'), 'id_0=33');
  assert.match(new URL(tile.src).searchParams.get('SLD_BODY'), /#c8462a/);
  await act(async () =>
    map.fire('click', { latlng: latLng(-11, -54), containerPoint: point(200, 200) }),
  );
  await tick(280);
  await tick();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].pathname, '/api/v1/fire-hotspots/identify');
  const popup = document.querySelector('.fire-popup');
  assert.ok(popup);
  assert.match(popup.textContent, /Marcelândia/);
  assert.match(popup.textContent, /233,5 MW/);
  assert.match(popup.textContent, /07:50 UTC/);
  assert.doesNotMatch(popup.textContent, /Índice de risco de fogo|Precipitação|Dias sem chuva/);
});

test('no mapa do país o clique não consulta detalhes nem abre popup', async () => {
  await act(async () =>
    root.render(
      h(
        QueryClientProvider,
        { client },
        h(
          MapContainer,
          { center: [-11, -54], zoom: 4, zoomControl: false, doubleClickZoom: false },
          h(CaptureMap),
          h(FireHotspotsLayer, { collection, query, onMapError: () => {} }),
        ),
      ),
    ),
  );
  await act(async () =>
    map.fire('click', { latlng: latLng(-11, -54), containerPoint: point(200, 200) }),
  );
  await tick(280);
  assert.equal(requests.length, 0);
  assert.equal(document.querySelector('.fire-popup'), null);
});

test('detecção fora do ponto clicado não substitui a navegação territorial', async () => {
  globalThis.fetch = async (url) => {
    requests.push(new URL(url));
    return new Response(
      JSON.stringify({
        type: 'FeatureCollection',
        matchedCount: 1,
        features: [
          {
            ...feature,
            geometry: { type: 'Point', coordinates: [-40, 0] },
          },
        ],
      }),
      { status: 200 },
    );
  };
  await render();
  await act(async () =>
    map.fire('click', { latlng: latLng(-11, -54), containerPoint: point(200, 200) }),
  );
  await tick(280);
  await tick();
  assert.equal(requests.length, 1);
  assert.equal(document.querySelector('.fire-popup'), null);
});

test('duplo clique e movimento mantêm navegação sem abrir detalhes pendentes', async () => {
  await render();
  for (const action of ['dblclick', 'movestart']) {
    await act(async () => {
      map.fire('click', { latlng: latLng(-11, -54), containerPoint: point(200, 200) });
      map.fire(action, { latlng: latLng(-11, -54), containerPoint: point(200, 200) });
    });
    await tick(280);
  }
  assert.equal(requests.length, 0);
  assert.equal(document.querySelector('.fire-popup'), null);
});

test('risco permanece índice e zero válido não vira ausência', () => {
  assert.equal(formatFireValue(0.8), '0,8');
  assert.equal(formatFireValue(0, ' mm'), '0 mm');
  assert.equal(formatFireValue(null), null);
  assert.equal(formatFireValue(-999), null);
  assert.equal(formatFireDate('invalid'), 'Horário não informado');
});

test('focos substituem a temperatura no mesmo polígono e desligar restaura o clima', async () => {
  const territory = {
    type: 'FeatureCollection',
    scope: { level: 'state', parent: null, lod: 'overview' },
    indicator: null,
    classification: null,
    features: [
      {
        type: 'Feature',
        id: '51',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [
              [
                [-55, -12],
                [-53, -12],
                [-53, -10],
                [-55, -10],
                [-55, -12],
              ],
            ],
          ],
        },
        properties: { ibgeCode: '51', name: 'Mato Grosso', value: null, classIndex: null },
      },
    ],
  };
  const weatherByCode = new Map([['51', { id: '51', temperatureC: 32, weatherCode: 0 }]]);
  const fireByCode = new Map([
    [
      '51',
      {
        ibgeCode: '51',
        density: 8,
        count: 200,
        count24h: 80,
        areaKm2: 25000,
        latestDetectionAt: '2026-09-20T07:50:00Z',
      },
    ],
  ]);
  let selected;
  async function draw(fireMode) {
    await act(async () =>
      root.render(
        h(
          MapContainer,
          { center: [-11, -54], zoom: 4, zoomControl: false },
          h(CaptureMap),
          h(ChoroplethLayer, {
            collection: territory,
            weatherByCode,
            fireByCode,
            fireMode,
            selectedCode: null,
            onSelect: (code) => {
              selected = code;
            },
          }),
        ),
      ),
    );
  }
  await draw(undefined);
  const polygon = document.querySelector('.territory-shape');
  assert.ok(polygon);
  assert.equal(polygon.getAttribute('fill'), colorForTemperature(32));
  await draw('territorial');
  assert.equal(document.querySelector('.territory-shape'), polygon);
  assert.equal(polygon.getAttribute('fill'), densityColor(8));
  await act(async () => polygon.dispatchEvent(new dom.window.FocusEvent('focus')));
  const tooltip = document.getElementById('map-hover-tooltip');
  assert.match(tooltip.textContent, /8 focos \/ 1.000 km²/);
  assert.match(tooltip.textContent, /80 em 24h/);
  assert.match(tooltip.textContent, /25.000 km²/);
  assert.doesNotMatch(tooltip.textContent, /°C/);
  await act(async () =>
    polygon.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })),
  );
  assert.equal(selected, '51');
  await draw(undefined);
  assert.equal(polygon.getAttribute('fill'), colorForTemperature(32));
  assert.match(tooltip.textContent, /32 °C/);
  assert.doesNotMatch(tooltip.textContent, /focos/);
});

test('lotes municipais preservam SVG e foco; sem dados não inventam temperatura', async () => {
  const municipality = (code, west) => ({
    type: 'Feature', id: code,
    properties: { ibgeCode: code, name: `Município ${code}`, level: 'municipality', value: null },
    geometry: { type: 'MultiPolygon', coordinates: [[[
      [west, -12], [west + 0.01, -11.9], [west + 0.02, -11.95],
      [west + 1, -11], [west, -12],
    ]]] },
  });
  const first = municipality('5100001', -55);
  const second = municipality('5100002', -54);
  const weatherByCode = new Map([['5100001', { id: '5100001', temperatureC: 32, weatherCode: 0 }]]);
  const draw = async (features) => act(async () => root.render(h(MapContainer,
    { center: [-11, -54], zoom: 8, zoomControl: false }, h(CaptureMap),
    h(ChoroplethLayer, {
      collection: { type: 'FeatureCollection', features,
        scope: { level: 'municipality', parent: '51', lod: 'canonical' }, indicator: null },
      selectedCode: null, onSelect: () => {}, weatherByCode,
    }),
  )));
  await draw([first]);
  const polygon = document.querySelector('[aria-label="Município 5100001"]');
  await act(async () => polygon.focus());
  await draw([first, second]);
  assert.equal(document.querySelector('[aria-label="Município 5100001"]'), polygon);
  assert.equal(document.activeElement, polygon);
  assert.equal(document.querySelectorAll('.territory-shape').length, 2);
  const other = document.querySelector('[aria-label="Município 5100002"]');
  assert.equal(other.getAttribute('fill'), '#f1f5f9');
  map.eachLayer((layer) => {
    if (layer.feature?.id === '5100001') {
      assert.equal(layer.options.smoothFactor, 0);
      assert.equal(layer.toGeoJSON().geometry.coordinates[0][0].length, 5);
    }
  });
  await draw([second]);
  assert.equal(document.querySelectorAll('.territory-shape').length, 1);
  assert.equal(document.querySelector('[aria-label="Município 5100002"]'), other);
});
