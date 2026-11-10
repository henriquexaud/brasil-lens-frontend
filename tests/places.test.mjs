import assert from 'node:assert/strict';
import { test } from 'node:test';

const {
  PLACE_CONTEXTS,
  colorForCount,
  countLabel,
  countScale,
  defaultPreferences,
  normalizePlaces,
  pointArea,
  scaleBands,
} = await import('../src/features/places/places.ts');

const RAMP = ['a', 'b', 'c', 'd', 'e'];

test('a escala de contagem ignora territórios sem lugar e cobre até o maior', () => {
  const scale = countScale([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 100], RAMP);
  assert.deepEqual(scale.breaks, [2, 4, 6, 8, 100]);
  assert.deepEqual(scale.colors, RAMP);
  assert.equal(colorForCount(1, scale), 'a');
  assert.equal(colorForCount(8, scale), 'd');
  assert.equal(colorForCount(100, scale), 'e');
  // Valor acima do maior (resposta nova, escala antiga) fica na última faixa.
  assert.equal(colorForCount(500, scale), 'e');
});

test('poucos valores distintos viram poucas faixas, sem faixa vazia', () => {
  const scale = countScale([1, 1, 1, 1, 7], RAMP);
  assert.deepEqual(scale.breaks, [1, 7]);
  assert.deepEqual(scale.colors, ['a', 'e']);
  assert.deepEqual(scaleBands(scale), [
    { color: 'a', label: '1' },
    { color: 'e', label: '2–7' },
  ]);
  assert.deepEqual(countScale([3], RAMP).colors, ['e']);
});

test('sem nenhum lugar não há escala: ausência não ganha cor', () => {
  assert.equal(countScale([], RAMP), null);
  assert.equal(countScale([0, 0], RAMP), null);
});

test('a contagem usa singular, plural e milhar em pt-BR', () => {
  const tab = PLACE_CONTEXTS.sports.tabs[0];
  assert.equal(countLabel(1, tab), '1 local');
  assert.equal(countLabel(1234, tab), '1.234 locais');
});

test('cada contexto abre na primeira aba, sem filtro', () => {
  assert.deepEqual(defaultPreferences('nature'), {
    tab: 'species',
    categories: {},
    group: 'birds',
  });
  assert.equal(defaultPreferences('resources').tab, 'mining');
  // Toda aba aponta para uma camada e tem os textos do painel.
  for (const config of Object.values(PLACE_CONTEXTS))
    for (const tab of config.tabs) assert.ok(tab.layer && tab.title && tab.one && tab.many);
});

test('preferências salvas inválidas são descartadas sem derrubar as válidas', () => {
  const saved = normalizePlaces({
    nature: { tab: 'caves', categories: {}, group: 'dragons' },
    resources: { tab: 'gold-rush', categories: {} },
    sports: {
      tab: 'places',
      categories: { places: 'basketball', other: 'x', bad: 'DROP TABLE' },
      group: 'birds',
    },
    unknown: { tab: 'x' },
  });
  assert.deepEqual(saved, {
    nature: { tab: 'caves', categories: {}, group: 'birds' },
    sports: { tab: 'places', categories: { places: 'basketball' }, group: 'birds' },
  });
  assert.equal(normalizePlaces(null), undefined);
  assert.equal(normalizePlaces({ nature: 'x' }), undefined);
});

test('de perto a área dos pontos encaixa numa grade fina e contém a vista', () => {
  assert.equal(pointArea(15, '-46.671,-23.601,-46.644,-23.574'), '-46.68,-23.62,-46.64,-23.56');
  assert.equal(pointArea(12, '-46.83,-23.71,-46.41,-23.42'), '-46.90,-23.80,-46.40,-23.40');
  assert.equal(pointArea(15, undefined), undefined);
});
