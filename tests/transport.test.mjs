import assert from 'node:assert/strict';
import { test } from 'node:test';

const {
  attributeRows,
  formatTotal,
  lineLayer,
  networkArea,
  networkDetail,
  validTransport,
  DEFAULT_TRANSPORT,
} = await import('../src/features/transport/layers.ts');

test('o detalhe da malha segue as faixas de zoom da API', () => {
  assert.deepEqual(
    [3, 5.75, 6, 7.9, 8, 9.5, 10, 14].map(networkDetail),
    [4, 4, 6, 6, 8, 8, 10, 10],
  );
});

test('a área pedida encaixa a vista na grade de cada detalhe, sem área no nacional', () => {
  const view = '-47.30,-23.80,-46.10,-23.20';
  assert.equal(networkArea(4, view), undefined);
  assert.equal(networkArea(6, view), '-48.00,-24.00,-44.00,-20.00');
  assert.equal(networkArea(8, view), '-48.00,-24.00,-46.00,-23.00');
  assert.equal(networkArea(10, view), '-47.50,-24.00,-46.00,-23.00');
  // Vistas vizinhas caem na mesma área e reaproveitam a resposta.
  assert.equal(networkArea(8, '-47.10,-23.70,-46.20,-23.10'), networkArea(8, view));
  assert.equal(networkArea(6, '-179.9,-89.9,179.9,89.9'), '-180.00,-90.00,180.00,90.00');
});

test('dentro de uma UF a área não passa da UF, e sem interseção não há pedido', () => {
  const view = '-60.00,-34.00,-30.00,-10.00';
  const saoPaulo = [-53.11, -25.31, -44.16, -19.78];
  assert.equal(networkArea(6, view, saoPaulo), '-56.00,-28.00,-44.00,-16.00');
  assert.equal(networkArea(6, '-40.00,-10.00,-36.00,-6.00', saoPaulo), undefined);
});

test('cada aba desenha a sua linha; Rodovias segue o tipo escolhido', () => {
  assert.equal(lineLayer(DEFAULT_TRANSPORT), 'road_federal');
  assert.equal(lineLayer({ ...DEFAULT_TRANSPORT, roads: 'road_local' }), 'road_local');
  assert.equal(lineLayer({ ...DEFAULT_TRANSPORT, tab: 'rail', roads: 'road_local' }), 'rail');
  assert.equal(lineLayer({ ...DEFAULT_TRANSPORT, tab: 'waterways' }), 'waterway');
});

test('extensão em km e portos por contagem; ausência não vira zero', () => {
  assert.equal(formatTotal('road_federal', 82427), '82.427 km');
  assert.equal(formatTotal('rail', 12.34), '12,3 km');
  assert.equal(formatTotal('rail', 0), '0 km');
  assert.equal(formatTotal('port', 1), '1 porto');
  assert.equal(formatTotal('port', 130), '130 portos');
  assert.equal(formatTotal('waterway', null), 'Sem dados');
});

test('o detalhe do trecho mostra só atributos conhecidos, com rótulo em pt-BR', () => {
  assert.deepEqual(attributeRows({ surface: 'Duplicada', snv: '116BSP0010', other: 'x' }), [
    { label: 'Superfície', value: 'Duplicada' },
    { label: 'Código SNV', value: '116BSP0010' },
  ]);
  assert.deepEqual(attributeRows(null), []);
});

test('preferências do Transporte inválidas são recusadas', () => {
  assert.equal(validTransport(DEFAULT_TRANSPORT), true);
  assert.equal(validTransport({ ...DEFAULT_TRANSPORT, tab: 'air' }), false);
  assert.equal(validTransport({ ...DEFAULT_TRANSPORT, showStreets: 'yes' }), false);
  assert.equal(validTransport(null), false);
});
