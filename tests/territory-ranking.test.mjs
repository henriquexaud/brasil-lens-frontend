import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { disposeHarness, installDom, loadModule } from './helpers/harness.mjs';

const dom = installDom();
const { createElement: h, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { territoryExtremes, ParticipationRanking, IndicatorRanking } = await loadModule(`
  export { territoryExtremes } from './src/lib/territoryExtremes';
  export { ParticipationRanking } from './src/features/political/ParticipationRanking';
  export { IndicatorRanking } from './src/features/socioeconomic/IndicatorRanking';
`);
const collection = {
  scope: { level: 'state', parent: null },
  features: ['11', '12', '13', '14', '15', '16', '17', '21'].map((id) => ({
    id, properties: { name: `Estado ${id}` },
  })),
};
const values = [0, 90, null, 50, 70, 80, NaN, 10].map((value, i) => ({
  ibgeCode: collection.features[i].id, value,
}));
let root;
beforeEach(() => { root = createRoot(document.getElementById('root')); });
afterEach(async () => { await act(async () => root.unmount()); });
after(async () => { dom.window.close(); await disposeHarness(); });

async function openRanking() {
  const details = document.querySelector('details');
  assert.equal(details.open, false);
  assert.equal(document.querySelector('ol'), null);
  await act(async () => {
    details.open = true;
    details.dispatchEvent(new dom.window.Event('toggle'));
  });
}

test('extremos preservam zero, ignoram ausência e ordenam até três sem repetir locais', () => {
  const result = territoryExtremes(values, collection);
  assert.deepEqual(result.highest.map((item) => item.value), [90, 80, 70]);
  assert.deepEqual(result.lowest.map((item) => item.value), [0, 10, 50]);
  assert.equal(result.count, 6);
  assert.equal(new Set([...result.highest, ...result.lowest].map((item) => item.ibgeCode)).size, 6);
  assert.deepEqual(territoryExtremes(values.slice(0, 2), collection).highest.map((v) => v.value), [90]);
});

test('empates têm ordem estável; amostra uniforme ou malha incompleta não gera ranking enganoso', () => {
  const tied = values.map((item) => ({ ...item, value: 50 }));
  assert.equal(territoryExtremes(tied, collection), null);
  assert.equal(territoryExtremes([], collection), null);
  assert.equal(territoryExtremes(values.slice(0, 1), collection), null);
  assert.equal(territoryExtremes(values, { ...collection, features: collection.features.slice(1) }), null);
  tied[7].value = 10;
  assert.deepEqual(territoryExtremes([...tied].reverse(), collection), territoryExtremes(tied, collection));
});

test('participação reutiliza percentual, informa recorte e parcial e seleciona pelo código IBGE', async () => {
  let selected;
  const data = { metric: 'turnout', year: 2026, round: 1, office: 'president', status: 'partial', values };
  await act(async () => root.render(h(ParticipationRanking, { data, collection, onSelect: (code) => { selected = code; } })));
  assert.match(document.querySelector('summary').textContent, /Comparecimento/);
  await openRanking();
  assert.equal(document.querySelectorAll('ol').length, 2);
  assert.match(document.querySelector('.source-note').textContent, /6 estados com dados · 2026 · 1º turno · Resultados parciais/);
  const buttons = document.querySelectorAll('.territory-ranking-item');
  assert.match(buttons[0].textContent, /90%/);
  assert.match(buttons[3].textContent, /0%/);
  await act(async () => buttons[0].click());
  assert.equal(selected, '12');
  await act(async () => root.render(h(ParticipationRanking, { data: { ...data, metric: 'leading_candidate' }, collection, onSelect() {} })));
  assert.equal(document.querySelector('details'), null);
});

test('socioeconômico mantém ano e unidade e limita rankings aos indicadores selecionados', async () => {
  const data = { parent: null, values, indicator: { key: 'gdp_per_capita', unit: 'BRL', decimalPlaces: 2, year: 2023 } };
  await act(async () => root.render(h(IndicatorRanking, { data, collection, onSelect() {} })));
  await openRanking();
  assert.match(document.querySelector('.territory-ranking-item strong').textContent, /R\$\s*90,00/);
  assert.match(document.querySelector('.source-note').textContent, /2023/);
  for (const indicator of [{ ...data.indicator, key: 'area_km2' }, { ...data.indicator, year: null }]) {
    await act(async () => root.render(h(IndicatorRanking, { data: { ...data, indicator }, collection, onSelect() {} })));
    assert.equal(document.querySelector('details'), null);
  }
});
