import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findStateOutline, resolveSelectedStateOutline } from '../src/features/map/stateBoundary.ts';

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

  assert.equal(findStateOutline(false, null, mockStatesOverview), null);
  assert.equal(findStateOutline(false, '35', mockStatesOverview), null);

  const outlineSP = findStateOutline(true, '35', mockStatesOverview);
  assert.notEqual(outlineSP, null);
  assert.equal(outlineSP?.properties.name, 'São Paulo');
  assert.equal(outlineSP?.properties.ibgeCode, '35');

  const outlineRJ = findStateOutline(true, 'RJ', mockStatesOverview);
  assert.notEqual(outlineRJ, null);
  assert.equal(outlineRJ?.properties.name, 'Rio de Janeiro');
  assert.equal(outlineRJ?.properties.abbreviation, 'RJ');

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


  const sharpOutline = resolveSelectedStateOutline(true, '35', mockStatesDetail, mockStatesOverview);
  assert.notEqual(sharpOutline, null);
  assert.equal(sharpOutline?.id, '35:detail');
  assert.equal(sharpOutline?.properties.lod, 'detail');

  const fallbackOutline = resolveSelectedStateOutline(true, '35', null, mockStatesOverview);
  assert.notEqual(fallbackOutline, null);
  assert.equal(fallbackOutline?.id, '35');
  assert.equal(fallbackOutline?.properties.lod, 'overview');
});
