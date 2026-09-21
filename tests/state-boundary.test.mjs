import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findStateOutline } from '../src/features/map/stateBoundary.ts';

test('seleção do contorno do estado ao entrar em uma UF', () => {
  const mockStatesOverview = [
    {
      type: 'Feature',
      id: '35',
      properties: { ibgeCode: '35', name: 'São Paulo', abbreviation: 'SP', level: 'state' },
      geometry: { type: 'MultiPolygon', coordinates: [] },
    },
    {
      type: 'Feature',
      id: '33',
      properties: { ibgeCode: '33', name: 'Rio de Janeiro', abbreviation: 'RJ', level: 'state' },
      geometry: { type: 'MultiPolygon', coordinates: [] },
    },
  ];

  // 1. Fora de drill-down (visão nacional): nenhum contorno de estado isolado
  assert.equal(findStateOutline(false, null, mockStatesOverview), null);
  assert.equal(findStateOutline(false, '35', mockStatesOverview), null);

  // 2. Com drill-down pelo código IBGE (ex.: '35')
  const outlineSP = findStateOutline(true, '35', mockStatesOverview);
  assert.notEqual(outlineSP, null);
  assert.equal(outlineSP?.properties.name, 'São Paulo');
  assert.equal(outlineSP?.properties.ibgeCode, '35');

  // 3. Com drill-down por sigla (ex.: 'RJ')
  const outlineRJ = findStateOutline(true, 'RJ', mockStatesOverview);
  assert.notEqual(outlineRJ, null);
  assert.equal(outlineRJ?.properties.name, 'Rio de Janeiro');
  assert.equal(outlineRJ?.properties.abbreviation, 'RJ');

  // 4. Estado não encontrado
  assert.equal(findStateOutline(true, '99', mockStatesOverview), null);
});

test('priorização do contorno detalhado (detail LOD) com fallback para overview', () => {
  const mockStatesOverview = [
    {
      type: 'Feature',
      id: '35',
      properties: { ibgeCode: '35', name: 'São Paulo', abbreviation: 'SP', level: 'state', lod: 'overview' },
      geometry: { type: 'MultiPolygon', coordinates: [] },
    },
  ];

  const mockStatesDetail = [
    {
      type: 'Feature',
      id: '35',
      properties: { ibgeCode: '35', name: 'São Paulo', abbreviation: 'SP', level: 'state', lod: 'detail' },
      geometry: { type: 'MultiPolygon', coordinates: [] },
    },
  ];

  function resolveSelectedStateOutline(isDrilledDown, parentCode, detailFeatures, overviewFeatures) {
    if (!isDrilledDown || !parentCode) return null;
    const detailed = findStateOutline(isDrilledDown, parentCode, detailFeatures);
    if (detailed) {
      return { ...detailed, id: `${detailed.id}:detail` };
    }
    return findStateOutline(isDrilledDown, parentCode, overviewFeatures);
  }

  // Quando o lote detalhado está carregado, usa a geometria nítida com id ':detail'
  const sharpOutline = resolveSelectedStateOutline(true, '35', mockStatesDetail, mockStatesOverview);
  assert.notEqual(sharpOutline, null);
  assert.equal(sharpOutline?.id, '35:detail');
  assert.equal(sharpOutline?.properties.lod, 'detail');

  // Quando o lote detalhado ainda não chegou, usa fallback do overview de forma segura
  const fallbackOutline = resolveSelectedStateOutline(true, '35', null, mockStatesOverview);
  assert.notEqual(fallbackOutline, null);
  assert.equal(fallbackOutline?.id, '35');
  assert.equal(fallbackOutline?.properties.lod, 'overview');
});
