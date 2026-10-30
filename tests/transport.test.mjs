import assert from 'node:assert/strict';
import { test } from 'node:test';

const {
  attributeRows,
  formatTotal,
  networkArea,
  networkDetail,
  normalizeTransport,
  summaryLayers,
  DEFAULT_TRANSPORT,
} = await import('../src/features/transport/layers.ts');
const { describe, isFederal, isState, roadWidth } =
  await import('../src/features/transport/osm.ts');

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

test('o painel destaca a extensão oficial da aba; Todas soma as três classes', () => {
  assert.deepEqual(summaryLayers({ ...DEFAULT_TRANSPORT, roads: 'federal' }), ['road_federal']);
  assert.deepEqual(summaryLayers({ ...DEFAULT_TRANSPORT, roads: 'state' }), ['road_state']);
  assert.deepEqual(summaryLayers({ ...DEFAULT_TRANSPORT, roads: 'all' }), [
    'road_federal',
    'road_state',
    'road_local',
  ]);
  assert.deepEqual(summaryLayers({ tab: 'rail', roads: 'all' }), ['rail']);
  assert.deepEqual(summaryLayers({ tab: 'waterways', roads: 'all' }), ['waterway']);
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

test('preferências do Transporte: valores da primeira versão migram, inválidos caem', () => {
  assert.deepEqual(normalizeTransport(DEFAULT_TRANSPORT), DEFAULT_TRANSPORT);
  assert.deepEqual(normalizeTransport({ tab: 'rail', roads: 'road_local', showStreets: true }), {
    tab: 'rail',
    roads: 'all',
  });
  assert.equal(normalizeTransport({ ...DEFAULT_TRANSPORT, tab: 'air' }), undefined);
  assert.equal(normalizeTransport({ ...DEFAULT_TRANSPORT, roads: 'x' }), undefined);
  assert.equal(normalizeTransport(null), undefined);
});

test('a sigla da via separa federais e estaduais, inclusive em trechos coincidentes', () => {
  assert.equal(isFederal({ ref: 'BR-116' }), true);
  assert.equal(isFederal({ ref: 'SP-070' }), false);
  assert.equal(isState({ ref: 'SP-070' }), true);
  assert.equal(isState({ ref: 'BR-101' }), false);
  for (const ref of [
    'ERS-118',
    'RSC-287',
    'VRS-813',
    'LMG-754',
    'AMG-0900',
    'MGC-262',
    'SPA 078/070',
    'DF-001',
  ])
    assert.equal(isState({ ref }), true, ref);
  for (const ref of ['PLN-030', 'CDR-120', 'DER-MG', 'IBGE'])
    assert.equal(isState({ ref }), false, ref);
  const shared = { ref: 'BR-364;MT-170' };
  assert.equal(isFederal(shared) && isState(shared), true);
  assert.equal(isFederal({}), false);
});

test('a largura cresce com o zoom e respeita a hierarquia', () => {
  assert.ok(roadWidth('motorway', 12) > roadWidth('primary', 12));
  assert.ok(roadWidth('primary', 12) > roadWidth('residential', 12));
  assert.ok(roadWidth('residential', 16) > roadWidth('residential', 12));
  assert.equal(roadWidth('trunk_link', 13), roadWidth('primary_link', 13));
  assert.equal(roadWidth('motorway', 2), roadWidth('motorway', 4));
});

test('o popup descreve a feição em pt-BR, com a sigla antes do nome', () => {
  assert.deepEqual(
    describe('roads', {
      class: 'trunk',
      ref: 'BR-116',
      name: 'Rodovia Presidente Dutra',
      surface: 'asphalt',
    }),
    {
      title: 'BR-116',
      kind: 'Rodovia principal',
      rows: [
        { label: 'Superfície', value: 'Asfalto' },
        { label: 'Nome', value: 'Rodovia Presidente Dutra' },
      ],
    },
  );
  assert.equal(describe('cycle', { class: 'lane' }).title, 'Ciclofaixa');
  assert.equal(describe('rail', { class: 'subway', name: 'Linha 4' }).kind, 'Metrô');
  assert.deepEqual(describe('rail', { class: 'rail', usage: 'main', operator: 'Rumo' }).rows, [
    { label: 'Uso', value: 'Linha principal' },
    { label: 'Operação', value: 'Rumo' },
  ]);
});

test('o nível do tile é sempre o de cima: nunca amplia um tile de nível menor', async () => {
  const { tileZoomFor } = await import('../src/features/transport/sharpTiles.ts');
  assert.deepEqual([15, 15.25, 15.5, 15.75, 16].map(tileZoomFor), [15, 16, 16, 16, 16]);
  assert.equal(tileZoomFor(12.0000001), 12);
});
