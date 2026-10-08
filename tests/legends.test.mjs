import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { disposeHarness, installDom, loadModule } from './helpers/harness.mjs';

const dom = installDom();
const { createElement: h, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { WeatherLegend, RainLegend, FireLegend, Legend, TEMPERATURE_SCALE, RAIN_SCALE_STOPS, FIRE_DENSITY_SCALE, densityColor } = await loadModule(`
  export { WeatherLegend } from './src/features/weather/WeatherLegend';
  export { RainLegend } from './src/features/rainfall/RainLegend';
  export { FireLegend } from './src/features/fire/FireLegend';
  export { Legend } from './src/features/socioeconomic/Legend';
  export { TEMPERATURE_SCALE } from './src/features/map/colors';
  export { RAIN_SCALE_STOPS } from './src/features/rainfall/rainScale';
  export { FIRE_DENSITY_SCALE, densityColor } from './src/features/fire/fireDensity';
`);
let root;
beforeEach(() => { root = createRoot(document.getElementById('root')); });
afterEach(async () => { await act(async () => root.unmount()); });
after(async () => { dom.window.close(); await disposeHarness(); });
const indicator = {key:'population', name:'População', unit:'people', year:2026, requestedYear:'latest'};
const classification = { min:0, max:100, classes:10, breaks:Array.from({length:10}, (_,i)=>(i+1)*10) };
const statistics = {missing:0};
async function render(component, props = {}) { await act(async () => root.render(h(component, props))); }
const segments = () => [...document.querySelectorAll('.scale-legend-segment')];

for (const [name, component, props, scale] of [
  ['temperatura', WeatherLegend, {}, TEMPERATURE_SCALE],
  ['chuva', RainLegend, {}, RAIN_SCALE_STOPS],
  ['fogo', FireLegend, {loading:false,error:false}, FIRE_DENSITY_SCALE],
  ['população', Legend, {indicator,classification,statistics}, null],
]) {
  test(`legenda de ${name} usa a mesma estrutura, dez cores e detalhes acessíveis`, async () => {
    await render(component, props);
    assert.equal(document.querySelector('figure').className, 'legend scale-legend');
    assert.equal(segments().length, 10);
    assert.equal(new Set(segments().map(segment=>segment.style.backgroundColor)).size, 10);
    assert.match(document.querySelector('.scale-legend-bar').getAttribute('aria-label'), /10 cores/);
    if (scale) scale.forEach((band, index) => {
      const swatch = document.createElement('span'); swatch.style.backgroundColor = band.color;
      assert.equal(segments()[index].style.backgroundColor, swatch.style.backgroundColor);
    });
    const last = segments().at(-1);
    await act(async () => last.focus());
    assert.equal(document.querySelector('.scale-legend-active-text').textContent, last.getAttribute('aria-label'));
    await act(async () => last.blur());
    assert.ok(document.querySelector('.scale-legend-unit'));
    assert.equal(document.querySelector('.scale-legend-active-badge'), null);
  });
}

test('carregamento e ausência socioeconômicos mantêm dez segmentos neutros sem confundir ausência com zero', async () => {
  await render(Legend, {indicator, classification:null, statistics:null, loading:true});
  assert.equal(segments().length,10);
  assert.ok(segments().every(segment=>segment.disabled));
  assert.equal(document.querySelector('.scale-legend-bar').getAttribute('aria-busy'),'true');
  assert.match(document.querySelector('[role=status]').textContent,/Carregando/);
  await render(Legend, {indicator, classification:null, statistics:null});
  assert.equal(document.querySelector('.scale-legend-bar').getAttribute('aria-busy'),'false');
  assert.match(document.querySelector('[role=status]').textContent,/Sem dados/);
  await render(Legend, {indicator, classification:{...classification, min:7, max:7, breaks:Array(10).fill(7)}, statistics});
  assert.equal(segments().length,10);
  assert.match(segments()[1].title,/Sem valores distintos/);
});

test('a escala de focos usa dez cores coerentes com o mapa, com zero e ausência preservados', () => {
  assert.equal(new Set(FIRE_DENSITY_SCALE.map(band=>band.color)).size,10);
  FIRE_DENSITY_SCALE.forEach(band=>assert.equal(densityColor(band.min),band.color));
  assert.equal(densityColor(null),'#edf0ee');
  assert.equal(densityColor(NaN),'#edf0ee');
  assert.equal(densityColor(0),'#edf0ee');
  assert.equal(densityColor(0.5),'#fff4ad');
  assert.equal(densityColor(8),'#ffab35');
  assert.equal(densityColor(35),'#dc3526');
  assert.equal(densityColor(60),'#8b1823');
  assert.equal(densityColor(75),'#74152b');
  assert.equal(densityColor(100),'#5e1233');
  assert.equal(densityColor(150),'#480f3b');
});

test('avisos de erro, carga e janela de 48 horas passam pelo componente comum', async () => {
  await render(FireLegend, {loading:false,error:true});
  assert.equal(document.querySelector('.scale-legend-unit').textContent,'48h');
  assert.match(document.querySelector('[role=status]').textContent,/indisponível/);
  await render(RainLegend, {loading:true});
  assert.match(document.querySelector('[role=status]').textContent,/Atualizando precipitação/);
  await render(WeatherLegend, {notice:'Dados estimados'});
  assert.equal(document.querySelector('[role=status]').textContent,'Dados estimados');
});
