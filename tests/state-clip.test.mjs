import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { disposeHarness, loadModule } from './helpers/harness.mjs';

const { pointInState } = await loadModule(`
  export { pointInState } from './src/features/environment/stateClip';
`);
after(disposeHarness);

// Dois polígonos: um quadrado de 0 a 10 com um buraco de 4 a 6, e um quadrado separado de 20 a 30.
const ring = (x0, y0, x1, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
  [x0, y0],
];
const state = {
  type: 'MultiPolygon',
  coordinates: [[ring(0, 0, 10, 10), ring(4, 4, 6, 6)], [ring(20, 20, 30, 30)]],
};

test('um ponto dentro do estado é aceito; o de fora, não', () => {
  assert.equal(pointInState(2, 2, state), true);
  assert.equal(pointInState(25, 25, state), true, 'segundo polígono do multipolígono');
  assert.equal(pointInState(15, 15, state), false, 'entre os dois polígonos');
  assert.equal(pointInState(-1, 5, state), false);
});

test('o buraco do polígono não conta como estado', () => {
  assert.equal(pointInState(5, 5, state), false);
  assert.equal(pointInState(3.9, 5, state), true);
});

test('geometria vazia não aceita ponto nenhum', () => {
  assert.equal(pointInState(1, 1, { type: 'MultiPolygon', coordinates: [] }), false);
});
