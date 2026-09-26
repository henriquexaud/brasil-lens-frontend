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
    contents: `export { FireHotspotsLayer } from './src/features/fire/FireHotspotsLayer'; export { formatFireValue, formatFireDate } from './src/features/fire/fireStyles'; export { TerritoryLayer } from './src/features/map/TerritoryLayer'; export { densityColor } from './src/features/fire/fireDensity'; export { colorForTemperature } from './src/features/map/colors'; export { WeatherPanel } from './src/features/weather/WeatherPanel'; export { FireOverview } from './src/features/fire/FireOverview'; export { WeatherOptions } from './src/features/weather/WeatherOptions'; export { WeatherThematicSwitch } from './src/features/weather/WeatherThematicSwitch'; export { ApiError } from './src/api/client'; export { focusLabelBudget } from './src/features/weather/WeatherLayer'; export { ScopeHeader } from './src/components/ScopeHeader';`,
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
  ApiError,
  FireHotspotsLayer,
  formatFireValue,
  formatFireDate,
  TerritoryLayer,
  densityColor,
  colorForTemperature,
  WeatherPanel,
  FireOverview,
  WeatherOptions,
  WeatherThematicSwitch,
  focusLabelBudget,
  ScopeHeader,
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
        properties: { ibgeCode: '51', name: 'Mato Grosso' },
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
          h(TerritoryLayer, {
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
    properties: { ibgeCode: code, name: `Município ${code}`, level: 'municipality' },
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
    h(TerritoryLayer, {
      collection: { type: 'FeatureCollection', features,
        scope: { level: 'municipality', parent: '51', lod: 'canonical' } },
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
          territory: { ibgeCode: '5100001', name: 'Marcelândia', parentName: 'Mato Grosso', level: 'municipality' },
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
          territory: { ibgeCode: '3550308', name: 'São Paulo', parentName: 'São Paulo', level: 'municipality' },
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
          territory: { ibgeCode: '1302603', name: 'Manaus', parentName: 'Amazonas', level: 'municipality' },
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
          territory: { ibgeCode: '5100001', name: 'Marcelândia', parentName: 'Mato Grosso', level: 'municipality' },
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
          territory: { ibgeCode: '5100001', name: 'Marcelândia', parentName: 'Mato Grosso', level: 'municipality' },
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
          territory: { ibgeCode: '3550308', name: 'São Paulo', parentName: 'São Paulo', level: 'municipality' },
          city: dummyCity,
          data: undefined,
          error: null,
          loading: false,
          onClose: () => {},
          onDrillDown: () => {},
          fireMunicipality: { ibgeCode: '3550308', count: 12, count24h: 12, density: 4.5 },
          fireLoading: false,
          fireActive: false,
          rainActive: false,
        }),
      ),
    ),
  );

  const panel = document.querySelector('.territory-detail');
  assert.ok(panel);
  assert.equal(panel.getAttribute('aria-label'), 'Clima do local selecionado');
  assert.match(panel.textContent, /24°/);
  assert.match(panel.textContent, /Sensação de 25°/);

  // Não deve exibir disclosure de Quantidade de chuva nem Focos de calor no modo clima puro
  const summaries = Array.from(document.querySelectorAll('summary')).map((s) => s.textContent);
  assert.equal(summaries.some((text) => text.includes('Quantidade de chuva')), false);
  assert.equal(summaries.some((text) => text.includes('Focos de calor')), false);
  assert.doesNotMatch(panel.textContent, /Focos de calor/);
  assert.doesNotMatch(panel.textContent, /focos \/ 1\.000 km²/);

  // Não deve existir disclosure de "Mais detalhes", apenas "Próximos dias"
  const details = Array.from(document.querySelectorAll('details'));
  assert.equal(details.some((d) => d.textContent?.includes('Mais detalhes')), false);
  assert.equal(details.some((d) => d.textContent?.includes('Próximos dias')), true);

  // Umidade e Vento devem estar sempre visíveis em linha compacta
  const compactMetrics = document.querySelector('.weather-compact-metrics');
  assert.ok(compactMetrics);
  assert.match(compactMetrics.textContent, /Umidade 65%/);
  assert.match(compactMetrics.textContent, /Vento 14 km\/h/);
  assert.doesNotMatch(panel.textContent, /Chuva acumulada/);

  // Não deve repetir o nome do estado acima do município no kicker
  assert.equal(panel.querySelector('.detail-kicker'), null);
});

test('seletor temático exibe Clima, Focos e Chuva e alterna a camada ativa', async () => {
  let climateToggled = null;
  let fireToggled = null;
  let rainToggled = null;

  await act(async () =>
    root.render(
      h(
        QueryClientProvider,
        { client },
        h(WeatherThematicSwitch, {
          showClimate: true,
          onToggleClimate: (val) => { climateToggled = val; },
          showFireHotspots: false,
          onToggleFireHotspots: (val) => { fireToggled = val; },
          showRainfall: false,
          onToggleRainfall: (val) => { rainToggled = val; },
        }),
      ),
    ),
  );

  const segmentButtons = document.querySelectorAll('.weather-segment-btn');
  // Clima, Chuva, Focos
  assert.equal(segmentButtons.length, 3);
  assert.equal(segmentButtons[0].classList.contains('is-active'), true, 'Clima deve estar ativo');
  assert.equal(segmentButtons[1].classList.contains('is-active'), false, 'Chuva deve estar inativa');
  assert.equal(segmentButtons[2].classList.contains('is-active'), false, 'Focos deve estar inativo');

  // Badge de clima ativo
  const climateBadge = document.querySelector('.badge-climate');
  assert.ok(climateBadge);
  assert.equal(climateBadge.textContent, 'Ativo');

  // Teste de interação com botão de foco (índice 2)
  await act(async () => segmentButtons[2].click());
  assert.equal(fireToggled, true);
});

test('seletor temático exibe faixa de temperatura no badge da camada de clima', async () => {
  await act(async () =>
    root.render(
      h(
        QueryClientProvider,
        { client },
        h(WeatherThematicSwitch, {
          showClimate: true,
          onToggleClimate: () => {},
          minTemperature: 20.2,
          maxTemperature: 34.4,
          scopeName: 'Brasil',
          code: null,
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
        h(WeatherThematicSwitch, {
          showClimate: true,
          onToggleClimate: () => {},
          minTemperature: 24,
          maxTemperature: 24,
          scopeName: 'Campinas',
          code: '3509502',
        }),
      ),
    ),
  );

  const singleBadge = document.querySelector('.badge-climate');
  assert.ok(singleBadge);
  assert.equal(singleBadge.textContent, '24°C · Campinas');
});


test('tooltip do mapa marca de leve a temperatura estimada e não marca a medida', async () => {
  const municipality = (code, west) => ({
    type: 'Feature', id: code,
    properties: { ibgeCode: code, name: `Município ${code}`, level: 'municipality' },
    geometry: { type: 'MultiPolygon', coordinates: [[[
      [west, -12], [west + 1, -12], [west + 1, -11], [west, -11], [west, -12],
    ]]] },
  });
  const weatherByCode = new Map([
    ['5100001', { id: '5100001', temperatureC: 32, weatherCode: 0 }],
    ['5100002', { id: '5100002', temperatureC: 30, weatherCode: 0, isInferred: true }],
  ]);
  await act(async () => root.render(h(MapContainer,
    { center: [-11.5, -54], zoom: 7, zoomControl: false }, h(CaptureMap),
    h(TerritoryLayer, {
      collection: { type: 'FeatureCollection',
        features: [municipality('5100001', -55), municipality('5100002', -54)],
        scope: { level: 'municipality', parent: '51', lod: 'canonical' } },
      selectedCode: null, onSelect: () => {}, weatherByCode,
    }),
  )));
  const tooltip = () => document.getElementById('map-hover-tooltip').textContent;
  const measured = document.querySelector('[aria-label="Município 5100001"]');
  await act(async () => measured.dispatchEvent(new dom.window.FocusEvent('focus')));
  assert.match(tooltip(), /32 °C/);
  assert.doesNotMatch(tooltip(), /≈|estimado/);
  const estimated = document.querySelector('[aria-label="Município 5100002"]');
  await act(async () => estimated.dispatchEvent(new dom.window.FocusEvent('focus')));
  assert.match(tooltip(), /≈ 30 °C/);
  assert.match(tooltip(), /Céu limpo · estimado/);
});

test('WeatherPanel mostra o valor estimado com uma nota discreta', async () => {
  const city = {
    id: '3509502', name: 'Campinas', stateAbbreviation: 'SP', temperatureC: 23,
    apparentTemperatureC: 23, humidityPct: 60, windSpeedKmh: 10, weatherCode: 1,
    precipitationMm: 0, precipitationIntervalMinutes: 15,
    observedAt: '2026-09-20T12:00:00Z', timezone: 'America/Sao_Paulo', forecast: [],
  };
  const draw = (value) => act(async () => root.render(h(QueryClientProvider, { client },
    h(WeatherPanel, {
      code: '3509502',
      territory: { ibgeCode: '3509502', name: 'Campinas', parentName: 'São Paulo', level: 'municipality' },
      city: value, data: undefined, error: null, loading: false,
      onClose: () => {}, onDrillDown: () => {},
    }))));
  await draw(city);
  assert.doesNotMatch(document.querySelector('.weather-current').textContent, /Estimado/);
  await draw({ ...city, isInferred: true });
  assert.match(document.querySelector('.weather-current').textContent, /23°/);
  assert.match(document.querySelector('.weather-current').textContent, /≈ Estimado a partir de cidades próximas/);
});

test('rodapé informa a causa real e permite nova tentativa manual', async () => {
  const rateLimited = new ApiError(
    503,
    'provider_rate_limited',
    'O limite diário de consultas da fonte de clima (Open-Meteo) foi atingido. Os dados voltam quando a cota for renovada.',
    { retryAfterSeconds: 900 },
  );
  rateLimited.retryAt = null;
  let retried = 0;
  const draw = (error) => act(async () => root.render(h(QueryClientProvider, { client },
    h(WeatherOptions, {
      showAlerts: false, onToggleAlerts: () => {},
      code: '35', current: undefined, error, loading: false,
      onRefresh: () => { retried += 1; },
    }))));

  await draw(rateLimited);
  const note = document.querySelector('.weather-error-note');
  assert.match(note.textContent, /limite diário de consultas da fonte de clima \(Open-Meteo\)/);
  assert.match(note.textContent, /pausadas até você tentar novamente/);
  const button = document.querySelector('.weather-refresh-btn');
  assert.equal(button.textContent, 'Tentar novamente');
  await act(async () => button.click());
  assert.equal(retried, 1);

  const outage = new ApiError(502, 'provider_error', 'Não foi possível consultar o clima na Open-Meteo.');
  outage.retryAt = new Date(2026, 8, 21, 15, 42).getTime();
  await draw(outage);
  assert.match(document.querySelector('.weather-error-note').textContent, /Nova tentativa automática às 15:42/);

  await draw(null);
  assert.equal(document.querySelector('.weather-error-note'), null);
  assert.equal(document.querySelector('.weather-refresh-btn').textContent, 'Atualizar dados');
});

test('malha nova do mesmo território atualiza o polígono sem recriar o SVG', async () => {
  const square = (size) => ({
    type: 'MultiPolygon',
    coordinates: [[[[-55, -12], [-55 + size, -12], [-55 + size, -12 + size], [-55, -12 + size], [-55, -12]]]],
  });
  const collection = (geometry, value) => ({
    type: 'FeatureCollection',
    scope: { level: 'state', parent: null, lod: 'overview' },
    features: [
      {
        type: 'Feature',
        id: '51',
        geometry,
        properties: { ibgeCode: '51', name: 'Mato Grosso' },
      },
    ],
  });
  const draw = (data) =>
    act(async () =>
      root.render(
        h(
          MapContainer,
          { center: [-11, -54], zoom: 4, zoomControl: false },
          h(CaptureMap),
          h(TerritoryLayer, { collection: data, weatherByCode: new Map(), selectedCode: null }),
        ),
      ),
    );
  const northEdge = () => {
    let north;
    map.eachLayer((layer) => {
      if (layer.feature?.properties?.ibgeCode === '51' && layer.getBounds)
        north = layer.getBounds().getNorth();
    });
    return north;
  };
  const overview = square(2);
  await draw(collection(overview, 1));
  const first = document.querySelector('.territory-shape');
  await draw(collection(overview, 2));
  assert.equal(document.querySelector('.territory-shape'), first, 'novos valores: o SVG fica');
  assert.equal(northEdge(), -10);
  await draw(collection(square(3), 2));
  const shapes = document.querySelectorAll('.territory-shape');
  assert.equal(shapes.length, 1);
  assert.equal(shapes[0], first, 'malha detalhada: o mesmo SVG, sem piscar');
  assert.equal(northEdge(), -9, 'com a geometria nova');
});

test('hover usa o mesmo estilo da camada: sem chuva não vira mancha branca', async () => {
  const data = {
    type: 'FeatureCollection',
    scope: { level: 'municipality', parent: '51', lod: 'overview' },
    features: [
      {
        type: 'Feature',
        id: '5103403',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [[[[-56, -16], [-55, -16], [-55, -15], [-56, -15], [-56, -16]]]],
        },
        properties: { ibgeCode: '5103403', name: 'Cuiabá' },
      },
    ],
  };
  const dry = { id: '5103403', temperatureC: 30, weatherCode: 0, precipitation24hMm: 0 };
  await act(async () =>
    root.render(
      h(
        MapContainer,
        { center: [-15.5, -55.5], zoom: 7, zoomControl: false },
        h(CaptureMap),
        h(TerritoryLayer, {
          collection: data,
          weatherByCode: new Map([['5103403', dry]]),
          rainMode: true,
          selectedCode: null,
        }),
      ),
    ),
  );
  let layer;
  map.eachLayer((candidate) => {
    if (candidate.feature?.properties?.ibgeCode === '5103403' && candidate.setStyle) layer = candidate;
  });
  const opacity = () => Number(layer.options.fillOpacity);
  const resting = opacity();
  layer.fire('mouseover', { containerPoint: { x: 10, y: 10 } });
  assert.ok(opacity() > resting && opacity() <= 0.3, `hover leve, não opaco (${opacity()})`);
  layer.fire('mouseout');
  assert.equal(opacity(), resting);
});

test('linha de hover de cidades e estados renderiza em pane superior para ficar sempre por cima', async () => {
  const data = {
    type: 'FeatureCollection',
    bbox: [-56, -16, -55, -15],
    scope: { level: 'municipality', parent: '51' },
    features: [
      {
        type: 'Feature',
        id: '5103403',
        properties: { ibgeCode: '5103403', name: 'Cuiabá', level: 'municipality' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[-56.1, -15.6], [-56.0, -15.6], [-56.0, -15.5], [-56.1, -15.5], [-56.1, -15.6]]],
        },
      },
    ],
  };

  await act(async () =>
    root.render(
      h(
        MapContainer,
        { center: [-15.5, -55.5], zoom: 7, zoomControl: false },
        h(CaptureMap),
        h(TerritoryLayer, {
          collection: data,
          weatherByCode: new Map(),
          selectedCode: null,
        }),
      ),
    ),
  );

  const hoverPane = map.getPane('territory-hover');
  assert.ok(hoverPane, 'o pane territory-hover deve existir');
  assert.equal(hoverPane.style.zIndex, '470', 'o pane territory-hover deve ter zIndex 470');
  assert.equal(hoverPane.style.pointerEvents, 'none', 'não deve interceptar cliques do mouse');

  let layer;
  map.eachLayer((candidate) => {
    if (candidate.feature?.properties?.ibgeCode === '5103403' && candidate.setStyle) layer = candidate;
  });
  assert.ok(layer);

  // Inicialmente sem hover outline
  assert.equal(hoverPane.querySelectorAll('path').length, 0);

  // Ao passar o mouse, a linha de hover é desenhada no pane territory-hover
  layer.fire('mouseover', { containerPoint: { x: 10, y: 10 } });
  const hoverPaths = hoverPane.querySelectorAll('path');
  assert.equal(hoverPaths.length, 1, 'deve desenhar 1 path de contorno no pane territory-hover');
  assert.ok(hoverPaths[0].classList.contains('territory-hover-outline'));

  // Ao retirar o mouse, o contorno de hover é limpo
  layer.fire('mouseout');
  assert.equal(hoverPane.querySelectorAll('path').length, 0);
});

test('garante apenas um contorno no mapa, sem rastro durante movimentação/zoom e usando cinza suave', async () => {
  const data = {
    type: 'FeatureCollection',
    bbox: [-56, -16, -55, -15],
    scope: { level: 'municipality', parent: '51' },
    features: [
      {
        type: 'Feature',
        id: '5103403',
        properties: { ibgeCode: '5103403', name: 'Cuiabá', level: 'municipality' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[-56.1, -15.6], [-56.0, -15.6], [-56.0, -15.5], [-56.1, -15.5], [-56.1, -15.6]]],
        },
      },
      {
        type: 'Feature',
        id: '5108402',
        properties: { ibgeCode: '5108402', name: 'Várzea Grande', level: 'municipality' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[-56.3, -15.6], [-56.2, -15.6], [-56.2, -15.5], [-56.3, -15.5], [-56.3, -15.6]]],
        },
      },
    ],
  };

  await act(async () =>
    root.render(
      h(
        MapContainer,
        { center: [-15.5, -55.5], zoom: 7, zoomControl: false },
        h(CaptureMap),
        h(TerritoryLayer, {
          collection: data,
          weatherByCode: new Map(),
          selectedCode: null,
        }),
      ),
    ),
  );

  const hoverPane = map.getPane('territory-hover');
  assert.ok(hoverPane);

  const layers = [];
  map.eachLayer((candidate) => {
    if (candidate.feature?.properties?.ibgeCode && candidate.setStyle) {
      layers.push(candidate);
    }
  });
  assert.equal(layers.length, 2);

  // 1. Passa o mouse no primeiro município
  layers[0].fire('mouseover', { containerPoint: { x: 10, y: 10 } });
  let hoverPaths = hoverPane.querySelectorAll('path');
  assert.equal(hoverPaths.length, 1, 'apenas 1 contorno deve existir');
  assert.match(hoverPaths[0].getAttribute('stroke') ?? '', /#52606d/i, 'deve usar o cinza suave #52606d no lugar do preto');

  // 2. Passa o mouse direto no segundo município sem mouseout do primeiro (movimento rápido)
  layers[1].fire('mouseover', { containerPoint: { x: 20, y: 20 } });
  hoverPaths = hoverPane.querySelectorAll('path');
  assert.equal(hoverPaths.length, 1, 'continua garantindo estritamente apenas 1 contorno sem rastro');

  // 3. Ao iniciar movimentação ou aproximação do mapa (ex: zoom/movestart ao entrar no estado), limpa contorno
  map.fire('movestart');
  hoverPaths = hoverPane.querySelectorAll('path');
  assert.equal(hoverPaths.length, 0, 'movimentação do mapa deve anular o hover para não deixar rastros');

  // 4. Enquanto o mapa está em movimento (aproximação/zoom), eventos de mouseover são ignorados
  layers[0].fire('mouseover', { containerPoint: { x: 10, y: 10 } });
  hoverPaths = hoverPane.querySelectorAll('path');
  assert.equal(hoverPaths.length, 0, 'não deve criar rastro por onde o mouse passa com a aproximação');

  // 5. Ao encerrar o movimento (moveend), o hover volta a funcionar normalmente para um único território
  map.fire('moveend');
  layers[0].fire('mouseover', { containerPoint: { x: 10, y: 10 } });
  hoverPaths = hoverPane.querySelectorAll('path');
  assert.equal(hoverPaths.length, 1, 'volta a marcar exclusivamente 1 território após fim do movimento');
});

test('cidade aberta: poucos rótulos vizinhos, menos e mais espaçados com mais municípios', () => {
  const sparse = focusLabelBudget(40);
  const dense = focusLabelBudget(400);
  assert.ok(dense.maxLabels < sparse.maxLabels);
  assert.ok(dense.spacing > sparse.spacing);
  assert.ok(sparse.maxLabels <= 8);
});

test('ScopeHeader navegação hierárquica: exibe Brasil na visão de estado e nome do estado no município', async () => {
  let backClicked = false;
  // 1. Visão de estado: deve exibir Brasil no botão de voltar
  await act(async () =>
    root.render(
      h(ScopeHeader, {
        name: 'São Paulo',
        onBack: () => {
          backClicked = true;
        },
        backLabel: 'Brasil',
        backAriaLabel: 'Voltar ao Brasil',
      }),
    ),
  );

  let backButton = document.querySelector('.ghost-button');
  assert.ok(backButton);
  assert.equal(backButton.textContent.trim(), 'Brasil');
  assert.equal(backButton.getAttribute('aria-label'), 'Voltar ao Brasil');

  await act(async () => {
    backButton.click();
  });
  assert.equal(backClicked, true);

  // 2. Ao entrar em um município: o botão de voltar deve mudar para o nome do estado
  let municipalityBackClicked = false;
  await act(async () =>
    root.render(
      h(ScopeHeader, {
        name: 'São Paulo',
        onBack: () => {
          municipalityBackClicked = true;
        },
        backLabel: 'São Paulo',
        backAriaLabel: 'Voltar a São Paulo',
      }),
    ),
  );

  backButton = document.querySelector('.ghost-button');
  assert.ok(backButton);
  assert.equal(backButton.textContent.trim(), 'São Paulo');
  assert.equal(backButton.getAttribute('aria-label'), 'Voltar a São Paulo');

  await act(async () => {
    backButton.click();
  });
  assert.equal(municipalityBackClicked, true);
});

test('WeatherPanel mantém kicker de Estado para UFs e remove repetição do estado para municípios', async () => {
  const dummyStateCity = {
    id: '35',
    name: 'São Paulo',
    stateAbbreviation: 'SP',
    temperatureC: 22,
    apparentTemperatureC: 22,
    humidityPct: 70,
    windSpeedKmh: 12,
    weatherCode: 2,
    observedAt: '2026-09-20T12:00:00Z',
    timezone: 'America/Sao_Paulo',
    forecast: [],
  };

  // Visão de Estado
  await act(async () =>
    root.render(
      h(
        QueryClientProvider,
        { client },
        h(WeatherPanel, {
          code: '35',
          territory: { ibgeCode: '35', name: 'São Paulo', level: 'state' },
          city: dummyStateCity,
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

  let kicker = document.querySelector('.detail-kicker');
  assert.ok(kicker);
  assert.equal(kicker.textContent, 'Estado');

  // Visão de Município: kicker com nome repetido do estado deve ser omitido
  const dummyMuniCity = {
    id: '3549904',
    name: 'São José dos Campos',
    stateAbbreviation: 'SP',
    temperatureC: 26,
    apparentTemperatureC: 27,
    humidityPct: 55,
    windSpeedKmh: 8,
    weatherCode: 1,
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
          code: '3549904',
          territory: { ibgeCode: '3549904', name: 'São José dos Campos', parentName: 'São Paulo', level: 'municipality' },
          city: dummyMuniCity,
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

  kicker = document.querySelector('.detail-kicker');
  assert.equal(kicker, null, 'município não deve ter kicker repetindo o nome do estado');

  // Hero com temperatura, condição e sensação
  const temp = document.querySelector('.weather-temperature');
  assert.ok(temp);
  assert.match(temp.textContent, /26°/);
  assert.match(document.querySelector('.weather-current').textContent, /Sensação de 27°/);

  // Umidade e Vento em linha compacta
  const compact = document.querySelector('.weather-compact-metrics');
  assert.ok(compact);
  assert.match(compact.textContent, /Umidade 55%/);
  assert.match(compact.textContent, /Vento 8 km\/h/);

  // Apenas "Próximos dias" como disclosure
  const allDetails = Array.from(document.querySelectorAll('details'));
  assert.equal(allDetails.some((d) => d.textContent?.includes('Próximos dias')), true);
  assert.equal(allDetails.some((d) => d.textContent?.includes('Mais detalhes')), false);
});
