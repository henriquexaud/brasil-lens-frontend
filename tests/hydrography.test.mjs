import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDrainageArea, getHydroStyle } from '../src/features/map/hydroStyles.ts';
import { fireMode, hydroZoom, densityColor } from '../src/features/fire/fireDensity.ts';

test('rios mantêm hierarquia e ficam mais discretos quando o fogo está ativo', () => {
  const props = { category: 'river', drainageAreaKm2: 600000 };
  const major = getHydroStyle(props);
  const medium = getHydroStyle({ ...props, drainageAreaKm2: 10000 });
  const small = getHydroStyle({ ...props, drainageAreaKm2: 50 });
  assert.ok(major.weight > medium.weight && medium.weight > small.weight);
  assert.ok(major.opacity < 0.7 && small.opacity < major.opacity);
  assert.ok(getHydroStyle(props, true).opacity < major.opacity);
  const lake = getHydroStyle({ category: 'water_body' }, true);
  assert.equal(lake.fill, true);
  assert.ok(lake.fillOpacity < 0.2);
});

test('detalhe muda somente nas faixas de zoom; foco e densidade não se sobrepõem', () => {
  assert.deepEqual([4, 5.75, 6, 8.75, 9, 12].map(fireMode), ['territorial', 'territorial', 'territorial', 'territorial', 'points', 'points']);
  assert.deepEqual([4, 5.75, 6, 7.75, 8, 9.75, 10, 12].map(hydroZoom), [4, 4, 6, 6, 8, 8, 10, 10]);
  assert.equal(densityColor(0), densityColor(null));
  assert.notEqual(densityColor(0), densityColor(0.5));
  assert.notEqual(densityColor(2), densityColor(200));
  assert.equal(densityColor(2), densityColor(2), 'a escala independe do município/recorte');
});

test('formatação omite área desconhecida ou inválida', () => {
  assert.equal(formatDrainageArea(null), null);
  assert.equal(formatDrainageArea(0), null);
  assert.equal(formatDrainageArea(-5), null);
  assert.equal(formatDrainageArea(639219), '639.219');
});
