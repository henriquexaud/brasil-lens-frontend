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
    contents: `export { FireHotspotsLayer } from './src/features/fire/FireHotspotsLayer'; export { formatFireValue, formatFireDate } from './src/features/fire/fireStyles'; export { ChoroplethLayer } from './src/features/map/ChoroplethLayer'; export { densityColor } from './src/features/fire/fireDensity'; export { colorForTemperature } from './src/features/map/colors'; export { WeatherPanel } from './src/features/weather/WeatherPanel'; export { FireOverview } from './src/features/fire/FireOverview'; export { WeatherOptions } from './src/features/weather/WeatherOptions';`,
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
  WeatherPanel,
  FireOverview,
  WeatherOptions,
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

test('WeatherPanel destaca métricas de focos quando a camada de fogo está ativa', async () => {
  const fireMunicipality = {
    ibgeCode: '5100001',
    name: 'Marcelândia',
    state: 'Mato Grosso',
    count: 120,
    count24h: 45,
    density: 14.2,
    areaKm2: 12500,
    latestDetectionAt: '2026-09-20T07:50:00Z',
  };
  await act(async () =>
    root.render(
      h(
        QueryClientProvider,
        { client },
        h(WeatherPanel, {
          code: '5100001',
          territory: { ibgeCode: '5100001', name: 'Marcelândia', parentName: 'Mato Grosso', level: 'municipality', value: null },
          city: undefined,
          data: undefined,
          error: null,
          loading: false,
          onClose: () => {},
          onDrillDown: () => {},
          fireMunicipality,
          fireActive: true,
          fireHours: 24,
        }),
      ),
    ),
  );
  const card = document.querySelector('.fire-detail-card.is-highlight');
  assert.ok(card, 'Card de fogo destacado deve estar presente');
  assert.match(card.textContent, /14,2 focos \/ 1.000 km²/);
  assert.match(card.textContent, /45 em 24h/);
  assert.match(card.textContent, /12\.500\s*km² de área/);
  assert.match(card.textContent, /Última detecção:/);
  assert.match(card.textContent, /07:50 UTC/);
});

test('WeatherPanel exibe estado limpo quando não há detecções recentes de calor', async () => {
  const cleanMunicipality = {
    ibgeCode: '3550308',
    name: 'São Paulo',
    state: 'São Paulo',
    count: 0,
    count24h: 0,
    density: 0,
    areaKm2: 1521,
    latestDetectionAt: null,
  };
  await act(async () =>
    root.render(
      h(
        QueryClientProvider,
        { client },
        h(WeatherPanel, {
          code: '3550308',
          territory: { ibgeCode: '3550308', name: 'São Paulo', parentName: 'São Paulo', level: 'municipality', value: null },
          city: undefined,
          data: undefined,
          error: null,
          loading: false,
          onClose: () => {},
          onDrillDown: () => {},
          fireMunicipality: cleanMunicipality,
          fireActive: true,
          fireHours: 24,
        }),
      ),
    ),
  );
  const card = document.querySelector('.fire-detail-card');
  assert.ok(card);
  assert.match(card.textContent, /Sem focos ativos/);
  assert.match(card.textContent, /0 em 24h/);
  assert.match(card.textContent, /Nenhuma detecção de calor registrada/);
});

test('FireOverview contextualiza o ranking pelo recorte do estado', async () => {
  const summary = {
    windowStart: '2026-09-19T08:00:00Z',
    windowEnd: '2026-09-20T08:00:00Z',
    hours: 24,
    total: 300,
    municipalities: [
      {
        ibgeCode: '5100001',
        name: 'Marcelândia',
        state: 'MT',
        areaKm2: 12500,
        count: 120,
        count24h: 45,
        density: 14.2,
        latestDetectionAt: '2026-09-20T07:50:00Z',
      },
    ],
    states: [],
    unassignedCount: 0,
    areaSource: 'ibge',
  };
  await act(async () =>
    root.render(h(FireOverview, { summary, onSelect: () => {}, scopeName: 'Mato Grosso' })),
  );
  const summaryEl = document.querySelector('.fire-ranking summary');
  assert.ok(summaryEl);
  assert.match(summaryEl.textContent, /Maior densidade de focos · Mato Grosso/);
});

test('WeatherPanel lida com variações de casing do backend (count24H, count_24h) sem estourar TypeError', async () => {
  const fireMunicipalityWithCapsH = {
    ibgeCode: '1302603',
    name: 'Manaus',
    state: 'AM',
    count: 32,
    count24H: 18,
    density: 2.1,
    areaKm2: 11401,
    latestDetectionAt: null,
  };
  await act(async () =>
    root.render(
      h(
        QueryClientProvider,
        { client },
        h(WeatherPanel, {
          code: '1302603',
          territory: { ibgeCode: '1302603', name: 'Manaus', parentName: 'Amazonas', level: 'municipality', value: null },
          city: undefined,
          data: undefined,
          error: null,
          loading: false,
          onClose: () => {},
          onDrillDown: () => {},
          fireMunicipality: fireMunicipalityWithCapsH,
          fireActive: true,
          fireHours: 24,
        }),
      ),
    ),
  );
  const card = document.querySelector('.fire-detail-card');
  assert.ok(card);
  assert.match(card.textContent, /18 em 24h/);
  assert.match(card.textContent, /2,1 focos \/ 1.000 km²/);
});

test('WeatherPanel em camada de fogo oculta completamente detalhes e disclosures de clima', async () => {
  const fireMunicipality = {
    ibgeCode: '5100001',
    name: 'Marcelândia',
    state: 'Mato Grosso',
    count: 120,
    count24h: 45,
    density: 14.2,
    areaKm2: 12500,
    latestDetectionAt: '2026-09-20T07:50:00Z',
  };
  const dummyCity = {
    id: '5100001',
    name: 'Marcelândia',
    stateAbbreviation: 'MT',
    temperatureC: 34,
    apparentTemperatureC: 38,
    relativeHumidityPct: 40,
    windSpeedKmh: 15,
    weatherCode: 0,
    observedAt: '2026-09-20T12:00:00Z',
    timezone: 'America/Cuiaba',
    forecast: [],
  };

  await act(async () =>
    root.render(
      h(
        QueryClientProvider,
        { client },
        h(WeatherPanel, {
          code: '5100001',
          territory: { ibgeCode: '5100001', name: 'Marcelândia', parentName: 'Mato Grosso', level: 'municipality', value: null },
          city: dummyCity,
          data: undefined,
          error: null,
          loading: false,
          onClose: () => {},
          onDrillDown: () => {},
          fireMunicipality,
          fireActive: true,
          fireHours: 24,
          rainActive: false,
        }),
      ),
    ),
  );

  const panel = document.querySelector('.territory-detail');
  assert.ok(panel);
  assert.equal(panel.getAttribute('aria-label'), 'Focos de calor do local selecionado');
  assert.equal(document.querySelector('.fire-detail-card'), panel.querySelector('.fire-detail-card'));
  // Não deve conter 'Condições meteorológicas' ou indicadores térmicos (°C, Sensação, etc.)
  assert.equal(document.querySelector('.weather-disclosure'), null);
  assert.doesNotMatch(panel.textContent, /Condições meteorológicas/);
  assert.doesNotMatch(panel.textContent, /°C/);
  assert.doesNotMatch(panel.textContent, /Sensação/);
  assert.doesNotMatch(panel.textContent, /Umidade/);
});

test('WeatherPanel em camada de chuva exibe métricas de precipitação e oculta clima e fogo', async () => {
  const dummyCity = {
    id: '5100001',
    name: 'Marcelândia',
    stateAbbreviation: 'MT',
    temperatureC: 28,
    apparentTemperatureC: 30,
    relativeHumidityPct: 85,
    windSpeedKmh: 10,
    weatherCode: 61,
    precipitationSumMm: 45.2,
    precipitationProbabilityPct: 90,
    observedAt: '2026-09-20T12:00:00Z',
    timezone: 'America/Cuiaba',
    forecast: [{ date: '2026-09-20', precipitationSumMm: 45.2, precipitationProbabilityPct: 90 }],
  };
  const fireMunicipality = {
    ibgeCode: '5100001',
    name: 'Marcelândia',
    state: 'Mato Grosso',
    count: 10,
    count24h: 5,
    density: 1.2,
    areaKm2: 12500,
    latestDetectionAt: '2026-09-20T07:50:00Z',
  };

  await act(async () =>
    root.render(
      h(
        QueryClientProvider,
        { client },
        h(WeatherPanel, {
          code: '5100001',
          territory: { ibgeCode: '5100001', name: 'Marcelândia', parentName: 'Mato Grosso', level: 'municipality', value: null },
          city: dummyCity,
          data: undefined,
          error: null,
          loading: false,
          onClose: () => {},
          onDrillDown: () => {},
          fireMunicipality,
          fireActive: false,
          fireHours: 24,
          rainActive: true,
        }),
      ),
    ),
  );

  const panel = document.querySelector('.territory-detail');
  assert.ok(panel);
  assert.equal(panel.getAttribute('aria-label'), 'Quantidade de chuva do local selecionado');
  const rainCard = document.querySelector('.rain-detail-card');
  assert.ok(rainCard);
  assert.match(rainCard.textContent, /45,2\s*mm/);
  assert.match(rainCard.textContent, /90%/);
  const forecastCard = document.querySelector('.rain-forecast-card');
  assert.ok(forecastCard);
  assert.match(forecastCard.textContent, /Previsão diária de chuva/);
  assert.match(forecastCard.textContent, /45,2\s*mm/);
  // Não deve conter clima geral (°C, Sensação, Umidade) nem disclosure de focos de calor
  assert.equal(document.querySelector('.weather-disclosure'), null);
  assert.doesNotMatch(panel.textContent, /Condições meteorológicas/);
  assert.doesNotMatch(panel.textContent, /°C/);
  assert.doesNotMatch(panel.textContent, /Focos de calor/);
  assert.doesNotMatch(panel.textContent, /focos \/ 1\.000 km²/);
});

test('WeatherPanel em modo Clima mantém foco térmico/geral e não mistura disclosure de chuva', async () => {
  const dummyCity = {
    id: '3550308',
    name: 'São Paulo',
    stateAbbreviation: 'SP',
    temperatureC: 24.2,
    apparentTemperatureC: 25.1,
    humidityPct: 65,
    windSpeedKmh: 14,
    weatherCode: 1,
    precipitationSumMm: 12.0,
    precipitationProbabilityPct: 70,
    precipitationIntervalMinutes: 15,
    precipitationMm: 0.5,
    observedAt: '2026-09-20T12:00:00Z',
    timezone: 'America/Sao_Paulo',
    forecast: [],
  };

  await act(async () =>
    root.render(
      h(
        QueryClientProvider,
        { client },
        h(WeatherPanel, {
          code: '3550308',
          territory: { ibgeCode: '3550308', name: 'São Paulo', parentName: 'São Paulo', level: 'municipality', value: null },
          city: dummyCity,
          data: undefined,
          error: null,
          loading: false,
          onClose: () => {},
          onDrillDown: () => {},
          fireActive: false,
          rainActive: false,
        }),
      ),
    ),
  );

  const panel = document.querySelector('.territory-detail');
  assert.ok(panel);
  assert.equal(panel.getAttribute('aria-label'), 'Clima do local selecionado');
  assert.match(panel.textContent, /24,2°/);
  assert.match(panel.textContent, /Sensação de 25,1°/);

  // Não deve exibir disclosure de Quantidade de chuva no modo clima puro
  const summaries = Array.from(document.querySelectorAll('summary')).map((s) => s.textContent);
  assert.equal(summaries.some((text) => text.includes('Quantidade de chuva')), false);

  // Ao abrir "Mais detalhes", deve exibir Umidade e Vento, mas não chuva
  const details = Array.from(document.querySelectorAll('details')).find((d) =>
    d.textContent?.includes('Mais detalhes'),
  );
  assert.ok(details);
  await act(async () => {
    details.open = true;
    details.dispatchEvent(new dom.window.Event('toggle'));
  });
  assert.match(details.textContent, /Umidade/);
  assert.match(details.textContent, /Vento/);
  assert.doesNotMatch(details.textContent, /Chuva acumulada/);
});

test('WeatherOptions exibe Clima, Focos e Chuva com concorrência e estado de atualização', async () => {
  let climateToggled = null;
  let fireToggled = null;
  let rainToggled = null;
  let refreshed = false;

  await act(async () =>
    root.render(
      h(
        QueryClientProvider,
        { client },
        h(WeatherOptions, {
          showAlerts: false,
          onToggleAlerts: () => {},
          showClimate: true,
          onToggleClimate: (val) => { climateToggled = val; },
          showFireHotspots: false,
          onToggleFireHotspots: (val) => { fireToggled = val; },
          showRainfall: false,
          onToggleRainfall: (val) => { rainToggled = val; },
          code: '35',
          current: undefined,
          error: null,
          loading: true,
          onRefresh: () => { refreshed = true; },
        }),
      ),
    ),
  );

  const checkboxes = document.querySelectorAll('.weather-layers-panel input[type="checkbox"]');
  // Clima, Quantidade de chuva, Focos de calor, Avisos
  assert.ok(checkboxes.length >= 3);
  assert.equal(checkboxes[0].checked, true, 'Clima deve estar marcado');
  assert.equal(checkboxes[1].checked, false, 'Chuva deve estar desmarcada');
  assert.equal(checkboxes[2].checked, false, 'Focos deve estar desmarcado');

  // Badge de clima ativo
  const climateBadge = document.querySelector('.badge-climate');
  assert.ok(climateBadge);
  assert.equal(climateBadge.textContent, 'Ativo');

  // Botão em estado Atualizando... desabilitado
  const refreshBtn = document.querySelector('.weather-refresh-btn');
  assert.ok(refreshBtn);
  assert.equal(refreshBtn.disabled, true);
  assert.equal(refreshBtn.textContent, 'Atualizando…');

  const syncDot = document.querySelector('.weather-sync-dot');
  assert.ok(syncDot.classList.contains('syncing'));

  // Teste de interação com checkbox de fogo (agora no índice 2)
  await act(async () => checkboxes[2].click());
  assert.equal(fireToggled, true);
});

test('WeatherOptions exibe faixa de temperatura mínima e máxima no badge da camada de clima', async () => {
  await act(async () =>
    root.render(
      h(
        QueryClientProvider,
        { client },
        h(WeatherOptions, {
          showAlerts: false,
          onToggleAlerts: () => {},
          showClimate: true,
          onToggleClimate: () => {},
          minTemperature: 20.2,
          maxTemperature: 34.4,
          scopeName: 'Brasil',
          code: null,
          current: undefined,
          error: null,
          loading: false,
          onRefresh: () => {},
        }),
      ),
    ),
  );

  const badge = document.querySelector('.badge-climate');
  assert.ok(badge);
  assert.equal(badge.textContent, '20 - 34°C · Brasil');

  // Quando min == max (temperatura única)
  await act(async () =>
    root.render(
      h(
        QueryClientProvider,
        { client },
        h(WeatherOptions, {
          showAlerts: false,
          onToggleAlerts: () => {},
          showClimate: true,
          onToggleClimate: () => {},
          minTemperature: 24,
          maxTemperature: 24,
          scopeName: 'Campinas',
          code: '3509502',
          current: undefined,
          error: null,
          loading: false,
          onRefresh: () => {},
        }),
      ),
    ),
  );

  const singleBadge = document.querySelector('.badge-climate');
  assert.ok(singleBadge);
  assert.equal(singleBadge.textContent, '24°C · Campinas');
});

