import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { disposeHarness, installDom, loadModule } from './helpers/harness.mjs';

installDom();
const { fillTooltipContent, weatherDescription, formatRelativeTime, isStateAverage } =
  await loadModule(`
    export { fillTooltipContent } from './src/features/map/territoryTooltip';
    export { weatherDescription } from './src/features/weather/conditions';
    export { formatRelativeTime } from './src/lib/format';
    export { isStateAverage } from './src/features/weather/EstimateMark';
  `);

after(disposeHarness);

const properties = { ibgeCode: '3550308', name: 'São Paulo', level: 'municipality', parentName: 'SP' };
const weather = (extra = {}) => ({
  id: '3550308',
  temperatureC: 23.6,
  weatherCode: 3,
  precipitation48hMm: 12,
  ...extra,
});
const fire = (extra = {}) => ({
  ibgeCode: '3550308',
  count: 9,
  count48h: 5,
  density: 2.34,
  areaKm2: 1521.1,
  latestDetectionAt: '2026-09-20T15:30:00Z',
  ...extra,
});

function render(...args) {
  const el = document.createElement('div');
  fillTooltipContent(el, ...args);
  return {
    el,
    lines: [...el.children].map((child) => child.textContent),
    text: el.textContent,
  };
}

test('clima: nome, UF, temperatura arredondada e descrição, sem marcar como estimado', () => {
  const { lines, el } = render(properties, weather());
  assert.deepEqual(lines, ['São Paulo', 'SP', '24 °C', 'Nublado']);
  assert.ok(el.querySelector('.tooltip-thermal-dot'), 'a bolinha traz a cor da faixa térmica');
  assert.ok(!el.textContent.includes('≈'));
});

test('clima estimado leva "≈" e "estimado"; média de estado diz de quantos pontos', () => {
  assert.deepEqual(render(properties, weather({ isInferred: true })).lines.slice(2), [
    '≈ 24 °C',
    'Nublado · estimado',
  ]);
  assert.equal(
    render(properties, weather({ samplePoints: 5 })).lines.at(-1),
    'Nublado · média de 5 pontos',
  );
  assert.equal(render(properties, weather({ samplePoints: 1 })).lines.at(-1), 'Nublado');
});

test('sem leitura e sem camada temática, o tooltip mostra só o território', () => {
  assert.deepEqual(render(properties).lines, ['São Paulo', 'SP']);
  assert.deepEqual(
    render({ ...properties, parentName: null }, weather(), undefined, 48, false, false, false)
      .lines,
    ['São Paulo'],
    'com o clima desligado nada é desenhado',
  );
});

test('chuva: acumulado de 48 h, descrição, chovendo agora e probabilidade', () => {
  const { lines } = render(
    properties,
    weather({ rainingNow: true, samplePoints: 4, rainingPoints: 1, precipitationProbabilityPct: 40 }),
    undefined, 48, false, true,
  );
  assert.deepEqual(lines, [
    'São Paulo',
    'SP',
    '12,0 mm',
    'Chuva moderada em 48 h · média de 4 pontos',
    'Chovendo agora em 1 de 4 pontos',
    'Chance de chuva hoje: 40%',
  ]);
});

test('chuva estimada leva "≈"; sem leitura avisa em vez de mostrar 0 mm', () => {
  assert.equal(render(properties, weather({ isInferred: true }), undefined, 48, false, true).lines[2], '≈ 12,0 mm');
  const empty = render(properties, undefined, undefined, 48, false, true);
  assert.equal(empty.lines.at(-1), 'Dados de chuva indisponíveis');
  assert.ok(!empty.text.includes('mm'));
});

test('focos: densidade, contagem na janela, área e última detecção em UTC', () => {
  const { lines } = render(properties, undefined, fire(), 72, true);
  assert.deepEqual(lines.slice(2), [
    '2,3 focos / 1.000 km²',
    '5 em 48h · 9 em 72h',
    '1.521,1 km² · malha IBGE',
    'Última: 20/09, 15:30 UTC',
  ]);
  assert.equal(render(properties, undefined, fire(), 48, true).lines[3], '5 em 48h');
});

test('focos sem resumo ou sem densidade dizem que não há dado, nunca "0 focos"', () => {
  assert.equal(render(properties, undefined, undefined, 48, true).lines.at(-1), 'Resumo de focos indisponível');
  const { lines } = render(properties, undefined, fire({ density: null, areaKm2: null, latestDetectionAt: null }), 48, true);
  assert.deepEqual(lines.slice(2), ['Densidade indisponível', '5 em 48h']);
});

test('foco ativo tem prioridade sobre chuva, e redesenhar não acumula linhas', () => {
  const el = document.createElement('div');
  fillTooltipContent(el, properties, weather(), fire(), 48, true, true);
  fillTooltipContent(el, properties, weather(), fire(), 48, true, true);
  assert.equal(el.querySelectorAll('.tooltip-name').length, 1);
  assert.ok(el.textContent.includes('focos / 1.000 km²'));
  assert.ok(!el.textContent.includes('mm'));
});

test('weatherDescription cobre cada família de código WMO e o desconhecido', () => {
  const expected = {
    0: 'Céu limpo', 1: 'Predominantemente limpo', 2: 'Parcialmente nublado', 3: 'Nublado',
    45: 'Nevoeiro', 48: 'Nevoeiro', 53: 'Garoa', 57: 'Garoa', 63: 'Chuva', 67: 'Chuva',
    73: 'Neve', 86: 'Neve', 81: 'Pancadas de chuva', 95: 'Trovoadas', 99: 'Trovoadas',
  };
  for (const [code, text] of Object.entries(expected)) {
    assert.equal(weatherDescription(Number(code)), text, `código ${code}`);
  }
  assert.equal(weatherDescription(null), 'Condição não informada');
  assert.equal(weatherDescription(1234), 'Condição não informada');
});

test('formatRelativeTime: agora, minutos, horas e dias, sem tempo negativo', () => {
  const now = new Date('2026-09-28T12:00:00Z');
  const ago = (ms) => new Date(now.getTime() - ms);
  const MIN = 60_000;
  assert.equal(formatRelativeTime(ago(20_000), now), 'agora');
  assert.equal(formatRelativeTime(ago(5 * MIN), now), 'há 5 min');
  assert.equal(formatRelativeTime(ago(59 * MIN), now), 'há 59 min');
  assert.equal(formatRelativeTime(ago(60 * MIN), now), 'há 1 h');
  assert.equal(formatRelativeTime(ago(23 * 60 * MIN + 59 * MIN), now), 'há 23 h');
  assert.equal(formatRelativeTime(ago(49 * 60 * MIN), now), 'há 2 d');
  assert.equal(formatRelativeTime(new Date(now.getTime() + 10 * MIN), now), 'agora', 'relógio adiantado');
  assert.equal(formatRelativeTime('2026-09-28T11:30:00Z', now), 'há 30 min', 'aceita string ISO');
});

test('média de estado só quando há mais de um ponto amostrado', () => {
  assert.equal(isStateAverage({ samplePoints: 2 }), true);
  assert.equal(isStateAverage({ samplePoints: 1 }), false);
  assert.equal(isStateAverage({ samplePoints: 0 }), false);
  assert.equal(isStateAverage({ samplePoints: null }), false);
  assert.equal(isStateAverage({}), false);
});
