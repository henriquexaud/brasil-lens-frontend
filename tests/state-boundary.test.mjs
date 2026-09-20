import assert from 'node:assert/strict';
import { test } from 'node:test';

test('seleção do contorno do estado ao entrar em uma UF', () => {
  const mockStates = [
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

  function findStateOutline(isDrilledDown, parentCode, features) {
    if (!isDrilledDown || !parentCode) return null;
    return (
      features?.find(
        (f) =>
          f.properties.ibgeCode === parentCode ||
          f.properties.abbreviation === parentCode,
      ) ?? null
    );
  }

  // 1. Fora de drill-down (visão nacional): nenhum contorno de estado isolado
  assert.equal(findStateOutline(false, null, mockStates), null);
  assert.equal(findStateOutline(false, '35', mockStates), null);

  // 2. Com drill-down pelo código IBGE (ex.: '35')
  const outlineSP = findStateOutline(true, '35', mockStates);
  assert.notEqual(outlineSP, null);
  assert.equal(outlineSP.properties.name, 'São Paulo');
  assert.equal(outlineSP.properties.ibgeCode, '35');

  // 3. Com drill-down por sigla (ex.: 'RJ')
  const outlineRJ = findStateOutline(true, 'RJ', mockStates);
  assert.notEqual(outlineRJ, null);
  assert.equal(outlineRJ.properties.name, 'Rio de Janeiro');
  assert.equal(outlineRJ.properties.abbreviation, 'RJ');

  // 4. Estado não encontrado
  assert.equal(findStateOutline(true, '99', mockStates), null);
});

