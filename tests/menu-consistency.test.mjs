import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { disposeHarness, installDom, loadModule } from './helpers/harness.mjs';

const dom = installDom();
const { createElement: h, act, useState } = await import('react');
const { createRoot } = await import('react-dom/client');
const { SegmentedControl, WeatherThematicSwitch, WeatherOptions } = await loadModule(`
  export { SegmentedControl } from './src/components/SegmentedControl';
  export { WeatherThematicSwitch } from './src/features/weather/WeatherThematicSwitch';
  export { WeatherOptions } from './src/features/weather/WeatherOptions';
`);
let root;
beforeEach(() => {
  root = createRoot(document.getElementById('root'));
});
afterEach(async () => {
  await act(async () => root.unmount());
});
after(disposeHarness);
const render = async (component, props) => act(async () => root.render(h(component, props)));
const tab = (name) =>
  [...document.querySelectorAll('[role="tab"]')].find((button) => button.textContent === name);

test('abas compartilham navegação por teclado e desmarcam apenas quando permitido', async () => {
  const changes = [];
  function Probe({ allowDeselect }) {
    const [value, setValue] = useState('a');
    return h(SegmentedControl, {
      label: 'Contexto',
      value,
      allowDeselect,
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
      onChange: (next) => {
        changes.push(next);
        setValue(next);
      },
    });
  }
  await render(Probe, { allowDeselect: false });
  await act(async () => tab('A').click());
  assert.deepEqual(changes, []);
  await act(async () =>
    tab('A').dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    ),
  );
  assert.equal(document.activeElement, tab('B'));
  assert.equal(tab('B').getAttribute('aria-selected'), 'true');
  assert.equal(tab('A').tabIndex, -1);
  await act(async () =>
    tab('B').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Home', bubbles: true })),
  );
  assert.equal(document.activeElement, tab('A'));
  await render(Probe, { allowDeselect: true });
  await act(async () => tab('A').click());
  assert.equal(changes.at(-1), null);
  assert.equal(tab('A').tabIndex, 0);
  assert.ok(document.querySelector('.segmented-control-indicator.is-hidden'));
});

test('clicar na aba climática ativa continua desligando a camada', async () => {
  const changes = [];
  await render(WeatherThematicSwitch, {
    showClimate: true,
    onToggleClimate: (value) => changes.push(['climate', value]),
    onToggleRainfall: (value) => changes.push(['rain', value]),
    onToggleFireHotspots: (value) => changes.push(['fire', value]),
  });
  await act(async () => tab('Clima').click());
  await act(async () => tab('Fogo').click());
  assert.deepEqual(changes, [
    ['climate', false],
    ['fire', true],
  ]);
});

test('chuva mantém zero válido, período e fonte; ausência, carga e falha têm estados próprios', async () => {
  const props = { showRainfall: true, onToggleRainfall: () => {} };
  await render(WeatherThematicSwitch, { ...props, maxRainfall: 0 });
  assert.equal(document.querySelector('.source-tag').textContent, 'Open-Meteo');
  assert.equal(document.querySelector('.layer-metadata-unit').textContent, 'mm · 48h');
  assert.equal(document.querySelector('.badge-rain').textContent, 'Máx: 0,0 mm');
  await render(WeatherThematicSwitch, props);
  assert.equal(document.querySelector('.badge-neutral').textContent, 'Sem dados');
  await render(WeatherThematicSwitch, { ...props, loading: true });
  assert.equal(document.querySelector('.badge-neutral').textContent, 'Carregando…');
  await render(WeatherThematicSwitch, { ...props, error: 'Fonte indisponível' });
  assert.equal(document.querySelector('.badge-error').textContent, 'Indisponível');
  await render(WeatherThematicSwitch, { ...props, current: { status: 'unavailable', cities: [] } });
  assert.equal(document.querySelector('.badge-error').textContent, 'Indisponível');
});

test('resumo mantém leituras anteriores de clima e focos quando a renovação falha', async () => {
  await render(WeatherThematicSwitch, {
    showClimate: true,
    onToggleClimate: () => {},
    minTemperature: 20,
    maxTemperature: 30,
    error: 'Falha',
  });
  assert.match(document.querySelector('.badge-warning').textContent, /20 - 30°C.*anterior/);
  await render(WeatherThematicSwitch, {
    showFireHotspots: true,
    onToggleFireHotspots: () => {},
    fireHotspotsError: true,
    fireHotspots: { metadata: { hotspotCount: 12, status: 'stale' } },
  });
  assert.equal(document.querySelector('.source-tag').textContent, 'INPE');
  assert.match(document.querySelector('.badge-warning').textContent, /12 focos.*anterior/);
});

for (const code of [null, '35', '3550308']) {
  test(`alertas em ${code ?? 'Brasil'} só mostram ausência após uma resposta concluída`, async () => {
    const props = { code, showAlerts: true, onToggleAlerts: () => {}, alertsPending: true };
    await render(WeatherOptions, props);
    assert.equal(document.querySelector('.badge-neutral').textContent, 'Carregando…');
    assert.doesNotMatch(
      document.getElementById('root').textContent,
      /Sem alertas|Nenhum aviso|Nenhum alerta/,
    );
    await render(WeatherOptions, {
      ...props,
      alertsPending: false,
      alertsError: 'Falha nos alertas',
    });
    assert.equal(document.querySelector('.badge-error').textContent, 'Indisponível');
    assert.match(document.querySelector('[role="alert"]').textContent, /Falha nos alertas/);
    assert.doesNotMatch(
      document.getElementById('root').textContent,
      /Sem alertas|Nenhum aviso|Nenhum alerta/,
    );
    await render(WeatherOptions, { ...props, alertsPending: false, alertsData: { features: [] } });
    assert.equal(document.querySelector('.badge-neutral').textContent, 'Sem alertas');
  });
}

test('fontes dos complementos são neutras e falha na renovação preserva alertas anteriores', async () => {
  await render(WeatherOptions, {
    code: null,
    showAlerts: true,
    onToggleAlerts: () => {},
    showHydrography: true,
    onToggleHydrography: () => {},
    hydrographyPartial: true,
    alertsPending: false,
    alertsError: 'Falha',
    alertsData: { features: [] },
  });
  assert.deepEqual(
    [...document.querySelectorAll('.source-tag')].map((source) => source.textContent),
    ['ANA', 'INMET', 'CEMADEN'],
  );
  const badges = [...document.querySelectorAll('.weather-layer-badge')];
  assert.ok(badges.every((badge) => badge.classList.contains('badge-warning')));
  assert.deepEqual(
    badges.map((badge) => badge.textContent),
    ['Parcial', 'Dados anteriores'],
  );
});
