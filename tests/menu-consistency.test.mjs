import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { disposeHarness, installDom, loadModule } from './helpers/harness.mjs';

const dom = installDom();
const { createElement: h, act, useState } = await import('react');
const { createRoot } = await import('react-dom/client');
const {
  SegmentedControl,
  WeatherThematicSwitch,
  WeatherOptions,
  EnvironmentThematicSwitch,
  RiversOption,
  DeforestationAlertsOption,
} = await loadModule(`
  export { SegmentedControl } from './src/components/SegmentedControl';
  export { WeatherThematicSwitch } from './src/features/weather/WeatherThematicSwitch';
  export { WeatherOptions } from './src/features/weather/WeatherOptions';
  export { EnvironmentThematicSwitch } from './src/features/environment/EnvironmentThematicSwitch';
  export { RiversOption } from './src/features/environment/RiversOption';
  export { DeforestationAlertsOption } from './src/features/environment/DeforestationAlertsOption';
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
    onToggleHumidity: (value) => changes.push(['humidity', value]),
  });
  assert.deepEqual(
    [...document.querySelectorAll('[role="tab"]')].map((item) => item.textContent),
    ['Temperatura', 'Chuva', 'Umidade'],
  );
  assert.equal(tab('Fogo'), undefined, 'focos ficam no Meio ambiente');
  await act(async () => tab('Temperatura').click());
  await act(async () => tab('Chuva').click());
  await act(async () => tab('Umidade').click());
  assert.deepEqual(changes, [
    ['climate', false],
    ['rain', true],
    ['humidity', true],
  ]);
});

const environmentProps = {
  layer: 'deforestation',
  onChange: () => {},
  years: [2014, 2017, 2025],
  year: 'latest',
  onYearChange: () => {},
  resolvedYear: 2025,
  fireLoading: false,
  fireError: false,
};

test('Meio ambiente alterna Florestas, Desmatamento e Fogo e desliga a aba ativa', async () => {
  const changes = [];
  await render(EnvironmentThematicSwitch, {
    ...environmentProps,
    onChange: (value) => changes.push(value),
  });
  assert.deepEqual(
    [...document.querySelectorAll('[role="tab"]')].map((item) => item.textContent),
    ['Florestas', 'Perda', 'Fogo'],
  );
  assert.equal(document.querySelector('.source-tag').textContent, 'INPE');
  assert.equal(document.querySelector('.layer-metadata-unit').textContent, 'km² · ano PRODES');
  const select = document.querySelector('.indicator-year-select');
  assert.deepEqual(
    [...select.options].map((option) => option.textContent),
    ['2025 · Último', '2025', '2017', '2014'],
  );
  await act(async () => tab('Perda').click());
  await act(async () => tab('Florestas').click());
  assert.deepEqual(changes, ['none', 'forest']);
  await render(EnvironmentThematicSwitch, { ...environmentProps, layer: 'forest' });
  assert.equal(document.querySelector('.source-tag').textContent, 'MapBiomas');
});

const deterAlerts = { windowEnd: '2026-10-16', days: 14, total: 1802, points: [] };

test('o checkbox de alertas do DETER segue o do Clima: fonte, contagem e como chegar aos pontos', async () => {
  const props = {
    checked: true,
    onChange: () => {},
    alerts: deterAlerts,
    pending: false,
    error: false,
    inState: false,
    count: 1802,
  };
  const badge = () => document.querySelector('.weather-layer-badge').textContent;
  const notes = () => [...document.querySelectorAll('.source-note')].map((item) => item.textContent);
  await render(DeforestationAlertsOption, props);
  assert.equal(document.querySelector('.source-tag').textContent, 'INPE DETER');
  assert.match(document.querySelector('.source-tag').title, /não a taxa oficial/);
  assert.equal(document.querySelector('.weather-layer-title span').textContent, 'Alertas');
  assert.match(badge(), /1\.802 alertas/);
  assert.match(notes()[0], /14 dias até 16\/10\/2026 · Amazônia e Cerrado/);
  assert.ok(notes().some((text) => /Abra um estado/.test(text)), 'no Brasil manda abrir um estado');
  await render(DeforestationAlertsOption, { ...props, inState: true, count: 1, scopeName: 'Pará' });
  assert.equal(badge(), '1 alerta');
  assert.ok(!notes().some((text) => /Abra um estado/.test(text)));
  await render(DeforestationAlertsOption, { ...props, checked: false });
  assert.equal(document.querySelector('.source-note'), null, 'desligado não explica nada');
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
  await render(EnvironmentThematicSwitch, {
    ...environmentProps,
    layer: 'fire',
    fireError: true,
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
    alertsPending: false,
    alertsError: 'Falha',
    alertsData: { features: [] },
  });
  assert.deepEqual(
    [...document.querySelectorAll('.source-tag')].map((source) => source.textContent),
    ['INMET', 'CEMADEN'],
  );
  assert.equal(document.querySelector('.badge-warning').textContent, 'Dados anteriores');
  await render(RiversOption, { checked: true, onChange: () => {}, partial: true });
  assert.deepEqual(
    [...document.querySelectorAll('.source-tag')].map((source) => source.textContent),
    ['ANA'],
  );
  const badges = [...document.querySelectorAll('.weather-layer-badge')];
  assert.ok(badges.every((badge) => badge.classList.contains('badge-warning')));
  assert.deepEqual(
    badges.map((badge) => badge.textContent),
    ['Parcial'],
  );
});
