import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { disposeHarness, installDom, loadModule } from './helpers/harness.mjs';

installDom();
const { createElement: h, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const {
  humidityColor,
  humidityLevel,
  minHumidity,
  HUMIDITY_SCALE_STOPS,
  humidityPresentation,
  WeatherThematicSwitch,
} = await loadModule(`
  export * from './src/features/humidity/humidityScale';
  export { humidityPresentation } from './src/features/humidity/humidityPresentation';
  export { WeatherThematicSwitch } from './src/features/weather/WeatherThematicSwitch';
`);
let root;
beforeEach(() => {
  root = createRoot(document.getElementById('root'));
});
afterEach(async () => {
  await act(async () => root.unmount());
});
after(disposeHarness);

test('níveis oficiais de umidade baixa: atenção até 30, alerta até 20, emergência abaixo de 12', () => {
  assert.equal(humidityLevel(11), 'emergency');
  assert.equal(humidityLevel(12), 'alert');
  assert.equal(humidityLevel(20), 'alert');
  assert.equal(humidityLevel(21), 'attention');
  assert.equal(humidityLevel(30), 'attention');
  assert.equal(humidityLevel(31), null);
  assert.equal(humidityLevel(null), null, 'ausência não vira nível');
});

test('a escala tem dez cores e segue os limites da legenda', () => {
  assert.equal(HUMIDITY_SCALE_STOPS.length, 10);
  assert.equal(humidityColor(5), HUMIDITY_SCALE_STOPS[0].color);
  assert.equal(humidityColor(11.6), HUMIDITY_SCALE_STOPS[1].color, 'lido como o inteiro exibido');
  assert.equal(humidityColor(25), HUMIDITY_SCALE_STOPS[2].color);
  assert.equal(humidityColor(65), HUMIDITY_SCALE_STOPS[6].color);
  assert.equal(humidityColor(100), HUMIDITY_SCALE_STOPS[9].color);
});

test('mínimo ignora ausência e a apresentação marca estimativa sem inventar valor', () => {
  const cities = [
    { id: '1', humidityPct: 44, isInferred: false },
    { id: '2', humidityPct: null, isInferred: false },
    { id: '3', humidityPct: 18, isInferred: true },
  ];
  assert.equal(minHumidity(cities), 18);
  assert.equal(minHumidity([{ id: '9', humidityPct: null }]), undefined);
  const presentation = humidityPresentation(new Map(cities.map((city) => [city.id, city])), 'x');
  assert.deepEqual([...presentation.values], ['1', '3']);
  assert.equal(presentation.colors.has('2'), false);
  assert.equal(presentation.tooltips.get('3').value, '≈ 18%');
  assert.match(presentation.tooltips.get('3').meta, /Alerta · estimado/);
  assert.equal(presentation.tooltips.get('1').meta, 'Umidade relativa do ar');
});

test('a aba Umidade mostra fonte, unidade e o mínimo do recorte', async () => {
  const props = { showHumidity: true, onToggleHumidity: () => {} };
  await act(async () => root.render(h(WeatherThematicSwitch, { ...props, minHumidity: 18.4 })));
  assert.equal(document.querySelector('.source-tag').textContent, 'Open-Meteo');
  assert.equal(document.querySelector('.layer-metadata-unit').textContent, '% · agora');
  assert.equal(document.querySelector('.badge-humidity').textContent, 'Mín: 18% · Brasil');
  await act(async () => root.render(h(WeatherThematicSwitch, { ...props, minHumidity: 64 })));
  assert.equal(document.querySelector('.badge-climate').textContent, 'Mín: 64% · Brasil');
  await act(async () => root.render(h(WeatherThematicSwitch, { ...props, loading: true })));
  assert.equal(document.querySelector('.badge-neutral').textContent, 'Carregando…');
});
